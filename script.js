// ========================================
// CONFIG — CONFIGURÁ TUS ENDPOINTS AQUÍ
// ========================================
const RENDER_PREDICT_URL = "https://darklnesapp-api.onrender.com/run/predict"; 
// URL de tu API en Render

const GOOGLE_SHEETS_WEBAPP_URL = "const GOOGLE_SHEETS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbypK9Rcy5S74-4ZxXmHyZTvnQ56BomZr5nou9iUEWH0yPu‑XK‑e2wKEZzj9Nk9EtlZb8Q/exec";
";
// Reemplazá con la URL de tu Google Apps Script

// ========================================
// VARIABLES GLOBALES
// ========================================
const invertidos = [11, 15, 17, 20, 25];
let graficoSD3;
let resultadosSD3 = null;
let resultadosMicro = null;
let imagenCapturada = null;
let stream = null;
let tiemposRespuesta = {};
let tiempoInicioItem = {};
let testInicioTimestamp = null;

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
// TRACKING DE TIEMPOS
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

  document.querySelectorAll('.test-item').forEach(item => observer.observe(item));

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
    tiemposRespuesta[itemNum] = {
      tiempo_ms: tiempoFin - tiempoInicio,
      tiempo_segundos: ((tiempoFin - tiempoInicio) / 1000).toFixed(2)
    };
  }
}

// ========================================
// INICIALIZACIÓN
// ========================================
document.addEventListener("DOMContentLoaded", () => {
  const formDatos = document.getElementById("form-datos-basicos");
  const seccionBienvenida = document.getElementById("seccion-bienvenida");
  const seccionTest = document.getElementById("seccion-test");

  if (formDatos) {
    formDatos.addEventListener("submit", (event) => {
      event.preventDefault();
      
      const consentimiento = formDatos.querySelector('input[name="consentimiento"]');
      if (!consentimiento?.checked) {
        alert("Debés aceptar el consentimiento para continuar.");
        return;
      }

      const datos = {
        nombre: formDatos.querySelector('input[name="nombre"]').value.trim(),
        edad: formDatos.querySelector('input[name="edad"]').value,
        genero: formDatos.querySelector('select[name="genero"]').value,
        pais: formDatos.querySelector('input[name="pais"]').value.trim()
      };

      if (!datos.nombre || !datos.edad || !datos.genero || !datos.pais) {
        alert("Completá todos los datos requeridos.");
        return;
      }

      sessionStorage.setItem('datos_personales', JSON.stringify(datos));
      generarItemsTest();
      
      seccionBienvenida?.classList.add("hidden");
      seccionTest?.classList.remove("hidden");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

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
      document.getElementById('seccion-test')?.classList.add('hidden');
      document.getElementById('seccion-micro')?.classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  configurarCamaraYSubida();
});

// ========================================
// CÁLCULO SD3
// ========================================
function calcularSD3() {
  const respuestas = [];
  const respuestasObj = {};

  for (let i = 1; i <= 27; i++) {
    const input = document.querySelector(`input[name="item${i}"]:checked`);
    if (!input) {
      alert(`Por favor respondé el ítem ${i}`);
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

  resultadosSD3 = {
    mach,
    narc,
    psych,
    respuestas: respuestasObj,
    tiempos_respuesta: tiemposRespuesta,
    tiempo_total_ms: tiempoTotalTest,
    tiempo_total_segundos: (tiempoTotalTest / 1000).toFixed(2)
  };

  sessionStorage.setItem('resultadosSD3', JSON.stringify(resultadosSD3));

  mostrarResultadosSD3(mach, narc, psych, tiempoTotalTest);
}

function mostrarResultadosSD3(mach, narc, psych, tiempoTotal) {
  const resultadoSD3 = document.getElementById('resultado-sd3');
  if (resultadoSD3) {
    resultadoSD3.innerHTML = `
      <div class="resultado-box">
        <h4>Tus resultados SD3</h4>
        <p><strong>Maquiavelismo:</strong> ${mach} / 5.0</p>
        <p><strong>Narcisismo:</strong> ${narc} / 5.0</p>
        <p><strong>Psicopatía:</strong> ${psych} / 5.0</p>
        <p style="margin-top: 15px; font-size: 0.9em; color: #b0a0ff;">
          <strong>Tiempo total:</strong> ${(tiempoTotal / 1000 / 60).toFixed(1)} minutos
        </p>
      </div>
    `;
    resultadoSD3.classList.remove('hidden');
  }

  document.getElementById('grafico-container')?.classList.remove('hidden');
  crearGraficoSD3(mach, narc, psych);
  
  const narrativa = document.getElementById('narrativa-sd3');
  if (narrativa) {
    narrativa.innerHTML = generarNarrativa(mach, narc, psych);
    narrativa.classList.remove('hidden');
  }

  document.getElementById('btn-continuar-micro')?.classList.remove('hidden');
}

// ========================================
// GRÁFICO SD3
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
        legend: { 
          position: 'bottom', 
          labels: { color: '#e0e0ff', font: { size: 14 }, padding: 15 } 
        }
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
      <p><strong>Maquiavelismo:</strong> ${interpretar(mach, "manipulación estratégica")}.</p>
      <p><strong>Narcisismo:</strong> ${interpretar(narc, "autoimagen grandiosa")}.</p>
      <p><strong>Psicopatía:</strong> ${interpretar(psych, "impulsividad y búsqueda de sensaciones")}.</p>
      <p style="margin-top: 20px; font-style: italic; color: #b0a0ff;">
        Estos resultados son parte de una investigación académica y no constituyen un diagnóstico clínico.
      </p>
    </div>
  `;
}

// ========================================
// CÁMARA Y SUBIDA
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
        if (video) {
          video.srcObject = stream;
          video.classList.remove('hidden');
        }
        this.classList.add('hidden');
        btnTomarFoto?.classList.remove('hidden');
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
      btnAnalizar?.classList.remove('hidden');
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
      }
    });
  }

  if (btnSubirImagen && inputImagen) {
    btnSubirImagen.addEventListener('click', () => inputImagen.click());
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
              video?.classList.add('hidden');
              canvas.classList.remove('hidden');
              btnAnalizar?.classList.remove('hidden');
            }
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
      }
    });
  }

  if (btnAnalizar) {
    btnAnalizar.addEventListener('click', () => analizarMicroexpresiones());
  }
}

// ========================================
// ANALIZAR Y ENVIAR A RENDER + GOOGLE SHEETS
// ========================================
async function analizarMicroexpresiones() {
  const resultadoDiv = document.getElementById('resultado-micro');
  if (!resultadoDiv) return;

  resultadoDiv.innerHTML = `
    <div class="analisis-loading">
      <div class="spinner"></div>
      Analizando microexpresiones con IA...
    </div>
  `;
  resultadoDiv.classList.remove('hidden');

  try {
    if (!imagenCapturada) {
      throw new Error("No hay imagen para analizar.");
    }

    // 1) Enviar imagen a Render
    const blob = dataURLtoBlob(imagenCapturada);
    const formData = new FormData();
    formData.append('image', blob, 'foto.jpg');

    const res = await fetch(RENDER_PREDICT_URL, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Error del servidor: ${res.status} - ${errorText}`);
    }

    const prediccion = await res.json();
    resultadosMicro = prediccion;

    // 2) Preparar datos completos
    const datosPersonales = JSON.parse(sessionStorage.getItem('datos_personales') || '{}');
    const sd3 = JSON.parse(sessionStorage.getItem('resultadosSD3') || 'null');

    const datosCompletos = {
      timestamp: new Date().toISOString(),
      datos_personales: datosPersonales,
      resultados_sd3: sd3,
      resultados_micro: resultadosMicro,
      imagen_base64: imagenCapturada
    };

    // 3) Enviar a Google Sheets
    try {
      await fetch(GOOGLE_SHEETS_WEBAPP_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosCompletos)
      });
    } catch(err) {
      console.warn("Advertencia al guardar en Sheets:", err);
    }

    // 4) Guardar en sessionStorage y mostrar mensaje
    sessionStorage.setItem('resultadosMicro', JSON.stringify(resultadosMicro));

    resultadoDiv.innerHTML = `
      <div class="resultado-box" style="border-color: #4caf50;">
        <h4>✅ Análisis completado</h4>
        <p>Tu imagen ha sido procesada y los datos fueron guardados correctamente.</p>
        <p style="margin-top: 20px; color: #b0a0ff;">
          <strong>Emoción detectada:</strong> ${prediccion.emocion_principal || 'No disponible'}
        </p>
        <p style="margin-top: 15px; font-style: italic; color: #888;">
          Gracias por participar en esta investigación. La experiencia ha finalizado para vos.
        </p>
      </div>
    `;

  } catch (err) {
    console.error(err);
    resultadoDiv.innerHTML = `
      <div class="resultado-box" style="border-color: #ff6384;">
        <h4>❌ Error en el análisis</h4>
        <p>${err.message}</p>
        <button onclick="location.reload()" class="btn-primary" style="margin-top: 20px;">
          🔄 Reintentar
        </button>
      </div>
    `;
  }
}

function dataURLtoBlob(dataurl) {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while(n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}
