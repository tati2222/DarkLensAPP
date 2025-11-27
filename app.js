/* app.js - MODIFICADO PARA OCULTAR RESULTADOS A PARTICIPANTES */
/* ========================================
   CONFIG — ENDPOINTS & CONSTANTES
   ======================================== */
const RENDER_PREDICT_URL = "https://darklnesapp-api-1.onrender.com/analyze";
const GOOGLE_SHEETS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbwm8kIl1h0Avas55eNI0dbiKj-MPCbuXyQp7ndsQYiDdmcsmDGYgyirgt2sorvOFLEZgA/exec";
const GOOGLE_SHEETS_READ_URL = GOOGLE_SHEETS_WEBAPP_URL;
const PASSWORD_INVESTIGADOR = "investigador2025";

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
  if (tiemposRespuesta[itemNum]) return;

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

  const resultadosSD3 = {
    mach, narc, psych,
    respuestas: respuestasObj,
    tiempos_respuesta: tiemposRespuesta,
    tiempo_total_ms: tiempoTotalTest,
    tiempo_total_segundos: (tiempoTotalTest / 1000).toFixed(2),
    estadisticas_tiempo: estadisticasTiempo
  };

  sessionStorage.setItem('resultadosSD3', JSON.stringify(resultadosSD3));

  // Enviar datos a Google Sheets y redirigir
  enviarResultadosAGoogleSheets(resultadosSD3);
}

function enviarResultadosAGoogleSheets(data) {
  const persona = JSON.parse(sessionStorage.getItem('datos_personales') || '{}');
  
  const payload = {
    tipo: 'sd3',
    timestamp: new Date().toISOString(),
    persona: persona,
    sd3: data
  };

  fetch(GOOGLE_SHEETS_WEBAPP_URL, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(payload),
  })
  .then(response => {
    if (!response.ok) throw new Error('Error en la respuesta de Google Sheets');
    return response.json();
  })
  .then(res => {
    console.log('✅ Datos SD3 enviados correctamente');
    // Redirigir a la página de subir imagen
    window.location.href = "subir_imagen.html";
  })
  .catch(error => {
    console.error('Error enviando datos SD3:', error);
    // Continuar con el flujo aunque falle el envío
    window.location.href = "subir_imagen.html";
  });
}

/* ========================================
   CÁMARA Y SUBIDA DE IMAGEN
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

    const persona = JSON.parse(sessionStorage.getItem('datos_personales') || '{}');
    const sd3 = JSON.parse(sessionStorage.getItem('resultadosSD3') || '{}');

    const payload = {
      tipo: 'microexpresiones',
      timestamp: new Date().toISOString(),
      persona,
      sd3,
      microexpresiones: resultadosMicro,
      imagen: imagenCapturada
    };

    // Enviar a Google Sheets
    try {
      await fetch(GOOGLE_SHEETS_WEBAPP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      console.log('✅ Datos de microexpresiones enviados a Google Sheets');
    } catch (sheetErr) {
      console.warn('⚠️ Error enviando a Google Sheets:', sheetErr);
    }

    // Mostrar solo confirmación al usuario SIN RESULTADOS
    mostrarConfirmacionParticipante();
    
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

// Nueva función para mostrar solo confirmación SIN RESULTADOS
function mostrarConfirmacionParticipante() {
  const resultadoDiv = document.getElementById('resultado-micro');
  if (!resultadoDiv) return;

  resultadoDiv.innerHTML = `
    <div class="confirmacion-final" style="text-align: center; padding: 40px;">
      <h3 style="color: var(--accent); margin-bottom: 20px;">¡Gracias por participar!</h3>
      <p style="margin-bottom: 30px; font-size: 1.1em;">
        Tu imagen y respuestas han sido registradas correctamente para la investigación.
      </p>
      <div class="imagen-confirmacion" style="margin: 30px 0;">
        <img src="${imagenCapturada}" alt="Imagen subida" style="max-width: 300px; border-radius: 10px; border: 2px solid var(--border);">
      </div>
      <p style="color: var(--text-secondary); margin-bottom: 30px;">
        Tu contribución es valiosa para nuestro estudio académico.
      </p>
      <button onclick="volverAlInicio()" class="btn-primary">
        Volver al Inicio
      </button>
    </div>
  `;
}

// Función para volver al inicio
function volverAlInicio() {
  // Limpiar sessionStorage
  sessionStorage.removeItem('datos_personales');
  sessionStorage.removeItem('resultadosSD3');
  sessionStorage.removeItem('resultadosMicro');
  
  window.location.href = "index.html";
}

/* ========================================
   INVESTIGADOR: cargar participantes desde Google Sheets
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
    }
  ];
}

/* Poblar lista en panel investigador */
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

function mostrarParticipanteEnPanel(idx) {
  participanteSeleccionado = participantesData[idx];
  if (!participanteSeleccionado) return;

  const seccionResultados = document.getElementById('seccion-resultados');
  const seccionInvestigador = document.getElementById('seccion-investigador');
  if (seccionInvestigador) seccionInvestigador.classList.add('hidden');
  if (seccionResultados) seccionResultados.classList.remove('hidden');

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

/* FUNCIONES para panel investigador */
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

  setTimeout(() => {
    const canvas = document.getElementById('grafico-sd3-resultados');
    if (!canvas) return;
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
   INICIALIZACIÓN: agregar listeners generales al DOM
   ======================================== */
document.addEventListener('DOMContentLoaded', () => {
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
      testInicioTimestamp = Date.now();
      generarItemsTest();
      configurarTrackingTiempos();

      if (seccionBienvenida) seccionBienvenida.classList.add('hidden');
      if (seccionTest) seccionTest.classList.remove('hidden');
      window.scrollTo({ top:0, behavior:'smooth' });
    });
  }

  const formSD3 = document.getElementById('form-sd3');
  if (formSD3) {
    formSD3.addEventListener('submit', function(e){ e.preventDefault(); calcularSD3(); });
  }

  // Detectar automáticamente en qué página estamos sin depender del nombre del archivo
  document.addEventListener("click", () => {
      const subir = document.getElementById("btn-subir-imagen");
      if (subir && !window._capturaInicializada) {
          console.log("📸 Inicializando captura y subida…");
          configurarCamaraYSubida();
          window._capturaInicializada = true;
      }
  });

  const btnLoginInv = document.getElementById('btn-login-investigador');
  const inputPasswordInv = document.getElementById('password-investigador');
  if (btnLoginInv && inputPasswordInv) {
    btnLoginInv.addEventListener('click', () => {
      const pw = inputPasswordInv.value.trim();
      if (pw === PASSWORD_INVESTIGADOR) {
        document.getElementById('seccion-login')?.classList.add('hidden');
        document.getElementById('seccion-investigador')?.classList.remove('hidden');
        cargarDatosParticipantes();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        alert('❌ Contraseña incorrecta');
        inputPasswordInv.value = '';
      }
    });
  }

  const btnVolverInicio2 = document.getElementById('btn-volver-inicio-2');
  if (btnVolverInicio2) {
    btnVolverInicio2.addEventListener('click', () => {
      document.getElementById('seccion-login')?.classList.add('hidden');
      document.getElementById('pagina-inicio')?.classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

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
      document.getElementById('seccion-investigador')?.classList.add('hidden');
      document.getElementById('seccion-login')?.classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
});
