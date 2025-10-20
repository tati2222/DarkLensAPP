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
let modeloMicroexpresiones = null;
let audioNarrativa = null;
let modeloCargado = false;
let modeloCargando = false;

// ========================================
// VARIABLES PARA TRACKING DE TIEMPOS
// ========================================
let tiemposRespuesta = {};
let tiempoInicioItem = {};
let itemActualVisible = null;
let testInicioTimestamp = null;

// Items del test SD3
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
// 🚀 PRECARGAR MODELO AL INICIAR PÁGINA
// ========================================
async function precargarModelo() {
  if (modeloCargando || modeloCargado) {
    console.log('⚠️ Modelo ya está cargando o cargado');
    return;
  }

  modeloCargando = true;

  try {
    console.log('🔄 Precargando modelo de IA optimizado...');
    
    // Crear indicador visual
    const indicator = document.createElement('div');
    indicator.id = 'modelo-loading-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #7f00ff 0%, #6c63ff 100%);
      color: white;
      padding: 12px 24px;
      border-radius: 25px;
      z-index: 9999;
      font-size: 0.95em;
      box-shadow: 0 4px 20px rgba(127, 0, 255, 0.4);
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 10px;
    `;
    indicator.innerHTML = '<span style="animation: spin 1s linear infinite;">⏳</span> Cargando modelo de IA...';
    
    // Agregar animación
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(indicator);

    // Asegurar que TensorFlow esté listo
    await tf.ready();
    console.log('✅ TensorFlow.js está listo');
    
    // Cargar modelo OPTIMIZADO desde tu carpeta model/
    const modelURL = "https://tati2222.github.io/DarkLens/model/model.json";
    
    modeloMicroexpresiones = await tf.loadLayersModel(modelURL);
    
    modeloCargado = true;
    modeloCargando = false;
    
    console.log('✅ Modelo optimizado cargado en segundo plano');
    console.log('📊 Input shape:', modeloMicroexpresiones.inputs[0].shape);
    console.log('📊 Output shape:', modeloMicroexpresiones.outputs[0].shape);
    
    // Cambiar indicador a "listo"
    indicator.style.background = 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)';
    indicator.innerHTML = '✅ Modelo listo';
    
    // Ocultar después de 3 segundos
    setTimeout(() => {
      indicator.style.transition = 'opacity 0.5s ease';
      indicator.style.opacity = '0';
      setTimeout(() => indicator.remove(), 500);
    }, 3000);
    
  } catch (error) {
    modeloCargando = false;
    modeloCargado = false;
    
    console.error('❌ Error al precargar modelo:', error);
    
    const indicator = document.getElementById('modelo-loading-indicator');
    if (indicator) {
      indicator.style.background = 'linear-gradient(135deg, #ff4444 0%, #cc0000 100%)';
      indicator.innerHTML = '⚠️ Error al cargar modelo';
      
      setTimeout(() => {
        indicator.style.transition = 'opacity 0.5s ease';
        indicator.style.opacity = '0';
        setTimeout(() => indicator.remove(), 500);
      }, 5000);
    }
  }
}

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
          console.log(`⏱️ Ítem ${itemNum} visible - iniciando contador`);
        }
      }
    });
  }, {
    threshold: 0.5
  });

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
  if (tiemposRespuesta[itemNum]) {
    return;
  }

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
    
    console.log(`✅ Ítem ${itemNum} respondido en ${(tiempoRespuesta / 1000).toFixed(2)}s`);
  } else {
    const tiempoDesdeInicio = Date.now() - testInicioTimestamp;
    tiemposRespuesta[itemNum] = {
      tiempo_ms: tiempoDesdeInicio,
      tiempo_segundos: (tiempoDesdeInicio / 1000).toFixed(2),
      timestamp_inicio: testInicioTimestamp,
      timestamp_respuesta: Date.now(),
      nota: 'Respondido antes de visualización completa'
    };
    
    console.log(`⚠️ Ítem ${itemNum} respondido antes de tracking completo`);
  }
}

// ========================================
// FORMULARIO DE DATOS BÁSICOS 
// ========================================
document.addEventListener("DOMContentLoaded", () => {
  // 🚀 INICIAR PRECARGA DEL MODELO
  precargarModelo();

  const formDatos = document.getElementById("form-datos-basicos");
  const seccionBienvenida = document.getElementById("seccion-bienvenida");
  const seccionTest = document.getElementById("seccion-test");

  if (!formDatos) {
    console.error("❌ No se encontró el formulario de datos básicos.");
    return;
  }

  formDatos.addEventListener("submit", (event) => {
    event.preventDefault();

    const consentimiento = formDatos.querySelector('input[name="consentimiento"]');
    if (!consentimiento || !consentimiento.checked) {
      alert("Debés aceptar el consentimiento para continuar.");
      return;
    }

    const nombre = formDatos.querySelector('input[name="nombre"]');
    const edad = formDatos.querySelector('input[name="edad"]');
    const genero = formDatos.querySelector('select[name="genero"]');
    const pais = formDatos.querySelector('input[name="pais"]');

    if (!nombre || !nombre.value.trim()) {
      alert("Por favor ingresá tu nombre.");
      nombre.focus();
      return;
    }

    if (!edad || !edad.value) {
      alert("Por favor ingresá tu edad.");
      edad.focus();
      return;
    }

    if (!genero || !genero.value) {
      alert("Por favor seleccioná tu género.");
      genero.focus();
      return;
    }

    if (!pais || !pais.value.trim()) {
      alert("Por favor ingresá tu país.");
      pais.focus();
      return;
    }

    generarItemsTest();

    if (seccionBienvenida) seccionBienvenida.classList.add("hidden");
    if (seccionTest) seccionTest.classList.remove("hidden");

    window.scrollTo({ top: 0, behavior: "smooth" });
    console.log("✅ Se cambió correctamente de bienvenida a test");
  });

  const formSD3 = document.getElementById('form-sd3');
  if (formSD3) {
    formSD3.addEventListener('submit', function(e) {
      e.preventDefault();
      calcularSD3();
    });
  }
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
      const firstRadio = document.querySelector(`input[name="item${i}"]`);
      if (firstRadio) {
        firstRadio.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
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
  
  const tiemposArray = Object.values(tiemposRespuesta).map(t => t.tiempo_ms);
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

  console.log('📊 Estadísticas de tiempo:', estadisticasTiempo);

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
  if (btnContinuar) {
    btnContinuar.classList.remove('hidden');
  }
}

// ========================================
// CALCULAR ESTADÍSTICAS DE TIEMPO
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
  const mediana = sorted.length % 2 === 0 
    ? (sorted[medio - 1] + sorted[medio]) / 2 
    : sorted[medio];
  
  const minimo = Math.min(...tiemposArray);
  const maximo = Math.max(...tiemposArray);
  
  const varianza = tiemposArray.reduce((acc, val) => {
    return acc + Math.pow(val - promedio, 2);
  }, 0) / tiemposArray.length;
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
          labels: {
            color: '#e0e0ff',
            font: { size: 14 },
            padding: 15
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return context.label + ': ' + context.parsed.toFixed(2);
            }
          }
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
      <p><strong>Maquiavelismo:</strong> Tu resultado muestra un ${interpretar(mach, "manipulación estratégica y cálculo interpersonal")}. Esto refleja tu tendencia a la planificación a largo plazo en las relaciones sociales.</p>
      <p><strong>Narcisismo:</strong> Tu resultado muestra un ${interpretar(narc, "autoimagen grandiosa y búsqueda de admiración")}. Esto indica tu nivel de confianza en ti mismo y necesidad de reconocimiento social.</p>
      <p><strong>Psicopatía:</strong> Tu resultado muestra un ${interpretar(psych, "impulsividad y búsqueda de sensaciones")}. Esto refleja tu tendencia a la espontaneidad y toma de riesgos.</p>
      <p style="margin-top: 20px; font-style: italic; color: #b0a0ff;">Recordá que estos resultados son parte de una investigación académica y no constituyen un diagnóstico clínico. Los rasgos medidos existen en un continuo y todas las personas los presentan en algún grado.</p>
    </div>
  `;
}

// ========================================
// CONTINUAR A MICROEXPRESIONES
// ========================================
document.addEventListener('DOMContentLoaded', () => {
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
});

// ========================================
// CÁMARA Y CAPTURA
// ========================================
document.addEventListener('DOMContentLoaded', () => {
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
        if (btnTomarFoto) btnTomarFoto.classList.remove('hidden');
      } catch(err) {
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
      
      imagenCapturada = canvas.toDataURL('image/jpeg', 0.8);
      
      video.classList.add('hidden');
      canvas.classList.remove('hidden');
      if (btnAnalizar) btnAnalizar.classList.remove('hidden');
      
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
      }
    });
  }

  if (btnSubirImagen && inputImagen) {
    btnSubirImagen.addEventListener('click', function() {
      inputImagen.click();
    });

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
              
              imagenCapturada = canvas.toDataURL('image/jpeg', 0.8);
              
              if (video) video.classList.add('hidden');
              canvas.classList.remove('hidden');
              if (btnAnalizar) btnAnalizar.classList.remove('hidden');
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
});

// ========================================
// ANÁLISIS DE MICROEXPRESIONES
// ========================================
async function analizarMicroexpresiones() {
  const resultadoDiv = document.getElementById('resultado-micro');
  if (!resultadoDiv) {
    console.error('No se encontró el div de resultados');
    return;
  }

  resultadoDiv.innerHTML = `
    <div class="analisis-loading">
      ${modeloCargado ? 'Analizando microexpresiones...' : 'Cargando modelo de IA...'}
    </div>`;
  resultadoDiv.classList.remove('hidden');

  try {
    // Si el modelo no está precargado, cargarlo ahora
    if (!modeloCargado) {
      console.log('⚠️ Modelo no precargado, cargando ahora...');
      await tf.ready();
      modeloMicroexpresiones = await tf.loadLayersModel(
  "https://tati2222.github.io/Lente-oscura/docs/modelo/modelo.json"
);

      modeloCargado = true;
      console.log('✅ Modelo cargado');
    }

    resultadoDiv.innerHTML = `
      <div class="analisis-loading">
        Analizando microexpresiones...
      </div>`;

    const canvas = document.getElementById('canvas');
    if (!canvas) throw new Error("No se encontró el canvas para analizar.");

    // Preprocesar imagen
    let tensor = tf.browser.fromPixels(canvas);
    console.log('📐 Forma original del tensor:', tensor.shape);
    
    tensor = tf.image.resizeBilinear(tensor, [224, 224]);
    tensor = tensor.toFloat().div(255.0);
    tensor = tensor.expandDims(0);
    
    console.log('📐 Forma final del tensor:', tensor.shape);

    // Realizar predicción
    const prediccion = await modeloMicroexpresiones.predict(tensor).data();
    tensor.dispose();

    if (!prediccion || prediccion.length < 8) {
      throw new Error("Predicción inválida");
    }

    resultadosMicro = {
      enojado: prediccion[0],
      desprecio: prediccion[1],
      disgusto: prediccion[2],
      miedo: prediccion[3],
      feliz: prediccion[4],
      otro: prediccion[5],
      triste: prediccion[6],
      sorprendido: prediccion[7]
    };

    console.log('✅ Análisis completado:', resultadosMicro);
    mostrarResultadoIntegrado();

  } catch (error) {
    console.error('❌ Error completo:', error);
    resultadoDiv.innerHTML = `
      <div class="resultado-box" style="border-color: #ff6384;">
        <h4>Error en el análisis</h4>
        <p>No se pudo realizar el análisis. Por favor intentá de nuevo.</p>
        <p style="font-size: 0.9em; color: #ff6384;">${error.message}</p>
        <button onclick="location.reload()" class="btn-primary" style="margin-top: 20px;">
          🔄 Recargar página
        </button>
      </div>
    `;
  }
}

// ========================================
// RESULTADO INTEGRADO CON VOZ Y GRÁFICO
// ========================================
function mostrarResultadoIntegrado() {
  if (!resultadosSD3 || !resultadosMicro) {
    alert('Faltan completar algunos pasos del análisis');
    return;
  }

  const seccionMicro = document.getElementById('seccion-micro');
  const seccionFinal = document.getElementById('seccion-final');
  
  if (seccionMicro) seccionMicro.classList.add('hidden');
  if (seccionFinal) seccionFinal.classList.remove('hidden');
  
  window.scrollTo({ top: 0, behavior: 'smooth' });

  const { mach, narc, psych } = resultadosSD3;
  const emocionesSorted = Object.entries(resultadosMicro).sort((a, b) => b[1] - a[1]);
  const emocionPrincipal = emocionesSorted[0][0];
  const emocionSecundaria = emocionesSorted[1][0];
  const intensidad = emocionesSorted[0][1];

  const narrativa = generarNarrativaIntegrada(mach, narc, psych, emocionPrincipal, intensidad);

  let html = `
    <div class="resultado-integrado">
      <div class="audio-controls">
        <button id="btn-reproducir-audio" class="btn-audio">
          🔊 Escuchar Análisis
        </button>
       <button id="btn-pausar-audio" class="btn-audio hidden">⏸️ Pausar</button>
      </div>
      <div id="narrativa-final">${narrativa}</div>
      <canvas id="grafico-emociones"></canvas>
    </div>
  `;

  const seccionFinal = document.getElementById('seccion-final');
  if (seccionFinal) seccionFinal.innerHTML = html;

  crearGraficoEmociones(resultadosMicro);

  // 🎧 Control del audio narrativo
  const btnReproducir = document.getElementById('btn-reproducir-audio');
  const btnPausar = document.getElementById('btn-pausar-audio');

  if (btnReproducir && btnPausar) {
    btnReproducir.addEventListener('click', () => {
      if (!audioNarrativa) {
        const narrador = new SpeechSynthesisUtterance(narrativa);
        narrador.lang = 'es-ES';
        narrador.rate = 1.05;
        window.speechSynthesis.speak(narrador);
        audioNarrativa = narrador;
      }
      btnReproducir.classList.add('hidden');
      btnPausar.classList.remove('hidden');
    });

    btnPausar.addEventListener('click', () => {
      window.speechSynthesis.cancel();
      btnPausar.classList.add('hidden');
      btnReproducir.classList.remove('hidden');
    });
  }
}

// ========================================
// FIN DEL ARCHIVO
// ========================================
