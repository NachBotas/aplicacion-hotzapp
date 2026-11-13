# ⚡ Whazaa – Respuestas rápidas, CRM y estadísticas para WhatsApp Web

Extensión de Chrome (y Edge, Brave, Opera) que agrega a **WhatsApp Web**:

- **Respuestas rápidas de 7 tipos**: texto, audio, imagen, video, documento, contacto y **secuencias** (varias respuestas una tras otra, con espera, que al terminar pueden mover el chat a una etapa del CRM).
- **Audios como recién grabados, al instante**: llegan como nota de voz (con su onda). Antes de mandarlo, el otro ve "grabando audio…" durante los segundos que elijas (o lo que dura el audio). No hay que esperar: podés pasar a otro chat mientras sale.
- **Cualquier formato de audio**: WAV, MP3, M4A, WEBM… se convierte solo a OGG Opus (el formato de las notas de voz de WhatsApp), así WhatsApp no lo rechaza.
- **Varios chats a la vez y botón ⏹ para cancelar**: cada envío aparece abajo, a la derecha de la barra, con cuenta regresiva; tocá la ✕ para cancelarlo (o "Cancelar todo").
- **Secuencias completas en un solo lugar**: dentro de la secuencia creás cada mensaje (texto, audio, imagen, video, documento o contacto) sin tener que crearlos antes por separado; también podés sumar respuestas ya guardadas.
- **Temporizadores en las secuencias** ("⏱ Agregar temporizador") y "escribiendo…" configurable en los textos.
- **Etiquetas de WhatsApp Business**: botón **🏷️ Etiquetas** en la cabecera del chat (o Alt+E) para poner, sacar o crear etiquetas con un toque; se muestran al lado de cada nombre en la lista de chats (también desde ☰ → Datos del lead) (quedan guardadas en WhatsApp y se ven en el celular).
- **"No es un lead"** (equipo, proveedor, personal): no cuenta en métricas, seguimiento ni esperando. **"Conversación terminada"**: sale de seguimiento/esperando hasta que esa persona vuelva a escribir. Botones ✓ y 🚫 en las listas de Seguimiento y Esperando, y en Datos del lead.
- **Barra de chips debajo del chat** con filtro (solo favoritos, por tipo), estilo ícono/color, "Mensaje sale directo" y "Secuencia sale directo".
- **Atajo `;`** en la caja de mensaje (por ej. `;hola` + Enter).
- Categorías, favoritos, contador de usos y orden con arrastrar y soltar.
- Variables: Primer nombre, Nombre completo, Saludo, Tu nombre, Teléfono, Fecha de hoy y Hora actual.
- Opciones: "Ver una sola vez" (imagen, video, audio) y "Simular escribiendo…" (texto).
- **Menú Whazaa**: Pendientes (con aviso), Agenda (mensajes programados), CRM (tablero Kanban), Datos del lead, Notas, Herramientas y Copia de seguridad.
- **Estadísticas** de hoy, 7 días y 30 días: **conversaciones nuevas** (empezaron en el período, separadas en iniciadas por el cliente o por vos), **las que ya existían** y **totales** — leyendo el historial real de WhatsApp —, respondidas / sin responder, mensajes, tiempo de respuesta promedio y mediana, % respondidas en menos de 5 min y 1 h, gráfico por día.
- **Filtro "↩ Seguimiento"** arriba de la lista de chats: clientes que no te contestan hace más de 1 hora (configurable), con su etiqueta "↩ 2 h" en cada chat. Y **"⏱ Esperando"** para los que esperan tu respuesta.
- **Tutorial** dentro de la extensión (☰ → Tutorial) con todos los comandos y cómo usarlos.
- **Aviso cuando un cliente espera** más de N minutos: notificación, etiqueta roja "⏱ 25 min" en la lista de chats y lista de quién está esperando.
- **Exportar estadísticas a Excel (.xlsx)** con hojas Resumen, Por día y Conversaciones, la cuenta de WhatsApp, quién lo exportó y un **código de verificación**; con *Verificar un archivo recibido* se detecta si alguien cambió los números.
- **Copia de seguridad en .zip** con todo: configuración, respuestas, CRM, notas, agenda y los audios, imágenes, videos y documentos en carpetas. Se carga en otra computadora con *Reemplazar todo* o *Combinar*.

## Instalación (modo desarrollador)

1. Descargá este repositorio (botón **Code → Download ZIP**) y descomprimilo.
2. En Chrome abrí `chrome://extensions`.
3. Activá **Modo de desarrollador** (arriba a la derecha).
4. Tocá **Cargar descomprimida** y elegí la carpeta del proyecto (la que tiene `manifest.json`).
5. Abrí https://web.whatsapp.com: vas a ver el panel **⚡ Whazaa** a la derecha.

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
| Ver / exportar estadísticas | ☰ → Estadísticas → **Exportar estadísticas** (Hoy, 7 días o 30 días) |
| Comprobar el Excel de un setter | ☰ → Estadísticas → **Verificar un archivo recibido** |
| Pasar todo a otra compu | ☰ → Copia de seguridad → **Crear backup**; en la otra compu → **Reemplazar todo** y elegí el .zip |

## Cosas a tener en cuenta

- **Los programados se envían sólo si WhatsApp Web está abierto** en la computadora a esa hora (la pestaña puede estar en segundo plano). Si a esa hora estaba cerrado, se envían al volver a abrirlo.
- El chat programado se busca por **el nombre tal como aparece en WhatsApp** (o el número si no está agendado).
- Una nota de voz tarda en enviarse lo mismo que dura el audio, porque se graba en tiempo real. No cambies de chat mientras se graba.
- Si un audio no arranca, hacé un clic cualquiera en WhatsApp Web y reintentá (Chrome a veces bloquea el audio hasta que interactuás con la página).
- WhatsApp cambia su página seguido. Si algo deja de andar después de una actualización, los selectores están todos en `src/wa.js`.
- **"Ver una sola vez"** y la **tarjeta de contacto** dependen de botones de WhatsApp que cambian seguido: si no se encuentran, la imagen/audio no se envía (para no mandarlo permanente por error) y el contacto se manda como texto con el número y un link wa.me.
- **Estadísticas**: WhatsApp no guarda tiempos de respuesta en cuentas normales, así que Whazaa los mide desde que está instalado, mientras WhatsApp Web está abierto (lista de chats + mensajes de cada chat que se abre). Lo que se responde desde el celular con la compu cerrada se registra la próxima vez que se abre ese chat en WhatsApp Web. Los grupos no cuentan (se pueden incluir).
- **Tus archivos** se copian dentro de la extensión (aunque borres el original, la respuesta sigue andando), pero se pierden si desinstalás Whazaa o borrás los datos de Chrome: hacé backups seguido y guardá los originales juntos en una carpeta.
- **Uso responsable**: no la uses para spam ni envíos masivos. WhatsApp puede restringir números con muchos reportes. Whazaa no está afiliada a WhatsApp ni a Meta.

## Motor de envío

Whazaa usa [WA-JS](https://github.com/wppconnect-team/wa-js) (WPPConnect, licencia Apache 2.0, incluida en `lib/`) para mandar mensajes directamente desde WhatsApp Web: es lo que permite enviar audios como nota de voz al instante, mandar a un chat aunque no esté abierto y mostrar "escribiendo…" / "grabando audio…". Está configurado para **no** enviar analíticas ni usar servidores externos (`src/wpp-config.js`).

Si WA-JS no carga (por ejemplo, justo después de una actualización de WhatsApp), Whazaa pasa solo al **modo compatibilidad** (hace clic en la página, un envío a la vez y en el chat abierto). El estado se ve en Menú → Herramientas → Envío de mensajes.

## Estructura

```
manifest.json         Manifiesto MV3
src/background.js     Service worker: datos iniciales, notificaciones, ícono
src/inject.js         Corre en la página: convierte el audio guardado en "micrófono" para la nota de voz
src/storage.js        Datos (chrome.storage.local), tipos y variables
src/icons.js          Íconos
src/wa.js             Automatización de WhatsApp Web (texto, archivos, voz, contacto, abrir chats)
src/core.js           Estado, panel y barrita lateral
src/audioconv.js      Convierte cualquier audio (wav, mp3, m4a, webm…) a OGG Opus, el formato de notas de voz de WhatsApp
src/engine.js         Motor de envíos: rápido (WA-JS) o compatibilidad, cola por chat, cancelar
src/bridge.js         Puente con WA-JS dentro de la página
src/wpp-config.js     Configuración de WA-JS (sin analíticas ni servidores externos)
src/deco.js           Etiquetas y temporizador al lado de cada chat
src/labelbtn.js       Botón "Etiquetas" en la cabecera del chat (Alt+E)
lib/                  WA-JS (WPPConnect, Apache 2.0)
src/editor.js         Editor de respuestas (7 tipos)
src/sections.js       Menú, Respuestas, Pendientes, Agenda, Datos del lead, Notas, Herramientas y CRM
src/bar.js            Barra de chips debajo del chat y atajo ";"
src/backup.js         Copia de seguridad en .zip (exportar / importar)
src/tracker.js        Registro de conversaciones (historial real), seguimiento y avisos de espera
src/followbar.js      Filtros "Seguimiento" y "Esperando" arriba de la lista de chats
src/tutorial.js       Tutorial
src/stats.js          Estadísticas, exportación a Excel y verificación
src/content.js        Arranque: agenda, avisos de pendientes y puntos de color del CRM
src/panel-style.js    Estilos (tema oscuro)
options/options.html  Página de bienvenida
```
