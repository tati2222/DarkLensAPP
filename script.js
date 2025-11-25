// ========================================
// CONFIG — CONFIGURÁ TUS ENDPOINTS AQUÍ
// ========================================
const RENDER_PREDICT_URL = "https://tu-app.onrender.com/predict"; 
const GOOGLE_SHEETS_WEBAPP_URL = "https://script.google.com/macros/s/TU_DEPLOYMENT_ID/exec";

// Credenciales investigador (⚠️ CAMBIAR EN PRODUCCIÓN)
const VALID_CREDENTIALS = {
  username: "investigador",
  password: "darklens2024"
};

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

// Variables investigador
let todosLosDatos = [];
let datosFiltrados = [];
let graficoParticipante = null;

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
// INICIALIZACIÓN
// ========================================
document.addEventListener("DOMContentLoaded", () => {
  // === PARTE PARTICIPANTE ===
  const formDatos = document.getElementById("form-datos-basicos");
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
      
      document.getElementById('seccion-bienvenida')?.classList.add("hidden");
      document.getElementById('seccion-test')?.classList.remove("hidden");
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

  // === PARTE INVESTIGADOR ===
  const btnInvestigador = document.getElementById('btn-investigador');
  if (btnInvestigador) {
    btnInvestigador.addEventListener('click', mostrarLoginInvestigador);
  }

  const formLogin = document.getElementById('form-login');
  if (formLogin) {
    formLogin.addEventListener('submit', function(e) {
      e.preventDefault();
      validarLogin();
    });
  }

  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', cerrarSesionInvestigador);
  }
});

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
      console.log('Datos enviados a Google Sheets');
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

// ========================================
// ZONA INVESTIGADOR
// ========================================
function mostrarLoginInvestigador() {
  document.getElementById('seccion-participante')?.classList.add('hidden');
  document.getElementById('investigador-login')?.classList.remove('hidden');
}

function validarLogin() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const errorDiv = document.getElementById('login-error');

  if (username === VALID_CREDENTIALS.username && password === VALID_CREDENTIALS.password) {
    document.getElementById('investigador-login').classList.add('hidden');
    document.getElementById('investigador-lista').classList.remove('hidden');
    cargarDatosParticipantes();
  } else {
    errorDiv.classList.remove('hidden');
  }
}

function cerrarSesionInvestigador() {
  document.getElementById('investigador-lista').classList.add('hidden');
  document.getElementById('investigador-detalle').classList.add('hidden');
  document.getElementById('seccion-participante').classList.remove('hidden');
  todosLosDatos = [];
  datosFiltrados = [];
}

async function cargarDatosParticipantes() {
  const listaDiv = document.getElementById('lista-participantes');
  listaDiv.innerHTML = '<p style="text-align: center; padding: 40px;"><div class="spinner"></div> Cargando datos...</p>';

  try {
    const response = await fetch(GOOGLE_SHEETS_WEBAPP_URL);
    const data = await response.json();
    
    if (data.participantes && Array.isArray(data.participantes)) {
      todosLosDatos = data.participantes;
      datosFiltrados = [...todosLosDatos];
      renderizarListaParticipantes();
    } else {
      throw new Error('Formato de datos inválido');
    }
  } catch (err) {
    console.error('Error cargando datos:', err);
    listaDiv.innerHTML = `
      <div class="error-message">
        <h4>❌ Error de conexión</h4>
        <p>No se pudieron cargar los datos desde Google Sheets.</p>
        <p style="font-size: 0.9em; margin-top: 10px;">Detalles: ${err.message}</p>
        <p style="font-size: 0.9em; margin-top: 10px;">Verificá que:</p>
        <ul style="margin-top: 10px; padding-left: 20px;">
          <li>La URL de Google Sheets esté correctamente configurada en script.js</li>
          <li>El Google Apps Script esté deployado como Web App</li>
          <li>Los permisos estén otorgados correctamente</li>
        </ul>
        <button onclick="cargarDatosParticipantes()" class="btn-primary" style="margin-top: 20px;">
          🔄 Reintentar
        </button>
      </div>
    `;
  }
}

function renderizarListaParticipantes() {
  const listaDiv = document.getElementById('lista-participantes');
  
  if (datosFiltrados.length === 0) {
    listaDiv.innerHTML = '<p style="text-align: center; padding: 40px; color: #888;">No hay participantes registrados aún.</p>';
    return;
  }

  listaDiv.innerHTML = datosFiltrados.map((p, index) => {
    const datos = p.datos_personales || {};
    const sd3 = p.resultados_sd3 || {};
    return `
      <div class="participante-card" onclick="mostrarDetalleParticipante(${index})">
        <div class="participante-header">
          <div>
            <strong style="font-size: 1.2em; color: #c080ff;">${datos.nombre || 'Anónimo'}</strong>
            <span style="color: #888; margin-left: 15px;">
              ${datos.edad || '?'} años | ${datos.genero || '?'} | ${datos.pais || '?'}
            </span>
          </div>
          <div style="color: #b0a0ff;">
            Mach: ${sd3.mach || '?'} | Narc: ${sd3.narc || '?'} | Psych: ${sd3.psych || '?'}
          </div>
        </div>
        <p style="font-size: 0.9em; color: #888; margin-top: 10px;">
          ${p.timestamp ? new Date(p.timestamp).toLocaleString('es-AR') : 'Fecha desconocida'}
        </p>
      </div>
    `;
  }).join('');
}

function mostrarDetalleParticipante(index) {
  const participante = datosFiltrados[index];
  
  document.getElementById('investigador-lista').classList.add('hidden');
  document.getElementById('investigador-detalle').classList.remove('hidden');
  
  generarAnalisisCompleto(participante);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function volverListaParticipantes() {
  document.getElementById('investigador-detalle').classList.add('hidden');
  document.getElementById('investigador-lista').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function generarAnalisisCompleto(p) {
  const detalleDiv = document.getElementById('detalle-participante');
  const datos = p.datos_personales || {};
  const sd3 = p.resultados_sd3 || {};
  const micro = p.resultados_micro || {};
  const tiempos = sd3.tiempos_respuesta || {};

  // Analizar tendencias
  const respuestas = sd3.respuestas || {};
  const valoresRespuestas = Object.values(respuestas);
  const promedioRespuestas = valoresRespuestas.reduce((a,b) => a+b, 0) / valoresRespuestas.length;
  const respuestasExtremas = valoresRespuestas.filter(v => v === 1 || v === 5).length;
  const respuestasNeutrales = valoresRespuestas.filter(v => v === 3).length;

  // Analizar tiempos
  const tiemposArray = Object.values(tiempos).map(t => parseFloat(t.tiempo_segundos) || 0);
  const tiempoPromedio = tiemposArray.reduce((a,b) => a+b, 0) / tiemposArray.length;
  const tiempoMin = Math.min(...tiemposArray);
  const tiempoMax = Math.max(...tiemposArray);

  detalleDiv.innerHTML = `
    <div class="detalle-grid">
      <!-- DATOS PERSONALES -->
      <div class="detalle-card">
        <h4>👤 Datos Personales</h4>
        <p><strong>Nombre:</strong> ${datos.nombre || 'N/A'}</p>
        <p><strong>Edad:</strong> ${datos.edad || 'N/A'} años</p>
        <p><strong>Género:</strong> ${datos.genero || 'N/A'}</p>
        <p><strong>País:</strong> ${datos.pais || 'N/A'}</p>
        <p><strong>Fecha:</strong> ${p.timestamp ? new Date(p.timestamp).toLocaleString('es-AR') : 'N/A'}</p>
      </div>

      <!-- RESULTADOS SD3 -->
      <div class="detalle-card">
        <h4>📊 Resultados SD3</h4>
        <p><strong>Maquiavelismo:</strong> ${sd3.mach || 'N/A'} / 5.0</p>
        <p><strong>Narcisismo:</strong> ${sd3.narc || 'N/A'} / 5.0</p>
        <p><strong>Psicopatía:</strong> ${sd3.psych || 'N/A'} / 5.0</p>
        <p style="margin-top: 15px;"><strong>Tiempo total:</strong> ${sd3.tiempo_total_segundos || 'N/A'}s</p>
        <div class="grafico-container" style="margin-top: 20px;">
          <canvas id="grafico-detalle"></canvas>
        </div>
      </div>

      <!-- MICROEXPRESIONES -->
      <div class="detalle-card">
        <h4>😊 Análisis Microexpresiones</h4>
        <p><strong>Emoción principal:</strong> ${micro.emocion_principal || 'N/A'}</p>
        ${micro.confianza ? `<p><strong>Confianza:</strong> ${(micro.confianza * 100).toFixed(1)}%</p>` : ''}
        ${p.imagen_base64 ? `
          <div style="margin-top: 20px;">
            <img src="${p.imagen_base64}" style="max-width: 100%; border-radius: 10px; border: 2px solid rgba(127, 0, 255, 0.3);" alt="Imagen del participante">
          </div>
        ` : ''}
      </div>

      <!-- TIEMPO DE REACCIÓN -->
      <div class="detalle-card">
        <h4>⏱️ Tiempo de Reacción</h4>
        <p><strong>Promedio:</strong> ${tiempoPromedio.toFixed(2)}s por ítem</p>
        <p><strong>Mínimo:</strong> ${tiempoMin.toFixed(2)}s</p>
        <p><strong>Máximo:</strong> ${tiempoMax.toFixed(2)}s</p>
        <p style="margin-top: 15px; font-size: 0.9em; color: #888;">
          ${tiempoPromedio < 3 ? '⚡ Respuestas muy rápidas - posible impulsividad' : 
            tiempoPromedio > 10 ? '🤔 Respuestas lentas - posible reflexión profunda' : 
            '✓ Tiempo de respuesta normal'}
        </p>
      </div>

      <!-- TENDENCIAS -->
      <div class="detalle-card">
        <h4>📈 Tendencias de Respuestas</h4>
        <p><strong>Promedio general:</strong> ${promedioRespuestas.toFixed(2)} / 5.0</p>
        <p><strong>Respuestas extremas (1 o 5):</strong> ${respuestasExtremas} de 27 (${((respuestasExtremas/27)*100).toFixed(1)}%)</p>
        <p><strong>Respuestas neutrales (3):</strong> ${respuestasNeutrales} de 27 (${((respuestasNeutrales/27)*100).toFixed(1)}%)</p>
        <p style="margin-top: 15px; font-size: 0.9em; color: #888;">
          ${respuestasExtremas > 15 ? '⚠️ Alta polarización en respuestas' : 
            respuestasNeutrales > 15 ? '➡️ Tendencia a respuestas neutrales' : 
            '✓ Patrón de respuestas equilibrado'}
        </p>
      </div>

      <!-- ANÁLISIS INTEGRADOR -->
      <div class="detalle-card" style="grid-column: 1 / -1;">
        <h4>🧠 Análisis Final Integrador</h4>
        ${generarAnalisisIntegrador(sd3, micro, tiempoPromedio, respuestasExtremas, respuestasNeutrales)}
      </div>
    </div>
  `;

  // Crear gráfico del participante
  setTimeout(() => {
    const canvas = document.getElementById('grafico-detalle');
    if (canvas && sd3.mach && sd3.narc && sd3.psych) {
      const ctx = canvas.getContext('2d');
      if (graficoParticipante) graficoParticipante.destroy();
      
      graficoParticipante = new Chart(ctx, {
        type: 'radar',
        data: {
          labels: ['Maquiavelismo', 'Narcisismo', 'Psicopatía'],
          datasets: [{
            label: 'Puntajes SD3',
            data: [sd3.mach, sd3.narc, sd3.psych],
            backgroundColor: 'rgba(127, 0, 255, 0.2)',
            borderColor: '#7f00ff',
            borderWidth: 2,
            pointBackgroundColor: '#c080ff',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: '#7f00ff'
          }]
        },
        options: {
          scales: {
            r: {
              beginAtZero: true,
              max: 5,
              ticks: { color: '#e0e0ff', backdropColor: 'transparent' },
              grid: { color: 'rgba(192, 128, 255, 0.2)' },
              pointLabels: { color: '#c080ff', font: { size: 12 } }
            }
          },
          plugins: {
            legend: { labels: { color: '#e0e0ff' } }
          }
        }
      });
    }
  }, 100);
}

function generarAnalisisIntegrador(sd3, micro, tiempoPromedio, respuestasExtremas, respuestasNeutrales) {
  let analisis = '<div style="line-height: 1.8;">';

  // Análisis SD3
  const mach = sd3.mach || 0;
  const narc = sd3.narc || 0;
  const psych = sd3.psych || 0;

  analisis += '<p><strong>Perfil Psicométrico (SD3):</strong> ';
  
  if (mach > 3.5) {
    analisis += 'Se observa un maquiavelismo elevado, indicando tendencia a la manipulación estratégica y cálculo interpersonal. ';
  } else if (mach < 2.5) {
    analisis += 'Bajo maquiavelismo, sugiriendo menor tendencia a la manipulación interpersonal. ';
  } else {
    analisis += 'Maquiavelismo moderado, dentro de rangos típicos. ';
  }

  if (narc > 3.5) {
    analisis += 'Narcisismo alto, asociado con búsqueda de admiración y autoimagen grandiosa. ';
  } else if (narc < 2.5) {
    analisis += 'Bajo narcisismo, menos énfasis en autopromoción. ';
  } else {
    analisis += 'Narcisismo moderado. ';
  }

  if (psych > 3.5) {
    analisis += 'Psicopatía subclínica elevada, vinculada con impulsividad y búsqueda de estimulación intensa.';
  } else if (psych < 2.5) {
    analisis += 'Baja psicopatía subclínica, menor impulsividad.';
  } else {
    analisis += 'Psicopatía subclínica moderada.';
  }
  analisis += '</p>';

  // Análisis emocional
  const emocion = micro.emocion_principal || '';
  if (emocion) {
    analisis += `<p><strong>Expresión Facial:</strong> La microexpresión predominante de "${emocion}" `;
    
    if (emocion === 'feliz' && narc > 3) {
      analisis += 'es consistente con la presentación positiva típica del narcisismo elevado.';
    } else if (emocion === 'neutral' && mach > 3) {
      analisis += 'puede reflejar el control emocional característico del maquiavelismo.';
    } else if (emocion === 'enojado' && psych > 3) {
      analisis += 'podría relacionarse con la irritabilidad asociada a rasgos psicopáticos.';
    } else {
      analisis += 'se registra como expresión facial predominante.';
    }
    analisis += '</p>';
  }

  // Análisis de tiempos
  analisis += '<p><strong>Patrón de Respuesta:</strong> ';
  if (tiempoPromedio < 3) {
    analisis += 'Tiempo de reacción muy corto sugiere respuestas impulsivas, posiblemente relacionado con baja reflexividad.';
  } else if (tiempoPromedio > 10) {
    analisis += 'Tiempo de reacción extenso indica deliberación cuidadosa, posible sesgo de deseabilidad social.';
  } else {
    analisis += 'Tiempo de reacción normal indica procesamiento estándar de ítems.';
  }
  analisis += '</p>';

  // Análisis de tendencias
  analisis += '<p><strong>Consistencia:</strong> ';
  if (respuestasExtremas > 15) {
    analisis += 'Alta polarización en respuestas (muchos 1s y 5s) puede indicar pensamiento dicotómico o baja ambigüedad tolerada.';
  } else if (respuestasNeutrales > 15) {
    analisis += 'Exceso de respuestas neutrales puede sugerir indiferencia, cautela excesiva o dificultad para tomar posición.';
  } else {
    analisis += 'Patrón de respuestas equilibrado sugiere diferenciación adecuada entre ítems.';
  }
  analisis += '</p>';

  // Integración final
  analisis += '<p style="margin-top: 20px; padding-top: 20px; border-top: 2px solid rgba(127, 0, 255, 0.3);"><strong>Síntesis:</strong> ';
  
  const promedioDark = (mach + narc + psych) / 3;
  if (promedioDark > 3.5) {
    analisis += 'El perfil presenta rasgos de personalidad oscura por encima del promedio poblacional. ';
  } else if (promedioDark < 2.5) {
    analisis += 'El perfil muestra rasgos de personalidad oscura por debajo del promedio poblacional. ';
  } else {
    analisis += 'El perfil se encuentra dentro de rangos típicos en rasgos de personalidad oscura. ';
  }

  analisis += 'Este análisis es exploratorio y debe interpretarse exclusivamente en contexto de investigación académica, sin valor diagnóstico clínico.</p>';

  analisis += '</div>';
  return analisis;
}

// Función auxiliar para crear spinner
function createSpinner() {
  return '<div class="spinner"></div>';
}
