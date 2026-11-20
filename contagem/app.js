(() => {
  'use strict';
  // ───── CONFIG: data e hora do evento (horário de Orlando). Deixe vazio enquanto não houver data.
  const EVENTO = '';            // ex.: '2026-12-10T19:30:00-05:00'
  const EVENTO_TEXTO = '';      // ex.: '10 DE DEZEMBRO · 19H30 (ORLANDO) · ONLINE · 2 HORAS'

  const $ = id => document.getElementById(id);
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pad = n => String(n).padStart(2, '0');

  // estrelas
  const c = $('stars'), x = c.getContext('2d'); let W, H; const DPR = Math.min(2, devicePixelRatio || 1);
  const st = Array.from({ length: 180 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.2 + .3, p: Math.random() * 6.28 }));
  const size = () => { W = innerWidth; H = innerHeight; c.width = W * DPR; c.height = H * DPR; x.setTransform(DPR, 0, 0, DPR, 0, 0); };
  size(); addEventListener('resize', size);
  const draw = t => { x.clearRect(0, 0, W, H); st.forEach(s => { x.globalAlpha = .18 + .22 * (RM ? .5 : (.5 + .5 * Math.sin(t / 1400 + s.p))); x.fillStyle = '#F2F2F0'; x.beginPath(); x.arc(s.x * W, s.y * H, s.r, 0, 6.283); x.fill(); }); if (!RM) requestAnimationFrame(draw); };
  requestAnimationFrame(draw);

  // contagem
  if (EVENTO_TEXTO) $('when').textContent = EVENTO_TEXTO;
  const alvo = EVENTO ? Date.parse(EVENTO) : NaN;
  if (isNaN(alvo)) $('clock').hidden = true;
  function tick() {
    if (isNaN(alvo)) return;
    let s = Math.max(0, Math.floor((alvo - Date.now()) / 1000));
    $('cd-d').textContent = pad(Math.floor(s / 86400)); $('cd-h').textContent = pad(Math.floor(s % 86400 / 3600));
    $('cd-m').textContent = pad(Math.floor(s % 3600 / 60)); $('cd-s').textContent = pad(s % 60);
    if (s === 0) $('when').textContent = 'AO VIVO AGORA';
  }
  tick(); setInterval(tick, 1000);

  // formulário
  const origem = (() => { try { return new URLSearchParams(location.search).get('utm_source') || ''; } catch (_) { return ''; } })();
  const form = $('form'), cta = $('cta'), msg = $('msg');
  $('whatsapp').addEventListener('input', e => { const v = e.target.value.replace(/\D/g, ''); if (v !== e.target.value) e.target.value = v; });
  const mark = (el, bad) => { const f = el.closest('.field'); if (f) f.classList.toggle('bad', bad); };
  ['nome', 'empresa', 'whatsapp', 'email', 'ramo', 'faz', 'tarefas', 'horas'].forEach(id => { $(id).addEventListener('input', () => mark($(id), false)); $(id).addEventListener('change', () => mark($(id), false)); });
  $('consent').addEventListener('change', () => $('e-consent').classList.remove('on'));

  function validate() {
    const local = $('whatsapp').value.replace(/\D/g, ''), ddi = $('ddi').value, full = ddi + local;
    const checks = [
      ['nome', $('nome').value.trim().length >= 2],
      ['empresa', $('empresa').value.trim().length >= 2],
      ['whatsapp', full.length >= 10 && full.length <= 15 && (ddi !== '1' || local.length === 10)],
      ['email', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test($('email').value.trim())],
      ['ramo', !!$('ramo').value],
      ['faz', $('faz').value.trim().length >= 3],
      ['tarefas', $('tarefas').value.trim().length >= 3],
      ['horas', !!$('horas').value]
    ];
    let first = null;
    checks.forEach(([id, ok]) => { mark($(id), !ok); if (!ok && !first) first = $(id); });
    const consent = $('consent').checked; $('e-consent').classList.toggle('on', !consent);
    if (!consent && !first) first = $('consent');
    return { first, whatsapp: full };
  }

  let sending = false;
  form.addEventListener('submit', async e => {
    e.preventDefault(); if (sending) return; msg.textContent = '';
    const v = validate(); if (v.first) { v.first.focus(); return; }
    sending = true; cta.disabled = true; cta.textContent = 'TRANSMITINDO…';
    const perdas = Array.from(document.querySelectorAll('#perdas input:checked')).map(i => i.value);
    try {
      const r = await fetch('/api/contagem', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: $('nome').value, empresa: $('empresa').value, whatsapp: v.whatsapp, email: $('email').value,
          ramo: $('ramo').value, site: $('site').value, faz: $('faz').value, tarefas: $('tarefas').value,
          horas: $('horas').value, ferramentas: $('ferramentas').value, perdas, consentimento: true,
          origem, hp_x9: $('hp_x9').value
        })
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) return done();
      if (r.status === 409 || d.error === 'duplicate') return done('Você já está inscrito com esse WhatsApp. Sua vaga está garantida, e o link do evento chega no seu WhatsApp e e-mail.');
      if (d.error === 'invalid') { msg.textContent = 'Confira os campos destacados e tente de novo.'; (d.campos || []).forEach(id => { if ($(id)) mark($(id), true); }); }
      else if (r.status === 429) msg.textContent = 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.';
      else msg.textContent = 'Não foi possível enviar agora (' + (d.error || r.status) + '). Tente de novo em instantes.';
    } catch (_) { msg.textContent = 'Sem conexão. Confira sua internet e tente de novo.'; }
    sending = false; cta.disabled = false; cta.textContent = 'GARANTIR MINHA VAGA';
  });
  function done(text) {
    if (text) $('doneText').textContent = text;
    form.hidden = true; $('done').hidden = false; $('done').focus({ preventScroll: true });
    $('box').scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'center' });
  }
})();
