// Arranque de Whazaa: agenda (mensajes programados), avisos de pendientes
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
          let target = await app.findChat(s.chatName, s.phone);
          if (!target) {
            // sin motor rápido: abrimos el chat en la página
            const ok = await app.enqueue(() => wa.openChat(s.chatName, s.phone));
            if (!ok) throw new Error(`No encontré el chat “${s.chatName}”`);
            await wa.sleep(800);
          }
          let reply;
          if (s.kind === 'text') reply = { id: 'sched-' + s.id, type: 'text', name: 'Mensaje programado', text: s.text };
          else {
            reply = S().replies.find((x) => x.id === s.replyId);
            if (!reply) throw new Error('La respuesta rápida ya no existe');
          }
          const ok = await app.send(reply.id, { direct: true, target: target || undefined, reply });
          if (!ok) throw new Error(app.lastError || 'No se pudo enviar');
          await updateSched(s.id, { status: 'sent', sentAt: Date.now(), error: '' });
          chrome.runtime.sendMessage({ type: 'notify', title: 'Whazaa', message: `Mensaje programado enviado a ${s.chatName}` });
        } catch (e) {
          await updateSched(s.id, { status: 'failed', error: e.message });
          app.status('⚠️ Programado: ' + e.message, 'err');
          chrome.runtime.sendMessage({ type: 'notify', title: 'Whazaa – no se pudo enviar', message: `${s.chatName}: ${e.message}` });
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

  app.boot().then(() => {
    setInterval(app.checkScheduled, 15000);
    setInterval(checkTasks, 30000);
    setTimeout(app.checkScheduled, 5000);
    setTimeout(checkTasks, 6000);
  });
})();
