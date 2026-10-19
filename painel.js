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

  boot();
})();
