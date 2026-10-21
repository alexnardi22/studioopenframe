(() => {
  'use strict';
  const $ = id => document.getElementById(id);

  // foto: se /10primeiros/alexandre.jpg não existir, ficam as iniciais
  const photo = $('photo');
  const hidePhoto = () => photo.remove();
  if (photo.complete && !photo.naturalWidth) hidePhoto(); else photo.addEventListener('error', hidePhoto);

  const origem = (() => { try { return new URLSearchParams(location.search).get('utm_source') || ''; } catch (_) { return ''; } })();
  const form = $('form'), cta = $('cta'), msg = $('msg');

  // só números no WhatsApp
  $('whatsapp').addEventListener('input', e => { const v = e.target.value.replace(/\D/g, ''); if (v !== e.target.value) e.target.value = v; });

  const fieldOf = el => el.closest('.field');
  function mark(el, bad) { const f = fieldOf(el); if (f) f.classList.toggle('bad', bad); }
  ['nome', 'whatsapp', 'tipo', 'cidade'].forEach(id => $(id).addEventListener('input', () => mark($(id), false)));
  $('tipo').addEventListener('change', () => mark($('tipo'), false));
  $('consent').addEventListener('change', () => $('e-consent').classList.remove('on'));

  function validate() {
    const nome = $('nome').value.trim();
    const local = $('whatsapp').value.replace(/\D/g, '');
    const full = $('ddi').value + local;
    const checks = [
      ['nome', nome.length >= 2],
      ['whatsapp', local.length >= 8 && full.length >= 10 && full.length <= 15 && (($('ddi').value !== '1') || local.length === 10)],
      ['tipo', !!$('tipo').value],
      ['cidade', $('cidade').value.trim().length >= 2]
    ];
    let first = null;
    checks.forEach(([id, ok]) => { mark($(id), !ok); if (!ok && !first) first = $(id); });
    const consent = $('consent').checked;
    $('e-consent').classList.toggle('on', !consent);
    if (!consent && !first) first = $('consent');
    return { ok: !first, first, data: { nome, whatsapp: full } };
  }

  function showDone(text) {
    if (text) $('doneText').textContent = text;
    form.hidden = true; $('done').hidden = false; $('done').focus({ preventScroll: true });
    $('box').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  let sending = false;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (sending) return;
    msg.textContent = '';
    const v = validate();
    if (!v.ok) { v.first.focus(); return; }
    sending = true; cta.disabled = true; cta.textContent = 'Enviando…';
    try {
      const r = await fetch('/api/lista10', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: v.data.nome, whatsapp: v.data.whatsapp,
          tipo_empresa: $('tipo').value, cidade_estado: $('cidade').value.trim(),
          dificuldade: $('dificuldade').value.trim(), consentimento: true,
          origem, empresa_site: $('empresa_site').value
        })
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) return showDone();
      if (r.status === 409 || d.error === 'duplicate') return showDone('Esse WhatsApp já está na lista. Eu vou falar pessoalmente com cada pessoa. Fique de olho no seu WhatsApp.');
      if (d.error === 'invalid') { msg.textContent = 'Confira os campos destacados e tente de novo.'; (d.campos || []).forEach(c => { const el = $({ tipo_empresa: 'tipo', cidade_estado: 'cidade' }[c] || c); if (el) mark(el, true); }); }
      else if (r.status === 429) msg.textContent = 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.';
      else msg.textContent = 'Não foi possível enviar agora. Tente de novo em instantes.';
    } catch (_) {
      msg.textContent = 'Sem conexão. Confira sua internet e tente de novo.';
    }
    sending = false; cta.disabled = false; cta.textContent = 'Quero ser um dos 10';
  });
})();
