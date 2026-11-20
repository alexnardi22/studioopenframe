// /api/mapa?id=<slug> — entrega o Mapa da Missão de uma empresa.
// Travado até o Painel liberar (chave "mapas:liberados" = "1").
// Com a senha do Painel no cabeçalho Authorization, devolve mesmo travado (pré-visualização).
const crypto = require('crypto');
const { configured, pipeline, clientIp } = require('./_redis');

const sha = s => crypto.createHash('sha256').update(String(s)).digest();
const EVENTO = '2026-12-02T19:00:00-05:00';

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'method' });
  if (!configured()) return res.status(503).json({ ok: false, error: 'setup' });

  const q = req.query || {};
  const slug = String(q.id || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 80);
  if (!slug) return res.status(400).json({ ok: false, error: 'id' });

  try {
    const got = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const pw = process.env.PAINEL_SENHA || '';
    let preview = false;
    if (got) {
      const lk = 'rl:painel:' + sha(clientIp(req)).toString('hex').slice(0, 16);
      if (pw && crypto.timingSafeEqual(sha(pw), sha(got))) preview = true;
      else {
        const [fails] = await pipeline([['INCR', lk]]);
        if (fails === 1) await pipeline([['EXPIRE', lk, 900]]);
      }
    }

    const [lib, raw, logo] = await pipeline([['GET', 'mapas:liberados'], ['GET', 'mapa:' + slug], ['GET', 'mapalogo:' + slug]]);
    const liberado = lib === '1';
    // travado: a mesma resposta exista ou não o mapa, para ninguém descobrir quem está na lista
    if (!liberado && !preview) return res.status(403).json({ ok: false, error: 'locked', evento: EVENTO });
    if (!raw) return res.status(404).json({ ok: false, error: 'not_found' });
    const mapa = JSON.parse(raw);
    if (logo) mapa.logo = logo;
    return res.status(200).json({ ok: true, preview: preview && !liberado, mapa });
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'server' });
  }
};
