// Sección "Tutorial": cómo se usa cada función y qué comandos hay.
(function () {
  const HZ = globalThis.HZ;
  const app = HZ.app;
  if (!app || HZ.skip) return;
  const I = HZ.icon;

  const K = (t) => `<span class="kbd">${t}</span>`;
  const SECTIONS = [
    {
      icon: 'bolt', title: 'Primeros pasos',
      body: `<ol>
        <li>Abrí WhatsApp Web y entrá a un chat.</li>
        <li>A la izquierda del chat está la <b>barrita de Whazaa</b>: ☰ menú, ⚡ respuestas, pendientes, notas, agenda, estadísticas y CRM. La flechita <b style="color:#25d366">verde</b> de arriba la oculta o la muestra.</li>
        <li>Abajo de la caja de mensaje está la <b>barra de respuestas</b>: cada botón (chip) manda una respuesta al chat abierto.</li>
        <li>Creá tu primera respuesta: ⚡ → <b>+ Nueva</b>.</li>
      </ol>`
    },
    {
      icon: 'text', title: 'Comandos y atajos',
      body: `<table class="tt">
        <tr><td>${K(';')}</td><td>En la caja de mensaje, escribí <b>;</b> y aparece la lista de respuestas.</td></tr>
        <tr><td>${K(';hola')}</td><td>Escribí <b>;</b> + el atajo de una respuesta para filtrarla. ${K('Enter')} o ${K('Tab')} la envía.</td></tr>
        <tr><td>${K('↑')} ${K('↓')}</td><td>Moverse por la lista de respuestas.</td></tr>
        <tr><td>${K('Esc')}</td><td>Cerrar la lista o una ventana.</td></tr>
        <tr><td>${K('Ctrl')}+${K('Enter')}</td><td>Guardar una nota (en Notas).</td></tr>
        <tr><td>Clic en un chip</td><td>Envía la respuesta al chat abierto.</td></tr>
        <tr><td>Secuencias</td><td>Se tocan <b>dos veces</b> para enviar (o activá “Secuencia sale directo” en el filtro de la barra).</td></tr>
      </table>
      <p>El atajo se pone en cada respuesta, en <b>Más opciones → Atajo</b> (sin el <b>;</b>).</p>`
    },
    {
      icon: 'layers', title: 'Crear respuestas rápidas',
      body: `<p>⚡ → <b>+ Nueva</b> y elegís el tipo:</p>
      <ul>
        <li><b>Texto</b>: el mensaje, con variables. Opción “escribiendo…” por unos segundos antes de enviar.</li>
        <li><b>Audio</b>: grabalo ahí mismo o subí un .mp3/.ogg. Ver “Audios como nota de voz”.</li>
        <li><b>Imagen / Video</b>: con texto opcional y “ver una sola vez”.</li>
        <li><b>Documento</b>: PDF, Excel, Word, etc., con texto opcional.</li>
        <li><b>Contacto</b>: llega como tarjeta de contacto.</li>
        <li><b>Secuencia</b>: varios mensajes seguidos (ver más abajo).</li>
      </ul>
      <p>Cada respuesta puede tener una <b>categoría</b> (para agruparlas), ⭐ favorito (sale primero) y se ordena arrastrándola. Pasá el mouse sobre una tarjeta para editarla o borrarla.</p>`
    },
    {
      icon: 'text', title: 'Variables',
      body: `<p>Escribilas en el texto (o tocá los botones) y al enviar se reemplazan:</p>
      <table class="tt">
        <tr><td>${K('{primer_nombre}')}</td><td>Primer nombre del contacto (Juan)</td></tr>
        <tr><td>${K('{nombre_completo}')}</td><td>Nombre como lo tenés agendado</td></tr>
        <tr><td>${K('{saludo}')}</td><td>Buenos días / Buenas tardes / Buenas noches según la hora</td></tr>
        <tr><td>${K('{mi_nombre}')}</td><td>Tu nombre (se configura en Herramientas)</td></tr>
        <tr><td>${K('{telefono}')}</td><td>Teléfono del contacto (Datos del lead)</td></tr>
        <tr><td>${K('{fecha}')} ${K('{hora}')}</td><td>Fecha y hora actual</td></tr>
      </table>`
    },
    {
      icon: 'mic', title: 'Audios como nota de voz',
      body: `<ul>
        <li>Con <b>“Enviar como audio grabado al momento”</b> el audio llega como <b>nota de voz</b> (con su onda), como si lo grabaras recién.</li>
        <li><b>“Simular grabando audio…”</b>: el otro ve “grabando audio…” durante los segundos que elijas (o lo que dura el audio) y después le llega. Poné 0 para mandarlo al instante.</li>
        <li>No tenés que esperar: podés pasar a otro chat mientras se envía.</li>
      </ul>`
    },
    {
      icon: 'layers', title: 'Secuencias y temporizadores',
      body: `<ul>
        <li>⚡ → + Nueva → <b>Secuencia de mensajes</b>.</li>
        <li>Agregá los mensajes ahí mismo: <b>Texto, Audio, Imagen, Video, Documento, Contacto</b>. También podés <b>usar una respuesta guardada</b>.</li>
        <li><b>⏱ Agregar temporizador</b> pone una espera entre mensajes para que parezca natural.</li>
        <li>Ordenalos con ↑ ↓. En <b>“Después de disparar”</b> podés mover el chat a una etapa del CRM al terminar.</li>
      </ul>`
    },
    {
      icon: 'stop', title: 'Envíos en curso y cancelar',
      body: `<p>Cada envío aparece a la <b>derecha de la barra de abajo</b> con el chat, qué está haciendo y la cuenta regresiva. Tocá la <b>✕</b> para cancelarlo, o <b>Cancelar todo</b> si hay varios. Podés mandar a varios chats a la vez.</p>`
    },
    {
      icon: 'kanban', title: 'CRM, etiquetas y datos del lead',
      body: `<ul>
        <li><b>CRM</b>: tablero con etapas (Nuevo lead, En conversación, Propuesta enviada, Cerrado, Perdido). Arrastrá los contactos entre etapas; podés cambiar nombres, colores y crear etapas.</li>
        <li><b>Datos del lead</b> (☰ → Datos del lead): etapa, teléfono, email, empresa, valor y origen del chat abierto.</li>
        <li><b>Notas</b>: notas de cada conversación (el número en la barrita indica cuántas tiene el chat abierto).</li>
        <li>En la <b>lista de chats</b>, al lado de cada nombre, se ve la etapa del CRM y las etiquetas de WhatsApp Business.</li>
      </ul>`
    },
    {
      icon: 'clock', title: 'Seguimiento y clientes esperando',
      body: `<ul>
        <li>Arriba de la lista de chats hay dos filtros:
          <br><b style="color:#f5b74a">↩ Seguimiento</b>: clientes que <b>no te contestan</b> hace más de 1 hora (tu mensaje fue el último). Ideal para escribirles de nuevo.
          <br><b style="color:#fca5a5">⏱ Esperando</b>: clientes que te escribieron y <b>todavía no respondiste</b>.</li>
        <li>Tocá un filtro para ver la lista y tocá un chat para abrirlo.</li>
        <li>En la lista de chats aparece la etiqueta <b style="color:#f5b74a">↩ 2 h</b> o <b style="color:#fca5a5">⏱ 25 min</b> al lado de cada nombre.</li>
        <li>Los tiempos se cambian en ☰ → Estadísticas → Avisos.</li>
      </ul>`
    },
    {
      icon: 'chart', title: 'Estadísticas y exportar',
      body: `<ul>
        <li>☰ → <b>Estadísticas</b>: Hoy, 7 días o 30 días.</li>
        <li><b>🆕 Nuevas</b>: conversaciones que empezaron en ese período (separadas en iniciadas por el cliente o por vos). <b>↩ Ya existían</b>: chats que ya tenían mensajes de antes y siguieron hablando. <b>Σ Totales</b>: la suma de las dos.</li>
        <li>También: respondidas, sin responder, tiempo de respuesta, % respondidas en menos de 5 min y 1 hora.</li>
        <li><b>Exportar estadísticas</b> descarga un Excel con Resumen, Por día y Conversaciones.</li>
        <li><b>Verificar un archivo recibido</b>: cargá el Excel que te mandó un setter y Whazaa te dice si es original o si le cambiaron números.</li>
      </ul>`
    },
    {
      icon: 'calendar', title: 'Agenda y pendientes',
      body: `<ul>
        <li><b>Agenda</b>: programá un mensaje o una respuesta para una fecha y hora. Se envía solo mientras WhatsApp Web esté abierto.</li>
        <li><b>Pendientes</b>: recordatorios con aviso (por ejemplo “llamar a Juan mañana 10 hs”).</li>
      </ul>`
    },
    {
      icon: 'archive', title: 'Copia de seguridad',
      body: `<ul>
        <li>☰ → <b>Copia de seguridad</b> → <b>Crear backup</b>: descarga un .zip con todo (respuestas, audios, imágenes, CRM, notas…).</li>
        <li>En otra computadora: instalá Whazaa y usá <b>Reemplazar todo</b> con ese .zip.</li>
        <li>Hacé un backup cada tanto: si desinstalás la extensión o borrás los datos de Chrome, lo que no esté en un backup se pierde.</li>
      </ul>`
    },
    {
      icon: 'wrench', title: 'Herramientas',
      body: `<ul>
        <li><b>Tu nombre</b> (para la variable Tu nombre y los Excel).</li>
        <li><b>Modo de envío</b>: Rápido (recomendado) o Compatibilidad, por si WhatsApp se actualiza y el rápido deja de andar.</li>
        <li>Qué mostrar en la lista de chats y en la barra de respuestas.</li>
      </ul>`
    }
  ];

  let openIdx = 0;
  app.views.tutorial = {
    render(head, body) {
      head.innerHTML = app.header('Tutorial');
      body.innerHTML = `
        <p class="hint">Todo lo que podés hacer con Whazaa. Tocá un tema para verlo.</p>
        ${SECTIONS.map((s, i) => `
          <div class="tut ${openIdx === i ? 'open' : ''}">
            <div class="tut-h" data-tut="${i}"><span class="ticon" style="background:#25d36622;color:#25d366">${I(s.icon, 15)}</span><b>${s.title}</b><span class="chev">${I('chevronDown', 14)}</span></div>
            <div class="tut-b">${s.body}</div>
          </div>`).join('')}`;
      if (!app.state.settings.tutorialSeen) app.saveSettings({ tutorialSeen: true });
    }
  };
  app.el.body.addEventListener('click', (e) => {
    if (app.view !== 'tutorial') return;
    const h = e.target.closest('[data-tut]');
    if (!h) return;
    const i = +h.dataset.tut;
    openIdx = openIdx === i ? -1 : i;
    app.render();
  });
})();
