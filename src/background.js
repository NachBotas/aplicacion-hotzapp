// Service worker: datos iniciales, abrir la configuración y notificaciones.
importScripts('storage.js');

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason !== 'install') return;
  const data = await chrome.storage.local.get(['replies', 'stages']);
  if (!data.replies) {
    await chrome.storage.local.set({
      replies: [
        {
          id: HZ.uid(),
          title: 'Saludo inicial',
          shortcut: '/hola',
          steps: [{ id: HZ.uid(), type: 'text', text: '{saludo} {nombre}! 👋 Gracias por escribirnos. ¿En qué te puedo ayudar?', delay: 0 }]
        },
        {
          id: HZ.uid(),
          title: 'Seguimiento',
          shortcut: '/seg',
          steps: [{ id: HZ.uid(), type: 'text', text: 'Hola {nombre}, ¿pudiste ver la propuesta que te envié? Cualquier duda estoy acá 🙌', delay: 0 }]
        }
      ]
    });
  }
  if (!data.stages) await chrome.storage.local.set({ stages: HZ.DEFAULTS.stages });
  chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg) return;
  if (msg.type === 'openOptions') {
    const url = chrome.runtime.getURL('options/options.html') + (msg.hash || '');
    chrome.tabs.create({ url });
  } else if (msg.type === 'notify') {
    chrome.notifications.create({ type: 'basic', iconUrl: chrome.runtime.getURL('icons/icon128.png'), title: msg.title || 'HotZapp', message: msg.message || '' });
  }
});

// Clic en el ícono: si estás en WhatsApp Web abre/cierra el panel, si no, abre WhatsApp Web.
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.url && tab.url.startsWith('https://web.whatsapp.com')) {
    chrome.tabs.sendMessage(tab.id, { type: 'toggle' }).catch(() => {});
  } else {
    const [wa] = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
    if (wa) chrome.tabs.update(wa.id, { active: true });
    else chrome.tabs.create({ url: 'https://web.whatsapp.com/' });
  }
});
