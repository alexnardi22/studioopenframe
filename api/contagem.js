// POST /api/contagem — inscrição no evento "Contagem Regressiva" (Raio-X da Operação).
// Grava no banco do site (Upstash). Só insere; a leitura é pelo Painel, com senha.
const crypto = require('crypto');
const { configured, pipeline, readBody, clientIp } = require('./_redis');

const RAMOS = ['Serviços para casas', 'Construção e reformas', 'Imobiliário', 'Alimentação', 'Saúde e estética', 'Comércio e varejo',
  'Logística e transporte', 'Contabilidade, jurídico e consultoria', 'Educação', 'Outro'];
const HORAS = ['Menos de 5', '5 a 10', '10 a 20', '20 a 40', 'Mais de 40'];
const PERDAS = ['Demora para responder', 'Ligações não atendidas', 'Orçamentos sem retorno', 'Cobrança atrasada', 'Agenda furada',
  'Pós-venda e avaliações', 'Equipe precisa ser lembrada', 'Comunicação em inglês'];
const clip = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
const clipML = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: 'method' }); }
  if (!configured()) return res.status(503).json({ ok: false, error: 'not_configured' });

  const b = readBody(req);
  const r = {
    nome: clip(b.nome, 120), empresa: clip(b.empresa, 160),
    whatsapp: String(b.whatsapp || '').replace(/\D/g, ''), email: clip(b.email, 160).toLowerCase(),
    ramo: clip(b.ramo, 60), site: clip(b.site, 200), faz: clip(b.faz, 300),
    tarefas: clipML(b.tarefas, 1500), horas: clip(b.horas, 20), ferramentas: clip(b.ferramentas, 300),
    perdas: Array.isArray(b.perdas) ? b.perdas.filter(p => PERDAS.includes(p)).slice(0, 8) : [],
    consentimento: b.consentimento === true, origem: clip(b.origem, 120) || null
  };
  const erros = [];
  if (r.nome.length < 2) erros.push('nome');
  if (r.empresa.length < 2) erros.push('empresa');
  if (!/^[0-9]{10,15}$/.test(r.whatsapp)) erros.push('whatsapp');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) erros.push('email');
  if (!RAMOS.includes(r.ramo)) erros.push('ramo');
  if (r.faz.length < 3) erros.push('faz');
  if (r.tarefas.length < 3) erros.push('tarefas');
  if (!HORAS.includes(r.horas)) erros.push('horas');
  if (!r.consentimento) erros.push('consent');
  if (erros.length) return res.status(400).json({ ok: false, error: 'invalid', campos: erros });

  try {
    const rk = 'rl:cr:' + crypto.createHash('sha256').update(clientIp(req)).digest('hex').slice(0, 16);
    const [n] = await pipeline([['INCR', rk]]);
    if (n === 1) await pipeline([['EXPIRE', rk, 900]]);
    if (n > 6) return res.status(429).json({ ok: false, error: 'too_many' });

    const now = Date.now();
    const rec = { id: crypto.randomUUID(), created_at: new Date(now).toISOString(), ...r, ...(b.hp_x9 ? { suspeito: true } : {}) };
    const [set] = await pipeline([['SET', 'cr:' + r.whatsapp, JSON.stringify(rec), 'NX']]);
    if (set !== 'OK') return res.status(409).json({ ok: false, error: 'duplicate' });
    await pipeline([['ZADD', 'contagem_inscritos', now, r.whatsapp]]);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('contagem', err);
    return res.status(500).json({ ok: false, error: 'storage', detail: String(err && err.message || err).slice(0, 200) });
  }
};
