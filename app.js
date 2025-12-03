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

const FASTAPI_URL = "https://darklnesapp-api-1.onrender.com";
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

/* ---------- CAPTURA DE IMAGEN MEJORADA ---------- */
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

  // 1. Activar cámara
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
      
      if (video) { 
        video.srcObject = localStream; 
        video.classList.remove('hidden'); 
        video.play(); 
      }
      
      btnActivarCamara.classList.add('hidden');
      btnCapturarImagen.classList.remove('hidden');
      document.getElementById('camera-placeholder')?.classList?.add('hidden');
      
      console.log('✅ Cámara activada');
      
    } catch (error) {
      console.error('❌ Error accediendo a la cámara:', error);
      alert('No se pudo activar la cámara. Asegúrate de dar permisos.');
    }
  });

  // 2. Capturar imagen con contador
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

  // Función para realizar la captura
  function realizarCaptura() {
    if (!video || !ctx || !canvas) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob(blob => {
      capturedBlob = blob;
      imagenCapturada = blob;
      
      const imageURL = URL.createObjectURL(blob);
      previewImage.src = imageURL;
      
      contadorContainer.classList.add('hidden');
      previewContainer.classList.remove('hidden');
      btnRecapturar.classList.remove('hidden');
      btnSubirImagen.classList.remove('hidden');
      btnCapturarImagen.classList.add('hidden');
      video.classList.add('hidden');
      
      const sizeKB = (blob.size / 1024).toFixed(2);
      const resolution = `${canvas.width} × ${canvas.height}`;
      infoImagen.innerHTML = `
        <p><strong>Resolución:</strong> ${resolution}</p>
        <p><strong>Tamaño:</strong> ${sizeKB} KB</p>
        <p><strong>Formato:</strong> JPEG (alta calidad)</p>
        <p><strong>Lista para analizar</strong></p>
      `;
      
      stopStream();
      
      capturaEnCurso = false;
      btnCapturarImagen.disabled = false;
      btnCapturarImagen.textContent = '📸 Capturar Imagen';
      
      console.log('✅ Imagen capturada:', { resolution, size: `${sizeKB} KB` });
      
    }, 'image/jpeg', 0.95);
  }

  // 3. Función para detener la cámara
  function stopStream() {
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
      });
      localStream = null;
      stream = null;
    }
  }

  // 4. Recapturar
  btnRecapturar.addEventListener('click', async () => {
    capturedBlob = null;
    imagenCapturada = null;
    
    previewContainer.classList.add('hidden');
    btnRecapturar.classList.add('hidden');
    btnSubirImagen.classList.add('hidden');
    
    document.getElementById('camera-placeholder')?.classList?.remove('hidden');
    btnActivarCamara.classList.remove('hidden');
    
    if (intervaloContador) {
      clearInterval(intervaloContador);
      intervaloContador = null;
    }
    capturaEnCurso = false;
    
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
      
      stream = localStream;
      video.srcObject = localStream;
      video.classList.remove('hidden');
      btnCapturarImagen.classList.remove('hidden');
      btnActivarCamara.classList.add('hidden');
      
    } catch (error) {
      console.error('Error reactivando cámara:', error);
      alert('No se pudo reactivar la cámara');
    }
  });

  // 5. Subir imagen y analizar
  btnSubirImagen.addEventListener('click', async () => {
    if (!capturedBlob) {
      alert('No hay imagen capturada');
      return;
    }

    btnSubirImagen.disabled = true;
    btnSubirImagen.textContent = '⏳ Subiendo y analizando...';

    try {
      const base64Imagen = await blobToBase64(capturedBlob);
      
      const persona = JSON.parse(sessionStorage.getItem('datos_personales') || '{}');
      const sd3 = JSON.parse(sessionStorage.getItem('resultadosSD3') || '{}');

      console.log('📤 Enviando imagen para análisis...');

      const analisisImagen = await analizarImagenCompleta(base64Imagen, persona, sd3);
      
      if (analisisImagen.success) {
        await subirImagenSupabaseStorage(capturedBlob, persona);
        
        mostrarConfirmacionParticipante(analisisImagen);
      } else {
        throw new Error(analisisImagen.error || 'Error en el análisis de la imagen');
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
    console.log('📸 Enviando imagen para análisis a FastAPI...');
    
    const response = await fetch(`${FASTAPI_URL}/analyze-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_data: imagenBase64,
        participant_data: datosPersonales,
        sd3_data: datosSD3
      })
    });

    if (!response.ok) {
      throw new Error(`Error del servidor: ${response.status}`);
    }

    const resultado = await response.json();
    console.log('✅ Análisis de imagen completado:', resultado);

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

    const rasgos = {
      maquiavelismo: parseFloat(sd3.mach) || 0,
      narcisismo: parseFloat(sd3.narc) || 0,
      psicopatia: parseFloat(sd3.psych) || 0
    };
    
    const rasgoPredominante = Object.keys(rasgos).reduce((a, b) => 
      rasgos[a] > rasgos[b] ? a : b
    );

    const historiaUtilizada = sessionStorage.getItem('historiaUtilizada') || rasgoPredominante;
    
    const emocionPrincipal = analisis.emocion_predominante || analisis.emocion_principal || 'No analizada';
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
      total_frames: 1,
      emociones_detectadas: Array.isArray(analisis.emociones_detectadas) 
        ? analisis.emociones_detectadas 
        : Object.keys(analisis.emociones || {}),
      correlaciones: analisis.correlaciones || {},
      correlacion_emocion_sd3: correlacionEmocionSD3.correlacion,
      interpretacion_correlacion: correlacionEmocionSD3.interpretacion,
      perfil_esperado_emocion: correlacionEmocionSD3.perfilEsperado,
      historia_utilizada: historiaUtilizada,
      imagen_analizada: true,
      tipo_captura: 'imagen',
      analisis_completo: JSON.stringify(analisis || {})
    };

    console.log('📤 Datos a insertar:', imagenData);

    const { data, error } = await supabase
      .from('darklens_records')
      .insert([imagenData])
      .select();

    if (error) {
      console.error('❌ Error detallado de Supabase:', error);
      throw new Error(`Error Supabase: ${error.message} (Código: ${error.code})`);
    }

    console.log('✅ Análisis de imagen guardado en Supabase! ID:', data[0]?.id);

    return {
      success: true,
      id: data[0]?.id,
      message: 'Datos de imagen guardados correctamente',
      correlacion: correlacionEmocionSD3
    };

  } catch (error) {
    console.error('❌ Error guardando análisis de imagen en Supabase:', error);
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
    analisisHTML = `
      <div style="background: rgba(127, 0, 255, 0.1); padding: 20px; border-radius: 10px; margin: 20px 0; text-align: center;">
        <h4 style="color: var(--accent);">📸 Análisis de Imagen Completado</h4>
        <p style="font-size: 1.3em; font-weight: bold; color: #7f00ff;">
          Emoción predominante: ${analisis.emocion_predominante || 'No detectada'}
        </p>
        <p style="color: var(--text-secondary); margin-top: 10px;">
          La imagen y análisis han sido guardados en la base de datos
        </p>
      </div>
    `;
  } else {
    analisisHTML = `
      <div style="background: rgba(255, 99, 132, 0.1); padding: 20px; border-radius: 10px; margin: 20px 0; text-align: center;">
        <h4 style="color: #ff6384;">⚠️ Análisis No Disponible</h4>
        <p style="color: var(--text-secondary);">
          El análisis de imagen no pudo completarse, pero tus datos fueron guardados.
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
      
      <div style="margin-top:20px; display:flex; gap:15px; justify-content:center; flex-wrap:wrap;">
        <button class="btn-primary" onclick="volverAlInicio()">🏠 Volver al inicio</button>
        <button class="btn-secondary" onclick="location.reload()">🔄 Nueva participación</button>
      </div>
    </div>
  `;
}

/* ---------- PANEL INVESTIGADOR ---------- */
async function cargarDatosParticipantes() {
  const listaDiv = document.getElementById('lista-participantes');
  if (listaDiv) {
    listaDiv.innerHTML = `
      <div style="text-align: center; padding: 40px;">
        <div style="display: inline-block; padding: 20px; background: rgba(127, 0, 255, 0.1); border-radius: 50%;">
          <span style="font-size: 2em;">⏳</span>
        </div>
        <p style="color: var(--text-secondary); margin-top: 20px;">
          Cargando datos desde la base de datos...
        </p>
      </div>
    `;
  }
  
  try {
    console.log('🔍 Cargando datos desde Supabase...');
    
    const { data: participantes, error } = await supabase
      .from('darklens_records')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('❌ Error de Supabase:', error);
      throw new Error(`Error cargando datos: ${error.message}`);
    }

    participantesData = participantes || [];
    console.log(`✅ ${participantesData.length} participantes cargados desde Supabase`);
    
    if (participantesData.length === 0) {
      if (listaDiv) {
        listaDiv.innerHTML = `
          <div style="text-align: center; padding: 40px;">
            <div style="display: inline-block; padding: 20px; background: rgba(255, 99, 132, 0.1); border-radius: 50%;">
              <span style="font-size: 2em;">📭</span>
            </div>
            <h3 style="color: var(--accent); margin-top: 20px;">No hay participantes registrados</h3>
            <p style="color: var(--text-secondary);">
              Cuando los participantes completen el test SD3 y capturen su imagen, aparecerán aquí.
            </p>
          </div>
        `;
      }
      return;
    }
    
    poblarListaInvestigador();
    
  } catch (err) {
    console.error('❌ Error cargando participantes:', err);
    if (listaDiv) {
      listaDiv.innerHTML = `
        <div style="text-align: center; padding: 40px;">
          <div style="display: inline-block; padding: 20px; background: rgba(255, 99, 132, 0.1); border-radius: 50%;">
            <span style="font-size: 2em;">⚠️</span>
          </div>
          <h3 style="color: #ff6384; margin-top: 20px;">Error cargando datos</h3>
          <p style="color: var(--text-secondary);">${err.message}</p>
          <button class="btn-primary" onclick="cargarDatosParticipantes()" style="margin-top: 20px;">
            🔄 Reintentar
          </button>
        </div>
      `;
    }
  }
}

function poblarListaInvestigador() {
  const listaDiv = document.getElementById('lista-participantes');
  if (!listaDiv) return;
  
  if (!participantesData || participantesData.length === 0) {
    listaDiv.innerHTML = '<p style="text-align:center; color:var(--text-secondary);">No hay participantes registrados.</p>';
    return;
  }
  
  listaDiv.innerHTML = '';
  
  const headerDiv = document.createElement('div');
  headerDiv.style.display = 'flex';
  headerDiv.style.justifyContent = 'space-between';
  headerDiv.style.alignItems = 'center';
  headerDiv.style.marginBottom = '20px';
  headerDiv.style.padding = '0 10px';
  
  headerDiv.innerHTML = `
    <h3 style="color: var(--accent); margin: 0;">Participantes Registrados</h3>
    <div style="display:flex; gap:10px;">
      <button id="btn-descargar-csv" class="btn-primary" style="display: flex; align-items: center; gap: 8px;">
        📊 Descargar CSV (${participantesData.length})
      </button>
      <button id="btn-ir-analisis" class="btn-secondary" style="display: flex; align-items: center; gap: 8px;">
        📈 Análisis Avanzado
      </button>
    </div>
  `;
  
  listaDiv.appendChild(headerDiv);
  
  participantesData.forEach((p, idx) => {
    const fecha = new Date(p.created_at).toLocaleString('es-AR');
    const emocion = p.emocion_principal || 'No analizado';
    const tipo = p.tipo_captura === 'imagen' ? '📸' : '🎬';
    const correlacion = p.correlacion_emocion_sd3 ? `📊 ${parseFloat(p.correlacion_emocion_sd3).toFixed(2)}` : '';
    
    const item = document.createElement('div');
    item.className = 'content-box';
    item.style.margin = '10px';
    item.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
        <div style="flex: 1;">
          <strong>${tipo} ${p.nombre || 'Sin nombre'}</strong>
          <div style="color:var(--text-secondary); font-size:0.9em;">${fecha}</div>
          <div style="display: flex; gap: 15px; margin-top: 8px; font-size: 0.85em;">
            <span style="color: #667eea;">🎭 ${p.mach || 'N/A'}</span>
            <span style="color: #764ba2;">👑 ${p.narc || 'N/A'}</span>
            <span style="color: #ffce56;">⚡ ${p.psych || 'N/A'}</span>
            <span style="color: #7f00ff;">😊 ${emocion}</span>
            ${correlacion ? `<span style="color: #4CAF50;">${correlacion}</span>` : ''}
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

  document.querySelectorAll('#lista-participantes .btn-ver').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.getAttribute('data-index'));
      mostrarParticipanteEnPanel(idx);
    });
  });

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

  document.getElementById('btn-ir-analisis')?.addEventListener('click', () => {
    document.getElementById('seccion-investigador').classList.add('hidden');
    document.getElementById('seccion-analisis').classList.remove('hidden');
    cargarAnalisisAvanzado();
    window.scrollTo({ top:0, behavior:'smooth' });
  });
}

/* ---------- GENERAR CSV ---------- */
async function generarYDescargarCSV() {
  try {
    console.log('📊 Generando CSV...');
    
    const { data: participantes, error } = await supabase
      .from('darklens_records')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Error obteniendo datos: ${error.message}`);
    }

    if (!participantes || participantes.length === 0) {
      alert('No hay datos para exportar');
      return { success: false, error: 'No hay datos' };
    }

    const headers = [
      'ID', 'Fecha', 'Nombre', 'Edad', 'Género', 'País',
      'Maquiavelismo', 'Narcisismo', 'Psicopatia',
      'Tiempo_Total_Seg', 'Emoción_Principal', 'Correlación_Emoción_SD3',
      'Interpretación_Correlación', 'Historia_Utilizada', 'Tipo_Captura',
      'Perfil_Esperado_Maquiavelismo', 'Perfil_Esperado_Narcisismo', 'Perfil_Esperado_Psicopatia'
    ];
    
    const csvRows = [headers.join(',')];
    
    participantes.forEach(p => {
      const perfilEsperado = p.perfil_esperado_emocion || {};
      
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
        p.emocion_principal || '',
        p.correlacion_emocion_sd3 || 0,
        `"${(p.interpretacion_correlacion || '').replace(/"/g, '""')}"`,
        p.historia_utilizada || '',
        p.tipo_captura || 'imagen',
        perfilEsperado.mach || 0,
        perfilEsperado.narc || 0,
        perfilEsperado.psych || 0
      ];
      
      csvRows.push(row.join(','));
    });
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `datos_darklens_${new Date().toISOString().split('T')[0]}.csv`);
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

/* ---------- MOSTRAR PARTICIPANTE EN PANEL ---------- */
function mostrarParticipanteEnPanel(index) {
  if (!participantesData || !participantesData[index]) return;
  
  const p = participantesData[index];
  participanteSeleccionado = p;
  
  const infoDiv = document.getElementById('info-participante');
  if (infoDiv) {
    infoDiv.innerHTML = `
      <div class="info-grid">
        <div class="info-item">
          <strong>Nombre</strong> ${p.nombre || 'No disponible'}
        </div>
        <div class="info-item">
          <strong>Edad</strong> ${p.edad || 'No disponible'}
        </div>
        <div class="info-item">
          <strong>Género</strong> ${p.genero || 'No disponible'}
        </div>
        <div class="info-item">
          <strong>País</strong> ${p.pais || 'No disponible'}
        </div>
        <div class="info-item">
          <strong>Fecha</strong> ${new Date(p.created_at).toLocaleString('es-AR')}
        </div>
        <div class="info-item">
          <strong>Historia utilizada</strong> ${p.historia_utilizada || 'No disponible'}
        </div>
        <div class="info-item">
          <strong>Tipo de captura</strong> ${p.tipo_captura || 'imagen'}
        </div>
      </div>
    `;
  }
  
  const resultadosDiv = document.getElementById('resultados-sd3-detalle');
  if (resultadosDiv) {
    resultadosDiv.innerHTML = `
      <div class="scores-grid">
        <div class="score-card">
          <div class="score-icon">🎭</div>
          <div class="score-label">Maquiavelismo</div>
          <div class="score-value">${p.mach || 0}</div>
          <div class="score-level ${(p.mach || 0) < 2.5 ? 'nivel-bajo' : (p.mach || 0) < 3.5 ? 'nivel-medio' : 'nivel-alto'}">
            ${(p.mach || 0) < 2.5 ? 'Bajo' : (p.mach || 0) < 3.5 ? 'Medio' : 'Alto'}
          </div>
        </div>
        <div class="score-card">
          <div class="score-icon">👑</div>
          <div class="score-label">Narcisismo</div>
          <div class="score-value">${p.narc || 0}</div>
          <div class="score-level ${(p.narc || 0) < 2.5 ? 'nivel-bajo' : (p.narc || 0) < 3.5 ? 'nivel-medio' : 'nivel-alto'}">
            ${(p.narc || 0) < 2.5 ? 'Bajo' : (p.narc || 0) < 3.5 ? 'Medio' : 'Alto'}
          </div>
        </div>
        <div class="score-card">
          <div class="score-icon">⚡</div>
          <div class="score-label">Psicopatía</div>
          <div class="score-value">${p.psych || 0}</div>
          <div class="score-level ${(p.psych || 0) < 2.5 ? 'nivel-bajo' : (p.psych || 0) < 3.5 ? 'nivel-medio' : 'nivel-alto'}">
            ${(p.psych || 0) < 2.5 ? 'Bajo' : (p.psych || 0) < 3.5 ? 'Medio' : 'Alto'}
          </div>
        </div>
      </div>
    `;
  }
  
  const microDiv = document.getElementById('microexpresiones-detalle');
  if (microDiv && p.emocion_principal) {
    const emocion = p.emocion_principal;
    const correlacion = p.correlacion_emocion_sd3 || 0;
    const interpretacion = p.interpretacion_correlacion || '';
    const perfilEsperado = p.perfil_esperado_emocion || {};
    
    microDiv.innerHTML = `
      <div style="text-align: center; padding: 20px;">
        <h4 style="color: var(--accent);">Emoción predominante detectada</h4>
        <p style="font-size: 2em; font-weight: bold; color: #7f00ff;">
          ${emocion}
        </p>
        
        <div style="background: rgba(127, 0, 255, 0.1); padding: 20px; border-radius: 10px; margin: 20px 0;">
          <h5 style="color: var(--accent);">📊 Correlación entre Emoción y Perfil SD3</h5>
          <div style="font-size: 3em; font-weight: bold; color: ${correlacion > 0.7 ? '#4CAF50' : correlacion > 0.3 ? '#FFC107' : '#FF5252'};">
            r = ${parseFloat(correlacion).toFixed(2)}
          </div>
          <p style="color: var(--text-secondary); margin-top: 10px;">${interpretacion}</p>
        </div>
        
        ${p.tipo_captura ? `<p><strong>Tipo de captura:</strong> ${p.tipo_captura}</p>` : ''}
        
        <div style="margin-top: 20px; padding: 15px; background: rgba(30, 30, 50, 0.7); border-radius: 10px;">
          <h5 style="color: var(--accent);">Perfil Esperado para la Emoción "${emocion}"</h5>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 15px;">
            <div style="text-align: center;">
              <div style="font-size: 0.9em; color: var(--text-secondary);">Maquiavelismo</div>
              <div style="font-size: 1.5em; font-weight: bold; color: #667eea;">${perfilEsperado.mach || 0}</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 0.9em; color: var(--text-secondary);">Narcisismo</div>
              <div style="font-size: 1.5em; font-weight: bold; color: #764ba2;">${perfilEsperado.narc || 0}</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 0.9em; color: var(--text-secondary);">Psicopatía</div>
              <div style="font-size: 1.5em; font-weight: bold; color: #ff6384;">${perfilEsperado.psych || 0}</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  document.getElementById('seccion-investigador')?.classList.add('hidden');
  document.getElementById('seccion-resultados')?.classList.remove('hidden');
  window.scrollTo({ top:0, behavior:'smooth' });
  
  generarGraficosParticipante(p);
}

/* ---------- GENERAR GRÁFICOS PARA PARTICIPANTE ---------- */
function generarGraficosParticipante(participante) {
  const ctxSD3 = document.getElementById('grafico-sd3-resultados');
  if (ctxSD3) {
    new Chart(ctxSD3, {
      type: 'bar',
      data: {
        labels: ['Maquiavelismo', 'Narcisismo', 'Psicopatía'],
        datasets: [{
          label: 'Puntuación',
          data: [participante.mach || 0, participante.narc || 0, participante.psych || 0],
          backgroundColor: ['#667eea', '#764ba2', '#ff6384']
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            max: 5
          }
        }
      }
    });
  }
}

/* ---------- ANÁLISIS ESTADÍSTICO AVANZADO ---------- */
async function cargarAnalisisAvanzado() {
  try {
    console.log('📈 Cargando análisis avanzado...');
    
    const { data: participantes, error } = await supabase
      .from('darklens_records')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!participantes || participantes.length === 0) {
      mostrarMensajeAnalisis('No hay suficientes datos para análisis estadístico');
      return;
    }

    console.log(`📊 Total de participantes para análisis: ${participantes.length}`);

    const sd3Scores = [];
    const emocionesData = [];
    
    participantes.forEach(p => {
      if (p.mach !== null && p.narc !== null && p.psych !== null) {
        const mach = parseFloat(p.mach);
        const narc = parseFloat(p.narc);
        const psych = parseFloat(p.psych);
        
        if (!isNaN(mach) && !isNaN(narc) && !isNaN(psych)) {
          sd3Scores.push({ mach, narc, psych });
          const emocion = p.emocion_principal || 'neutral';
          emocionesData.push(emocion.toLowerCase());
        }
      }
    });

    console.log(`📊 Datos SD3 válidos: ${sd3Scores.length}`);
    console.log(`📊 Datos emociones válidos: ${emocionesData.length}`);

    if (sd3Scores.length < 3) {
      document.getElementById('resultados-correlaciones').innerHTML = `
        <div class="resultado-box" style="text-align: center;">
          <h4 style="color: var(--accent);">🔗 Correlaciones entre Rasgos SD3 y Emociones Detectadas</h4>
          <p style="color: var(--text-secondary);">
            Se necesitan al menos 3 participantes con datos SD3 válidos para análisis de correlaciones.
          </p>
          <p style="color: var(--text-secondary); font-size: 0.9em; margin-top: 10px;">
            <strong>Participantes con datos válidos:</strong> ${sd3Scores.length}
          </p>
        </div>
      `;
      return;
    }

    await analizarCorrelacionesSD3Emociones(sd3Scores, emocionesData);
    await analizarTiemposRespuesta(participantes);
    await analizarRegresiones(participantes);

  } catch (error) {
    console.error('❌ Error en análisis avanzado:', error);
    mostrarMensajeAnalisis('Error cargando análisis: ' + error.message);
  }
}

async function analizarCorrelacionesSD3Emociones(sd3Scores, emocionesData) {
  try {
    console.log('🔗 Analizando correlaciones SD3-Emociones...');
    
    const gruposEmociones = {};
    emocionesData.forEach((emocion, index) => {
      if (!gruposEmociones[emocion]) {
        gruposEmociones[emocion] = { mach: [], narc: [], psych: [] };
      }
      gruposEmociones[emocion].mach.push(sd3Scores[index].mach);
      gruposEmociones[emocion].narc.push(sd3Scores[index].narc);
      gruposEmociones[emocion].psych.push(sd3Scores[index].psych);
    });
    
    const promediosEmociones = {};
    Object.keys(gruposEmociones).forEach(emocion => {
      promediosEmociones[emocion] = {
        mach: gruposEmociones[emocion].mach.reduce((a, b) => a + b, 0) / gruposEmociones[emocion].mach.length,
        narc: gruposEmociones[emocion].narc.reduce((a, b) => a + b, 0) / gruposEmociones[emocion].narc.length,
        psych: gruposEmociones[emocion].psych.reduce((a, b) => a + b, 0) / gruposEmociones[emocion].psych.length
      };
    });
    
    console.log('📊 Promedios por emoción:', promediosEmociones);
    mostrarResultadosCorrelacionesSD3Emociones(promediosEmociones, gruposEmociones);
    
  } catch (error) {
    console.error('❌ Error analizando correlaciones:', error);
    document.getElementById('resultados-correlaciones').innerHTML = `
      <div class="resultado-box" style="background: rgba(255, 99, 132, 0.1); border-left: 4px solid #ff6384;">
        <h4 style="color: #ff6384;">⚠️ Error en Análisis de Correlaciones</h4>
        <p style="color: var(--text-secondary);">${error.message}</p>
      </div>
    `;
  }
}

function mostrarResultadosCorrelacionesSD3Emociones(promedios, grupos) {
  const container = document.getElementById('resultados-correlaciones');
  if (!container) return;

  let html = '<h4 style="color: var(--accent); margin-bottom: 20px;">🔗 Correlaciones entre Emociones Detectadas y Rasgos SD3</h4>';

  html += `
    <div class="resultado-box" style="overflow-x: auto;">
      <h5 style="color: var(--accent);">📊 Promedios de Puntajes SD3 por Emoción</h5>
      <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
        <thead>
          <tr style="background: rgba(127, 0, 255, 0.1);">
            <th style="padding: 10px; text-align: left; border-bottom: 2px solid var(--accent);">Emoción</th>
            <th style="padding: 10px; text-align: left; border-bottom: 2px solid var(--accent);">Maquiavelismo</th>
            <th style="padding: 10px; text-align: left; border-bottom: 2px solid var(--accent);">Narcisismo</th>
            <th style="padding: 10px; text-align: left; border-bottom: 2px solid var(--accent);">Psicopatía</th>
            <th style="padding: 10px; text-align: left; border-bottom: 2px solid var(--accent);">Muestras</th>
          </tr>
        </thead>
        <tbody>
  `;

  Object.keys(promedios).forEach(emocion => {
    const muestras = Math.max(
      grupos[emocion]?.mach?.length || 0,
      grupos[emocion]?.narc?.length || 0,
      grupos[emocion]?.psych?.length || 0
    );
    
    html += `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
        <td style="padding: 10px;"><strong>${emocion.charAt(0).toUpperCase() + emocion.slice(1)}</strong></td>
        <td style="padding: 10px;">${promedios[emocion].mach.toFixed(2)}</td>
        <td style="padding: 10px;">${promedios[emocion].narc.toFixed(2)}</td>
        <td style="padding: 10px;">${promedios[emocion].psych.toFixed(2)}</td>
        <td style="padding: 10px;">${muestras}</td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;

  const emocionesLabels = Object.keys(promedios);
  const machData = emocionesLabels.map(e => promedios[e].mach);
  const narcData = emocionesLabels.map(e => promedios[e].narc);
  const psychData = emocionesLabels.map(e => promedios[e].psych);

  html += `
    <div class="resultado-box" style="margin-top: 20px;">
      <h5 style="color: var(--accent);">📈 Gráfico de Promedios SD3 por Emoción</h5>
      <canvas id="grafico-promedios-emociones" height="300"></canvas>
    </div>
  `;

  html += `
    <div class="resultado-box" style="margin-top: 20px; background: rgba(127, 0, 255, 0.1);">
      <h5 style="color: var(--accent);">🧠 Análisis de Patrones Detectados</h5>
      <div style="color: var(--text-secondary); line-height: 1.6;">
        ${generarAnalisisPatrones(promedios)}
      </div>
    </div>
  `;

  container.innerHTML = html;

  setTimeout(() => {
    const ctx = document.getElementById('grafico-promedios-emociones');
    if (ctx) {
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: emocionesLabels.map(e => e.charAt(0).toUpperCase() + e.slice(1)),
          datasets: [
            {
              label: 'Maquiavelismo',
              data: machData,
              backgroundColor: 'rgba(102, 126, 234, 0.7)',
              borderColor: 'rgba(102, 126, 234, 1)',
              borderWidth: 1
            },
            {
              label: 'Narcisismo',
              data: narcData,
              backgroundColor: 'rgba(118, 75, 162, 0.7)',
              borderColor: 'rgba(118, 75, 162, 1)',
              borderWidth: 1
            },
            {
              label: 'Psicopatía',
              data: psychData,
              backgroundColor: 'rgba(255, 99, 132, 0.7)',
              borderColor: 'rgba(255, 99, 132, 1)',
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true,
              max: 5
            }
          }
        }
      });
    }
  }, 100);
}

function generarAnalisisPatrones(promedios) {
  let analisis = '';
  
  Object.keys(promedios).forEach(emocion => {
    const datos = promedios[emocion];
    analisis += `<p><strong>${emocion.charAt(0).toUpperCase() + emocion.slice(1)}:</strong> `;
    
    const caracteristicas = [];
    if (datos.mach > 3.5) caracteristicas.push('alto maquiavelismo');
    if (datos.narc > 3.5) caracteristicas.push('alto narcisismo');
    if (datos.psych > 3.5) caracteristicas.push('alta psicopatía');
    
    if (caracteristicas.length > 0) {
      analisis += `Asociada con ${caracteristicas.join(', ')}.`;
    } else {
      analisis += 'Perfil SD3 dentro de rangos normales.';
    }
    
    analisis += ` (M: ${datos.mach.toFixed(2)}, N: ${datos.narc.toFixed(2)}, P: ${datos.psych.toFixed(2)})</p>`;
  });
  
  return analisis;
}

async function analizarTiemposRespuesta(participantes) {
  try {
    console.log('⏱️ Analizando tiempos de respuesta...');
    
    const tiemposData = [];
    
    participantes.forEach(p => {
      if (p.tiempos_respuesta) {
        try {
          const tiempos = typeof p.tiempos_respuesta === 'string' 
            ? JSON.parse(p.tiempos_respuesta)
            : p.tiempos_respuesta;
          
          if (tiempos && typeof tiempos === 'object') {
            Object.values(tiempos).forEach(tiempo => {
              if (tiempo && typeof tiempo === 'object' && tiempo.tiempo_ms) {
                tiemposData.push({
                  item_number: tiempo.item_number || 0,
                  tiempo_ms: parseFloat(tiempo.tiempo_ms) || 0,
                  pregunta: tiempo.pregunta || 'Sin texto'
                });
              }
            });
          }
        } catch (e) {
          console.warn('⚠️ Error parseando tiempos de respuesta:', e);
        }
      }
    });

    console.log(`⏱️ Datos de tiempo encontrados: ${tiemposData.length}`);

    if (tiemposData.length === 0) {
      document.getElementById('resultados-tiempos').innerHTML = `
        <div class="resultado-box" style="text-align: center;">
          <h4 style="color: var(--accent);">⏱️ Análisis de Tiempos de Respuesta</h4>
          <p style="color: var(--text-secondary);">No hay datos de tiempos de respuesta disponibles</p>
          <p style="color: var(--text-secondary); font-size: 0.9em; margin-top: 10px;">
            Los tiempos de respuesta se registran cuando los participantes completan el test SD3.
          </p>
        </div>
      `;
      return;
    }

    document.getElementById('resultados-tiempos').innerHTML = `
      <div class="resultado-box" style="text-align: center;">
        <h4 style="color: var(--accent);">⏱️ Análisis de Tiempos de Respuesta</h4>
        <p style="color: var(--text-secondary);">
          Se encontraron ${tiemposData.length} registros de tiempo de respuesta
        </p>
        <p style="color: var(--text-secondary); font-size: 0.9em; margin-top: 10px;">
          Análisis detallado disponible próximamente
        </p>
      </div>
    `;

  } catch (error) {
    console.error('❌ Error analizando tiempos:', error);
    document.getElementById('resultados-tiempos').innerHTML = `
      <div class="resultado-box" style="background: rgba(255, 206, 86, 0.1); border-left: 4px solid #ffce56;">
        <h4 style="color: #ffce56;">⚠️ Error en Análisis de Tiempos</h4>
        <p style="color: var(--text-secondary);">${error.message}</p>
      </div>
    `;
  }
}

async function analizarRegresiones(participantes) {
  try {
    console.log('📈 Preparando datos para análisis de regresión...');
    
    const xData = [];
    const yData = [];
    
    participantes.forEach(p => {
      const mach = parseFloat(p.mach);
      const correlacion = parseFloat(p.correlacion_emocion_sd3);
      
      if (!isNaN(mach) && isFinite(mach) && mach > 0 && 
          !isNaN(correlacion) && isFinite(correlacion)) {
        xData.push(mach);
        yData.push(correlacion);
      }
    });

    console.log(`📈 Datos para regresión: X=${xData.length}, Y=${yData.length}`);

    if (xData.length < 3 || yData.length < 3) {
      document.getElementById('resultados-regresion').innerHTML = `
        <div class="resultado-box" style="text-align: center;">
          <h4 style="color: var(--accent);">📊 Regresión Lineal: SD3 vs Correlación con Emoción</h4>
          <p style="color: var(--text-secondary);">Datos insuficientes para análisis de regresión</p>
          <p style="color: var(--text-secondary); font-size: 0.9em; margin-top: 10px;">
            Se necesitan al menos 3 participantes con datos de SD3 y correlación válidos.
          </p>
          <div style="margin-top: 15px;">
            <p style="color: var(--text-secondary); font-size: 0.85em;">
              <strong>Participantes con datos válidos:</strong> ${xData.length}
            </p>
          </div>
        </div>
      `;
      return;
    }

    document.getElementById('resultados-regresion').innerHTML = `
      <div class="resultado-box" style="text-align: center;">
        <h4 style="color: var(--accent);">📊 Regresión Lineal</h4>
        <p style="color: var(--text-secondary);">
          Análisis de regresión entre Maquiavelismo y Correlación Emoción-SD3
        </p>
        <p style="color: var(--text-secondary); margin-top: 10px;">
          <strong>Datos disponibles:</strong> ${xData.length} participantes
        </p>
      </div>
    `;

  } catch (error) {
    console.error('❌ Error analizando regresiones:', error);
    document.getElementById('resultados-regresion').innerHTML = `
      <div class="resultado-box" style="background: rgba(54, 162, 235, 0.1); border-left: 4px solid #36a2eb;">
        <h4 style="color: #36a2eb;">⚠️ Error en Análisis de Regresión</h4>
        <p style="color: var(--text-secondary);">${error.message}</p>
      </div>
    `;
  }
}

function mostrarMensajeAnalisis(mensaje) {
  const containers = ['resultados-correlaciones', 'resultados-tiempos', 'resultados-regresion'];
  containers.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = `
        <div class="resultado-box" style="text-align: center;">
          <p style="color: var(--text-secondary);">${mensaje}</p>
        </div>
      `;
    }
  });
}

/* ---------- FUNCIONES GLOBALES ---------- */
function volverAlInicio() {
  sessionStorage.clear();
  tiemposRespuesta = {};
  tiempoInicioItem = {};
  testInicioTimestamp = null;
  participanteSeleccionado = null;
  imagenCapturada = null;
  capturedBlob = null;
  if (stream) { 
    stream.getTracks().forEach(t=>t.stop()); 
    stream = null; 
  }
  
  document.querySelectorAll('section').forEach(section => {
    section.classList.add('hidden');
  });
  
  document.getElementById('pagina-inicio')?.classList.remove('hidden');
  window._capturaInicializada = false;
  window.scrollTo({ top:0, behavior:'smooth' });
}

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
