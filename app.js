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
let participantesData = [];  // SOLO UNA DECLARACIÓN - LÍNEA 55
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
  "Sé que soy special porque todos me lo dicen continuamente.",
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

  if (btnActivarCamara) {
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
  }

  /* ---------- Capturar imagen ---------- */

  if (btnCapturarImagen) {
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
  }

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

  if (inputArchivo) {
    inputArchivo.addEventListener('change', function() {
      const archivo = this.files[0];
      if (!archivo) return;

      if (!archivo.type.startsWith("image/")) {
        alert("Debe seleccionar una imagen válida");
        return;
      }

      mostrarPreview(archivo);
    });
  }

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
    if (btnRecapturar) btnRecapturar.classList.remove('hidden');
    if (btnSubirImagen) btnSubirImagen.classList.remove('hidden');
    if (btnCapturarImagen) btnCapturarImagen.classList.add('hidden');
    if (video) video.classList.add('hidden');

    const sizeKB = (blob.size / 1024).toFixed(2);
    if (infoImagen) {
      infoImagen.innerHTML = `
        <p><strong>Tamaño:</strong> ${sizeKB} KB</p>
        <p><strong>Formato:</strong> ${blob.type}</p>
        <p><strong>Lista para analizar</strong></p>
      `;
    }

    console.log("📸 Imagen lista (cámara o archivo)");
  }

  /* ============================================================
     RECAPTURAR
     ============================================================ */
  if (btnRecapturar) {
    btnRecapturar.addEventListener('click', () => {
      capturedBlob = null;
      imagenCapturada = null;

      previewContainer.classList.add('hidden');
      btnRecapturar.classList.add('hidden');
      if (btnSubirImagen) btnSubirImagen.classList.add('hidden');

      document.getElementById('camera-placeholder')?.classList?.remove('hidden');

      if (btnActivarCamara) btnActivarCamara.classList.remove('hidden');
    });
  }

  /* ============================================================
     ENVIAR IMAGEN A LA API
     ============================================================ */
  if (btnSubirImagen) {
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
}

/* ---------- FUNCIÓN PARA SUBIR IMAGEN A SUPABASE STORAGE ---------- */
async function subirImagenSupabaseStorage(imageBlob, datosPersonales) {
  try {
    const fileName = `microexpresiones/${datosPersonales.nombre || 'anonimo'}_${Date.now()}.jpg`;
    
    const { data, error } = await supabase.storage
      .from('DARKLENS-IMAGES')
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
      .from('DARKLENS-IMAGES')
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

    // 👉 Guardar los datos FACS en sessionStorage para usarlos después
    if (analisis.facs) {
      try {
        sessionStorage.setItem('facs_data', JSON.stringify(analisis.facs));
        console.log('✅ Datos FACS guardados en sessionStorage');
      } catch (error) {
        console.error('❌ Error guardando datos FACS:', error);
      }
    }

    // 👉 Preparar el análisis completo
    const analisisCompleto = {
      ...analisis,
      emocion_detectada: emocionPrincipal,
      imagen_url: imagenURL,
      timestamp: new Date().toISOString()
    };

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
      analisis_completo: JSON.stringify(analisisCompleto),
      facs_data: analisis.facs ? JSON.stringify(analisis.facs) : null
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
      correlacion: correlacionEmocionSD3,
      facs_data: analisis.facs
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
        
        <!-- Contenedor para FACS -->
        <div id="facs-resultados" style="margin-top: 20px;"></div>
        
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
  
  // 👉 LLAMAR A LA FUNCIÓN DE FACS DESPUÉS DE CREAR EL HTML
  if (analisisImagen && analisisImagen.success && typeof mostrarFACS === 'function') {
    const facsData = analisisImagen.analisis?.facs || analisisImagen.facs_data;
    if (facsData) {
      setTimeout(() => {
        mostrarFACS(facsData, 'facs-resultados');
      }, 100);
    }
  }
}

/* ========================================================
   PANEL DEL INVESTIGADOR — VERSIÓN LIMPIA Y CORREGIDA
   ======================================================== */

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
      <div class="info-item"><strong>Nombre:</strong> ${p.nombre || 'No disponible'}</div>
      <div class="info-item"><strong>Edad:</strong> ${p.edad || 'No disponible'}</div>
      <div class="info-item"><strong>Género:</strong> ${p.genero || 'No disponible'}</div>
      <div class="info-item"><strong>País:</strong> ${p.pais || 'No disponible'}</div>
      <div class="info-item"><strong>Fecha:</strong> ${new Date(p.created_at).toLocaleString("es-AR")}</div>
      <div class="info-item"><strong>Historia:</strong> ${p.historia_utilizada || "No disponible"}</div>
      <div class="info-item"><strong>Tipo captura:</strong> ${p.tipo_captura || "imagen"}</div>
    </div>
  `;

  /* SD3 */
  document.getElementById("resultados-sd3-detalle").innerHTML = `
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

  /* ============================================================
     ⏱️ TIEMPOS DE RESPUESTA - MEJORADO
     ============================================================ */
  const tiemposDiv = document.getElementById("tiempos-detalle");
  if (tiemposDiv) {
    let tiemposHTML = '';
    
    // Intentar parsear tiempos_respuesta si existe
    let tiemposData = null;
    try {
      if (p.tiempos_respuesta) {
        tiemposData = typeof p.tiempos_respuesta === 'string' 
          ? JSON.parse(p.tiempos_respuesta) 
          : p.tiempos_respuesta;
      }
    } catch (e) {
      console.warn('No se pudieron parsear tiempos_respuesta:', e);
    }

    if (tiemposData && Object.keys(tiemposData).length > 0) {
      const tiemposArray = Object.values(tiemposData)
        .filter(t => t && t.tiempo_ms)
        .map(t => parseFloat(t.tiempo_ms));
      
      if (tiemposArray.length > 0) {
        const promedio = tiemposArray.reduce((a,b) => a+b, 0) / tiemposArray.length;
        const minimo = Math.min(...tiemposArray);
        const maximo = Math.max(...tiemposArray);
        
        tiemposHTML = `
          <div class="stats-mini">
            <div class="stat-mini">
              <div class="stat-mini-label">⏱️ Tiempo Total</div>
              <div class="stat-mini-value">${p.tiempo_total_seg || '0'} seg</div>
            </div>
            <div class="stat-mini">
              <div class="stat-mini-label">📊 Promedio por ítem</div>
              <div class="stat-mini-value">${(promedio/1000).toFixed(2)} seg</div>
            </div>
            <div class="stat-mini">
              <div class="stat-mini-label">⚡ Más rápido</div>
              <div class="stat-mini-value">${(minimo/1000).toFixed(2)} seg</div>
            </div>
            <div class="stat-mini">
              <div class="stat-mini-label">🐌 Más lento</div>
              <div class="stat-mini-value">${(maximo/1000).toFixed(2)} seg</div>
            </div>
          </div>
          <div style="margin-top: 20px; padding: 15px; background: rgba(127, 0, 255, 0.1); border-radius: 10px;">
            <p style="color: var(--text-secondary); font-size: 0.95em; margin: 0;">
              <strong>✅ Ítems respondidos:</strong> ${tiemposArray.length} de 27
            </p>
          </div>
        `;
      } else {
        tiemposHTML = '<p style="color: var(--text-secondary);">Los datos de tiempo no están en el formato esperado.</p>';
      }
    } else {
      tiemposHTML = `
        <div style="text-align: center; padding: 30px; background: rgba(255, 206, 86, 0.1); border-radius: 15px; border: 2px dashed rgba(255, 206, 86, 0.3);">
          <div style="font-size: 3em; margin-bottom: 15px;">⏱️</div>
          <p style="color: var(--text-secondary); font-size: 1.1em; margin: 0;">
            No hay datos de tiempos de respuesta registrados
          </p>
          <p style="color: var(--text-secondary); font-size: 0.85em; margin-top: 10px; opacity: 0.7;">
            Los tiempos se registran automáticamente durante el test SD3
          </p>
        </div>
      `;
    }
    
    tiemposDiv.innerHTML = tiemposHTML;
  }

  /* ============================================================
     🔍 UNIDADES FACS - MEJORADO
     ============================================================ */
  const facsDiv = document.getElementById("facs-detalle");
  if (facsDiv) {
    let facsHTML = '';
    
    // Intentar obtener FACS desde facs_data o analisis_completo
    let facsData = null;
    try {
      if (p.facs_data) {
        facsData = typeof p.facs_data === 'string' 
          ? JSON.parse(p.facs_data) 
          : p.facs_data;
      } else if (p.analisis_completo) {
        const analisisCompleto = typeof p.analisis_completo === 'string' 
          ? JSON.parse(p.analisis_completo) 
          : p.analisis_completo;
        facsData = analisisCompleto.facs || null;
      }
    } catch (e) {
      console.warn('No se pudo parsear datos FACS:', e);
    }

    if (facsData && (facsData.action_units || facsData.unidades_facs)) {
      // Crear contenedor para FACS
      facsHTML = `
        <div style="margin-top: 20px;">
          <h5 style="color: var(--accent); margin-bottom: 15px;">
            🔬 Análisis FACS (Facial Action Coding System)
          </h5>
          <div id="facs-detalle-participante" style="margin-top: 15px;"></div>
        </div>
      `;
    } else {
      facsHTML = `
        <div style="text-align: center; padding: 30px; background: rgba(255, 206, 86, 0.1); border-radius: 15px; border: 2px dashed rgba(255, 206, 86, 0.3);">
          <div style="font-size: 3em; margin-bottom: 15px;">🔬</div>
          <p style="color: var(--text-secondary); font-size: 1.1em; margin: 0;">
            No se detectaron unidades FACS
          </p>
          <p style="color: var(--text-secondary); font-size: 0.85em; margin-top: 10px; opacity: 0.7;">
            Las unidades FACS se extraen del análisis facial automático
          </p>
        </div>
      `;
    }
    
    facsDiv.innerHTML = facsHTML;
    
    // 👉 LLAMAR A LA FUNCIÓN FACS SI HAY DATOS
    if (facsData && typeof mostrarFACS === 'function') {
      setTimeout(() => {
        mostrarFACS(facsData, 'facs-detalle-participante');
      }, 200);
    }
  }

  /* MICROEXPRESIONES */
  const microDiv = document.getElementById("microexpresiones-detalle");
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
  } else if (microDiv) {
    microDiv.innerHTML = `
      <div style="text-align: center; padding: 30px; background: rgba(255, 206, 86, 0.1); border-radius: 15px;">
        <div style="font-size: 3em; margin-bottom: 15px;">😶</div>
        <p style="color: var(--text-secondary);">No se analizaron microexpresiones</p>
      </div>
    `;
  }

  /* IMAGEN */
  const imagenDiv = document.getElementById("imagen-participante");
  if (imagenDiv) {
    imagenDiv.innerHTML = p.imagen_url
      ? `
        <div style="text-align: center;">
          <img src="${p.imagen_url}" style="max-width:400px; border-radius:10px; border: 2px solid var(--accent); box-shadow: 0 5px 15px rgba(0,0,0,0.3);">
        </div>
      `
      : `
        <div style="text-align: center; padding: 30px; background: rgba(255, 206, 86, 0.1); border-radius: 15px;">
          <div style="font-size: 3em; margin-bottom: 15px;">📷</div>
          <p style="color: var(--text-secondary);">No hay imagen disponible</p>
        </div>
      `;
  }

  // Llamar a análisis individual
  analizarParticipanteIndividual(p);
  
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ========================================================
   FUNCIONES DE ANALISIS INDIVIDUAL DEL PARTICIPANTE
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
    <p><strong>Emoción detectada por microexpresión:</strong> ${p.emocion_principal || 'No detectada'}</p>
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

  if (p.tiempos_respuesta) {
    renderGraficoTiemposIndividual(p.tiempos_respuesta);
  }


  /* ============================
     6️⃣ GRAFICO DE EMOCIONES (individual)
     ============================ */
  renderGraficoEmocionesIndividual(p);
  
  /* ============================
     7️⃣ INTERPRETACIÓN CLÍNICA
     ============================ */
  const interpretacion = generarInterpretacionClinica(p);
  document.getElementById("analisis-final").innerHTML += `
    <h4>🧠 Interpretación Clínica</h4>
    <p>${interpretacion}</p>
  `;
  
  /* ============================
     8️⃣ COMPARACIÓN CON GRUPO
     ============================ */
  compararConGrupo(p);
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

function emotionToCode(emocion) {
  const map = {
    'happiness': 1, 'felicidad': 1, 'alegría': 1,
    'anger': 2, 'enojo': 2, 'ira': 2,
    'fear': 3, 'miedo': 3,
    'sadness': 4, 'tristeza': 4,
    'surprise': 5, 'sorpresa': 5,
    'disgust': 6, 'asco': 6,
    'neutral': 7
  };
  return map[emocion?.toLowerCase()] || -1;
}

/* ========================================================
   GRAFICO INDIVIDUAL — SD3
   ======================================================== */

function renderGraficoSD3Individual(p) {
  const ctx = document.getElementById("grafico-sd3-resultados");
  
  // Limpiar canvas si ya existe
  if (ctx) {
    const existingChart = Chart.getChart(ctx);
    if (existingChart) {
      existingChart.destroy();
    }
  }

  new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Maquiavelismo", "Narcisismo", "Psicopatía"],
      datasets: [{
        label: "Puntajes SD3",
        data: [p.mach, p.narc, p.psych],
        backgroundColor: ["#667eea", "#764ba2", "#ff6384"]
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          max: 5
        }
      }
    }
  });
}


/* ========================================================
   GRAFICO INDIVIDUAL — TIEMPOS
   ======================================================== */

function renderGraficoTiemposIndividual(tiemposRaw) {
  const ctx = document.getElementById("grafico-tiempos");
  if (!ctx) return;
  
  // Limpiar canvas si ya existe
  const existingChart = Chart.getChart(ctx);
  if (existingChart) {
    existingChart.destroy();
  }

  // Parsear si es necesario
  let tiempos = tiemposRaw;
  if (typeof tiemposRaw === 'string') {
    try {
      tiempos = JSON.parse(tiemposRaw);
    } catch (e) {
      console.error('Error parseando tiempos:', e);
      return;
    }
  }

  const labels = Object.keys(tiempos);
  const values = Object.values(tiempos).map(v => {
    const tiempo_ms = v?.tiempo_ms || v;
    return parseFloat(tiempo_ms) / 1000;
  });

  new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Tiempo de respuesta (segundos)",
        data: values,
        borderColor: "#7f00ff",
        backgroundColor: "rgba(127, 0, 255, 0.1)",
        borderWidth: 2,
        tension: 0.3,
        fill: true
      }]
    },
    options: {
      responsive: true,
      plugins: { 
        legend: { display: true },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `Tiempo: ${context.parsed.y.toFixed(2)}s`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

/* ========================================================
   GRAFICO INDIVIDUAL — MICROEXPRESIONES
   ======================================================== */

function renderGraficoEmocionesIndividual(p) {
  const ctx = document.getElementById("grafico-emociones");
  if (!ctx) return;
  
  // Limpiar canvas si ya existe
  const existingChart = Chart.getChart(ctx);
  if (existingChart) {
    existingChart.destroy();
  }

  if (!p.emociones_detectadas || p.emociones_detectadas.length === 0) {
    // No hacer nada, ya se muestra mensaje en microexpresiones-detalle
    return;
  }

  const counts = {};
  p.emociones_detectadas.forEach(e => {
    counts[e] = (counts[e] || 0) + 1;
  });

  const labels = Object.keys(counts);
  const values = Object.values(counts);

  new Chart(ctx, {
    type: "pie",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: [
          "#ff6384", "#36a2eb", "#ffce56",
          "#4bc0c0", "#9966ff", "#ff9f40", "#c9cbcf"
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
}

/* ========================================================
   INTERPRETACIÓN CLÍNICA AUTOMÁTICA
   ======================================================== */

function generarInterpretacionClinica(p) {
  let texto = [];

  texto.push(`La microexpresión principal detectada fue <strong>${p.emocion_principal || 'no disponible'}</strong>.`);
  
  const rasgoPred = obtenerRasgoPredominante(p);
  texto.push(`El rasgo predominante del SD3 fue <strong>${rasgoPred}</strong>.`);

  const relacion = {
    "happiness": "positividad, validación externa y percepción de autoeficacia.",
    "anger": "frustración, competencia o desafío percibido.",
    "fear": "respuesta emocional a amenaza o incertidumbre.",
    "sadness": "procesos internos de retraimiento o introspección.",
    "neutral": "control emocional o inhibición voluntaria.",
    "surprise": "hipervigilancia o reactividad emocional.",
    "disgust": "rechazo, desacuerdo o aversión."
  }[p.emocion_principal?.toLowerCase()] || "un estado emocional complejo.";

  texto.push(`Esta emoción suele asociarse a <strong>${relacion}</strong>`);

  return texto.join("<br>");
}

function obtenerRasgoPredominante(p) {
  let max = p.mach, rasgo = "maquiavelismo";

  if (p.narc > max) { max = p.narc; rasgo = "narcisismo"; }
  if (p.psych > max) { max = p.psych; rasgo = "psicopatía"; }

  return rasgo;
}

/* ========================================================
   COMPARACIÓN PARTICIPANTE VS PROMEDIO DEL GRUPO
   ======================================================== */

async function compararConGrupo(p) {
  try {
    const { data, error } = await supabase
      .from("darklens_records")
      .select("mach, narc, psych");

    if (error || !data) return;

    const mach_prom = promedio(data.map(d => d.mach));
    const narc_prom = promedio(data.map(d => d.narc));
    const psych_prom = promedio(data.map(d => d.psych));

    const analisisDiv = document.getElementById("analisis-final");
    if (analisisDiv) {
      analisisDiv.innerHTML += `
        <h4>📊 Comparación con el grupo</h4>
        <p><strong>Maquiavelismo:</strong> ${p.mach} (grupo: ${mach_prom.toFixed(2)})</p>
        <p><strong>Narcisismo:</strong> ${p.narc} (grupo: ${narc_prom.toFixed(2)})</p>
        <p><strong>Psicopatía:</strong> ${p.psych} (grupo: ${psych_prom.toFixed(2)})</p>
      `;
    }
  } catch (error) {
    console.error("Error comparando con grupo:", error);
  }
}

function promedio(arr) {
  const nums = arr.filter(n => typeof n === "number");
  if (nums.length === 0) return 0;
  return nums.reduce((a,b)=>a+b,0) / nums.length;
}
/* ========================================================
   📊 ANÁLISIS ESTADÍSTICO AVANZADO COMPLETO
   ======================================================== */

async function cargarAnalisisAvanzado() {
  participanteSeleccionado = null;

  const { data: participantes, error } = await supabase
    .from("darklens_records")
    .select("*");

  if (error || !participantes || participantes.length === 0) {
    mostrarMensajeAnalisis("No se pudieron cargar los datos o no hay participantes registrados.");
    return;
  }

  // Mostrar loading
  ["resultados-correlaciones", "resultados-tiempos", "resultados-regresion", "resumen-estadistico"]
    .forEach(id => {
      const div = document.getElementById(id);
      if (div) div.innerHTML = `
        <div class="analisis-loading">
          <p>📊 Calculando análisis estadístico...</p>
        </div>
      `;
    });

  setTimeout(() => {
    /* ------------------ CORRELACIONES REALES ------------------ */
    mostrarResultadosCorrelacionesCompletas(participantes);

    /* ------------------ ANÁLISIS DE TIEMPOS REAL ------------------ */
    mostrarTiemposCompletos(participantes);

    /* ------------------ REGRESIÓN REAL ------------------ */
    mostrarRegresionCompleta(participantes);

    /* ------------------ RESUMEN ESTADÍSTICO ------------------ */
    mostrarResumenEstadistico(participantes);
  }, 500);
}

/* ========================================================
   FUNCIÓN 1: CORRELACIONES COMPLETAS
   ======================================================== */
function mostrarResultadosCorrelacionesCompletas(participantes) {
  const div = document.getElementById("resultados-correlaciones");
  if (!div) return;

  // Filtrar participantes con datos completos
  const datosCompletos = participantes.filter(p => 
    p.mach && p.narc && p.psych && p.emocion_principal
  );

  if (datosCompletos.length < 3) {
    div.innerHTML = `
      <h4>🔗 Correlaciones Globales</h4>
      <p>Se necesitan al menos 3 participantes con datos completos para calcular correlaciones.</p>
      <div style="background: rgba(255,99,132,0.1); padding: 15px; border-radius: 10px; margin-top: 15px;">
        <p>Participantes con datos: ${datosCompletos.length}</p>
      </div>
    `;
    return;
  }

  // Preparar datos para correlaciones
  const emocionesCodificadas = {
    'happiness': 1, 'felicidad': 1, 'alegría': 1,
    'anger': 2, 'enojo': 2, 'ira': 2,
    'fear': 3, 'miedo': 3,
    'sadness': 4, 'tristeza': 4,
    'surprise': 5, 'sorpresa': 5,
    'disgust': 6, 'asco': 6,
    'neutral': 7
  };

  const datosCorrelacion = datosCompletos.map(p => ({
    emocion: emocionesCodificadas[p.emocion_principal?.toLowerCase()] || 0,
    mach: parseFloat(p.mach) || 0,
    narc: parseFloat(p.narc) || 0,
    psych: parseFloat(p.psych) || 0
  })).filter(d => d.emocion > 0);

  // Calcular correlaciones
  const corrMach = calcularCorrelacionPearson(
    datosCorrelacion.map(d => d.mach),
    datosCorrelacion.map(d => d.emocion)
  );

  const corrNarc = calcularCorrelacionPearson(
    datosCorrelacion.map(d => d.narc),
    datosCorrelacion.map(d => d.emocion)
  );

  const corrPsych = calcularCorrelacionPearson(
    datosCorrelacion.map(d => d.psych),
    datosCorrelacion.map(d => d.emocion)
  );

  // Crear HTML de resultados
  let html = `
    <h4>🔗 Correlaciones entre Rasgos SD3 y Emoción Detectada</h4>
    <p>Análisis de Pearson entre puntajes SD3 y emociones faciales detectadas.</p>
    
    <div class="correlation-grid">
      <div class="correlation-card">
        <div class="correlation-header">
          <span><strong>Maquiavelismo vs Emoción</strong></span>
          <span class="correlation-value">${corrMach.toFixed(3)}</span>
        </div>
        <div class="correlation-strength ${getStrengthClass(corrMach)}">
          ${getStrengthLabel(corrMach)}
        </div>
        <p style="margin-top: 10px; font-size: 0.9em;">
          ${interpretarCorrelacionSD3(corrMach, 'maquiavelismo')}
        </p>
      </div>

      <div class="correlation-card">
        <div class="correlation-header">
          <span><strong>Narcisismo vs Emoción</strong></span>
          <span class="correlation-value">${corrNarc.toFixed(3)}</span>
        </div>
        <div class="correlation-strength ${getStrengthClass(corrNarc)}">
          ${getStrengthLabel(corrNarc)}
        </div>
        <p style="margin-top: 10px; font-size: 0.9em;">
          ${interpretarCorrelacionSD3(corrNarc, 'narcisismo')}
        </p>
      </div>

      <div class="correlation-card">
        <div class="correlation-header">
          <span><strong>Psicopatía vs Emoción</strong></span>
          <span class="correlation-value">${corrPsych.toFixed(3)}</span>
        </div>
        <div class="correlation-strength ${getStrengthClass(corrPsych)}">
          ${getStrengthLabel(corrPsych)}
        </div>
        <p style="margin-top: 10px; font-size: 0.9em;">
          ${interpretarCorrelacionSD3(corrPsych, 'psicopatía')}
        </p>
      </div>
    </div>

    <div style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 10px; margin-top: 20px;">
      <p><strong>📊 Información del análisis:</strong></p>
      <ul style="margin-left: 20px; margin-top: 10px; font-size: 0.9em;">
        <li>Participantes incluidos: ${datosCorrelacion.length}</li>
        <li>Coeficiente de Pearson (r): -1 a +1</li>
        <li>Significado: r > 0.3 (moderado), r > 0.7 (alto)</li>
        <li>Correlación positiva: Mayor puntaje SD3 asociado a emociones más intensas</li>
        <li>Correlación negativa: Mayor puntaje SD3 asociado a emociones menos intensas</li>
      </ul>
    </div>
  `;

  div.innerHTML = html;
}

/* ========================================================
   FUNCIÓN 2: ANÁLISIS DE TIEMPOS COMPLETO
   ======================================================== */
function mostrarTiemposCompletos(participantes) {
  const div = document.getElementById("resultados-tiempos");
  if (!div) return;

  const participantesConTiempos = participantes.filter(p => p.tiempo_total_seg);
  
  if (participantesConTiempos.length === 0) {
    div.innerHTML = `
      <h4>⏱️ Análisis de Tiempos de Respuesta</h4>
      <p>No hay datos de tiempo registrados.</p>
    `;
    return;
  }

  // Calcular estadísticas
  const tiempos = participantesConTiempos.map(p => parseFloat(p.tiempo_total_seg) || 0);
  const promedio = (tiempos.reduce((a, b) => a + b, 0) / tiempos.length).toFixed(2);
  const maximo = Math.max(...tiempos).toFixed(2);
  const minimo = Math.min(...tiempos).toFixed(2);
  const desviacion = calcularDesviacionEstandar(tiempos).toFixed(2);

  // Clasificar por tiempo
  const rapidos = participantesConTiempos.filter(p => p.tiempo_total_seg < 30).length;
  const normales = participantesConTiempos.filter(p => p.tiempo_total_seg >= 30 && p.tiempo_total_seg <= 60).length;
  const lentos = participantesConTiempos.filter(p => p.tiempo_total_seg > 60).length;

  // Análisis por rasgo predominante
  const tiemposPorRasgo = {
    maquiavelismo: [],
    narcisismo: [],
    psicopatía: []
  };

  participantesConTiempos.forEach(p => {
    const rasgo = obtenerRasgoPredominante(p);
    tiemposPorRasgo[rasgo].push(p.tiempo_total_seg);
  });

  let html = `
    <h4>⏱️ Análisis de Tiempos de Respuesta SD3</h4>
    <p>Distribución de tiempos totales de respuesta al cuestionario SD3.</p>
    
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 20px;">
      <div class="stat-mini">
        <div class="stat-mini-label">Tiempo Promedio</div>
        <div class="stat-mini-value">${promedio} s</div>
      </div>
      <div class="stat-mini">
        <div class="stat-mini-label">Tiempo Más Rápido</div>
        <div class="stat-mini-value">${minimo} s</div>
      </div>
      <div class="stat-mini">
        <div class="stat-mini-label">Tiempo Más Lento</div>
        <div class="stat-mini-value">${maximo} s</div>
      </div>
      <div class="stat-mini">
        <div class="stat-mini-label">Desviación Estándar</div>
        <div class="stat-mini-value">${desviacion} s</div>
      </div>
    </div>

    <div style="margin-top: 25px;">
      <h5>📊 Distribución por Velocidad</h5>
      <div style="display: flex; gap: 10px; margin-top: 15px;">
        <div style="flex: 1; background: rgba(76, 175, 80, 0.2); padding: 15px; border-radius: 10px; border-left: 4px solid #4CAF50;">
          <strong>Rápidos (&lt;30s)</strong><br>
          <span style="font-size: 1.5em;">${rapidos}</span> participantes
        </div>
        <div style="flex: 1; background: rgba(255, 193, 7, 0.2); padding: 15px; border-radius: 10px; border-left: 4px solid #FFC107;">
          <strong>Normales (30-60s)</strong><br>
          <span style="font-size: 1.5em;">${normales}</span> participantes
        </div>
        <div style="flex: 1; background: rgba(244, 67, 54, 0.2); padding: 15px; border-radius: 10px; border-left: 4px solid #F44336;">
          <strong>Lentos (&gt;60s)</strong><br>
          <span style="font-size: 1.5em;">${lentos}</span> participantes
        </div>
      </div>
    </div>

    <div style="margin-top: 25px;">
      <h5>🎯 Tiempos por Rasgo Predominante</h5>
      <div style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 10px; margin-top: 10px;">
  `;

  // Agregar tiempos por rasgo
  Object.keys(tiemposPorRasgo).forEach(rasgo => {
    const tiempos = tiemposPorRasgo[rasgo];
    if (tiempos.length > 0) {
      const promRasgo = (tiempos.reduce((a, b) => a + b, 0) / tiempos.length).toFixed(2);
      html += `
        <div style="margin-bottom: 10px;">
          <strong>${rasgo.charAt(0).toUpperCase() + rasgo.slice(1)}:</strong> 
          ${promRasgo} segundos (n=${tiempos.length})
        </div>
      `;
    }
  });

  html += `
      </div>
    </div>

    <div style="margin-top: 20px; font-size: 0.9em; color: var(--text-secondary);">
      <p><strong>Interpretación:</strong> Tiempos más cortos pueden indicar respuestas automáticas o poca reflexión, mientras que tiempos más largos pueden sugerir mayor introspección o indecisión.</p>
    </div>
  `;

  div.innerHTML = html;
}

/* ========================================================
   FUNCIÓN 3: REGRESIÓN COMPLETA
   ======================================================== */
function mostrarRegresionCompleta(participantes) {
  const div = document.getElementById("resultados-regresion");
  if (!div) return;

  // Filtrar datos para regresión
  const datosRegresion = participantes.filter(p => 
    p.mach && p.narc && p.psych && p.emocion_principal
  ).map(p => ({
    x: (parseFloat(p.mach) + parseFloat(p.narc) + parseFloat(p.psych)) / 3, // Promedio SD3
    y: emotionToCode(p.emocion_principal) || 0,
    emocion: p.emocion_principal,
    mach: parseFloat(p.mach),
    narc: parseFloat(p.narc),
    psych: parseFloat(p.psych)
  })).filter(d => d.y > 0);

  if (datosRegresion.length < 4) {
    div.innerHTML = `
      <h4>📊 Regresión Lineal: SD3 vs Emoción</h4>
      <p>Se necesitan al menos 4 puntos de datos para calcular regresión lineal.</p>
      <div style="background: rgba(255,99,132,0.1); padding: 15px; border-radius: 10px; margin-top: 15px;">
        <p>Datos disponibles: ${datosRegresion.length}</p>
      </div>
    `;
    return;
  }

  // Calcular regresión lineal simple
  const { slope, intercept, r2 } = calcularRegresionLineal(
    datosRegresion.map(d => d.x),
    datosRegresion.map(d => d.y)
  );

  // Crear gráfico de dispersión
  const canvasId = 'grafico-regresion';
  let html = `
    <h4>📊 Regresión Lineal: Puntaje SD3 vs Intensidad Emocional</h4>
    <p>Relación entre el puntaje total SD3 y la intensidad emocional detectada.</p>
    
    <div class="regression-equation">
      <strong>Ecuación de regresión:</strong><br>
      <code>Emoción = ${slope.toFixed(3)} × SD3 + ${intercept.toFixed(3)}</code><br>
      <small>R² = ${r2.toFixed(3)} (${(r2 * 100).toFixed(1)}% de varianza explicada)</small>
    </div>

    <div class="plot-container">
      <canvas id="${canvasId}" width="600" height="400"></canvas>
    </div>

    <div style="margin-top: 20px;">
      <h5>📈 Interpretación del modelo:</h5>
      <div style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 10px; margin-top: 10px;">
        <p><strong>Pendiente (${slope.toFixed(3)}):</strong> ${
          slope > 0.1 ? 'Positiva - Mayor SD3 asociado a emociones más intensas' :
          slope < -0.1 ? 'Negativa - Mayor SD3 asociado a emociones menos intensas' :
          'Casi nula - Poca relación entre SD3 y emoción'
        }</p>
        <p><strong>Coeficiente R² (${r2.toFixed(3)}):</strong> ${
          r2 > 0.5 ? 'Fuerte capacidad predictiva' :
          r2 > 0.3 ? 'Capacidad predictiva moderada' :
          r2 > 0.1 ? 'Capacidad predictiva débil' :
          'Muy baja capacidad predictiva'
        }</p>
        <p><strong>Puntos de datos:</strong> ${datosRegresion.length} participantes</p>
      </div>
    </div>
  `;

  div.innerHTML = html;

  // Crear gráfico después de que se inserte el HTML
  setTimeout(() => {
    crearGraficoDispersion(canvasId, datosRegresion, slope, intercept);
  }, 100);
}

/* ========================================================
   FUNCIÓN 4: RESUMEN ESTADÍSTICO
   ======================================================== */
function mostrarResumenEstadistico(participantes) {
  const div = document.getElementById("resumen-estadistico");
  if (!div) return;

  // Calcular estadísticas generales
  const total = participantes.length;
  const conImagen = participantes.filter(p => p.imagen_url).length;
  const conEmocion = participantes.filter(p => p.emocion_principal).length;
  
  // Promedios SD3
  const machProm = promedio(participantes.map(p => parseFloat(p.mach) || 0));
  const narcProm = promedio(participantes.map(p => parseFloat(p.narc) || 0));
  const psychProm = promedio(participantes.map(p => parseFloat(p.psych) || 0));

  // Distribución de emociones
  const emociones = {};
  participantes.forEach(p => {
    if (p.emocion_principal) {
      const emocion = p.emocion_principal.toLowerCase();
      emociones[emocion] = (emociones[emocion] || 0) + 1;
    }
  });

  // Ordenar emociones por frecuencia
  const emocionesOrdenadas = Object.entries(emociones)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  let html = `
    <h4>📋 Resumen Estadístico General</h4>
    
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-top: 20px;">
      <div class="info-item">
        <strong>📊 Participantes Totales</strong>
        <div style="font-size: 2em; color: var(--accent); margin-top: 10px;">${total}</div>
      </div>
      
      <div class="info-item">
        <strong>📷 Con Imagen Analizada</strong>
        <div style="font-size: 2em; color: var(--accent); margin-top: 10px;">${conImagen}</div>
        <small>${((conImagen / total) * 100).toFixed(0)}% del total</small>
      </div>
      
      <div class="info-item">
        <strong>😶 Con Emoción Detectada</strong>
        <div style="font-size: 2em; color: var(--accent); margin-top: 10px;">${conEmocion}</div>
        <small>${((conEmocion / total) * 100).toFixed(0)}% del total</small>
      </div>
    </div>

    <div style="margin-top: 30px;">
      <h5>🎭 Promedios SD3</h5>
      <div class="scores-grid">
        <div class="score-card">
          <div class="score-label">Maquiavelismo</div>
          <div class="score-value">${machProm.toFixed(2)}</div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${(machProm / 5) * 100}%"></div>
          </div>
          <div class="score-level ${getNivelSD3(machProm)}">${getEtiquetaSD3(machProm)}</div>
        </div>
        
        <div class="score-card">
          <div class="score-label">Narcisismo</div>
          <div class="score-value">${narcProm.toFixed(2)}</div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${(narcProm / 5) * 100}%"></div>
          </div>
          <div class="score-level ${getNivelSD3(narcProm)}">${getEtiquetaSD3(narcProm)}</div>
        </div>
        
        <div class="score-card">
          <div class="score-label">Psicopatía</div>
          <div class="score-value">${psychProm.toFixed(2)}</div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${(psychProm / 5) * 100}%"></div>
          </div>
          <div class="score-level ${getNivelSD3(psychProm)}">${getEtiquetaSD3(psychProm)}</div>
        </div>
      </div>
    </div>

    <div style="margin-top: 30px;">
      <h5>📈 Emociones Más Frecuentes</h5>
      <div style="background: rgba(0,0,0,0.2); padding: 20px; border-radius: 10px; margin-top: 15px;">
  `;

  if (emocionesOrdenadas.length > 0) {
    emocionesOrdenadas.forEach(([emocion, count], index) => {
      const porcentaje = ((count / total) * 100).toFixed(1);
      html += `
        <div style="margin-bottom: 15px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
            <span><strong>${index + 1}.</strong> ${emocion.charAt(0).toUpperCase() + emocion.slice(1)}</span>
            <span>${count} (${porcentaje}%)</span>
          </div>
          <div class="bar-container">
            <div class="bar-fill" style="width: ${porcentaje}%">${porcentaje}%</div>
          </div>
        </div>
      `;
    });
  } else {
    html += `<p style="text-align: center; color: var(--text-secondary);">No hay datos de emociones disponibles.</p>`;
  }

  html += `
      </div>
    </div>

    <div style="margin-top: 30px; padding: 15px; background: rgba(127, 0, 255, 0.1); border-radius: 10px; border-left: 4px solid var(--accent);">
      <h5>💡 Conclusiones del Análisis</h5>
      <p style="margin-top: 10px;">
        ${generarConclusionAnalisis(participantes, machProm, narcProm, psychProm)}
      </p>
    </div>
  `;

  div.innerHTML = html;
}

/* ========================================================
   FUNCIONES AUXILIARES PARA ANÁLISIS
   ======================================================== */

function calcularDesviacionEstandar(arr) {
  if (arr.length === 0) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const squaredDiffs = arr.map(value => Math.pow(value - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(variance);
}

function calcularRegresionLineal(x, y) {
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  // Calcular R²
  const yMean = sumY / n;
  const ssTot = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
  const ssRes = y.reduce((sum, yi, i) => sum + Math.pow(yi - (slope * x[i] + intercept), 2), 0);
  const r2 = 1 - (ssRes / ssTot);
  
  return { slope, intercept, r2 };
}

function crearGraficoDispersion(canvasId, datos, slope, intercept) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  
  // Destruir gráfico existente
  const existingChart = Chart.getChart(ctx);
  if (existingChart) {
    existingChart.destroy();
  }
  
  // Preparar datos para el gráfico
  const xValues = datos.map(d => d.x);
  const yValues = datos.map(d => d.y);
  
  // Calcular línea de regresión
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const lineX = [minX, maxX];
  const lineY = lineX.map(x => slope * x + intercept);
  
  new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Participantes',
          data: datos.map(d => ({x: d.x, y: d.y})),
          backgroundColor: 'rgba(127, 0, 255, 0.6)',
          borderColor: 'rgba(127, 0, 255, 1)',
          pointRadius: 6,
          pointHoverRadius: 8
        },
        {
          label: 'Línea de Regresión',
          data: lineX.map((x, i) => ({x: x, y: lineY[i]})),
          type: 'line',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 2,
          fill: false,
          pointRadius: 0,
          tension: 0
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const dato = datos[context.dataIndex];
              return `SD3: ${dato.x.toFixed(2)}, Emoción: ${dato.emocion || dato.y}`;
            }
          }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Puntaje Promedio SD3 (1-5)'
          }
        },
        y: {
          title: {
            display: true,
            text: 'Código de Emoción (1-7)'
          },
          ticks: {
            callback: function(value) {
              const map = {
                1: 'Felicidad', 2: 'Enojo', 3: 'Miedo',
                4: 'Tristeza', 5: 'Sorpresa', 6: 'Asco', 7: 'Neutral'
              };
              return map[value] || value;
            }
          }
        }
      }
    }
  });
}

function getStrengthClass(corr) {
  const absCorr = Math.abs(corr);
  if (absCorr > 0.7) return 'strength-high';
  if (absCorr > 0.3) return 'strength-medium';
  return 'strength-low';
}

function getStrengthLabel(corr) {
  const absCorr = Math.abs(corr);
  if (absCorr > 0.7) return 'Alta';
  if (absCorr > 0.3) return 'Moderada';
  if (absCorr > 0.1) return 'Baja';
  return 'Muy Baja';
}

function interpretarCorrelacionSD3(corr, rasgo) {
  const absCorr = Math.abs(corr);
  const direccion = corr > 0 ? 'positiva' : 'negativa';
  
  if (absCorr < 0.1) {
    return `No hay relación significativa entre ${rasgo} y la emoción detectada.`;
  }
  
  const interpretaciones = {
    'maquiavelismo': {
      'positiva': 'Mayor maquiavelismo asociado a emociones más intensas/expresivas.',
      'negativa': 'Mayor maquiavelismo asociado a emociones menos intensas/más controladas.'
    },
    'narcisismo': {
      'positiva': 'Mayor narcisismo asociado a emociones más intensas/expresivas.',
      'negativa': 'Mayor narcisismo asociado a emociones menos intensas/más controladas.'
    },
    'psicopatía': {
      'positiva': 'Mayor psicopatía asociado a emociones más intensas/expresivas.',
      'negativa': 'Mayor psicopatía asociado a emociones menos intensas/afecto plano.'
    }
  };
  
  return interpretaciones[rasgo]?.[direccion] || `Correlación ${direccion} entre ${rasgo} y emoción.`;
}

function getNivelSD3(puntaje) {
  if (puntaje < 2) return 'nivel-bajo';
  if (puntaje < 3.5) return 'nivel-medio';
  return 'nivel-alto';
}

function getEtiquetaSD3(puntaje) {
  if (puntaje < 2) return 'Bajo';
  if (puntaje < 3.5) return 'Medio';
  return 'Alto';
}

function generarConclusionAnalisis(participantes, machProm, narcProm, psychProm) {
  const total = participantes.length;
  const conclusiones = [];
  
  if (total === 0) return "No hay datos suficientes para generar conclusiones.";
  
  // Análisis de promedios
  const rasgoDominante = machProm >= narcProm && machProm >= psychProm ? 'maquiavelismo' :
                        narcProm >= machProm && narcProm >= psychProm ? 'narcisismo' : 'psicopatía';
  
  conclusiones.push(`El rasgo SD3 predominante en la muestra es <strong>${rasgoDominante}</strong> (promedio: ${Math.max(machProm, narcProm, psychProm).toFixed(2)}).`);
  
  // Análisis de distribución
  const variabilidad = calcularDesviacionEstandar([machProm, narcProm, psychProm]);
  if (variabilidad < 0.5) {
    conclusiones.push("Los tres rasgos muestran niveles similares, sugiriendo un perbalance equilibrado en la muestra.");
  } else {
    conclusiones.push(`Existe variabilidad significativa entre rasgos (SD=${variabilidad.toFixed(2)}).`);
  }
  
  // Análisis de completitud
  const completitud = ((participantes.filter(p => p.emocion_principal && p.imagen_url).length / total) * 100).toFixed(0);
  conclusiones.push(`Completitud de datos: ${completitud}% de participantes tienen análisis facial completo.`);
  
  return conclusiones.join(' ');
}

/* ========================================================
   REEMPLAZAR LAS FUNCIONES VACÍAS EXISTENTES
   ======================================================== */

function mostrarMensajeAnalisis(msg) {
  ["resultados-correlaciones", "resultados-tiempos", "resultados-regresion", "resumen-estadistico"]
    .forEach(id => {
      const div = document.getElementById(id);
      if (div) div.innerHTML = `
        <div style="text-align: center; padding: 30px;">
          <p style="color: var(--text-secondary);">${msg}</p>
        </div>
      `;
    });
}
/* ---------- FUNCIÓN PARA VOLVER AL INICIO ---------- */
function volverAlInicio() {
  sessionStorage.clear();
  tiemposRespuesta = {};
  tiempoInicioItem = {};
  testInicioTimestamp = null;
  imagenCapturada = null;
  capturedBlob = null;
  
  // Ocultar todas las secciones
  document.querySelectorAll('section[id^="seccion-"], #pagina-inicio').forEach(section => {
    section.classList.add('hidden');
  });
  
  // Mostrar página de inicio
  document.getElementById('pagina-inicio')?.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
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

  // Verificar si las funciones FACS están disponibles
  console.log('✅ Funciones FACS disponibles:', {
    mostrarFACS: typeof mostrarFACS === 'function',
    mostrarFACSCompacto: typeof mostrarFACSCompacto === 'function',
    ocultarFACS: typeof ocultarFACS === 'function'
  });

  const btnParticipante = document.getElementById('btn-iniciar-participante');
  const btnInvestigador = document.getElementById('btn-iniciar-investigador');

  btnParticipante?.addEventListener('click', () => {
    volverAlInicio();
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
