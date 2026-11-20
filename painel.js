/* OpenFrame · Painel de Missões */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const API = '/api/painel';
  const STATUS = {
    nova: { label: 'NOVA', color: 'var(--amber)' },
    analise: { label: 'EM ANÁLISE', color: 'var(--blue)' },
    proposta: { label: 'PROPOSTA ENVIADA', color: 'var(--gold)' },
    fechada: { label: 'FECHADA', color: 'var(--mint)' },
    arquivada: { label: 'ARQUIVADA', color: 'rgba(242,242,240,.4)' }
  };
  const store = {
    get(k) { try { return sessionStorage.getItem(k) || localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v, persist) { try { (persist ? localStorage : sessionStorage).setItem(k, v); } catch (_) {} },
    del(k) { try { sessionStorage.removeItem(k); localStorage.removeItem(k); } catch (_) {} }
  };

  let senha = store.get('of_painel');
  let missoes = [], filtro = 'ativas', busca = '', selId = null, timer = 0;
  let lastSeen = Number(store.get('of_seen') || 0);
  const seenAtLoad = lastSeen;

  // ───────── API ─────────
  async function api(method, body) {
    const r = await fetch(API, {
      method,
      headers: { Authorization: 'Bearer ' + (senha || ''), 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(data.error || r.status); e.status = r.status; e.data = data; throw e; }
    return data;
  }

  function show(id) { ['gate', 'setup', 'app'].forEach(x => { $('#' + x).hidden = x !== id; }); }

  async function boot() {
    if (!senha) { show('gate'); $('#pw').focus(); probeSetup(); return; }
    try { await load(); show('app'); startPolling(); }
    catch (e) { handleErr(e); }
  }

  async function probeSetup() { // descobre se falta configurar algo, mesmo sem senha
    try { await fetch(API, { headers: { Authorization: 'Bearer -' } }).then(async r => { if (r.status === 503) showSetup((await r.json()).setup); }); } catch (_) {}
  }

  function showSetup(setup) {
    show('setup');
    $('#sStorage').classList.toggle('ok', !!(setup && setup.storage));
    $('#sSenha').classList.toggle('ok', !!(setup && setup.senha));
  }

  function handleErr(e) {
    if (e.status === 503 && e.data && e.data.setup) return showSetup(e.data.setup);
    if (e.status === 401 || e.status === 429) {
      store.del('of_painel'); senha = null; show('gate');
      $('#loginMsg').textContent = e.status === 429 ? 'MUITAS TENTATIVAS. ESPERE 15 MINUTOS.' : 'SENHA INCORRETA.';
      return;
    }
    setSync(false, 'SEM CONEXÃO · TENTANDO DE NOVO');
  }

  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('#loginBtn'); btn.disabled = true; $('#loginMsg').textContent = '';
    senha = $('#pw').value;
    try {
      await load();
      store.set('of_painel', senha, $('#remember').checked);
      show('app'); startPolling();
    } catch (err) { handleErr(err); }
    btn.disabled = false;
  });
  $('#setupRetry').addEventListener('click', () => { senha ? boot() : location.reload(); });
  $('#logout').addEventListener('click', () => { store.del('of_painel'); senha = null; clearInterval(timer); $('#pw').value = ''; show('gate'); });

  // ───────── DATA ─────────
  async function load() {
    const d = await api('GET');
    missoes = d.missoes || [];
    setSync(true);
    render();
  }
  function startPolling() {
    clearInterval(timer);
    timer = setInterval(() => { if (!document.hidden) load().catch(handleErr); }, 30000);
    const newest = missoes.reduce((m, x) => Math.max(m, x.criado || 0), 0);
    store.set('of_seen', String(Math.max(newest, lastSeen)), true);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && senha && !$('#app').hidden) load().catch(handleErr); });
  function setSync(ok, txt) {
    const d = new Date();
    $('#sync').innerHTML = `<i class="dot ${ok ? 'live' : 'err'}"></i>${txt || 'ATUALIZADO ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')}`;
  }

  // ───────── RENDER ─────────
  const ago = t => {
    const s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return 'AGORA';
    if (s < 3600) return `HÁ ${Math.floor(s / 60)} MIN`;
    if (s < 86400) return `HÁ ${Math.floor(s / 3600)} H`;
    if (s < 86400 * 30) return `HÁ ${Math.floor(s / 86400)} D`;
    return new Date(t).toLocaleDateString('pt-BR');
  };
  const fullDate = t => new Date(t).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  function visible() {
    const q = norm(busca);
    return missoes.filter(m => {
      if (filtro === 'ativas' && (m.status === 'fechada' || m.status === 'arquivada')) return false;
      if (STATUS[filtro] && m.status !== filtro) return false;
      if (q && !norm([m.nome, m.empresa, m.contato, m.tarefa, m.notas].join(' ')).includes(q)) return false;
      return true;
    });
  }

  function render() {
    const c = { nova: 0, analise: 0, proposta: 0, fechada: 0, semana: 0 };
    const wk = Date.now() - 7 * 86400000;
    missoes.forEach(m => { if (c[m.status] !== undefined) c[m.status]++; if (m.criado >= wk) c.semana++; });
    $$('[data-k]').forEach(b => b.textContent = c[b.dataset.k]);
    document.title = (c.nova ? `(${c.nova}) ` : '') + 'Painel de Missões · OpenFrame';

    const list = $('#list'); list.innerHTML = '';
    const rows = visible();
    $('#empty').hidden = rows.length > 0;
    $('#emptyText').textContent = missoes.length
      ? 'Nenhuma missão neste filtro. Tente “Todas” ou limpe a busca.'
      : 'Quando alguém enviar o formulário “Iniciar missão” em studioopenframe.com, ela aparece aqui na hora.';
    rows.forEach(m => {
      const li = document.createElement('li');
      li.className = 'item' + (m.id === selId ? ' sel' : '');
      li.tabIndex = 0; li.setAttribute('role', 'button');
      li.innerHTML = `<i class="st"></i><div class="who"></div><span class="when mono"></span><p class="task"></p>`;
      li.querySelector('.st').style.background = (STATUS[m.status] || STATUS.nova).color;
      const who = li.querySelector('.who'); who.textContent = m.nome;
      if (m.empresa) { const sm = document.createElement('small'); sm.textContent = ' · ' + m.empresa; who.append(sm); }
      if (m.criado > seenAtLoad && m.status === 'nova') { const n = document.createElement('span'); n.className = 'new'; n.textContent = 'NOVA'; who.append(n); }
      li.querySelector('.when').textContent = ago(m.criado);
      li.querySelector('.task').textContent = m.tarefa;
      const open = () => select(m.id);
      li.addEventListener('click', open);
      li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      list.append(li);
    });
    if (selId && !missoes.find(m => m.id === selId)) { selId = null; clearDetail(); }
    if (selId) renderDetail(missoes.find(m => m.id === selId), true);
  }

  function clearDetail() { $('#detail').innerHTML = '<div class="detail-empty"><p class="mono dim">SELECIONE UMA MISSÃO PARA VER OS DETALHES</p></div>'; $('#app').classList.remove('show-detail'); }

  function select(id) {
    selId = id; render();
    renderDetail(missoes.find(m => m.id === id));
    $('#app').classList.add('show-detail');
    if (matchMedia('(max-width:860px)').matches) window.scrollTo({ top: 0 });
  }

  function contactLinks(contato) {
    const links = [];
    const email = (contato.match(/[^\s@]+@[^\s@]+\.[^\s@]+/) || [])[0];
    const digits = contato.replace(/\D/g, '');
    if (email) links.push(['RESPONDER POR E-MAIL', `mailto:${email}?subject=${encodeURIComponent('OpenFrame · sua missão')}`]);
    if (!email && digits.length >= 10) links.push(['WHATSAPP', `https://wa.me/${digits}`]);
    return links;
  }

  function renderDetail(m, keepNotes) {
    if (!m) return clearDetail();
    const det = $('#detail');
    const typing = keepNotes && document.activeElement && document.activeElement.id === 'dNotes';
    const notesDraft = typing ? $('#dNotes').value : null;
    det.innerHTML = ''; det.append($('#tplDetail').content.cloneNode(true));
    const loc = [m.cidade, m.regiao, m.pais].filter(Boolean).join(', ');
    $('.d-meta', det).textContent = `RECEBIDA ${fullDate(m.criado)}${loc ? ' · ' + loc.toUpperCase() : ''}`;
    $('.d-name', det).textContent = m.nome;
    $('.d-company', det).textContent = m.empresa || 'Empresa não informada';
    $('.d-contact-val', det).textContent = m.contato;
    const acts = $('.d-actions', det);
    contactLinks(m.contato).forEach(([t, href]) => { const a = document.createElement('a'); a.className = 'btn btn-gold sm'; a.href = href; a.target = '_blank'; a.rel = 'noopener'; a.textContent = t; acts.append(a); });
    const cp = document.createElement('button'); cp.type = 'button'; cp.className = 'btn btn-line sm'; cp.textContent = 'COPIAR';
    cp.addEventListener('click', async () => { try { await navigator.clipboard.writeText(m.contato); cp.textContent = 'COPIADO ✓'; } catch (_) { cp.textContent = 'SELECIONE E COPIE'; } setTimeout(() => cp.textContent = 'COPIAR', 1800); });
    acts.append(cp);
    $('.d-task', det).textContent = m.tarefa;
    const st = $('.d-status', det);
    Object.entries(STATUS).forEach(([k, v]) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = m.status === k ? 'on' : '';
      b.innerHTML = '<i></i>'; b.querySelector('i').style.background = v.color; b.append(v.label);
      b.setAttribute('aria-pressed', m.status === k);
      b.addEventListener('click', () => update(m.id, { status: k }));
      st.append(b);
    });
    const notes = $('#dNotes', det); notes.value = notesDraft !== null ? notesDraft : (m.notas || '');
    if (typing) { notes.focus(); notes.setSelectionRange(notes.value.length, notes.value.length); }
    det.querySelector('[data-a=save]').addEventListener('click', () => update(m.id, { notas: notes.value }, true));
    det.querySelector('[data-a=back]').addEventListener('click', () => { selId = null; render(); clearDetail(); });
    const conf = $('.d-confirm', det);
    det.querySelector('[data-a=del]').addEventListener('click', () => { conf.hidden = false; });
    det.querySelector('[data-a=delNo]').addEventListener('click', () => { conf.hidden = true; });
    det.querySelector('[data-a=delYes]').addEventListener('click', async () => {
      try { await api('DELETE', { id: m.id }); missoes = missoes.filter(x => x.id !== m.id); selId = null; clearDetail(); render(); }
      catch (e) { handleErr(e); }
    });
  }

  async function update(id, patch, isNotes) {
    const saved = $('.d-saved');
    try {
      const d = await api('PATCH', { id, ...patch });
      missoes = missoes.map(x => x.id === id ? d.missao : x);
      if (isNotes) { render(); const s = $('.d-saved'); if (s) { s.textContent = 'SALVO ✓'; setTimeout(() => { if (s) s.textContent = ''; }, 2000); } }
      else { render(); renderDetail(d.missao); }
    } catch (e) { if (saved) saved.textContent = 'ERRO AO SALVAR'; handleErr(e); }
  }

  // ───────── FILTERS / SEARCH / CSV ─────────
  function setFilter(f) { filtro = f; $$('.chip').forEach(c => c.classList.toggle('on', c.dataset.f === f)); render(); }
  $$('.chip').forEach(c => c.addEventListener('click', () => setFilter(c.dataset.f)));
  $$('.kpi').forEach(k => k.addEventListener('click', () => setFilter(k.dataset.f)));
  $('#q').addEventListener('input', e => { busca = e.target.value; render(); });
  $('#csv').addEventListener('click', () => {
    const esc = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const head = ['Recebida', 'Status', 'Nome', 'Empresa', 'Contato', 'Tarefa', 'Notas', 'Cidade', 'País'];
    const lines = [head.map(esc).join(',')].concat(visible().map(m => [fullDate(m.criado), (STATUS[m.status] || {}).label, m.nome, m.empresa, m.contato, m.tarefa, m.notas, m.cidade, m.pais].map(esc).join(',')));
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `missoes-openframe-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });

  // ───────── LISTA DOS 10 ─────────
  let lista10 = [], mode = 'missoes';
  async function loadL10() {
    const r = await fetch(API + '?lista=10', { headers: { Authorization: 'Bearer ' + (senha || '') } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(d.error || r.status); e.status = r.status; e.data = d; throw e; }
    lista10 = d.lista || []; renderL10();
  }
  const fmtWa = n => n.length === 11 && n[0] === '1' ? `+1 (${n.slice(1, 4)}) ${n.slice(4, 7)}-${n.slice(7)}` : '+' + n;
  function renderL10() {
    $('#l10count').textContent = `${lista10.length}/10`;
    $('#l10total').textContent = lista10.length;
    const ol = $('#l10list'); ol.innerHTML = '';
    $('#l10empty').hidden = lista10.length > 0;
    const ordered = lista10.slice().sort((a, b) => a.created_at < b.created_at ? -1 : 1);
    ordered.forEach((w, i) => {
      const li = document.createElement('li'); li.className = 'l10-card';
      li.innerHTML = `<div class="l10-top"><span class="l10-num">Nº ${String(i + 1).padStart(2, '0')}</span><span class="l10-when"></span></div>
        <p class="l10-name"></p><p class="l10-meta"></p><span class="l10-wa"></span><p class="l10-diff" hidden></p>
        <div class="l10-actions"><a class="btn btn-gold sm" target="_blank" rel="noopener">WHATSAPP</a><button type="button" class="btn btn-line sm cp">COPIAR</button><button type="button" class="btn btn-danger sm del">REMOVER</button></div>`;
      li.querySelector('.l10-when').textContent = ago(Date.parse(w.created_at));
      li.querySelector('.l10-name').textContent = w.nome;
      const meta = li.querySelector('.l10-meta'); meta.textContent = `${w.tipo_empresa} · ${w.cidade_estado} `;
      if (w.origem) { const s2 = document.createElement('span'); s2.className = 'l10-src'; s2.textContent = w.origem; meta.append(s2); }
      li.querySelector('.l10-wa').textContent = fmtWa(w.whatsapp);
      if (w.dificuldade) { const d = li.querySelector('.l10-diff'); d.hidden = false; d.textContent = w.dificuldade; }
      const first = (w.nome || '').split(' ')[0];
      li.querySelector('a').href = `https://wa.me/${w.whatsapp}?text=${encodeURIComponent(`Oi ${first}, aqui é o Alexandre Nardi. Vi que você entrou na lista dos 10 empresários fundadores. Podemos conversar?`)}`;
      const cp = li.querySelector('.cp');
      cp.addEventListener('click', async () => { try { await navigator.clipboard.writeText('+' + w.whatsapp); cp.textContent = 'COPIADO ✓'; } catch (_) { cp.textContent = 'SELECIONE E COPIE'; } setTimeout(() => cp.textContent = 'COPIAR', 1800); });
      const del = li.querySelector('.del');
      del.addEventListener('click', async () => {
        if (del.dataset.armed !== '1') { del.dataset.armed = '1'; del.textContent = 'CONFIRMAR REMOÇÃO'; setTimeout(() => { del.dataset.armed = ''; del.textContent = 'REMOVER'; }, 4000); return; }
        try {
          const r = await fetch(API + '?lista=10', { method: 'DELETE', headers: { Authorization: 'Bearer ' + senha, 'Content-Type': 'application/json' }, body: JSON.stringify({ whatsapp: w.whatsapp }) });
          if (r.ok) { lista10 = lista10.filter(x => x.whatsapp !== w.whatsapp); renderL10(); }
        } catch (_) {}
      });
      ol.append(li);
    });
  }
  // ───────── CONTAGEM REGRESSIVA ─────────
  let listaCR = [];
  async function loadCR() {
    const r = await fetch(API + '?lista=cr', { headers: { Authorization: 'Bearer ' + (senha || '') } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(d.error || r.status); e.status = r.status; e.data = d; throw e; }
    listaCR = d.lista || []; renderCR();
  }
  function renderCR() {
    $('#crcount').textContent = listaCR.length; $('#crtotal').textContent = listaCR.length;
    $('#crempty').hidden = listaCR.length > 0;
    const cnt = {}; listaCR.forEach(w => (w.perdas || []).forEach(p => cnt[p] = (cnt[p] || 0) + 1));
    const st = $('#crstats'); st.innerHTML = '';
    Object.entries(cnt).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => { const s = document.createElement('span'); s.textContent = k.toUpperCase(); const b = document.createElement('b'); b.textContent = n; s.append(b); st.append(s); });
    const ol = $('#crlist'); ol.innerHTML = '';
    listaCR.slice().sort((a, b) => a.created_at < b.created_at ? -1 : 1).forEach((w, i) => {
      const li = document.createElement('li'); li.className = 'l10-card';
      li.innerHTML = `<div class="l10-top"><span class="l10-num">Nº ${String(i + 1).padStart(2, '0')}</span><span class="l10-when"></span></div>
        <p class="l10-name"></p><p class="l10-meta"></p><span class="l10-wa"></span>
        <div><p class="cr-q">O que faz</p><p class="cr-a" data-k="faz"></p></div>
        <div><p class="cr-q">3 tarefas que mais tomam tempo</p><p class="cr-a" data-k="tarefas"></p></div>
        <div><p class="cr-q">Horas por semana · Ferramentas</p><p class="cr-a" data-k="hf"></p></div>
        <div class="cr-tags"></div>
        <div class="l10-actions"><a class="btn btn-gold sm wa" target="_blank" rel="noopener">WHATSAPP</a><a class="btn btn-line sm em">E-MAIL</a><button type="button" class="btn btn-danger sm del">REMOVER</button></div>`;
      li.querySelector('.l10-when').textContent = ago(Date.parse(w.created_at));
      li.querySelector('.l10-name').textContent = `${w.empresa}`;
      const meta = li.querySelector('.l10-meta'); meta.textContent = `${w.nome} · ${w.ramo}${w.site ? ' · ' + w.site : ''} `;
      if (w.origem) { const s2 = document.createElement('span'); s2.className = 'l10-src'; s2.textContent = w.origem; meta.append(s2); }
      li.querySelector('.l10-wa').textContent = fmtWa(w.whatsapp) + ' · ' + w.email;
      li.querySelector('[data-k=faz]').textContent = w.faz;
      li.querySelector('[data-k=tarefas]').textContent = w.tarefas;
      li.querySelector('[data-k=hf]').textContent = `${w.horas} h${w.ferramentas ? ' · ' + w.ferramentas : ''}`;
      const tags = li.querySelector('.cr-tags'); (w.perdas || []).forEach(p => { const t = document.createElement('span'); t.textContent = p; tags.append(t); });
      const first = (w.nome || '').split(' ')[0];
      li.querySelector('.wa').href = `https://wa.me/${w.whatsapp}?text=${encodeURIComponent(`Oi ${first}, aqui é o Alexandre Nardi. Recebi sua inscrição na Contagem Regressiva e o Raio-X da ${w.empresa}. Já estou preparando o seu Mapa da Missão!`)}`;
      li.querySelector('.em').href = `mailto:${w.email}?subject=${encodeURIComponent('Contagem Regressiva · ' + w.empresa)}`;
      const del = li.querySelector('.del');
      del.addEventListener('click', async () => {
        if (del.dataset.armed !== '1') { del.dataset.armed = '1'; del.textContent = 'CONFIRMAR REMOÇÃO'; setTimeout(() => { del.dataset.armed = ''; del.textContent = 'REMOVER'; }, 4000); return; }
        const r = await fetch(API + '?lista=cr', { method: 'DELETE', headers: { Authorization: 'Bearer ' + senha, 'Content-Type': 'application/json' }, body: JSON.stringify({ whatsapp: w.whatsapp }) }).catch(() => null);
        if (r && r.ok) { listaCR = listaCR.filter(x => x.whatsapp !== w.whatsapp); renderCR(); }
      });
      ol.append(li);
    });
  }
  $('#crcsv').addEventListener('click', () => {
    const esc = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const head = ['Inscrito em', 'Empresa', 'Nome', 'WhatsApp', 'E-mail', 'Ramo', 'Site/Instagram', 'O que faz', 'Tarefas', 'Horas/semana', 'Ferramentas', 'Onde perde', 'Origem'];
    const rows = listaCR.map(w => [new Date(w.created_at).toLocaleString('pt-BR'), w.empresa, w.nome, '+' + w.whatsapp, w.email, w.ramo, w.site, w.faz, w.tarefas, w.horas, w.ferramentas, (w.perdas || []).join('; '), w.origem].map(esc).join(','));
    const blob = new Blob(['\ufeff' + [head.map(esc).join(',')].concat(rows).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `contagem-regressiva-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });

  // ───────── MAPAS DA MISSÃO ─────────
  let mapas = [], mapasLib = false;
  const mpFetch = (method, body) => fetch(API + '?lista=mapas', { method, headers: { Authorization: 'Bearer ' + (senha || ''), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
    .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) { const e = new Error(d.error || r.status); e.status = r.status; e.data = d; throw e; } return d; });
  async function loadMP() { const d = await mpFetch('GET'); mapas = d.lista || []; mapasLib = !!d.liberados; renderMP(); }
  function renderMP() {
    $('#mpcount').textContent = mapas.length; $('#mptotal').textContent = mapas.length;
    $('#mpempty').hidden = mapas.length > 0;
    const gate = $('#mpgate'), tg = $('#mptoggle');
    gate.classList.toggle('on', mapasLib);
    $('#mpstate').textContent = mapasLib ? 'MAPAS LIBERADOS · AS EMPRESAS JÁ PODEM ABRIR' : 'MAPAS TRAVADOS · SÓ VOCÊ VÊ (PRÉ-VISUALIZAÇÃO)';
    $('#mphelp').textContent = mapasLib ? 'Qualquer pessoa com o link abre o mapa. Para travar de novo, use o botão.' : 'Quem abrir o link vê a contagem regressiva até o evento. Libere na hora da contagem, durante a noite.';
    tg.disabled = false; tg.className = 'btn sm ' + (mapasLib ? 'btn-line' : 'btn-gold');
    tg.textContent = mapasLib ? 'TRAVAR DE NOVO' : 'LIBERAR TODOS OS MAPAS'; tg.dataset.armed = '';
    const ol = $('#mplist'); ol.innerHTML = '';
    mapas.forEach(m => {
      const url = location.origin + '/qdn/' + m.slug;
      const li = document.createElement('li'); li.className = 'l10-card';
      li.innerHTML = `<div class="l10-top"><span class="l10-num"></span><span class="l10-when"></span></div>
        <p class="l10-name"></p><p class="l10-meta"></p><span class="mp-link"></span>
        <div class="l10-actions"><a class="btn btn-gold sm open" target="_blank" rel="noopener">ABRIR</a><button type="button" class="btn btn-line sm copy">COPIAR LINK</button><a class="btn btn-line sm wa" target="_blank" rel="noopener">ENVIAR NO WHATSAPP</a><button type="button" class="btn btn-danger sm del">APAGAR</button></div>`;
      li.querySelector('.l10-num').textContent = (m.tarefas || []).length + ' TAREFAS · ' + (m.red_flags || []).length + ' ALERTAS';
      li.querySelector('.l10-when').textContent = m.atualizado_em ? ago(Date.parse(m.atualizado_em)) : '';
      li.querySelector('.l10-name').textContent = m.empresa;
      li.querySelector('.l10-meta').textContent = [m.contato_nome, m.ramo, m.cidade].filter(Boolean).join(' · ');
      li.querySelector('.mp-link').textContent = url;
      li.querySelector('.open').href = '/qdn/' + m.slug;
      const insc = (typeof listaCR !== 'undefined' ? listaCR : []).find(w => (w.empresa || '').trim().toLowerCase() === (m.empresa || '').trim().toLowerCase());
      const wa = li.querySelector('.wa');
      const first = (m.contato_nome || '').split(' ')[0];
      const texto = `Oi ${first}! Aqui é o Alexandre Nardi. O Mapa da Missão da ${m.empresa} está pronto: ${url}`;
      wa.href = insc ? `https://wa.me/${insc.whatsapp}?text=${encodeURIComponent(texto)}` : `https://wa.me/?text=${encodeURIComponent(texto)}`;
      const cp = li.querySelector('.copy');
      cp.addEventListener('click', async () => { try { await navigator.clipboard.writeText(url); cp.textContent = 'COPIADO'; } catch (_) { cp.textContent = 'NÃO COPIOU'; } setTimeout(() => cp.textContent = 'COPIAR LINK', 1800); });
      const del = li.querySelector('.del');
      del.addEventListener('click', async () => {
        if (del.dataset.armed !== '1') { del.dataset.armed = '1'; del.textContent = 'CONFIRMAR'; setTimeout(() => { del.dataset.armed = ''; del.textContent = 'APAGAR'; }, 4000); return; }
        try { await mpFetch('DELETE', { slug: m.slug }); mapas = mapas.filter(x => x.slug !== m.slug); renderMP(); } catch (e) { handleErr(e); }
      });
      ol.append(li);
    });
  }
  $('#mptoggle').addEventListener('click', async () => {
    const tg = $('#mptoggle');
    if (!mapasLib && tg.dataset.armed !== '1') { tg.dataset.armed = '1'; tg.textContent = 'CONFIRMAR: LIBERAR AGORA'; setTimeout(() => { if (tg.dataset.armed === '1') renderMP(); }, 5000); return; }
    tg.disabled = true;
    try { const d = await mpFetch('PATCH', { liberados: !mapasLib }); mapasLib = d.liberados; } catch (e) { handleErr(e); }
    renderMP();
  });
  $('#mpimport').addEventListener('click', async () => {
    const msg = $('#mpmsg'); msg.textContent = '';
    let data; try { data = JSON.parse($('#mpjson').value); } catch (_) { msg.textContent = 'JSON INVÁLIDO. CONFIRA SE COLOU TUDO.'; return; }
    try {
      const d = await mpFetch('POST', Array.isArray(data) ? { mapas: data } : (data.mapas ? data : { mapas: [data] }));
      msg.textContent = `${d.salvos.length} IMPORTADO(S)` + (d.erros.length ? ` · ${d.erros.length} COM ERRO: ` + d.erros.map(e => (e.empresa || '#' + (e.i + 1)) + ' (' + e.erro + ')').join(', ') : '');
      if (d.salvos.length) $('#mpjson').value = '';
      await loadMP();
    } catch (e) { msg.textContent = 'NÃO FOI POSSÍVEL IMPORTAR (' + e.message + ')'; }
  });

  function setMode(m) {
    mode = m;
    $$('.tab').forEach(t => t.classList.toggle('on', t.dataset.tab === m));
    $('#l10').hidden = m !== 'lista10';
    $('#cr').hidden = m !== 'contagem';
    $('#mp').hidden = m !== 'mapas';
    $('#app').classList.toggle('mode-mp', m === 'mapas');
    $('#app').classList.toggle('mode-l10', m === 'lista10');
    $('#app').classList.toggle('mode-cr', m === 'contagem');
    if (!senha) return; // antes do login: carrega depois, junto com as missões
    if (m === 'mapas') loadMP().catch(handleErr);
    if (m === 'lista10') loadL10().catch(handleErr);
    if (m === 'contagem') loadCR().catch(handleErr);
  }
  $$('.tab').forEach(t => t.addEventListener('click', () => setMode(t.dataset.tab)));
  $('#l10csv').addEventListener('click', () => {
    const esc = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const head = ['Inscrito em', 'Nome', 'WhatsApp', 'Tipo de empresa', 'Cidade e estado', 'Dificuldade', 'Origem'];
    const rows = lista10.map(w => [new Date(w.created_at).toLocaleString('pt-BR'), w.nome, '+' + w.whatsapp, w.tipo_empresa, w.cidade_estado, w.dificuldade, w.origem].map(esc).join(','));
    const blob = new Blob(['\ufeff' + [head.map(esc).join(',')].concat(rows).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `lista-10-primeiros-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  // contador da aba já no login, e atualização junto com as missões
  const _load = load;
  load = async function () { await _load(); loadL10().catch(() => {}); loadCR().catch(() => {}); loadMP().catch(() => {}); };
  if (/[#&]lista10\b/.test(location.hash)) setTimeout(() => setMode('lista10'), 0);
  if (/[#&]contagem\b/.test(location.hash)) setTimeout(() => setMode('contagem'), 0);
  if (/[#&]mapas\b/.test(location.hash)) setTimeout(() => setMode('mapas'), 0);

  boot();
})();
