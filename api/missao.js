// POST /api/missao — recebe o formulário "Iniciar missão" e salva no banco.
const crypto = require('crypto');
const { configured, pipeline, readBody, clientIp } = require('./_redis');

const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const hash = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method' });
  }
  if (!configured()) return res.status(503).json({ ok: false, error: 'storage_not_configured' });

  const b = readBody(req);
  if (b._honey) return res.status(200).json({ ok: true }); // robô: finge sucesso

  const m = {
    nome: clip(b.nome, 120),
    empresa: clip(b.empresa, 160),
    contato: clip(b.contato, 160),
    tarefa: clip(b.tarefa, 4000),
    origem: clip(b.origem, 300)
  };
  if (!m.nome || !m.contato || !m.tarefa) return res.status(400).json({ ok: false, error: 'missing_fields' });

  try {
    const rk = 'rl:missao:' + hash(clientIp(req));
    const [count] = await pipeline([['INCR', rk]]);
    if (count === 1) await pipeline([['EXPIRE', rk, 900]]);
    if (count > 8) return res.status(429).json({ ok: false, error: 'too_many' });

    const now = Date.now();
    const id = now.toString(36) + crypto.randomBytes(3).toString('hex');
    let cidade = '';
    try { cidade = decodeURIComponent(req.headers['x-vercel-ip-city'] || ''); } catch (_) {}
    const rec = {
      id, ...m,
      status: 'nova', notas: '',
      criado: now, atualizado: now,
      pais: clip(req.headers['x-vercel-ip-country'], 8),
      regiao: clip(req.headers['x-vercel-ip-country-region'], 16),
      cidade: clip(cidade, 80)
    };
    await pipeline([['SET', 'missao:' + id, JSON.stringify(rec)], ['ZADD', 'missoes', now, id]]);
    return res.status(200).json({ ok: true, id });
  } catch (err) {
    console.error('missao', err);
    return res.status(500).json({ ok: false, error: 'storage' });
  }
};
