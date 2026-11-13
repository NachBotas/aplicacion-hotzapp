# ⚡ HotZapp – Respuestas rápidas para WhatsApp Web

Extensión de Chrome (y Edge, Brave, Opera) que agrega un panel a **WhatsApp Web** con:

- **Respuestas rápidas** con varios pasos: textos, imágenes (con texto opcional) y audios, con espera configurable entre cada paso.
- **Audios como nota de voz "recién grabada"**: el audio se graba en vivo en el chat, así que sale como nota de voz normal (con onda y "grabando audio…" mientras tanto), no como archivo reenviado.
- **Atajos con `/`**: escribí `/hola` en la caja de mensaje y elegí la respuesta con Enter.
- **Variables**: `{nombre}`, `{nombre_completo}`, `{saludo}` (Buenos días / Buenas tardes / Buenas noches), `{fecha}`, `{hora}`.
- **Embudo de ventas / etiquetas**: etiquetá el chat abierto por etapa, mirá los puntos de color en la lista de chats y movelos en un tablero Kanban con notas.
- **Mensajes programados**: texto o respuesta rápida completa a un chat, en una fecha y hora.
- **Grabador de audio** en la configuración, o subí MP3/OGG/M4A/WAV.
- **Copia de seguridad**: exportá e importá todo en un archivo `.json`.

## Instalación (modo desarrollador)

1. Descargá este repositorio (botón **Code → Download ZIP**) y descomprimilo.
2. En Chrome abrí `chrome://extensions`.
3. Activá **Modo de desarrollador** (arriba a la derecha).
4. Tocá **Cargar descomprimida** y elegí la carpeta del proyecto (la que tiene `manifest.json`).
5. Abrí https://web.whatsapp.com: vas a ver el panel **⚡ HotZapp** a la derecha.

Para configurar respuestas, etapas y programados: ícono ⚙️ del panel, o clic derecho en el ícono de la extensión → **Opciones**.

## Cómo usarla

| Quiero… | Cómo |
|---|---|
| Mandar una respuesta | Abrí un chat y tocá ➤ en la respuesta del panel |
| Usar un atajo | Escribí `/` + atajo en la caja de mensaje, Enter |
| Crear respuesta con audio | ⚙️ → Respuestas rápidas → Nueva → 🎤 Audio → Grabar o subir archivo |
| Etiquetar un contacto | Con el chat abierto, elegí la etapa arriba del panel |
| Ver el embudo | Pestaña 📊 Embudo, o "Abrir tablero completo" para arrastrar y soltar |
| Programar un mensaje | Pestaña ⏰ Agenda |

## Cosas a tener en cuenta

- **Los programados se envían sólo si WhatsApp Web está abierto** en la computadora a esa hora (la pestaña puede estar en segundo plano). Si a esa hora estaba cerrado, se envían al volver a abrirlo.
- El chat programado se busca por **el nombre tal como aparece en WhatsApp** (o el número si no está agendado).
- Una nota de voz tarda en enviarse lo mismo que dura el audio, porque se graba en tiempo real. No cambies de chat mientras se graba.
- Si un audio no arranca, hacé un clic cualquiera en WhatsApp Web y reintentá (Chrome a veces bloquea el audio hasta que interactuás con la página).
- WhatsApp cambia su página seguido. Si algo deja de andar después de una actualización, los selectores están todos en `src/wa.js`.
- **Uso responsable**: no la uses para spam ni envíos masivos. WhatsApp puede restringir números con muchos reportes. HotZapp no está afiliada a WhatsApp ni a Meta.

## Estructura

```
manifest.json         Manifiesto MV3
src/background.js     Service worker: datos iniciales, notificaciones, ícono
src/inject.js         Corre en la página: convierte el audio guardado en "micrófono" para la nota de voz
src/storage.js        Datos (chrome.storage.local) y variables
src/wa.js             Automatización de WhatsApp Web (escribir, pegar imágenes, grabar, abrir chats)
src/content.js        Panel lateral, atajos "/", puntos de etiqueta y ejecución de programados
src/panel-style.js    Estilos del panel
options/              Página de configuración (respuestas, embudo Kanban, programados, ajustes)
icons/                Íconos (se regeneran con python3 icons/make_icons.py)
```
