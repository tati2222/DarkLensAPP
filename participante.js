// ========================================
// CONFIG — CONFIGURACIÓN DE ENDPOINTS
// ========================================
const RENDER_PREDICT_URL = "https://darklnesapp-api.onrender.com/run/predict"; 
const GOOGLE_SHEETS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbwm8kIl1h0Avas55eNI0dbiKj-MPCbuXyQp7ndsQYiDdmcsmDGYgyirgt2sorvOFLEZgA/exec";

// ========================================
// VARIABLES GLOBALES
// ========================================
const invertidos = [11, 15, 17, 20, 25];
let graficoSD3;
let resultadosSD3 = null;
let resultadosMicro = null;
let imagenCapturada = null;
let stream = null;

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
// GENERAR ITEMS DEL TEST
// ========================================
function generarItemsTest() {
    const form = document.getElementById('form-sd3');
    if (!form) {
        console.error('No se encontró el formulario SD3');
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
                ${[1, 2, 3, 4, 5].map(val => `
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
           
