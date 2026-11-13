# ⚡ HotZapp – Respuestas rápidas para WhatsApp Web

Extensión de Chrome (y Edge, Brave, Opera) que agrega a **WhatsApp Web**:

- **Respuestas rápidas de 7 tipos**: texto, audio, imagen, video, documento, contacto y **secuencias** (varias respuestas una tras otra, con espera, que al terminar pueden mover el chat a una etapa del CRM).
- **Audios como recién grabados**: llegan como nota de voz y el otro ve "grabando audio…".
- **Barra de chips debajo del chat** con filtro (solo favoritos, por tipo), estilo ícono/color, "Mensaje sale directo" y "Secuencia sale directo".
- **Atajo `;`** en la caja de mensaje (por ej. `;hola` + Enter).
- Categorías, favoritos, contador de usos y orden con arrastrar y soltar.
- Variables: Primer nombre, Nombre completo, Saludo, Tu nombre, Teléfono, Fecha de hoy y Hora actual.
- Opciones: "Ver una sola vez" (imagen, video, audio) y "Simular escribiendo…" (texto).
- **Menú HotZapp**: Pendientes (con aviso), Agenda (mensajes programados), CRM (tablero Kanban), Datos del lead, Notas y Herramientas (preferencias y copia de seguridad).

## Instalación (modo desarrollador)

1. Descargá este repositorio (botón **Code → Download ZIP**) y descomprimilo.
2. En Chrome abrí `chrome://extensions`.
3. Activá **Modo de desarrollador** (arriba a la derecha).
4. Tocá **Cargar descomprimida** y elegí la carpeta del proyecto (la que tiene `manifest.json`).
5. Abrí https://web.whatsapp.com: vas a ver el panel **⚡ HotZapp** a la derecha.

En WhatsApp Web vas a ver una barrita a la izquierda del chat (☰ menú, ⚡ respuestas, pendientes, notas, agenda y CRM) y la barra de chips debajo de la caja de mensaje.

## Cómo usarla

| Quiero… | Cómo |
|---|---|
| Crear una respuesta | ⚡ → **+ Nueva** → elegí el tipo |
| Mandar una respuesta | Tocá el chip abajo del chat, la tarjeta en el panel, o escribí `;atajo` + Enter |
| Mandar una secuencia | Tocá su chip dos veces (o activá "Secuencia sale directo" en el filtro) |
| Etiquetar un lead | ☰ → Datos del lead → Etapa del CRM, o arrastralo en el tablero CRM |
| Programar un mensaje | ☰ → Agenda |
| Recordar un seguimiento | ☰ → Pendientes |

## Cosas a tener en cuenta

- **Los programados se envían sólo si WhatsApp Web está abierto** en la computadora a esa hora (la pestaña puede estar en segundo plano). Si a esa hora estaba cerrado, se envían al volver a abrirlo.
- El chat programado se busca por **el nombre tal como aparece en WhatsApp** (o el número si no está agendado).
- Una nota de voz tarda en enviarse lo mismo que dura el audio, porque se graba en tiempo real. No cambies de chat mientras se graba.
- Si un audio no arranca, hacé un clic cualquiera en WhatsApp Web y reintentá (Chrome a veces bloquea el audio hasta que interactuás con la página).
- WhatsApp cambia su página seguido. Si algo deja de andar después de una actualización, los selectores están todos en `src/wa.js`.
- **"Ver una sola vez"** y la **tarjeta de contacto** dependen de botones de WhatsApp que cambian seguido: si no se encuentran, la imagen/audio no se envía (para no mandarlo permanente por error) y el contacto se manda como texto con el número y un link wa.me.
- **Uso responsable**: no la uses para spam ni envíos masivos. WhatsApp puede restringir números con muchos reportes. HotZapp no está afiliada a WhatsApp ni a Meta.

## Estructura

```
manifest.json         Manifiesto MV3
src/background.js     Service worker: datos iniciales, notificaciones, ícono
src/inject.js         Corre en la página: convierte el audio guardado en "micrófono" para la nota de voz
src/storage.js        Datos (chrome.storage.local), tipos y variables
src/icons.js          Íconos
src/wa.js             Automatización de WhatsApp Web (texto, archivos, voz, contacto, abrir chats)
src/core.js           Estado, panel, barrita lateral y motor de envío
src/editor.js         Editor de respuestas (7 tipos)
src/sections.js       Menú, Respuestas, Pendientes, Agenda, Datos del lead, Notas, Herramientas y CRM
src/bar.js            Barra de chips debajo del chat y atajo ";"
src/content.js        Arranque: agenda, avisos de pendientes y puntos de color del CRM
src/panel-style.js    Estilos (tema oscuro)
options/options.html  Página de bienvenida
```
