// Arranque de HotZapp: agenda (mensajes programados), avisos de pendientes
// y puntos de color del CRM en la lista de chats.
(function () {
  const HZ = globalThis.HZ;
  const app = HZ.app;
  if (!app || HZ.skip) return;
  const wa = HZ.wa;
  const S = () => app.state;

  // ---------- mensajes programados ----------
  let checking = false;
  async function updateSched(id, patch) {
    const list = await HZ.get('scheduled');
    const i = list.findIndex((x) => x.id === id);
    if (i < 0) return;
    list[i] = { ...list[i], ...patch };
    await app.save({ scheduled: list });
  }
  app.checkScheduled = async () => {
    if (checking || !S() || !document.querySelector('#side')) return;
    checking = true;
    try {
      const due = S().scheduled.filter((s) => s.status === 'pending' && s.at <= Date.now()).sort((a, b) => a.at - b.at);
      for (const s of due) {
        await updateSched(s.id, { status: 'sending' });
        try {
          await app.enqueue(async () => {
            app.status(`⏰ Enviando programado a ${s.chatName}…`);
            const ok = await wa.openChat(s.chatName, s.phone);
            if (!ok) throw new Error(`No encontré el chat “${s.chatName}”`);
            await wa.sleep(800);
            if (s.kind === 'text') await wa.sendText(HZ.fillVars(s.text, app.ctx()));
          });
          if (s.kind === 'reply') {
            if (!S().replies.some((x) => x.id === s.replyId)) throw new Error('La respuesta rápida ya no existe');
            const ok = await app.send(s.replyId, { direct: true });
            if (!ok) throw new Error(app.lastError || 'No se pudo enviar');
          }
          await updateSched(s.id, { status: 'sent', sentAt: Date.now(), error: '' });
          chrome.runtime.sendMessage({ type: 'notify', title: 'HotZapp', message: `Mensaje programado enviado a ${s.chatName}` });
        } catch (e) {
          await updateSched(s.id, { status: 'failed', error: e.message });
          app.status('⚠️ Programado: ' + e.message, 'err');
          chrome.runtime.sendMessage({ type: 'notify', title: 'HotZapp – no se pudo enviar', message: `${s.chatName}: ${e.message}` });
        }
      }
    } finally {
      checking = false;
    }
  };

  // ---------- avisos de pendientes ----------
  async function checkTasks() {
    if (!S()) return;
    const due = S().tasks.filter((t) => !t.done && !t.notified && t.due && t.due <= Date.now());
    if (!due.length) return;
    for (const t of due) {
      chrome.runtime.sendMessage({ type: 'notify', title: '🔔 Pendiente', message: t.text + (t.chatName ? ` · ${t.chatName}` : '') });
      app.toast('🔔 ' + t.text, 5000);
    }
    const ids = new Set(due.map((t) => t.id));
    await app.save({ tasks: S().tasks.map((t) => (ids.has(t.id) ? { ...t, notified: true } : t)) });
  }

  // ---------- puntos de color en la lista de chats ----------
  function paintDots() {
    const list = document.querySelector('#pane-side');
    if (!list || !S()) return;
    const on = S().settings.showDots;
    const stageById = Object.fromEntries(S().stages.map((s) => [s.id, s]));
    list.querySelectorAll('.hz-dot').forEach((d) => {
      const span = d.previousElementSibling;
      const c = on && span && S().contacts[span.getAttribute('title')];
      const st = c && stageById[c.stageId];
      if (!st || d.dataset.stage !== st.id || d.dataset.color !== st.color) d.remove();
    });
    if (!on) return;
    list.querySelectorAll('span[title]').forEach((span) => {
      const c = S().contacts[span.getAttribute('title')];
      const st = c && stageById[c.stageId];
      if (!st) return;
      const next = span.nextElementSibling;
      if (next && next.classList.contains('hz-dot')) return;
      const dot = document.createElement('span');
      dot.className = 'hz-dot';
      dot.dataset.stage = st.id;
      dot.dataset.color = st.color;
      dot.title = st.name;
      dot.style.cssText = `display:inline-block;width:9px;height:9px;border-radius:50%;margin-left:6px;vertical-align:middle;flex:none;background:${st.color}`;
      span.after(dot);
    });
  }

  app.boot().then(() => {
    paintDots();
    setInterval(paintDots, 2000);
    setInterval(app.checkScheduled, 15000);
    setInterval(checkTasks, 30000);
    setTimeout(app.checkScheduled, 5000);
    setTimeout(checkTasks, 6000);
  });
})();
