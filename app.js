/* ========================================
   app.js - VERSIÓN MEJORADA CON CAPTURA DE IMAGEN
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
  
  // AGREGAR EXPLICACIÓN DE LA ESCALA
  const instruccionesEscala = document.createElement('div');
  instruccionesEscala.className = 'instrucciones';
  instruccionesEscala.style.marginBottom = '30px';
  instruccionesEscala.innerHTML = `
    <h3>📊 Escala de Respuestas</h3>
    <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-top: 15px; text-align: center;">
      <div style="padding: 10px; background: rgba(255, 99, 132, 0.1); border-radius: 5px; border: 1px solid #ff6384;">
        <strong style="font-size: 1.5em; color: #ff6384;">1</strong>
        <p style="margin: 5px 0 0 0; font-size: 0.9em;">Totalmente en desacuerdo</p>
      </div>
      <div style="padding: 10px; background: rgba(255, 206, 86, 0.1); border-radius: 5px; border: 1px solid #ffce56;">
        <strong style="font-size: 1.5em; color: #ffce56;">2</strong>
        <p style="margin: 5px 0 0 0; font-size: 0.9em;">En desacuerdo</p>
      </div>
      <div style="padding: 10px; background: rgba(102, 126, 234, 0.1); border-radius: 5px; border: 1px solid #667eea;">
        <strong style="font-size: 1.5em; color: #667eea;">3</strong>
        <p style="margin: 5px 0 0 0; font-size: 0.9em;">Neutral</p>
      </div>
      <div style="padding: 10px; background: rgba(54, 162, 235, 0.1); border-radius: 5px; border: 1px solid #36a2eb;">
        <strong style="font-size: 1.5em; color: #36a2eb;">4</strong>
        <p style="margin: 5px 0 0 0; font-size: 0.9em;">De acuerdo</p>
      </div>
      <div style="padding: 10px; background: rgba(76, 175, 80, 0.1); border-radius: 5px; border: 1px solid #4CAF50;">
        <strong style="font-size: 1.5em; color: #4CAF50;">5</strong>
        <p style="margin: 5px 0 0 0; font-size: 0.9em;">Totalmente de acuerdo</p>
      </div>
    </div>
  `;
  form.appendChild(instruccionesEscala);
  
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

    const { publicURL } = supabase.storage
      .from('images')
      .getPublicUrl(fileName);

    console.log('✅ Imagen subida a Storage:', publicURL);
    return publicURL;
    
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

    const imagenData = {
      nombre: persona.nombre || 'Anónimo',  
      edad: parseInt(persona.edad) || 0,
      genero: persona.genero || '',
      pais: persona.pais || '',
      mach: parseFloat(sd3.mach) || 0,
      narc: parseFloat(sd3.narc) || 0,
      psych: parseFloat(sd3.psych) || 0,
      tiempo_total_seg: parseFloat(sd3.tiempo_total_segundos) || 0,
      emocion_principal: analisis.emocion_predominante || analisis.emocion_principal || 'No analizada',
      total_frames: 1,
      duracion_video: 0,
      emociones_detectadas: Array.isArray(analisis.emociones_detectadas) 
        ? analisis.emociones_detectadas 
        : Object.keys(analisis.emociones || {}),
      correlaciones: analisis.correlaciones || {},
      aus_frecuentes: analisis.aus_frecuentes || analisis.aus_detectadas || [],
      facs_promedio: analisis.facs_promedio || {},
      historia_utilizada: historiaUtilizada,
      tipo_captura: 'imagen',
      imagen_analizada: true,
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
      message: 'Datos de imagen guardados correctamente'
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
        ${analisis.aus_frecuentes && analisis.aus_frecuentes.length > 0 ? `
          <p style="color: var(--text-secondary);">
            <strong>AUs detectadas:</strong> ${analisis.aus_frecuentes.join(', ')}
          </p>
        ` : ''}
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
    participantesData = [];
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
    const emocion = p.emocion_princ || 'No analizado';
    const tipo = p.tipo_captura === 'imagen' ? '📸' : '🎬';
    
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
            ${p.historia_utilizada ? `<span style="color: #4CAF50;">📖 ${p.historia_utilizada}</span>` : ''}
            ${p.tipo_captura ? `<span style="color: #48bb78;">${tipo} ${p.tipo_captura}</span>` : ''}
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
      return;
    }

    const headers = [
      'ID', 'Fecha', 'Nombre', 'Edad', 'Género', 'País',
      'Maquiavelismo', 'Narcisismo', 'Psicopatia',
      'Tiempo_Total_Seg', 'Emoción_Principal', 'Historia_Utilizada',
      'Tipo_Captura', 'AUs_Frecuentes', 'Correlación_Maquiavelismo', 
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
        p.tipo_captura || 'imagen',
        `"${(p.aus_frecuentes || []).join('; ')}"`,
        p.correlaciones?.maquiavelismo || 0,
        p.correlaciones?.narcisismo || 0,
        p.correlaciones?.psicopatia || 0
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

/* ---------- FUNCIÓN PARA MOSTRAR PARTICIPANTE EN PANEL ---------- */
function mostrarParticipanteEnPanel(index) {
  if (!participantesData || !participantesData[index]) return;
  
  const p = participantesData[index];
  participanteSeleccionado = p;
  
  // Llenar información del participante
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
  
  // Mostrar resultados SD3
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
  
  // Mostrar microexpresiones
  const microDiv = document.getElementById('microexpresiones-detalle');
  if (microDiv && p.emocion_princ) {
    microDiv.innerHTML = `
      <div style="text-align: center; padding: 20px;">
        <h4 style="color: var(--accent);">Emoción predominante detectada</h4>
        <p style="font-size: 2em; font-weight: bold; color: #7f00ff;">
          ${p.emocion_princ}
        </p>
        ${p.aus_frecuentes && p.aus_frecuentes.length > 0 ? 
          `<p><strong>AUs detectadas:</strong> ${p.aus_frecuentes.join(', ')}</p>` : ''}
        ${p.tipo_captura ? `<p><strong>Tipo de captura:</strong> ${p.tipo_captura}</p>` : ''}
      </div>
    `;
  }
  
  // Mostrar sección de resultados
  document.getElementById('seccion-investigador')?.classList.add('hidden');
  document.getElementById('seccion-resultados')?.classList.remove('hidden');
  window.scrollTo({ top:0, behavior:'smooth' });
  
  // Generar gráficos
  generarGraficosParticipante(p);
}

/* ---------- GENERAR GRÁFICOS PARA PARTICIPANTE ---------- */
function generarGraficosParticipante(participante) {
  // Gráfico de resultados SD3
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
    
    // Obtener datos de participantes
    const { data: participantes, error } = await supabase
      .from('darklens_records')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!participantes || participantes.length === 0) {
      mostrarMensajeAnalisis('No hay suficientes datos para análisis estadístico');
      return;
    }

    // Preparar datos para análisis
    const sd3Scores = participantes.map(p => ({
      mach: p.mach || 0,
      narc: p.narc || 0,
      psych: p.psych || 0
    }));

    const facsScores = participantes.map(p => {
      const facs = {};
      if (p.facs_promedio && typeof p.facs_promedio === 'object') {
        Object.entries(p.facs_promedio).forEach(([au, intensity]) => {
          facs[au] = intensity;
        });
      }
      return facs;
    });

    // 1. Análisis de correlaciones SD3-FACS
    await analizarCorrelaciones(sd3Scores, facsScores);

    // 2. Análisis de tiempos de respuesta
    await analizarTiemposRespuesta(participantes);

    // 3. Análisis de regresión por rasgo predominante
    await analizarRegresiones(participantes);

  } catch (error) {
    console.error('❌ Error en análisis avanzado:', error);
    mostrarMensajeAnalisis('Error cargando análisis: ' + error.message);
  }
}

async function analizarCorrelaciones(sd3Scores, facsScores) {
  try {
    const response = await fetch(`${FASTAPI_URL}/analyze-correlations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sd3_scores: sd3Scores,
        facs_scores: facsScores
      })
    });

    if (!response.ok) throw new Error('Error en análisis de correlaciones');

    const result = await response.json();
    
    if (result.success) {
      mostrarResultadosCorrelaciones(result.correlation_analysis, result.plots);
    }
  } catch (error) {
    console.error('❌ Error analizando correlaciones:', error);
  }
}

function mostrarResultadosCorrelaciones(analysis, plots) {
  const container = document.getElementById('resultados-correlaciones');
  if (!container) return;

  let html = '<h4 style="color: var(--accent); margin-bottom: 20px;">🔗 Correlaciones Significativas</h4>';

  // Mostrar correlaciones significativas
  const significant = analysis.significant_correlations || [];
  
  if (significant.length > 0) {
    html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px;">';
    
    significant.forEach(corr => {
      html += `
        <div class="resultado-box" style="background: rgba(127, 0, 255, 0.1); border-left: 4px solid var(--accent);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <strong style="color: var(--accent);">${corr.sd3_trait} ↔ ${corr.au}</strong>
            <span style="background: ${Math.abs(corr.correlation) > 0.5 ? '#ff6384' : '#36a2eb'}; 
                         color: white; padding: 3px 8px; border-radius: 12px; font-size: 0.9em;">
              r = ${corr.correlation.toFixed(3)}
            </span>
          </div>
          <div style="color: var(--text-secondary); font-size: 0.9em;">
            <div>Fuerza: <strong>${corr.strength}</strong></div>
            <div>Dirección: <strong>${corr.direction}</strong></div>
            <div>Interpretación: ${interpretarCorrelacion(corr.correlation, corr.sd3_trait, corr.au)}</div>
          </div>
        </div>
      `;
    });
    
    html += '</div>';

    // Mostrar gráficos
    html += '<h4 style="color: var(--accent); margin: 30px 0 20px 0;">📊 Gráficos de Correlación</h4>';
    html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px;">';
    
    Object.entries(plots).forEach(([key, plotBase64]) => {
      html += `
        <div class="resultado-box">
          <img src="data:image/png;base64,${plotBase64}" 
               style="width: 100%; border-radius: 10px; border: 1px solid var(--border);">
        </div>
      `;
    });
    
    html += '</div>';
  } else {
    html += '<p style="color: var(--text-secondary); text-align: center;">No se encontraron correlaciones significativas (|r| > 0.3)</p>';
  }

  container.innerHTML = html;
}

function interpretarCorrelacion(r, sd3Trait, au) {
  const traits = {
    'mach': 'maquiavelismo',
    'narc': 'narcisismo', 
    'psych': 'psicopatía'
  };
  
  const aus = {
    'AU1': 'elevación de ceja interna',
    'AU4': 'fruncimiento de cejas',
    'AU12': 'sonrisa (estiramiento de labios)',
    'AU15': 'comisuras labiales hacia abajo'
  };
  
  const traitName = traits[sd3Trait] || sd3Trait;
  const auName = aus[au] || au;
  
  if (r > 0.5) {
    return `Personas con ${traitName} alto muestran más ${auName}`;
  } else if (r > 0.3) {
    return `Relación moderada entre ${traitName} y ${auName}`;
  } else if (r < -0.3) {
    return `Personas con ${traitName} alto muestran menos ${auName}`;
  }
  
  return 'Correlación débil o no significativa';
}

async function analizarTiemposRespuesta(participantes) {
  try {
    // Extraer datos de tiempos (si están disponibles)
    const tiemposData = [];
    
    participantes.forEach(p => {
      if (p.tiempos_respuesta) {
        const tiempos = typeof p.tiempos_respuesta === 'string' 
          ? JSON.parse(p.tiempos_respuesta)
          : p.tiempos_respuesta;
        
        Object.values(tiempos).forEach(tiempo => {
          if (tiempo && typeof tiempo === 'object') {
            tiemposData.push({
              item_number: tiempo.item_number,
              tiempo_ms: tiempo.tiempo_ms || 0,
              pregunta: tiempo.pregunta
            });
          }
        });
      }
    });

    if (tiemposData.length === 0) {
      document.getElementById('resultados-tiempos').innerHTML = 
        '<p style="color: var(--text-secondary); text-align: center;">No hay datos de tiempos de respuesta disponibles</p>';
      return;
    }

    const response = await fetch(`${FASTAPI_URL}/analyze-response-times`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tiempos_data: tiemposData })
    });

    if (!response.ok) throw new Error('Error en análisis de tiempos');

    const result = await response.json();
    
    if (result.success) {
      mostrarResultadosTiempos(result.response_time_analysis);
    }
  } catch (error) {
    console.error('❌ Error analizando tiempos:', error);
  }
}

function mostrarResultadosTiempos(analysis) {
  const container = document.getElementById('resultados-tiempos');
  if (!container) return;

  let html = '<h4 style="color: var(--accent); margin-bottom: 20px;">⏱️ Análisis de Tiempos de Respuesta</h4>';

  // Gráfico de tiempos
  if (analysis.times_plot) {
    html += `
      <div style="text-align: center; margin-bottom: 30px;">
        <img src="data:image/png;base64,${analysis.times_plot}" 
             style="max-width: 100%; border-radius: 10px; border: 1px solid var(--border);">
      </div>
    `;
  }

  // Ítems más rápidos y más lentos
  html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 20px;">';
  
  // Ítems más rápidos
  if (analysis.fastest_items && analysis.fastest_items.length > 0) {
    html += `
      <div class="resultado-box">
        <h5 style="color: #4CAF50; margin-bottom: 15px;">🚀 Ítems Más Rápidos</h5>
        ${analysis.fastest_items.map(item => `
          <div style="margin-bottom: 10px; padding: 10px; background: rgba(76, 175, 80, 0.1); border-radius: 5px;">
            <div style="font-weight: bold;">${item.question}</div>
            <div style="color: var(--text-secondary); font-size: 0.9em;">
              Tiempo promedio: <strong>${item.mean_time.toFixed(0)} ms</strong>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // Ítems más lentos
  if (analysis.slowest_items && analysis.slowest_items.length > 0) {
    html += `
      <div class="resultado-box">
        <h5 style="color: #ff6384; margin-bottom: 15px;">🐌 Ítems Más Lentos</h5>
        ${analysis.slowest_items.map(item => `
          <div style="margin-bottom: 10px; padding: 10px; background: rgba(255, 99, 132, 0.1); border-radius: 5px;">
            <div style="font-weight: bold;">${item.question}</div>
            <div style="color: var(--text-secondary); font-size: 0.9em;">
              Tiempo promedio: <strong>${item.mean_time.toFixed(0)} ms</strong>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  html += '</div>';

  container.innerHTML = html;
}

async function analizarRegresiones(participantes) {
  try {
    // Preparar datos para regresión: Maquiavelismo vs Intensidad de AU4
    const xData = participantes.map(p => p.mach || 0).filter(val => val > 0);
    const yData = participantes.map(p => {
      if (p.facs_promedio && typeof p.facs_promedio === 'object') {
        return p.facs_promedio.AU4 || 0;
      }
      return 0;
    }).filter(val => val > 0);

    if (xData.length < 3 || yData.length < 3) {
      document.getElementById('resultados-regresion').innerHTML = 
        '<p style="color: var(--text-secondary); text-align: center;">Datos insuficientes para análisis de regresión</p>';
      return;
    }

    const response = await fetch(`${FASTAPI_URL}/regression-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        x_data: xData,
        y_data: yData,
        x_label: 'Maquiavelismo (SD3)',
        y_label: 'Intensidad AU4 (FACS)'
      })
    });

    if (!response.ok) throw new Error('Error en análisis de regresión');

    const result = await response.json();
    
    if (result.success) {
      mostrarResultadosRegresion(result);
    }
  } catch (error) {
    console.error('❌ Error analizando regresiones:', error);
  }
}

function mostrarResultadosRegresion(result) {
  const container = document.getElementById('resultados-regresion');
  if (!container) return;

  const regression = result.regression_results;
  const correlation = result.correlation_stats;
  
  let html = '<h4 style="color: var(--accent); margin-bottom: 20px;">📈 Análisis de Regresión Lineal</h4>';

  // Gráfico de dispersión con línea de regresión
  if (result.scatter_plot) {
    html += `
      <div style="text-align: center; margin-bottom: 30px;">
        <img src="data:image/png;base64,${result.scatter_plot}" 
             style="max-width: 100%; border-radius: 10px; border: 1px solid var(--border);">
      </div>
    `;
  }

  // Estadísticas
  html += `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
      <div class="stat-mini">
        <div class="stat-mini-label">Ecuación de Regresión</div>
        <div class="stat-mini-value" style="font-size: 1.2em;">${regression.equation}</div>
      </div>
      <div class="stat-mini">
        <div class="stat-mini-label">R² (Ajuste)</div>
        <div class="stat-mini-value">${regression.r_squared.toFixed(3)}</div>
      </div>
      <div class="stat-mini">
        <div class="stat-mini-label">Correlación (r)</div>
        <div class="stat-mini-value">${correlation.pearson_r.toFixed(3)}</div>
      </div>
      <div class="stat-mini">
        <div class="stat-mini-label">Significancia</div>
        <div class="stat-mini-value" style="color: ${correlation.p_value < 0.05 ? '#4CAF50' : '#ff6384'};">
          ${correlation.significance}
        </div>
      </div>
    </div>
  `;

  // Interpretación
  html += `
    <div class="resultado-box" style="background: rgba(127, 0, 255, 0.1); border-left: 4px solid var(--accent);">
      <h5 style="color: var(--accent); margin-bottom: 10px;">🧠 Interpretación</h5>
      <p style="color: var(--text-secondary); line-height: 1.6;">
        ${result.interpretation}
      </p>
      <p style="color: var(--text-secondary); margin-top: 10px; font-size: 0.9em;">
        <strong>Nota:</strong> p = ${correlation.p_value.toFixed(4)} | 
        La regresión muestra cómo cambia la intensidad de AU4 por cada punto de maquiavelismo.
      </p>
    </div>
  `;

  container.innerHTML = html;
}

function mostrarMensajeAnalisis(mensaje) {
  const container = document.getElementById('seccion-analisis');
  if (container) {
    container.innerHTML = `
      <div class="content-box">
        <h2 style="color: var(--accent);">Análisis Estadístico Avanzado</h2>
        <div style="text-align: center; padding: 40px;">
          <p style="color: var(--text-secondary); font-size: 1.2em;">${mensaje}</p>
          <button id="btn-volver-investigador2" class="btn-secondary" style="margin-top: 20px;">
            Volver al panel
          </button>
        </div>
      </div>
    `;
    
    document.getElementById('btn-volver-investigador2')?.addEventListener('click', () => {
      document.getElementById('seccion-analisis').classList.add('hidden');
      document.getElementById('seccion-investigador').classList.remove('hidden');
      window.scrollTo({ top:0, behavior:'smooth' });
    });
  }
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
  
  // Ocultar todas las secciones
  document.querySelectorAll('section').forEach(section => {
    section.classList.add('hidden');
  });
  
  // Mostrar solo la página de inicio
  document.getElementById('pagina-inicio')?.classList.remove('hidden');
  window._capturaInicializada = false;
  window.scrollTo({ top:0, behavior:'smooth' });
}

/* ---------- INICIALIZACIÓN ---------- */
document.addEventListener('DOMContentLoaded', () => {
  // Verificar inicialización de Supabase
  console.log('✅ Supabase inicializado correctamente:', supabase ? 'Sí' : 'No');
  
  // Limpiar sesión
  sessionStorage.clear();
  tiemposRespuesta = {};
  tiempoInicioItem = {};
  testInicioTimestamp = null;
  imagenCapturada = null;
  capturedBlob = null;
  window._capturaInicializada = false;
  console.log('✅ Sesión limpiada al cargar');

  // Configurar botones principales
  const btnParticipante = document.querySelector('#card-participante .btn-primary');
  const btnInvestigador = document.querySelector('#card-investigador .btn-primary');

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

  // Configurar formulario de datos básicos
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

  // Configurar formulario SD3
  const formSD3 = document.getElementById('form-sd3');
  formSD3?.addEventListener('submit', (e) => {
    e.preventDefault();
    calcularSD3();
  });

  // Configurar login investigador
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

  // Configurar botones de navegación
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
    document.getElementById('seccion-analisis')?.classList.add('hidden');
    document.getElementById('seccion-investigador')?.classList.remove('hidden');
    window.scrollTo({ top:0, behavior:'smooth' });
  });
});

/* ---------- FIN ---------- */
