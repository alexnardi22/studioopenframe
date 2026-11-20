// Busca o logo da empresa a partir do site ou do @ do Instagram informado no Raio-X.
// Devolve uma data URL (a imagem fica guardada no banco; nada depende de sites de terceiros na hora de abrir o mapa).

const TIPOS = /^image\/(png|jpe?g|webp|gif|x-icon|vnd\.microsoft\.icon)$/i;
const MAX = 400 * 1024;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';

async function get(url, ms) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), ms);
  try { return await fetch(url, { signal: ac.signal, redirect: 'follow', headers: { 'user-agent': UA, accept: '*/*' } }); }
  finally { clearTimeout(t); }
}

function handleInstagram(s) {
  const m = s.match(/instagram\.com\/([A-Za-z0-9._]{2,30})/i) || s.match(/^@([A-Za-z0-9._]{2,30})$/);
  return m ? m[1].replace(/\.$/, '') : '';
}

function dominio(s) {
  const t = s.trim().replace(/^@/, '');
  if (/\s/.test(t) || !/\.[a-z]{2,}/i.test(t)) return '';
  try { const u = new URL(/^https?:\/\//i.test(t) ? t : 'https://' + t); return /instagram\.com$/i.test(u.hostname) ? '' : u.origin; } catch (_) { return ''; }
}

async function candidatosDoSite(origin) {
  const out = [];
  try {
    const r = await get(origin, 7000);
    const html = (await r.text()).slice(0, 300000);
    const base = r.url || origin;
    const abs = h => { try { return new URL(h.replace(/&amp;/g, '&'), base).href; } catch (_) { return ''; } };
    const tags = html.match(/<(link|meta)\b[^>]*>/gi) || [];
    const attr = (tag, n) => { const m = tag.match(new RegExp(n + '\\s*=\\s*["\']([^"\']+)["\']', 'i')); return m ? m[1] : ''; };
    const icons = [];
    tags.forEach(tag => {
      const rel = attr(tag, 'rel').toLowerCase(), prop = (attr(tag, 'property') || attr(tag, 'name')).toLowerCase();
      if (/apple-touch-icon/.test(rel)) icons.push({ u: abs(attr(tag, 'href')), p: 300 });
      else if (/(^|\s)icon/.test(rel)) { const sz = parseInt(attr(tag, 'sizes')) || 32; icons.push({ u: abs(attr(tag, 'href')), p: Math.min(sz, 256) }); }
      else if (prop === 'og:image') icons.push({ u: abs(attr(tag, 'content')), p: 90 });
    });
    icons.filter(i => i.u && !/\.svg(\?|$)/i.test(i.u)).sort((a, b) => b.p - a.p).forEach(i => out.push(i.u));
  } catch (_) {}
  out.push(origin + '/apple-touch-icon.png', origin + '/favicon.ico');
  return out;
}

async function baixar(url) {
  try {
    const r = await get(url, 7000);
    if (!r.ok) return '';
    const tipo = String(r.headers.get('content-type') || '').split(';')[0].trim();
    if (!TIPOS.test(tipo)) return '';
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 200 || buf.length > MAX) return '';
    return `data:${tipo};base64,${buf.toString('base64')}`;
  } catch (_) { return ''; }
}

async function buscarLogo(site) {
  const s = String(site || '').trim();
  if (!s) return '';
  const h = handleInstagram(s);
  const lista = h ? [`https://unavatar.io/instagram/${h}?fallback=false`] : [];
  const o = dominio(s);
  if (o) lista.push(...(await candidatosDoSite(o)));
  for (const u of lista.slice(0, 8)) { const d = await baixar(u); if (d) return d; }
  return '';
}

function dataUrlValida(d) {
  return typeof d === 'string' && d.length <= MAX * 1.4 && /^data:image\/(png|jpe?g|webp|gif|x-icon|vnd\.microsoft\.icon);base64,[A-Za-z0-9+/=]+$/.test(d);
}

module.exports = { buscarLogo, dataUrlValida };
