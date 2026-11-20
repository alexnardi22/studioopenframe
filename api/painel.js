// /api/painel — área privada: lista, atualiza e apaga missões. Protegida por PAINEL_SENHA.
const crypto = require('crypto');
const { configured, pipeline, readBody, clientIp } = require('./_redis');
const { provedor, gerarMapa } = require('./_ia');

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

    const listaCR = (req.query && req.query.lista === 'cr') || /[?&]lista=cr\b/.test(req.url || '');
    if (listaCR && req.method === 'GET') {
      const nums = (await pipeline([['ZREVRANGE', 'contagem_inscritos', 0, 999]]))[0] || [];
      if (!nums.length) return res.status(200).json({ ok: true, lista: [] });
      const vals = (await pipeline([['MGET', ...nums.map(n => 'cr:' + n)]]))[0] || [];
      return res.status(200).json({ ok: true, ia: !!provedor(), lista: vals.map(v => { try { return JSON.parse(v); } catch (_) { return null; } }).filter(Boolean) });
    }
    if (listaCR && req.method === 'DELETE') {
      const w = String(readBody(req).whatsapp || '').replace(/\D/g, '').slice(0, 15);
      if (!w) return res.status(400).json({ ok: false, error: 'whatsapp' });
      await pipeline([['DEL', 'cr:' + w], ['ZREM', 'contagem_inscritos', w]]);
      return res.status(200).json({ ok: true });
    }
    const gerar = (req.query && req.query.lista === 'gerar') || /[?&]lista=gerar\b/.test(req.url || '');
    if (gerar && req.method === 'POST') {
      const b = readBody(req);
      const w = String(b.whatsapp || '').replace(/\D/g, '').slice(0, 15);
      const raw = w && (await pipeline([['GET', 'cr:' + w]]))[0];
      if (!raw) return res.status(404).json({ ok: false, error: 'inscricao' });
      const insc = JSON.parse(raw);
      if (!provedor()) return res.status(503).json({ ok: false, error: 'ia_setup' });
      let rascunho;
      try { rascunho = await gerarMapa(insc, String(b.orientacao || '').slice(0, 600)); }
      catch (e) { console.error('gerar', e); return res.status(502).json({ ok: false, error: 'ia', detail: String(e.message || e).slice(0, 200) }); }
      rascunho.slug = insc.mapa_slug || '';
      rascunho.whatsapp = w;
      const r = limparMapa(rascunho);
      if (r.erro) return res.status(502).json({ ok: false, error: 'ia', detail: 'mapa incompleto: ' + r.erro });
      insc.mapa_slug = r.mapa.slug; insc.mapa_em = r.mapa.atualizado_em;
      await pipeline([['SET', 'mapa:' + r.mapa.slug, JSON.stringify(r.mapa)], ['ZADD', 'mapas', Date.now(), r.mapa.slug], ['SET', 'cr:' + w, JSON.stringify(insc)]]);
      return res.status(200).json({ ok: true, slug: r.mapa.slug, mapa: r.mapa });
    }
    const listaMapas = (req.query && req.query.lista === 'mapas') || /[?&]lista=mapas\b/.test(req.url || '');
    if (listaMapas) {
      if (req.method === 'GET') {
        const [lib, slugs] = await pipeline([['GET', 'mapas:liberados'], ['ZREVRANGE', 'mapas', 0, 999]]);
        let lista = [];
        if (slugs && slugs.length) {
          const vals = (await pipeline([['MGET', ...slugs.map(s => 'mapa:' + s)]]))[0] || [];
          lista = vals.map(v => { try { return JSON.parse(v); } catch (_) { return null; } }).filter(Boolean);
        }
        return res.status(200).json({ ok: true, liberados: lib === '1', lista });
      }
      const b = readBody(req);
      if (req.method === 'PATCH') {
        await pipeline([['SET', 'mapas:liberados', b.liberados ? '1' : '0']]);
        return res.status(200).json({ ok: true, liberados: !!b.liberados });
      }
      if (req.method === 'DELETE') {
        const s = String(b.slug || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 80);
        if (!s) return res.status(400).json({ ok: false, error: 'slug' });
        await pipeline([['DEL', 'mapa:' + s], ['ZREM', 'mapas', s]]);
        return res.status(200).json({ ok: true });
      }
      if (req.method === 'POST') {
        const arr = Array.isArray(b.mapas) ? b.mapas : (b.empresa ? [b] : []);
        if (!arr.length || arr.length > 200) return res.status(400).json({ ok: false, error: 'vazio' });
        const salvos = [], erros = [];
        const cmds = [];
        arr.forEach((m, i) => {
          const r = limparMapa(m);
          if (r.erro) { erros.push({ i, empresa: m && m.empresa, erro: r.erro }); return; }
          cmds.push(['SET', 'mapa:' + r.mapa.slug, JSON.stringify(r.mapa)], ['ZADD', 'mapas', Date.now() + i, r.mapa.slug]);
          salvos.push(r.mapa.slug);
        });
        if (cmds.length) await pipeline(cmds);
        return res.status(200).json({ ok: true, salvos, erros });
      }
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

// ───── Mapa da Missão: valida e limpa o JSON importado no Painel ─────
const AUTON = ['sozinho', 'autoriza', 'voce'];
const TIPOS_DIA = ['concluido', 'andamento', 'decisao', 'bloqueado', 'nao_verificado'];
const txt = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
const slugify = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
function limparMapa(m) {
  if (!m || typeof m !== 'object') return { erro: 'formato' };
  const empresa = txt(m.empresa, 80);
  if (empresa.length < 2) return { erro: 'empresa' };
  let slug = String(m.slug || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 80);
  // sufixo aleatório: o link não pode ser adivinhado só pelo nome da empresa
  if (!slug) slug = (slugify(empresa) || 'empresa') + '-' + crypto.randomBytes(3).toString('hex');
  if (slug === 'exemplo') return { erro: 'slug reservado' };
  const lista = (a, n) => (Array.isArray(a) ? a : []).slice(0, n);
  const tarefas = lista(m.tarefas, 8).map(t => ({
    titulo: txt(t && t.titulo, 90), hoje: txt(t && t.hoje, 240), como: txt(t && t.como, 320),
    autonomia: AUTON.includes(t && t.autonomia) ? t.autonomia : 'autoriza'
  })).filter(t => t.titulo);
  if (!tarefas.length) return { erro: 'tarefas' };
  const n = v => { const x = Number(v); return isFinite(x) && x >= 0 && x < 1000 ? Math.round(x * 10) / 10 : null; };
  const est = m.estimativa_horas || {};
  return {
    mapa: {
      slug, empresa,
      contato_nome: txt(m.contato_nome, 60), ramo: txt(m.ramo, 80), cidade: txt(m.cidade, 80),
      resumo: txt(m.resumo, 700),
      tarefas,
      dia: lista(m.dia, 12).map(d => ({ hora: txt(d && d.hora, 8), texto: txt(d && d.texto, 160), tipo: TIPOS_DIA.includes(d && d.tipo) ? d.tipo : 'concluido' })).filter(d => d.texto),
      red_flags: lista(m.red_flags, 6).map(r => ({ titulo: txt(r && r.titulo, 90), exemplo: txt(r && r.exemplo, 280), para: txt(r && r.para, 60) })).filter(r => r.titulo),
      horas_semana_atual: txt(m.horas_semana_atual, 30),
      estimativa_horas: { min: n(est.min), max: n(est.max) },
      indicadores: lista(m.indicadores, 6).map(x => txt(x, 90)).filter(Boolean),
      primeiro_passo: txt(m.primeiro_passo, 400),
      ferramentas: txt(m.ferramentas, 200),
      whatsapp: String(m.whatsapp || '').replace(/\D/g, '').slice(0, 15),
      atualizado_em: new Date().toISOString()
    }
  };
}
