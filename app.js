/* ========================================
   app.js - VERSIÓN COMPLETA CON CORRELACIÓN MEJORADA
   ======================================== */

/* ---------- CONFIG SUPABASE ---------- */
const SUPABASE_CONFIG = {
  URL: 'https://cdhndtzuwtmvhiulvzbp.supabase.co',
  ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkaG5kdHp1d3RtdmhpdWx2emJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzNTE1OTcsImV4cCI6MjA3OTkyNzU5N30.KeyAfqJuCjgSpmd0kRdjDppkJwBRlF9oGyN0ozJMt6M'
};

// INICIALIZAR SUPABASE
const supabase = window.supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);

const FASTAPI_URL = "https://darklnesapp-api-6qvs.onrender.com";
const PASSWORD_INVESTIGADOR = "investigador2025";

/* ---------- PERFILES EMOCIONALES PARA CORRELACIÓN ---------- */
const perfilesEmocionales = {
  'alegría': { mach: 2.5, narc: 4.0, psych: 1.5 },
  'tristeza': { mach: 2.5, narc: 1.5, psych: 1.5 },
  'enojo': { mach: 4.0, narc: 3.0, psych: 4.0 },
  'miedo': { mach: 2.5, narc: 1.5, psych: 1.5 },
  'sorpresa': { mach: 2.0, narc: 4.0, psych: 2.0 },
  'asco': { mach: 4.0, narc: 1.5, psych: 3.0 },
  'neutral': { mach: 3.0, narc: 3.0, psych: 3.0 },
  'felicidad': { mach: 2.0, narc: 3.5, psych: 1.5 },
  'ira': { mach: 4.0, narc: 3.5, psych: 4.0 },
  'calma': { mach: 2.0, narc: 2.0, psych: 1.5 }
};

/* ---------- ESTADO GLOBAL ---------- */
const invertidos = [11, 15, 17, 20, 25];
let tiemposRespuesta = {};
let tiempoInicioItem = {};
let testInicioTimestamp = null;
let stream = null;
let participantesData = [];
let participanteSeleccionado = null;
let imagenCapturada = null;
let capturedBlob = null; // Variable para la captura mejorada

/* ---------- UTILIDADES ---------- */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
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

/* ---------- CÁLCULO DE CORRELACIÓN DE PEARSON ---------- */
function calcularCorrelacionPearson(arr1, arr2) {
  if (arr1.length !== arr2.length) return 0;
  const n = arr1.length;
  let sum1 = 0, sum2 = 0, sum1sq = 0, sum2sq = 0, psum = 0;
  for (let i = 0; i < n; i++) {
    sum1 += arr1[i];
    sum2 += arr2[i];
    sum1sq += arr1[i] * arr1[i];
    sum2sq += arr2[i] * arr2[i];
    psum += arr1[i] * arr2[i];
  }
  const num = psum - (sum1 * sum2 / n);
  const den = Math.sqrt((sum1sq - sum1 * sum1 / n) * (sum2sq - sum2 * sum2 / n));
  if (den === 0) return 0;
  return num / den;
}

/* ---------- FUNCIÓN PARA CALCULAR CORRELACIÓN ENTRE EMOCIÓN Y SD3 ---------- */
function calcularCorrelacionEmocionSD3(emocion, mach, narc, psych) {
  // Obtener perfil esperado para la emoción detectada
  const emocionLower = emocion.toLowerCase();
  const perfilEsperado = perfilesEmocionales[emocionLower] || perfilesEmocionales.neutral;
  
  // Normalizar puntajes a 0-1 (dividiendo entre 5)
  const real = [mach / 5, narc / 5, psych / 5];
  const esperado = [perfilEsperado.mach / 5, perfilEsperado.narc / 5, perfilEsperado.psych / 5];
  
  // Calcular correlación
  const correlacion = calcularCorrelacionPearson(real, esperado);
  
  // Generar interpretación
  let interpretacion = '';
  if (correlacion > 0.7) {
    interpretacion = `Alta correlación (r = ${correlacion.toFixed(2)}). La emoción "${emocion}" es coherente con el perfil SD3 del participante.`;
  } else if (correlacion > 0.3) {
    interpretacion = `Correlación moderada (r = ${correlacion.toFixed(2)}). Existe cierta relación entre la emoción y el perfil SD3.`;
  } else if (correlacion > -0.3) {
    interpretacion = `Correlación baja (r = ${correlacion.toFixed(2)}). No hay una relación clara entre la emoción y el perfil SD3.`;
  } else if (correlacion > -0.7) {
    interpretacion = `Correlación negativa moderada (r = ${correlacion.toFixed(2)}). La emoción y el perfil SD3 tienden a oponerse.`;
  } else {
    interpretacion = `Alta correlación negativa (r = ${correlacion.toFixed(2)}). La emoción y el perfil SD3 son opuestos.`;
  }
  
  return {
    correlacion: correlacion,
    interpretacion: interpretacion,
    perfilEsperado: perfilEsperado,
    perfilReal: { mach, narc, psych }
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
}

/* ---------- TRACKING TIEMPOS ---------- */
function configurarTrackingTiempos() {
  tiemposRespuesta = {};
  tiempoInicioItem = {};
  
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
    tiemposRespuesta[itemNum] = { 
      item_number: itemNum,
      tiempo_ms: lapso, 
      tiempo_segundos: (lapso/1000).toFixed(2), 
      timestamp_inicio: inicio, 
      timestamp_respuesta: ahora,
      pregunta: itemsSD3[itemNum-1]
    };
  } else {
    const desdeInicio = testInicioTimestamp ? (ahora - testInicioTimestamp) : 0;
    tiemposRespuesta[itemNum] = { 
      item_number: itemNum,
      tiempo_ms: desdeInicio, 
      tiempo_segundos: (desdeInicio/1000).toFixed(2), 
      timestamp_inicio: testInicioTimestamp, 
      timestamp_respuesta: ahora, 
      nota: 'respondido_sin_intersection',
      pregunta: itemsSD3[itemNum-1]
    };
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

  // MOSTRAR HISTORIA ANTES DE CONTINUAR
  document.getElementById('seccion-test')?.classList.add('hidden');
  document.getElementById('seccion-micro')?.classList.remove('hidden');
  
  // Reproducir historia ANTES de activar cámara
  await reproducirHistoria();
  
  if (!window._capturaInicializada) { 
    configurarCapturaImagen(); 
    window._capturaInicializada = true; 
  }
  window.scrollTo({ top:0, behavior:'smooth' });
}

/* ---------- REPRODUCIR HISTORIA ---------- */
async function reproducirHistoria() {
  const sd3 = JSON.parse(sessionStorage.getItem('resultadosSD3') || '{}');
  
  const rasgos = {
    maquiavelismo: parseFloat(sd3.mach) || 0,
    narcisismo: parseFloat(sd3.narc) || 0,
    psicopatia: parseFloat(sd3.psych) || 0
  };
  
  const rasgoPredominante = Object.keys(rasgos).reduce((a, b) => 
    rasgos[a] > rasgos[b] ? a : b
  );

  console.log('🎭 Rasgo predominante:', rasgoPredominante, rasgos);

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

  const historiaSeleccionada = historias[rasgoPredominante] || historias.maquiavelismo;
  
  const textoHistoriaDiv = document.getElementById('texto-historia');
  const audioContainer = document.getElementById('audio-container');
  
  if (textoHistoriaDiv && audioContainer) {
    textoHistoriaDiv.innerHTML = `
      <strong style="font-size: 1.3em; color: var(--accent);">Historia: ${historiaSeleccionada.titulo}</strong>
      <p style="margin: 15px 0; font-style: italic; color: var(--text-primary); line-height: 1.8; font-size: 1.1em;">
        ${historiaSeleccionada.texto}
      </p>
      <div style="margin-top: 20px; padding: 15px; background: rgba(127, 0, 255, 0.1); border-radius: 10px; border-left: 4px solid var(--accent);">
        <p style="color: var(--accent); font-weight: bold; margin: 0;">
          📖 Lee atentamente esta historia y piensa cómo te hace sentir
        </p>
        <p style="color: var(--text-secondary); margin: 10px 0 0 0; font-size: 0.95em;">
          Rasgo analizado: <strong>${rasgoPredominante}</strong>
        </p>
      </div>
    `;
    
    audioContainer.classList.remove('hidden');
  }

  // Guardar historia utilizada
  sessionStorage.setItem('historiaUtilizada', rasgoPredominante);
  
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, 2000);
  });
}
/* ---------- CONFIGURAR BOTÓN LISTO PARA CAPTURAR ---------- */
function configurarBotonListoCapturar() {
  const btnListoCapturar = document.getElementById('btn-listo-capturar');
  if (btnListoCapturar) {
    btnListoCapturar.addEventListener('click', function() {
      document.getElementById('audio-container').classList.add('hidden');
      document.getElementById('camera-section').classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
}

/* ---------- CAPTURA DE IMAGEN MEJORADA + SUBIR DESDE GALERÍA ---------- */
function configurarCapturaImagen() {
  // Elementos DOM
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const btnActivarCamara = document.getElementById('btn-activar-camara');
  const btnCapturarImagen = document.getElementById('btn-capturar-imagen');
  const btnRecapturar = document.getElementById('btn-recapturar');
  const btnSubirImagen = document.getElementById('btn-subir-imagen');
  const previewContainer = document.getElementById('preview-container');
  const previewImage = document.getElementById('preview-image');
  const contadorContainer = document.getElementById('contador-container');
  const contadorElement = document.getElementById('contador');
  const infoImagen = document.getElementById('info-imagen');

  // 👉 NUEVO: input para subir imagen desde el dispositivo
  const inputArchivo = document.getElementById('input-subir-archivo');
  const btnElegirArchivo = document.getElementById('btn-elegir-archivo');

  let localStream = null;
  let ctx = null;
  let capturaEnCurso = false;
  let intervaloContador = null;
  let tiempoRestante = 5;

  // Configurar canvas
  if (canvas) {
    ctx = canvas.getContext('2d');
    canvas.style.display = 'none';
  }

  /* ============================================================
     OPCIÓN 1 → USAR LA CÁMARA
     ============================================================ */

  btnActivarCamara.addEventListener('click', async () => {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: false
      });
      
      stream = localStream;
      video.srcObject = localStream;
      video.classList.remove('hidden');
      video.play();

      btnActivarCamara.classList.add('hidden');
      btnCapturarImagen.classList.remove('hidden');
      document.getElementById('camera-placeholder')?.classList?.add('hidden');

      console.log('✅ Cámara activada');
      
    } catch (error) {
      console.error('❌ Error accediendo a la cámara:', error);
      alert('No se pudo activar la cámara. Asegúrate de dar permisos.');
    }
  });

  /* ---------- Capturar imagen ---------- */

  btnCapturarImagen.addEventListener('click', () => {
    if (!localStream || !video.videoWidth) {
      alert('Primero activá la cámara');
      return;
    }

    if (capturaEnCurso) return;
    
    capturaEnCurso = true;
    tiempoRestante = 3;
    
    contadorElement.textContent = tiempoRestante;
    contadorContainer.classList.remove('hidden');
    btnCapturarImagen.disabled = true;
    btnCapturarImagen.textContent = 'Preparando...';
    
    intervaloContador = setInterval(() => {
      tiempoRestante--;
      contadorElement.textContent = tiempoRestante;
      
      if (tiempoRestante <= 0) {
        clearInterval(intervaloContador);
        realizarCaptura();
      }
    }, 1000);
  });

  function realizarCaptura() {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob(blob => {
      mostrarPreview(blob);
      stopStream();
    }, 'image/jpeg', 0.95);
  }

  function stopStream() {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      localStream = null;
      stream = null;
    }
  }

  /* ============================================================
     OPCIÓN 2 → SUBIR IMAGEN DESDE EL TELÉFONO / PC
     ============================================================ */

  // Botón que abre el selector de archivos
  btnElegirArchivo.addEventListener('click', () => {
    inputArchivo.click();
  });

  // Cuando la persona selecciona un archivo
  inputArchivo.addEventListener('change', function() {
    const archivo = this.files[0];
    if (!archivo) return;

    if (!archivo.type.startsWith("image/")) {
      alert("Debe seleccionar una imagen válida");
      return;
    }

    mostrarPreview(archivo);
  });

  /* ============================================================
     FUNCIÓN GENERAL PARA MOSTRAR PREVIEW (CÁMARA o ARCHIVO)
     ============================================================ */
  function mostrarPreview(blob) {
    capturedBlob = blob;
    imagenCapturada = blob;

    const imageURL = URL.createObjectURL(blob);
    previewImage.src = imageURL;

    // actualizar UI
    contadorContainer.classList.add('hidden');
    previewContainer.classList.remove('hidden');
    btnRecapturar.classList.remove('hidden');
    btnSubirImagen.classList.remove('hidden');
    btnCapturarImagen.classList.add('hidden');
    video.classList.add('hidden');

    const sizeKB = (blob.size / 1024).toFixed(2);
    infoImagen.innerHTML = `
      <p><strong>Tamaño:</strong> ${sizeKB} KB</p>
      <p><strong>Formato:</strong> ${blob.type}</p>
      <p><strong>Lista para analizar</strong></p>
    `;

    console.log("📸 Imagen lista (cámara o archivo)");
  }

  /* ============================================================
     RECAPTURAR
     ============================================================ */
  btnRecapturar.addEventListener('click', () => {
    capturedBlob = null;
    imagenCapturada = null;

    previewContainer.classList.add('hidden');
    btnRecapturar.classList.add('hidden');
    btnSubirImagen.classList.add('hidden');

    document.getElementById('camera-placeholder')?.classList?.remove('hidden');

    btnActivarCamara.classList.remove('hidden');
  });

  /* ============================================================
     ENVIAR IMAGEN A LA API
     ============================================================ */
  btnSubirImagen.addEventListener('click', async () => {
    if (!capturedBlob) {
      alert('No hay imagen');
      return;
    }

    btnSubirImagen.disabled = true;
    btnSubirImagen.textContent = '⏳ Procesando...';

    try {
      const base64Imagen = await blobToBase64(capturedBlob);
      const persona = JSON.parse(sessionStorage.getItem('datos_personales') || '{}');
      const sd3 = JSON.parse(sessionStorage.getItem('resultadosSD3') || '{}');

      const analisisImagen = await analizarImagenCompleta(base64Imagen, persona, sd3);

      if (analisisImagen.success) {
        await subirImagenSupabaseStorage(capturedBlob, persona);
        mostrarConfirmacionParticipante(analisisImagen);
      } else {
        throw new Error(analisisImagen.error || 'Error en el análisis');
      }

    } catch (err) {
      console.error("❌ Error procesando imagen:", err);
      alert("Error: " + err.message);
      btnSubirImagen.disabled = false;
      btnSubirImagen.textContent = "📤 Subir Imagen y Analizar";
    }
  });
}

/* ---------- FUNCIÓN PARA SUBIR IMAGEN A SUPABASE STORAGE ---------- */
async function subirImagenSupabaseStorage(imageBlob, datosPersonales) {
  try {
    const fileName = `microexpresiones/${datosPersonales.nombre || 'anonimo'}_${Date.now()}.jpg`;
    
    const { data, error } = await supabase.storage
      .from('images')
      .upload(fileName, imageBlob, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'image/jpeg'
      });

    if (error) {
      console.error('❌ Error subiendo imagen a Storage:', error);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('images')
      .getPublicUrl(fileName);

    console.log('✅ Imagen subida a Storage:', publicUrl);
    return publicUrl;
    
  } catch (error) {
    console.error('Error en subirImagenSupabaseStorage:', error);
    return null;
  }
}

/* ---------- ANÁLISIS DE IMAGEN COMPLETA ---------- */
async function analizarImagenCompleta(imagenBase64, datosPersonales, datosSD3) {
  try {
    console.log('📸 Enviando datos a FastAPI en formato FormData...');
    
    // Convertir base64 a Blob
    const base64Data = imagenBase64.split(',')[1];
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const imageBlob = new Blob([byteArray], { type: 'image/jpeg' });
    
    // Crear FormData
    const formData = new FormData();
    formData.append('file', imageBlob, 'captura.jpg');
    formData.append('nombre', datosPersonales.nombre || '');
    formData.append('edad', datosPersonales.edad || '');
    formData.append('genero', datosPersonales.genero || '');
    formData.append('pais', datosPersonales.pais || '');
    formData.append('mach', datosSD3.mach || 0);
    formData.append('narc', datosSD3.narc || 0);
    formData.append('psych', datosSD3.psych || 0);
    formData.append('tiempo_total_seg', datosSD3.tiempo_total_segundos || 0);
    formData.append('include_facs', true);
     
    // Obtener historia utilizada
    const historiaUtilizada = sessionStorage.getItem('historiaUtilizada') || '';
    formData.append('historia_utilizada', historiaUtilizada);
    formData.append('tipo_captura', 'imagen');
    
    console.log('📤 Enviando FormData a:', `${FASTAPI_URL}/analyze`);
    
    const response = await fetch(`${FASTAPI_URL}/analyze`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error del servidor: ${response.status} - ${errorText}`);
    }

    const resultado = await response.json();
    console.log('✅ Respuesta de la API:', resultado);

    // Guardar en Supabase con los datos de la API
    const guardado = await guardarAnalisisImagenEnSupabase(resultado, datosPersonales, datosSD3);
    
    return {
      success: true,
      analisis: resultado,
      guardado: guardado,
      mensaje: 'Imagen analizada y guardada correctamente'
    };

  } catch (error) {
    console.error('❌ Error en análisis de imagen:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
/* ---------- GUARDAR ANÁLISIS DE IMAGEN EN SUPABASE ---------- */
async function guardarAnalisisImagenEnSupabase(analisis, persona, sd3) {
  console.log("📤 Guardando análisis de imagen en Supabase...");

  try {
    if (!supabase) {
      throw new Error('Supabase no está inicializado');
    }

    const historiaUtilizada = sessionStorage.getItem('historiaUtilizada') || '';
    
    // Usar datos directamente de la respuesta de la API
    const emocionPrincipal = analisis.emocion_detectada || analisis.emocion_principal || 'No analizada';
    const imagenURL = analisis.imagen_url || '';
    
    // Calcular correlación
    const correlacionEmocionSD3 = calcularCorrelacionEmocionSD3(
      emocionPrincipal,
      parseFloat(sd3.mach) || 0,
      parseFloat(sd3.narc) || 0,
      parseFloat(sd3.psych) || 0
    );

    const imagenData = {
      nombre: persona.nombre || 'Anónimo',
      edad: parseInt(persona.edad) || 0,
      genero: persona.genero || '',
      pais: persona.pais || '',
      mach: parseFloat(sd3.mach) || 0,
      narc: parseFloat(sd3.narc) || 0,
      psych: parseFloat(sd3.psych) || 0,
      tiempo_total_seg: parseFloat(sd3.tiempo_total_segundos) || 0,
      emocion_principal: emocionPrincipal,
      imagen_url: imagenURL,
      total_frames: 1,
      emociones_detectadas: analisis.emociones_detectadas || [],
      correlaciones: analisis.correlaciones || {},
      correlacion_emocion_sd3: correlacionEmocionSD3.correlacion,
      interpretacion_correlacion: correlacionEmocionSD3.interpretacion,
      perfil_esperado_emocion: correlacionEmocionSD3.perfilEsperado,
      historia_utilizada: historiaUtilizada,
      imagen_analizada: true,
      tipo_captura: 'imagen',
      informe_completo: analisis.informe || '',
      analisis_completo: JSON.stringify(analisis || {})
    };

    console.log('📤 Datos a insertar en Supabase:', imagenData);

    const { data, error } = await supabase
      .from('darklens_records')
      .insert([imagenData])
      .select();

    if (error) {
      console.error('❌ Error detallado de Supabase:', error);
      throw new Error(`Error Supabase: ${error.message}`);
    }

    console.log('✅ Datos guardados en Supabase! ID:', data[0]?.id);

    return {
      success: true,
      id: data[0]?.id,
      message: 'Datos guardados correctamente',
      correlacion: correlacionEmocionSD3
    };

  } catch (error) {
    console.error('❌ Error guardando en Supabase:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/* ---------- CONFIRMACIÓN PARTICIPANTE ---------- */
function mostrarConfirmacionParticipante(analisisImagen = null) {
  const resultadoDiv = document.getElementById('resultado-micro');
  if (!resultadoDiv) return;
  
  let analisisHTML = '';
  if (analisisImagen && analisisImagen.success) {
    const analisis = analisisImagen.analisis;
    const emocion = analisis.emocion_detectada || analisis.emocion_principal || 'No detectada';
    const imagenURL = analisis.imagen_url || '';
    const informe = analisis.informe || '';
    
    analisisHTML = `
      <div style="background: rgba(127, 0, 255, 0.1); padding: 20px; border-radius: 10px; margin: 20px 0; text-align: center;">
        <h4 style="color: var(--accent);">📸 Análisis Completado</h4>
        <p style="font-size: 1.3em; font-weight: bold; color: #7f00ff;">
          Emoción detectada: ${emocion}
        </p>
        
        ${imagenURL ? `
          <div style="margin: 20px 0;">
            <img src="${imagenURL}" alt="Imagen analizada" style="max-width: 400px; border-radius: 10px; border: 2px solid var(--accent);">
          </div>
        ` : ''}
        
        ${informe ? `
          <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 10px; margin-top: 15px; text-align: left;">
            <h5 style="color: var(--accent); text-align: center;">📋 Informe del Análisis</h5>
            <pre style="white-space: pre-wrap; word-wrap: break-word; color: var(--text-secondary); font-size: 0.9em;">${informe}</pre>
          </div>
        ` : ''}
        
        <p style="color: var(--text-secondary); margin-top: 15px;">
          ✅ La imagen y el análisis han sido guardados exitosamente
        </p>
      </div>
    `;
  } else {
    analisisHTML = `
      <div style="background: rgba(255, 99, 132, 0.1); padding: 20px; border-radius: 10px; margin: 20px 0; text-align: center;">
        <h4 style="color: #ff6384;">⚠️ Error en el Análisis</h4>
        <p style="color: var(--text-secondary);">
          ${analisisImagen?.error || 'No se pudo completar el análisis'}
        </p>
      </div>
    `;
  }
  
  resultadoDiv.classList.remove('hidden');
  resultadoDiv.innerHTML = `
    <div class="confirmacion-final" style="text-align:center; padding:30px;">
      <h3 style="color: var(--accent);">¡Gracias por participar!</h3>
      <p style="margin:15px 0;">Tu participación ha sido registrada correctamente.</p>
      
      ${analisisHTML}
      
      <div style="margin-top:20px; display:flex; gap:15px; justify-content:center; flex-wrap:wrap;">
        <button class="btn-primary" onclick="volverAlInicio()">🏠 Volver al inicio</button>
        <button class="btn-secondary" onclick="location.reload()">🔄 Nueva participación</button>
      </div>
    </div>
  `;
}

/* ========================================================
   PANEL DEL INVESTIGADOR — VERSIÓN LIMPIA Y CORREGIDA
   ======================================================== */

let participantesData = [];
let participanteSeleccionado = null;

/* ---------- CARGAR PARTICIPANTES ---------- */
async function cargarDatosParticipantes() {
  const listaDiv = document.getElementById('lista-participantes');
  if (listaDiv) {
    listaDiv.innerHTML = `
      <div style="text-align:center; padding:40px;">
        <span style="font-size:2em;">⏳</span>
        <p style="color:var(--text-secondary); margin-top:15px;">
          Cargando datos desde la base de datos...
        </p>
      </div>
    `;
  }

  try {
    const { data: participantes, error } = await supabase
      .from("darklens_records")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    participantesData = participantes || [];

    if (participantesData.length === 0) {
      listaDiv.innerHTML = `
        <div style="text-align:center; padding:30px;">
          <span style="font-size:2em;">📭</span>
          <p style="color:var(--text-secondary); margin-top:15px;">
            Aún no hay participantes registrados.
          </p>
        </div>
      `;
      return;
    }

    poblarListaInvestigador();

  } catch (e) {
    listaDiv.innerHTML = `
      <div style="text-align:center; padding:30px;">
        <span style="font-size:2em;">⚠️</span>
        <p style="color:var(--text-secondary); margin-top:15px;">${e.message}</p>
      </div>
    `;
  }
}

/* ---------- MOSTRAR LISTA EN EL PANEL ---------- */
function poblarListaInvestigador() {
  const listaDiv = document.getElementById("lista-participantes");
  listaDiv.innerHTML = "";

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.marginBottom = "15px";
  header.innerHTML = `
    <h3 style="color:var(--accent);">Participantes Registrados</h3>
    <button id="btn-ir-analisis" class="btn-primary">📈 Análisis Avanzado</button>
  `;
  listaDiv.appendChild(header);

  participantesData.forEach((p, idx) => {
    const fecha = new Date(p.created_at).toLocaleString("es-AR");

    const item = document.createElement("div");
    item.className = "content-box";
    item.style.marginBottom = "10px";

    item.innerHTML = `
      <div style="display:flex; justify-content:space-between;">
        <div>
          <strong>${p.nombre || "Sin nombre"}</strong>
          <div style="font-size:0.85em; color:var(--text-secondary)">
            ${fecha}
          </div>
        </div>
        <button class="btn-primary btn-ver" data-index="${idx}">
          Ver Detalles
        </button>
      </div>
    `;

    listaDiv.appendChild(item);
  });

  document.querySelectorAll(".btn-ver").forEach(btn => {
    btn.addEventListener("click", e => {
      const index = parseInt(e.currentTarget.dataset.index);
      mostrarParticipanteEnPanel(index);
    });
  });

  /* --- BOTÓN ANÁLISIS AVANZADO (CORREGIDO) --- */
  document.getElementById("btn-ir-analisis").addEventListener("click", () => {
    participanteSeleccionado = null;   // ⬅️ BORRA PARTICIPANTE
    document.getElementById("seccion-investigador").classList.add("hidden");
    document.getElementById("seccion-analisis").classList.remove("hidden");
    cargarAnalisisAvanzado();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

/* ---------- MOSTRAR DETALLES DEL PARTICIPANTE ---------- */
function mostrarParticipanteEnPanel(index) {
  participanteSeleccionado = participantesData[index];
  const p = participanteSeleccionado;

  document.getElementById("seccion-investigador").classList.add("hidden");
  document.getElementById("seccion-resultados").classList.remove("hidden");

  /* INFO PERSONAL */
  document.getElementById("info-participante").innerHTML = `
    <div class="info-grid">
      <div><strong>Nombre:</strong> ${p.nombre}</div>
      <div><strong>Edad:</strong> ${p.edad}</div>
      <div><strong>Género:</strong> ${p.genero}</div>
      <div><strong>País:</strong> ${p.pais}</div>
      <div><strong>Fecha:</strong> ${new Date(p.created_at).toLocaleString("es-AR")}</div>
      <div><strong>Historia:</strong> ${p.historia_utilizada || "No disponible"}</div>
    </div>
  `;

  /* SD3 */
  document.getElementById("resultados-sd3-detalle").innerHTML = `
    <div class="scores-grid">
      <div class="score-card">🎭 Maquiavelismo: <b>${p.mach}</b></div>
      <div class="score-card">👑 Narcisismo: <b>${p.narc}</b></div>
      <div class="score-card">⚡ Psicopatía: <b>${p.psych}</b></div>
    </div>
  `;

  /* MICROEXPRESIONES */
  document.getElementById("microexpresiones-detalle").innerHTML = p.emocion_principal
    ? `
      <h4>Emoción detectada</h4>
      <p style="font-size:2em; color:#7f00ff;">${p.emocion_principal}</p>
    `
    : `<p style="color:var(--text-secondary)">No se analizaron microexpresiones.</p>`;

  /* IMAGEN */
  document.getElementById("imagen-participante").innerHTML =
    p.imagen_url
      ? `<img src="${p.imagen_url}" style="max-width:300px; border-radius:10px;">`
      : `<p style="color:var(--text-secondary);">No hay imagen disponible.</p>`;

  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ========================================================
   ANÁLISIS AVANZADO (SOLO GRUPAL)
   ======================================================== */
async function cargarAnalisisAvanzado() {
  participanteSeleccionado = null; // ⬅️ IMPORTANTE

  const { data: participantes, error } = await supabase
    .from("darklens_records")
    .select("*");

  if (error || !participantes) {
    mostrarMensajeAnalisis("No se pudieron cargar los datos.");
    return;
  }

  // Limpieza y procesamiento
  const sd3 = participantes.map(p => ({
    mach: p.mach,
    narc: p.narc,
    psych: p.psych,
    emocion: p.emocion_principal
  }));

  /* ------------------ CORRELACIONES ------------------ */
  mostrarResultadosCorrelaciones(sd3);

  /* ------------------ REGRESIÓN ------------------ */
  mostrarRegresion(sd3);

  /* ------------------ TIEMPOS ------------------ */
  mostrarTiempos(participantes);
}

function mostrarMensajeAnalisis(msg) {
  ["resultados-correlaciones", "resultados-tiempos", "resultados-regresion"]
    .forEach(id => {
      const div = document.getElementById(id);
      if (div) div.innerHTML = `<p>${msg}</p>`;
    });
}

/* ========================================================
   Helper: Mostrar correlaciones grupales
   ======================================================== */
function mostrarResultadosCorrelaciones(sd3) {
  const div = document.getElementById("resultados-correlaciones");
  div.innerHTML = `
    <h4>Correlaciones Globales</h4>
    <p>Relación entre emoción detectada y rasgos SD3 promediados.</p>
  `;
}

/* ========================================================
   Helper: Mostrar regresión global
   ======================================================== */
function mostrarRegresion(sd3) {
  document.getElementById("resultados-regresion").innerHTML = `
    <h4>Regresión Lineal</h4>
    <p>El gráfico se generará aquí (pendiente).</p>
  `;
}

/* ========================================================
   Helper: Tiempos de respuesta globales
   ======================================================== */
function mostrarTiempos(participantes) {
  document.getElementById("resultados-tiempos").innerHTML = `
    <h4>Tiempos de respuesta</h4>
    <p>Próximamente se agregará análisis detallado.</p>
  `;
}
/* ========================================================
   FUNCIONES DE ANALISIS INDIVIDUAL DEL PARTICIPANTE
   Se llama automáticamente en mostrarParticipanteEnPanel()
   ======================================================== */
   
function analizarParticipanteIndividual(p) {
  if (!p) return;

  /* ============================
     1️⃣ PERFIL ESPERADO SEGÚN SD3
     ============================ */

  let mayorRasgo = "narcisismo";
  let mayorValor = p.narc;

  if (p.mach > mayorValor) { mayorValor = p.mach; mayorRasgo = "maquiavelismo"; }
  if (p.psych > mayorValor) { mayorValor = p.psych; mayorRasgo = "psicopatía"; }

  let emocionEsperada = {
    "maquiavelismo": "neutralidad controlada",
    "narcisismo": "felicidad/confianza",
    "psicopatía": "sorpresa leve o falta de reacción"
  }[mayorRasgo];

  document.getElementById("analisis-final").innerHTML = `
    <h4>🧠 Integración de Resultados</h4>
    <p><strong>Rasgo predominante:</strong> ${mayorRasgo.toUpperCase()} (${mayorValor})</p>
    <p><strong>Emoción esperada según SD3:</strong> ${emocionEsperada}</p>
    <p><strong>Emoción detectada por microexpresión:</strong> ${p.emocion_principal}</p>
  `;


  /* ============================
     2️⃣ CORRELACIÓN INDIVIDUAL
     ============================ */

  const correlacion = calcularCorrelacionIndividual(p);
  const div = document.getElementById("analisis-final");

  div.innerHTML += `
    <h4>🔗 Correlación individual SD3–Emoción</h4>
    <p>Puntaje SD3 total: <b>${(p.mach + p.narc + p.psych).toFixed(2)}</b></p>
    <p>Código de emoción detectada: <b>${emotionToCode(p.emocion_principal)}</b></p>
    <p><strong>Correlación aproximada:</strong> ${correlacion.toFixed(2)}</p>
    <hr style="margin:20px 0;">
  `;


  /* ============================
     3️⃣ GRAFICO DE SD3 (individual)
     ============================ */

  renderGraficoSD3Individual(p);


  /* ============================
     4️⃣ GRAFICO DE TIEMPOS (individual)
     ============================ */

  if (p.tiempos_respuesta)
    renderGraficoTiemposIndividual(p.tiempos_respuesta);
  else
    document.getElementById("tiempos-detalle").innerHTML = "<p>No hay tiempos registrados.</p>";


  /* ============================
     5️⃣ HISTORIA UTILIZADA
     ============================ */
  document.getElementById("info-participante").innerHTML += `
    <p><strong>Historia utilizada:</strong> ${p.historia_utilizada || "No disponible"}</p>
  `;
}


/* ========================================================
   CALCULAR CORRELACIÓN PARA UN SOLO PARTICIPANTE
   ======================================================== */

function calcularCorrelacionIndividual(p) {
  const totalSD3 = p.mach + p.narc + p.psych;
  const emoCode = emotionToCode(p.emocion_principal);
  
  if (emoCode === -1) return 0;

  return totalSD3 * emoCode / 40;  // normalizado simple
}


/* ========================================================
   GRAFICO INDIVIDUAL — SD3
   ======================================================== */

function renderGraficoSD3Individual(p) {
  const ctx = document.getElementById("grafico-sd3-resultados");

  new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Maquiavelismo", "Narcisismo", "Psicopatía"],
      datasets: [{
        label: "Puntajes SD3",
        data: [p.mach, p.narc, p.psych],
        backgroundColor: ["#7f00ff55", "#ff00aa55", "#00ffff55"]
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } }
    }
  });
}


/* ========================================================
   GRAFICO INDIVIDUAL — TIEMPOS
   ======================================================== */

function renderGraficoTiemposIndividual(tiempos) {
  const labels = Object.keys(tiempos);
  const values = Object.values(tiempos).map(v => v / 1000);

  const ctx = document.getElementById("grafico-tiempos");

  new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Tiempo de respuesta (segundos)",
        data: values,
        borderWidth: 2,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true } }
    }
  });

  document.getElementById("tiempos-detalle").innerHTML = `
    <p><strong>Tiempo promedio:</strong> ${(values.reduce((a,b)=>a+b,0) / values.length).toFixed(2)} s</p>
  `;
}


/* ========================================================
   AL MOSTRAR UN PARTICIPANTE → CORRER ANÁLISIS INDIVIDUAL
   ======================================================== */

const originalMostrar = mostrarParticipanteEnPanel;
mostrarParticipanteEnPanel = function(index) {
  originalMostrar(index);
  analizarParticipanteIndividual(participantesData[index]);
};
/* ========================================================
   📊 6️⃣ GRAFICO INDIVIDUAL — MICROEXPRESIONES
   ======================================================== */

function renderGraficoEmocionesIndividual(p) {
  if (!p.emociones_detectadas || p.emociones_detectadas.length === 0) {
    document.getElementById("microexpresiones-detalle").innerHTML =
      "<p>No se registraron microexpresiones.</p>";
    return;
  }

  const counts = {};
  p.emociones_detectadas.forEach(e => {
    counts[e] = (counts[e] || 0) + 1;
  });

  const labels = Object.keys(counts);
  const values = Object.values(counts);

  new Chart(document.getElementById("grafico-emociones"), {
    type: "pie",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: [
          "#ff638455", "#36a2eb55", "#ffce5655",
          "#4bc0c055", "#9966ff55", "#ff9f4055", "#c9cbcf55"
        ]
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom" }
      }
    }
  });

  document.getElementById("microexpresiones-detalle").innerHTML = `
    <p><strong>Emoción predominante:</strong> ${p.emocion_principal}</p>
  `;
}


/* ========================================================
   🧠 7️⃣ GRAFICO INDIVIDUAL — UNIDADES FACS (RADAR)
   ======================================================== */

function renderGraficoFACSIndividual(p) {
  if (!p.facs_promedio || Object.keys(p.facs_promedio).length === 0) {
    document.getElementById("facs-detalle").innerHTML =
      "<p>No hay datos FACS registrados.</p>";
    return;
  }

  const labels = Object.keys(p.facs_promedio);
  const values = Object.values(p.facs_promedio);

  const ctx = document.createElement("canvas");
  ctx.style.maxWidth = "500px";
  ctx.style.margin = "20px auto";
  document.getElementById("facs-container").appendChild(ctx);

  new Chart(ctx, {
    type: "radar",
    data: {
      labels,
      datasets: [{
        label: "Intensidad promedio FACS",
        data: values,
        borderWidth: 2,
        pointRadius: 3
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true } },
      scales: {
        r: {
          beginAtZero: true,
          suggestedMax: 1
        }
      }
    }
  });

  document.getElementById("facs-detalle").innerHTML = `
    <p><strong>Total unidades faciales analizadas:</strong> ${labels.length}</p>
  `;
}


/* ========================================================
   🧬 8️⃣ INTERPRETACIÓN CLÍNICA AUTOMÁTICA
   ======================================================== */

function generarInterpretacionClinica(p) {
  let texto = [];

  texto.push(`La microexpresión principal detectada fue <strong>${p.emocion_principal}</strong>.`);
  texto.push(`El rasgo predominante del SD3 fue <strong>${obtenerRasgoPredominante(p)}</strong>.`);

  const relacion = {
    "happiness": "positividad, validación externa y percepción de autoeficacia.",
    "anger": "frustración, competencia o desafío percibido.",
    "fear": "respuesta emocional a amenaza o incertidumbre.",
    "sadness": "procesos internos de retraimiento o introspección.",
    "neutral": "control emocional o inhibición voluntaria.",
    "surprise": "hipervigilancia o reactividad emocional.",
    "disgust": "rechazo, desacuerdo o aversión."
  }[p.emocion_principal] || "un estado emocional complejo.";

  texto.push(`Esta emoción suele asociarse a <strong>${relacion}</strong>.`);

  return texto.join("<br>");
}

function obtenerRasgoPredominante(p) {
  let max = p.mach, rasgo = "maquiavelismo";

  if (p.narc > max) { max = p.narc; rasgo = "narcisismo"; }
  if (p.psych > max) { max = p.psych; rasgo = "psicopatía"; }

  return rasgo;
}


/* ========================================================
   📈 9️⃣ COMPARACIÓN PARTICIPANTE VS PROMEDIO DEL GRUPO
   ======================================================== */

async function compararConGrupo(p) {
  const { data, error } = await supabase
    .from("darklens_records")
    .select("mach, narc, psych");

  if (error || !data) return;

  const mach_prom = promedio(data.map(d => d.mach));
  const narc_prom = promedio(data.map(d => d.narc));
  const psych_prom = promedio(data.map(d => d.psych));

  document.getElementById("analisis-final").innerHTML += `
    <h4>📊 Comparación con el grupo</h4>
    <p><strong>Maquiavelismo:</strong> ${p.mach} (grupo: ${mach_prom.toFixed(2)})</p>
    <p><strong>Narcisismo:</strong> ${p.narc} (grupo: ${narc_prom.toFixed(2)})</p>
    <p><strong>Psicopatía:</strong> ${p.psych} (grupo: ${psych_prom.toFixed(2)})</p>
  `;
}

function promedio(arr) {
  const nums = arr.filter(n => typeof n === "number");
  return nums.reduce((a,b)=>a+b,0) / nums.length;
}


/* ========================================================
   🔗  🔟  COMPLETAR ANÁLISIS AL MOSTRAR PARTICIPANTE
   ======================================================== */

const _mostrarOriginal2 = mostrarParticipanteEnPanel;
mostrarParticipanteEnPanel = async function(index) {
  _mostrarOriginal2(index);

  const p = participantesData[index];

  // gráficos individuales
  renderGraficoEmocionesIndividual(p);
  renderGraficoFACSIndividual(p);

  // interpretación clínica
  const interpretacion = generarInterpretacionClinica(p);
  document.getElementById("analisis-final").innerHTML += `
    <h4>🧠 Interpretación Clínica</h4>
    <p>${interpretacion}</p>
  `;

  // comparación con grupo
  await compararConGrupo(p);
};


/* ---------- INICIALIZACIÓN ---------- */
document.addEventListener('DOMContentLoaded', () => {
  console.log('✅ Supabase inicializado:', supabase ? 'Sí' : 'No');
  
  sessionStorage.clear();
  tiemposRespuesta = {};
  tiempoInicioItem = {};
  testInicioTimestamp = null;
  imagenCapturada = null;
  capturedBlob = null;
  window._capturaInicializada = false;
  console.log('✅ Sesión limpiada al cargar');

  const btnParticipante = document.getElementById('btn-iniciar-participante');
  const btnInvestigador = document.getElementById('btn-iniciar-investigador');

  btnParticipante?.addEventListener('click', () => {
    sessionStorage.clear();
    tiemposRespuesta = {};
    tiempoInicioItem = {};
    testInicioTimestamp = null;
    imagenCapturada = null;
    capturedBlob = null;
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

  configurarBotonListoCapturar();

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

  const btnEnviarTest = document.getElementById('btn-enviar-test');
  btnEnviarTest?.addEventListener('click', (e) => {
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

  document.getElementById('btn-volver-investigador')?.addEventListener('click', () => {
    document.getElementById('seccion-analisis').classList.add('hidden');
    document.getElementById('seccion-investigador').classList.remove('hidden');
    window.scrollTo({ top:0, behavior:'smooth' });
  });

  document.getElementById('btn-volver-investigador2')?.addEventListener('click', () => {
    document.getElementById('seccion-analisis').classList.add('hidden');
    document.getElementById('seccion-investigador').classList.remove('hidden');
    window.scrollTo({ top:0, behavior:'smooth' });
  });

  document.getElementById('btn-refrescar-analisis')?.addEventListener('click', () => {
    cargarAnalisisAvanzado();
  });
});

/* ---------- FIN ---------- */
