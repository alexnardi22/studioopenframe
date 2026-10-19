/* OpenFrame · studioopenframe.com */
(() => {
  'use strict';

  // ───────────────────────── CONFIG ─────────────────────────
  // Destino das missões enviadas pelo formulário (FormSubmit → e-mail).
  // Depois da ativação, o FormSubmit envia um código aleatório que pode substituir o e-mail aqui.
  const LEADS_TO = 'alex.nardi@hotmail.com';
  const LEADS_ENDPOINT = `https://formsubmit.co/ajax/${LEADS_TO}`;

  const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const prog = (x, a, b) => clamp((x - a) / (b - a));
  const eio = x => x * x * (3 - 2 * x);
  const eout = x => 1 - Math.pow(1 - x, 3);
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  const T0 = performance.now();

  // ───────────────────────── NAV ─────────────────────────
  const nav = $('#nav');
  const onScroll = () => nav.classList.toggle('solid', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // ───────────────────────── STARFIELD ─────────────────────────
  const sc = $('#stars'), sx = sc.getContext('2d');
  let SW = 0, SH = 0, DPR = Math.min(2, window.devicePixelRatio || 1), warp = 6;
  const stars = Array.from({ length: 260 }, () => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random() }));
  function sizeStars() { const r = sc.getBoundingClientRect(); SW = r.width; SH = r.height; sc.width = SW * DPR; sc.height = SH * DPR; sx.setTransform(DPR, 0, 0, DPR, 0, 0); }
  sizeStars(); window.addEventListener('resize', sizeStars);
  let heroVisible = true;
  new IntersectionObserver(e => { heroVisible = e[0].isIntersecting; }).observe($('.hero'));
  function drawStars(dt) {
    sx.clearRect(0, 0, SW, SH);
    const cx = SW * (SW > 900 ? 0.72 : 0.5), cy = SH * (SW > 900 ? 0.5 : 0.3);
    for (const s of stars) {
      s.z -= dt * 0.00004 * warp;
      if (s.z <= 0.02) { s.z = 1; s.x = Math.random() * 2 - 1; s.y = Math.random() * 2 - 1; }
      const k = 0.5 / s.z, x = cx + s.x * SW * k * 0.5, y = cy + s.y * SH * k * 0.5;
      if (x < 0 || x > SW || y < 0 || y > SH) continue;
      const a = clamp((1 - s.z) * 0.9), r = Math.max(0.4, (1 - s.z) * 1.6);
      sx.globalAlpha = a;
      if (warp > 2) {
        const k2 = 0.5 / (s.z + 0.012 * warp), x2 = cx + s.x * SW * k2 * 0.5, y2 = cy + s.y * SH * k2 * 0.5;
        sx.strokeStyle = '#F2F2F0'; sx.lineWidth = r; sx.beginPath(); sx.moveTo(x2, y2); sx.lineTo(x, y); sx.stroke();
      } else { sx.fillStyle = '#F2F2F0'; sx.beginPath(); sx.arc(x, y, r, 0, 6.283); sx.fill(); }
    }
    sx.globalAlpha = 1;
  }

  // ───────────────────────── DOCKING ─────────────────────────
  const dock = $('#dock'), blue = $('.part.blue'), gold = $('.part.gold'), status = $('#dockStatus'), flash = $('.flash');
  let docked = false, tilt = { x: 0, y: 0, tx: 0, ty: 0 };
  function setDocked() {
    if (docked) return; docked = true;
    document.body.classList.add('docked');
    status.textContent = 'ACOPLADO · SISTEMA ONLINE'; status.classList.add('ok');
    if (!RM) { flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go'); }
  }
  function dockFrame(t) { // t seconds
    if (RM) { blue.style.transform = gold.style.transform = 'none'; setDocked(); return; }
    const kb = eout(prog(t, 0.1, 1.6));
    blue.style.opacity = prog(t, 0.05, 0.6);
    blue.style.transform = `translate3d(0,0,${(-900 * (1 - kb)).toFixed(1)}px) rotateX(${(28 * (1 - kb)).toFixed(2)}deg) rotateY(${(-38 * (1 - kb)).toFixed(2)}deg)`;
    const kg = prog(t, 0.6, 2.7), e = eio(kg), ee = 1 - Math.pow(1 - e, 2);
    gold.style.opacity = prog(t, 0.6, 1.0);
    const off = 1 - ee;
    gold.style.transform = `translate3d(${(130 * off).toFixed(2)}%,${(-125 * off).toFixed(2)}%,${(520 * off).toFixed(1)}px) rotateZ(${(32 * off).toFixed(2)}deg) rotateY(${(70 * off).toFixed(2)}deg)`;
    warp = 6 - 5 * eout(prog(t, 0.2, 2.6));
    if (t < 1.5) status.textContent = `APROXIMAÇÃO · ${Math.max(0, Math.round(340 * (1 - prog(t, 0, 1.5))))} M`;
    else if (t < 2.7) status.textContent = `ALINHAMENTO · ±${(2.4 * (1 - prog(t, 1.5, 2.7))).toFixed(1)}°`;
    else setDocked();
  }
  window.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    tilt.tx = (e.clientY / innerHeight - 0.5) * -14; tilt.ty = (e.clientX / innerWidth - 0.5) * 18;
  }, { passive: true });

  // ───────────────────────── TELEMETRY / TASKS ─────────────────────────
  const tClock = $('#tClock'), tDone = $('#tDone'), tWait = $('#tWait');
  let tasksDone = 0;
  const bumpTasks = n => { tasksDone += n; tDone.textContent = pad(tasksDone, 4); };
  setInterval(() => bumpTasks(Math.random() < 0.7 ? 1 : 2), 1600);

  // ───────────────────────── ENTROPY ─────────────────────────
  const ec = $('#entropyCanvas'), ex = ec.getContext('2d'), eSec = $('#entropia');
  const eOpen = $('#eOpen'), eRun = $('#eRun'), eFree = $('#eFree'), eBar = $('#eBar'), ePhase = $('#ePhase');
  const eLines = $$('.e-line');
  let EW = 0, EH = 0, eVisible = false;
  const logoImg = new Image(); logoImg.src = 'assets/logo.webp';
  function rnd(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
  const R = rnd(7);
  const RINGS = [0.11, 0.17, 0.235, 0.305, 0.38];
  const N = 96;
  const items = Array.from({ length: N }, (_, i) => {
    const ring = i % 5;
    return {
      cx: 0.06 + R() * 0.88, cy: 0.12 + R() * 0.62, w: 0.045 + R() * 0.06, h: 0, ph: R() * 6.28, fl: 2 + R() * 6,
      ring, ang: R() * 6.283, born: R(), order: R(), badge: R() < 0.7, bars: [R(), R(), R(), R()], w0: 0.5 + R() * 0.7
    };
  });
  items.forEach(it => it.h = it.w * (0.55 + R() * 0.15));
  const PILLS = ['NOVA MENSAGEM', 'PENDÊNCIA', 'LEMBRETE', 'APROVAR?', 'ATRASADO', 'RESPONDER', 'COBRAR', 'URGENTE', '+12 NÃO LIDAS', 'CONFERIR'];
  const pills = Array.from({ length: 22 }, (_, i) => ({ x: 0.05 + R() * 0.85, y: 0.1 + R() * 0.7, born: R(), t: PILLS[i % PILLS.length] }));
  function sizeE() { const r = ec.getBoundingClientRect(); EW = r.width; EH = r.height; ec.width = EW * DPR; ec.height = EH * DPR; ex.setTransform(DPR, 0, 0, DPR, 0, 0); }
  sizeE(); window.addEventListener('resize', sizeE);
  new IntersectionObserver(e => { eVisible = e[0].isIntersecting; }, { rootMargin: '100px' }).observe(eSec);
  function eProgress() {
    const r = eSec.getBoundingClientRect(), total = r.height - innerHeight;
    return clamp(-r.top / total);
  }
  function orbitPt(cx, cy, rr, th, S) {
    const TILT = -0.2, SQ = 0.42, x = rr * Math.cos(th), y = rr * SQ * Math.sin(th);
    return [cx + S * (x * Math.cos(TILT) - y * Math.sin(TILT)), cy + S * (x * Math.sin(TILT) + y * Math.cos(TILT))];
  }
  function drawEntropy(time) {
    const p = eProgress();
    ex.clearRect(0, 0, EW, EH);
    const S = Math.min(EW * (EW < 700 ? 1.45 : 1), EH * 1.5) * 1.15, cx = EW * 0.5, cy = EH * (EW < 700 ? 0.46 : 0.44);
    const build = prog(p, 0.0, 0.3), freeze = prog(p, 0.3, 0.36), rew = prog(p, 0.4, 0.86), orb = prog(p, 0.8, 0.92);
    const jit = 5 * build * (1 - freeze) * (1 - prog(p, 0.38, 0.42));
    // orbits
    if (orb > 0) {
      ex.strokeStyle = 'rgba(242,242,240,.16)'; ex.lineWidth = 1;
      RINGS.forEach((rr, k) => {
        ex.globalAlpha = orb * (0.6 + k * 0.08); ex.beginPath();
        for (let j = 0; j <= 120; j++) { const [x, y] = orbitPt(cx, cy, rr, j / 120 * 6.283, S); j ? ex.lineTo(x, y) : ex.moveTo(x, y); }
        ex.stroke();
      });
      ex.globalAlpha = 1;
    }
    const spin = orb * time * 0.00025;
    // tethers to the person while chaos
    const you = [cx, cy];
    for (const it of items) {
      const appear = prog(build, it.born * 0.85, it.born * 0.85 + 0.08);
      if (appear <= 0) continue;
      const k = eio(prog(rew, it.order * 0.55, it.order * 0.55 + 0.45));
      let x0 = it.cx * EW + jit * Math.sin(time * 0.001 * it.fl + it.ph), y0 = it.cy * EH + jit * Math.cos(time * 0.0009 * it.fl + it.ph);
      const th = it.ang + spin * it.w0 * 3;
      const [x1, y1] = orbitPt(cx, cy, RINGS[it.ring], th, S);
      // curved rewind path
      const mx = (x0 + x1) / 2 + (y1 - y0) * 0.25, my = (y0 + y1) / 2 - (x1 - x0) * 0.25;
      const x = (1 - k) ** 2 * x0 + 2 * (1 - k) * k * mx + k * k * x1, y = (1 - k) ** 2 * y0 + 2 * (1 - k) * k * my + k * k * y1;
      if (k < 0.02 && build > 0.35 && freeze < 1) {
        ex.strokeStyle = 'rgba(242,242,240,.07)'; ex.beginPath(); ex.moveTo(you[0], you[1]); ex.lineTo(x, y); ex.stroke();
      }
      const w = it.w * EW * 0.9 * (1 - k) * appear, h = it.h * EW * 0.9 * (1 - k) * appear;
      if (w > 3) {
        ex.globalAlpha = appear * (1 - k);
        ex.fillStyle = '#12151C'; ex.fillRect(x - w / 2, y - h / 2, w, h);
        ex.strokeStyle = 'rgba(242,242,240,.32)'; ex.strokeRect(x - w / 2 + .5, y - h / 2 + .5, w, h);
        const bw = (w - 12) / 4;
        ex.fillStyle = freeze > 0.5 ? 'rgba(160,165,175,.45)' : 'rgba(125,180,238,.55)';
        it.bars.forEach((b, j) => { const bh = (h - 14) * (0.25 + 0.7 * b * (0.7 + 0.3 * Math.sin(time * 0.003 * (1 - freeze) + j))); ex.fillRect(x - w / 2 + 6 + j * bw, y + h / 2 - 6 - bh, bw * 0.6, bh); });
        if (it.badge && build > 0.4) {
          ex.fillStyle = '#FFB020'; ex.beginPath(); ex.arc(x + w / 2, y - h / 2, 7 * (1 - k), 0, 6.283); ex.fill();
        }
      }
      if (k > 0) {
        // trail
        const kt = Math.max(0, k - 0.12);
        const tx = (1 - kt) ** 2 * x0 + 2 * (1 - kt) * kt * mx + kt * kt * x1, ty = (1 - kt) ** 2 * y0 + 2 * (1 - kt) * kt * my + kt * kt * y1;
        if (k < 1) { const g = ex.createLinearGradient(tx, ty, x, y); g.addColorStop(0, 'rgba(91,228,155,0)'); g.addColorStop(1, 'rgba(91,228,155,.8)'); ex.strokeStyle = g; ex.lineWidth = 2; ex.globalAlpha = 1; ex.beginPath(); ex.moveTo(tx, ty); ex.quadraticCurveTo((tx + x) / 2, (ty + y) / 2, x, y); ex.stroke(); ex.lineWidth = 1; }
        ex.globalAlpha = k; ex.fillStyle = '#5BE49B';
        ex.shadowColor = '#5BE49B'; ex.shadowBlur = 12; ex.beginPath(); ex.arc(x, y, 2 + 2.2 * k, 0, 6.283); ex.fill(); ex.shadowBlur = 0;
      }
      ex.globalAlpha = 1;
    }
    // notification pills
    ex.font = '500 11px D-DIN, Arial, sans-serif'; ex.textBaseline = 'middle';
    for (const pl of pills) {
      const a = prog(build, 0.3 + pl.born * 0.6, 0.36 + pl.born * 0.6) * (1 - prog(rew, 0, 0.25));
      if (a <= 0) continue;
      const x = pl.x * EW, y = pl.y * EH, tw = ex.measureText(pl.t).width + 30;
      ex.globalAlpha = a; ex.fillStyle = 'rgba(24,21,15,.94)'; ex.strokeStyle = 'rgba(255,176,32,.6)';
      ex.beginPath(); ex.roundRect ? ex.roundRect(x, y, tw, 26, 13) : ex.rect(x, y, tw, 26); ex.fill(); ex.stroke();
      ex.fillStyle = '#FFB020'; ex.beginPath(); ex.arc(x + 12, y + 13, 3, 0, 6.283); ex.fill();
      ex.fillStyle = '#F2F2F0'; ex.fillText(pl.t, x + 21, y + 14);
    }
    ex.globalAlpha = 1;
    // the person / logo at the center
    const la = prog(p, 0.74, 0.86);
    if (la < 1) { ex.fillStyle = '#F2F2F0'; ex.globalAlpha = 1 - la; ex.beginPath(); ex.arc(cx, cy, 6, 0, 6.283); ex.fill(); ex.globalAlpha = 1; }
    if (la > 0 && logoImg.complete) {
      const lw = S * 0.075 * (0.7 + 0.3 * eout(la));
      ex.globalAlpha = la; ex.shadowColor = 'rgba(125,180,238,.5)'; ex.shadowBlur = 40;
      ex.drawImage(logoImg, cx - lw / 2, cy - lw * 0.51, lw, lw * 1.02); ex.shadowBlur = 0; ex.globalAlpha = 1;
    }
    // rewind glitch
    const gl = prog(p, 0.34, 0.38) * (1 - prog(p, 0.42, 0.46));
    if (gl > 0) {
      for (let i = 0; i < 7; i++) {
        const y = ((time * 0.4 + i * 137) % EH), h = 6 + (i * 13) % 24;
        try { ex.drawImage(ec, 0, y * DPR, EW * DPR, h * DPR, (Math.sin(time * 0.02 + i) * 28) * gl, y, EW, h); } catch (_) {}
      }
      ex.fillStyle = `rgba(242,242,240,${0.85 * gl})`; ex.font = '700 22px D-DIN, Arial, sans-serif'; ex.textAlign = 'center';
      ex.fillText('◀◀  REVERTENDO', cx, EH * 0.16); ex.textAlign = 'left';
    }
    // HUD
    const open = Math.round(847 * build * (1 - rew));
    eOpen.textContent = pad(open, 4);
    eRun.textContent = pad(Math.round(N * eio(rew) + orb * (time * 0.002 % 1000)), 4);
    eFree.textContent = Math.round(100 - 97 * build + 97 * eio(rew)) + '%';
    eBar.style.width = (p * 100).toFixed(1) + '%';
    ePhase.textContent = p < 0.34 ? 'FASE 01 · RUÍDO' : p < 0.8 ? 'FASE 02 · REVERSÃO' : 'FASE 03 · ÓRBITA';
    eLines.forEach(l => l.classList.toggle('on', p >= +l.dataset.from && p < +l.dataset.to));
  }

  // ───────────────────────── IMPOSSIBLE → EM EXECUÇÃO ─────────────────────────
  const flipIO = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const tag = e.target; flipIO.unobserve(tag);
    setTimeout(() => { tag.textContent = 'EM EXECUÇÃO'; tag.classList.add('done'); }, RM ? 0 : 700);
  }), { threshold: 1, rootMargin: '0px 0px -12% 0px' });
  $$('[data-flip]').forEach(t => flipIO.observe(t));

  // ───────────────────────── CONTROL ROOM ─────────────────────────
  const EVENTS = [
    ['Proposta enviada ao cliente após aprovação do orçamento', 'done'],
    ['Lembrete de pagamento enviado para fatura em aberto', 'done'],
    ['Agenda da equipe de campo confirmada para amanhã', 'done'],
    ['Contrato assinado registrado e arquivado', 'done'],
    ['Acompanhando entrega do pedido 2291, previsão 16h', 'prog'],
    ['Avaliação pós-serviço solicitada a três clientes', 'done'],
    ['Conciliação bancária de ontem concluída', 'done'],
    ['Follow-up enviado a lead sem resposta há 48h', 'done'],
    ['Relatório semanal em preparação para sexta', 'prog'],
    ['Estoque abaixo do mínimo, pedido de reposição gerado', 'done']
  ];
  const FLAGS = [
    { title: 'Pedido 2291 pode atrasar', what: 'O fornecedor não confirmou a coleta.', ev: 'Duas tentativas de contato sem resposta. Rastreio parado desde ontem.', cons: 'Entrega ao cliente fora do prazo combinado para sexta.', did: 'Segundo fornecedor cotado. Frete adicional a confirmar.', ask: 'Autorizar a troca de fornecedor?', yes: 'AUTORIZAR', okYes: 'Troca de fornecedor autorizada. O cliente será avisado do novo prazo.' },
    { title: 'Cliente insatisfeito pela 2ª vez', what: 'Avaliação baixa após o segundo atendimento seguido.', ev: 'Nota 2 de 5. Comentário cita atraso na visita técnica.', cons: 'Risco de cancelamento do contrato recorrente.', did: 'Histórico reunido. Horário de retorno reservado na agenda.', ask: 'Oferecer visita de cortesia esta semana?', yes: 'OFERECER', okYes: 'Visita de cortesia oferecida. O cliente recebeu as opções de horário.' }
  ];
  const log = $('#log'), flagBody = $('#flagBody'), flagPanel = $('#flagPanel'), logClock = $('#logClock');
  const counts = { done: 0, prog: 0, wait: 0 };
  let evI = 0, flagI = 0, flagOpen = false, sinceFlag = 0, clockMin = 8 * 60;
  const COL = { done: 'var(--mint)', prog: 'var(--blue)' }, LBL = { done: 'CONCLUÍDO', prog: 'EM ANDAMENTO' };
  function setCounts() { $$('[data-s]').forEach(b => b.textContent = counts[b.dataset.s]); tWait.innerHTML = `SITUAÇÕES AGUARDANDO VOCÊ <b>${counts.wait}</b>`; tWait.classList.toggle('warn', counts.wait > 0); }
  function addEvent() {
    const [txt, s] = EVENTS[evI % EVENTS.length]; evI++;
    clockMin += 12 + Math.floor(Math.random() * 30);
    const li = document.createElement('li');
    li.innerHTML = `<time>${pad(Math.floor(clockMin / 60) % 24)}:${pad(clockMin % 60)}</time><i class="sq" style="background:${COL[s]}"></i><span class="txt"></span><span class="st mono" style="color:${COL[s]}">${LBL[s]}</span>`;
    li.querySelector('.txt').textContent = txt;
    log.prepend(li); while (log.children.length > 6) log.lastChild.remove();
    counts[s]++; logClock.textContent = `${pad(Math.floor(clockMin / 60) % 24)}:${pad(clockMin % 60)}`;
    setCounts();
    sinceFlag++;
    if (!flagOpen && sinceFlag >= 6) openFlag();
  }
  function openFlag() {
    const f = FLAGS[flagI % FLAGS.length]; flagOpen = true; counts.wait = 1; setCounts();
    flagPanel.classList.add('alert');
    flagBody.innerHTML = `<p class="flag-title"><i></i><span></span></p>
      <dl class="flag-dl"><div><dt>O que aconteceu</dt><dd data-k="what"></dd></div><div><dt>Evidências</dt><dd data-k="ev"></dd></div>
      <div><dt>Possível consequência</dt><dd data-k="cons"></dd></div><div><dt>Já feito</dt><dd data-k="did"></dd></div>
      <div class="ask"><dt>Decisão necessária</dt><dd data-k="ask"></dd></div></dl>
      <div class="flag-actions"><button type="button" class="btn btn-gold" data-a="yes"></button><button type="button" class="btn btn-line" data-a="fwd">ENCAMINHAR</button></div>`;
    flagBody.querySelector('.flag-title span').textContent = f.title;
    $$('[data-k]', flagBody).forEach(d => d.textContent = f[d.dataset.k]);
    flagBody.querySelector('[data-a=yes]').textContent = f.yes;
    flagBody.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', () => resolveFlag(b.dataset.a === 'yes' ? f.okYes : 'Encaminhado ao responsável, com todo o contexto.')));
  }
  function resolveFlag(msg) {
    flagOpen = false; sinceFlag = -8; flagI++; counts.wait = 0; counts.done++; setCounts();
    flagPanel.classList.remove('alert');
    flagBody.innerHTML = `<div class="resolved"><p class="mono ok">DECISÃO REGISTRADA</p><p class="calm"></p><p class="calm-sub mono">A OPERAÇÃO SEGUIU. VOCÊ LEVOU ALGUNS SEGUNDOS.</p></div>`;
    flagBody.querySelector('.calm').textContent = msg;
    setTimeout(() => { if (!flagOpen) flagBody.innerHTML = `<p class="calm">Nenhuma situação aguardando você.</p><p class="calm-sub mono"><i class="dot live"></i>ACOMPANHAMENTO ATIVO · VERIFICADO AGORA</p>`; }, 7000);
  }
  let controlStarted = false;
  new IntersectionObserver(e => {
    if (e[0].isIntersecting && !controlStarted) { controlStarted = true; addEvent(); setInterval(addEvent, 2200); }
  }, { threshold: 0.2 }).observe($('#controle'));

  // ───────────────────────── MISSIONS T+ ─────────────────────────
  const tps = $$('.t-plus');
  function tickMissions() {
    const now = Date.now();
    tps.forEach(el => {
      const s = Math.max(0, Math.floor((now - Date.parse(el.dataset.start)) / 1000));
      el.textContent = `T+${Math.floor(s / 86400)}D ${pad(Math.floor(s % 86400 / 3600))}:${pad(Math.floor(s % 3600 / 60))}:${pad(s % 60)} · EM EXECUÇÃO`;
    });
  }
  tickMissions(); setInterval(tickMissions, 1000);

  // ───────────────────────── VIDEO ─────────────────────────
  const video = $('#manifestoVideo'), cover = $('#videoCover');
  cover.addEventListener('click', () => { video.closest('.video').classList.add('playing'); video.muted = false; video.play().catch(() => {}); video.focus(); });

  // ───────────────────────── FORM ─────────────────────────
  const form = $('#launchForm'), msg = $('#formMsg');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const nome = $('#fName').value.trim(), empresa = $('#fCompany').value.trim(), contato = $('#fContact').value.trim(), tarefa = $('#fTask').value.trim();
    const missing = !nome ? '#fName' : !contato ? '#fContact' : !tarefa ? '#fTask' : null;
    if (missing) { msg.textContent = 'PREENCHA NOME, CONTATO E A TAREFA, POR FAVOR.'; $(missing).focus(); return; }
    if ($('#fHp').value) { msg.textContent = 'MISSÃO RECEBIDA.'; form.reset(); return; }
    const btn = $('#launchBtn'); btn.disabled = true; btn.textContent = 'TRANSMITINDO…'; msg.textContent = '';
    const quando = new Date().toLocaleString('pt-BR', { timeZone: 'America/New_York' });
    // 1) salva no banco do site (Painel de Missões)  2) aviso por e-mail (FormSubmit), em paralelo
    const salvar = fetch('/api/missao', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, empresa, contato, tarefa, origem: location.href, _honey: $('#fHp').value })
    }).then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok || !d.ok) throw new Error(d.error || r.status); return d; });
    const avisar = fetch(LEADS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        _subject: `Nova missão · ${empresa || nome}`,
        _template: 'table', _captcha: 'false',
        _replyto: contato.includes('@') ? contato : undefined,
        'Nome': nome, 'Empresa': empresa || '-', 'Contato para resposta': contato,
        'Tarefa que mais consome o tempo': tarefa, 'Enviado em (Orlando)': quando,
        'Painel': 'https://www.studioopenframe.com/painel'
      })
    }).then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok || d.success === false || d.success === 'false') throw new Error(d.message || r.status); return d; });
    const [s1, s2] = await Promise.allSettled([salvar, avisar]);
    if (s1.status === 'fulfilled' || s2.status === 'fulfilled') {
      msg.textContent = 'MISSÃO RECEBIDA. VAMOS RESPONDER PELO CONTATO QUE VOCÊ INFORMOU.';
      form.reset(); btn.textContent = 'MISSÃO ENVIADA ✓';
      setTimeout(() => { btn.disabled = false; btn.textContent = 'INICIAR MISSÃO'; }, 6000);
    } else {
      btn.disabled = false; btn.textContent = 'INICIAR MISSÃO';
      msg.textContent = `NÃO CONSEGUIMOS ENVIAR AGORA. TENTE DE NOVO OU ESCREVA PARA ${LEADS_TO.toUpperCase()}.`;
    }
  });

  // ───────────────────────── AUTOPILOT (idle) ─────────────────────────
  const ap = $('#autopilot'), apLog = $('#apLog'), toast = $('#returnToast'), rtText = $('#rtText');
  const AP_TASKS = ['LEMBRETE DE PAGAMENTO ENVIADO', 'AGENDA DE AMANHÃ CONFIRMADA', 'PROPOSTA ENVIADA AO CLIENTE', 'NOTA FISCAL EMITIDA', 'FOLLOW-UP ENVIADO A LEAD', 'CONTRATO ARQUIVADO', 'AVALIAÇÃO SOLICITADA', 'ESTOQUE CONFERIDO', 'PAGAMENTO CONCILIADO', 'RELATÓRIO ATUALIZADO', 'VISITA TÉCNICA REAGENDADA', 'BOAS-VINDAS ENVIADAS A NOVO CLIENTE'];
  const IDLE_MS = 12000;
  let toastAt = 0, toastTimer = 0;
  let lastAct = performance.now(), apOn = false, apStart = 0, apCount = 0, apTimer = 0, toastsShown = 0;
  function apTick() {
    apCount++; bumpTasks(1);
    const li = document.createElement('li'); const d = new Date();
    li.innerHTML = `<b>${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}</b>`;
    li.append(document.createTextNode(AP_TASKS[Math.floor(Math.random() * AP_TASKS.length)]));
    apLog.prepend(li); while (apLog.children.length > 6) apLog.lastChild.remove();
    apTimer = setTimeout(apTick, 650 + Math.random() * 700);
  }
  function startAP() {
    if (apOn || document.hidden || !toast.hidden) return;
    if (!video.paused) return;
    if (document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    apOn = true; apStart = performance.now(); apCount = 0; apLog.innerHTML = '';
    ap.classList.add('on'); document.body.classList.add('ap'); apTick();
  }
  function stopAP() {
    if (!apOn) return;
    apOn = false; clearTimeout(apTimer); ap.classList.remove('on'); document.body.classList.remove('ap');
    const secs = Math.round((performance.now() - apStart) / 1000);
    if (apCount >= 3 && toastsShown < 2) {
      toastsShown++;
      rtText.textContent = `Você ficou parado por ${secs} segundos. Nesse tempo, o sistema executou ${apCount} tarefas sem pedir nada a você. É isso que fazemos pela sua empresa.`;
      toast.hidden = false; toastAt = performance.now();
      clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.hidden = true; }, 11000);
    }
  }
  const activity = e => { lastAct = performance.now(); if (!toast.hidden && e && e.type === 'scroll' && performance.now() - toastAt > 1500) toast.hidden = true; stopAP(); };
  ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'].forEach(ev => window.addEventListener(ev, activity, { passive: true }));
  const closeToast = () => { toast.hidden = true; lastAct = performance.now(); };
  $('#rtClose').addEventListener('click', closeToast);
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && !toast.hidden) closeToast(); });
  if (!RM) setInterval(() => { if (!apOn && docked && performance.now() - lastAct > IDLE_MS) startAP(); }, 500);

  // ───────────────────────── MAIN LOOP ─────────────────────────
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(64, now - last); last = now;
    const t = (now - T0) / 1000;
    if (!docked || !RM) dockFrame(t);
    if (heroVisible) {
      drawStars(RM ? 0 : dt);
      if (docked && !RM) {
        tilt.x += (tilt.tx - tilt.x) * 0.06; tilt.y += (tilt.ty - tilt.y) * 0.06;
        const fl = Math.sin(now * 0.0012) * 6;
        dock.style.transform = `translateY(${fl.toFixed(2)}px) rotateX(${tilt.x.toFixed(2)}deg) rotateY(${tilt.y.toFixed(2)}deg)`;
      }
      const s = Math.floor(t);
      tClock.textContent = `T+ ${pad(Math.floor(s / 3600))}:${pad(Math.floor(s % 3600 / 60))}:${pad(s % 60)}`;
    }
    if (eVisible) drawEntropy(now);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
