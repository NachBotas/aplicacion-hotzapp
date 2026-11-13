// Etiquetas al lado de cada nombre en la lista de chats:
//  · la etapa del CRM de Whazaa (con su nombre y color)
//  · las etiquetas de WhatsApp Business del chat (si usás WhatsApp Business)
//  · el temporizador rojo "⏱ 25 min" si el cliente está esperando respuesta
// Todo va en un único contenedor, así nada se pisa ni desaparece.
(function () {
  const HZ = globalThis.HZ;
  const app = HZ.app;
  if (!app || HZ.skip) return;
  const esc = HZ.escape;
  const MIN = 60000;

  app.waLabels = {}; // { [nombreDelChat]: [{ name, color }] }

  async function loadLabels() {
    if (!HZ.api || !HZ.api.ready || !app.state.settings.listShowLabels) return;
    try {
      const list = await HZ.api.call('labels');
      const map = {};
      for (const c of list || []) map[c.name] = c.labels;
      const changed = JSON.stringify(map) !== JSON.stringify(app.waLabels);
      app.waLabels = map;
      if (changed) { paint(); if (app.open && app.view === 'lead') app.render(); }
    } catch (_) {}
  }

  const chip = (text, color, solid) =>
    `<span style="display:inline-block;flex:none;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 6px;border-radius:8px;font-size:10.5px;font-weight:700;line-height:16px;${
      solid ? `background:${color};color:#fff` : `background:${color}26;color:${color};border:1px solid ${color}66`
    }">${esc(text)}</span>`;

  function paint() {
    const pane = document.querySelector('#pane-side');
    if (!pane || !app.state) return;
    const s = app.state.settings;
    const stages = Object.fromEntries(app.state.stages.map((x) => [x.id, x]));
    const limit = (Number(s.waitMinutes) || 15) * MIN;
    const follows = s.listShowFollow && HZ.tracker
      ? Object.fromEntries(HZ.tracker.followups((Number(s.followMinutes) || 60) * MIN).map((w) => [w.name, w]))
      : {};
    const waits = s.waitAlert && s.listShowTimer && HZ.tracker
      ? Object.fromEntries(HZ.tracker.waiting().filter((w) => w.wait >= limit).map((w) => [w.name, w]))
      : {};
    // limpiar restos de versiones anteriores
    pane.querySelectorAll('.hz-dot,.hz-wait').forEach((el) => el.remove());
    const seen = new Set();
    pane.querySelectorAll('span[title]').forEach((span) => {
      const row = span.closest('[role="listitem"],[role="row"]');
      if (!row || seen.has(row)) return;
      seen.add(row);
      if (row.querySelector('span[title]') !== span) return; // sólo el nombre, no la vista previa
      const name = span.getAttribute('title');
      const parts = [];
      // primero lo urgente (tiempos), después etapa y etiquetas
      const w0 = waits[name];
      if (w0) parts.push(chip('⏱ ' + HZ.fmtDur(w0.wait), '#f05252', true));
      const f0 = follows[name];
      if (f0) parts.push(chip('↩ ' + HZ.fmtDur(f0.wait), '#f5a524', true));
      const c = app.state.contacts[name];
      const st = s.listShowStage && c && stages[c.stageId];
      if (st) parts.push(chip(st.name, st.color));
      if (s.listShowLabels) for (const l of (app.waLabels[name] || []).slice(0, 3)) parts.push(chip(l.name, l.color));
      let box = row.querySelector('.hz-deco');
      if (!parts.length) { if (box) box.remove(); return; }
      const html = parts.join('');
      if (!box || box.previousElementSibling !== span) {
        if (box) box.remove();
        box = document.createElement('span');
        box.className = 'hz-deco';
        box.style.cssText = 'display:inline-flex;gap:4px;align-items:center;margin:0 4px 0 6px;vertical-align:middle;flex:0 1 auto;min-width:0;max-width:60%;overflow:hidden';
        span.after(box);
      }
      if (box.dataset.sig !== html) { box.innerHTML = html; box.dataset.sig = html; }
    });
    // filas que ya no están en la lista virtual
    pane.querySelectorAll('.hz-deco').forEach((b) => { if (!b.previousElementSibling || !b.previousElementSibling.matches('span[title]')) b.remove(); });
  }
  app.paintList = paint;

  app.afterBoot = app.afterBoot || [];
  app.afterBoot.push(() => {
    paint();
    setInterval(paint, 2000);
    setTimeout(loadLabels, 6000);
    setInterval(loadLabels, 30000);
  });
  app.onState = app.onState || [];
  app.onState.push(paint);
})();
