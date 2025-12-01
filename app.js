/* ========================================
   app.js - VERSIÓN COMPLETA CORREGIDA
   ======================================== */

/* ---------- CONFIG SUPABASE ---------- */
const SUPABASE_CONFIG = {
  URL: 'https://cdhndtzuwtmvhiulvzbp.supabase.co',
  ANON_KEY: 'sb_publishable_mzTN7UGk3aZJ8b3Zxf_44g_gK5kaJlV'
};
const FASTAPI_URL = "https://darklnesapp-api-1.onrender.com";
const PASSWORD_INVESTIGADOR = "investigador2025";

// ✅ CORREGIDO: Declarar sin inicializar
let supabase;

/* ---------- ESTADO GLOBAL ---------- */
const invertidos = [11, 15, 17, 20, 25];
let tiemposRespuesta = {};
let tiempoInicioItem = {};
let testInicioTimestamp = null;
let stream = null;
let participantesData = [];
let participanteSeleccionado = null;

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
  "Debes esperar el momento oportuno para vengarte de las personas.",
  "Hay cosas que deberías ocultar a los demás porque no necesitan saberlas.",
  "Asegúrate de que tus planes te beneficien a ti, no a los demás.",
  "La mayoría de las personas pueden ser manipuladas.",
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

  // ✅ AGREGAR INSTRUCCIONES
  const instrucciones = document.createElement('div');
  instrucciones.className = 'instrucciones';
  instrucciones.innerHTML = `
    <h3>📝 Instrucciones</h3>
    <p>Por favor, respondé cada ítem según lo que mejor describe tus actitudes. Usá la siguiente escala:</p>
    <div style="display: flex; justify-content: space-around; margin: 20px 0; text-align: center;">
      <div>
        <div style="font-size: 2em; color: var(--accent);">1</div>
        <div style="font-weight: bold; color: var(--text-primary);">Muy en desacuerdo</div>
      </div>
      <div>
        <div style="font-size: 2em; color: var(--accent);">2</div>
        <div style="color: var(--text-primary);">En desacuerdo</div>
      </div>
      <div>
        <div style="font-size: 2em; color: var(--accent);">3</div>
        <div style="color: var(--text-primary);">Neutral</div>
      </div>
      <div>
        <div style="font-size: 2em; color: var(--accent);">4</div>
        <div style="color: var(--text-primary);">De acuerdo</div>
      </div>
      <div>
        <div style="font-size: 2em; color: var(--accent);">5</div>
        <div style="font-weight: bold; color: var(--text-primary);">Muy de acuerdo</div>
      </div>
    </div>
    <p><strong>Recordá:</strong> 1 = Muy en desacuerdo, 5 = Muy de acuerdo. Algunos ítems están invertidos (R) y se calificarán de manera inversa.</p>
  `;
  form.appendChild(instrucciones);

  // Generar los ítems
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
    tiemposRespuesta[itemNum] = { tiempo_ms: lapso, tiempo_segundos: (lapso/1000).toFixed(2), timestamp_inicio: inicio, timestamp_respuesta: ahora };
  } else {
    const desdeInicio = testInicioTimestamp ? (ahora - testInicioTimestamp) : 0;
    tiemposRespuesta[itemNum] = { tiempo_ms: desdeInicio, tiempo_segundos: (desdeInicio/1000).toFixed(2), timestamp_inicio: testInicioTimestamp, timestamp_respuesta: ahora, nota: 'respondido_sin_intersection' };
  }
}

/* ---------- CALCULAR SD3 ---------- */
async function calcularSD3() {
  var respuestas = []; var respuestasObj = {};
  for (var i = 1; i <= itemsSD3.length; i++) {
    var sel = document.querySelector('input[name="item' + i + '"]:checked');
    if (!sel) {
      alert('Por favor respondé el ítem ' + i);
      var primer = document.querySelector('input[name="item' + i + '"]');
      if (primer) primer.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    var val = parseInt(sel.value);
    if (invertidos.includes(i)) val = 6 - val;
    respuestas.push(val);
    respuestasObj['item' + i] = val;
  }
  var mean = function(arr) { return arr.reduce(function(a,b) { return a + b; }, 0) / arr.length; };
  var mach = parseFloat(mean(respuestas.slice(0,9)).toFixed(2));
  var narc = parseFloat(mean(respuestas.slice(9,18)).toFixed(2));
  var psych = parseFloat(mean(respuestas.slice(18,27)).toFixed(2));
  var fin = Date.now();
  var tiempoTotal = fin - (testInicioTimestamp || fin);
  var tiemposArray = Object.values(tiemposRespuesta).map(function(t) { return t ? t.tiempo_ms : 0; });
  var estadisticasTiempo = calcularEstadisticasTiempo(tiemposArray);
  var resultadosSD3 = { mach: mach, narc: narc, psych: psych, respuestas: respuestasObj, tiempos_respuesta: tiemposRespuesta, tiempo_total_ms: tiempoTotal, tiempo_total_segundos: (tiempoTotal/1000).toFixed(2), estadisticas_tiempo: estadisticasTiempo };
  sessionStorage.setItem('resultadosSD3', JSON.stringify(resultadosSD3));

  // ✅ CORREGIDO: Ocultar test y mostrar directamente la sección micro
  var seccionTest = document.getElementById('seccion-test');
  var seccionMicro = document.getElementById('seccion-micro');
  if (seccionTest) seccionTest.classList.add('hidden');
  if (seccionMicro) seccionMicro.classList.remove('hidden');
  
  // ✅ CORREGIDO: Mostrar historia inmediatamente
  mostrarHistoriaInmediata();
  
  window.scrollTo({ top:0, behavior:'smooth' });
}

/* ---------- MOSTRAR HISTORIA INMEDIATA ---------- */
function mostrarHistoriaInmediata() {
  console.log('🎭 Mostrando historia inmediata...');
  
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
  if (textoHistoriaDiv) {
    textoHistoriaDiv.innerHTML = `
      <strong>Historia: ${historiaSeleccionada.titulo}</strong>
      <p style="margin: 10px 0; font-style: italic; color: var(--text-secondary); line-height: 1.6;">
        ${historiaSeleccionada.texto}
      </p>
      <small style="color: var(--accent);">Rasgo analizado: ${rasgoPredominante}</small>
    `;
    // ✅ Asegurar que el contenedor sea visible
    textoHistoriaDiv.classList.remove('hidden');
    document.getElementById('audio-container')?.classList.remove('hidden');
  }

  console.log('✅ Historia mostrada para rasgo:', rasgoPredominante);
}

/* ---------- GRABACIÓN DE VIDEO CORREGIDA ---------- */
function configurarGrabacionVideo() {
  console.log('🎥 Configurando grabación de video...');
  
  var video = document.getElementById('video');
  var btnActivarCamara = document.getElementById('btn-activar-camara');
  var btnIniciarGrabacion = document.getElementById('btn-iniciar-grabacion');
  var btnDetenerGrabacion = document.getElementById('btn-detener-grabacion');
  var btnSubirVideo = document.getElementById('btn-subir-video');
  var previewContainer = document.getElementById('preview-container');
  var previewVideo = document.getElementById('preview-video');
  var progressContainer = document.getElementById('progress-container');
  var progressBar = document.getElementById('progress-bar');
  var tiempoGrabacion = document.getElementById('tiempo-grabacion');
  var infoVideo = document.getElementById('info-video');

  var stream = null; var mediaRecorder = null; var recordedChunks = []; var grabacionEnCurso = false;
  var tiempoInicioGrabacion = null; var intervaloProgress = null; var duracionGrabacion = 15000;

  // ✅ MOSTRAR HISTORIA INMEDIATAMENTE
  mostrarHistoriaInmediata();
  
  btnActivarCamara.addEventListener('click', async function() {
    console.log('📷 Activando cámara...');
    try {
      stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user', 
          width: { ideal: 640 }, 
          height: { ideal: 480 }, 
          frameRate: { ideal: 15 } 
        }, 
        audio: false 
      });
      if (video) { 
        video.srcObject = stream; 
        video.classList.remove('hidden'); 
        video.play(); 
      }
      btnActivarCamara.classList.add('hidden');
      btnIniciarGrabacion.classList.remove('hidden');
      document.getElementById('audio-container').classList.remove('hidden');
      var cameraPlaceholder = document.getElementById('camera-placeholder');
      if (cameraPlaceholder) cameraPlaceholder.classList.add('hidden');
      console.log('✅ Cámara activada');
    } catch (err) {
      console.error('Error accediendo a la cámara:', err);
      alert('No se pudo acceder a la cámara. Podés continuar sin video.');
      // ✅ Mostrar botón de grabar igual aunque falle la cámara
      btnActivarCamara.classList.add('hidden');
      btnIniciarGrabacion.classList.remove('hidden');
      document.getElementById('audio-container').classList.remove('hidden');
    }
  });

  btnIniciarGrabacion.addEventListener('click', function() {
    if (!stream) { 
      console.warn('⚠️ No hay stream de cámara, pero iniciando grabación de audio...');
    }
    recordedChunks = [];
    try {
      var options = { mimeType: 'video/webm; codecs=vp9,opus' };
      mediaRecorder = new MediaRecorder(stream || new MediaStream(), options);
      mediaRecorder.ondataavailable = function(event) { 
        if (event.data.size > 0) { recordedChunks.push(event.data); } 
      };
      mediaRecorder.onstop = function() {
        var blob = new Blob(recordedChunks, { type: 'video/webm' });
        var videoURL = URL.createObjectURL(blob);
        previewVideo.src = videoURL;
        previewContainer.classList.remove('hidden');
        btnSubirVideo.classList.remove('hidden');
        var duracion = (Date.now() - tiempoInicioGrabacion) / 1000;
        infoVideo.innerHTML = '<p>Duración: ' + duracion.toFixed(1) + ' segundos</p><p>Tamaño: ' + (blob.size / 1024 / 1024).toFixed(2) + ' MB</p><p>Se analizarán ' + Math.floor(duracion) + ' frames (1 por segundo)</p>';
      };
      mediaRecorder.start(1000); 
      grabacionEnCurso = true; 
      tiempoInicioGrabacion = Date.now();
      btnIniciarGrabacion.classList.add('hidden'); 
      btnDetenerGrabacion.classList.remove('hidden'); 
      progressContainer.classList.remove('hidden');
      iniciarProgressBar();
      console.log('🎬 Grabación iniciada');
    } catch (err) { 
      console.error('Error iniciando grabación:', err); 
      alert('Error al iniciar la grabación: ' + err.message); 
    }
  });

  function iniciarProgressBar() {
    var tiempoTranscurrido = 0; 
    progressBar.style.width = '0%';
    console.log('🎬 Iniciando grabación de reacción...');
    intervaloProgress = setInterval(function() {
      tiempoTranscurrido += 100;
      var porcentaje = (tiempoTranscurrido / duracionGrabacion) * 100;
      progressBar.style.width = Math.min(porcentaje, 100) + '%';
      tiempoGrabacion.textContent = (tiempoTranscurrido / 1000).toFixed(1) + 's';
      if (tiempoTranscurrido >= duracionGrabacion) { detenerGrabacion(); }
    }, 100);
  }

  btnDetenerGrabacion.addEventListener('click', function() { detenerGrabacion(); });
  
  function detenerGrabacion() {
    if (mediaRecorder && grabacionEnCurso) {
      mediaRecorder.stop(); 
      grabacionEnCurso = false;
      if (intervaloProgress) { clearInterval(intervaloProgress); intervaloProgress = null; }
      btnDetenerGrabacion.classList.add('hidden'); 
      progressContainer.classList.add('hidden');
      if (stream) { 
        stream.getTracks().forEach(function(track) { track.stop(); }); 
        stream = null; 
        video.classList.add('hidden'); 
      }
      console.log('🛑 Grabación detenida');
    }
  }

  btnSubirVideo.addEventListener('click', async function() {
    if (recordedChunks.length === 0) { alert('No hay video para analizar'); return; }
    btnSubirVideo.disabled = true; 
    btnSubirVideo.textContent = '⏳ Enviando a Render...';
    try {
      var blob = new Blob(recordedChunks, { type: 'video/webm' });
      var base64Video = await blobToBase64(blob);
      var persona = JSON.parse(sessionStorage.getItem('datos_personales') || '{}');
      var sd3 = JSON.parse(sessionStorage.getItem('resultadosSD3') || '{}');
      console.log('🎬 Iniciando análisis de video...');
      var analisisVideo = await analizarVideoCompleto(base64Video, persona, sd3);
      if (analisisVideo.success) { mostrarConfirmacionParticipante(analisisVideo); } 
      else { throw new Error(analisisVideo.error || 'Error en el análisis del video'); }
    } catch (err) {
      console.error("❌ Error procesando video:", err); 
      alert("Error: " + err.message);
      btnSubirVideo.disabled = false; 
      btnSubirVideo.textContent = "📤 Subir Video y Analizar";
    }
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
      total_frames: analisis.total_frames || 0,
      duracion_video: analisis.duracion_video || 0,
      emociones_detectadas: analisis.emociones_detectadas || [],
      correlaciones: analisis.correlaciones || {},
      aus_frecuentes: analisis.aus_frecuentes || [],
      facs_promedio: analisis.facs_promedio || {},
      intensidad_promedio: analisis.intensidad_promedio || 0,
      variabilidad_emocional: analisis.variabilidad_emocional || 0,
      modelos_utilizados: analisis.modelos_utilizados || {},
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
        ${analisis.aus_frecuentes && analisis.aus_frecuentes.length > 0 ? `
          <p style="color: var(--text-secondary);">
            <strong>AUs detectadas:</strong> ${analisis.aus_frecuentes.join(', ')}
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
    <button id="btn-descargar-csv" class="btn-primary" style="display: flex; align-items: center; gap: 8px;">
      📊 Descargar CSV (${participantesData.length})
    </button>
  `;
  
  listaDiv.appendChild(headerDiv);
  
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
      'Total_Frames', 'Duración_Video', 'Correlación_Maquiavelismo', 
      'Correlación_Narcisismo', 'Correlación_Psicopatia',
      'AUs_Frecuentes', 'Intensidad_Promedio', 'Variabilidad_Emocional'
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
        p.correlaciones?.psicopatia || 0,
        `"${(p.aus_frecuentes || []).join('; ')}"`,
        p.intensidad_promedio || 0,
        p.variabilidad_emocional || 0
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
  if (!participantesData || index >= participantesData.length) return;
  
  participanteSeleccionado = participantesData[index];
  
  // Aquí puedes implementar la lógica para mostrar detalles del participante
  console.log('Mostrando participante:', participanteSeleccionado);
  
  // Por ahora solo mostramos un alert
  alert(`Participante: ${participanteSeleccionado.nombre}\nEmoción: ${participanteSeleccionado.emocion_princ}\nHistoria: ${participanteSeleccionado.historia_utilizada}`);
}

/* ---------- INICIALIZACIÓN ---------- */
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Inicializando aplicación DARKLENS...');
  
  // ✅ CORREGIDO: Inicializar Supabase correctamente
  try {
    // Verificar si Supabase está disponible globalmente
    if (typeof window.supabase !== 'undefined') {
      supabase = window.supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);
      console.log('✅ Supabase inicializado correctamente');
    } else {
      console.error('❌ Supabase no está disponible globalmente');
      console.log('⚠️ Asegúrate de incluir: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script> en tu HTML');
    }
  } catch (error) {
    console.error('❌ Error inicializando Supabase:', error);
  }

  // Limpiar sesión
  sessionStorage.clear();
  tiemposRespuesta = {};
  tiempoInicioItem = {};
  testInicioTimestamp = null;
  window._capturaInicializada = false;
  console.log('✅ Sesión limpiada al cargar');

  // Event listeners para botones principales
  const btnParticipante = document.querySelector('#card-participante .btn-primary');
  const btnInvestigador = document.querySelector('#card-investigador .btn-primary');

  btnParticipante?.addEventListener('click', () => {
    console.log('👤 Iniciando como participante...');
    sessionStorage.clear();
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
    console.log('🔬 Accediendo como investigador...');
    document.getElementById('pagina-inicio')?.classList.add('hidden');
    document.getElementById('seccion-login')?.classList.remove('hidden');
    window.scrollTo({ top:0, behavior:'smooth' });
  });

  // Formulario de datos básicos
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
    console.log('✅ Datos personales guardados');
  });

  // Formulario SD3
  const formSD3 = document.getElementById('form-sd3');
  formSD3?.addEventListener('submit', (e) => {
    e.preventDefault();
    console.log('📝 Enviando test SD3...');
    calcularSD3();
  });

  // Login investigador
  const btnLoginInv = document.getElementById('btn-login-investigador');
  const inputPasswordInv = document.getElementById('password-investigador');
  btnLoginInv?.addEventListener('click', () => {
    const pw = inputPasswordInv?.value?.trim() || '';
    if (pw === PASSWORD_INVESTIGADOR) {
      console.log('✅ Acceso investigador concedido');
      document.getElementById('seccion-login')?.classList.add('hidden');
      document.getElementById('seccion-investigador')?.classList.remove('hidden');
      cargarDatosParticipantes();
      window.scrollTo({ top:0, behavior:'smooth' });
    } else {
      alert('❌ Contraseña incorrecta');
      if (inputPasswordInv) inputPasswordInv.value = '';
    }
  });

  // Botones de navegación
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

  console.log('✅ Aplicación inicializada');
});

/* ---------- FUNCIONES GLOBALES ---------- */
function volverAlInicio() {
  sessionStorage.clear();
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
  console.log('🏠 Volviendo al inicio');
}

/* ---------- FIN ---------- */
