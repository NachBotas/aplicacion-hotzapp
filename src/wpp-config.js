// Configuración de WA-JS (se lee antes de cargar lib/wppconnect-wa.js).
// - deviceName:false → no cambia el nombre del dispositivo vinculado.
// - Sin Google Analytics y sin servidores externos de vista previa de links:
//   ningún dato sale de tu computadora.
window.WPPConfig = Object.assign(window.WPPConfig || {}, {
  deviceName: false,
  disableGoogleAnalytics: true,
  googleAnalyticsId: null,
  linkPreviewApiServers: [],
  poweredBy: null,
  sendStatusToDevice: false
});
