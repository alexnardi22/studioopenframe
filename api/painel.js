// /api/painel — área privada: lista, atualiza e apaga missões. Protegida por PAINEL_SENHA.
const crypto = require('crypto');
const { configured, pipeline, readBody, clientIp } = require('./_redis');

const STATUSES = ['nova', 'analise', 'proposta', 'fechada', 'arquivada'];
const sha = s => crypto.createHash('sha256').update(String(s)).digest();

function senhaOk(req) {
  const pw = process.env.PAINEL_SENHA || '';
  const got = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!pw || !got) return false;
  return crypto.timingSafeEqual(sha(pw), sha(got));
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  const setup = { storage: configured(), senha: Boolean(process.env.PAINEL_SENHA) };
  if (!setup.storage || !setup.senha) return res.status(503).json({ ok: false, error: 'setup', setup });

  try {
    // bloqueio simples contra tentativa de adivinhar a senha
    const lk = 'rl:painel:' + sha(clientIp(req)).toString('hex').slice(0, 16);
    if (!senhaOk(req)) {
      const [fails] = await pipeline([['INCR', lk]]);
      if (fails === 1) await pipeline([['EXPIRE', lk, 900]]);
      await new Promise(r => setTimeout(r, 500));
      return res.status(fails > 15 ? 429 : 401).json({ ok: false, error: fails > 15 ? 'locked' : 'auth' });
    }

    const lista10 = (req.query && req.query.lista === '10') || /[?&]lista=10\b/.test(req.url || '');
    if (lista10 && req.method === 'GET') {
      const nums = (await pipeline([['ZREVRANGE', 'waitlist_10primeiros', 0, 999]]))[0] || [];
      if (!nums.length) return res.status(200).json({ ok: true, lista: [] });
      const vals = (await pipeline([['MGET', ...nums.map(n => 'w10:' + n)]]))[0] || [];
      const lista = vals.map(v => { try { return JSON.parse(v); } catch (_) { return null; } }).filter(Boolean);
      return res.status(200).json({ ok: true, lista });
    }
    if (lista10 && req.method === 'DELETE') {
      const w = String(readBody(req).whatsapp || '').replace(/\D/g, '').slice(0, 15);
      if (!w) return res.status(400).json({ ok: false, error: 'whatsapp' });
      await pipeline([['DEL', 'w10:' + w], ['ZREM', 'waitlist_10primeiros', w]]);
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'GET') {
      const ids = (await pipeline([['ZREVRANGE', 'missoes', 0, 999]]))[0] || [];
      if (!ids.length) return res.status(200).json({ ok: true, missoes: [] });
      const vals = (await pipeline([['MGET', ...ids.map(i => 'missao:' + i)]]))[0] || [];
      const missoes = vals.map(v => { try { return JSON.parse(v); } catch (_) { return null; } }).filter(Boolean);
      return res.status(200).json({ ok: true, missoes, agora: Date.now() });
    }

    const b = readBody(req);
    const id = String(b.id || '').replace(/[^a-z0-9]/gi, '').slice(0, 40);
    if (!id) return res.status(400).json({ ok: false, error: 'id' });
    const key = 'missao:' + id;

    if (req.method === 'PATCH') {
      const raw = (await pipeline([['GET', key]]))[0];
      if (!raw) return res.status(404).json({ ok: false, error: 'not_found' });
      const rec = JSON.parse(raw);
      if (b.status !== undefined) {
        if (!STATUSES.includes(b.status)) return res.status(400).json({ ok: false, error: 'status' });
        rec.status = b.status;
      }
      if (b.notas !== undefined) rec.notas = String(b.notas).slice(0, 5000);
      rec.atualizado = Date.now();
      await pipeline([['SET', key, JSON.stringify(rec)]]);
      return res.status(200).json({ ok: true, missao: rec });
    }

    if (req.method === 'DELETE') {
      await pipeline([['DEL', key], ['ZREM', 'missoes', id]]);
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, PATCH, DELETE');
    return res.status(405).json({ ok: false, error: 'method' });
  } catch (err) {
    console.error('painel', err);
    return res.status(500).json({ ok: false, error: 'storage' });
  }
};
