(() => {
  'use strict';
  const EVENTO = '2026-12-02T19:00:00-05:00';
  const $ = id => document.getElementById(id);
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pad = n => String(n).padStart(2, '0');
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  // estrelas de fundo
  const c = $('stars'), x = c.getContext('2d'); let W, H; const DPR = Math.min(2, devicePixelRatio || 1);
  const st = Array.from({ length: 160 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.2 + .3, p: Math.random() * 6.28 }));
  const size = () => { W = innerWidth; H = innerHeight; c.width = W * DPR; c.height = H * DPR; x.setTransform(DPR, 0, 0, DPR, 0, 0); };
  size(); addEventListener('resize', size);
  const draw = t => { x.clearRect(0, 0, W, H); st.forEach(s => { x.globalAlpha = .16 + .2 * (RM ? .5 : (.5 + .5 * Math.sin(t / 1400 + s.p))); x.fillStyle = '#F2F2F0'; x.beginPath(); x.arc(s.x * W, s.y * H, s.r, 0, 6.283); x.fill(); }); if (!RM) requestAnimationFrame(draw); };
  requestAnimationFrame(draw);

  const show = id => ['sLoading', 'sLocked', 'sMissing', 'sMap'].forEach(s => { $(s).hidden = s !== id; });
  const flag = (text, blue) => { const f = $('flag'); f.textContent = text; f.classList.toggle('blue', !!blue); f.hidden = false; };

  // ───── qual mapa ─────
  const slug = (() => {
    const q = new URLSearchParams(location.search).get('id');
    if (q) return q.toLowerCase();
    const m = location.pathname.match(/\/qdn\/([a-z0-9-]+)/i);
    return m ? m[1].toLowerCase() : '';
  })();
  const senha = (() => {
    try { const v = sessionStorage.getItem('of_painel') || localStorage.getItem('of_painel'); if (v) return v; } catch (_) {}
    // aberto pelo Painel em outra aba: lê a sessão da aba do Painel
    try { if (window.opener && window.opener.location.origin === location.origin) return window.opener.sessionStorage.getItem('of_painel') || ''; } catch (_) {}
    return '';
  })();

  async function carregar() {
    if (!slug) return show('sMissing');
    try {
      if (slug === 'exemplo') {
        const r = await fetch('/qdn/exemplo.json', { cache: 'no-cache' });
        if (!r.ok) return show('sMissing');
        return render(await r.json());
      }
      const r = await fetch('/api/mapa?id=' + encodeURIComponent(slug), { headers: senha ? { Authorization: 'Bearer ' + senha } : {} });
      const d = await r.json().catch(() => ({}));
      if (r.status === 403) return travado();
      if (!r.ok || !d.mapa) return show('sMissing');
      if (d.preview) flag('PRÉ-VISUALIZAÇÃO · SÓ VOCÊ ESTÁ VENDO. A EMPRESA SÓ ACESSA DEPOIS DE LIBERAR NO PAINEL.', true);
      render(d.mapa);
    } catch (_) { show('sMissing'); }
  }

  function travado() {
    show('sLocked');
    const alvo = Date.parse(EVENTO);
    const tick = () => {
      const s = Math.max(0, Math.floor((alvo - Date.now()) / 1000));
      $('cd-d').textContent = pad(Math.floor(s / 86400)); $('cd-h').textContent = pad(Math.floor(s % 86400 / 3600));
      $('cd-m').textContent = pad(Math.floor(s % 3600 / 60)); $('cd-s').textContent = pad(s % 60);
    };
    tick(); setInterval(tick, 1000);
  }

  // ───── mapa ─────
  const AUT = { sozinho: 'EXECUTA SOZINHO', autoriza: 'PEDE AUTORIZAÇÃO', voce: 'LEVA PARA VOCÊ' };
  const TIPO = { concluido: 'CONCLUÍDO', andamento: 'EM ANDAMENTO', decisao: 'AGUARDANDO DECISÃO', bloqueado: 'BLOQUEADO', nao_verificado: 'NÃO VERIFICADO' };
  let mapa = null;

  function render(m) {
    mapa = m;
    if (m.exemplo) flag('EXEMPLO ILUSTRATIVO · EMPRESA FICTÍCIA · CADA EMPRESÁRIO INSCRITO RECEBE O MAPA DA PRÓPRIA EMPRESA');
    document.title = `Mapa da Missão · ${m.empresa} | OpenFrame`;
    $('mEmpresa').textContent = m.empresa;
    if (m.logo && /^data:image\//.test(m.logo)) { $('mLogo').src = m.logo; $('mLogo').alt = 'Logo ' + m.empresa; $('mLogoBox').hidden = false; }
    $('mMeta').textContent = [m.contato_nome && 'PREPARADO PARA ' + m.contato_nome, m.ramo, m.cidade].filter(Boolean).join(' · ').toUpperCase();
    $('mResumo').textContent = m.resumo || '';
    $('mResumo').hidden = !m.resumo;

    const ol = $('mTarefas'); ol.innerHTML = '';
    (m.tarefas || []).forEach((t, i) => {
      const li = el('li', 'task');
      const h = el('h3', null, `${pad(i + 1)} · ${t.titulo}`);
      const b = el('span', 'badge'); const dot = el('i', 'a-' + t.autonomia); b.append(dot, document.createTextNode(AUT[t.autonomia] || AUT.autoriza));
      const rows = el('div', 'rows');
      if (t.hoje) { const d = el('div'); d.append(el('span', null, 'Hoje'), el('p', null, t.hoje)); rows.append(d); }
      if (t.como) { const d = el('div', 'new'); d.append(el('span', null, 'Com a OpenFrame'), el('p', null, t.como)); rows.append(d); }
      li.append(h, b); if (rows.children.length) li.append(rows);
      ol.append(li);
    });

    const dia = m.dia || [];
    $('bDia').hidden = !dia.length;
    $('ccEmpresa').textContent = m.empresa.toUpperCase();
    const log = $('mDia'); log.innerHTML = '';
    dia.forEach(d => {
      const li = el('li'); li.append(el('span', 'h', d.hora), el('span', 't', d.texto), el('span', 's s-' + d.tipo, TIPO[d.tipo] || TIPO.concluido));
      log.append(li);
    });
    if (dia.length) {
      const play = () => [...log.children].forEach((li, i) => setTimeout(() => li.classList.add('in'), RM ? 0 : i * 650));
      if ('IntersectionObserver' in window && !RM) {
        const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); play(); } }, { threshold: .3 });
        io.observe($('cc'));
      } else play();
    }

    const flags = m.red_flags || [];
    $('bFlags').hidden = !flags.length;
    const fl = $('mFlags'); fl.innerHTML = '';
    flags.forEach(f => {
      const li = el('li'); const k = el('span', 'fk'); const dot = el('i', 'a-voce'); dot.style.cssText = 'width:8px;height:8px;border-radius:50%;display:inline-block';
      k.append(dot, document.createTextNode('PRECISA DE UMA PESSOA'));
      li.append(k, el('h3', null, f.titulo));
      if (f.exemplo) li.append(el('p', null, f.exemplo));
      if (f.para) li.append(el('span', 'para', 'VAI PRIMEIRO PARA: ' + f.para.toUpperCase()));
      fl.append(li);
    });

    const e = m.estimativa_horas || {};
    const temEst = e.min != null && e.max != null;
    $('mHoje').textContent = m.horas_semana_atual ? m.horas_semana_atual + ' h' : '—';
    $('mEst').textContent = temEst ? (e.min === e.max ? `${e.min} h` : `${e.min}–${e.max} h`) : '—';
    $('tEst').hidden = !temEst;
    $('bTempo').hidden = !m.horas_semana_atual && !temEst;
    const ind = m.indicadores || []; $('bInd').hidden = !ind.length;
    const ul = $('mInd'); ul.innerHTML = ''; ind.forEach(i => ul.append(el('li', null, i)));

    $('mPasso').textContent = m.primeiro_passo || '';
    $('bPasso').hidden = !m.primeiro_passo;

    show('sMap');
    emblema(m.empresa, m.logo).catch(() => {});
  }

  // ───── emblema Missão 001 ─────
  const logo = new Image(); logo.src = '/assets/logo.png';
  const logoPronto = new Promise(r => { logo.onload = r; logo.onerror = r; });

  function arcText(g, text, cx, cy, r, center, bottom) {
    // escreve ao longo do círculo, sempre legível da esquerda para a direita
    const chars = [...text]; const ws = chars.map(ch => g.measureText(ch).width);
    const total = ws.reduce((a, b) => a + b, 0); let a = center + (bottom ? 1 : -1) * total / 2 / r;
    chars.forEach((ch, i) => {
      const da = ws[i] / r; const mid = a + (bottom ? -1 : 1) * da / 2;
      g.save(); g.translate(cx + r * Math.cos(mid), cy + r * Math.sin(mid));
      g.rotate(mid + (bottom ? -Math.PI / 2 : Math.PI / 2)); g.fillText(ch, 0, 0); g.restore();
      a += (bottom ? -1 : 1) * da;
    });
  }
  function fitArc(g, text, maxW, size, weight) {
    let s = size; g.font = `${weight} ${s}px D-DIN`;
    while (s > 26 && g.measureText(text).width > maxW) { s -= 2; g.font = `${weight} ${s}px D-DIN`; }
    return s;
  }

  const carregaImg = src => new Promise(r => { if (!src || !/^data:image\//.test(src)) return r(null); const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });
  async function emblema(nome, logoEmpresa) {
    const marca = await carregaImg(logoEmpresa);
    try { await Promise.all([document.fonts.load('700 60px D-DIN'), document.fonts.load('500 40px D-DIN')]); } catch (_) {}
    await logoPronto;
    const cv = $('emb'), g = cv.getContext('2d'); const S = 1080, C = S / 2;
    g.clearRect(0, 0, S, S);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    // disco
    const bg = g.createRadialGradient(C, C * .82, 40, C, C, 500);
    bg.addColorStop(0, '#11192A'); bg.addColorStop(.6, '#080B12'); bg.addColorStop(1, '#050608');
    g.fillStyle = bg; g.beginPath(); g.arc(C, C, 500, 0, 7); g.fill();
    // estrelas fixas (sementes determinísticas)
    let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < 90; i++) { const a = rnd() * 6.283, d = 60 + rnd() * 300; g.globalAlpha = .25 + rnd() * .55; g.fillStyle = '#F2F2F0'; g.beginPath(); g.arc(C + Math.cos(a) * d, C + Math.sin(a) * d, .8 + rnd() * 1.8, 0, 7); g.fill(); }
    g.globalAlpha = 1;
    // anéis
    g.lineWidth = 14; g.strokeStyle = '#E3B171'; g.beginPath(); g.arc(C, C, 493, 0, 7); g.stroke();
    g.lineWidth = 2; g.strokeStyle = 'rgba(125,180,238,.85)'; g.beginPath(); g.arc(C, C, 468, 0, 7); g.stroke();
    g.lineWidth = 2; g.strokeStyle = 'rgba(227,177,113,.55)'; g.beginPath(); g.arc(C, C, 372, 0, 7); g.stroke();
    // órbita
    g.save(); g.translate(C, C + 10); g.rotate(-.32);
    g.lineWidth = 2.5; g.strokeStyle = 'rgba(125,180,238,.7)'; g.beginPath(); g.ellipse(0, 0, 300, 96, 0, 0, 7); g.stroke();
    g.fillStyle = '#E3B171'; g.shadowColor = '#E3B171'; g.shadowBlur = 24; g.beginPath(); g.arc(300 * Math.cos(-.5), 96 * Math.sin(-.5), 11, 0, 7); g.fill();
    g.restore(); g.shadowBlur = 0;
    // logo: o da empresa no centro (com o da OpenFrame acima), ou só o da OpenFrame
    if (marca) {
      const r = 128, cy = C - 30;
      g.save(); g.shadowColor = 'rgba(60,120,220,.55)'; g.shadowBlur = 50; g.fillStyle = '#fff'; g.beginPath(); g.arc(C, cy, r, 0, 7); g.fill(); g.restore();
      g.save(); g.beginPath(); g.arc(C, cy, r - 6, 0, 7); g.clip();
      const k = Math.min((r - 6) * 2 / marca.naturalWidth, (r - 6) * 2 / marca.naturalHeight) * 0.98;
      const iw = marca.naturalWidth * k, ih = marca.naturalHeight * k; g.drawImage(marca, C - iw / 2, cy - ih / 2, iw, ih); g.restore();
      g.lineWidth = 6; g.strokeStyle = '#E3B171'; g.beginPath(); g.arc(C, cy, r, 0, 7); g.stroke();
      if (logo.naturalWidth) { const lw = 70, lh = lw * logo.naturalHeight / logo.naturalWidth; g.drawImage(logo, C - lw / 2, cy - r - 30 - lh, lw, lh); }
    } else if (logo.naturalWidth) { const lw = 250, lh = lw * logo.naturalHeight / logo.naturalWidth; g.shadowColor = 'rgba(60,120,220,.55)'; g.shadowBlur = 50; g.drawImage(logo, C - lw / 2, C - lh / 2 - 34, lw, lh); g.shadowBlur = 0; }
    // textos centrais
    g.fillStyle = '#F2F2F0'; g.font = '700 64px D-DIN'; g.fillText('MISSÃO 001', C, C + 175);
    g.fillStyle = '#E3B171'; g.font = '500 26px D-DIN';
    if (g.letterSpacing !== undefined) g.letterSpacing = '6px';
    g.fillText('02 · 12 · 2026', C, C + 228);
    if (g.letterSpacing !== undefined) g.letterSpacing = '0px';
    // texto em arco: empresa no topo, evento embaixo
    const R = 420; const top = String(nome || '').toUpperCase();
    const sTop = fitArc(g, top, Math.PI * R * .78, 62, 700);
    g.fillStyle = '#F2F2F0'; g.font = `700 ${sTop}px D-DIN`;
    const spaced = s => [...s].join(' ');
    arcText(g, spaced(top), C, C, R, -Math.PI / 2, false);
    g.fillStyle = '#E3B171'; g.font = '700 40px D-DIN';
    arcText(g, spaced('CONTAGEM REGRESSIVA · QDN BUSINESS'), C, C, R, Math.PI / 2, true);
    // estrelas laterais
    [[-1, 0], [1, 0]].forEach(([sx]) => { const px = C + sx * R, py = C; g.fillStyle = '#E3B171'; g.beginPath(); for (let k = 0; k < 10; k++) { const rr = k % 2 ? 7 : 17, an = -Math.PI / 2 + k * Math.PI / 5; g.lineTo(px + rr * Math.cos(an), py + rr * Math.sin(an)); } g.closePath(); g.fill(); });
  }

  $('embDown').addEventListener('click', () => {
    const cv = $('emb'); const nome = (mapa && mapa.empresa || 'empresa').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    cv.toBlob(b => {
      if (!b) return;
      const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `missao-001-${nome}.png`;
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    }, 'image/png');
  });

  carregar();
})();
