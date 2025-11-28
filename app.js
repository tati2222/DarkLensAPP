/* ========================================
   app.js - Versión C (corregido + optimizado + modular)
   ======================================== */

/* ---------- CONFIG ---------- */
const RENDER_PREDICT_URL = "https://darklnesapp-api-1.onrender.com/run/predict"; // usado SOLO desde panel investigador
const GOOGLE_SHEETS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbwm8kIl1h0Avas55eNI0dbiKj-MPCbuXyQp7ndsQYiDdmcsmDGYgyirgt2sorvOFLEZgA/exec";
const PASSWORD_INVESTIGADOR = "investigador2025";

/* ---------- ESTADO GLOBAL ---------- */
const invertidos = [11, 15, 17, 20, 25];
let tiemposRespuesta = {};
let tiempoInicioItem = {};
let testInicioTimestamp = null;
let imagenCapturada = null;
let stream = null;
let participantesData = [];
let participanteSeleccionado = null;
let graficoSD3 = null;

/* ---------- UTILIDADES ---------- */
function dataURLtoBlob(dataurl) {
  const arr = dataurl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new Blob([u8arr], { type: mime });
}

function safeJsonParse(respText) {
  try { return JSON.parse(respText); } catch { return null; }
}

function calcularEstadisticasTiempo(tiemposArray) {
  if (!Array.isArray(tiemposArray) || tiemposArray.length === 0) {
    return { promedio_ms:0, promedio_segundos:'0.00', mediana_ms:0, mediana_segundos:'0.00', minimo_ms:0, minimo_segundos:'0.00', maximo_ms:0, maximo_segundos:'0.00', desviacion_estandar_ms:0, desviacion_estandar_segundos:'0.00', total_items:0 };
  }
  const suma = tiemposArray.reduce((a,b) => a+b, 0);
  const promedio = suma / tiemposArray.length;
  const sorted = [...tiemposArray].sort((a,b)=>a-b);
  const medio = Math.floor(sorted.length/2);
  const mediana = sorted.length%2===0 ? (sorted[medio-1]+sorted[medio])/2 : sorted[medio];
  const minimo = sorted[0];
  const maximo = sorted[sorted.length-1];
  const varianza = tiemposArray.reduce((acc,val) => acc + Math.pow(val - promedio, 2), 0) / tiemposArray.length;
  const desviacionEstandar = Math.sqrt(varianza);
  return {
    promedio_ms: Math.round(promedio),
    promedio_segundos: (promedio/1000).toFixed(2),
    mediana_ms: Math.round(mediana),
    mediana_segundos: (mediana/1000).toFixed(2),
    minimo_ms: minimo,
    minimo_segundos: (minimo/1000).toFixed(2),
    maximo_ms: maximo,
    maximo_segundos: (maximo/1000).toFixed(2),
    desviacion_estandar_ms: Math.round(desviacionEstandar),
    desviacion_estandar_segundos: (desviacionEstandar/1000).toFixed(2),
    total_items: tiemposArray.length
  };
}

/* ---------- SD3 ITEMS y UI ---------- */
const itemsSD3 = [
  "No es prudente contar tus secretos.",
  "Me gusta usar manipulaciones ingeniosas para salirme con la mía.",
  "Hagas lo que hagas, debes conseguir que las personas importantes estén de tu lado.",
  "Evito el conflicto directo con los demás porque pueden serme útiles en el futuro.",
  "Es sabio guardar información que puedas usar en contra de otras personas más adelante.",
  "Debes esperar el momento oportuno para vengarme de las personas.",
  "Hay cosas que deberías ocultar a los demás porque no necesitan saberlas.",
  "Asegúrate de que tus planes te beneficien a ti, no a los demás.",
  "La mayoría de las personas puede ser manipulada.",
  "La gente me ve como un líder nato.",
  "(R) Odio ser el centro de atención.",
  "Muchas actividades grupales tienden a ser aburridas sin mí.",
  "Sé que soy especial porque todos me lo dicen continuamente.",
  "Me gusta relacionarme con personas importantes.",
  "(R) Me siento avergonzado/a si alguien me hace un cumplido.",
  "Me han comparado con gente famosa.",
  "(R) Soy una persona promedio.",
  "Insisto en recibir el respeto que merezco.",
  "Me gusta vengarme de las autoridades.",
  "(R) Evito situaciones peligrosas.",
  "La venganza debe ser rápida y desagradable.",
  "La gente suele decir que estoy fuera de control.",
  "Es cierto que puedo ser cruel con los demás.",
  "Las personas que se meten conmigo siempre se arrepienten.",
  "(R) Nunca me he metido en problemas con la ley.",
  "Disfruto tener relaciones sexuales con personas que apenas conozco.",
  "Diré cualquier cosa para conseguir lo que quiero."
];

function generarItemsTest() {
  const form = document.getElementById('form-sd3');
  if (!form) return;
  form.innerHTML = '';
  itemsSD3.forEach((texto, idx) => {
    const num = idx + 1;
    const div = document.createElement('div');
    div.className = 'test-item';
    div.setAttribute('data-item', num);
    div.innerHTML = `
      <p><strong>${num}.</strong> ${texto}</p>
      <div class="opciones" role="radiogroup" aria-label="item-${num}">
        ${[1,2,3,4,5].map(v => `
          <input type="radio" id="item${num}_${v}" name="item${num}" value="${v}">
          <label for="item${num}_${v}">${v}</label>
        `).join('')}
      </div>
    `;
    form.appendChild(div);
  });

  const btn = document.createElement('button');
  btn.type = 'submit';
  btn.className = 'btn-primary';
  btn.textContent = 'Enviar respuestas del test';
  form.appendChild(btn);
}

/* ---------- TRACKING DE TIEMPOS ---------- */
function configurarTrackingTiempos() {
  tiemposRespuesta = {};
  tiempoInicioItem = {};
  const items = document.querySelectorAll('.test-item');
  if (!items || items.length === 0) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const itemNum = parseInt(entry.target.getAttribute('data-item'));
        if (!tiempoInicioItem[itemNum]) tiempoInicioItem[itemNum] = Date.now();
      }
    });
  }, { threshold: 0.5 });

  items.forEach(it => observer.observe(it));

  for (let i=1;i<=itemsSD3.length;i++) {
    const radios = document.querySelectorAll(`input[name="item${i}"]`);
    radios.forEach(r => r.addEventListener('change', () => registrarTiempoRespuesta(i)));
  }
}

function registrarTiempoRespuesta(itemNum) {
  if (tiemposRespuesta[itemNum]) return;
  const inicio = tiempoInicioItem[itemNum];
  const ahora = Date.now();
  if (inicio) {
    const lapso = ahora - inicio;
    tiemposRespuesta[itemNum] = { tiempo_ms: lapso, tiempo_segundos: (lapso/1000).toFixed(2), timestamp_inicio: inicio, timestamp_respuesta: ahora };
  } else {
    const desdeInicio = testInicioTimestamp ? (ahora - testInicioTimestamp) : 0;
    tiemposRespuesta[itemNum] = { tiempo_ms: desdeInicio, tiempo_segundos: (desdeInicio/1000).toFixed(2), timestamp_inicio: testInicioTimestamp, timestamp_respuesta: ahora, nota: 'respondido_sin_intersection' };
  }
}

/* ---------- CALCULAR SD3 ---------- */
async function calcularSD3() {
  const respuestas = [];
  const respuestasObj = {};
  for (let i=1;i<=itemsSD3.length;i++) {
    const sel = document.querySelector(`input[name="item${i}"]:checked`);
    if (!sel) {
      alert(`Por favor respondé el ítem ${i}`);
      const primer = document.querySelector(`input[name="item${i}"]`);
      if (primer) primer.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    let val = parseInt(sel.value);
    if (invertidos.includes(i)) val = 6 - val;
    respuestas.push(val);
    respuestasObj[`item${i}`] = val;
  }

  const mean = arr => arr.reduce((a,b)=>a+b,0)/arr.length;
  const mach = parseFloat(mean(respuestas.slice(0,9)).toFixed(2));
  const narc = parseFloat(mean(respuestas.slice(9,18)).toFixed(2));
  const psych = parseFloat(mean(respuestas.slice(18,27)).toFixed(2));
  const fin = Date.now();
  const tiempoTotal = fin - (testInicioTimestamp || fin);
  const tiemposArray = Object.values(tiemposRespuesta).map(t => t?.tiempo_ms || 0);
  const estadisticasTiempo = calcularEstadisticasTiempo(tiemposArray);

  const resultadosSD3 = { mach, narc, psych, respuestas: respuestasObj, tiempos_respuesta: tiemposRespuesta, tiempo_total_ms: tiempoTotal, tiempo_total_segundos: (tiempoTotal/1000).toFixed(2), estadisticas_tiempo: estadisticasTiempo };
  sessionStorage.setItem('resultadosSD3', JSON.stringify(resultadosSD3));

  // Enviamos SD3 a Google Sheets (registro), no al Render
  try {
    await enviarResultadosAGoogleSheets({ tipo:'sd3', timestamp: new Date().toISOString(), persona: JSON.parse(sessionStorage.getItem('datos_personales')||'{}'), sd3: resultadosSD3 });
  } catch (e) {
    console.warn('No se pudo enviar SD3 a Google Sheets:', e);
  }

  // mostrar siguiente sección (captura) al participante
  document.getElementById('seccion-test')?.classList.add('hidden');
  document.getElementById('seccion-micro')?.classList.remove('hidden');
  if (!window._capturaInicializada) { configurarCamaraYSubida(); window._capturaInicializada = true; }
  window.scrollTo({ top:0, behavior:'smooth' });
}

async function enviarResultadosAGoogleSheets(datos) {
  console.log("📤 Enviando datos a Google Sheets:", datos);

  const payload = {
    action: "guardar",
    data: datos
  };

  try {
    const res = await fetch(GOOGLE_SHEETS_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    console.log("Respuesta Sheets:", json);
    return json;

  } catch (err) {
    console.error("❌ Error enviando a Sheets:", err);
  }
}

/* ---------- CÁMARA / SUBIDA (PARTICIPANTE) ---------- */
function configurarCamaraYSubida() {
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const btnActivarCamara = document.getElementById('btn-activar-camara');
  const btnTomarFoto = document.getElementById('btn-tomar-foto');
  const btnSubirImagen = document.getElementById('btn-subir-imagen');
  const inputImagen = document.getElementById('input-imagen');
  const previewContainer = document.getElementById('preview-container');
  const previewImg = document.getElementById('preview-img');

  // botón de envío a Google Sheets (por participante)
  let btnEnviarImagen = document.getElementById('btn-enviar-imagen');
  if (!btnEnviarImagen) {
    btnEnviarImagen = document.createElement('button');
    btnEnviarImagen.id = 'btn-enviar-imagen';
    btnEnviarImagen.className = 'btn-primary';
    btnEnviarImagen.textContent = '📤 Enviar imagen (participante)';
    btnEnviarImagen.style.display = 'none';
    btnEnviarImagen.style.marginTop = '12px';
    previewContainer?.appendChild(btnEnviarImagen);
  }

  // activar cámara
  btnActivarCamara?.addEventListener('click', async function() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (video) { video.srcObject = stream; video.classList.remove('hidden'); video.play(); }
      btnActivarCamara.classList.add('hidden');
      btnTomarFoto?.classList.remove('hidden');
      document.getElementById('camera-placeholder')?.classList?.add('hidden');
    } catch (err) {
      alert('No se pudo acceder a la cámara. Podés subir una imagen desde tu dispositivo.');
      console.error('Error getUserMedia:', err);
    }
  });

  // tomar foto desde cámara
  btnTomarFoto?.addEventListener('click', function() {
    try {
      if (!canvas || !video) throw new Error('No hay canvas o video disponible');
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0,0,canvas.width,canvas.height);
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      imagenCapturada = canvas.toDataURL('image/jpeg', 0.9);
      if (previewImg) { previewImg.src = imagenCapturada; previewImg.style.opacity = '1'; }
      previewContainer?.classList.remove('hidden');
      video.classList.add('hidden');
      canvas.classList.remove('hidden');

      if (btnEnviarImagen) { btnEnviarImagen.style.display = 'block'; btnEnviarImagen.disabled = false; }
      // no mostramos resultado de Render al participante
      if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
      console.log('✅ Foto tomada correctamente (participante)');
    } catch (err) {
      console.error('Error al tomar foto:', err);
      alert('No se pudo tomar la foto. Intentá subir una imagen.');
    }
  });

  // subir imagen desde archivo
  btnSubirImagen?.addEventListener('click', () => {
    if (inputImagen) { inputImagen.value = ''; inputImagen.click(); }
  });

  inputImagen?.addEventListener('change', function(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Por favor subí un archivo de imagen válido.'); return; }

    if (previewContainer) previewContainer.classList.remove('hidden');
    if (previewImg) { previewImg.src = ''; previewImg.alt = 'Cargando imagen...'; previewImg.style.opacity = '0.5'; }

    const reader = new FileReader();
    reader.onload = function(ev) {
      const img = new Image();
      img.onload = function() {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0,0,canvas.width,canvas.height);
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        imagenCapturada = canvas.toDataURL('image/jpeg', 0.9);
        if (previewImg) { previewImg.src = imagenCapturada; previewImg.alt = 'Imagen cargada'; previewImg.style.opacity = '1'; }
        previewContainer?.classList.remove('hidden');
        if (video) video.classList.add('hidden');
        canvas.classList.remove('hidden');

        if (btnEnviarImagen) { btnEnviarImagen.style.display = 'block'; btnEnviarImagen.disabled = false; }
      };
      img.onerror = function() { alert('Error cargando la imagen. Probá con otra.'); if (previewImg) previewImg.style.opacity = '1'; };
      img.src = ev.target.result;
    };
    reader.onerror = function() { alert('Error leyendo el archivo. Intentá nuevamente.'); if (previewImg) previewImg.style.opacity = '1'; };
    reader.readAsDataURL(file);
  });

  // cuando el participante envía la imagen: guarda en Google Sheets y muestra agradecimiento
btnEnviarImagen?.addEventListener('click', async () => {
  if (!imagenCapturada) { 
    alert('No hay imagen para enviar'); 
    return; 
  }

  btnEnviarImagen.disabled = true;
  btnEnviarImagen.textContent = '⏳ Enviando...';

  try {
    const persona = JSON.parse(sessionStorage.getItem('datos_personales') || '{}');
    const sd3 = JSON.parse(sessionStorage.getItem('resultadosSD3') || '{}');

    const datos = {
      nombre: persona.nombre || "",
      edad: persona.edad || "",
      genero: persona.genero || "",
      pais: persona.pais || "",
      mach: sd3.mach || "",
      narc: sd3.narc || "",
      psych: sd3.psych || "",
      tiempo_total_seg: sd3.tiempo_total_segundos || "",
      emocion_princ: "", 
      images: {
        imagen_base64: imagenCapturada,
        timestamp: new Date().toISOString()
      }
    };

    const payload = {
      action: "guardar",
      data: datos
    };

  await enviarResultadosAGoogleSheets(payload);

    mostrarConfirmacionParticipante();

  } catch (err) {
    console.error("Error enviando imagen participante:", err);
    alert("Error al enviar la imagen. Intentá nuevamente.");
    btnEnviarImagen.disabled = false;
    btnEnviarImagen.textContent = "📤 Enviar imagen (participante)";
  }
});

   } 

   

/* ---------- ANALIZAR EN RENDER (INVESTIGADOR) ---------- */
/*
  Esta función se llamará desde el panel del investigador, con la imagen del participante.
  - Solo el investigador puede iniciar este análisis.
  - Actualiza participantesData y guarda resultados en Google Sheets.
*/
async function analizarEnRenderParaInvestigador(participanteId) {
  const participante = participantesData.find(p => p.id === participanteId);
  const resultadoDiv = document.getElementById('resultado-micro');
  if (!participante || !participante.imagen) {
    alert('No hay imagen disponible para este participante.');
    return;
  }
  if (!resultadoDiv) return;
  resultadoDiv.innerHTML = `<div class="analisis-loading">🧠 Analizando en servidor (Render)...</div>`;
  resultadoDiv.classList.remove('hidden');

  try {
    const blob = dataURLtoBlob(participante.imagen);
    const formData = new FormData();
    formData.append('img', blob, 'foto.jpg');

    console.log('📤 Investigador -> Enviando a Render:', RENDER_PREDICT_URL);
    const res = await fetch(RENDER_PREDICT_URL, { method:'POST', body: formData });
    if (!res.ok) {
      const texto = await res.text().catch(()=>'(sin texto)');
      throw new Error(`Render error ${res.status}: ${texto}`);
    }
    const json = await res.json();
    console.log('✅ Respuesta Render (investigador):', json);

    const resultadosMicro = {
      emociones: json.emociones || {},
      emocion_dominante: json.emocion_dominante || json.dominante || 'Desconocida',
      confianza: json.confianza || json.confidence || 0,
      facs: json.facs || [],
      sd3_micro: json.sd3 || {}
    };

    // actualizar participante en memoria
    participante.microexpresiones = resultadosMicro;
    // enviar registro de análisis a Google Sheets
    try {
      await enviarResultadosAGoogleSheets({ tipo:'analisis_investigador', timestamp:new Date().toISOString(), participante_id: participanteId, microexpresiones: resultadosMicro });
    } catch(e) { console.warn('No se pudo guardar análisis en Google Sheets:', e); }

    // refrescar UI investigadora
    mostrarMicroexpresionesInvestigador(resultadosMicro);
    mostrarFACSInvestigador(resultadosMicro);
    mostrarAnalisisIntegradoInvestigador(participante);
    resultadoDiv.innerHTML = `<div class="resultado-box" style="text-align:center;"><h4>✅ Análisis completado</h4><p>Resultados guardados y mostrados arriba.</p></div>`;
  } catch (err) {
    console.error('❌ Error al analizar en Render (investigador):', err);
    resultadoDiv.innerHTML = `
      <div class="resultado-box" style="border-color: #ff6384;">
        <h4>❌ Error en el análisis</h4>
        <p>${err.message}</p>
        <p style="font-size:0.9em; color:#ff6384;">
          ${err.message.includes('Render') ? 'Verificá que el servicio de Render esté activo.' : 'Intentá nuevamente.'}
        </p>
      </div>
    `;
  }
}

/* ---------- Mostrar confirmación (participante) ---------- */
function mostrarConfirmacionParticipante() {
  const resultadoDiv = document.getElementById('resultado-micro');
  if (!resultadoDiv) return;
  resultadoDiv.classList.remove('hidden');
  resultadoDiv.innerHTML = `
    <div class="confirmacion-final" style="text-align:center; padding:30px;">
      <h3 style="color: var(--accent);">¡Gracias por participar!</h3>
      <p style="margin:15px 0;">Tu imagen y tus respuestas han sido registradas correctamente para la investigación.</p>
      <div style="margin:20px 0;">
        <img src="${imagenCapturada || ''}" alt="Imagen subida" style="max-width:300px; border-radius:10px; border:2px solid var(--border);">
      </div>
      <div style="margin-top:20px; display:flex; gap:15px; justify-content:center; flex-wrap:wrap;">
        <button class="btn-primary" onclick="volverAlInicio()">🏠 Volver al inicio</button>
        <button class="btn-secondary" onclick="location.reload()">🔄 Nueva participación</button>
      </div>
    </div>
  `;
}

/* ---------- Volver / reset ---------- */
function volverAlInicio() {
  sessionStorage.clear();
  imagenCapturada = null;
  tiemposRespuesta = {};
  tiempoInicioItem = {};
  testInicioTimestamp = null;
  participanteSeleccionado = null;
  if (stream) { stream.getTracks().forEach(t=>t.stop()); stream = null; }
  document.getElementById('seccion-micro')?.classList.add('hidden');
  document.getElementById('seccion-bienvenida')?.classList.add('hidden');
  document.getElementById('seccion-test')?.classList.add('hidden');
  document.getElementById('pagina-inicio')?.classList.remove('hidden');
  window._capturaInicializada = false;
  window.scrollTo({ top:0, behavior:'smooth' });
}

/* ---------- PANEL INVESTIGADOR: cargar participantes ---------- */
async function cargarDatosParticipantes() {
  const listaDiv = document.getElementById('lista-participantes');
  if (listaDiv) listaDiv.innerHTML = '<p style="text-align:center; color:var(--text-secondary);">📡 Cargando datos desde Google Sheets...</p>';
  try {
    const resp = await fetch(GOOGLE_SHEETS_WEBAPP_URL + '?action=getAll');
    const text = await resp.text();
    const data = safeJsonParse(text) || safeJsonParse(JSON.stringify(text)) || null;
    // intentar con resp.json() si parece JSON válido
    let parsed = null;
    try { parsed = await resp.json(); } catch(e) { parsed = data; }
    if (parsed && parsed.participantes && Array.isArray(parsed.participantes)) {
      participantesData = parsed.participantes;
    } else if (Array.isArray(parsed)) {
      participantesData = parsed;
    } else {
      throw new Error('Formato de respuesta inesperado');
    }
  } catch (err) {
    console.warn('No se pudieron cargar participantes desde Google Sheets, usando demo:', err);
    participantesData = generarDatosEjemplo();
  }
  poblarListaInvestigador();
}

function generarDatosEjemplo() {
  return [{
    id: 1,
    timestamp: new Date().toISOString(),
    persona: { nombre: 'Participante Demo 1', edad:28, genero:'masculino', pais:'Argentina' },
    sd3: { mach:3.2, narc:2.8, psych:2.5, respuestas:{}, tiempos_respuesta:{}, tiempo_total_ms:420000, estadisticas_tiempo:{ promedio_segundos:'8.50', mediana_segundos:'7.20', minimo_segundos:'2.10', maximo_segundos:'18.50', desviacion_estandar_segundos:'3.40' } },
    microexpresiones: { emociones:{ Felicidad:0.45, Neutral:0.30 }, emocion_dominante:'Felicidad', confianza:0.85, facs:[] },
    imagen: null
  }];
}

function poblarListaInvestigador() {
  const listaDiv = document.getElementById('lista-participantes');
  if (!listaDiv) return;
  if (!participantesData || participantesData.length === 0) {
    listaDiv.innerHTML = '<p style="text-align:center; color:var(--text-secondary);">No hay participantes registrados aún.</p>'; return;
  }
  listaDiv.innerHTML = '';
  participantesData.forEach((p, idx) => {
    const fecha = new Date(p.timestamp).toLocaleString('es-AR');
    const item = document.createElement('div');
    item.className = 'content-box';
    item.style.margin = '10px';
    item.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
        <div>
          <strong>${p.persona?.nombre || 'Sin nombre'}</strong>
          <div style="color:var(--text-secondary); font-size:0.9em;">${fecha}</div>
        </div>
        <div style="display:flex; gap:10px;">
          <button class="btn-primary btn-ver" data-index="${idx}">Ver Resultados</button>
          <button class="btn-secondary btn-export" data-index="${idx}">Exportar</button>
        </div>
      </div>
    `;
    listaDiv.appendChild(item);
  });

  document.querySelectorAll('#lista-participantes .btn-ver').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.getAttribute('data-index'));
      mostrarParticipanteEnPanel(idx);
    });
  });
  document.querySelectorAll('#lista-participantes .btn-export').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.getAttribute('data-index'));
      exportarParticipanteJson(idx);
    });
  });
}

function exportarParticipanteJson(idx) {
  const p = participantesData[idx];
  if (!p) return;
  const dataStr = JSON.stringify(p, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `participante_${p.id || idx}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function mostrarParticipanteEnPanel(idx) {
  participanteSeleccionado = participantesData[idx];
  if (!participanteSeleccionado) return;
  document.getElementById('seccion-investigador')?.classList.add('hidden');
  document.getElementById('seccion-resultados')?.classList.remove('hidden');
  mostrarInfoBasicaInvestigador(participanteSeleccionado);
  mostrarResultadosSD3Investigador(participanteSeleccionado.sd3);
  mostrarTiemposReaccionInvestigador(participanteSeleccionado.sd3);
  mostrarMicroexpresionesInvestigador(participanteSeleccionado.microexpresiones);
  mostrarFACSInvestigador(participanteSeleccionado.microexpresiones);
  mostrarAnalisisIntegradoInvestigador(participanteSeleccionado);
  mostrarImagenInvestigador(participanteSeleccionado);
  window.scrollTo({ top:0, behavior:'smooth' });
}

/* ---------- Funciones UI del panel investigador (mismos bloques que ya tenías) ---------- */
function mostrarInfoBasicaInvestigador(p) {
  const div = document.getElementById('info-participante'); if (!div) return;
  const persona = p.persona || {};
  const fecha = new Date(p.timestamp).toLocaleString('es-AR');
  div.innerHTML = `
    <div class="info-grid">
      <div class="info-item"><strong>Nombre:</strong><p>${persona.nombre || 'N/A'}</p></div>
      <div class="info-item"><strong>Edad:</strong><p>${persona.edad || 'N/A'} años</p></div>
      <div class="info-item"><strong>Género:</strong><p>${persona.genero || 'N/A'}</p></div>
      <div class="info-item"><strong>País:</strong><p>${persona.pais || 'N/A'}</p></div>
      <div class="info-item"><strong>Fecha y hora:</strong><p>${fecha}</p></div>
      <div class="info-item"><strong>ID:</strong><p>#${p.id || 'N/A'}</p></div>
    </div>
  `;
}

function mostrarResultadosSD3Investigador(sd3) {
  const div = document.getElementById('resultados-sd3-detalle'); if (!div) return;
  if (!sd3) { div.innerHTML = '<p>No hay datos SD3 disponibles.</p>'; return; }
  const interpretarNivel = (valor) => { if (valor <= 2.4) return { nivel:'Bajo', color:'#4CAF50' }; if (valor <= 3.4) return { nivel:'Medio', color:'#ffce56' }; return { nivel:'Alto', color:'#ff6384' }; };
  const mach = interpretarNivel(sd3.mach || 0), narc = interpretarNivel(sd3.narc || 0), psych = interpretarNivel(sd3.psych || 0);
  div.innerHTML = `
    <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(250px,1fr)); gap:20px;">
      <div style="padding:20px; background:rgba(255,99,132,0.1); border:2px solid #ff6384; border-radius:10px;">
        <h4 style="color:#ff6384;">🎭 Maquiavelismo</h4>
        <p style="font-size:2.5em; font-weight:bold; color:${mach.color};">${sd3.mach ?? 'N/A'}</p>
        <p style="color:var(--text-secondary);">Nivel: <strong style="color:${mach.color};">${mach.nivel}</strong></p>
      </div>
      <div style="padding:20px; background:rgba(54,162,235,0.1); border:2px solid #36a2eb; border-radius:10px;">
        <h4 style="color:#36a2eb;">👑 Narcisismo</h4>
        <p style="font-size:2.5em; font-weight:bold; color:${narc.color};">${sd3.narc ?? 'N/A'}</p>
        <p style="color:var(--text-secondary);">Nivel: <strong style="color:${narc.color};">${narc.nivel}</strong></p>
      </div>
      <div style="padding:20px; background:rgba(255,206,86,0.1); border:2px solid #ffce56; border-radius:10px;">
        <h4 style="color:#ffce56;">⚡ Psicopatía</h4>
        <p style="font-size:2.5em; font-weight:bold; color:${psych.color};">${sd3.psych ?? 'N/A'}</p>
        <p style="color:var(--text-secondary);">Nivel: <strong style="color:${psych.color};">${psych.nivel}</strong></p>
      </div>
    </div>
  `;
  setTimeout(() => {
    const canvas = document.getElementById('grafico-sd3-resultados'); if (!canvas) return;
    try { const old = Chart.getChart(canvas); if (old) old.destroy(); } catch(e){}
    new Chart(canvas, {
      type:'radar',
      data:{ labels:['Maquiavelismo','Narcisismo','Psicopatía'], datasets:[{ label:'Perfil', data:[sd3.mach||0, sd3.narc||0, sd3.psych||0], backgroundColor:'rgba(127,0,255,0.15)', borderColor:'#7f00ff', borderWidth:2, pointRadius:5 }] },
      options:{ responsive:true, scales:{ r:{ min:1, max:5, ticks:{ stepSize:1 } } } }
    });
  }, 100);
}

function mostrarTiemposReaccionInvestigador(sd3) {
  const div = document.getElementById('tiempos-detalle'); if (!div) return;
  if (!sd3 || !sd3.estadisticas_tiempo) { div.innerHTML = '<p>No hay datos de tiempos disponibles.</p>'; return; }
  const stats = sd3.estadisticas_tiempo;
  div.innerHTML = `
    <div class="stats-mini">
      <div class="stat-mini"><div class="stat-mini-label">Tiempo Total</div><div class="stat-mini-value">${((sd3.tiempo_total_ms||0)/1000/60).toFixed(1)} min</div></div>
      <div class="stat-mini"><div class="stat-mini-label">Promedio</div><div class="stat-mini-value">${stats.promedio_segundos}s</div></div>
      <div class="stat-mini"><div class="stat-mini-label">Mediana</div><div class="stat-mini-value">${stats.mediana_segundos}s</div></div>
      <div class="stat-mini"><div class="stat-mini-label">Mínimo</div><div class="stat-mini-value">${stats.minimo_segundos}s</div></div>
      <div class="stat-mini"><div class="stat-mini-label">Máximo</div><div class="stat-mini-value">${stats.maximo_segundos}s</div></div>
      <div class="stat-mini"><div class="stat-mini-label">Desv. estándar</div><div class="stat-mini-value">${stats.desviacion_estandar_segundos}s</div></div>
    </div>
  `;
  if (sd3.tiempos_respuesta && Object.keys(sd3.tiempos_respuesta).length>0) {
    setTimeout(()=> {
      const tiempos = sd3.tiempos_respuesta;
      const items = Object.keys(tiempos).map(k=>parseInt(k)).sort((a,b)=>a-b);
      const valores = items.map(i => parseFloat(tiempos[i].tiempo_segundos));
      const canvas = document.getElementById('grafico-tiempos'); if (!canvas) return;
      try { const old = Chart.getChart(canvas); if (old) old.destroy(); } catch(e){}
      new Chart(canvas, { type:'line', data:{ labels: items, datasets:[{ label:'Tiempo (segundos)', data: valores, borderColor:'#667eea', backgroundColor:'rgba(102,126,234,0.12)', fill:true }] }, options:{ responsive:true } });
    }, 100);
  }
}

function mostrarMicroexpresionesInvestigador(micro) {
  const div = document.getElementById('microexpresiones-detalle'); if (!div) return;
  if (!micro || !micro.emociones) { div.innerHTML = '<p>No hay datos de microexpresiones.</p>'; return; }
  const dominante = micro.emocion_dominante || 'Desconocida';
  const confianza = (micro.confianza || 0) * 100;
  div.innerHTML = `
    <div style="text-align:center; margin-bottom:20px; padding:20px; border-radius:12px;">
      <h4 style="color:#c080ff;">Emoción dominante</h4>
      <p style="font-size:1.6em; color:#7f00ff; font-weight:700;">${dominante}</p>
      <p style="color:var(--text-secondary);">Confianza: ${confianza.toFixed(1)}%</p>
    </div>
    <h4 style="text-align:center; margin-bottom:12px;">Distribución de emociones</h4>
  `;
  const emociones = Object.entries(micro.emociones).sort((a,b)=>b[1]-a[1]);
  emociones.forEach(([emocion, valor]) => {
    const percentage = (valor*100).toFixed(1);
    div.innerHTML += `
      <div class="emotion-bar"><div class="emotion-label"><strong>${emocion}</strong><span>${percentage}%</span></div>
      <div class="bar-container"><div class="bar-fill" style="width:${percentage}%">${percentage}%</div></div></div>
    `;
  });
  setTimeout(()=> {
    const canvas = document.getElementById('grafico-emociones'); if (!canvas) return;
    try { const old = Chart.getChart(canvas); if (old) old.destroy(); } catch(e){}
    new Chart(canvas, { type:'doughnut', data:{ labels:Object.keys(micro.emociones), datasets:[{ data:Object.values(micro.emociones).map(v=> (v*100).toFixed(1)), backgroundColor:['#ff6384','#36a2eb','#ffce56','#4bc0c0','#9966ff','#ff9f40'] }] }, options:{ responsive:true } });
  }, 120);
}

function mostrarFACSInvestigador(micro) {
  const div = document.getElementById('facs-detalle'); if (!div) return;
  if (!micro || !micro.facs || micro.facs.length===0) { div.innerHTML = '<p>No se detectaron unidades FACS.</p>'; return; }
  div.innerHTML = '<div style="display:grid; gap:12px;">';
  micro.facs.forEach(au => {
    div.innerHTML += `<div class="info-item"><h4 style="margin:0 0 6px 0;">${au.nombre || au.codigo}</h4><p style="color:#888; margin:0 0 6px 0;"><strong>Código:</strong> ${au.codigo}</p><p style="margin:0;">${au.descripcion || ''}</p></div>`;
  });
  div.innerHTML += '</div>';
}

function mostrarAnalisisIntegradoInvestigador(p) {
  const div = document.getElementById('analisis-final'); if (!div) return;
  const sd3 = p.sd3 || {}; const micro = p.microexpresiones || {};
  const nivel = v => v>3.4 ? 'alto' : v>2.4 ? 'medio' : 'bajo';
  div.innerHTML = `
    <p><strong>Perfil de Personalidad:</strong> Maquiavelismo <strong>${nivel(sd3.mach||0)}</strong>, Narcisismo <strong>${nivel(sd3.narc||0)}</strong>, Psicopatía <strong>${nivel(sd3.psych||0)}</strong>.</p>
    <p><strong>Expresión Emocional:</strong> ${micro.emocion_dominante || 'no determinada'} (confianza ${(micro.confianza||0)*100}%).</p>
    <p><strong>Tiempo de Respuesta:</strong> ${((sd3.tiempo_total_ms||0)/1000/60).toFixed(1)} min, promedio ${sd3.estadisticas_tiempo?.promedio_segundos || 'N/A'}s por ítem.</p>
  `;
}

function mostrarImagenInvestigador(p) {
  const div = document.getElementById('imagen-participante'); if (!div) return;
  if (p.imagen) {
    // incluimos botón "Analizar en Render" visible solo para investigador
    div.innerHTML = `
      <div style="text-align:center;">
        <img id="imagen-investigador-display" src="${p.imagen}" alt="Foto participante" style="max-width:100%; max-height:500px; border-radius:10px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
        <div style="margin-top:15px;">
          <button id="btn-analizar-render" class="btn-primary">🔬 Analizar en Render (investigador)</button>
        </div>
      </div>
    `;
    // bindear el click
    setTimeout(()=> {
      const btnAnalizar = document.getElementById('btn-analizar-render');
      if (btnAnalizar) btnAnalizar.addEventListener('click', () => {
        if (!p.id) { alert('Participante sin ID, no se puede analizar.'); return; }
        analizarEnRenderParaInvestigador(p.id);
      });
    }, 50);
  } else {
    div.innerHTML = '<p>No hay imagen disponible.</p>';
  }
}

/* ---------- INICIALIZACIÓN GLOBAL ---------- */
document.addEventListener('DOMContentLoaded', () => {
  // Limpiar sesión al inicio (seguridad/consistencia)
  sessionStorage.clear();
  imagenCapturada = null;
  tiemposRespuesta = {};
  tiempoInicioItem = {};
  testInicioTimestamp = null;
  window._capturaInicializada = false;
  console.log('✅ Sesión limpiada al cargar la página');

  // botones inicio (evitar duplicados)
  const btnParticipante = document.querySelector('#card-participante .btn-primary');
  const btnInvestigador = document.querySelector('#card-investigador .btn-primary');

  btnParticipante?.addEventListener('click', () => {
    sessionStorage.clear();
    imagenCapturada = null;
    tiemposRespuesta = {};
    tiempoInicioItem = {};
    testInicioTimestamp = null;
    document.getElementById('pagina-inicio')?.classList.add('hidden');
    document.getElementById('seccion-bienvenida')?.classList.remove('hidden');
    const fd = document.getElementById('form-datos-basicos'); if (fd) fd.reset();
    window.scrollTo({ top:0, behavior:'smooth' });
  });

  btnInvestigador?.addEventListener('click', () => {
    document.getElementById('pagina-inicio')?.classList.add('hidden');
    document.getElementById('seccion-login')?.classList.remove('hidden');
    window.scrollTo({ top:0, behavior:'smooth' });
  });

  // form datos -> iniciar test
  const formDatos = document.getElementById('form-datos-basicos');
  formDatos?.addEventListener('submit', (e) => {
    e.preventDefault();
    const consentimiento = formDatos.querySelector('input[name="consentimiento"]');
    if (!consentimiento || !consentimiento.checked) { alert('Debés aceptar el consentimiento para continuar.'); return; }
    const nombre = formDatos.querySelector('input[name="nombre"]').value.trim();
    const edad = formDatos.querySelector('input[name="edad"]').value;
    const genero = formDatos.querySelector('select[name="genero"]').value;
    const pais = formDatos.querySelector('input[name="pais"]').value.trim();
    if (!nombre || !edad || !genero || !pais) { alert('Completá todos los datos personales requeridos.'); return; }
    sessionStorage.setItem('datos_personales', JSON.stringify({ nombre, edad, genero, pais }));
    testInicioTimestamp = Date.now();
    generarItemsTest();
    setTimeout(() => configurarTrackingTiempos(), 50);
    document.getElementById('seccion-bienvenida')?.classList.add('hidden');
    document.getElementById('seccion-test')?.classList.remove('hidden');
    window.scrollTo({ top:0, behavior:'smooth' });
  });

  // submit SD3
  const formSD3 = document.getElementById('form-sd3');
  formSD3?.addEventListener('submit', (e) => { e.preventDefault(); calcularSD3(); });

  // login investigador
  const btnLoginInv = document.getElementById('btn-login-investigador');
  const inputPasswordInv = document.getElementById('password-investigador');
  btnLoginInv?.addEventListener('click', () => {
    const pw = inputPasswordInv?.value?.trim() || '';
    if (pw === PASSWORD_INVESTIGADOR) {
      document.getElementById('seccion-login')?.classList.add('hidden');
      document.getElementById('seccion-investigador')?.classList.remove('hidden');
      cargarDatosParticipantes();
      window.scrollTo({ top:0, behavior:'smooth' });
    } else { alert('❌ Contraseña incorrecta'); if (inputPasswordInv) inputPasswordInv.value = ''; }
  });

  // navegación botones volver
  document.getElementById('btn-volver-inicio-2')?.addEventListener('click', () => {
    document.getElementById('seccion-login')?.classList.add('hidden');
    document.getElementById('pagina-inicio')?.classList.remove('hidden');
    window.scrollTo({ top:0, behavior:'smooth' });
  });
  document.getElementById('btn-volver-login')?.addEventListener('click', () => {
    document.getElementById('seccion-investigador')?.classList.add('hidden');
    document.getElementById('seccion-login')?.classList.remove('hidden');
    window.scrollTo({ top:0, behavior:'smooth' });
  });
  document.getElementById('btn-volver-panel')?.addEventListener('click', () => {
    document.getElementById('seccion-resultados')?.classList.add('hidden');
    document.getElementById('seccion-investigador')?.classList.remove('hidden');
    window.scrollTo({ top:0, behavior:'smooth' });
     
  });
   
}); // ← Cierra DOMContentLoaded

/* ---------- FIN ---------- */


