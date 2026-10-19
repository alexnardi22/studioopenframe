// Cliente mínimo para o Upstash Redis (REST), sem dependências.
// A integração da Vercel injeta KV_REST_API_URL / KV_REST_API_TOKEN (ou UPSTASH_REDIS_REST_*).
function env() {
  return {
    url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '',
    token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || ''
  };
}

function configured() {
  const { url, token } = env();
  return Boolean(url && token);
}

async function pipeline(cmds) {
  const { url, token } = env();
  const r = await fetch(url.replace(/\/$/, '') + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds)
  });
  if (!r.ok) throw new Error('redis http ' + r.status);
  const out = await r.json();
  return out.map(x => {
    if (x && x.error) throw new Error('redis ' + x.error);
    return x ? x.result : null;
  });
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body) {
    try { return JSON.parse(req.body); } catch (_) { return {}; }
  }
  return {};
}

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '').split(',')[0].trim() || 'desconhecido';
}

module.exports = { configured, pipeline, readBody, clientIp };
