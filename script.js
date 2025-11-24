// ========================================
// CONFIG — PONÉ TUS ENDPOINTS AQUÍ
// ========================================
const RENDER_PREDICT_URL = "https://darklnesapp-api.onrender.com/run/predict"; 
// ejemplo: https://darklnesapp-api.onrender.com/run/predict
// Si tu endpoint es otro, reemplazalo.

const GOOGLE_SHEETS_WEBAPP_URL = "https://script.google.com/macros/s/AAA.../exec";
// Reemplazá por la URL de tu Google Apps Script web app que reciba POST y guarde filas en tu Sheet.

// ========================================
// VARIABLES GLOBALES
// ========================================
const invertidos = [11, 15, 17, 20, 25];
let graficoSD3;
let graficoEmociones;
let resultadosSD3 = null;
let resultadosMicro = null;
let imagenCapturada = null;
let stream = null;
let audioNarrativa = null;
let modeloCargado = false; // ya no usamos tf local

// TRACKING TIEMPOS
let tiemposRespuesta = {};
let tiempoInicioItem = {};
let testInicioTimestamp = null;

// Items SD3 (igual que tenías)
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
// DOMContentLoaded - formularios y eventos
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

    // Guardamos datos básicos en sessionStorage para la página de resultados
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

  // Botón continuar
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

  // Cámara y subida
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

  // Guardamos en sessionStorage para pagina resultados
  sessionStorage.setItem('resultadosSD3', JSON.stringify(resultadosSD3));

  // Mostrar resumen en la misma página
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
// ESTADISTICAS DE TIEMPO (igual que antes)
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
// GRAFICOS SD3 (igual que antes)
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
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (video) { video.srcObject = stream; video.classList.remove('hidden'); }
        this.classList.add('hidden');
        if (btnTomarFoto) btnTomarFoto.classList.remove('hidden');
      } catch (err) {
        alert('No se pudo acceder a la cámara. Por favor subí una imagen.');
        console.error(err);
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
      if (btnAnalizar) btnAnalizar.classList.remove('hidden');
      if (stream) { stream.getTracks().forEach(track => track.stop()); stream = null; }
    });
  }

  if (btnSubirImagen && inputImagen) {
    btnSubirImagen.addEventListener('click', function() { inputImagen.click(); });
    inputImagen.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file) {
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
              const btnAnalizarLocal = document.getElementById('btn-analizar');
              if (btnAnalizarLocal) btnAnalizarLocal.classList.remove('hidden');
            }
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
// ANALIZAR: manda imagen a RENDER y guarda en Google Sheets
// ========================================
async function analizarMicroexpresiones() {
  const resultadoDiv = document.getElementById('resultado-micro');
  if (!resultadoDiv) return;

  resultadoDiv.innerHTML = `<div class="analisis-loading">Analizando microexpresiones...</div>`;
  resultadoDiv.classList.remove('hidden');

  try {
    if (!imagenCapturada) throw new Error("No hay imagen para analizar. Capturá o subí una foto.");

    // Convertir dataURL a Blob
    const blob = dataURLtoBlob(imagenCapturada);

    // 1) Enviar a Render
    const formData = new FormData();
    formData.append('img', blob, 'foto.jpg');

    const res = await fetch(RENDER_PREDICT_URL, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Error en la API de Render: ${res.status} ${text}`);
    }
    const json = await res.json();

    // Esperamos respuesta con {emociones: {...}, sd3: {...}} o similar
    resultadosMicro = json.emociones || json;
    // si tu API devuelve otro formato, ajustá acá.

    // Guardar SD3 ya calculado (si tu API no devuelve sd3, usamos el que ya guardamos localmente)
    const sd3_from_api = json.sd3 || null;
    if (sd3_from_api) {
      resultadosSD3 = sd3_from_api;
      sessionStorage.setItem('resultadosSD3', JSON.stringify(resultadosSD3));
    } else {
      // si aun no lo tenés (pero lo deberías tener porque pasaste por el test)
      if (!resultadosSD3) {
        resultadosSD3 = JSON.parse(sessionStorage.getItem('resultadosSD3') || 'null');
      }
    }

    // 2) Enviar fila a Google Sheets (webapp)
    try {
      const persona = JSON.parse(sessionStorage.getItem('datos_personales') || '{}');
      const payload = {
        timestamp: new Date().toISOString(),
        persona,
        sd3: resultadosSD3,
        emociones: resultadosMicro
      };
      if (GOOGLE_SHEETS_WEBAPP_URL && GOOGLE_SHEETS_WEBAPP_URL.startsWith('https')) {
        await fetch(GOOGLE_SHEETS_WEBAPP_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        console.warn("No se ha configurado GOOGLE_SHEETS_WEBAPP_URL o no es válida. No se guardaron datos en Sheets.");
      }
    } catch(err) {
      console.warn("Error al guardar en Google Sheets:", err);
    }

    // Guardar en sessionStorage y redirigir a la página de resultados
    sessionStorage.setItem('resultadosMicro', JSON.stringify(resultadosMicro));
    // Si no tenés resultadosSD3 en memoria, ya lo guardamos en el paso de SD3
    if (!resultadosSD3) resultadosSD3 = JSON.parse(sessionStorage.getItem('resultadosSD3') || 'null');

    // Redirigir a resultados.html
    window.location.href = 'resultados.html';

  } catch (err) {
    console.error(err);
    resultadoDiv.innerHTML = `
      <div class="resultado-box" style="border-color: #ff6384;">
        <h4>Error en el análisis</h4>
        <p>No se pudo realizar el análisis. Por favor intentá de nuevo.</p>
        <p style="font-size: 0.9em; color: #ff6384;">${err.message}</p>
        <button onclick="location.reload()" class="btn-primary" style="margin-top: 20px;">🔄 Recargar página</button>
      </div>
    `;
  }
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

// ========================================
// MOSTRAR RESULTADO INTEGRADO (pagina resultados.html lo hará)
// ========================================
function mostrarResultadoIntegrado() {
  // esta función ahora es reemplazada por resultados.html que lee sessionStorage
  // pero la dejo por compatibilidad
  window.location.href = 'resultados.html';
}
