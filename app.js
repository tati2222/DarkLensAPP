/* ========================================
   app.js - VERSIÓN COMPLETA CON ANÁLISIS AUTOMÁTICO
   ======================================== */

/* ---------- CONFIG ---------- */
const GOOGLE_SHEETS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbwuW_DKiakk0um7AtUnMYaETUUqnJqdwAFa-8plROIVKWwdcTOEqDocDHxealU8sA1BFQ/exec";
const FASTAPI_URL = "https://darklnesapp-api-1.onrender.com"; // URL de tu FastAPI
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

/* ---------- UTILIDADES ---------- */
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

/* ---------- ANALIZAR MICROEXPRESIONES CON FASTAPI - CORREGIDO ---------- */
async function analizarMicroexpresiones(imagenBase64) {
  if (!imagenBase64 || imagenBase64 === 'null') {
    return { 
      emociones: [], 
      emocion_principal: 'Sin imagen',
      confianza: 0,
      error: 'No hay imagen para analizar' 
    };
  }

  try {
    console.log('🔬 Enviando imagen para análisis de microexpresiones...');
    
    // Convertir base64 a Blob
    const base64Response = await fetch(imagenBase64);
    const blob = await base64Response.blob();
    
    // Crear FormData (como espera tu FastAPI)
    const formData = new FormData();
    formData.append('file', blob, 'foto.jpg');
    
    // URL correcta con endpoint
    const FASTAPI_PREDICT_URL = "https://darklnesapp-api-1.onrender.com/run/predict";
    console.log('📤 Enviando a FastAPI:', FASTAPI_PREDICT_URL);
    
    const response = await fetch(FASTAPI_PREDICT_URL, {
      method: 'POST',
      body: formData
      // NO incluir Content-Type header - FormData lo establece automáticamente
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error HTTP ${response.status}: ${errorText}`);
    }

    const resultado = await response.json();
    console.log('✅ Análisis de microexpresiones completado:', resultado);
    
    // Adaptar respuesta de tu FastAPI al formato que espera tu frontend
    const emocionesArray = Object.entries(resultado.emociones || {}).map(([emocion, score]) => ({
      emocion,
      score: parseFloat(score)
    }));
    
    // Encontrar emoción principal
    let emocionPrincipal = { emocion: 'Neutral', score: 0 };
    if (emocionesArray.length > 0) {
      emocionPrincipal = emocionesArray.reduce((max, emocion) => 
        emocion.score > max.score ? emocion : max, emocionesArray[0]
      );
    }
    
    return {
      emociones: emocionesArray,
      emocion_principal: emocionPrincipal.emocion,
      confianza: emocionPrincipal.score,
      sd3: resultado.sd3 || {},
      status: resultado.status || 'success'
    };
    
  } catch (error) {
    console.error('❌ Error analizando microexpresiones:', error);
    return { 
      emociones: [], 
      emocion_principal: 'Error en análisis',
      confianza: 0,
      error: error.message,
      sd3: {}
    };
  }
}  
/* ---------- SD3 ITEMS ---------- */
const itemsSD3 = [
  "No es prudente contar tus secretos.",
  "Me gusta usar manipulaciones ingeniosas para salirme con la mía.",
  "Hagas lo que hagas, debes conseguir que las personas importantes estén de tu lado.",
  "Evito el conflicto directo con los demás porque pueden serme útiles en el futuro.",
  "Es sabio guardar información que puedas usar en contra de otras personas más adelante.",
  "Debes esperar el momento oportuno para vengarme de las personas.",
  "Hay cosas que deberías ocultar a los demás porque no necesitan saberlas.",
  "Asegúrate de que tus planes te beneficien a ti, not a los demás.",
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

/* ---------- TRACKING TIEMPOS ---------- */
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

  const resultadosSD3 = { 
    mach, narc, psych, 
    respuestas: respuestasObj, 
    tiempos_respuesta: tiemposRespuesta, 
    tiempo_total_ms: tiempoTotal, 
    tiempo_total_segundos: (tiempoTotal/1000).toFixed(2), 
    estadisticas_tiempo: estadisticasTiempo 
  };
  
  sessionStorage.setItem('resultadosSD3', JSON.stringify(resultadosSD3));

  document.getElementById('seccion-test')?.classList.add('hidden');
  document.getElementById('seccion-micro')?.classList.remove('hidden');
  if (!window._capturaInicializada) { 
    configurarCamaraYSubida(); 
    window._capturaInicializada = true; 
  }
  window.scrollTo({ top:0, behavior:'smooth' });
}

/* ---------- ENVIAR A GOOGLE SHEETS ---------- */
async function enviarResultadosAGoogleSheets(datos) {
  console.log("📤 Enviando datos a Google Sheets:", {
    ...datos,
    imagen_base64: datos.imagen_base64 ? `[IMAGEN: ${datos.imagen_base64.length} caracteres]` : 'No image'
  });

  try {
    const response = await fetch(GOOGLE_SHEETS_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos)
    });

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }

    const result = await response.json();
    console.log("✅ Respuesta de Google Sheets:", result);
    return result;

  } catch (err) {
    console.error("❌ Error enviando a Sheets:", err);
    throw new Error(`No se pudo conectar con Google Sheets: ${err.message}`);
  }
}

/* ---------- CÁMARA Y CAPTURA CON ANÁLISIS AUTOMÁTICO ---------- */
function configurarCamaraYSubida() {
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const btnActivarCamara = document.getElementById('btn-activar-camara');
  const btnTomarFoto = document.getElementById('btn-tomar-foto');
  const btnSubirImagen = document.getElementById('btn-subir-imagen');
  const inputImagen = document.getElementById('input-imagen');
  const previewContainer = document.getElementById('preview-container');
  const previewImg = document.getElementById('preview-img');

  // Crear botón de enviar si no existe
  let btnEnviarImagen = document.getElementById('btn-enviar-imagen');
  if (!btnEnviarImagen) {
    btnEnviarImagen = document.createElement('button');
    btnEnviarImagen.id = 'btn-enviar-imagen';
    btnEnviarImagen.className = 'btn-primary';
    btnEnviarImagen.textContent = '📤 Analizar y Enviar';
    btnEnviarImagen.style.display = 'none';
    btnEnviarImagen.style.marginTop = '12px';
    previewContainer?.appendChild(btnEnviarImagen);
  }

  // Activar cámara
  btnActivarCamara?.addEventListener('click', async function() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } 
      });
      if (video) { 
        video.srcObject = stream; 
        video.classList.remove('hidden'); 
        video.play(); 
      }
      btnActivarCamara.classList.add('hidden');
      btnTomarFoto?.classList.remove('hidden');
      document.getElementById('camera-placeholder')?.classList?.add('hidden');
    } catch (err) {
      alert('No se pudo acceder a la cámara. Podés subir una imagen desde tu dispositivo.');
      console.error('Error cámara:', err);
    }
  });

  // Tomar foto
  btnTomarFoto?.addEventListener('click', function() {
    try {
      if (!canvas || !video) return;
      const ctx = canvas.getContext('2d');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      imagenCapturada = canvas.toDataURL('image/jpeg', 0.8);
      
      if (previewImg) { 
        previewImg.src = imagenCapturada; 
        previewImg.style.opacity = '1'; 
      }
      previewContainer?.classList.remove('hidden');
      
      // Detener cámara
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
        video.classList.add('hidden');
      }
      canvas.classList.remove('hidden');

      // Mostrar botón enviar
      if (btnEnviarImagen) { 
        btnEnviarImagen.style.display = 'block'; 
        btnEnviarImagen.disabled = false; 
      }
      
    } catch (err) {
      console.error('Error al tomar foto:', err);
      alert('Error al tomar foto. Intentá subir una imagen.');
    }
  });

  // Subir imagen
  btnSubirImagen?.addEventListener('click', () => {
    inputImagen?.click();
  });

  inputImagen?.addEventListener('change', function(e) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      alert('Por favor subí un archivo de imagen válido.');
      return;
    }

    const reader = new FileReader();
    reader.onload = function(ev) {
      imagenCapturada = ev.target.result;
      
      if (previewImg) { 
        previewImg.src = imagenCapturada; 
        previewImg.style.opacity = '1'; 
      }
      previewContainer?.classList.remove('hidden');
      
      if (btnEnviarImagen) { 
        btnEnviarImagen.style.display = 'block'; 
        btnEnviarImagen.disabled = false; 
      }
    };
    reader.readAsDataURL(file);
  });

  // Enviar datos finales CON ANÁLISIS AUTOMÁTICO
btnEnviarImagen?.addEventListener('click', async () => {
  if (!imagenCapturada) { 
    alert('No hay imagen para enviar'); 
    return; 
  }

  btnEnviarImagen.disabled = true;
  btnEnviarImagen.textContent = '⏳ Analizando microexpresiones...';

  try {
    const persona = JSON.parse(sessionStorage.getItem('datos_personales') || '{}');
    const sd3 = JSON.parse(sessionStorage.getItem('resultadosSD3') || '{}');

    // ✅ PASO 1: ANALIZAR MICROEXPRESIONES AUTOMÁTICAMENTE
    console.log('🔬 Iniciando análisis automático de microexpresiones...');
    const analisisMicro = await analizarMicroexpresiones(imagenCapturada);
    
    console.log('📊 Resultado del análisis:', analisisMicro);

  // ✅ PASO 2: PREPARAR DATOS CON ANÁLISIS (VERSIÓN CORREGIDA)
const payload = {
  action: "guardar",
  nombre: persona.nombre || "",
  edad: persona.edad || "",
  genero: persona.genero || "",
  pais: persona.pais || "",
  mach: sd3.mach || "",
  narc: sd3.narc || "",
  psych: sd3.psych || "",
  tiempo_total_seg: sd3.tiempo_total_segundos || "",
  imagen_base64: imagenCapturada,
  emocion_principal: analisisMicro.emocion_principal || 'No detectada',
  emociones_detectadas: JSON.stringify(analisisMicro.emociones || []),
  confianza_analisis: analisisMicro.confianza || 0,
  estado_analisis: analisisMicro.error ? 'Error' : 'Completado',
  // ✅ AGREGAR DATOS SD3 DEL ANÁLISIS DE MICROEXPRESIONES
  sd3_maquiavelismo: analisisMicro.sd3?.Maquiavelismo || 0,
  sd3_narcisismo: analisisMicro.sd3?.Narcisismo || 0,
  sd3_psicopatia: analisisMicro.sd3?.Psicopatía || 0,
  sd3: JSON.stringify(analisisMicro.sd3 || {}), // Objeto completo SD3
  timestamp: new Date().toISOString()
};

      // ✅ PASO 3: ENVIAR A GOOGLE SHEETS
      const resultado = await enviarResultadosAGoogleSheets(payload);
      
      if (resultado.success) {
        console.log('✅ Análisis completado y guardado');
        mostrarConfirmacionParticipante(analisisMicro);
      } else {
        throw new Error(resultado.error || 'Error desconocido');
      }

    } catch (err) {
      console.error("❌ Error en el proceso:", err);
      alert("Error: " + err.message);
      btnEnviarImagen.disabled = false;
      btnEnviarImagen.textContent = "📤 Analizar y Enviar";
    }
  });
}

/* ---------- CONFIRMACIÓN PARTICIPANTE ---------- */
function mostrarConfirmacionParticipante(analisisMicro = null) {
  const resultadoDiv = document.getElementById('resultado-micro');
  if (!resultadoDiv) return;
  
  let analisisHTML = '';
  if (analisisMicro && !analisisMicro.error) {
    analisisHTML = `
      <div style="background: rgba(127, 0, 255, 0.1); padding: 20px; border-radius: 10px; margin: 20px 0; text-align: center;">
        <h4 style="color: var(--accent);">🔍 Análisis de Microexpresiones Completado</h4>
        <p style="font-size: 1.3em; font-weight: bold; color: #7f00ff;">
          Emoción detectada: ${analisisMicro.emocion_principal}
        </p>
        ${analisisMicro.confianza ? `
          <p style="color: var(--text-secondary);">
            <strong>Confianza:</strong> ${(analisisMicro.confianza * 100).toFixed(1)}%
          </p>
        ` : ''}
        <p style="color: var(--text-secondary); margin-top: 10px;">
          Los resultados están disponibles en el panel del investigador
        </p>
      </div>
    `;
  } else if (analisisMicro?.error) {
    analisisHTML = `
      <div style="background: rgba(255, 99, 132, 0.1); padding: 20px; border-radius: 10px; margin: 20px 0; text-align: center;">
        <h4 style="color: #ff6384;">⚠️ Análisis No Disponible</h4>
        <p style="color: var(--text-secondary);">
          El análisis de microexpresiones no pudo completarse, pero tus datos fueron guardados.
        </p>
      </div>
    `;
  }
  
  resultadoDiv.classList.remove('hidden');
  resultadoDiv.innerHTML = `
    <div class="confirmacion-final" style="text-align:center; padding:30px;">
      <h3 style="color: var(--accent);">¡Gracias por participar!</h3>
      <p style="margin:15px 0;">Tu imagen, respuestas y análisis han sido registrados correctamente.</p>
      
      ${analisisHTML}
      
      <div style="margin:20px 0;">
        <img src="${imagenCapturada || ''}" alt="Imagen analizada" style="max-width:300px; border-radius:10px; border:2px solid var(--border);">
      </div>
      <div style="margin-top:20px; display:flex; gap:15px; justify-content:center; flex-wrap:wrap;">
        <button class="btn-primary" onclick="volverAlInicio()">🏠 Volver al inicio</button>
        <button class="btn-secondary" onclick="location.reload()">🔄 Nueva participación</button>
      </div>
    </div>
  `;
}

/* ---------- VOLVER AL INICIO ---------- */
function volverAlInicio() {
  sessionStorage.clear();
  imagenCapturada = null;
  tiemposRespuesta = {};
  tiempoInicioItem = {};
  testInicioTimestamp = null;
  participanteSeleccionado = null;
  if (stream) { 
    stream.getTracks().forEach(t=>t.stop()); 
    stream = null; 
  }
  document.getElementById('seccion-micro')?.classList.add('hidden');
  document.getElementById('seccion-bienvenida')?.classList.add('hidden');
  document.getElementById('seccion-test')?.classList.add('hidden');
  document.getElementById('pagina-inicio')?.classList.remove('hidden');
  window._capturaInicializada = false;
  window.scrollTo({ top:0, behavior:'smooth' });
}

/* ---------- PANEL INVESTIGADOR ---------- */
async function cargarDatosParticipantes() {
  const listaDiv = document.getElementById('lista-participantes');
  if (listaDiv) listaDiv.innerHTML = '<p style="text-align:center; color:var(--text-secondary);">📡 Cargando datos...</p>';
  
  try {
    const resp = await fetch(GOOGLE_SHEETS_WEBAPP_URL + '?action=getAll');
    
    if (!resp.ok) {
      throw new Error(`Error HTTP: ${resp.status}`);
    }
    
    const data = await resp.json();
    console.log("📊 Datos cargados:", data);
    
    if (data.success && Array.isArray(data.participantes)) {
      participantesData = data.participantes;
    } else {
      throw new Error('Formato de datos inesperado');
    }
    
  } catch (err) {
    console.warn('⚠️ No se pudieron cargar participantes:', err);
    // Datos de ejemplo para desarrollo
    participantesData = [{
      id: 'DEMO_001',
      timestamp: new Date().toISOString(),
      nombre: 'Participante Demo',
      edad: '28',
      genero: 'masculino',
      pais: 'Argentina',
      maquiavelismo: '3.2',
      narcisismo: '2.8',
      psicopatía: '2.5',
      tiempo_total_seg: '7.50',
      url_imagen: null,
      emocion_principal: 'Felicidad',
      confianza_analisis: '0.87',
      estado_analisis: 'Completado'
    }];
  }
  
  poblarListaInvestigador();
}

function poblarListaInvestigador() {
  const listaDiv = document.getElementById('lista-participantes');
  if (!listaDiv) return;
  
  if (!participantesData || participantesData.length === 0) {
    listaDiv.innerHTML = '<p style="text-align:center; color:var(--text-secondary);">No hay participantes registrados.</p>';
    return;
  }
  
  listaDiv.innerHTML = '';
  participantesData.forEach((p, idx) => {
    const fecha = new Date(p.timestamp).toLocaleString('es-AR');
    const emocion = p.emocion_principal || 'No analizado';
    const confianza = p.confianza_analisis ? `${(p.confianza_analisis * 100).toFixed(1)}%` : 'N/A';
    
    const item = document.createElement('div');
    item.className = 'content-box';
    item.style.margin = '10px';
    item.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
        <div style="flex: 1;">
          <strong>${p.nombre || 'Sin nombre'}</strong>
          <div style="color:var(--text-secondary); font-size:0.9em;">${fecha}</div>
          <div style="display: flex; gap: 15px; margin-top: 8px; font-size: 0.85em;">
            <span style="color: #667eea;">🎭 ${p.maquiavelismo || 'N/A'}</span>
            <span style="color: #764ba2;">👑 ${p.narcisismo || 'N/A'}</span>
            <span style="color: #ffce56;">⚡ ${p.psicopatía || 'N/A'}</span>
            <span style="color: #7f00ff;">😊 ${emocion}</span>
          </div>
        </div>
        <div style="display:flex; gap:10px;">
          <button class="btn-primary btn-ver" data-index="${idx}">Ver Detalles</button>
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
}

function mostrarParticipanteEnPanel(idx) {
  participanteSeleccionado = participantesData[idx];
  if (!participanteSeleccionado) return;
  
  document.getElementById('seccion-investigador')?.classList.add('hidden');
  document.getElementById('seccion-resultados')?.classList.remove('hidden');
  
  mostrarInfoBasicaInvestigador(participanteSeleccionado);
  mostrarResultadosSD3Investigador(participanteSeleccionado);
  mostrarTiemposReaccionInvestigador(participanteSeleccionado);
  mostrarMicroexpresionesInvestigador(participanteSeleccionado);
  mostrarFACSInvestigador(participanteSeleccionado);
  mostrarAnalisisIntegradoInvestigador(participanteSeleccionado);
  mostrarImagenInvestigador(participanteSeleccionado);
  
  window.scrollTo({ top:0, behavior:'smooth' });
}

/* ---------- UI INVESTIGADOR ---------- */
function mostrarInfoBasicaInvestigador(p) {
  const div = document.getElementById('info-participante');
  if (!div) return;
  const fecha = new Date(p.timestamp).toLocaleString('es-AR');
  div.innerHTML = `
    <div class="info-grid">
      <div class="info-item"><strong>Nombre:</strong><p>${p.nombre || 'N/A'}</p></div>
      <div class="info-item"><strong>Edad:</strong><p>${p.edad || 'N/A'} años</p></div>
      <div class="info-item"><strong>Género:</strong><p>${p.genero || 'N/A'}</p></div>
      <div class="info-item"><strong>País:</strong><p>${p.pais || 'N/A'}</p></div>
      <div class="info-item"><strong>Fecha:</strong><p>${fecha}</p></div>
      <div class="info-item"><strong>ID:</strong><p>#${p.id || 'N/A'}</p></div>
    </div>
  `;
}

function mostrarResultadosSD3Investigador(p) {
  const div = document.getElementById('resultados-sd3-detalle');
  if (!div) return;
  
  const interpretarNivel = (valor) => {
    if (valor <= 2.4) return { nivel:'Bajo', color:'#4CAF50' };
    if (valor <= 3.4) return { nivel:'Medio', color:'#ffce56' };
    return { nivel:'Alto', color:'#ff6384' };
  };
  
  const mach = interpretarNivel(p.maquiavelismo || 0);
  const narc = interpretarNivel(p.narcisismo || 0);
  const psych = interpretarNivel(p.psicopatía || 0);
  
  div.innerHTML = `
    <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(250px,1fr)); gap:20px;">
      <div style="padding:20px; background:rgba(255,99,132,0.1); border:2px solid #ff6384; border-radius:10px;">
        <h4 style="color:#ff6384;">🎭 Maquiavelismo</h4>
        <p style="font-size:2.5em; font-weight:bold; color:${mach.color};">${p.maquiavelismo ?? 'N/A'}</p>
        <p style="color:var(--text-secondary);">Nivel: <strong style="color:${mach.color};">${mach.nivel}</strong></p>
      </div>
      <div style="padding:20px; background:rgba(54,162,235,0.1); border:2px solid #36a2eb; border-radius:10px;">
        <h4 style="color:#36a2eb;">👑 Narcisismo</h4>
        <p style="font-size:2.5em; font-weight:bold; color:${narc.color};">${p.narcisismo ?? 'N/A'}</p>
        <p style="color:var(--text-secondary);">Nivel: <strong style="color:${narc.color};">${narc.nivel}</strong></p>
      </div>
      <div style="padding:20px; background:rgba(255,206,86,0.1); border:2px solid #ffce56; border-radius:10px;">
        <h4 style="color:#ffce56;">⚡ Psicopatía</h4>
        <p style="font-size:2.5em; font-weight:bold; color:${psych.color};">${p.psicopatía ?? 'N/A'}</p>
        <p style="color:var(--text-secondary);">Nivel: <strong style="color:${psych.color};">${psych.nivel}</strong></p>
      </div>
    </div>
  `;
  
  setTimeout(() => {
    const canvas = document.getElementById('grafico-sd3-resultados');
    if (!canvas) return;
    try { const old = Chart.getChart(canvas); if (old) old.destroy(); } catch(e){}
    new Chart(canvas, {
      type:'radar',
      data:{
        labels:['Maquiavelismo','Narcisismo','Psicopatía'],
        datasets:[{
          label:'Perfil',
          data:[p.maquiavelismo||0, p.narcisismo||0, p.psicopatía||0],
          backgroundColor:'rgba(127,0,255,0.15)',
          borderColor:'#7f00ff',
          borderWidth:2,
          pointRadius:5
        }]
      },
      options:{
        responsive:true,
        scales:{ r:{ min:1, max:5, ticks:{ stepSize:1 } } }
      }
    });
  }, 100);
}

function mostrarTiemposReaccionInvestigador(p) {
  const div = document.getElementById('tiempos-detalle');
  if (!div) return;
  div.innerHTML = `
    <div class="stats-mini">
      <div class="stat-mini">
        <div class="stat-mini-label">Tiempo Total</div>
        <div class="stat-mini-value">${p.tiempo_total_seg || 'N/A'}s</div>
      </div>
    </div>
  `;
}

function mostrarMicroexpresionesInvestigador(p) {
  const div = document.getElementById('microexpresiones-detalle');
  if (!div) return;
  
  const emocion = p.emocion_principal || 'No analizado';
  const confianza = p.confianza_analisis ? `${(p.confianza_analisis * 100).toFixed(1)}%` : 'N/A';
  const estado = p.estado_analisis || 'Pendiente';
  
  let estadoColor = '#7f00ff';
  if (estado === 'Error') estadoColor = '#ff6384';
  if (estado === 'Pendiente') estadoColor = '#ffce56';
  
  div.innerHTML = `
    <div style="text-align:center; padding:20px;">
      <h4 style="color:#c080ff;">Análisis de Microexpresiones</h4>
      <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:20px; margin-top:20px;">
        <div style="padding:15px; background:rgba(127,0,255,0.1); border-radius:10px;">
          <div style="font-size:0.9em; color:var(--text-secondary);">Emoción Principal</div>
          <div style="font-size:1.8em; font-weight:bold; color:#7f00ff;">${emocion}</div>
        </div>
        <div style="padding:15px; background:rgba(54,162,235,0.1); border-radius:10px;">
          <div style="font-size:0.9em; color:var(--text-secondary);">Confianza</div>
          <div style="font-size:1.8em; font-weight:bold; color:#36a2eb;">${confianza}</div>
        </div>
        <div style="padding:15px; background:rgba(255,206,86,0.1); border-radius:10px;">
          <div style="font-size:0.9em; color:var(--text-secondary);">Estado</div>
          <div style="font-size:1.8em; font-weight:bold; color:${estadoColor};">${estado}</div>
        </div>
      </div>
    </div>
  `;
}

function mostrarFACSInvestigador(p) {
  const div = document.getElementById('facs-detalle');
  if (!div) return;
  
  // Aquí puedes mostrar las unidades FACS si tu modelo las devuelve
  div.innerHTML = `
    <div style="text-align:center; padding:20px;">
      <h4 style="color:#c080ff;">Sistema FACS</h4>
      <p style="color:var(--text-secondary);">
        Análisis basado en el Facial Action Coding System
      </p>
      ${p.emociones_detectadas && p.emociones_detectadas !== '[]' ? `
        <div style="margin-top:15px;">
          <strong>Emociones detectadas:</strong>
          <p style="color:var(--text-secondary);">${p.emociones_detectadas}</p>
        </div>
      ` : ''}
    </div>
  `;
}

function mostrarAnalisisIntegradoInvestigador(p) {
  const div = document.getElementById('analisis-final');
  if (!div) return;
  
  const nivel = v => v>3.4 ? 'alto' : v>2.4 ? 'medio' : 'bajo';
  const emocion = p.emocion_principal || 'no detectada';
  const confianza = p.confianza_analisis ? `${(p.confianza_analisis * 100).toFixed(1)}%` : 'N/A';
  
  div.innerHTML = `
    <div style="background: rgba(127, 0, 255, 0.05); padding: 20px; border-radius: 10px;">
      <h4 style="color:#7f00ff;">🧠 Resumen Integrado</h4>
      <p><strong>Perfil de Personalidad:</strong> Maquiavelismo <strong>${nivel(p.maquiavelismo||0)}</strong>, 
      Narcisismo <strong>${nivel(p.narcisismo||0)}</strong>, Psicopatía <strong>${nivel(p.psicopatía||0)}</strong>.</p>
      <p><strong>Expresión Emocional:</strong> ${emocion} (Confianza: ${confianza}).</p>
      <p><strong>Tiempo de Respuesta:</strong> ${p.tiempo_total_seg || 'N/A'} segundos total.</p>
      <p><strong>Estado del Análisis:</strong> ${p.estado_analisis || 'Completado'}.</p>
    </div>
  `;
}

function mostrarImagenInvestigador(p) {
  const div = document.getElementById('imagen-participante');
  if (!div) return;
  
  if (p.url_imagen) {
    div.innerHTML = `
      <div style="text-align:center;">
        <h4 style="color:#c080ff;">📷 Imagen del Participante</h4>
        <img id="imagen-investigador-display" src="${p.url_imagen}" alt="Foto participante" 
             style="max-width:100%; max-height:500px; border-radius:10px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); margin:20px 0;">
        <div style="margin-top:15px;">
          <p style="color:var(--text-secondary);">
            Imagen analizada automáticamente con el modelo de microexpresiones
          </p>
        </div>
      </div>
    `;
  } else {
    div.innerHTML = `
      <div style="text-align:center;">
        <h4 style="color:#c080ff;">📷 Imagen del Participante</h4>
        <p style="color:var(--text-secondary);">No hay imagen disponible para este participante.</p>
      </div>
    `;
  }
}

/* ---------- INICIALIZACIÓN ---------- */
document.addEventListener('DOMContentLoaded', () => {
  sessionStorage.clear();
  imagenCapturada = null;
  tiemposRespuesta = {};
  tiempoInicioItem = {};
  testInicioTimestamp = null;
  window._capturaInicializada = false;
  console.log('✅ Sesión limpiada al cargar');

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
    const fd = document.getElementById('form-datos-basicos');
    if (fd) fd.reset();
    window.scrollTo({ top:0, behavior:'smooth' });
  });

  btnInvestigador?.addEventListener('click', () => {
    document.getElementById('pagina-inicio')?.classList.add('hidden');
    document.getElementById('seccion-login')?.classList.remove('hidden');
    window.scrollTo({ top:0, behavior:'smooth' });
  });

  const formDatos = document.getElementById('form-datos-basicos');
  formDatos?.addEventListener('submit', (e) => {
    e.preventDefault();
    const consentimiento = formDatos.querySelector('input[name="consentimiento"]');
    if (!consentimiento || !consentimiento.checked) {
      alert('Debés aceptar el consentimiento para continuar.');
      return;
    }
    const nombre = formDatos.querySelector('input[name="nombre"]').value.trim();
    const edad = formDatos.querySelector('input[name="edad"]').value;
    const genero = formDatos.querySelector('select[name="genero"]').value;
    const pais = formDatos.querySelector('input[name="pais"]').value.trim();
    if (!nombre || !edad || !genero || !pais) {
      alert('Completá todos los datos requeridos.');
      return;
    }
    sessionStorage.setItem('datos_personales', JSON.stringify({ nombre, edad, genero, pais }));
    testInicioTimestamp = Date.now();
    generarItemsTest();
    setTimeout(() => configurarTrackingTiempos(), 50);
    document.getElementById('seccion-bienvenida')?.classList.add('hidden');
    document.getElementById('seccion-test')?.classList.remove('hidden');
    window.scrollTo({ top:0, behavior:'smooth' });
  });

  const formSD3 = document.getElementById('form-sd3');
  formSD3?.addEventListener('submit', (e) => {
    e.preventDefault();
    calcularSD3();
  });

  const btnLoginInv = document.getElementById('btn-login-investigador');
  const inputPasswordInv = document.getElementById('password-investigador');
  btnLoginInv?.addEventListener('click', () => {
    const pw = inputPasswordInv?.value?.trim() || '';
    if (pw === PASSWORD_INVESTIGADOR) {
      document.getElementById('seccion-login')?.classList.add('hidden');
      document.getElementById('seccion-investigador')?.classList.remove('hidden');
      cargarDatosParticipantes();
      window.scrollTo({ top:0, behavior:'smooth' });
    } else {
      alert('❌ Contraseña incorrecta');
      if (inputPasswordInv) inputPasswordInv.value = '';
    }
  });

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
});

/* ---------- FIN ---------- */
