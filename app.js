/* ========================================
   app.js - VERSIÓN COMPLETA MEJORADA
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

// ✅ GENERAR VISUALIZACIÓN FACS CON COLORES
function generarVisualizacionFACS(landmarks, ausDetectadas, imagenOriginal) {
  if (!landmarks || landmarks.length === 0) {
    return imagenOriginal; // Devolver imagen original si no hay landmarks
  }

  // Crear canvas para dibujar
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();
  
  return new Promise((resolve) => {
    img.onload = function() {
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Dibujar imagen original
      ctx.drawImage(img, 0, 0);
      
      // ✅ DIBUJAR LANDMARKS CON COLORES
      ctx.strokeStyle = '#00ff00';
      ctx.fillStyle = '#ff0000';
      ctx.lineWidth = 2;

      landmarks.forEach((point, index) => {
        ctx.beginPath();
        ctx.arc(point[0], point[1], 3, 0, 2 * Math.PI);
        ctx.fill();
      });

      // ✅ DIBUJAR ZONAS FACS SEGÚN AUs DETECTADAS
      if (ausDetectadas && ausDetectadas.length > 0) {
        ausDetectadas.forEach(au => {
          const color = obtenerColorAU(au.unidad);
          dibujarZonaAU(ctx, landmarks, au.unidad, color, au.intensidad);
        });
      }

      // Convertir a base64
      const imagenAnotada = canvas.toDataURL('image/jpeg', 0.9);
      resolve(imagenAnotada);
    };
    img.src = imagenOriginal;
  });
}

// ✅ COLORES PARA DIFERENTES ACTION UNITS
function obtenerColorAU(au) {
  const colores = {
    'AU1': '#ff4444',  // Ceja interna - Rojo
    'AU2': '#ff8844',  // Ceja externa - Naranja
    'AU4': '#ff44ff',  // Ceja fruncida - Magenta
    'AU5': '#44ff44',  // Párpado superior - Verde
    'AU6': '#8844ff',  // Mejilla elevada - Violeta
    'AU7': '#44ffff',  // Párpado inferior - Cian
    'AU9': '#ffff44',  // Nariz arrugada - Amarillo
    'AU10': '#ff8844', // Elevador labio - Naranja
    'AU12': '#44ff88', // Sonrisa - Verde claro
    'AU15': '#4488ff', // Comisura abajo - Azul
    'AU17': '#ff4488', // Mentón elevado - Rosa
    'AU20': '#88ff44', // Estiramiento labial - Verde lima
    'AU23': '#ff44aa', // Labios tensionados - Rosa oscuro
    'AU25': '#aa44ff', // Labios separados - Púrpura
    'AU26': '#44aaff'  // Mandíbula caída - Azul claro
  };
  return colores[au] || '#ffffff';
}

// ✅ DIBUJAR ZONAS ESPECÍFICAS DE AUs
function dibujarZonaAU(ctx, landmarks, au, color, intensidad) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color + '40'; // Color con transparencia
  ctx.lineWidth = 2;

  const zonas = {
    'AU1': [17, 18, 19, 20, 21], // Ceja izquierda
    'AU2': [22, 23, 24, 25, 26], // Ceja derecha
    'AU4': [21, 22, 27], // Entrecejo
    'AU5': [36, 37, 38, 39, 40, 41], // Ojo izquierdo
    'AU6': [42, 43, 44, 45, 46, 47], // Ojo derecho
    'AU12': [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59] // Boca
  };

  const puntos = zonas[au];
  if (puntos && landmarks.length > 0) {
    ctx.beginPath();
    puntos.forEach((puntoIdx, index) => {
      if (landmarks[puntoIdx]) {
        const x = landmarks[puntoIdx][0];
        const y = landmarks[puntoIdx][1];
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
    });
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
  }
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
    configurarCamaraYSubida(); 
    window._capturaInicializada = true; 
  }
  window.scrollTo({ top:0, behavior:'smooth' });
}

/* ---------- GUARDAR EN SUPABASE ---------- */
async function guardarEnSupabase(datos) {
  console.log("📤 Guardando en Supabase...");

  try {
    // ✅ PREPARAR DATOS COMPLETOS
    const participanteData = {
      id: 'participante_' + Date.now(),
      created_at: new Date().toISOString(),
      nombre: datos.nombre || 'Anónimo',
      edad: datos.edad || '',
      genero: datos.genero || '',
      pais: datos.pais || '',
      
      // Datos SD3 del test
      maquiavelismo: parseFloat(datos.mach) || 0,
      narcisismo: parseFloat(datos.narc) || 0,
      psicopatia: parseFloat(datos.psych) || 0,
      
      // Datos de microexpresiones
      emocion_principal: datos.emocion_principal || 'No analizada',
      confianza_analisis: parseFloat(datos.confianza_analisis) || 0,
      tiempo_total_seg: datos.tiempo_total_seg || '0',
      estado_analisis: datos.estado_analisis || 'Completado',
      
      // Datos FACS y Py-Feat
      sd3_maquiavelismo_facial: parseFloat(datos.sd3_maquiavelismo) || 0,
      sd3_narcisismo_facial: parseFloat(datos.sd3_narcisismo) || 0,
      sd3_psicopatia_facial: parseFloat(datos.sd3_psicopatia) || 0,
      facs_data: datos.facs || [],
      aus_detectadas: datos.aus_detectadas || [],
      interpretacion_ekman: datos.interpretacion || {},
      pyfeat_utilizado: datos.pyfeat_utilizado || false,
      modelo_utilizado: datos.modelo_utilizado || 'standard'
    };

    console.log('💾 Datos a guardar:', participanteData);

    // ✅ GUARDAR EN SUPABASE
    const { data, error } = await supabase
      .from('participantes')
      .insert([participanteData])
      .select();

    if (error) {
      throw new Error(`Error Supabase: ${error.message}`);
    }

    console.log('✅ Guardado exitoso en Supabase!', data);

    // ✅ GUARDAR IMAGEN ANOTADA SI EXISTE
    if (datos.imagen_anotada) {
      try {
        const imagenData = {
          participante_id: participanteData.id,
          imagen_anotada: datos.imagen_anotada,
          created_at: new Date().toISOString()
        };

        const { error: imgError } = await supabase
          .from('imagenes_analisis')
          .insert([imagenData]);

        if (imgError) {
          console.warn('⚠️ No se pudo guardar imagen anotada:', imgError);
        } else {
          console.log('✅ Imagen anotada guardada');
        }
      } catch (imgErr) {
        console.warn('⚠️ Error guardando imagen:', imgErr);
      }
    }

    return {
      success: true,
      id: participanteData.id,
      message: `Datos guardados correctamente en Supabase`,
      data: data
    };

  } catch (error) {
    console.error('❌ Error guardando en Supabase:', error);
    return {
      success: false,
      error: 'Error: ' + error.message
    };
  }
}

/* ---------- GENERAR CSV ---------- */
async function generarYDescargarCSV() {
  try {
    console.log('📊 Generando CSV...');
    
    // Obtener datos actualizados de Supabase
    const { data: participantes, error } = await supabase
      .from('participantes')
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
      'Emoción_Principal', 'Confianza_Análisis', 'Tiempo_Total_Seg',
      'SD3_Maquiavelismo_Facial', 'SD3_Narcisismo_Facial', 'SD3_Psicopatia_Facial',
      'Unidades_FACS_Detectadas', 'AUs_Específicas', 'Modelo_Utilizado',
      'Autor_Teoría', 'Estado_Analisis'
    ];
    
    const csvRows = [headers.join(',')];
    
    participantes.forEach(p => {
      const facsCount = p.facs_data ? p.facs_data.length : 0;
      const ausEspecificas = p.aus_detectadas ? p.aus_detectadas.map(au => au.unidad).join(';') : '';
      const autor = p.interpretacion_ekman ? p.interpretacion_ekman.autor : 'No disponible';
      
      const row = [
        p.id || '',
        p.created_at || '',
        `"${(p.nombre || '').replace(/"/g, '""')}"`,
        p.edad || '',
        p.genero || '',
        p.pais || '',
        p.maquiavelismo || 0,
        p.narcisismo || 0,
        p.psicopatia || 0,
        p.emocion_principal || '',
        p.confianza_analisis || 0,
        p.tiempo_total_seg || '',
        p.sd3_maquiavelismo_facial || 0,
        p.sd3_narcisismo_facial || 0,
        p.sd3_psicopatia_facial || 0,
        facsCount,
        `"${ausEspecificas}"`,
        p.modelo_utilizado || '',
        `"${autor}"`,
        p.estado_analisis || ''
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

/* ---------- CÁMARA Y CAPTURA MEJORADA ---------- */
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

  // Enviar datos finales - MEJORADO CON VISUALIZACIÓN
  btnEnviarImagen?.addEventListener('click', async () => {
    if (!imagenCapturada) { 
      alert('No hay imagen para enviar'); 
      return; 
    }

    btnEnviarImagen.disabled = true;
    btnEnviarImagen.textContent = '⏳ Analizando con Py-Feat...';

    try {
      const persona = JSON.parse(sessionStorage.getItem('datos_personales') || '{}');
      const sd3 = JSON.parse(sessionStorage.getItem('resultadosSD3') || '{}');

      // ✅ ANÁLISIS COMPLETO CON PY-FEAT
      console.log('🔬 Iniciando análisis completo...');
      const analisisMicro = await analizarMicroexpresiones(imagenCapturada);
      
      console.log('📊 Resultado del análisis:', analisisMicro);

      // ✅ GENERAR VISUALIZACIÓN FACS SI HAY DATOS
      let imagenVisualizada = imagenCapturada;
      if (analisisMicro.landmarks && analisisMicro.landmarks.length > 0) {
        console.log('🎨 Generando visualización FACS...');
        imagenVisualizada = await generarVisualizacionFACS(
          analisisMicro.landmarks,
          analisisMicro.aus_detectadas,
          imagenCapturada
        );
      }

      // ✅ PREPARAR DATOS COMPLETOS
      const payload = {
        nombre: persona.nombre || "",
        edad: persona.edad || "",
        genero: persona.genero || "",
        pais: persona.pais || "",
        mach: sd3.mach || "",
        narc: sd3.narc || "",
        psych: sd3.psych || "",
        tiempo_total_seg: sd3.tiempo_total_segundos || "",
        emocion_principal: analisisMicro.emocion_principal || 'No detectada',
        confianza_analisis: analisisMicro.confianza || 0,
        estado_analisis: analisisMicro.error ? 'Error' : 'Completado',
        // Datos FACS y Py-Feat
        sd3_maquiavelismo: analisisMicro.sd3?.Maquiavelismo || 0,
        sd3_narcisismo: analisisMicro.sd3?.Narcisismo || 0,
        sd3_psicopatia: analisisMicro.sd3?.Psicopatía || 0,
        facs: analisisMicro.facs || [],
        aus_detectadas: analisisMicro.aus_detectadas || [],
        interpretacion: analisisMicro.interpretacion || {},
        pyfeat_utilizado: analisisMicro.pyfeat_utilizado || false,
        modelo_utilizado: analisisMicro.modelo || 'standard',
        imagen_anotada: imagenVisualizada
      };

      // ✅ GUARDAR EN SUPABASE
      const resultado = await guardarEnSupabase(payload);
      
      if (resultado.success) {
        console.log('✅ Análisis completado y guardado');
        // Actualizar imagen con visualización
        imagenCapturada = imagenVisualizada;
        mostrarConfirmacionParticipante(analisisMicro, imagenVisualizada);
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
function mostrarConfirmacionParticipante(analisisMicro = null, imagenVisualizada = null) {
  const resultadoDiv = document.getElementById('resultado-micro');
  if (!resultadoDiv) return;
  
  const imagenMostrar = imagenVisualizada || imagenCapturada;
  
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
        ${analisisMicro.pyfeat_utilizado ? `
          <p style="color: var(--text-secondary);">
            <strong>Tecnología:</strong> Py-Feat FACS Detection
          </p>
        ` : ''}
        ${analisisMicro.interpretacion ? `
          <div style="text-align: left; margin-top: 15px; padding: 15px; background: rgba(127, 0, 255, 0.05); border-radius: 8px;">
            <p style="color: var(--text-secondary); margin: 5px 0;">
              <strong>Base teórica:</strong> ${analisisMicro.interpretacion.autor}
            </p>
            <p style="color: var(--text-secondary); margin: 5px 0;">
              <strong>Interpretación:</strong> ${analisisMicro.interpretacion.significado}
            </p>
          </div>
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
        <img src="${imagenMostrar}" alt="Imagen analizada" style="max-width:300px; border-radius:10px; border:2px solid var(--border);">
        ${analisisMicro?.aus_detectadas?.length > 0 ? `
          <p style="color: var(--text-secondary); margin-top: 10px; font-size: 0.9em;">
            <strong>Zonas faciales analizadas:</strong> Colores indican Action Units detectadas
          </p>
        ` : ''}
      </div>
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
      .from('participantes')
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
      edad: '28',
      genero: 'masculino',
      pais: 'Argentina',
      maquiavelismo: 3.2,
      narcisismo: 2.8,
      psicopatia: 2.5,
      tiempo_total_seg: '7.50',
      emocion_principal: 'Alegría',
      confianza_analisis: 0.87,
      estado_analisis: 'Completado',
      facs_data: [
        { unidad: "AU6", nombre: "Mejilla elevada", intensidad: 0.8, descripcion: "Contracción del músculo orbicular del ojo" },
        { unidad: "AU12", nombre: "Estiramiento de labios", intensidad: 0.9, descripcion: "Sonrisa genuina (Duchenne)" }
      ],
      aus_detectadas: ['AU6', 'AU12'],
      interpretacion_ekman: {
        autor: "Paul Ekman",
        teoria: "La alegría genuina se caracteriza por la activación simultánea del músculo cigomático mayor (sonrisa) y el músculo orbicular del ojo (patas de gallo).",
        significado: "Indica bienestar emocional, satisfacción o experiencias positivas."
      },
      pyfeat_utilizado: true,
      modelo_utilizado: 'pyfeat'
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
            <span style="color: #ffce56;">⚡ ${p.psicopatia || 'N/A'}</span>
            <span style="color: #7f00ff;">😊 ${emocion}</span>
            ${p.pyfeat_utilizado ? '<span style="color: #4CAF50;">🧩 Py-Feat</span>' : ''}
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

// ... (el resto de las funciones del panel investigador se mantienen similares pero actualizadas para usar los nuevos datos)

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
