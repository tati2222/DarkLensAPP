// ========================================
// CONFIG — CONFIGURACIÓN DE ENDPOINTS
// ========================================
const RENDER_PREDICT_URL = "https://darklnesapp-api.onrender.com/run/predict"; 
// ✅ CORREGIDO: Ahora incluye /run/ en la ruta

const GOOGLE_SHEETS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbwm8kIl1h0Avas55eNI0dbiKj-MPCbuXyQp7ndsQYiDdmcsmDGYgyirgt2sorvOFLEZgA/exec";
// ✅ ACTUALIZADO: URL real de Google Apps Script

// ========================================
// VARIABLES GLOBALES
// ========================================
const invertidos = [11, 15, 17, 20, 25];
let graficoSD3;
let resultadosSD3 = null;
let resultadosMicro = null;
let imagenCapturada = null;
let stream = null;

// TRACKING TIEMPOS
let tiemposRespuesta = {};
let tiempoInicioItem = {};
let testInicioTimestamp = null;

// Items SD3
const itemsSD3 = [
  "No es prudente contar tus secretos.",
  "Me gusta usar manipulaciones ingeniosas para salirme con la mía.",
  "Hagas lo que hagas, debes conseguir que las personas importantes estén de tu lado.",
  "Evito el conflicto directo con los demás porque pueden serme útiles en el futuro.",
  "Es sabio guardar información que puedas usar en contra de otras personas más adelante.",
  "Debes esperar el momento oportuno para vengarte de las personas.",
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

// ========================================
// GENERAR ITEMS DEL TEST
// ========================================
function generarItemsTest() {
  const form = document.getElementById('form-sd3');
  if (!form) {
    console.error('No se encontró el formulario SD3');
    return;
  }
  
  form.innerHTML = '';
  testInicioTimestamp = Date.now();
  tiemposRespuesta = {};
  tiempoInicioItem = {};

  itemsSD3.forEach((texto, index) => {
    const num = index + 1;
    const div = document.createElement('div');
    div.className = 'test-item';
    div.setAttribute('data-item', num);
    div.innerHTML = `
      <p><strong>${num}.</strong> ${texto}</p>
      <div class="opciones">
        ${[1, 2, 3, 4, 5].map(val => `
          <input type="radio" id="item${num}_${val}" name="item${num}" value="${val}" required>
          <label for="item${num}_${val}">${val}</label>
        `).join('')}
      </div>
    `;
    form.appendChild(div);
    tiempoInicioItem[num] = null;
  });

  const btnSubmit = document.createElement('button');
  btnSubmit.type = 'submit';
  btnSubmit.textContent = 'Enviar respuestas del test';
  btnSubmit.className = 'btn-primary';
  form.appendChild(btnSubmit);

  configurarTrackingTiempos();
}

// ========================================
// TRACKING DE TIEMPOS DE RESPUESTA
// ========================================
function configurarTrackingTiempos() {
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

  document.querySelectorAll('.test-item').forEach(item => {
    observer.observe(item);
  });

  for (let i = 1; i <= 27; i++) {
    const radios = document.querySelectorAll(`input[name="item${i}"]`);
    radios.forEach(radio => {
      radio.addEventListener('change', function() {
        registrarTiempoRespuesta(i);
      });
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
    const tiempoDesdeInicio = Date.now() - testInicioTimestamp;
    tiemposRespuesta[itemNum] = {
      tiempo_ms: tiempoDesdeInicio,
      tiempo_segundos: (tiempoDesdeInicio / 1000).toFixed(2),
      timestamp_inicio: testInicioTimestamp,
      timestamp_respuesta: Date.now(),
      nota: 'Respondido antes de visualización completa'
    };
  }
}

// ========================================
// DOMContentLoaded
// ========================================
document.addEventListener("DOMContentLoaded", () => {
  const formDatos = document.getElementById("form-datos-basicos");
  const seccionBienvenida = document.getElementById("seccion-bienvenida");
  const seccionTest = document.getElementById("seccion-test");

  if (!formDatos) {
    console.error("No se encontró el formulario de datos básicos.");
    return;
  }

  formDatos.addEventListener("submit", (event) => {
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

    if (!nombre || !edad || !genero || !pais) {
      alert("Completá todos los datos personales requeridos.");
      return;
    }

    sessionStorage.setItem('datos_personales', JSON.stringify({ nombre, edad, genero, pais }));
    generarItemsTest();

    if (seccionBienvenida) seccionBienvenida.classList.add("hidden");
    if (seccionTest) seccionTest.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  const formSD3 = document.getElementById('form-sd3');
  if (formSD3) {
    formSD3.addEventListener('submit', function(e) {
      e.preventDefault();
      calcularSD3();
    });
  }

  const btnContinuar = document.getElementById('btn-continuar-micro');
  if (btnContinuar) {
    btnContinuar.addEventListener('click', function() {
      const seccionTest = document.getElementById('seccion-test');
      const seccionMicro = document.getElementById('seccion-micro');
      if (seccionTest) seccionTest.classList.add('hidden');
      if (seccionMicro) seccionMicro.classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  configurarCamaraYSubida();
});

// ========================================
// CALCULO SD3
// ========================================
function calcularSD3() {
  const respuestas = [];
  const respuestasObj = {};

  for (let i = 1; i <= 27; i++) {
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

  const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
  const mach = parseFloat(mean(respuestas.slice(0, 9)).toFixed(2));
  const narc = parseFloat(mean(respuestas.slice(9, 18)).toFixed(2));
  const psych = parseFloat(mean(respuestas.slice(18, 27)).toFixed(2));

  const testFinTimestamp = Date.now();
  const tiempoTotalTest = testFinTimestamp - testInicioTimestamp;
  const tiemposArray = Object.values(tiemposRespuesta).map(t => t.tiempo_ms || 0);
  const estadisticasTiempo = calcularEstadisticasTiempo(tiemposArray);

  resultadosSD3 = {
    mach,
    narc,
    psych,
    respuestas: respuestasObj,
    tiempos_respuesta: tiemposRespuesta,
    tiempo_total_ms: tiempoTotalTest,
    tiempo_total_segundos: (tiempoTotalTest / 1000).toFixed(2),
    estadisticas_tiempo: estadisticasTiempo
  };

  sessionStorage.setItem('resultadosSD3', JSON.stringify(resultadosSD3));

  const resultadoSD3 = document.getElementById('resultado-sd3');
  if (resultadoSD3) {
    resultadoSD3.innerHTML = `
      <div class="resultado-box">
        <h4>Tus resultados SD3</h4>
        <p><strong>Maquiavelismo:</strong> ${mach} / 5.0</p>
        <p><strong>Narcisismo:</strong> ${narc} / 5.0</p>
        <p><strong>Psicopatía:</strong> ${psych} / 5.0</p>
        <p style="margin-top: 15px; font-size: 0.9em; color: #b0a0ff;">
          <strong>Tiempo total:</strong> ${(tiempoTotalTest / 1000 / 60).toFixed(1)} minutos<br>
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

// ========================================
// ESTADISTICAS DE TIEMPO
// ========================================
function calcularEstadisticasTiempo(tiemposArray) {
  if (tiemposArray.length === 0) {
    return {
      promedio_ms: 0,
      promedio_segundos: '0.00',
      mediana_ms: 0,
      mediana_segundos: '0.00',
      minimo_ms: 0,
      minimo_segundos: '0.00',
      maximo_ms: 0,
      maximo_segundos: '0.00',
      desviacion_estandar_ms: 0,
      desviacion_estandar_segundos: '0.00'
    };
  }
  const suma = tiemposArray.reduce((a, b) => a + b, 0);
  const promedio = suma / tiemposArray.length;
  const sorted = [...tiemposArray].sort((a, b) => a - b);
  const medio = Math.floor(sorted.length / 2);
  const mediana = sorted.length % 2 === 0 ? (sorted[medio - 1] + sorted[medio]) / 2 : sorted[medio];
  const minimo = Math.min(...tiemposArray);
  const maximo = Math.max(...tiemposArray);
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

// ========================================
// GRAFICOS SD3
// ========================================
function crearGraficoSD3(mach, narc, psych) {
  const canvas = document.getElementById('grafico-sd3');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (graficoSD3) graficoSD3.destroy();

  graficoSD3 = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Maquiavelismo', 'Narcisismo', 'Psicopatía'],
      datasets: [{
        data: [mach, narc, psych],
        backgroundColor: ['#ff6384', '#36a2eb', '#ffce56'],
        borderColor: '#1a1a2e',
        borderWidth: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#e0e0ff', font: { size: 14 }, padding: 15 } },
        tooltip: { callbacks: { label: function(context) { return context.label + ': ' + context.parsed.toFixed(2); } } }
      }
    }
  });
}

function generarNarrativa(mach, narc, psych) {
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
      <p style="margin-top: 20px; font-style: italic; color: #b0a0ff;">Recordá que estos resultados son parte de una investigación académica y no constituyen un diagnóstico clínico.</p>
    </div>
  `;
}

// ========================================
// CÁMARA Y SUBIDA DE IMAGEN
// ========================================
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
        if (video) { 
          video.srcObject = stream; 
          video.classList.remove('hidden');
          video.play();
        }
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
      
      // ✅ MEJORADO: Validar imagen antes de habilitar botón
      if (imagenCapturada && imagenCapturada.length > 100) {
        if (btnAnalizar) {
          btnAnalizar.classList.remove('hidden');
          btnAnalizar.disabled = false;
        }
      }
      
      if (stream) { 
        stream.getTracks().forEach(track => track.stop()); 
        stream = null; 
      }
    });
  }

  if (btnSubirImagen && inputImagen) {
    btnSubirImagen.addEventListener('click', function() { inputImagen.click(); });
    inputImagen.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file) {
        // Validar tipo de archivo
        if (!file.type.startsWith('image/')) {
          alert('Por favor subí un archivo de imagen válido.');
          return;
        }
        
        const reader = new FileReader();
        reader.onload = function(event) {
          const img = new Image();
          img.onload = function() {
            if (canvas) {
              const ctx = canvas.getContext('2d');
              canvas.width = img.width;
              canvas.height = img.height;
              ctx.drawImage(img, 0, 0);
              imagenCapturada = canvas.toDataURL('image/jpeg', 0.9);
              
              if (video) video.classList.add('hidden');
              canvas.classList.remove('hidden');
              
              // ✅ MEJORADO: Validar imagen
              const btnAnalizarLocal = document.getElementById('btn-analizar');
              if (btnAnalizarLocal && imagenCapturada && imagenCapturada.length > 100) {
                btnAnalizarLocal.classList.remove('hidden');
                btnAnalizarLocal.disabled = false;
              }
            }
          };
          img.onerror = function() {
            alert('Error al cargar la imagen. Intentá con otra.');
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
      }
    });
  }

  if (btnAnalizar) {
    btnAnalizar.addEventListener('click', async () => {
      await analizarMicroexpresiones();
    });
  }
}

// ========================================
// ANALIZAR: enviar a Render y Google Sheets
// ========================================
async function analizarMicroexpresiones() {
  const resultadoDiv = document.getElementById('resultado-micro');
  if (!resultadoDiv) return;

  resultadoDiv.innerHTML = `<div class="analisis-loading">🧠 Analizando microexpresiones...</div>`;
  resultadoDiv.classList.remove('hidden');

  try {
    if (!imagenCapturada || imagenCapturada.length < 100) {
      throw new Error("No hay imagen válida para analizar.");
    }

    // 1) Enviar a Render
    const blob = dataURLtoBlob(imagenCapturada);
    const formData = new FormData();
    formData.append('img', blob, 'foto.jpg');

    console.log('📤 Enviando imagen a Render:', RENDER_PREDICT_URL);

    const res = await fetch(RENDER_PREDICT_URL, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Error en Render: ${res.status} - ${text}`);
    }

    const json = await res.json();
    console.log('✅ Respuesta recibida:', json);
    
    // ✅ CORREGIDO: Procesar respuesta correctamente
    resultadosMicro = {
      emociones: json.emociones || {},
      emocion_dominante: json.emocion_dominante || 'Desconocida',
      confianza: json.confianza || 0,
      facs: json.facs || [],
      sd3_micro: json.sd3 || {}
    };

    // Guardar en sessionStorage para la página de resultados
    sessionStorage.setItem('resultadosMicro', JSON.stringify(resultadosMicro));

    // 2) Guardar en Google Sheets
    const persona = JSON.parse(sessionStorage.getItem('datos_personales') || '{}');
    const sd3 = JSON.parse(sessionStorage.getItem('resultadosSD3') || '{}');

    const payload = {
      timestamp: new Date().toISOString(),
      persona,
      sd3,
      microexpresiones: resultadosMicro,
      imagen: imagenCapturada
    };

    // ✅ MEJORADO: Mejor manejo de errores para Google Sheets
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
      console.log('✅ Datos enviados a Google Sheets');
    } catch (sheetErr) {
      console.warn('⚠️ Error enviando a Google Sheets:', sheetErr.message);
      // No detener el flujo si falla Google Sheets
    }

    // 3) Mostrar resultados
    mostrarResultados(resultadosMicro);

  } catch (err) {
    console.error('❌ Error en análisis:', err);
    resultadoDiv.innerHTML = `
      <div class="resultado-box" style="border-color: #ff6384;">
        <h4>❌ Error en el análisis</h4>
        <p>${err.message}</p>
        <p style="font-size: 0.9em; color: #ff6384; margin-top: 10px;">
          ${err.message.includes('Render') ? 
            'Verificá que el servicio de Render esté activo.' : 
            'Intentá nuevamente o subí otra imagen.'}
        </p>
        <button onclick="location.reload()" class="btn-primary" style="margin-top: 20px;">
          🔄 Reintentar
        </button>
      </div>
    `;
  }
}

// ✅ NUEVA FUNCIÓN: Mostrar resultados de forma organizada
function mostrarResultados(datos) {
  const resultadoDiv = document.getElementById('resultado-micro');
  if (!resultadoDiv) return;

  let html = `
    <div class="resultado-box">
      <h4>✅ Análisis completado</h4>
      <p>Tus microexpresiones han sido procesadas exitosamente.</p>
    </div>
  `;

  // ✅ CORREGIDO: Mostrar solo las emociones, no todo el objeto
  if (datos.emociones && Object.keys(datos.emociones).length > 0) {
    html += '<div class="resultado-box"><h4>🎭 Emociones detectadas:</h4>';
    for (let [emocion, valor] of Object.entries(datos.emociones)) {
      const percentage = (valor * 100).toFixed(1);
      const barWidth = Math.min(percentage, 100);
      html += `
        <div style="margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
            <strong>${emocion}:</strong>
            <span>${percentage}%</span>
          </div>
          <div style="background: #2a2a3e; border-radius: 10px; height: 8px; overflow: hidden;">
            <div style="background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); 
                        width: ${barWidth}%; height: 100%; transition: width 0.5s ease;">
            </div>
          </div>
        </div>
      `;
    }
    html += '</div>';
  }

  // Mostrar emoción dominante
  if (datos.emocion_dominante) {
    html += `
      <div class="resultado-box">
        <h4>🎯 Emoción dominante</h4>
        <p style="font-size: 1.2em; color: #667eea;">
          <strong>${datos.emocion_dominante}</strong>
          ${datos.confianza ? ` (${(datos.confianza * 100).toFixed(1)}% confianza)` : ''}
        </p>
      </div>
    `;
  }

  html += `
    <div class="resultado-box" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
      <p style="margin: 0; font-size: 0.9em;">
        ✅ Tus datos han sido registrados de forma segura para la investigación.
      </p>
    </div>
    <button onclick="window.location.href='resultados.html'" class="btn-primary" style="margin-top: 20px;">
      📊 Ver análisis completo
    </button>
  `;

  resultadoDiv.innerHTML = html;
}

// Helper: dataURL -> Blob
function dataURLtoBlob(dataurl) {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while(n--){
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}
