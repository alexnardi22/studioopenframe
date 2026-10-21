// POST /api/10primeiros — lista de espera "Seja um dos 10".
// Insere no Supabase com a chave pública (anon), respeitando o RLS: o público só insere, nunca lê.
const crypto = require('crypto');
const { configured: redisOk, pipeline, readBody, clientIp } = require('./_redis');

const TIPOS = ['Limpeza', 'Construção/Reformas', 'Pintura', 'Landscaping', 'Pisos', 'Mudanças', 'Estética/Beleza', 'Outro'];
const clip = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);

function supa() {
  return {
    url: (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, ''),
    key: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || ''
  };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'method' }); }
  const { url, key } = supa();
  if (!url || !key) return res.status(503).json({ ok: false, error: 'not_configured' });

  const b = readBody(req);
  if (b.empresa_site) return res.status(200).json({ ok: true }); // campo-isca para robôs

  const nome = clip(b.nome, 120);
  const whatsapp = String(b.whatsapp || '').replace(/\D/g, '');
  const tipo_empresa = clip(b.tipo_empresa, 40);
  const cidade_estado = clip(b.cidade_estado, 120);
  const dificuldade = String(b.dificuldade || '').trim().slice(0, 2000) || null;
  const consentimento = b.consentimento === true;
  const origem = clip(b.origem, 120) || null;

  const erros = [];
  if (nome.length < 2) erros.push('nome');
  if (!/^[0-9]{10,15}$/.test(whatsapp)) erros.push('whatsapp');
  if (!TIPOS.includes(tipo_empresa)) erros.push('tipo_empresa');
  if (cidade_estado.length < 2) erros.push('cidade_estado');
  if (!consentimento) erros.push('consentimento');
  if (erros.length) return res.status(400).json({ ok: false, error: 'invalid', campos: erros });

  // limite simples por IP (se o Redis do site estiver conectado)
  if (redisOk()) {
    try {
      const rk = 'rl:10p:' + crypto.createHash('sha256').update(clientIp(req)).digest('hex').slice(0, 16);
      const [n] = await pipeline([['INCR', rk]]);
      if (n === 1) await pipeline([['EXPIRE', rk, 900]]);
      if (n > 6) return res.status(429).json({ ok: false, error: 'too_many' });
    } catch (_) { /* sem limite se o Redis falhar */ }
  }

  try {
    const r = await fetch(url + '/rest/v1/waitlist_10primeiros', {
      method: 'POST',
      headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ nome, whatsapp, tipo_empresa, cidade_estado, dificuldade, consentimento, origem })
    });
    if (r.status === 201 || r.status === 204) return res.status(200).json({ ok: true });
    const txt = await r.text();
    if (r.status === 409 || /23505|duplicate key/i.test(txt)) return res.status(409).json({ ok: false, error: 'duplicate' });
    console.error('supabase', r.status, txt.slice(0, 300));
    return res.status(502).json({ ok: false, error: 'storage' });
  } catch (err) {
    console.error('supabase fetch', err);
    return res.status(502).json({ ok: false, error: 'storage' });
  }
};
