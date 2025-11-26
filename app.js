/* app.js - UNIFICADO
   Mantener diseño intacto. Endpoints provistos por la usuaria.
*/

/* ========================================
   CONFIG — ENDPOINTS & CONSTANTES
   ======================================== */
const RENDER_PREDICT_URL = "https://darklnesapp-api.onrender.com/run/predict";
const GOOGLE_SHEETS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbwm8kIl1h0Avas55eNI0dbiKj-MPCbuXyQp7ndsQYiDdmcsmDGYgyirgt2sorvOFLEZgA/exec";
// Para lectura en panel investigador (usa action=getAll)
const GOOGLE_SHEETS_READ_URL = GOOGLE_SHEETS_WEBAPP_URL;

const PASSWORD_INVESTIGADOR = "investigador2025"; // ⚠️ cambiá si querés

/* ========================================
   VARIABLES GLOBALES
   ======================================== */
const invertidos = [11, 15, 17, 20, 25];
let graficoSD3 = null;
let resultadosSD3 = null;
let resultadosMicro = null;
let imagenCapturada = null;
let stream = null;

/* Items SD3 */
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

/* ========================================
   TIEMPOS
   ======================================== */
let tiemposRespuesta = {};
let tiempoInicioItem = {};
let testInicioTimestamp = null;

/* ========================================
   UTIL: cambio dataURL -> Blob
   ======================================== */
function dataURLtoBlob(dataurl) {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new Blob([u8arr], { type: mime });
}

/* ========================================
   UTIL: estadísticas tiempo
   ======================================== */
function calcularEstadisticasTiempo(tiemposArray) {
  if (!Array.isArray(tiemposArray) || tiemposArray.length === 0) {
    return {
      promedio_ms: 0, promedio_segundos: '0.00',
      mediana_ms: 0, mediana_segundos: '0.00',
      minimo_ms: 0, minimo_segundos: '0.00',
      maximo_ms: 0, maximo_segundos: '0.00',
      desviacion_estandar_ms: 0, desviacion_estandar_segundos: '0.00',
      total_items: 0
    };
  }
  const suma = tiemposArray.reduce((a, b) => a + b, 0);
  const promedio = suma / tiemposArray.length;
  const sorted = [...tiemposArray].sort((a, b) => a - b);
  const medio = Math.floor(sorted.length / 2);
  const mediana = sorted.length % 2 === 0 ? (sorted[medio - 1] + sorted[medio]) / 2 : sorted[medio];
  const minimo = sorted[0];
  const maximo = sorted[sorted.length - 1];
  const varianza = tiemposArray.reduce((acc, val) => acc + Math.pow(val - promedio, 2), 0) / tiemposArray.length;
  const desviacionEstandar = Math.sqrt(varianza);
  return {
    promedio_ms: Math.round(promedio),
    promedio_segundos: (promedio / 1000).toFixed(2),
    mediana_ms: Math.round(mediana),
    mediana_segundos: (mediana / 1000).toFixed(2),
    minimo_ms: minimo,
    minimo_segundos: (minimo / 1000).toFixed(2),
    maximo_ms: maximo,
    maximo_segundos: (maximo / 1000).toFixed(2),
    desviacion_estandar_ms: Math.round(desviacionEstandar),
    desviacion_estandar_segundos: (desviacionEstandar / 1000).toFixed(2),
    total_items: tiemposArray.length
  };
}

/* ========================================
   GENERAR ITEMS SD3 (inserta en #form-sd3)
   ======================================== */
function generarItemsTest() {
  const form = document.getElementById('form-sd3');
  if (!form) {
    console.warn('generarItemsTest: no se encontró #form-sd3');
    return;
  }
  form.innerHTML = '';
  itemsSD3.forEach((texto, index) => {
    const num = index + 1;
    const div = document.createElement('div');
    div.className = 'test-item';
    div.setAttribute('data-item', num);
    div.innerHTML = `
        <p><strong>${num}.</strong> ${texto}</p>
        <div class="opciones">
            ${[1,2,3,4,5].map(val => `
                <input type="radio" id="item${num}_${val}" name="item${num}" value="${val}" required>
                <label for="item${num}_${val}">${val}</label>
            `).join('')}
        </div>
    `;
    form.appendChild(div);
  });

  const btnSubmit = document.createElement('button');
  btnSubmit.type = 'submit';
  btnSubmit.textContent = 'Enviar respuestas del test';
  btnSubmit.className = 'btn-primary';
  form.appendChild(btnSubmit);
}

/* ========================================
   TRACKING DE TIEMPOS (IntersectionObserver + change)
   ======================================== */
function configurarTrackingTiempos() {
  // Reinicio estructuras
  tiemposRespuesta = {};
  tiempoInicioItem = {};

  const items = document.querySelectorAll('.test-item');
  if (items.length === 0) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const itemDiv = entry.target;
        const itemNum = parseInt(itemDiv.getAttribute('data-item'));
        const input = document.querySelector(`input[name="item${itemNum}"]:checked`);
        if (!input && !tiempoInicioItem[itemNum]) {
          tiempoInicioItem[itemNum] = Date.now();
        }
      }
    });
  }, { threshold: 0.5 });

  items.forEach(item => observer.observe(item));

  for (let i = 1; i <= itemsSD3.length; i++) {
    const radios = document.querySelectorAll(`input[name="item${i}"]`);
    radios.forEach(radio => {
      radio.addEventListener('change', () => registrarTiempoRespuesta(i));
    });
  }
}

function registrarTiempoRespuesta(itemNum) {
  if (tiemposRespuesta[itemNum]) return; // ya registrado

  const tiempoInicio = tiempoInicioItem[itemNum];
  if (tiempoInicio) {
    const tiempoFin = Date.now();
    const tiempoRespuesta = tiempoFin - tiempoInicio;
    tiemposRespuesta[itemNum] = {
      tiempo_ms: tiempoRespuesta,
      tiempo_segundos: (tiempoRespuesta / 1000).toFixed(2),
      timestamp_inicio: tiempoInicio,
      timestamp_respuesta: tiempoFin
    };
  } else {
    // si no se registró visibilidad, calculamos desde inicio del test
    const tiempoDesdeInicio = testInicioTimestamp ? (Date.now() - testInicioTimestamp) : 0;
    tiemposRespuesta[itemNum] = {
      tiempo_ms: tiempoDesdeInicio,
      tiempo_segundos: (tiempoDesdeInicio / 1000).toFixed(2),
      timestamp_inicio: testInicioTimestamp,
      timestamp_respuesta: Date.now(),
      nota: 'Respondido antes de visualización completa'
    };
  }
}

/* ========================================
   CALCULAR SD3 (y guardar en sessionStorage)
   ======================================== */
function calcularSD3() {
  const respuestas = [];
  const respuestasObj = {};

  for (let i = 1; i <= itemsSD3.length; i++) {
    const input = document.querySelector(`input[name="item${i}"]:checked`);
    if (!input) {
      alert(`Por favor respondé el ítem ${i}`);
      const firstRadio = document.querySelector(`input[name="item${i}"]`);
      if (firstRadio) firstRadio.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    let val = parseInt(input.value);
    if (invertidos.includes(i)) val = 6 - val;
    respuestas.push(val);
    respuestasObj[`item${i}`] = val;
  }

  const mean = arr => arr.reduce((a,b) => a+b, 0) / arr.length;
  const mach = parseFloat(mean(respuestas.slice(0,9)).toFixed(2));
  const narc = parseFloat(mean(respuestas.slice(9,18)).toFixed(2));
  const psych = parseFloat(mean(respuestas.slice(18,27)).toFixed(2));

  const testFinTimestamp = Date.now();
  const tiempoTotalTest = testFinTimestamp - (testInicioTimestamp || testFinTimestamp);
  const tiemposArray = Object.values(tiemposRespuesta).map(t => t?.tiempo_ms || 0);
  const estadisticasTiempo = calcularEstadisticasTiempo(tiemposArray);

  resultadosSD3 = {
    mach, narc, psych,
    respuestas: respuestasObj,
    tiempos_respuesta: tiemposRespuesta,
    tiempo_total_ms: tiempoTotalTest,
    tiempo_total_segundos: (tiempoTotalTest / 1000).toFixed(2),
    estadisticas_tiempo: estadisticasTiempo
  };

  sessionStorage.setItem('resultadosSD3', JSON.stringify(resultadosSD3));

  // Mostrar resultados inmediatos en la página si existe el contenedor
  const resultadoSD3 = document.getElementById('resultado-sd3');
  if (resultadoSD3) {
    resultadoSD3.innerHTML = `
      <div class="resultado-box">
        <h4>Tus resultados SD3</h4>
        <p><strong>Maquiavelismo:</strong> ${mach} / 5.0</p>
        <p><strong>Narcisismo:</strong> ${narc} / 5.0</p>
        <p><strong>Psicopatía:</strong> ${psych} / 5.0</p>
        <p style="margin-top:15px; font-size:0.9em; color:#b0a0ff;">
          <strong>Tiempo total:</strong> ${(tiempoTotalTest/1000/60).toFixed(1)} minutos<br>
          <strong>Tiempo promedio por ítem:</strong> ${estadisticasTiempo.promedio_segundos}s
        </p>
      </div>
    `;
    resultadoSD3.classList.remove('hidden');
  }

  const graficoContainer = document.getElementById('grafico-container');
  if (graficoContainer) {
    graficoContainer.classList.remove('hidden');
    crearGraficoSD3(mach, narc, psych);
  }

  const narrativaSD3 = document.getElementById('narrativa-sd3');
  if (narrativaSD3) {
    narrativaSD3.innerHTML = generarNarrativa(mach, narc, psych);
    narrativaSD3.classList.remove('hidden');
  }

  const btnContinuar = document.getElementById('btn-continuar-micro');
  if (btnContinuar) btnContinuar.classList.remove('hidden');
}

/* ========================================
   GRAFICOS SD3 (canvas id="grafico-sd3")
   - Usa Chart.js (debe estar incluido en HTML)
   ======================================== */
function crearGraficoSD3(mach, narc, psych) {
  const canvas = document.getElementById('grafico-sd3');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (graficoSD3) {
    try { graficoSD3.destroy(); } catch (e) {}
  }
  graficoSD3 = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Maquiavelismo','Narcisismo','Psicopatía'],
      datasets: [{ data: [mach,narc,psych], backgroundColor: ['#ff6384','#36a2eb','#ffce56'], borderColor:'#1a1a2e', borderWidth:3 }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#e0e0ff' } },
        tooltip: { callbacks: { label: function(context){ return context.label + ': ' + context.parsed.toFixed(2); } } }
      }
    }
  });
}

/* ========================================
   GENERAR NARRATIVA (texto interpretativo)
   ======================================== */
function generarNarrativa(mach,narc,psych) {
  const interpretar = (valor, rasgo) => {
    if (valor <= 2.4) return `puntaje bajo en ${rasgo}`;
    if (valor <= 3.4) return `puntaje medio en ${rasgo}`;
    return `puntaje alto en ${rasgo}`;
  };
  return `
    <div class="resultado-box">
      <h4>Interpretación Académica</h4>
      <p><strong>Maquiavelismo:</strong> Tu resultado muestra un ${interpretar(mach, "manipulación estratégica y cálculo interpersonal")}. </p>
      <p><strong>Narcisismo:</strong> Tu resultado muestra un ${interpretar(narc, "autoimagen grandiosa y búsqueda de admiración")}. </p>
      <p><strong>Psicopatía:</strong> Tu resultado muestra un ${interpretar(psych, "impulsividad y búsqueda de sensaciones")}. </p>
      <p style="margin-top:20px; font-style:italic; color:#b0a0ff;">Recordá que estos resultados son parte de una investigación académica y no constituyen un diagnóstico clínico.</p>
    </div>
  `;
}

/* ========================================
   CÁMARA Y SUBIDA DE IMAGEN
   - busca elementos por id y sólo se activa si están presentes
   ======================================== */
function configurarCamaraYSubida() {
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const btnActivarCamara = document.getElementById('btn-activar-camara');
  const btnTomarFoto = document.getElementById('btn-tomar-foto');
  const btnSubirImagen = document.getElementById('btn-subir-imagen');
  const inputImagen = document.getElementById('input-imagen');
  const btnAnalizar = document.getElementById('btn-analizar');

  if (btnActivarCamara) {
    btnActivarCamara.addEventListener('click', async function() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        if (video) { video.srcObject = stream; video.classList.remove('hidden'); video.play(); }
        this.classList.add('hidden');
        if (btnTomarFoto) btnTomarFoto.classList.remove('hidden');
      } catch (err) {
        alert('No se pudo acceder a la cámara. Por favor subí una imagen.');
        console.error('Error accediendo a la cámara:', err);
      }
    });
  }

  if (btnTomarFoto && video && canvas) {
    btnTomarFoto.addEventListener('click', function() {
      const ctx = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      imagenCapturada = canvas.toDataURL('image/jpeg', 0.9);

      video.classList.add('hidden');
      canvas.classList.remove('hidden');

      if (imagenCapturada && imagenCapturada.length > 100) {
        if (btnAnalizar) { btnAnalizar.classList.remove('hidden'); btnAnalizar.disabled = false; }
      }
      if (stream) { stream.getTracks().forEach(track => track.stop()); stream = null; }
    });
  }

  if (btnSubirImagen && inputImagen) {
    btnSubirImagen.addEventListener('click', () => inputImagen.click());
    inputImagen.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) { alert('Por favor subí un archivo de imagen válido.'); return; }

      const reader = new FileReader();
      reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
          if (!canvas) return;
          const ctx = canvas.getContext('2d');
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          imagenCapturada = canvas.toDataURL('image/jpeg', 0.9);

          if (video) video.classList.add('hidden');
          canvas.classList.remove('hidden');
          const btnAnalizarLocal = document.getElementById('btn-analizar');
          if (btnAnalizarLocal && imagenCapturada && imagenCapturada.length > 100) {
            btnAnalizarLocal.classList.remove('hidden');
            btnAnalizarLocal.disabled = false;
          }
        };
        img.onerror = function() { alert('Error al cargar la imagen. Intentá con otra.'); };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  if (btnAnalizar) {
    btnAnalizar.addEventListener('click', async () => {
      await analizarMicroexpresiones();
    });
  }
}

/* ========================================
   ANALIZAR: Enviar a Render y guardar en Google Sheets
   ======================================== */
async function analizarMicroexpresiones() {
  const resultadoDiv = document.getElementById('resultado-micro');
  if (!resultadoDiv) return;

  resultadoDiv.innerHTML = `<div class="analisis-loading">🧠 Analizando microexpresiones...</div>`;
  resultadoDiv.classList.remove('hidden');

  try {
    if (!imagenCapturada || imagenCapturada.length < 100) throw new Error("No hay imagen válida para analizar.");

    // 1) Enviar a Render
    const blob = dataURLtoBlob(imagenCapturada);
    const formData = new FormData();
    formData.append('img', blob, 'foto.jpg');

    console.log('📤 Enviando imagen a Render:', RENDER_PREDICT_URL);

    const res = await fetch(RENDER_PREDICT_URL, { method:'POST', body: formData });
    if (!res.ok) {
      const text = await res.text().catch(()=>'(sin texto)');
      throw new Error(`Error en Render: ${res.status} - ${text}`);
    }
    const json = await res.json();
    console.log('✅ Respuesta recibida desde Render:', json);

    resultadosMicro = {
      emociones: json.emociones || {},
      emocion_dominante: json.emocion_dominante || 'Desconocida',
      confianza: json.confianza || 0,
      facs: json.facs || [],
      sd3_micro: json.sd3 || {}
    };

    sessionStorage.setItem('resultadosMicro', JSON.stringify(resultadosMicro));

    // 2) Guardar en Google Sheets (no-cors)
    const persona = JSON.parse(sessionStorage.getItem('datos_personales') || '{}');
    const sd3 = JSON.parse(sessionStorage.getItem('resultadosSD3') || '{}');

    const payload = {
      timestamp: new Date().toISOString(),
      persona,
      sd3,
      microexpresiones: resultadosMicro,
      imagen: imagenCapturada
    };

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      await fetch(GOOGLE_SHEETS_WEBAPP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        mode: 'no-cors',
        signal: controller.signal
      });
      clearTimeout(timeout);
      console.log('✅ Intento de envío a Google Sheets realizado (no-cors).');
    } catch (sheetErr) {
      console.warn('⚠️ Error enviando a Google Sheets:', sheetErr.message || sheetErr);
    }

    // 3) Mostrar resultados y botón ver análisis completo
    mostrarResultadosMicroLocal(resultadosMicro);
  } catch (err) {
    console.error('❌ Error en análisis:', err);
    resultadoDiv.innerHTML = `
      <div class="resultado-box" style="border-color: #ff6384;">
        <h4>❌ Error en el análisis</h4>
        <p>${err.message}</p>
        <p style="font-size:0.9em; color:#ff6384; margin-top:10px;">
          ${err.message.includes('Render') ? 'Verificá que el servicio de Render esté activo.' : 'Intentá nuevamente o subí otra imagen.'}
        </p>
        <button onclick="location.reload()" class="btn-primary" style="margin-top:20px;">🔄 Reintentar</button>
      </div>
    `;
  }
}

/* Mostrar resultados micro en la misma pantalla participante */
function mostrarResultadosMicroLocal(datos) {
  const resultadoDiv = document.getElementById('resultado-micro');
  if (!resultadoDiv) return;

  let html = `<div class="resultado-box"><h4>✅ Análisis completado</h4><p>Tus microexpresiones han sido procesadas exitosamente.</p></div>`;

  if (datos.emociones && Object.keys(datos.emociones).length > 0) {
    html += '<div class="resultado-box"><h4>🎭 Emociones detectadas:</h4>';
    for (let [emocion, valor] of Object.entries(datos.emociones)) {
      const percentage = (valor * 100).toFixed(1);
      const barWidth = Math.min(percentage, 100);
      html += `
        <div style="margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
            <strong>${emocion}:</strong><span>${percentage}%</span>
          </div>
          <div style="background:#2a2a3e; border-radius:10px; height:8px; overflow:hidden;">
            <div style="background:linear-gradient(90deg,#667eea 0%, #764ba2 100%); width:${barWidth}%; height:100%; transition:width 0.5s;"></div>
          </div>
        </div>
      `;
    }
    html += '</div>';
  }

  if (datos.emocion_dominante) {
    html += `
      <div class="resultado-box">
        <h4>🎯 Emoción dominante</h4>
        <p style="font-size:1.2em; color:#667eea;"><strong>${datos.emocion_dominante}</strong>
          ${datos.confianza ? ` (${(datos.confianza*100).toFixed(1)}% confianza)` : ''}
        </p>
      </div>
    `;
  }

  html += `
    <div class="resultado-box" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color:white;">
      <p style="margin:0; font-size:0.9em;">✅ Tus datos han sido registrados de forma segura para la investigación.</p>
    </div>
    <button onclick="guardarYRedirigir()" class="btn-primary" style="margin-top:20px;">📊 Ver análisis completo</button>
  `;

  resultadoDiv.innerHTML = html;
}

/* ========================================
   GUARDAR DATOS Y REDIRIGIR A RESULTADOS
   - valida sessionStorage y redirige a resultados.html
   ======================================== */
function guardarYRedirigir() {
  const datosPersonales = JSON.parse(sessionStorage.getItem('datos_personales') || '{}');
  const resultadosSD3_local = JSON.parse(sessionStorage.getItem('resultadosSD3') || '{}');
  const resultadosMicro_local = JSON.parse(sessionStorage.getItem('resultadosMicro') || '{}');

  if (!datosPersonales.nombre || !resultadosSD3_local.mach || !resultadosMicro_local.emociones) {
    alert('Error: No se encontraron todos los datos necesarios. Por favor completá el proceso nuevamente.');
    return;
  }

  // redirige a resultados (si la app es single-page, se puede mostrar la sección)
  if (location.pathname.endsWith('resultados.html') || location.href.includes('resultados.html')) {
    // ya estamos en resultados: recargar para que lea sessionStorage
    window.location.reload();
  } else {
    // cambiar página
    window.location.href = 'resultados.html';
  }
}

/* ========================================
   INVESTIGADOR: cargar participantes desde Google Sheets
   - si falla, usa datos de ejemplo
   ======================================== */
let participantesData = [];
let participanteSeleccionado = null;

async function cargarDatosParticipantes() {
  const listaDiv = document.getElementById('lista-participantes');
  if (listaDiv) listaDiv.innerHTML = '<p style="text-align:center; color:var(--text-secondary);">📡 Cargando datos desde Google Sheets...</p>';

  try {
    const resp = await fetch(GOOGLE_SHEETS_READ_URL + '?action=getAll');
    const data = await resp.json();
    if (data && data.participantes) {
      participantesData = data.participantes;
    } else {
      throw new Error('No se recibieron participantes del endpoint');
    }
  } catch (err) {
    console.warn('No se pudieron cargar datos desde Google Sheets, usando demo:', err);
    participantesData = generarDatosEjemplo();
  }

  poblarListaInvestigador();
}

/* Demo data fallback */
function generarDatosEjemplo() {
  return [
    {
      id: 1,
      timestamp: new Date().toISOString(),
      persona: { nombre: 'Participante Demo 1', edad: 28, genero: 'masculino', pais: 'Argentina' },
      sd3: {
        mach: 3.2, narc: 2.8, psych: 2.5, respuestas: {}, tiempos_respuesta: {}, tiempo_total_ms: 420000,
        estadisticas_tiempo: { promedio_segundos:'8.50', mediana_segundos:'7.20', minimo_segundos:'2.10', maximo_segundos:'18.50', desviacion_estandar_segundos:'3.40' }
      },
      microexpresiones: {
        emociones: { 'Felicidad': 0.45, 'Neutral': 0.30, 'Sorpresa': 0.15, 'Tristeza': 0.10 },
        emocion_dominante: 'Felicidad', confianza: 0.85,
        facs: [{ codigo:'AU6', nombre:'Elevación mejillas', descripcion:'Indica sonrisa genuina' }, { codigo:'AU12', nombre:'Comisura labial', descripcion:'Sonrisa' }]
      },
      imagen: null
    },
    {
      id: 2,
      timestamp: new Date(Date.now() - 86400000).toISOString(),
      persona: { nombre: 'Participante Demo 2', edad: 35, genero: 'femenino', pais: 'Argentina' },
      sd3: { mach:2.1, narc:3.5, psych:1.8, respuestas:{}, tiempos_respuesta:{}, tiempo_total_ms:380000,
            estadisticas_tiempo:{ promedio_segundos:'6.80', mediana_segundos:'6.00', minimo_segundos:'1.50', maximo_segundos:'15.20', desviacion_estandar_segundos:'2.90'}},
      microexpresiones: { emociones:{ 'Neutral':0.50, 'Felicidad':0.25, 'Tristeza':0.15, 'Miedo':0.10}, emocion_dominante:'Neutral', confianza:0.78, facs:[{codigo:'AU1', nombre:'Elevación ceja', descripcion:'Preocupación leve'}] },
      imagen: null
    }
  ];
}

/* Poblar lista en panel investigador (lista simple con botones) */
function poblarListaInvestigador() {
  const listaDiv = document.getElementById('lista-participantes');
  if (!listaDiv) return;
  if (!participantesData || participantesData.length === 0) {
    listaDiv.innerHTML = '<p style="text-align:center; color:var(--text-secondary);">No hay participantes registrados aún.</p>';
    return;
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
          <button class="btn-primary btn-ver" data-index="${idx}">Ver</button>
          <button class="btn-secondary btn-export" data-index="${idx}">Export</button>
        </div>
      </div>
    `;
    listaDiv.appendChild(item);
  });

  // listeners para botones ver/export
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

function mostrarParticipanteEnPanel(idx) {
  participanteSeleccionado = participantesData[idx];
  if (!participanteSeleccionado) return;

  // mostrar sección resultados (si existe)
  const seccionResultados = document.getElementById('seccion-resultados');
  const seccionInvestigador = document.getElementById('seccion-investigador');
  if (seccionInvestigador) seccionInvestigador.classList.add('hidden');
  if (seccionResultados) seccionResultados.classList.remove('hidden');

  // rellenar info básica y componentes (usa mismas funciones de resultados)
  mostrarInfoBasicaInvestigador(participanteSeleccionado);
  mostrarResultadosSD3Investigador(participanteSeleccionado.sd3);
  mostrarTiemposReaccionInvestigador(participanteSeleccionado.sd3);
  mostrarMicroexpresionesInvestigador(participanteSeleccionado.microexpresiones);
  mostrarFACSInvestigador(participanteSeleccionado.microexpresiones);
  mostrarAnalisisIntegradoInvestigador(participanteSeleccionado);
  mostrarImagenInvestigador(participanteSeleccionado);
}

/* EXPORTAR participante a JSON */
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

/* FUNCIONES para panel investigador: mostrar secciones (similares a tu resultados.js)
   Nota: se llaman desde mostrarParticipanteEnPanel. Mantuve nombres separados para evitar colisiones.
*/
function mostrarInfoBasicaInvestigador(p) {
  const div = document.getElementById('info-participante');
  if (!div) return;
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
  const div = document.getElementById('resultados-sd3-detalle');
  if (!div) return;
  if (!sd3) { div.innerHTML = '<p>No hay datos SD3 disponibles.</p>'; return; }

  const interpretarNivel = (valor) => {
    if (valor <= 2.4) return { nivel: 'Bajo', color: '#4CAF50' };
    if (valor <= 3.4) return { nivel: 'Medio', color: '#ffce56' };
    return { nivel: 'Alto', color: '#ff6384' };
  };
  const mach = interpretarNivel(sd3.mach);
  const narc = interpretarNivel(sd3.narc);
  const psych = interpretarNivel(sd3.psych);

  div.innerHTML = `
    <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(250px,1fr)); gap:20px;">
      <div style="padding:20px; background:rgba(255,99,132,0.1); border:2px solid #ff6384; border-radius:10px;">
        <h4 style="color:#ff6384;">🎭 Maquiavelismo</h4>
        <p style="font-size:2.5em; font-weight:bold; color:${mach.color};">${sd3.mach}</p>
        <p style="color:var(--text-secondary);">Nivel: <strong style="color:${mach.color};">${mach.nivel}</strong></p>
      </div>
      <div style="padding:20px; background:rgba(54,162,235,0.1); border:2px solid #36a2eb; border-radius:10px;">
        <h4 style="color:#36a2eb;">👑 Narcisismo</h4>
        <p style="font-size:2.5em; font-weight:bold; color:${narc.color};">${sd3.narc}</p>
        <p style="color:var(--text-secondary);">Nivel: <strong style="color:${narc.color};">${narc.nivel}</strong></p>
      </div>
      <div style="padding:20px; background:rgba(255,206,86,0.1); border:2px solid #ffce56; border-radius:10px;">
        <h4 style="color:#ffce56;">⚡ Psicopatía</h4>
        <p style="font-size:2.5em; font-weight:bold; color:${psych.color};">${sd3.psych}</p>
        <p style="color:var(--text-secondary);">Nivel: <strong style="color:${psych.color};">${psych.nivel}</strong></p>
      </div>
    </div>
  `;

  // Radar chart (si existe el canvas)
  setTimeout(() => {
    const canvas = document.getElementById('grafico-sd3-resultados');
    if (!canvas) return;
    // destruir si existe
    try { const old = Chart.getChart(canvas); if (old) old.destroy(); } catch(e){}
    new Chart(canvas, {
      type: 'radar',
      data: {
        labels: ['Maquiavelismo','Narcisismo','Psicopatía'],
        datasets: [{
          label: 'Perfil',
          data: [sd3.mach, sd3.narc, sd3.psych],
          backgroundColor: 'rgba(127,0,255,0.2)',
          borderColor: '#7f00ff',
          borderWidth: 3,
          pointRadius:6
        }]
      },
      options: {
        responsive: true,
        scales: {
          r: { min:1, max:5, ticks:{ color:'#b0a0ff', stepSize:1 }, pointLabels:{ color:'#e0e0ff' } }
        },
        plugins: { legend: { labels: { color: '#e0e0ff' } } }
      }
    });
  }, 100);
}

function mostrarTiemposReaccionInvestigador(sd3) {
  const div = document.getElementById('tiempos-detalle');
  if (!div) return;
  if (!sd3 || !sd3.estadisticas_tiempo) { div.innerHTML = '<p>No hay datos de tiempos disponibles.</p>'; return; }
  const stats = sd3.estadisticas_tiempo;
  div.innerHTML = `
    <div class="stats-mini">
      <div class="stat-mini"><div class="stat-mini-label">Tiempo Total</div><div class="stat-mini-value">${(sd3.tiempo_total_ms/1000/60).toFixed(1)} min</div></div>
      <div class="stat-mini"><div class="stat-mini-label">Promedio</div><div class="stat-mini-value">${stats.promedio_segundos}s</div></div>
      <div class="stat-mini"><div class="stat-mini-label">Mediana</div><div class="stat-mini-value">${stats.mediana_segundos}s</div></div>
      <div class="stat-mini"><div class="stat-mini-label">Mínimo</div><div class="stat-mini-value">${stats.minimo_segundos}s</div></div>
      <div class="stat-mini"><div class="stat-mini-label">Máximo</div><div class="stat-mini-value">${stats.maximo_segundos}s</div></div>
      <div class="stat-mini"><div class="stat-mini-label">Desv. estándar</div><div class="stat-mini-value">${stats.desviacion_estandar_segundos}s</div></div>
    </div>
  `;

  if (sd3.tiempos_respuesta && Object.keys(sd3.tiempos_respuesta).length > 0) {
    setTimeout(() => {
      const tiempos = sd3.tiempos_respuesta;
      const items = Object.keys(tiempos).map(k => parseInt(k)).sort((a,b) => a-b);
      const valores = items.map(i => parseFloat(tiempos[i].tiempo_segundos));
      const canvas = document.getElementById('grafico-tiempos');
      if (!canvas) return;
      try { const old = Chart.getChart(canvas); if (old) old.destroy(); } catch(e){}
      new Chart(canvas, {
        type: 'line',
        data: { labels: items, datasets: [{ label:'Tiempo (segundos)', data: valores, borderColor:'#667eea', backgroundColor:'rgba(102,126,234,0.1)', borderWidth:2, fill:true, tension:0.4 }] },
        options: { responsive:true, scales:{ x:{ ticks:{ color:'#b0a0ff' } }, y:{ ticks:{ color:'#b0a0ff' } } }, plugins:{ legend:{ labels:{ color:'#e0e0ff' } } } }
      });
    }, 100);
  }
}

function mostrarMicroexpresionesInvestigador(micro) {
  const div = document.getElementById('microexpresiones-detalle');
  if (!div) return;
  if (!micro || !micro.emociones) { div.innerHTML = '<p style="text-align:center; color:#888;">No hay datos de microexpresiones.</p>'; return; }

  const dominante = micro.emocion_dominante || 'Desconocida';
  const confianza = (micro.confianza || 0) * 100;

  div.innerHTML = `
    <div style="text-align:center; margin-bottom:30px; padding:30px; background:rgba(0,0,0,0.2); border-radius:15px;">
      <div style="font-size:4em; margin-bottom:15px;">😊</div>
      <h4 style="color:#c080ff; margin:10px 0;">Emoción Dominante</h4>
      <p style="font-size:2em; font-weight:800; color:#7f00ff; margin:15px 0;">${dominante}</p>
      <p style="font-size:1.1em; color:#b0a0ff;">Confianza: <strong>${confianza.toFixed(1)}%</strong></p>
    </div>
    <h4 style="text-align:center; margin:30px 0 20px;">Distribución de Emociones Detectadas</h4>
  `;

  const emociones = Object.entries(micro.emociones).sort((a,b)=> b[1]-a[1]);
  emociones.forEach(([emocion, valor]) => {
    const percentage = (valor * 100).toFixed(1);
    div.innerHTML += `
      <div class="emotion-bar">
        <div class="emotion-label"><strong>${emocion}</strong><span>${percentage}%</span></div>
        <div class="bar-container"><div class="bar-fill" style="width:${percentage}%">${percentage}%</div></div>
      </div>
    `;
  });

  setTimeout(() => {
    const canvas = document.getElementById('grafico-emociones');
    if (!canvas) return;
    try { const old = Chart.getChart(canvas); if (old) old.destroy(); } catch(e){}
    new Chart(canvas, {
      type: 'doughnut',
      data: { labels: Object.keys(micro.emociones), datasets:[{ data: Object.values(micro.emociones).map(v=> (v*100).toFixed(1)), backgroundColor:['rgba(255,99,132,0.8)','rgba(54,162,235,0.8)','rgba(255,206,86,0.8)','rgba(75,192,192,0.8)','rgba(153,102,255,0.8)','rgba(255,159,64,0.8)'], borderColor:'#1a1a2e', borderWidth:3 }] },
      options: { responsive:true, plugins:{ legend:{ position:'bottom', labels:{ color:'#e0e0ff' } } } }
    });
  }, 100);
}

function mostrarFACSInvestigador(micro) {
  const div = document.getElementById('facs-detalle');
  if (!div) return;
  if (!micro || !micro.facs || micro.facs.length === 0) { div.innerHTML = '<p>No se detectaron unidades de acción FACS específicas.</p>'; return; }

  div.innerHTML = '<div style="display:grid; gap:15px;">';
  micro.facs.forEach(au => {
    div.innerHTML += `
      <div class="info-item" style="padding:20px;">
        <h4 style="color:#c080ff; margin:0 0 10px 0;">${au.nombre || au.codigo}</h4>
        <p style="color:#888; margin-bottom:10px;"><strong>Código:</strong> ${au.codigo}</p>
        <p style="margin:0;">${au.descripcion || 'Unidad de acción facial detectada'}</p>
      </div>
    `;
  });
  div.innerHTML += '</div>';
}

function mostrarAnalisisIntegradoInvestigador(p) {
  const div = document.getElementById('analisis-final');
  if (!div) return;
  const sd3 = p.sd3 || {};
  const micro = p.microexpresiones || {};
  const interpretarSD3 = (valor) => valor > 3.4 ? 'alto' : valor > 2.4 ? 'medio' : 'bajo';
  div.innerHTML = `
    <p style="font-size:1.1em; line-height:1.8;">
      <strong>Perfil de Personalidad:</strong> El participante presenta niveles
      <span style="color:var(--primary);">${interpretarSD3(sd3.mach)}</span> en maquiavelismo,
      <span style="color:var(--primary);">${interpretarSD3(sd3.narc)}</span> en narcisismo y
      <span style="color:var(--primary);">${interpretarSD3(sd3.psych)}</span> en psicopatía.
    </p>
    <p style="font-size:1.1em; line-height:1.8;">
      <strong>Expresión Emocional:</strong> La emoción facial dominante es
      <span style="color:var(--primary);">${micro.emocion_dominante || 'no determinada'}</span>
      con una confianza del <span style="color:var(--primary);">${((micro.confianza||0)*100).toFixed(1)}%</span>.
    </p>
    <p style="font-size:1.1em; line-height:1.8;">
      <strong>Tiempo de Respuesta:</strong> El participante completó el test en
      <span style="color:var(--primary);">${(sd3.tiempo_total_ms/1000/60).toFixed(1)} minutos</span>
      con un promedio de <span style="color:var(--primary);">${sd3.estadisticas_tiempo?.promedio_segundos || 'N/A'}s</span> por ítem.
    </p>
  `;
}

function mostrarImagenInvestigador(p) {
  const div = document.getElementById('imagen-participante');
  if (!div) return;
  if (p.imagen) {
    div.innerHTML = `<img src="${p.imagen}" alt="Foto del participante" style="max-width:100%; max-height:500px; border-radius:10px; box-shadow:0 10px 30px rgba(0,0,0,0.5);">`;
  } else {
    div.innerHTML = '<p>No hay imagen disponible.</p>';
  }
}

/* ========================================
   PAGINA DE RESULTADOS (participante -> resultados.html)
   - función cargarResultados lee sessionStorage y renderiza
   ======================================== */
function cargarResultadosPageIfAny() {
  const persona = JSON.parse(sessionStorage.getItem('datos_personales') || '{}');
  const sd3 = JSON.parse(sessionStorage.getItem('resultadosSD3') || '{}');
  const micro = JSON.parse(sessionStorage.getItem('resultadosMicro') || '{}');

  const infoCont = document.getElementById('info-participante');
  if (!infoCont) return; // no estamos en resultados.html

  // validación
  if (!persona.nombre || !sd3.mach) {
    alert('No se encontraron resultados. Por favor completá el test primero.');
    window.location.href = 'participante.html';
    return;
  }

  // llamar funciones de render (reuso de funciones ya definidas)
  mostrarInfoParticipanteEnResultados(persona);
  mostrarResultadosSD3EnResultados(sd3);
  mostrarTiemposEnResultados(sd3);
  mostrarMicroexpresionesEnResultados(micro);
  mostrarFACSEnResultados(micro);
  mostrarAnalisisFinalEnResultados(sd3, micro);
}

/* funciones usadas por resultados.html (nombres distintos a investigador para evitar colisiones) */
function mostrarInfoParticipanteEnResultados(persona) {
  const div = document.getElementById('info-participante');
  if (!div) return;
  div.innerHTML = `
    <div class="info-grid">
      <div class="info-item"><strong>Nombre:</strong><p>${persona.nombre || 'Anónimo'}</p></div>
      <div class="info-item"><strong>Edad:</strong><p>${persona.edad || ''} años</p></div>
      <div class="info-item"><strong>Género:</strong><p>${persona.genero || ''}</p></div>
      <div class="info-item"><strong>País:</strong><p>${persona.pais || ''}</p></div>
    </div>
    <p style="margin-top:20px; text-align:center; color:#888; font-size:0.95em;">
      <strong>Fecha:</strong> ${new Date().toLocaleDateString('es-AR', { year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' })}
    </p>
  `;
}

function mostrarResultadosSD3EnResultados(sd3) {
  const div = document.getElementById('resultados-sd3-detalle');
  if (!div) return;
  const interpretarNivel = (valor) => {
    if (valor <= 2.4) return { nivel: 'Bajo', clase: 'nivel-bajo', emoji: '✅' };
    if (valor <= 3.4) return { nivel: 'Medio', clase: 'nivel-medio', emoji: '⚡' };
    return { nivel: 'Alto', clase: 'nivel-alto', emoji: '🔥' };
  };
  const mach = interpretarNivel(sd3.mach);
  const narc = interpretarNivel(sd3.narc);
  const psych = interpretarNivel(sd3.psych);

  div.innerHTML = `
    <div class="scores-grid">
      <div class="score-card"><span class="score-icon">🎭</span><div class="score-label">Maquiavelismo</div><div class="score-value">${sd3.mach}</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${(sd3.mach/5)*100}%"></div></div>
        <span class="score-level ${mach.clase}">${mach.emoji} ${mach.nivel}</span>
        <p style="margin-top:15px; font-size:0.9em; color:#b0a0ff;">Manipulación estratégica y pragmatismo</p></div>

      <div class="score-card"><span class="score-icon">👑</span><div class="score-label">Narcisismo</div><div class="score-value">${sd3.narc}</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${(sd3.narc/5)*100}%"></div></div>
        <span class="score-level ${narc.clase}">${narc.emoji} ${narc.nivel}</span>
        <p style="margin-top:15px; font-size:0.9em; color:#b0a0ff;">Grandiosidad y necesidad de admiración</p></div>

      <div class="score-card"><span class="score-icon">⚡</span><div class="score-label">Psicopatía</div><div class="score-value">${sd3.psych}</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${(sd3.psych/5)*100}%"></div></div>
        <span class="score-level ${psych.clase}">${psych.emoji} ${psych.nivel}</span>
        <p style="margin-top:15px; font-size:0.9em; color:#b0a0ff;">Impulsividad y búsqueda de sensaciones</p></div>
    </div>
  `;

  // radar chart
  setTimeout(() => {
    const canvas = document.getElementById('grafico-sd3-resultados');
    if (!canvas) return;
    try { const old = Chart.getChart(canvas); if (old) old.destroy(); } catch(e){}
    new Chart(canvas, {
      type: 'radar',
      data: {
        labels:['Maquiavelismo','Narcisismo','Psicopatía'],
        datasets:[{
          label:'Tu perfil',
          data:[sd3.mach, sd3.narc, sd3.psych],
          backgroundColor:'rgba(127,0,255,0.2)',
          borderColor:'#7f00ff',
          borderWidth:3,
          pointBackgroundColor:'#c080ff',
          pointBorderColor:'#fff',
          pointRadius:6
        },{
          label:'Promedio poblacional',
          data:[3.0,2.8,2.5],
          backgroundColor:'rgba(255,255,255,0.05)',
          borderColor:'rgba(255,255,255,0.3)',
          borderWidth:2,
          pointRadius:4,
          borderDash:[5,5]
        }]
      },
      options: {
        responsive:true,
        scales:{ r:{ min:1, max:5, ticks:{ stepSize:1, color:'#b0a0ff' }, grid:{ color:'rgba(192,128,255,0.2)' }, pointLabels:{ color:'#c080ff', font:{ size:14, weight:'600' } } } },
        plugins:{ legend:{ labels:{ color:'#e0e0ff', font:{ size:12 } } } }
      }
    });
  }, 100);
}

function mostrarTiemposEnResultados(sd3) {
  const div = document.getElementById('tiempos-detalle');
  if (!div) return;
  const stats = sd3.estadisticas_tiempo || {};
  div.innerHTML = `
    <div class="stats-mini">
      <div class="stat-mini"><div class="stat-mini-label">Tiempo Total</div><div class="stat-mini-value">${(sd3.tiempo_total_ms/1000/60).toFixed(1)} min</div></div>
      <div class="stat-mini"><div class="stat-mini-label">Promedio</div><div class="stat-mini-value">${stats.promedio_segundos}s</div></div>
      <div class="stat-mini"><div class="stat-mini-label">Mediana</div><div class="stat-mini-value">${stats.mediana_segundos}s</div></div>
      <div class="stat-mini"><div class="stat-mini-label">Mínimo</div><div class="stat-mini-value">${stats.minimo_segundos}s</div></div>
      <div class="stat-mini"><div class="stat-mini-label">Máximo</div><div class="stat-mini-value">${stats.maximo_segundos}s</div></div>
      <div class="stat-mini"><div class="stat-mini-label">Desv. Estándar</div><div class="stat-mini-value">${stats.desviacion_estandar_segundos}s</div></div>
    </div>
  `;

  const tiempos = sd3.tiempos_respuesta || {};
  const items = Object.keys(tiempos).map(k => parseInt(k)).sort((a,b)=>a-b);
  const valores = items.map(i => parseFloat(tiempos[i]?.tiempo_segundos || 0));
  setTimeout(() => {
    const canvas = document.getElementById('grafico-tiempos');
    if (!canvas || valores.length===0) return;
    try { const old = Chart.getChart(canvas); if (old) old.destroy(); } catch(e){}
    new Chart(canvas, {
      type:'line',
      data: { labels: items, datasets:[{ label:'Tiempo (segundos)', data:valores, borderColor:'#7f00ff', backgroundColor:'rgba(127,0,255,0.1)', borderWidth:3, fill:true, tension:0.4, pointRadius:4, pointBackgroundColor:'#c080ff' }] },
      options: { responsive:true, plugins:{ legend:{ labels:{ color:'#e0e0ff' } } }, scales:{ x:{ title:{ display:true, text:'Ítem del Test', color:'#c080ff' }, ticks:{ color:'#b0a0ff' }, grid:{ color:'rgba(192,128,255,0.1)' } }, y:{ title:{ display:true, text:'Segundos', color:'#c080ff' }, ticks:{ color:'#b0a0ff' }, grid:{ color:'rgba(192,128,255,0.1)' } } } }
    });
  }, 100);
}

function mostrarMicroexpresionesEnResultados(micro) {
  const div = document.getElementById('microexpresiones-detalle');
  if (!div) return;
  if (!micro || !micro.emociones) { div.innerHTML = '<p style="text-align:center; color:#888;">No hay datos de microexpresiones.</p>'; return; }

  const dominante = micro.emocion_dominante || 'Desconocida';
  const confianza = (micro.confianza || 0) * 100;
  div.innerHTML = `
    <div style="text-align:center; margin-bottom:30px; padding:30px; background:rgba(0,0,0,0.2); border-radius:15px;">
      <div style="font-size:4em; margin-bottom:15px;">😊</div>
      <h4 style="color:#c080ff; margin:10px 0;">Emoción Dominante</h4>
      <p style="font-size:2em; font-weight:800; color:#7f00ff; margin:15px 0;">${dominante}</p>
      <p style="font-size:1.1em; color:#b0a0ff;">Confianza: <strong>${confianza.toFixed(1)}%</strong></p>
    </div>
    <h4 style="text-align:center; margin:30px 0 20px;">Distribución de Emociones Detectadas</h4>
  `;

  const emociones = Object.entries(micro.emociones).sort((a,b)=>b[1]-a[1]);
  emociones.forEach(([emocion, valor]) => {
    const percentage = (valor * 100).toFixed(1);
    div.innerHTML += `
      <div class="emotion-bar">
        <div class="emotion-label"><strong>${emocion}</strong><span>${percentage}%</span></div>
        <div class="bar-container"><div class="bar-fill" style="width:${percentage}%">${percentage}%</div></div>
      </div>
    `;
  });

  setTimeout(() => {
    const canvas = document.getElementById('grafico-emociones');
    if (!canvas) return;
    try { const old = Chart.getChart(canvas); if (old) old.destroy(); } catch(e){}
    new Chart(canvas, {
      type:'doughnut',
      data:{ labels:Object.keys(micro.emociones), datasets:[{ data:Object.values(micro.emociones).map(v=> (v*100).toFixed(1)), backgroundColor:['rgba(255,99,132,0.8)','rgba(54,162,235,0.8)','rgba(255,206,86,0.8)','rgba(75,192,192,0.8)','rgba(153,102,255,0.8)','rgba(255,159,64,0.8)'], borderColor:'#1a1a2e', borderWidth:3 }] },
      options:{ responsive:true, plugins:{ legend:{ position:'bottom', labels:{ color:'#e0e0ff' } } } }
    });
  }, 100);
}

function mostrarFACSEnResultados(micro) {
  const div = document.getElementById('facs-detalle');
  if (!div) return;
  if (!micro || !micro.facs || micro.facs.length===0) { div.innerHTML = '<p style="text-align:center; color:#888;">No se detectaron unidades de acción FACS específicas.</p>'; return; }
  div.innerHTML = '<div style="display:grid; gap:15px;">';
  micro.facs.forEach(au => {
    div.innerHTML += `<div class="info-item" style="padding:20px;"><h4 style="color:#c080ff; margin:0 0 10px 0;">${au.nombre || au.codigo}</h4><p style="color:#888; margin-bottom:10px;"><strong>Código:</strong> ${au.codigo}</p><p style="margin:0;">${au.descripcion || 'Unidad de acción facial detectada'}</p></div>`;
  });
  div.innerHTML += '</div>';
}

function mostrarAnalisisFinalEnResultados(sd3, micro) {
  const div = document.getElementById('analisis-final');
  if (!div) return;
  const nivel = (val) => val > 3.4 ? 'alto' : val > 2.4 ? 'medio' : 'bajo';
  const emocion = micro.emocion_dominante || 'neutral';
  div.innerHTML = `
    <p style="font-size:1.15em; line-height:1.9;">
      <strong style="color:#c080ff;">Perfil de Personalidad:</strong> Tu evaluación muestra un nivel <strong>${nivel(sd3.mach)}</strong> en maquiavelismo, <strong>${nivel(sd3.narc)}</strong> en narcisismo y <strong>${nivel(sd3.psych)}</strong> en psicopatía subclínica.
    </p>
    <p style="font-size:1.15em; line-height:1.9;">
      <strong style="color:#c080ff;">Expresión Emocional:</strong> El análisis de tu rostro reveló una expresión predominantemente <strong>${emocion}</strong> con una confianza del <strong>${((micro.confianza||0)*100).toFixed(1)}%</strong>.
    </p>
    <p style="font-size:1.15em; line-height:1.9;">
      <strong style="color:#c080ff;">Patrón de Respuesta:</strong> Completaste el test en <strong>${(sd3.tiempo_total_ms/1000/60).toFixed(1)} minutos</strong>, con un tiempo promedio de <strong>${sd3.estadisticas_tiempo?.promedio_segundos || 'N/A'} segundos</strong> por ítem.
    </p>
  `;
}

/* ========================================
   INICIALIZACIÓN: agregar listeners generales al DOM
   ======================================== */
document.addEventListener('DOMContentLoaded', () => {
  // Si estamos en la página participante (formulario de datos)
  const formDatos = document.getElementById('form-datos-basicos');
  if (formDatos) {
    const seccionBienvenida = document.getElementById('seccion-bienvenida');
    const seccionTest = document.getElementById('seccion-test');

    formDatos.addEventListener('submit', (event) => {
      event.preventDefault();
      const consentimiento = formDatos.querySelector('input[name="consentimiento"]');
      if (!consentimiento || !consentimiento.checked) {
        alert("Debés aceptar el consentimiento para continuar.");
        return;
      }
      const nombre = formDatos.querySelector('input[name="nombre"]').value.trim();
      const edad = formDatos.querySelector('input[name="edad"]').value;
      const genero = formDatos.querySelector('select[name="genero"]').value;
      const pais = formDatos.querySelector('input[name="pais"]').value.trim();
      if (!nombre || !edad || !genero || !pais) { alert("Completá todos los datos personales requeridos."); return; }
      sessionStorage.setItem('datos_personales', JSON.stringify({ nombre, edad, genero, pais }));
      // generar items y configurar tracking
      testInicioTimestamp = Date.now();
      generarItemsTest();
      configurarTrackingTiempos();

      if (seccionBienvenida) seccionBienvenida.classList.add('hidden');
      if (seccionTest) seccionTest.classList.remove('hidden');
      window.scrollTo({ top:0, behavior:'smooth' });
    });
  }

  // Si existe el formulario SD3 (por seguridad, por si HTML separado)
  const formSD3 = document.getElementById('form-sd3');
  if (formSD3) {
    formSD3.addEventListener('submit', function(e){ e.preventDefault(); calcularSD3(); });
  }

  // botón para pasar a micro (participante)
  const btnContinuar = document.getElementById('btn-continuar-micro');
  if (btnContinuar) {
    btnContinuar.addEventListener('click', function() {
      const seccionTest = document.getElementById('seccion-test');
      const seccionMicro = document.getElementById('seccion-micro');
      if (seccionTest) seccionTest.classList.add('hidden');
      if (seccionMicro) seccionMicro.classList.remove('hidden');
      window.scrollTo({ top:0, behavior:'smooth' });
    });
  }

  // configurar cámara y controles (si existen)
  configurarCamaraYSubida();

  // En la página resultados: cargar desde sessionStorage
  cargarResultadosPageIfAny();

/* INVESTIGADOR: iniciar login y panel si existen elementos */
const btnLoginInv = document.getElementById('btn-login-investigador');
const inputPasswordInv = document.getElementById('password-investigador');

if (btnLoginInv && inputPasswordInv) {
  btnLoginInv.addEventListener('click', () => {
    const pw = inputPasswordInv.value.trim();

    if (pw === PASSWORD_INVESTIGADOR) {
      // Mostrar panel del investigador
      document.getElementById('seccion-login')?.classList.add('hidden');
      document.getElementById('seccion-investigador')?.classList.remove('hidden');

      // Cargar lista de participantes
      cargarDatosParticipantes();

      window.scrollTo({ top: 0, behavior: 'smooth' });

    } else {
      alert('❌ Contraseña incorrecta');
      inputPasswordInv.value = '';
    }
  });
}

// volver al inicio desde login
const btnVolverInicio2 = document.getElementById('btn-volver-inicio-2');
if (btnVolverInicio2) {
  btnVolverInicio2.addEventListener('click', () => {
    document.getElementById('seccion-login')?.classList.add('hidden');
    document.getElementById('pagina-inicio')?.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// botones para salir/volver en investigador
const btnVolverPanel = document.getElementById('btn-volver-panel');
if (btnVolverPanel) {
  btnVolverPanel.addEventListener('click', () => {
    document.getElementById('seccion-resultados')?.classList.add('hidden');
    document.getElementById('seccion-investigador')?.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

const btnVolverLogin = document.getElementById('btn-volver-login');
if (btnVolverLogin) {
  btnVolverLogin.addEventListener('click', () => {
    // cerrar sesión simple
    document.getElementById('seccion-investigador')?.classList.add('hidden');
    document.getElementById('seccion-login')?.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

}); 



