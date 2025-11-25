// ========================================
// CONFIGURACIÓN
// ========================================
const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbwfcPm38VaTFKJjEFXXO3c-x6r2HOBWmIW_4vbeOMZE-xvtbDhNF0-SH4MBGPwMLZHw2A/exec'; // 
const RENDER_URL = 'https://darklnesapp-api.onrender.com'; // Tu Streamlit
const RESEARCHER_PASSWORD = 'investigador2025'; // 
// URL de tu Google Apps Script WebApp (modificá por la tuya)
const API_URL = "https://script.google.com/macros/s/AKfycbzOleFtkPXQLzj6withzWA21LBubHJkqB1HiCFq5hqNnOjOL7aSU44qMLHiWs0DSFb0Mg/exec";

///////////////////////
// Variables y selectores
///////////////////////
const btnInvestigador = document.getElementById('btn-investigador');
const seccionParticipante = document.getElementById('seccion-participante');
const seccionLogin = document.getElementById('investigador-login');
const seccionLista = document.getElementById('investigador-lista');
const seccionDetalle = document.getElementById('investigador-detalle');

const formLogin = document.getElementById('form-login');
const inputPassword = document.getElementById('password');
const loginError = document.getElementById('login-error');

const listaParticipantesDiv = document.getElementById('lista-participantes');
const detalleParticipanteDiv = document.getElementById('detalle-participante');
const btnLogout = document.getElementById('btn-logout');

let investigadorAutenticado = false;
let CONTRASENA_INVESTIGADOR = "investigador2025"; // Debe coincidir con la del script backend

///////////////////////
// FUNCIONES DE NAVEGACIÓN
///////////////////////

// Mostrar solo participante
function mostrarParticipante() {
  seccionParticipante.classList.remove('hidden');
  seccionLogin.classList.add('hidden');
  seccionLista.classList.add('hidden');
  seccionDetalle.classList.add('hidden');
  btnInvestigador.style.display = 'block';
}

// Mostrar login investigador
function mostrarLoginInvestigador() {
  seccionParticipante.classList.add('hidden');
  seccionLogin.classList.remove('hidden');
  seccionLista.classList.add('hidden');
  seccionDetalle.classList.add('hidden');
  btnInvestigador.style.display = 'none';
  loginError.classList.add('hidden');
  formLogin.reset();
}

// Mostrar lista investigadores
function mostrarListaParticipantes() {
  seccionParticipante.classList.add('hidden');
  seccionLogin.classList.add('hidden');
  seccionLista.classList.remove('hidden');
  seccionDetalle.classList.add('hidden');
  btnInvestigador.style.display = 'none';
}

// Mostrar detalle participante
function mostrarDetalleParticipante() {
  seccionParticipante.classList.add('hidden');
  seccionLogin.classList.add('hidden');
  seccionLista.classList.add('hidden');
  seccionDetalle.classList.remove('hidden');
  btnInvestigador.style.display = 'none';
}

///////////////////////
// EVENTOS
///////////////////////

// Botón acceso investigador
btnInvestigador.addEventListener('click', () => {
  mostrarLoginInvestigador();
});

// Login investigador (solo contraseña)
formLogin.addEventListener('submit', e => {
  e.preventDefault();
  const passwordIngresada = inputPassword.value.trim();

  if (passwordIngresada === CONTRASENA_INVESTIGADOR) {
    investigadorAutenticado = true;
    cargarListaParticipantes();
    mostrarListaParticipantes();
  } else {
    loginError.classList.remove('hidden');
  }
});

// Logout investigador
btnLogout.addEventListener('click', () => {
  investigadorAutenticado = false;
  mostrarParticipante();
});

///////////////////////
// FUNCIONES PARA INVESTIGADOR
///////////////////////

// Cargar lista de participantes (llamando al backend)
async function cargarListaParticipantes() {
  try {
    listaParticipantesDiv.innerHTML = '<p>Cargando participantes...</p>';
    const response = await fetch(`${API_URL}?action=list&password=${CONTRASENA_INVESTIGADOR}`);
    const data = await response.json();

    if (data.success) {
      if (data.total === 0) {
        listaParticipantesDiv.innerHTML = '<p>No hay participantes registrados aún.</p>';
        return;
      }

      // Crear lista interactiva
      listaParticipantesDiv.innerHTML = '';
      data.participantes.forEach(part => {
        const card = document.createElement('div');
        card.classList.add('participante-card');
        card.innerHTML = `
          <div class="participante-header">
            <strong>${part.nombre || 'Sin nombre'}</strong>
            <span>${part.genero || ''} | ${part.edad || ''} años | ${part.pais || ''}</span>
          </div>
          <div><strong>Mach:</strong> ${part.mach.toFixed(2)} | <strong>Narc:</strong> ${part.narc.toFixed(2)} | <strong>Psych:</strong> ${part.psych.toFixed(2)}</div>
          <div><strong>Emoción dominante:</strong> ${part.emocionDominante || 'N/A'}</div>
          <div><small>${new Date(part.timestamp).toLocaleString()}</small></div>
        `;
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => {
          cargarDetalleParticipante(part.row);
        });
        listaParticipantesDiv.appendChild(card);
      });
    } else {
      listaParticipantesDiv.innerHTML = `<p>Error: ${data.error}</p>`;
    }
  } catch (error) {
    listaParticipantesDiv.innerHTML = `<p>Error al cargar participantes: ${error.message}</p>`;
  }
}

// Cargar detalle de participante
async function cargarDetalleParticipante(rowNumber) {
  try {
    detalleParticipanteDiv.innerHTML = '<p>Cargando detalle...</p>';
    const response = await fetch(`${API_URL}?action=detail&row=${rowNumber}&password=${CONTRASENA_INVESTIGADOR}`);
    const data = await response.json();

    if (data.success && data.participante) {
      const p = data.participante;
      detalleParticipanteDiv.innerHTML = `
        <div class="detalle-card">
          <h4>Datos Personales</h4>
          <p><strong>Nombre:</strong> ${p.persona.nombre}</p>
          <p><strong>Edad:</strong> ${p.persona.edad}</p>
          <p><strong>Género:</strong> ${p.persona.genero}</p>
          <p><strong>País:</strong> ${p.persona.pais}</p>
        </div>

        <div class="detalle-card">
          <h4>Resultados SD3</h4>
          <p><strong>Mach:</strong> ${p.sd3.mach.toFixed(2)}</p>
          <p><strong>Narc:</strong> ${p.sd3.narc.toFixed(2)}</p>
          <p><strong>Psych:</strong> ${p.sd3.psych.toFixed(2)}</p>
          <p><strong>Tiempo total (segundos):</strong> ${p.sd3.tiempo_total_segundos}</p>
        </div>

        <div class="detalle-card">
          <h4>Emoción dominante</h4>
          <p>${p.microexpresiones.emocionDominante || 'N/A'}</p>
        </div>

        <div class="detalle-card">
          <h4>Imagen facial</h4>
          ${p.imagen ? `<img src="${p.imagen}" alt="Imagen participante" style="max-width: 100%; border-radius: 12px;"/>` : '<p>No hay imagen disponible.</p>'}
        </div>
      `;
      mostrarDetalleParticipante();
    } else {
      detalleParticipanteDiv.innerHTML = `<p>Error: ${data.error}</p>`;
    }
  } catch (error) {
    detalleParticipanteDiv.innerHTML = `<p>Error al cargar detalle: ${error.message}</p>`;
  }
}

///////////////////////
// FORMULARIO PARTICIPANTE
///////////////////////

const formDatosBasicos = document.getElementById('form-datos-basicos');

formDatosBasicos.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Recoger datos
  const formData = new FormData(formDatosBasicos);
  const persona = {
    nombre: formData.get('nombre').trim(),
    edad: formData.get('edad'),
    genero: formData.get('genero'),
    pais: formData.get('pais'),
  };

  // Solo permito continuar si hay consentimiento (checkbox)
  if (!formData.get('consentimiento')) {
    alert('Debes aceptar el consentimiento para continuar.');
    return;
  }

  // Aquí va el envío inicial de datos básicos al backend o el paso siguiente (aquí sólo demo)
  alert('¡Datos básicos registrados! Ahora implementá el siguiente paso.');

  // Aquí sigue tu lógica del test, microexpresiones, etc.
});

///////////////////////
// Funciones auxiliares para navegación investigador
///////////////////////

function volverAInicio() {
  mostrarParticipante();
}

function volverListaParticipantes() {
  mostrarListaParticipantes();
}

///////////////////////
// AL CARGAR PÁGINA
///////////////////////
mostrarParticipante();

