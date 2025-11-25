// ========================================
// CONFIGURACIÓN
// ========================================
const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbwfcPm38VaTFKJjEFXXO3c-x6r2HOBWmIW_4vbeOMZE-xvtbDhNF0-SH4MBGPwMLZHw2A/exec'; // 
const RENDER_URL = 'https://darklnesapp-api.onrender.com'; // Tu Streamlit
const RESEARCHER_PASSWORD = 'investigador2025'; // 
// URL de tu Google Apps Script WebApp (modificá por la tuya)
const API_URL = "https://script.google.com/macros/s/AKfycbzOleFtkPXQLzj6withzWA21LBubHJkqB1HiCFq5hqNnOjOL7aSU44qMLHiWs0DSFb0Mg/exec";

// Variables DOM
const btnInvestigador = document.getElementById("btn-investigador");
const seccionParticipante = document.getElementById("seccion-participante");
const seccionLogin = document.getElementById("investigador-login");
const seccionLista = document.getElementById("investigador-lista");
const seccionDetalle = document.getElementById("investigador-detalle");

const formDatosBasicos = document.getElementById("form-datos-basicos");
const formSD3 = document.getElementById("form-sd3");
const btnContinuarMicro = document.getElementById("btn-continuar-micro");

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const btnActivarCamara = document.getElementById("btn-activar-camara");
const btnTomarFoto = document.getElementById("btn-tomar-foto");
const btnSubirImagen = document.getElementById("btn-subir-imagen");
const inputImagen = document.getElementById("input-imagen");
const btnAnalizar = document.getElementById("btn-analizar");

const resultadoMicro = document.getElementById("resultado-micro");

const listaParticipantesDiv = document.getElementById("lista-participantes");
const detalleParticipanteDiv = document.getElementById("detalle-participante");
const btnLogout = document.getElementById("btn-logout");
const formLogin = document.getElementById("form-login");
const loginError = document.getElementById("login-error");

// Variables de estado
let participanteActual = null;
let tokenLogin = null;
let microImagenBase64 = null;
let tiemposRespuestas = {};
let tiempoInicioPregunta = null;

// Las 27 preguntas SD3 completas (traducción y versión en español adaptada)
const preguntasSD3 = [
  "Me gusta manipular a la gente para conseguir lo que quiero.",
  "Creo que soy especial y único.",
  "Me siento cómodo haciendo cosas que pueden lastimar a otros.",
  "A veces me siento superior a los demás.",
  "Disfruto siendo el centro de atención.",
  "No siento culpa cuando engaño a alguien.",
  "Prefiero hacer lo que me conviene, aunque dañe a otros.",
  "Me gusta tener control sobre los demás.",
  "Me molesta cuando no se me reconoce por mis logros.",
  "No me importa si las reglas me favorecen o no, las rompo si quiero.",
  "Me siento orgulloso de ser astuto y obtener ventaja.",
  "La mayoría de las personas son demasiado sensibles y fáciles de engañar.",
  "No dudo en aprovecharme de otros si eso me beneficia.",
  "Me gusta tener poder sobre los demás.",
  "A veces uso el engaño para obtener lo que quiero.",
  "Soy bueno en persuadir a otros para que hagan lo que deseo.",
  "No me arrepiento cuando hago daño emocional a alguien.",
  "Me gusta mostrar que soy superior intelectualmente.",
  "Creo que la mayoría de las personas son demasiado ingenuas.",
  "Puedo ser frío y calculador cuando es necesario.",
  "No suelo preocuparme por las consecuencias de mis acciones en otros.",
  "Disfruto planear y ejecutar estrategias para mi beneficio.",
  "Soy capaz de mentir sin sentir culpa.",
  "Me siento cómodo tomando riesgos que otros evitan.",
  "Creo que las reglas están hechas para romperse cuando conviene.",
  "A veces siento que soy diferente y mejor que la mayoría.",
  "No me importan las normas sociales si me limitan."
];

// ----------------------- FUNCIONES UTILES -----------------------
function mostrarSeccion(seccion) {
  seccionParticipante.classList.add("hidden");
  seccionLogin.classList.add("hidden");
  seccionLista.classList.add("hidden");
  seccionDetalle.classList.add("hidden");
  seccion.classList.remove("hidden");
}

// ----------------------- MANEJO FORMULARIO DATOS BASICOS -----------------------
formDatosBasicos.addEventListener("submit", e => {
  e.preventDefault();

  cargarPreguntasSD3();

  document.getElementById("seccion-bienvenida").classList.add("hidden");
  document.getElementById("seccion-test").classList.remove("hidden");
});

// ----------------------- CARGAR PREGUNTAS SD3 -----------------------
function cargarPreguntasSD3() {
  formSD3.innerHTML = "";
  tiemposRespuestas = {};
  tiempoInicioPregunta = performance.now();

  preguntasSD3.forEach((pregunta, idx) => {
    const item = document.createElement("div");
    item.className = "test-item";

    let opcionesHTML = '<div class="opciones">';
    for (let i = 1; i <= 5; i++) {
      opcionesHTML += `
        <input type="radio" id="p${idx}_r${i}" name="p${idx}" value="${i}" required>
        <label for="p${idx}_r${i}">${i}</label>
      `;
    }
    opcionesHTML += "</div>";

    item.innerHTML = `<p><strong>Item ${idx + 1}:</strong> ${pregunta}</p>${opcionesHTML}`;
    formSD3.appendChild(item);

    // Captura tiempo de respuesta
    item.querySelectorAll("input[type=radio]").forEach(input => {
      input.addEventListener("change", () => {
        const tiempoRespuesta = performance.now() - tiempoInicioPregunta;
        tiemposRespuestas[`p${idx}`] = Math.round(tiempoRespuesta);
        tiempoInicioPregunta = performance.now();

        if (formSD3.checkValidity()) {
          btnContinuarMicro.classList.remove("hidden");
        }
      });
    });
  });
}

// ----------------------- ENVIO RESULTADOS SD3 -----------------------
btnContinuarMicro.addEventListener("click", async () => {
  const respuestas = {};
  preguntasSD3.forEach((_, idx) => {
    const selected = formSD3.querySelector(`input[name="p${idx}"]:checked`);
    respuestas[`p${idx}`] = selected ? parseInt(selected.value) : null;
  });

  const formDataBasicos = new FormData(formDatosBasicos);
  const datosBasicos = Object.fromEntries(formDataBasicos.entries());

  const datosAGuardar = {
    nombre: datosBasicos.nombre,
    edad: datosBasicos.edad,
    genero: datosBasicos.genero,
    pais: datosBasicos.pais,
    fecha: new Date().toISOString(),
    resultadoSD3: respuestas,
    tiemposSD3: tiemposRespuestas,
    resultadoMicro: null
  };

  const exito = await guardarDatosParticipante(datosAGuardar);
  if (exito) {
    alert("Resultados SD3 guardados. Ahora podés continuar con el análisis de microexpresiones.");

    document.getElementById("seccion-test").classList.add("hidden");
    document.getElementById("seccion-micro").classList.remove("hidden");
  } else {
    alert("Error al guardar los datos. Intente nuevamente.");
  }
});

// ----------------------- GUARDAR DATOS PARTICIPANTE -----------------------
async function guardarDatosParticipante(datos) {
  try {
    const response = await fetch(GOOGLE_SHEETS_WEBAPP_URL, {
      method: "POST",
      body: JSON.stringify({ action: "guardar", data: datos }),
      headers: { "Content-Type": "application/json" }
    });
    const result = await response.json();
    return result.status === "success";
  } catch (error) {
    console.error("Error guardando datos:", error);
    return false;
  }
}

// ----------------------- CÁMARA Y CAPTURA DE FOTO -----------------------
let stream = null;

btnActivarCamara.addEventListener("click", async () => {
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = stream;
      video.classList.remove("hidden");
      btnTomarFoto.classList.remove("hidden");
      btnActivarCamara.disabled = true;
      inputImagen.value = null;
    } catch (error) {
      alert("No se pudo acceder a la cámara: " + error.message);
    }
  } else {
    alert("La cámara no está soportada en este navegador.");
  }
});

btnTomarFoto.addEventListener("click", () => {
  const ctx = canvas.getContext("2d");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  canvas.classList.remove("hidden");
  video.classList.add("hidden");
  btnAnalizar.classList.remove("hidden");

  microImagenBase64 = canvas.toDataURL("image/jpeg");
});

// ----------------------- SUBIR IMAGEN -----------------------
btnSubirImagen.addEventListener("click", () => {
  inputImagen.click();
});

inputImagen.addEventListener("change", () => {
  const file = inputImagen.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    microImagenBase64 = e.target.result;
    const img = new Image();
    img.onload = function () {
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      canvas.classList.remove("hidden");
      video.classList.add("hidden");
      btnAnalizar.classList.remove("hidden");
    };
    img.src = microImagenBase64;
  };
  reader.readAsDataURL(file);
});

// ----------------------- ANALIZAR MICROEXPRESIONES -----------------------
btnAnalizar.addEventListener("click", async () => {
  if (!microImagenBase64) {
    alert("Primero debés subir o tomar una imagen.");
    return;
  }

  resultadoMicro.innerHTML = '<div class="analisis-loading"><span class="spinner"></span> Analizando microexpresiones...</div>';
  resultadoMicro.classList.remove("hidden");

  try {
    const response = await fetch(API_MICROEXPRESIONES_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: microImagenBase64 })
    });

    if (!response.ok) throw new Error("Error en análisis microexpresiones, intente más tarde.");

    const data = await response.json();

    resultadoMicro.innerHTML = `
      <h4>Resultado de microexpresiones:</h4>
      <pre>${JSON.stringify(data, null, 2)}</pre>
    `;

    await actualizarResultadoMicro(data);

    alert("Análisis de microexpresiones guardado correctamente.");

  } catch (error) {
    console.error(error);
    resultadoMicro.innerHTML = '<p style="color: #ff6b6b;">Error al analizar microexpresiones.</p>';
  }
});

// ----------------------- ACTUALIZAR RESULTADO MICRO -----------------------
async function actualizarResultadoMicro(resultadoMicro) {
  try {
    const formDataBasicos = new FormData(formDatosBasicos);
    const datosBasicos = Object.fromEntries(formDataBasicos.entries());

    const response = await fetch(GOOGLE_SHEETS_WEBAPP_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "actualizar_micro",
        data: {
          nombre: datosBasicos.nombre,
          fecha: new Date().toISOString(),
          resultadoMicro
        }
      }),
      headers: { "Content-Type": "application/json" }
    });
    const result = await response.json();
    return result.status === "success";
  } catch (error) {
    console.error("Error actualizando resultado micro:", error);
    return false;
  }
}

// ----------------------- PANEL INVESTIGADOR -----------------------
btnInvestigador.addEventListener("click", () => {
  mostrarSeccion(seccionLogin);
});

formLogin.addEventListener("submit", e => {
  e.preventDefault();
  const user = formLogin.username.value.trim();
  const pass = formLogin.password.value.trim();

  if (user === "admin" && pass === "1234") {
    tokenLogin = "token_simulado";
    formLogin.reset();
    loginError.classList.add("hidden");
    cargarListaParticipantes();
    mostrarSeccion(seccionLista);
  } else {
    loginError.classList.remove("hidden");
  }
});

btnLogout.addEventListener("click", () => {
  tokenLogin = null;
  mostrarSeccion(seccionLogin);
});

// ----------------------- CARGAR LISTA PARTICIPANTES -----------------------
async function cargarListaParticipantes() {
  try {
    listaParticipantesDiv.innerHTML = "<p>Cargando participantes...</p>";
    const response = await fetch(GOOGLE_SHEETS_WEBAPP_URL + "?action=listar");
    const data = await response.json();

    if (data.status !== "success") {
      listaParticipantesDiv.innerHTML = "<p>Error al cargar datos.</p>";
      return;
    }

    if (!data.participantes || data.participantes.length === 0) {
      listaParticipantesDiv.innerHTML = "<p>No hay participantes registrados.</p>";
      return;
    }

    listaParticipantesDiv.innerHTML = "";
    data.participantes.forEach((p, idx) => {
      const card = document.createElement("div");
      card.className = "participante-card";
      card.innerHTML = `
        <div class="participante-header">
          <strong>${p.nombre} (${p.edad} años, ${p.genero})</strong>
          <button class="btn-primary btn-ver-detalle" data-index="${idx}">Ver detalle</button>
        </div>
      `;
      listaParticipantesDiv.appendChild(card);
    });

    document.querySelectorAll(".btn-ver-detalle").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.index);
        mostrarDetalleParticipante(data.participantes[idx]);
      });
    });
  } catch (error) {
    console.error("Error cargando lista:", error);
    listaParticipantesDiv.innerHTML = "<p>Error al cargar participantes.</p>";
  }
}

// ----------------------- MOSTRAR DETALLE PARTICIPANTE -----------------------
function mostrarDetalleParticipante(participante) {
  participanteActual = participante;
  mostrarSeccion(seccionDetalle);

  let html = `
    <div class="detalle-card">
      <h4>Datos Básicos</h4>
      <p><strong>Nombre:</strong> ${participante.nombre}</p>
      <p><strong>Edad:</strong> ${participante.edad}</p>
      <p><strong>Género:</strong> ${participante.genero}</p>
      <p><strong>País:</strong> ${participante.pais}</p>

      <h4>Resultados Test SD3</h4>
  `;

  if (participante.resultadoSD3 && participante.tiemposSD3) {
    html += "<ul>";
    Object.entries(participante.resultadoSD3).forEach(([item, score], i) => {
      const tiempo = participante.tiemposSD3[item] || "N/A";
      html += `<li>Item ${parseInt(i) + 1}: Puntaje: <strong>${score}</strong> - Tiempo de respuesta: <em>${tiempo} ms</em></li>`;
    });
    html += "</ul>";

    const valores = Object.values(participante.resultadoSD3);
    const promedio = valores.reduce((a, b) => a + b, 0) / valores.length;

    let tendencia = "Nivel moderado de rasgos oscuros.";
    if (promedio > 4) tendencia = "Tendencia alta en rasgos oscuros.";
    else if (promedio < 2) tendencia = "Tendencia baja en rasgos oscuros.";

    html += `<p><strong>Interpretación:</strong> ${tendencia}</p>`;
  } else {
    html += "<p>No hay resultados SD3 registrados.</p>";
  }

  html += `<h4>Resultados de Microexpresiones</h4>`;
  if (participante.resultadoMicro) {
    if (typeof participante.resultadoMicro === "string") {
      try {
        const objMicro = JSON.parse(participante.resultadoMicro);
        html += `<pre>${JSON.stringify(objMicro, null, 2)}</pre>`;
      } catch {
        html += `<pre>${participante.resultadoMicro}</pre>`;
      }
    } else {
      html += `<pre>${JSON.stringify(participante.resultadoMicro, null, 2)}</pre>`;
    }
    if (participante.resultadoMicro.explicacion) {
      html += `<p><strong>Interpretación:</strong> ${participante.resultadoMicro.explicacion}</p>`;
    }
  } else {
    html += "<p>No hay resultados de microexpresiones registrados.</p>";
  }

  html += "</div>";
  detalleParticipanteDiv.innerHTML = html;
}

// ----------------------- VOLVER A LISTA -----------------------
window.volverListaParticipantes = function () {
  mostrarSeccion(seccionLista);
};

// ----------------------- VOLVER AL INICIO -----------------------
window.volverAInicio = function () {
  mostrarSeccion(seccionParticipante);
  document.getElementById("seccion-bienvenida").classList.remove("hidden");
  document.getElementById("seccion-test").classList.add("hidden");
  document.getElementById("seccion-micro").classList.add("hidden");
};

// ----------------------- INICIO -----------------------
mostrarSeccion(seccionParticipante);
