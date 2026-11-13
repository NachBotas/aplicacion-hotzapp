// Service worker: datos iniciales, notificaciones y clic en el ícono.
importScripts('storage.js');

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason !== 'install') return;
  const data = await chrome.storage.local.get(['replies', 'stages']);
  if (!data.replies) {
    const base = { category: 'Ventas', favorite: false, uses: 0, shortcut: '' };
    const saludo = { ...base, id: HZ.uid(), type: 'text', name: 'Saludo inicial', shortcut: 'hola', favorite: true, text: '{saludo} {primer_nombre}! 👋 Gracias por escribirnos. ¿En qué te puedo ayudar?' };
    const seg = { ...base, id: HZ.uid(), type: 'text', name: 'Seguimiento', shortcut: 'seg', text: 'Hola {primer_nombre}, ¿pudiste ver la propuesta que te envié? Cualquier duda estoy acá 🙌' };
    await chrome.storage.local.set({ replies: [saludo, seg] });
  }
  if (!data.stages) await chrome.storage.local.set({ stages: HZ.DEFAULTS.stages });
  chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html') });
});

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg) return;
  if (msg.type === 'openOptions') {
    chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html') + (msg.hash || '') });
  } else if (msg.type === 'notify') {
    chrome.notifications.create({ type: 'basic', iconUrl: chrome.runtime.getURL('icons/icon128.png'), title: msg.title || 'HotZapp', message: msg.message || '' });
  }
});

// Clic en el ícono: en WhatsApp Web abre/cierra el panel; si no, abre WhatsApp Web.
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.url && tab.url.startsWith('https://web.whatsapp.com')) {
    chrome.tabs.sendMessage(tab.id, { type: 'toggle' }).catch(() => {});
  } else {
    const [wa] = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
    if (wa) chrome.tabs.update(wa.id, { active: true });
    else chrome.tabs.create({ url: 'https://web.whatsapp.com/' });
  }
});
