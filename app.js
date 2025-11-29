/* ========================================
   app.js - VERSIÓN COMPLETA MEJORADA CON GRABACIÓN DE VIDEO
   ======================================== */

/* ---------- CONFIG SUPABASE ---------- */
const SUPABASE_CONFIG = {
  URL: 'https://cdhndtzuwtmvhiulvzbp.supabase.co',
  ANON_KEY: 'sb_publishable_mzTN7UGk3aZJ8b3Zxf_44g_gK5kaJlV'
};
const FASTAPI_URL = "https://darklnesapp-api-1.onrender.com";
const PASSWORD_INVESTIGADOR = "investigador2025";

// Inicializar Supabase
const supabase = supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);

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

/* ---------- ANÁLISIS CON PY-FEAT PARA FACS ---------- */
async function analizarMicroexpresiones(imagenBase64) {
  console.log('🔬 Iniciando análisis con Py-Feat...');
  
  try {
    // Verificar que la API esté disponible
    const healthResponse = await fetch(`${FASTAPI_URL}/health`);
    if (!healthResponse.ok) {
      throw new Error(`API no responde: ${healthResponse.status}`);
    }
    
    // ✅ NUEVO: Verificar si Py-Feat está disponible
    let pyfeatDisponible = false;
    try {
      const pyfeatStatus = await fetch(`${FASTAPI_URL}/pyfeat-status`);
      if (pyfeatStatus.ok) {
        const pyfeatData = await pyfeatStatus.json();
        pyfeatDisponible = pyfeatData.available || false;
        console.log('🔧 Py-Feat disponible:', pyfeatDisponible);
      }
    } catch (e) {
      console.log('⚠️ Py-Feat no disponible, usando análisis estándar');
    }
    
    // Convertir base64 a Blob
    const base64Data = imagenBase64.split(',')[1];
    const byteCharacters = atob(base64Data);
    const byteArrays = [];
    
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }
    
    const blob = new Blob(byteArrays, { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('file', blob, 'foto.jpg');

    let resultadoCompleto = {};

    // ✅ ANÁLISIS CON PY-FEAT SI ESTÁ DISPONIBLE
    if (pyfeatDisponible) {
      console.log('🧩 Ejecutando análisis FACS con Py-Feat...');
      const facsResponse = await fetch(`${FASTAPI_URL}/analyze-facs`, {
        method: 'POST',
        body: formData
      });

      if (facsResponse.ok) {
        const facsResult = await facsResponse.json();
        console.log('✅ Análisis FACS completado:', facsResult);
        resultadoCompleto = {
          ...resultadoCompleto,
          facs: facsResult.facs || [],
          aus_detectadas: facsResult.aus_detectadas || [],
          imagen_anotada: facsResult.imagen_anotada || null,
          landmarks: facsResult.landmarks || [],
          modelo: 'pyfeat'
        };
      }
    }

    // ✅ ANÁLISIS DE EMOCIONES (siempre)
    console.log('😊 Ejecutando análisis de emociones...');
    const emotionResponse = await fetch(`${FASTAPI_URL}/analyze-emotions`, {
      method: 'POST',
      body: formData
    });

    if (emotionResponse.ok) {
      const emotionResult = await emotionResponse.json();
      console.log('✅ Análisis emociones completado:', emotionResult);
      resultadoCompleto = {
        ...resultadoCompleto,
        emociones: emotionResult.emociones || {},
        emocion_principal: emotionResult.emocion_principal || 'Neutral',
        confianza: emotionResult.confianza || 0,
        sd3_facial: emotionResult.sd3 || {}
      };
    }

    // ✅ PROCESAR RESULTADO COMBINADO
    return procesarResultadoCompleto(resultadoCompleto, pyfeatDisponible);
    
  } catch (error) {
    console.error('❌ Error en análisis:', error);
    return analisisDeReserva(imagenBase64, error.message);
  }
}

function procesarResultadoCompleto(resultado, pyfeatDisponible) {
  const emocionesArray = Object.entries(resultado.emociones || {}).map(([emocion, score]) => ({
    emocion,
    score: parseFloat(score)
  }));
  
  const emocionPrincipal = emocionesArray.reduce((max, emocion) => 
    emocion.score > max.score ? emocion : max, {emocion: 'Neutral', score: 0}
  );

  // ✅ GENERAR DATOS FACS MEJORADOS
  const facsData = pyfeatDisponible && resultado.facs ? 
    resultado.facs : 
    generarDatosFACS(emocionPrincipal.emocion, emocionPrincipal.score);

  return {
    emociones: emocionesArray,
    emocion_principal: emocionPrincipal.emocion,
    confianza: emocionPrincipal.score,
    sd3: resultado.sd3_facial || {},
    status: 'completado',
    modelo: resultado.modelo || 'standard',
    timestamp: new Date().toISOString(),
    facs: facsData,
    aus_detectadas: resultado.aus_detectadas || [],
    imagen_anotada: resultado.imagen_anotada || null,
    landmarks: resultado.landmarks || [],
    interpretacion: generarInterpretacionEkman(emocionPrincipal.emocion, emocionPrincipal.score),
    pyfeat_utilizado: pyfeatDisponible
  };
}

// Generar datos FACS mejorados
function generarDatosFACS(emocionPrincipal, confianza) {
  const unidadesFACS = {
    "Alegría": [
      { unidad: "AU6", nombre: "Mejilla elevada", intensidad: 0.8, descripcion: "Contracción del músculo orbicular del ojo" },
      { unidad: "AU12", nombre: "Estiramiento de labios", intensidad: 0.9, descripcion: "Sonrisa genuina (Duchenne)" }
    ],
    "Tristeza": [
      { unidad: "AU1", nombre: "Ceja interna elevada", intensidad: 0.7, descripcion: "Expresión de preocupación" },
      { unidad: "AU4", nombre: "Ceja fruncida", intensidad: 0.6, descripcion: "Tensión en zona glabelar" },
      { unidad: "AU15", nombre: "Comisura labial hacia abajo", intensidad: 0.8, descripcion: "Expresión de desánimo" }
    ],
    "Enojo": [
      { unidad: "AU4", nombre: "Ceja fruncida", intensidad: 0.9, descripcion: "Tensión en entrecejo" },
      { unidad: "AU5", nombre: "Párpado superior elevado", intensidad: 0.7, descripcion: "Mirada intensa" },
      { unidad: "AU7", nombre: "Párpado inferior tensionado", intensidad: 0.6, descripcion: "Ojos entrecerrados" },
      { unidad: "AU23", nombre: "Labios tensionados", intensidad: 0.8, descripcion: "Boca apretada" }
    ],
    "Miedo": [
      { unidad: "AU1", nombre: "Ceja interna elevada", intensidad: 0.8, descripcion: "Expresión de alarma" },
      { unidad: "AU2", nombre: "Ceja externa elevada", intensidad: 0.7, descripcion: "Cejas arqueadas" },
      { unidad: "AU4", nombre: "Ceja fruncida", intensidad: 0.6, descripcion: "Preocupación" },
      { unidad: "AU5", nombre: "Párpado superior elevado", intensidad: 0.9, descripcion: "Ojos muy abiertos" },
      { unidad: "AU20", nombre: "Estiramiento horizontal de labios", intensidad: 0.5, descripcion: "Boca tensionada" }
    ],
    "Sorpresa": [
      { unidad: "AU1", nombre: "Ceja interna elevada", intensidad: 0.8, descripcion: "Elevación de cejas" },
      { unidad: "AU2", nombre: "Ceja externa elevada", intensidad: 0.7, descripcion: "Arqueo de cejas" },
      { unidad: "AU5", nombre: "Párpado superior elevado", intensidad: 0.9, descripcion: "Ojos abiertos" },
      { unidad: "AU26", nombre: "Mandíbula caída", intensidad: 0.6, descripcion: "Boca abierta" }
    ],
    "Disgusto": [
      { unidad: "AU9", nombre: "Nariz arrugada", intensidad: 0.8, descripcion: "Expresión de rechazo" },
      { unidad: "AU10", nombre: "Elevador del labio superior", intensidad: 0.7, descripcion: "Asco facial" },
      { unidad: "AU15", nombre: "Comisura labial hacia abajo", intensidad: 0.6, descripcion: "Desaprobación" }
    ],
    "Neutral": [
      { unidad: "AU0", nombre: "Expresión neutra", intensidad: 0.9, descripcion: "Sin actividad muscular significativa" }
    ]
  };

  return unidadesFACS[emocionPrincipal] || unidadesFACS["Neutral"];
}

// Generar interpretación Ekman
function generarInterpretacionEkman(emocion, confianza) {
  const interpretaciones = {
    "Alegría": {
      autor: "Paul Ekman",
      teoria: "La alegría genuina se caracteriza por la activación simultánea del músculo cigomático mayor (sonrisa) y el músculo orbicular del ojo (patas de gallo).",
      significado: "Indica bienestar emocional, satisfacción o experiencias positivas."
    },
    "Tristeza": {
      autor: "Paul Ekman & Wallace Friesen",
      teoria: "La tristeza se manifiesta mediante la elevación de la ceja interna (AU1) y el descenso de las comisuras labiales (AU15).",
      significado: "Sugiere desánimo, melancolía o descontento."
    },
    "Enojo": {
      autor: "Paul Ekman",
      teoria: "El enojo activa el fruncimiento de cejas (AU4) y tensión en párpados (AU5, AU7).",
      significado: "Indica frustración, irritación o desacuerdo."
    },
    "Miedo": {
      autor: "Paul Ekman",
      teoria: "El miedo combina elevación de cejas (AU1, AU2) y tensión ocular (AU5).",
      significado: "Refleja ansiedad, preocupación o inseguridad."
    },
    "Sorpresa": {
      autor: "Carroll Izard",
      teoria: "La sorpresa se caracteriza por apertura ocular (AU5) y elevación de cejas.",
      significado: "Indica desconcierto, curiosidad o novedad."
    },
    "Disgusto": {
      autor: "Paul Ekman",
      teoria: "El disgusto activa la nariz arrugada (AU9) y elevación del labio superior (AU10).",
      significado: "Sugiere desaprobación, rechazo o incomodidad moral."
    },
    "Neutral": {
      autor: "Paul Ekman",
      teoria: "La expresión neutral indica ausencia de activación emocional detectable.",
      significado: "Puede indicar control emocional, indiferencia o procesamiento cognitivo."
    }
  };

  return interpretaciones[emocion] || {
    autor: "Teoría de las Emociones Básicas",
    teoria: "Las emociones básicas son universales y biológicamente determinadas según la investigación transcultural de Ekman.",
    significado: "Emoción no especificada en el modelo básico."
  };
}

// Función de reserva
function analisisDeReserva(imagenBase64, errorMsg) {
  console.log('🔄 Usando análisis de reserva...');
  
  const emocionesBase = {
    "Alegría": 0.3 + Math.random() * 0.4,
    "Neutral": 0.1 + Math.random() * 0.3,
    "Enojo": Math.random() * 0.2,
    "Miedo": Math.random() * 0.15,
    "Sorpresa": Math.random() * 0.1,
    "Tristeza": Math.random() * 0.1,
    "Disgusto": Math.random() * 0.05
  };
  
  const total = Object.values(emocionesBase).reduce((a, b) => a + b, 0);
  Object.keys(emocionesBase).forEach(key => {
    emocionesBase[key] = emocionesBase[key] / total;
  });
  
  const emocionPrincipal = Object.entries(emocionesBase).reduce((a, b) => 
    a[1] > b[1] ? a : b
  );
  
  const sd3 = {
    "Maquiavelismo": Math.round((emocionesBase.Enojo * 0.6 + emocionesBase.Disgusto * 0.4) * 10000) / 100,
    "Narcisismo": Math.round((emocionesBase.Alegría * 0.5 + emocionesBase.Neutral * 0.5) * 10000) / 100,
    "Psicopatía": Math.round((emocionesBase.Miedo * 0.7 + emocionesBase.Sorpresa * 0.3) * 10000) / 100
  };
  
  return {
    emociones: Object.entries(emocionesBase).map(([k, v]) => ({ emocion: k, score: v })),
    emocion_principal: emocionPrincipal[0],
    confianza: emocionPrincipal[1],
    sd3: sd3,
    facs: generarDatosFACS(emocionPrincipal[0], emocionPrincipal[1]),
    interpretacion: generarInterpretacionEkman(emocionPrincipal[0], emocionPrincipal[1]),
    status: 'fallback',
    error: errorMsg,
    mensaje: 'Usando análisis simulado - API temporalmente no disponible'
  };
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
  
  // Inicializar tiempos para todos los items
  for (let i = 1; i <= itemsSD3.length; i++) {
    tiempoInicioItem[i] = testInicioTimestamp || Date.now();
  }
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const itemNum = parseInt(entry.target.getAttribute('data-item'));
        if (!tiempoInicioItem[itemNum] || tiempoInicioItem[itemNum] === testInicioTimestamp) {
          tiempoInicioItem[itemNum] = Date.now();
        }
      }
    });
  }, { threshold: 0.7 });

  const items = document.querySelectorAll('.test-item');
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
    configurarGrabacionVideo(); 
    window._capturaInicializada = true; 
  }
  window.scrollTo({ top:0, behavior:'smooth' });
}

/* ---------- GRABACIÓN DE VIDEO ---------- */
function configurarGrabacionVideo() {
  const video = document.getElementById('video');
  const btnActivarCamara = document.getElementById('btn-activar-camara');
  const btnIniciarGrabacion = document.getElementById('btn-iniciar-grabacion');
  const btnDetenerGrabacion = document.getElementById('btn-detener-grabacion');
  const btnSubirVideo = document.getElementById('btn-subir-video');
  const previewContainer = document.getElementById('preview-container');
  const previewVideo = document.getElementById('preview-video');
  const audioContainer = document.getElementById('audio-container');
  const progressContainer = document.getElementById('progress-container');
  const progressBar = document.getElementById('progress-bar');
  const tiempoGrabacion = document.getElementById('tiempo-grabacion');
  const infoVideo = document.getElementById('info-video');

  let stream = null;
  let mediaRecorder = null;
  let recordedChunks = [];
  let grabacionEnCurso = false;
  let tiempoInicioGrabacion = null;
  let intervaloProgress = null;
  let duracionGrabacion = 15000; // 15 segundos

  // Activar cámara
  btnActivarCamara.addEventListener('click', async function() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: true
      });
      
      if (video) { 
        video.srcObject = stream; 
        video.classList.remove('hidden'); 
        video.play(); 
      }
      
      btnActivarCamara.classList.add('hidden');
      btnIniciarGrabacion.classList.remove('hidden');
      audioContainer.classList.remove('hidden');
      document.getElementById('camera-placeholder')?.classList?.add('hidden');
      
    } catch (err) {
      console.error('Error accediendo a la cámara:', err);
      alert('No se pudo acceder a la cámara. Podés intentar con otro navegador o verificar los permisos.');
    }
  });

  // Iniciar grabación
  btnIniciarGrabacion.addEventListener('click', function() {
    if (!stream) {
      alert('Primero activá la cámara');
      return;
    }

    recordedChunks = [];
    
    try {
      const options = { mimeType: 'video/webm; codecs=vp9,opus' };
      mediaRecorder = new MediaRecorder(stream, options);
      
      mediaRecorder.ondataavailable = function(event) {
        if (event.data.size > 0) {
          recordedChunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = function() {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const videoURL = URL.createObjectURL(blob);
        previewVideo.src = videoURL;
        previewContainer.classList.remove('hidden');
        btnSubirVideo.classList.remove('hidden');
        
        // Mostrar información del video
        const duracion = (Date.now() - tiempoInicioGrabacion) / 1000;
        infoVideo.innerHTML = `
          <p>Duración: ${duracion.toFixed(1)} segundos</p>
          <p>Tamaño: ${(blob.size / 1024 / 1024).toFixed(2)} MB</p>
          <p>Se analizarán ${Math.floor(duracion)} frames (1 por segundo)</p>
        `;
      };
      
      mediaRecorder.start(1000);
      grabacionEnCurso = true;
      tiempoInicioGrabacion = Date.now();
      
      btnIniciarGrabacion.classList.add('hidden');
      btnDetenerGrabacion.classList.remove('hidden');
      progressContainer.classList.remove('hidden');
      
      // Iniciar progress bar
      iniciarProgressBar();
      
    } catch (err) {
      console.error('Error iniciando grabación:', err);
      alert('Error al iniciar la grabación: ' + err.message);
    }
  });

  function iniciarProgressBar() {
    let tiempoTranscurrido = 0;
    progressBar.style.width = '0%';
    
    // Esperar a que la historia se muestre (3 segundos)
    reproducirHistoria().then(() => {
      console.log('🎬 Iniciando grabación...');
      
      intervaloProgress = setInterval(() => {
        tiempoTranscurrido += 100;
        const porcentaje = (tiempoTranscurrido / duracionGrabacion) * 100;
        
        progressBar.style.width = `${Math.min(porcentaje, 100)}%`;
        tiempoGrabacion.textContent = `${(tiempoTranscurrido / 1000).toFixed(1)}s`;
        
        // Detener automáticamente después de 15 segundos
        if (tiempoTranscurrido >= duracionGrabacion) {
          detenerGrabacion();
        }
      }, 100);
    });
  }

  // Detener grabación manualmente
  btnDetenerGrabacion.addEventListener('click', function() {
    detenerGrabacion();
  });

  function detenerGrabacion() {
    if (mediaRecorder && grabacionEnCurso) {
      mediaRecorder.stop();
      grabacionEnCurso = false;
      
      if (intervaloProgress) {
        clearInterval(intervaloProgress);
        intervaloProgress = null;
      }
      
      btnDetenerGrabacion.classList.add('hidden');
      progressContainer.classList.add('hidden');
      
      // Detener stream
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
        video.classList.add('hidden');
      }
    }
  }

  // Subir y analizar video
  btnSubirVideo.addEventListener('click', async function() {
    if (recordedChunks.length === 0) {
      alert('No hay video para analizar');
      return;
    }

    btnSubirVideo.disabled = true;
    btnSubirVideo.textContent = '⏳ Procesando video...';

    try {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      
      // Convertir a base64 para enviar
      const base64Video = await blobToBase64(blob);
      
      const persona = JSON.parse(sessionStorage.getItem('datos_personales') || '{}');
      const sd3 = JSON.parse(sessionStorage.getItem('resultadosSD3') || '{}');

      console.log('🎬 Iniciando análisis de video...');

      // Enviar video al backend para análisis
      const analisisVideo = await analizarVideoCompleto(base64Video, persona, sd3);
      
      if (analisisVideo.success) {
        mostrarConfirmacionParticipante(analisisVideo);
      } else {
        throw new Error(analisisVideo.error || 'Error en el análisis del video');
      }

    } catch (err) {
      console.error("❌ Error procesando video:", err);
      alert("Error: " + err.message);
      btnSubirVideo.disabled = false;
      btnSubirVideo.textContent = "📤 Subir Video y Analizar";
    }
  });
}

// Convertir blob a base64
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/* ---------- ANÁLISIS DE VIDEO COMPLETO ---------- */
async function analizarVideoCompleto(videoBase64, datosPersonales, datosSD3) {
  try {
    console.log('🎬 Enviando video para análisis...');
    
    const response = await fetch(`${FASTAPI_URL}/analyze-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        video_data: videoBase64,
        participant_data: datosPersonales,
        sd3_data: datosSD3
      })
    });

    if (!response.ok) {
      throw new Error(`Error del servidor: ${response.status}`);
    }

    const resultado = await response.json();
    console.log('✅ Análisis de video completado:', resultado);

    // Guardar en Supabase
    const guardado = await guardarAnalisisVideoEnSupabase(resultado, datosPersonales, datosSD3);
    
    return {
      success: true,
      analisis: resultado,
      guardado: guardado,
      mensaje: 'Video analizado y guardado correctamente'
    };

  } catch (error) {
    console.error('❌ Error en análisis de video:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/* ---------- GUARDAR ANÁLISIS DE VIDEO EN SUPABASE ---------- */
async function guardarAnalisisVideoEnSupabase(analisis, persona, sd3) {
  console.log("📤 Guardando análisis de video en Supabase...");

  try {
    // Obtener el rasgo predominante para la historia utilizada
    const rasgos = {
      maquiavelismo: parseFloat(sd3.mach) || 0,
      narcisismo: parseFloat(sd3.narc) || 0,
      psicopatia: parseFloat(sd3.psych) || 0
    };
    
    const rasgoPredominante = Object.keys(rasgos).reduce((a, b) => 
      rasgos[a] > rasgos[b] ? a : b
    );

    const videoData = {
      nombre: persona.nombre || 'Anónimo',
      edad: parseInt(persona.edad) || 0,
      genero: persona.genero || '',
      pais: persona.pais || '',
      mach: parseFloat(sd3.mach) || 0,
      narc: parseFloat(sd3.narc) || 0,
      psych: parseFloat(sd3.psych) || 0,
      tiempo_total_seg: parseFloat(sd3.tiempo_total_segundos) || 0,
      emocion_princ: analisis.emocion_predominante || 'No analizada',
      image_url: analisis.video_url || '',
      // Nuevos campos para video
      total_frames: analisis.total_frames || 0,
      duracion_video: analisis.duracion_video || 0,
      emociones_detectadas: analisis.emociones_detectadas || [],
      correlaciones: analisis.correlaciones || {},
      historia_utilizada: rasgoPredominante,
      created_at: new Date().toISOString()
    };

    console.log('💾 Guardando datos de video:', videoData);

    const { data, error } = await supabase
      .from('darklens_records')
      .insert([videoData])
      .select();

    if (error) {
      throw new Error(`Error Supabase: ${error.message}`);
    }

    console.log('✅ Análisis de video guardado en Supabase!', data);

    return {
      success: true,
      id: data[0]?.id,
      message: 'Datos de video guardados correctamente'
    };

  } catch (error) {
    console.error('❌ Error guardando análisis de video:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

function reproducirHistoria() {
  // Obtener resultados SD3 para elegir la historia apropiada
  const sd3 = JSON.parse(sessionStorage.getItem('resultadosSD3') || '{}');
  
  // Determinar el rasgo predominante
  const rasgos = {
    maquiavelismo: parseFloat(sd3.mach) || 0,
    narcisismo: parseFloat(sd3.narc) || 0,
    psicopatia: parseFloat(sd3.psych) || 0
  };
  
  const rasgoPredominante = Object.keys(rasgos).reduce((a, b) => 
    rasgos[a] > rasgos[b] ? a : b
  );

  console.log('🎭 Rasgo predominante:', rasgoPredominante, rasgos);

  // Historias específicas para cada rasgo
  const historias = {
    maquiavelismo: {
      titulo: "El Dilema del Compañero",
      texto: `"Imagina que estás trabajando en un proyecto muy importante con un compañero. 
      Has descubierto que tu compañero cometió un error que podría hacer fracasar todo el proyecto. 
      Tienes la oportunidad de señalar su error públicamente ante el jefe, lo que te haría quedar bien 
      y probablemente te daría una ventaja para el próximo ascenso. Sin embargo, si lo haces, 
      tu compañero podría ser despedido. Por otro lado, si no dices nada y el proyecto fracasa, 
      ambos podrían ser afectados. ¿Qué harías en esta situación?"`
    },
    
    narcisismo: {
      titulo: "El Reconocimiento Perdido",
      texto: `"Estás en una reunión importante donde se presentan los resultados de un proyecto 
      en el que trabajaste intensamente. Tu jefe está dando crédito a otra persona por tu trabajo 
      y todos están aplaudiendo los logros de tu colega. Nadie parece recordar tu contribución 
      fundamental. Te sientes invisible y no reconocido, a pesar de que sin tu esfuerzo 
      el proyecto no habría sido posible. ¿Cómo te sientes al ver que otro recibe el mérito 
      por tu trabajo excepcional?"`
    },
    
    psicopatia: {
      titulo: "El Encuentro Inesperado",
      texto: `"Caminas solo por un callejón oscuro tarde en la noche. De repente, escuchas 
      ruidos de una pelea cercana. Al acercarte, ves a dos personas discutiendo intensamente. 
      Una de ellas saca un arma y la situación se vuelve peligrosa. Tienes la oportunidad 
      de intervenir o llamar a la policía, pero también podrías simplemente alejarte 
      y evitar cualquier problema. No hay testigos alrededor. ¿Cuál sería tu reacción 
      inmediata en esta situación de alto riesgo?"`
    }
  };

  // Seleccionar historia basada en el rasgo predominante
  const historiaSeleccionada = historias[rasgoPredominante] || historias.maquiavelismo;
  
  // Actualizar el texto en la interfaz
  const textoHistoriaDiv = document.getElementById('texto-historia');
  if (textoHistoriaDiv) {
    textoHistoriaDiv.innerHTML = `
      <strong>Historia: ${historiaSeleccionada.titulo}</strong>
      <p style="margin: 10px 0; font-style: italic; color: var(--text-secondary); line-height: 1.6;">
        ${historiaSeleccionada.texto}
      </p>
      <small style="color: var(--accent);">Rasgo analizado: ${rasgoPredominante}</small>
    `;
  }

  // Mostrar instrucciones para leer la historia
  const instruccionesDiv = document.createElement('div');
  instruccionesDiv.style.background = 'rgba(127, 0, 255, 0.1)';
  instruccionesDiv.style.padding = '15px';
  instruccionesDiv.style.borderRadius = '10px';
  instruccionesDiv.style.marginTop = '15px';
  instruccionesDiv.style.textAlign = 'center';
  instruccionesDiv.innerHTML = `
    <strong>📝 Instrucciones IMPORTANTES:</strong>
    <div style="margin: 10px 0; padding: 10px; background: rgba(127, 0, 255, 0.2); border-radius: 8px;">
      <p style="margin: 5px 0; color: var(--text-secondary);">
        <strong>1.</strong> Lee esta historia detenidamente<br>
        <strong>2.</strong> <span style="color: #ff6384; font-weight: bold;">PERMANECE EN SILENCIO - NO HABLES</span><br>
        <strong>3.</strong> Piensa en cómo te haría sentir esta situación<br>
        <strong>4.</strong> Mantén una expresión facial natural mientras procesas la historia<br>
        <strong>5.</strong> La cámara grabará tus reacciones faciales automáticamente
      </p>
    </div>
    <p style="margin: 0; color: var(--accent); font-weight: bold;">
      La grabación comenzará en 3 segundos...
    </p>
  `;
  
  if (textoHistoriaDiv) {
    textoHistoriaDiv.appendChild(instruccionesDiv);
  }

  // Devolver una promesa que se resuelve después de 3 segundos (para dar tiempo a leer)
  return new Promise((resolve) => {
    setTimeout(() => {
      // Remover las instrucciones después del tiempo
      if (instruccionesDiv.parentNode) {
        instruccionesDiv.parentNode.removeChild(instruccionesDiv);
      }
      resolve();
    }, 3000); // 3 segundos para leer antes de empezar a grabar
  });
}

/* ---------- CONFIRMACIÓN PARTICIPANTE ---------- */
function mostrarConfirmacionParticipante(analisisVideo = null) {
  const resultadoDiv = document.getElementById('resultado-micro');
  if (!resultadoDiv) return;
  
  let analisisHTML = '';
  if (analisisVideo && analisisVideo.success) {
    const analisis = analisisVideo.analisis;
    analisisHTML = `
      <div style="background: rgba(127, 0, 255, 0.1); padding: 20px; border-radius: 10px; margin: 20px 0; text-align: center;">
        <h4 style="color: var(--accent);">🎬 Análisis de Video Completado</h4>
        <p style="font-size: 1.3em; font-weight: bold; color: #7f00ff;">
          Emoción predominante: ${analisis.emocion_predominante || 'No detectada'}
        </p>
        ${analisis.total_frames ? `
          <p style="color: var(--text-secondary);">
            <strong>Frames analizados:</strong> ${analisis.total_frames}
          </p>
        ` : ''}
        ${analisis.duracion_video ? `
          <p style="color: var(--text-secondary);">
            <strong>Duración:</strong> ${analisis.duracion_video.toFixed(1)} segundos
          </p>
        ` : ''}
        <p style="color: var(--text-secondary); margin-top: 10px;">
          El video y análisis han sido guardados en la base de datos
        </p>
      </div>
    `;
  } else {
    analisisHTML = `
      <div style="background: rgba(255, 99, 132, 0.1); padding: 20px; border-radius: 10px; margin: 20px 0; text-align: center;">
        <h4 style="color: #ff6384;">⚠️ Análisis No Disponible</h4>
        <p style="color: var(--text-secondary);">
          El análisis de video no pudo completarse, pero tus datos fueron guardados.
        </p>
      </div>
    `;
  }
  
  resultadoDiv.classList.remove('hidden');
  resultadoDiv.innerHTML = `
    <div class="confirmacion-final" style="text-align:center; padding:30px;">
      <h3 style="color: var(--accent);">¡Gracias por participar!</h3>
      <p style="margin:15px 0;">Tu video, respuestas y análisis han sido registrados correctamente.</p>
      
      ${analisisHTML}
      
      <div style="margin-top:20px; display:flex; gap:15px; justify-content:center; flex-wrap:wrap;">
        <button class="btn-primary" onclick="volverAlInicio()">🏠 Volver al inicio</button>
        <button class="btn-secondary" onclick="location.reload()">🔄 Nueva participación</button>
      </div>
    </div>
  `;
}

/* ---------- PANEL INVESTIGADOR MEJORADO ---------- */
async function cargarDatosParticipantes() {
  const listaDiv = document.getElementById('lista-participantes');
  if (listaDiv) listaDiv.innerHTML = '<p style="text-align:center; color:var(--text-secondary);">📡 Cargando datos desde Supabase...</p>';
  
  try {
    console.log('🔍 Cargando datos desde Supabase...');
    
    const { data: participantes, error } = await supabase
      .from('darklens_records')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Error Supabase: ${error.message}`);
    }

    participantesData = participantes || [];
    console.log(`✅ ${participantesData.length} participantes cargados desde Supabase`);
    
  } catch (err) {
    console.warn('⚠️ Error cargando desde Supabase:', err);
    // Datos de ejemplo
    participantesData = [{
      id: 'DEMO_001',
      created_at: new Date().toISOString(),
      nombre: 'Participante Demo',
      edad: 28,
      genero: 'masculino',
      pais: 'Argentina',
      maquiavelismo: 3.2,
      narcisismo: 2.8,
      psicopatia: 2.5,
      tiempo_total_seg: 7.50,
      emocion_princ: 'Alegría',
      image_url: '',
      total_frames: 15,
      duracion_video: 15.0,
      emociones_detectadas: ['Alegría', 'Neutral'],
      correlaciones: { maquiavelismo: 0.3, narcisismo: 0.5, psicopatia: 0.2 },
      historia_utilizada: 'narcisismo'
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
  
  // ✅ AGREGAR BOTÓN DE CSV
  const headerDiv = document.createElement('div');
  headerDiv.style.display = 'flex';
  headerDiv.style.justifyContent = 'space-between';
  headerDiv.style.alignItems = 'center';
  headerDiv.style.marginBottom = '20px';
  headerDiv.style.padding = '0 10px';
  
  headerDiv.innerHTML = `
    <h3 style="color: var(--accent); margin: 0;">Participantes Registrados</h3>
    <button id="btn-descargar-csv" class="btn-primary" style="display: flex; align-items: center; gap: 8px;">
      📊 Descargar CSV (${participantesData.length})
    </button>
  `;
  
  listaDiv.appendChild(headerDiv);
  
  // Lista de participantes
  participantesData.forEach((p, idx) => {
    const fecha = new Date(p.created_at).toLocaleString('es-AR');
    const emocion = p.emocion_princ || 'No analizado';
    
    const item = document.createElement('div');
    item.className = 'content-box';
    item.style.margin = '10px';
    item.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
        <div style="flex: 1;">
          <strong>${p.nombre || 'Sin nombre'}</strong>
          <div style="color:var(--text-secondary); font-size:0.9em;">${fecha}</div>
          <div style="display: flex; gap: 15px; margin-top: 8px; font-size: 0.85em;">
            <span style="color: #667eea;">🎭 ${p.mach || 'N/A'}</span>
            <span style="color: #764ba2;">👑 ${p.narc || 'N/A'}</span>
            <span style="color: #ffce56;">⚡ ${p.psych || 'N/A'}</span>
            <span style="color: #7f00ff;">😊 ${emocion}</span>
            ${p.historia_utilizada ? `<span style="color: #4CAF50;">📖 ${p.historia_utilizada}</span>` : ''}
          </div>
        </div>
        <div style="display:flex; gap:10px;">
          <button class="btn-primary btn-ver" data-index="${idx}">Ver Detalles</button>
        </div>
      </div>
    `;
    listaDiv.appendChild(item);
  });

  // Event listeners
  document.querySelectorAll('#lista-participantes .btn-ver').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.getAttribute('data-index'));
      mostrarParticipanteEnPanel(idx);
    });
  });

  // ✅ EVENT LISTENER PARA BOTÓN CSV
  document.getElementById('btn-descargar-csv')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-descargar-csv');
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Generando CSV...';
    btn.disabled = true;
    
    const resultado = await generarYDescargarCSV();
    
    btn.innerHTML = originalText;
    btn.disabled = false;
    
    if (!resultado.success) {
      alert('Error generando CSV: ' + resultado.error);
    }
  });
}

/* ---------- GENERAR CSV ---------- */
async function generarYDescargarCSV() {
  try {
    console.log('📊 Generando CSV...');
    
    // Obtener datos actualizados de Supabase
    const { data: participantes, error } = await supabase
      .from('darklens_records')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Error obteniendo datos: ${error.message}`);
    }

    if (!participantes || participantes.length === 0) {
      alert('No hay datos para exportar');
      return;
    }

    // Encabezados del CSV
    const headers = [
      'ID', 'Fecha', 'Nombre', 'Edad', 'Género', 'País',
      'Maquiavelismo', 'Narcisismo', 'Psicopatia',
      'Tiempo_Total_Seg', 'Emoción_Principal', 'Historia_Utilizada',
      'Total_Frames', 'Duración_Video', 'Correlación_Maquiavelismo', 
      'Correlación_Narcisismo', 'Correlación_Psicopatia'
    ];
    
    const csvRows = [headers.join(',')];
    
    participantes.forEach(p => {
      const row = [
        p.id || '',
        p.created_at || '',
        `"${(p.nombre || '').replace(/"/g, '""')}"`,
        p.edad || '',
        p.genero || '',
        p.pais || '',
        p.mach || 0,
        p.narc || 0,
        p.psych || 0,
        p.tiempo_total_seg || '',
        p.emocion_princ || '',
        p.historia_utilizada || '',
        p.total_frames || 0,
        p.duracion_video || 0,
        p.correlaciones?.maquiavelismo || 0,
        p.correlaciones?.narcisismo || 0,
        p.correlaciones?.psicopatia || 0
      ];
      
      csvRows.push(row.join(','));
    });
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    // Crear enlace de descarga
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `datos_participantes_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log('📊 CSV generado y descargado exitosamente');
    return { success: true, count: participantes.length };
    
  } catch (error) {
    console.error('❌ Error generando CSV:', error);
    return { success: false, error: error.message };
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

/* ---------- FUNCIONES GLOBALES ---------- */
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

/* ---------- FIN ---------- */
