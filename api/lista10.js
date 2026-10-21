// POST /api/lista10 — lista de espera "Seja um dos 10".
// Grava no mesmo banco do site (Upstash Redis). Esta rota só insere: não existe leitura pública.
// Os inscritos aparecem no Painel (/painel → aba "Lista dos 10"), protegido por senha.
const crypto = require('crypto');
const { configured, pipeline, readBody, clientIp } = require('./_redis');

const TIPOS = ['Limpeza', 'Construção/Reformas', 'Pintura', 'Landscaping', 'Pisos', 'Mudanças', 'Estética/Beleza', 'Outro'];
const clip = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'method' }); }
  if (!configured()) return res.status(503).json({ ok: false, error: 'not_configured' });

  const b = readBody(req);
  const suspeito = Boolean(b.hp_x9); // campo-isca: não descarta, só marca (autopreenchimento do celular pode preenchê-lo)

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

  try {
    const rk = 'rl:10p:' + crypto.createHash('sha256').update(clientIp(req)).digest('hex').slice(0, 16);
    const [n] = await pipeline([['INCR', rk]]);
    if (n === 1) await pipeline([['EXPIRE', rk, 900]]);
    if (n > 6) return res.status(429).json({ ok: false, error: 'too_many' });

    const now = Date.now();
    const rec = {
      id: crypto.randomUUID(), created_at: new Date(now).toISOString(),
      nome, whatsapp, tipo_empresa, cidade_estado, dificuldade, consentimento, origem,
      ...(suspeito ? { suspeito: true } : {})
    };
    // SET NX: grava só se esse WhatsApp ainda não estiver na lista (impede duplicado)
    const [set] = await pipeline([['SET', 'w10:' + whatsapp, JSON.stringify(rec), 'NX']]);
    if (set !== 'OK') return res.status(409).json({ ok: false, error: 'duplicate' });
    await pipeline([['ZADD', 'waitlist_10primeiros', now, whatsapp]]);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('10primeiros', err);
    return res.status(500).json({ ok: false, error: 'storage', detail: String(err && err.message || err).slice(0, 200) });
  }
};
