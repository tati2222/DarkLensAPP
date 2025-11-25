// ========================================
// CONFIGURACIÓN
// ========================================
const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbxwUphmMo86NNVp4h1mGCFTmtBATgxFxBTI7hA2dDtUpCoymkelrpKLfC9srMPMVy5EVw/exec'; // 
const RENDER_URL = 'https://darklnesapp-api.onrender.com'; // Tu Streamlit
const RESEARCHER_PASSWORD = 'investigador2025'; // 

// ========================================
// VARIABLES GLOBALES
// ========================================
let datosPersonales = {};
let respuestasSD3 = {};
let tiemposRespuesta = {};
let tiempoInicioItem = {};
let testInicioTimestamp = null;
let imagenCapturada = null;
let stream = null;
let graficoSD3 = null;

const invertidos = [11, 15, 17, 20, 25];

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
// NAVEGACIÓN ENTRE PANTALLAS
// ========================================
function mostrarPantalla(idPantalla) {
  // Ocultar todas
  const pantallas = [
    'pantalla-inicial', 'paso-consentimiento', 'seccion-test', 
    'seccion-micro', 'paso-final', 'investigador-login', 
    'investigador-lista', 'investigador-detalle'
  ];
  
  pantallas.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
  
  // Mostrar la solicitada
  const pantalla = document.getElementById(idPantalla);
  if (pantalla) pantalla.classList.remove('hidden');
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function volverInicio() {
  location.reload();
}

function volverDatos() {
  mostrarPantalla('paso-consentimiento');
}

function volverTest() {
  mostrarPantalla('seccion-test');
}

// ========================================
// FLUJO PARTICIPANTE
// ========================================
function iniciarParticipante() {
  mostrarPantalla('paso-consentimiento');
}

// ========================================
// PASO 1: DATOS PERSONALES
// ========================================
document.addEventListener('DOMContentLoaded', () => {
  const formDatos = document.getElementById('form-datos-basicos');
  
  if (formDatos) {
    formDatos.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const consentimiento = formDatos.querySelector('input[name="consentimiento"]');
      if (!consentimiento || !consentimiento.checked) {
        alert('Debés aceptar el consentimiento para continuar.');
        return;
      }
      
      datosPersonales = {
        nombre: formDatos.querySelector('input[name="nombre"]').value.trim(),
        edad: formDatos.querySelector('input[name="edad"]').value,
        genero: formDatos.querySelector('select[name="genero"]').value,
        pais: formDatos.querySelector('input[name="pais"]').value.trim()
      };
      
      if (!datosPersonales.nombre || !datosPersonales.edad || !datosPersonales.genero || !datosPersonales.pais) {
        alert('Completá todos los campos requeridos.');
        return;
      }
      
      generarTestSD3();
      mostrarPantalla('seccion-test');
    });
  }
  
  configurarCamaraYSubida();
});

// ========================================
// PASO 2: TEST SD3
// ========================================
function generarTestSD3() {
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
  btnSubmit.textContent = 'Continuar al análisis facial';
  btnSubmit.className = 'btn-primary';
  form.appendChild(btnSubmit);
  
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    calcularSD3();
  });
  
  configurarTrackingTiempos();
}

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
  }
}

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
  
  const tiemposArray = Object.values(tiemposRespuesta).map(t => t.tiempo_ms || 0);
  const estadisticasTiempo = calcularEstadisticasTiempo(tiemposArray);
  
  respuestasSD3 = {
    mach,
    narc,
    psych,
    respuestas: respuestasObj,
    tiempos_respuesta: tiemposRespuesta,
    tiempo_total_ms: tiempoTotalTest,
    tiempo_total_segundos: (tiempoTotalTest / 1000).toFixed(2),
    estadisticas_tiempo: estadisticasTiempo
  };
  
  mostrarPantalla('seccion-micro');
}

function calcularEstadisticasTiempo(tiemposArray) {
  if (tiemposArray.length === 0) {
    return {
      promedio_ms: 0,
      promedio_segundos: '0.00',
      mediana_ms: 0,
      mediana_segundos: '0.00'
    };
  }
  const suma = tiemposArray.reduce((a, b) => a + b, 0);
  const promedio = suma / tiemposArray.length;
  const sorted = [...tiemposArray].sort((a, b) => a - b);
  const medio = Math.floor(sorted.length / 2);
  const mediana = sorted.length % 2 === 0 ? (sorted[medio - 1] + sorted[medio]) / 2 : sorted[medio];
  
  return {
    promedio_ms: Math.round(promedio),
    promedio_segundos: (promedio / 1000).toFixed(2),
    mediana_ms: Math.round(mediana),
    mediana_segundos: (mediana / 1000).toFixed(2)
  };
}

// ========================================
// PASO 3: CÁMARA Y SUBIDA DE IMAGEN
// ========================================
function configurarCamaraYSubida() {
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const btnActivarCamara = document.getElementById('btn-activar-camara');
  const btnTomarFoto = document.getElementById('btn-tomar-foto');
  const btnSubirImagen = document.getElementById('btn-subir-imagen');
  const inputImagen = document.getElementById('input-imagen');
  const btnEnviarTodo = document.getElementById('btn-enviar-todo');
  
  if (btnActivarCamara) {
    btnActivarCamara.addEventListener('click', async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (video) {
          video.srcObject = stream;
          video.classList.remove('hidden');
        }
        btnActivarCamara.classList.add('hidden');
        if (btnTomarFoto) btnTomarFoto.classList.remove('hidden');
      } catch (err) {
        alert('No se pudo acceder a la cámara. Por favor subí una imagen.');
        console.error(err);
      }
    });
  }
  
  if (btnTomarFoto && video && canvas) {
    btnTomarFoto.addEventListener('click', () => {
      const ctx = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      imagenCapturada = canvas.toDataURL('image/jpeg', 0.9);
      video.classList.add('hidden');
      canvas.classList.remove('hidden');
      if (btnEnviarTodo) btnEnviarTodo.classList.remove('hidden');
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
      }
    });
  }
  
  if (btnSubirImagen && inputImagen) {
    btnSubirImagen.addEventListener('click', () => inputImagen.click());
    inputImagen.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            if (canvas) {
              const ctx = canvas.getContext('2d');
              canvas.width = img.width;
              canvas.height = img.height;
              ctx.drawImage(img, 0, 0);
              imagenCapturada = canvas.toDataURL('image/jpeg', 0.9);
              if (video) video.classList.add('hidden');
              canvas.classList.remove('hidden');
              if (btnEnviarTodo) btnEnviarTodo.classList.remove('hidden');
            }
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
      }
    });
  }
  
  if (btnEnviarTodo) {
    btnEnviarTodo.addEventListener('click', enviarTodoAGoogleSheets);
  }
}

// ========================================
// ENVIAR TODO A GOOGLE SHEETS
// ========================================
async function enviarTodoAGoogleSheets() {
  if (!imagenCapturada) {
    alert('Por favor capturá o subí una imagen primero.');
    return;
  }
  
  const btnEnviar = document.getElementById('btn-enviar-todo');
  if (btnEnviar) {
    btnEnviar.disabled = true;
    btnEnviar.textContent = 'Enviando...';
  }
  
  try {
    const payload = {
      persona: datosPersonales,
      sd3: respuestasSD3,
      microexpresiones: {
        // Aquí podrías agregar análisis si conectas con tu modelo
        // Por ahora guardamos solo la imagen
      },
      imagen: imagenCapturada
    };
    
    const response = await fetch(GOOGLE_SHEETS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      mode: 'no-cors' // Importante para CORS
    });
    
    console.log('✅ Datos enviados correctamente');
    mostrarPantalla('paso-final');
    
  } catch (error) {
    console.error('Error al enviar datos:', error);
    alert('Hubo un error al enviar los datos. Por favor intentá nuevamente.');
    if (btnEnviar) {
      btnEnviar.disabled = false;
      btnEnviar.textContent = '📤 Enviar y Finalizar';
    }
  }
}

// ========================================
// ZONA INVESTIGADOR
// ========================================
function mostrarLoginInvestigador() {
  mostrarPantalla('investigador-login');
  document.getElementById('password-investigador').value = '';
  document.getElementById('error-login').classList.add('hidden');
}

async function loginInvestigador() {
  const password = document.getElementById('password-investigador').value;
  const errorDiv = document.getElementById('error-login');
  
  if (password === RESEARCHER_PASSWORD) {
    errorDiv.classList.add('hidden');
    await cargarListaParticipantes();
  } else {
    errorDiv.textContent = '❌ Contraseña incorrecta';
    errorDiv.classList.remove('hidden');
  }
}

// Enter para login
document.addEventListener('DOMContentLoaded', () => {
  const passwordInput = document.getElementById('password-investigador');
  if (passwordInput) {
    passwordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') loginInvestigador();
    });
  }
});

function cerrarSesion() {
  mostrarPantalla('pantalla-inicial');
}

// ========================================
// CARGAR LISTA DE PARTICIPANTES
// ========================================
async function cargarListaParticipantes() {
  mostrarPantalla('investigador-lista');
  
  const loadingDiv = document.getElementById('loading-participantes');
  const listaDiv = document.getElementById('lista-participantes');
  
  loadingDiv.classList.remove('hidden');
  listaDiv.innerHTML = '';
  
  try {
    const url = `${GOOGLE_SHEETS_URL}?action=list&password=${encodeURIComponent(RESEARCHER_PASSWORD)}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.success && data.participantes) {
      document.getElementById('total-participantes').textContent = data.participantes.length;
      
      data.participantes.forEach(p => {
        const card = document.createElement('div');
        card.className = 'participante-card';
        card.onclick = () => verDetalleParticipante(p.row);
        
        card.innerHTML = `
          <div class="participante-header">
            <div class="participante-info">
              <h4>${p.nombre}</h4>
              <p>Edad: ${p.edad} | Género: ${p.genero} | País: ${p.pais}</p>
              <p style="font-size: 0.9em; color: #9080d0;">
                Fecha: ${new Date(p.timestamp).toLocaleDateString()} | 
                Mach: ${p.mach.toFixed(2)} | Narc: ${p.narc.toFixed(2)} | Psych: ${p.psych.toFixed(2)}
              </p>
            </div>
            <button class="view-btn">Ver Detalles</button>
          </div>
        `;
        
        listaDiv.appendChild(card);
      });
    } else {
      listaDiv.innerHTML = '<p style="text-align: center; color: #ff6384;">Error al cargar participantes</p>';
    }
    
    loadingDiv.classList.add('hidden');
    
  } catch (error) {
    console.error('Error:', error);
    listaDiv.innerHTML = '<p style="text-align: center; color: #ff6384;">Error de conexión</p>';
    loadingDiv.classList.add('hidden');
  }
}

// ========================================
// VER DETALLE DE PARTICIPANTE
// ========================================
async function verDetalleParticipante(row) {
  mostrarPantalla('investigador-detalle');
  
  const detalleDiv = document.getElementById('detalle-participante');
  detalleDiv.innerHTML = '<p style="text-align: center; padding: 40px;">Cargando detalles...</p>';
  
  try {
    const url = `${GOOGLE_SHEETS_URL}?action=detail&row=${encodeURIComponent(row)}&password=${encodeURIComponent(RESEARCHER_PASSWORD)}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.success && data.participante) {
      const p = data.participante;
      
      detalleDiv.innerHTML = `
        <div class="section">
          <h3>Datos Personales</h3>
          <p><strong>Nombre:</strong> ${p.persona.nombre}</p>
          <p><strong>Edad:</strong> ${p.persona.edad}</p>
          <p><strong>Género:</strong> ${p.persona.genero}</p>
          <p><strong>País:</strong> ${p.persona.pais}</p>
          <p><strong>Fecha:</strong> ${new Date(p.timestamp).toLocaleString()}</p>
        </div>
        
        <div class="detalle-grid">
          <div class="detalle-card">
            <h4>📊 Resultados SD3</h4>
            <div class="detalle-item">
              <strong>Maquiavelismo:</strong> ${p.sd3.mach} / 5.0
            </div>
            <div class="detalle-item">
              <strong>Narcisismo:</strong> ${p.sd3.narc} / 5.0
            </div>
            <div class="detalle-item">
              <strong>Psicopatía:</strong> ${p.sd3.psych} / 5.0
            </div>
          </div>
          
          <div class="detalle-card">
            <h4>⏱️ Tiempos de Respuesta</h4>
            <div class="detalle-item">
              <strong>Tiempo total:</strong> ${p.sd3.tiempo_total_segundos}s
            </div>
            <div class="detalle-item">
              <strong>Promedio por ítem:</strong> ${p.sd3.estadisticas_tiempo?.promedio_segundos || 'N/A'}s
            </div>
          </div>
          
          <div class="detalle-card">
            <h4>😊 Microexpresiones</h4>
            <p style="color: #d0d0ff;">
              ${p.microexpresiones?.emocionDominante || 'Análisis pendiente'}
            </p>
          </div>
          
          <div class="detalle-card">
            <h4>📸 Imagen</h4>
            ${p.imagen ? '<p style="color: #4CAF50;">✓ Disponible</p>' : '<p style="color: #ff6384;">✗ No disponible</p>'}
          </div>
        </div>
        
        <div class="grafico-container">
          <canvas id="grafico-detalle"></canvas>
        </div>
      `;
      
      // Crear gráfico
      crearGraficoDetalle(p.sd3.mach, p.sd3.narc, p.sd3.psych);
      
    } else {
      detalleDiv.innerHTML = '<p style="text-align: center; color: #ff6384;">Error al cargar detalles</p>';
    }
    
  } catch (error) {
    console.error('Error:', error);
    detalleDiv.innerHTML = '<p style="text-align: center; color: #ff6384;">Error de conexión</p>';
  }
}

function crearGraficoDetalle(mach, narc, psych) {
  const canvas = document.getElementById('grafico-detalle');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  if (graficoSD3) graficoSD3.destroy();
  
  graficoSD3 = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Maquiavelismo', 'Narcisismo', 'Psicopatía'],
      datasets: [{
        label: 'Puntaje SD3',
        data: [mach, narc, psych],
        backgroundColor: [
          'rgba(255, 99, 132, 0.7)',
          'rgba(54, 162, 235, 0.7)',
          'rgba(255, 206, 86, 0.7)'
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)'
        ],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          max: 5,
          ticks: { color: '#e0e0ff' },
          grid: { color: 'rgba(192, 128, 255, 0.2)' }
        },
        x: {
          ticks: { color: '#e0e0ff' },
          grid: { color: 'rgba(192, 128, 255, 0.2)' }
        }
      },
      plugins: {
        legend: {
          labels: { color: '#e0e0ff', font: { size: 14 } }
        }
      }
    }
  });
}

function volverListaParticipantes() {
  cargarListaParticipantes();
}
