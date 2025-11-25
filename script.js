// ========================================
// CONFIGURACIÓN
// ========================================
const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbwfcPm38VaTFKJjEFXXO3c-x6r2HOBWmIW_4vbeOMZE-xvtbDhNF0-SH4MBGPwMLZHw2A/exec'; // 
const RENDER_URL = 'https://darklnesapp-api.onrender.com'; // Tu Streamlit
const RESEARCHER_PASSWORD = 'investigador2025'; // 


// --- Variables globales ---
const btnInvestigador = document.getElementById("btn-investigador");
const seccionParticipante = document.getElementById("seccion-participante");
const seccionBienvenida = document.getElementById("seccion-bienvenida");
const seccionTest = document.getElementById("seccion-test");
const seccionMicro = document.getElementById("seccion-micro");

const formDatosBasicos = document.getElementById("form-datos-basicos");
const formSd3 = document.getElementById("form-sd3");
const btnContinuarMicro = document.getElementById("btn-continuar-micro");

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const btnActivarCamara = document.getElementById("btn-activar-camara");
const btnTomarFoto = document.getElementById("btn-tomar-foto");
const btnSubirImagen = document.getElementById("btn-subir-imagen");
const inputImagen = document.getElementById("input-imagen");
const btnAnalizar = document.getElementById("btn-analizar");

const resultadoSd3 = document.getElementById("resultado-sd3");
const resultadoMicro = document.getElementById("resultado-micro");
const graficoContainer = document.getElementById("grafico-container");

const investigadorLogin = document.getElementById("investigador-login");
const investigadorLista = document.getElementById("investigador-lista");
const investigadorDetalle = document.getElementById("investigador-detalle");
const listaParticipantes = document.getElementById("lista-participantes");
const detalleParticipante = document.getElementById("detalle-participante");

const formLogin = document.getElementById("form-login");
const loginError = document.getElementById("login-error");
const btnLogout = document.getElementById("btn-logout");

let datosParticipante = {};
let respuestasSD3 = {};
let tiempoInicioTest = null;
let tiempoFinTest = null;

let imagenCapturada = null; // para guardar imagen en base64 o archivo

// === ITEMS SD3 (27 preguntas con id y texto) ===
const itemsSD3 = [
  { id: 1, texto: "Me gusta manipular a la gente para que haga lo que quiero." },
  { id: 2, texto: "Me siento importante porque los demás me admiran." },
  { id: 3, texto: "A veces hago cosas sin pensar en las consecuencias." },
  { id: 4, texto: "No me importa mentir si me beneficia." },
  { id: 5, texto: "Me gusta ser el centro de atención." },
  { id: 6, texto: "Soy bueno para engañar a otros." },
  { id: 7, texto: "Me considero una persona carismática." },
  { id: 8, texto: "A menudo me aburro y busco emociones fuertes." },
  { id: 9, texto: "No me arrepiento de mis malas acciones." },
  { id: 10, texto: "Disfruto tener el control sobre otros." },
  { id: 11, texto: "Creo que soy más especial que la mayoría de las personas." },
  { id: 12, texto: "A veces hago cosas peligrosas solo por diversión." },
  { id: 13, texto: "Puedo ser frío y calculador para conseguir lo que quiero." },
  { id: 14, texto: "Me gusta que me admiren por lo que hago." },
  { id: 15, texto: "No me importa si lastimo a alguien para lograr mis objetivos." },
  { id: 16, texto: "Disfruto manipulando situaciones a mi favor." },
  { id: 17, texto: "Me gusta ser reconocido y apreciado." },
  { id: 18, texto: "A veces actúo sin pensar en el daño que puedo causar." },
  { id: 19, texto: "Soy bueno para conseguir que otros hagan lo que quiero sin que se den cuenta." },
  { id: 20, texto: "Me considero una persona muy atractiva." },
  { id: 21, texto: "No suelo sentir culpa por mis malas acciones." },
  { id: 22, texto: "Disfruto de la emoción de romper las reglas." },
  { id: 23, texto: "Me esfuerzo por ser admirado y respetado." },
  { id: 24, texto: "A veces uso a las personas para mis propios fines." },
  { id: 25, texto: "Me gusta llamar la atención donde voy." },
  { id: 26, texto: "No me preocupo mucho por las normas sociales." },
  { id: 27, texto: "Puedo ser muy persuasivo cuando quiero algo." },
];

// === Función para crear formulario del test SD3 ===
function generarFormularioSD3() {
  formSd3.innerHTML = "";
  itemsSD3.forEach(item => {
    const div = document.createElement("div");
    div.classList.add("test-item");

    div.innerHTML = `
      <p><strong>Item ${item.id}:</strong> ${item.texto}</p>
      <div class="opciones">
        <input type="radio" name="item${item.id}" id="item${item.id}_1" value="1" required>
        <label for="item${item.id}_1">1</label>

        <input type="radio" name="item${item.id}" id="item${item.id}_2" value="2">
        <label for="item${item.id}_2">2</label>

        <input type="radio" name="item${item.id}" id="item${item.id}_3" value="3">
        <label for="item${item.id}_3">3</label>

        <input type="radio" name="item${item.id}" id="item${item.id}_4" value="4">
        <label for="item${item.id}_4">4</label>

        <input type="radio" name="item${item.id}" id="item${item.id}_5" value="5">
        <label for="item${item.id}_5">5</label>
      </div>
    `;
    formSd3.appendChild(div);
  });
}

// --- Evento cuando completan datos básicos ---
formDatosBasicos.addEventListener("submit", (e) => {
  e.preventDefault();
  // Guardar datos básicos
  const fd = new FormData(formDatosBasicos);
  datosParticipante.nombre = fd.get("nombre");
  datosParticipante.edad = fd.get("edad");
  datosParticipante.genero = fd.get("genero");
  datosParticipante.pais = fd.get("pais");
  datosParticipante.consentimiento = fd.get("consentimiento") === "on";

  if (!datosParticipante.consentimiento) {
    alert("Debes aceptar el consentimiento para continuar.");
    return;
  }

  // Pasar a siguiente sección: test SD3
  seccionBienvenida.classList.add("hidden");
  seccionTest.classList.remove("hidden");

  generarFormularioSD3();

  tiempoInicioTest = Date.now();
});

// --- Evento cuando completan el test SD3 ---
formSd3.addEventListener("submit", (e) => {
  e.preventDefault();

  // Leer respuestas
  const fd = new FormData(formSd3);
  let respuestas = {};
  for(let i=1; i<=27; i++) {
    const val = fd.get(`item${i}`);
    if(!val) {
      alert("Debes responder todas las preguntas.");
      return;
    }
    respuestas[`item${i}`] = parseInt(val);
  }

  tiempoFinTest = Date.now();

  respuestasSD3 = respuestas;

  // Calcular puntajes totales para mach, narc, psych (ejemplo, si quieres fórmula específica, la aplicás)
  // Aquí un ejemplo básico de suma (suponiendo que los items están ordenados para cada factor):
  // Machiavellianism: items 1,4,6,10,13,16,19,24
  // Narcissism: items 2,5,7,11,14,17,20,23,25
  // Psychopathy: items 3,8,9,12,15,18,21,22,26,27

  function sumaItems(ids) {
    return ids.reduce((acc, id) => acc + respuestas[`item${id}`], 0);
  }

  const machItems = [1,4,6,10,13,16,19,24];
  const narcItems = [2,5,7,11,14,17,20,23,25];
  const psychItems = [3,8,9,12,15,18,21,22,26,27];

  const mach = sumaItems(machItems);
  const narc = sumaItems(narcItems);
  const psych = sumaItems(psychItems);

  // Guardar puntajes
  datosParticipante.mach = mach;
  datosParticipante.narc = narc;
  datosParticipante.psych = psych;

  const tiempoTotalSeg = Math.round((tiempoFinTest - tiempoInicioTest) / 1000);
  datosParticipante.tiempo_total_seg = tiempoTotalSeg;

  // Mostrar resumen simple
  resultadoSd3.classList.remove("hidden");
  resultadoSd3.innerHTML = `
    <h4>Resultados Test SD3</h4>
    <p><strong>Maquiavelismo:</strong> ${mach}</p>
    <p><strong>Narcisismo:</strong> ${narc}</p>
    <p><strong>Psicopatía:</strong> ${psych}</p>
    <p><strong>Tiempo total en el test:</strong> ${tiempoTotalSeg} segundos</p>
  `;

  // Mostrar botón para continuar a microexpresiones
  btnContinuarMicro.classList.remove("hidden");
});

// --- Al hacer clic en "Continuar al análisis facial" ---
btnContinuarMicro.addEventListener("click", () => {
  seccionTest.classList.add("hidden");
  seccionMicro.classList.remove("hidden");
});

// --- Manejo cámara e imagen ---
// Variables para flujo cámara
let stream = null;

btnActivarCamara.addEventListener("click", async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    video.classList.remove("hidden");
    btnTomarFoto.classList.remove("hidden");
    btnActivarCamara.disabled = true;
  } catch (err) {
    alert("No se pudo activar la cámara: " + err.message);
  }
});

btnTomarFoto.addEventListener("click", () => {
  const contexto = canvas.getContext("2d");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  contexto.drawImage(video, 0, 0, canvas.width, canvas.height);
  imagenCapturada = canvas.toDataURL("image/png");
  resultadoMicro.classList.remove("hidden");
  resultadoMicro.innerHTML = "<p>Foto capturada.</p>";
  btnAnalizar.classList.remove("hidden");
});

btnSubirImagen.addEventListener("click", () => {
  inputImagen.click();
});

inputImagen.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    imagenCapturada = reader.result;
    resultadoMicro.classList.remove("hidden");
    resultadoMicro.innerHTML = "<p>Imagen cargada.</p>";
    btnAnalizar.classList.remove("hidden");
  };
  reader.readAsDataURL(file);
});

// --- Analizar microexpresiones llamando a tu API Render ---
btnAnalizar.addEventListener("click", async () => {
  if (!imagenCapturada) {
    alert("Primero debes capturar o subir una imagen.");
    return;
  }

  resultadoMicro.innerHTML = '<div class="analisis-loading"><span class="spinner"></span> Analizando microexpresiones...</div>';

  try {
    // Aquí reemplaza con tu URL real del endpoint Render
    const urlRender = 'https://darklnesapp-api.onrender.com/run/predict';

    const response = await fetch(urlRender, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ image: imagenCapturada })
    });

    const data = await response.json();

    if (data.error) {
      resultadoMicro.innerHTML = `<p>Error en análisis: ${data.error}</p>`;
      return;
    }

    // Suponiendo que la API devuelve un objeto con emoción principal y tiempos
    datosParticipante.emocion_princ = data.emocion_principal || "No detectada";
    datosParticipante.tiempos_reaccion = data.tiempos_reaccion || {};
    datosParticipante.images = [imagenCapturada]; // Guardamos imagen base64 para enviar

    resultadoMicro.innerHTML = `
      <h4>Resultado Análisis Microexpresiones</h4>
      <p><strong>Emoción principal detectada:</strong> ${datosParticipante.emocion_princ}</p>
      <p>¡Análisis completo!</p>
      <button id="btn-finalizar" class="btn-primary">Finalizar y guardar resultados</button>
    `;

    document.getElementById("btn-finalizar").addEventListener("click", guardarResultados);

  } catch (error) {
    resultadoMicro.innerHTML = `<p>Error en análisis: ${error.message}</p>`;
  }
});

// --- Guardar resultados en Google Apps Script ---
async function guardarResultados() {
  // Prepara datos para enviar
  const urlGAS = 'https://script.google.com/macros/s/AKfycbzOleFtkPXQLzj6withzWA21LBubHJkqB1HiCFq5hqNnOjOL7aSU44qMLHiWs0DSFb0Mg/exec';

  // Añadimos timestamp actual
  datosParticipante.timestemp = new Date().toISOString();

  // Convierte tiempos_reaccion (objeto) a JSON string para enviar (si existe)
  if(datosParticipante.tiempos_reaccion) {
    datosParticipante.tiempos_reaccion = JSON.stringify(datosParticipante.tiempos_reaccion);
  }

  // Convierte images array a JSON string
  if(datosParticipante.images) {
    datosParticipante.images = JSON.stringify(datosParticipante.images);
  }

  // Armar URL con parámetros
  const params = new URLSearchParams();
  for(const key in datosParticipante) {
    params.append(key, datosParticipante[key]);
  }
  // Enviamos acción para que Google Apps Script sepa qué hacer
  params.append("action", "guardarDatos");

  try {
    const res = await fetch(urlGAS + "?" + params.toString());
    const resJson = await res.json();

    if (resJson.status === "success") {
      alert("Resultados guardados correctamente. ¡Gracias por participar!");
      location.reload(); // Recarga para reiniciar todo
    } else {
      alert("Error al guardar resultados: " + resJson.message);
    }
  } catch (error) {
    alert("Error de conexión al guardar resultados: " + error.message);
  }
}

// --------------------------------------------
// ---------- PANEL INVESTIGADOR --------------
// --------------------------------------------

// Mostrar login cuando se clickea el botón investigador
btnInvestigador.addEventListener("click", () => {
  seccionParticipante.classList.add("hidden");
  investigadorLogin.classList.remove("hidden");
});

// Login investigador
formLogin.addEventListener("submit", (e) => {
  e.preventDefault();
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  // Cambia esto a tu usuario y contraseña reales o sistema seguro
  if (username === "investigador" && password === "1234") {
    investigadorLogin.classList.add("hidden");
    investigadorLista.classList.remove("hidden");
    cargarListaParticipantes();
  } else {
    loginError.classList.remove("hidden");
  }
});

btnLogout.addEventListener("click", () => {
  investigadorLista.classList.add("hidden");
  investigadorLogin.classList.remove("hidden");
  formLogin.reset();
  loginError.classList.add("hidden");
  seccionParticipante.classList.remove("hidden");
});

// Cargar datos desde Google Apps Script
async function cargarListaParticipantes() {
  listaParticipantes.innerHTML = "<p>Cargando participantes...</p>";
  try {
    const url = 'https://script.google.com/macros/s/AKfycbzOleFtkPXQLzj6withzWA21LBubHJkqB1HiCFq5hqNnOjOL7aSU44qMLHiWs0DSFb0Mg/exec?action=leerDatos';
    const res = await fetch(url);
    const data = await res.json();

    if(data && data.length > 0) {
      mostrarLista(data);
    } else {
      listaParticipantes.innerHTML = "<p>No hay participantes registrados.</p>";
    }
  } catch (error) {
    listaParticipantes.innerHTML = `<p>Error cargando datos: ${error.message}</p>`;
  }
}

// Mostrar lista
function mostrarLista(participantes) {
  listaParticipantes.innerHTML = "";
  participantes.forEach((p, idx) => {
    const div = document.createElement("div");
    div.className = "participante-card";
    div.innerHTML = `
      <div class="participante-header">
        <strong>${p.Participante}</strong> - Edad: ${p.edad} - Género: ${p.genero} - País: ${p.pais}
      </div>
    `;
    div.addEventListener("click", () => mostrarDetalleParticipante(p));
    listaParticipantes.appendChild(div);
  });
}

// Mostrar detalle participante con explicación
function mostrarDetalleParticipante(p) {
  investigadorLista.classList.add("hidden");
  investigadorDetalle.classList.remove("hidden");

  let imagesHtml = "";
  try {
    const imgs = JSON.parse(p.images || "[]");
    imagesHtml = imgs.map(url => `<img src="${url}" style="max-width:150px; margin:5px; border-radius:8px;">`).join("");
  } catch {
    imagesHtml = "<p>No hay imágenes disponibles.</p>";
  }

  detalleParticipante.innerHTML = `
    <h3>Participante: ${p.Participante}</h3>
    <p><strong>Edad:</strong> ${p.edad}</p>
    <p><strong>Género:</strong> ${p.genero}</p>
    <p><strong>País:</strong> ${p.pais}</p>
    <p><strong>Maquiavelismo (Mach):</strong> ${p.mach}</p>
    <p><strong>Narcisismo (Narc):</strong> ${p.narc}</p>
    <p><strong>Psicopatía (Psych):</strong> ${p.psych}</p>
    <p><strong>Tiempo total (seg):</strong> ${p.tiempo_total_seg}</p>
    <p><strong>Emoción principal:</strong> ${p.emocion_princ || "No detectada"}</p>
    <p><strong>Timestamp:</strong> ${p.timestemp}</p>

    <h4>Interpretación:</h4>
    <p>
      El participante muestra un nivel de maquiavelismo de ${p.mach}, narcisismo de ${p.narc} y psicopatía de ${p.psych}. 
      El tiempo total en el test fue de ${p.tiempo_total_seg} segundos. La emoción principal detectada en las microexpresiones fue "${p.emocion_princ || "no detectada"}".
      Estos resultados deben interpretarse considerando el contexto clínico y la validez de los tests utilizados.
    </p>

    <h4>Imágenes:</h4>
    <div>${imagesHtml}</div>

    <button id="btn-volver-lista" class="btn-primary">Volver a la lista</button>
  `;

  document.getElementById("btn-volver-lista").addEventListener("click", () => {
    investigadorDetalle.classList.add("hidden");
    investigadorLista.classList.remove("hidden");
  });
}

// --- Inicio ---
window.onload = () => {
  seccionTest.classList.add("hidden");
  seccionMicro.classList.add("hidden");
  investigadorLogin.classList.add("hidden");
  investigadorLista.classList.add("hidden");
  investigadorDetalle.classList.add("hidden");
  btnContinuarMicro.classList.add("hidden");
  resultadoSd3.classList.add("hidden");
  resultadoMicro.classList.add("hidden");
  seccionParticipante.classList.remove("hidden");
};
