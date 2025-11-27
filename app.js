/* ========================================
   CONFIG — ENDPOINTS & CONSTANTES
   ======================================== */
const RENDER_PREDICT_URL = "https://darklnesapp-api-1.onrender.com/run/predict";
const GOOGLE_SHEETS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbwm8kIl1h0Avas55eNI0dbiKj-MPCbuXyQp7ndsQYiDdmcsmDGYgyirgt2sorvOFLEZgA/exec";
const GOOGLE_SHEETS_READ_URL = GOOGLE_SHEETS_WEBAPP_URL; // endpoint para lectura si aplica
const PASSWORD_INVESTIGADOR = "investigador2025";

/* ========================================
   ESTADO GLOBAL
   ======================================== */
const invertidos = [11, 15, 17, 20, 25];
let tiemposRespuesta = {};
let tiempoInicioItem = {};
let testInicioTimestamp = null;
let imagenCapturada = null;
let stream = null;
let participantesData = [];
let participanteSeleccionado = null;

/* ========================================
   UTIL: dataURL -> Blob
   ======================================== */
function dataURLtoBlob(dataurl) {
  const arr = dataurl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new Blob([u8arr], { type: mime });
}

/* ========================================
   UTIL: estadísticas de tiempos
   ======================================== */
function calcularEstadisticasTiempo(tiemposArray) {
  if (!Array.isArray(tiemposArray) || tiemposArray.length === 0) {
    return {
      promedio_ms: 0, promedio_segundos: '0.00',
      mediana_ms: 0, mediana_segundos: '0.00',
      minimo_ms: 0, minimo_segundos: '0.00',
      maximo_ms: 0, maximo_segundos: '0.00',
      desviacion_estandar_ms: 0, desviacion_estandar_segundos: '0.00',
      total_items: 0
    };
  }
  const suma = tiemposArray.reduce((a,b) => a+b, 0);
  const promedio = suma / tiemposArray.length;
  const sorted = [...tiemposArray].sort((a,b) => a-b);
  const medio = Math.floor(sorted.length / 2);
  const mediana = sorted.length % 2 === 0 ? (sorted[medio-1] + sorted[medio]) / 2 : sorted[medio];
  const minimo = sorted[0];
  const maximo = sorted[sorted.length -1];
  const varianza = tiemposArray.reduce((acc,val) => acc + Math.pow(val - promedio, 2), 0) / tiemposArray.length;
  const desviacionEstandar = Math.sqrt(varianza);
  return {
    promedio_ms: Math.round(promedio),
    promedio_segundos: (promedio/1000).toFixed(2),
    mediana_ms: Math.round(mediana),
    mediana_segundos: (mediana/1000).toFixed(2),
    minimo_ms: minimo,
    minimo_segundos: (minimo/1000).toFixed(2),
    maximo_ms: maximo,
    maximo_segundos: (maximo/1000).toFixed(2),
    desviacion_estandar_ms: Math.round(desviacionEstandar),
    desviacion_estandar_segundos: (desviacionEstandar/1000).toFixed(2),
    total_items: tiemposArray.length
  };
}

/* ========================================
   SD3: items (texto) - mantener nombres de items
   ======================================== */
const itemsSD3 = [
  "No es prudente contar tus secretos.",
  "Me gusta usar manipulaciones ingeniosas para salirme con la mía.",
  "Hagas lo que hagas, debes conseguir que las personas importantes estén de tu lado.",
  "Evito el conflicto directo con los demás porque pueden serme útiles en el futuro.",
  "Es sabio guardar información que puedas usar en contra de otras personas más adelante.",
  "Debes esperar el momento oportuno para vengarme de las personas.",
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

/* ========================================
   GENERAR ITEMS SD3 (inserta en #form-sd3)
   ======================================== */
function generarItemsTest() {
  const form = document.getElementById('form-sd3');
  if (!form) return;
  form.innerHTML = '';
  itemsSD3.forEach((texto, idx) => {
    const num = idx + 1;
    const div = document.createElement('div');
    div.className = 'test-item';
    div.setAttribute('data-item', num);
    div.innerHTML = `
      <p><strong>${num}.</strong> ${texto}</p>
      <div class="opciones" role="radiogroup" aria-label="item-${num}">
        ${[1,2,3,4,5].map(v => `
          <input type="radio" id="item${num}_${v}" name="item${num}" value="${v}">
          <label for="item${num}_${v}">${v}</label>
        `).join('')}
      </div>
    `;
    form.appendChild(div);
  });

  // Botón enviar
  const btn = document.createElement('button');
  btn.type = 'submit';
  btn.className = 'btn-primary';
  btn.textContent = 'Enviar respuestas del test';
  form.appendChild(btn);
}

/* ========================================
   TRACKING TIEMPOS (IntersectionObserver + change)
   ======================================== */
function configurarTrackingTiempos() {
  tiemposRespuesta = {};
  tiempoInicioItem = {};

  const items = document.querySelectorAll('.test-item');
  if (!items || items.length === 0) return;

  // observer para detectar cuando el item entra en pantalla
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const itemDiv = entry.target;
        const itemNum = parseInt(itemDiv.getAttribute('data-item'));
        if (!tiempoInicioItem[itemNum]) {
          tiempoInicioItem[itemNum] = Date.now();
        }
      }
    });
  }, { threshold: 0.5 });

  items.forEach(it => observer.observe(it));

  // agregar listeners change a radios
  for (let i=1; i<=itemsSD3.length; i++) {
    const radios = document.querySelectorAll(`input[name="item${i}"]`);
    radios.forEach(r => {
      r.addEventListener('change', () => registrarTiempoRespuesta(i));
    });
  }
}

function registrarTiempoRespuesta(itemNum) {
  // si ya hay tiempo registrado no sobrescribimos
  if (tiemposRespuesta[itemNum]) return;

  const inicio = tiempoInicioItem[itemNum];
  const ahora = Date.now();
  if (inicio) {
    const lapso = ahora - inicio;
    tiemposRespuesta[itemNum] = {
      tiempo_ms: lapso,
      tiempo_segundos: (lapso/1000).toFixed(2),
      timestamp_inicio: inicio,
      timestamp_respuesta: ahora
    };
  } else {
    // fallback si no se registró inicio
    const desdeInicioTest = testInicioTimestamp ? (ahora - testInicioTimestamp) : 0;
    tiemposRespuesta[itemNum] = {
      tiempo_ms: desdeInicioTest,
      tiempo_segundos: (desdeInicioTest/1000).toFixed(2),
      timestamp_inicio: testInicioTimestamp,
      timestamp_respuesta: ahora,
      nota: 'respondido_sin_intersection'
    };
  }
}

/* ========================================
   CALCULAR SD3 - guardar y mostrar siguiente sección
   ======================================== */
function calcularSD3() {
  const respuestas = [];
  const respuestasObj = {};

  for (let i=1; i<=itemsSD3.length; i++) {
    const sel = document.querySelector(`input[name="item${i}"]:checked`);
    if (!sel) {
      alert(`Por favor respondé el ítem ${i}`);
      const primer = document.querySelector(`input[name="item${i}"]`);
      if (primer) primer.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    let val = parseInt(sel.value);
    if (invertidos.includes(i)) val = 6 - val;
    respuestas.push(val);
    respuestasObj[`item${i}`] = val;
  }

  const mean = arr => arr.reduce((a,b)=>a+b,0)/arr.length;
  const mach = parseFloat(mean(respuestas.slice(0,9)).toFixed(2));
  const narc = parseFloat(mean(respuestas.slice(9,18)).toFixed(2));
  const psych = parseFloat(mean(respuestas.slice(18,27)).toFixed(2));

  const testFinTimestamp = Date.now();
  const tiempoTotal = testFinTimestamp - (testInicioTimestamp || testFinTimestamp);
  const tiemposArray = Object.values(tiemposRespuesta).map(t => t?.tiempo_ms || 0);
  const estadisticasTiempo = calcularEstadisticasTiempo(tiemposArray);

  const resultadosSD3 = {
    mach, narc, psych,
    respuestas: respuestasObj,
    tiempos_respuesta: tiemposRespuesta,
    tiempo_total_ms: tiempoTotal,
    tiempo_total_segundos: (tiempoTotal/1000).toFixed(2),
    estadisticas_tiempo: estadisticasTiempo
  };

  // guardamos localmente por si hay que depurar
  sessionStorage.setItem('resultadosSD3', JSON.stringify(resultadosSD3));

  // enviar a Google Sheets (no bloqueante)
  enviarResultadosAGoogleSheets({ tipo: 'sd3', timestamp: new Date().toISOString(), persona: JSON.parse(sessionStorage.getItem('datos_personales')||'{}'), sd3: resultadosSD3 })
    .catch(err => console.warn('Error async enviando SD3:', err));

  // mostrar la sección de captura (seccion-micro) y ocultar la de test
  document.getElementById('seccion-test')?.classList.add('hidden');
  document.getElementById('seccion-micro')?.classList.remove('hidden');
  // inicializar captura (si no está)
  if (!window._capturaInicializada) {
    configurarCamaraYSubida();
    window._capturaInicializada = true;
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ========================================
   Envío a Google Sheets - tolerant to CORS / Apps Script
   - Intentamos POST normal; si falla por CORS, hacemos un POST con mode:'no-cors'
   - No asumimos que la respuesta JSON será accesible (Apps Script frecuentemente no permite CORS)
   ======================================== */
async function enviarResultadosAGoogleSheets(payload) {
  try {
    // Intentamos envio estándar (preferible)
    const res = await fetch(GOOGLE_SHEETS_WEBAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    // Si devolviera OK y JSON -> procesamos (pero no es imprescindible)
    try {
      if (res.ok) {
        console.log('Datos enviados (fetch regular).');
        return res.json().catch(()=>({ok:true}));
      }
    } catch(e){}
    // Si llega hasta aquí, devolvemos sin error
    return { ok: true };
  } catch (err) {
    // Si hay error (CORS, red), intentamos no-cors para que Apps Script reciba al menos el POST
    console.warn('Fetch normal falló (probable CORS). Intentando fallback no-cors...', err);
    try {
      await fetch(GOOGLE_SHEETS_WEBAPP_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      // no-cors no permite leer respuesta; igual consideramos que intentó enviarse
      return { ok: true, fallback: true };
    } catch (err2) {
      console.error('Fallback no-cors también falló:', err2);
      throw err2;
    }
  }
}

/* ========================================
   CAMARA Y SUBIDA DE IMAGEN
   - Maneja activación de cámara, tomar foto, seleccionar archivo y preparar imagenCapturada
   ======================================== */
function configurarCamaraYSubida() {
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const btnActivarCamara = document.getElementById('btn-activar-camara');
  const btnTomarFoto = document.getElementById('btn-tomar-foto');
  const btnSubirImagen = document.getElementById('btn-subir-imagen');
  const inputImagen = document.getElementById('input-imagen');
  const btnAnalizar = document.getElementById('btn-analizar');
  const previewContainer = document.getElementById('preview-container');
  const previewImg = document.getElementById('preview-img');

  // NUEVO: crear botón "Enviar Imagen"
  let btnEnviarImagen = document.getElementById('btn-enviar-imagen');
  if (!btnEnviarImagen) {
    btnEnviarImagen = document.createElement('button');
    btnEnviarImagen.id = 'btn-enviar-imagen';
    btnEnviarImagen.className = 'btn-primary';
    btnEnviarImagen.textContent = '📤 Enviar Imagen';
    btnEnviarImagen.style.display = 'none';
    btnEnviarImagen.style.marginTop = '15px';
    previewContainer?.appendChild(btnEnviarImagen);
  }

  // activar cámara
  if (btnActivarCamara) {
    btnActivarCamara.addEventListener('click', async function() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        if (video) {
          video.srcObject = stream;
          video.classList.remove('hidden');
          video.play();
        }
        btnActivarCamara.classList.add('hidden');
        if (btnTomarFoto) btnTomarFoto.classList.remove('hidden');
        document.getElementById('camera-placeholder')?.classList?.add('hidden');
      } catch (err) {
        alert('No se pudo acceder a la cámara. Podés subir una imagen desde tu dispositivo.');
        console.error('Error getUserMedia:', err);
      }
    });
  }

 // tomar foto
if (btnTomarFoto && video && canvas) {
  btnTomarFoto.addEventListener('click', function() {
    try {
      const ctx = canvas.getContext('2d');
      
      // LIMPIAR canvas anterior
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      imagenCapturada = canvas.toDataURL('image/jpeg', 0.9);

      // mostrar preview
      if (previewImg) { 
        previewImg.src = imagenCapturada; 
        previewImg.style.opacity = '1';
      }
      previewContainer?.classList.remove('hidden');

      video.classList.add('hidden');
      canvas.classList.remove('hidden');

      // MOSTRAR botón "Enviar Imagen" y rehabilitarlo
      if (btnEnviarImagen) {
        btnEnviarImagen.style.display = 'block';
        btnEnviarImagen.disabled = false;
        btnEnviarImagen.textContent = '📤 Enviar Imagen';
      }

      // ocultar botón analizar del investigador
      if (btnAnalizar) { btnAnalizar.classList.add('hidden'); }

      // stop camera
      if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
      
      console.log('✅ Foto tomada correctamente');
    } catch (err) {
      console.error('Error al tomar foto:', err);
      alert('No se pudo tomar la foto. Intentá subir una imagen.');
    }
  });
}

// subir imagen desde archivo
if (btnSubirImagen && inputImagen) {
  btnSubirImagen.addEventListener('click', () => {
    // LIMPIAR el input file para permitir seleccionar la misma imagen dos veces
    inputImagen.value = '';
    inputImagen.click();
  });
  
  inputImagen.addEventListener('change', function(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { 
      alert('Por favor subí un archivo de imagen válido.'); 
      return; 
    }

    // MOSTRAR INDICADOR DE CARGA
    if (previewContainer) {
      previewContainer.classList.remove('hidden');
      if (previewImg) {
        previewImg.src = '';
        previewImg.alt = 'Cargando imagen...';
        previewImg.style.opacity = '0.5';
      }
    }

    const reader = new FileReader();
    reader.onload = function(ev) {
      const img = new Image();
      img.onload = function() {
        if (!canvas) return;
        
        // LIMPIAR canvas anterior
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // REDIMENSIONAR canvas y dibujar nueva imagen
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        imagenCapturada = canvas.toDataURL('image/jpeg', 0.9);

        // MOSTRAR preview con la nueva imagen
        if (previewImg) {
          previewImg.src = imagenCapturada;
          previewImg.alt = 'Imagen cargada';
          previewImg.style.opacity = '1';
        }
        previewContainer?.classList.remove('hidden');

        if (video) video.classList.add('hidden');
        canvas.classList.remove('hidden');

        // MOSTRAR botón "Enviar Imagen" y rehabilitarlo
        if (btnEnviarImagen) {
          btnEnviarImagen.style.display = 'block';
          btnEnviarImagen.disabled = false;
          btnEnviarImagen.textContent = '📤 Enviar Imagen';
        }

        // ocultar botón analizar del investigador
        if (btnAnalizar) { btnAnalizar.classList.add('hidden'); }
        
        console.log('✅ Nueva imagen cargada correctamente');
      };
      
      img.onerror = function() {
        alert('Error cargando la imagen. Probá con otra.');
        if (previewImg) previewImg.style.opacity = '1';
      };
      
      img.src = ev.target.result;
    };
    
    reader.onerror = function() {
      alert('Error leyendo el archivo. Intentá nuevamente.');
      if (previewImg) previewImg.style.opacity = '1';
    };
    
    reader.readAsDataURL(file);
  });
}

  // NUEVO: evento click "Enviar Imagen" (para participantes)
  btnEnviarImagen?.addEventListener('click', async () => {
    if (!imagenCapturada) {
      alert('No hay imagen para enviar');
      return;
    }
    
    btnEnviarImagen.disabled = true;
    btnEnviarImagen.textContent = '⏳ Enviando...';

    try {
      // Preparar datos completos
      const persona = JSON.parse(sessionStorage.getItem('datos_personales') || '{}');
      const sd3 = JSON.parse(sessionStorage.getItem('resultadosSD3') || '{}');

      const payload = {
        tipo: 'imagen_participante',
        timestamp: new Date().toISOString(),
        persona,
        sd3,
        imagen: imagenCapturada
      };

      // Enviar a Google Sheets
      await enviarResultadosAGoogleSheets(payload);
      
      // Mostrar confirmación
      mostrarConfirmacionParticipante();
      
    } catch (err) {
      console.error('Error enviando imagen:', err);
      alert('Hubo un error al enviar la imagen. Por favor intentá nuevamente.');
      btnEnviarImagen.disabled = false;
      btnEnviarImagen.textContent = '📤 Enviar Imagen';
    }
  });

  // analizar -> solo para investigador (ya no se usa en flujo participante)
  if (btnAnalizar) {
    btnAnalizar.addEventListener('click', async () => {
      await analizarMicroexpresiones();
    });
  }
}
/* ========================================
   ANALIZAR: envío a Render + guardar en Google Sheets + mostrar confirmación
   ======================================== */
async function analizarMicroexpresiones() {
  const resultadoDiv = document.getElementById('resultado-micro');
  if (!resultadoDiv) return;

  resultadoDiv.classList.remove('hidden');
  resultadoDiv.innerHTML = `<div class="analisis-loading">🧠 Analizando microexpresiones...</div>`;
  
  try {
    // Obtener imagen del participante seleccionado (si estamos en panel investigador)
    let imagenParaAnalizar = imagenCapturada;
    
    if (participanteSeleccionado && participanteSeleccionado.imagen) {
      imagenParaAnalizar = participanteSeleccionado.imagen;
    }

    if (!imagenParaAnalizar || imagenParaAnalizar.length < 100) {
      throw new Error('No hay imagen válida para analizar.');
    }

    // Preparar FormData para Render
    const blob = dataURLtoBlob(imagenParaAnalizar);
    const formData = new FormData();
    formData.append('img', blob, 'foto.jpg');

    console.log('Enviando imagen a Render:', RENDER_PREDICT_URL);
    const res = await fetch(RENDER_PREDICT_URL, { method: 'POST', body: formData });
    
    if (!res.ok) {
      const texto = await res.text().catch(()=>'(sin texto)');
      throw new Error(`Error en Render (${res.status}): ${texto}`);
    }
    
    const json = await res.json();
    console.log('Respuesta Render:', json);

    // Normalizar resultado
    const resultadosMicro = {
      emociones: json.emociones || {},
      emocion_dominante: json.emocion_dominante || (json.dominante || 'Desconocida'),
      confianza: json.confianza || json.confidence || 0,
      facs: json.facs || [],
      sd3_micro: json.sd3 || {}
    };

    // Si estamos analizando desde el panel investigador
    if (participanteSeleccionado) {
      // Actualizar el participante seleccionado
      participanteSeleccionado.microexpresiones = resultadosMicro;
      
      // Actualizar en el array principal
      const idx = participantesData.findIndex(p => p.id === participanteSeleccionado.id);
      if (idx !== -1) {
        participantesData[idx].microexpresiones = resultadosMicro;
      }

      // Mostrar resultados en el panel
      mostrarMicroexpresionesInvestigador(resultadosMicro);
      mostrarFACSInvestigador(resultadosMicro);
      mostrarAnalisisIntegradoInvestigador(participanteSeleccionado);
      
      resultadoDiv.innerHTML = `
        <div class="confirmacion-final" style="text-align:center; padding:20px; background:rgba(127,0,255,0.1); border-radius:10px;">
          <h4 style="color:var(--accent);">✅ Análisis completado</h4>
          <p>Los resultados se actualizaron en las secciones correspondientes.</p>
        </div>
      `;
      
      // Guardar análisis en Sheets
      const payload = {
        tipo: 'analisis_investigador',
        timestamp: new Date().toISOString(),
        participante_id: participanteSeleccionado.id,
        microexpresiones: resultadosMicro
      };
      await enviarResultadosAGoogleSheets(payload).catch(err => 
        console.warn('Error guardando análisis:', err)
      );
      
    } else {
      // Flujo participante (no debería llegar aquí normalmente)
      sessionStorage.setItem('resultadosMicro', JSON.stringify(resultadosMicro));
      mostrarConfirmacionParticipante();
    }

  } catch (err) {
    console.error('Error en análisis:', err);
    resultadoDiv.innerHTML = `
      <div class="resultado-box" style="border-color: var(--error); background:rgba(255,0,0,0.05);">
        <h4>❌ Error en el análisis</h4>
        <p><strong>${err.message}</strong></p>
        <p style="font-size:0.9em; margin-top:10px; color:var(--text-secondary);">
          ${err.message.includes('Render') || err.message.includes('404') || err.message.includes('500') 
            ? '⚠️ El servicio de análisis puede estar inactivo. Verificá que Render esté funcionando.' 
            : 'Intentá nuevamente con otra imagen o verificá la conexión.'}
        </p>
        <div style="text-align:center; margin-top:20px;">
          <button class="btn-primary" onclick="location.reload()">🔄 Reintentar</button>
        </div>
      </div>
    `;
  }
}

/* ========================================
   Mostrar confirmación simple (participante)
   ======================================== */
function mostrarConfirmacionParticipante() {
  const resultadoDiv = document.getElementById('resultado-micro');
  if (!resultadoDiv) return;
  resultadoDiv.classList.remove('hidden');
  resultadoDiv.innerHTML = `
    <div class="confirmacion-final" style="text-align:center; padding:30px;">
      <h3 style="color: var(--accent);">¡Gracias por participar!</h3>
      <p style="margin:15px 0;">Tu imagen y tus respuestas han sido registradas correctamente para la investigación.</p>
      <div style="margin:20px 0;">
        <img src="${imagenCapturada || ''}" alt="Imagen subida" style="max-width:300px; border-radius:10px; border:2px solid var(--border);">
      </div>
     <div style="margin-top:20px; display:flex; gap:15px; justify-content:center; flex-wrap:wrap;">
        <button class="btn-primary" onclick="volverAlInicio()">🏠 Volver al inicio</button>
        <button class="btn-secondary" onclick="location.reload()">🔄 Nueva participación</button>
      </div>
    </div>
  `;
}

/* ========================================
   Volver al inicio (limpia sessionStorage parcial)
   ======================================== */
function volverAlInicio() {
  // Limpiar TODOS los datos
  sessionStorage.clear();
  
  // Resetear variables globales
  imagenCapturada = null;
  tiemposRespuesta = {};
  tiempoInicioItem = {};
  testInicioTimestamp = null;
  participanteSeleccionado = null;
  
  // Detener cámara si está activa
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  
  // Limpiar formularios
  const formDatos = document.getElementById('form-datos-basicos');
  if (formDatos) formDatos.reset();
  
  const formSD3 = document.getElementById('form-sd3');
  if (formSD3) formSD3.innerHTML = '';
  
  // Limpiar preview de imagen
  const previewImg = document.getElementById('preview-img');
  if (previewImg) previewImg.src = '';
  
  const previewContainer = document.getElementById('preview-container');
  if (previewContainer) previewContainer.classList.add('hidden');
  
  const canvas = document.getElementById('canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.classList.add('hidden');
  }
  
  const video = document.getElementById('video');
  if (video) {
    video.classList.add('hidden');
    video.srcObject = null;
  }
  
  // Resetear flag de inicialización
  window._capturaInicializada = false;
  
  // Mostrar solo la página de inicio
  document.getElementById('seccion-micro')?.classList.add('hidden');
  document.getElementById('seccion-bienvenida')?.classList.add('hidden');
  document.getElementById('seccion-test')?.classList.add('hidden');
  document.getElementById('pagina-inicio')?.classList.remove('hidden');
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
  console.log('✅ Aplicación reseteada');
}

/* ========================================
   INVESTIGADOR: carga y UI
   ======================================== */
async function cargarDatosParticipantes() {
  const listaDiv = document.getElementById('lista-participantes');
  if (listaDiv) listaDiv.innerHTML = '<p style="text-align:center; color:var(--text-secondary);">📡 Cargando datos desde Google Sheets...</p>';

  try {
    const resp = await fetch(GOOGLE_SHEETS_READ_URL + '?action=getAll');
    // intentar parsear JSON; si falla, fallback a demo
    const data = await resp.json();
    if (data && data.participantes && Array.isArray(data.participantes)) {
      participantesData = data.participantes;
    } else if (Array.isArray(data)) {
      // si el endpoint devuelve array directamente
      participantesData = data;
    } else {
      throw new Error('Formato inesperado de respuesta');
    }
  } catch (err) {
    console.warn('No se pudieron cargar participantes desde Google Sheets, usando demo:', err);
    participantesData = generarDatosEjemplo();
  }

  poblarListaInvestigador();
}

function generarDatosEjemplo() {
  return [
    {
      id: 1,
      timestamp: new Date().toISOString(),
      persona: { nombre: 'Participante Demo 1', edad: 28, genero: 'masculino', pais: 'Argentina' },
      sd3: { mach: 3.2, narc: 2.8, psych: 2.5, respuestas: {}, tiempos_respuesta: {}, tiempo_total_ms: 420000, estadisticas_tiempo: { promedio_segundos:'8.50', mediana_segundos:'7.20', minimo_segundos:'2.10', maximo_segundos:'18.50', desviacion_estandar_segundos:'3.40' } },
      microexpresiones: { emociones: { Felicidad: 0.45, Neutral: 0.30, Sorpresa: 0.15, Tristeza: 0.10 }, emocion_dominante: 'Felicidad', confianza: 0.85, facs: [{ codigo:'AU6', nombre:'Elevación mejillas', descripcion:'Indica sonrisa genuina' }] },
      imagen: null
    }
  ];
}

function poblarListaInvestigador() {
  const listaDiv = document.getElementById('lista-participantes');
  if (!listaDiv) return;
  if (!participantesData || participantesData.length === 0) {
    listaDiv.innerHTML = '<p style="text-align:center; color:var(--text-secondary);">No hay participantes registrados aún.</p>';
    return;
  }

  listaDiv.innerHTML = '';
  participantesData.forEach((p, idx) => {
    const fecha = new Date(p.timestamp).toLocaleString('es-AR');
    const item = document.createElement('div');
    item.className = 'content-box';
    item.style.margin = '10px';
    item.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
        <div>
          <strong>${p.persona?.nombre || 'Sin nombre'}</strong>
          <div style="color:var(--text-secondary); font-size:0.9em;">${fecha}</div>
        </div>
        <div style="display:flex; gap:10px;">
          <button class="btn-primary btn-ver" data-index="${idx}">Ver Resultados</button>
          <button class="btn-secondary btn-export" data-index="${idx}">Exportar</button>
        </div>
      </div>
    `;
    listaDiv.appendChild(item);
  });

  // event listeners
  document.querySelectorAll('#lista-participantes .btn-ver').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.getAttribute('data-index'));
      mostrarParticipanteEnPanel(idx);
    });
  });
  document.querySelectorAll('#lista-participantes .btn-export').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.getAttribute('data-index'));
      exportarParticipanteJson(idx);
    });
  });
}

function mostrarParticipanteEnPanel(idx) {
  participanteSeleccionado = participantesData[idx];
  if (!participanteSeleccionado) return;

  document.getElementById('seccion-investigador')?.classList.add('hidden');
  document.getElementById('seccion-resultados')?.classList.remove('hidden');

  mostrarInfoBasicaInvestigador(participanteSeleccionado);
  mostrarResultadosSD3Investigador(participanteSeleccionado.sd3);
  mostrarTiemposReaccionInvestigador(participanteSeleccionado.sd3);
  mostrarMicroexpresionesInvestigador(participanteSeleccionado.microexpresiones);
  mostrarFACSInvestigador(participanteSeleccionado.microexpresiones);
  mostrarAnalisisIntegradoInvestigador(participanteSeleccionado);
  mostrarImagenInvestigador(participanteSeleccionado);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function exportarParticipanteJson(idx) {
  const p = participantesData[idx];
  if (!p) return;
  const dataStr = JSON.stringify(p, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `participante_${p.id || idx}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ========== funciones UI investigadora (mismas que antes, robustas) ========== */
function mostrarInfoBasicaInvestigador(p) {
  const div = document.getElementById('info-participante');
  if (!div) return;
  const persona = p.persona || {};
  const fecha = new Date(p.timestamp).toLocaleString('es-AR');
  div.innerHTML = `
    <div class="info-grid">
      <div class="info-item"><strong>Nombre:</strong><p>${persona.nombre || 'N/A'}</p></div>
      <div class="info-item"><strong>Edad:</strong><p>${persona.edad || 'N/A'} años</p></div>
      <div class="info-item"><strong>Género:</strong><p>${persona.genero || 'N/A'}</p></div>
      <div class="info-item"><strong>País:</strong><p>${persona.pais || 'N/A'}</p></div>
      <div class="info-item"><strong>Fecha y hora:</strong><p>${fecha}</p></div>
      <div class="info-item"><strong>ID:</strong><p>#${p.id || 'N/A'}</p></div>
    </div>
  `;
}

function mostrarResultadosSD3Investigador(sd3) {
  const div = document.getElementById('resultados-sd3-detalle');
  if (!div) return;
  if (!sd3) { div.innerHTML = '<p>No hay datos SD3 disponibles.</p>'; return; }

  const interpretarNivel = (valor) => {
    if (valor <= 2.4) return { nivel: 'Bajo', color: '#4CAF50' };
    if (valor <= 3.4) return { nivel: 'Medio', color: '#ffce56' };
    return { nivel: 'Alto', color: '#ff6384' };
  };
  const mach = interpretarNivel(sd3.mach || 0);
  const narc = interpretarNivel(sd3.narc || 0);
  const psych = interpretarNivel(sd3.psych || 0);

  div.innerHTML = `
    <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(250px,1fr)); gap:20px;">
      <div style="padding:20px; background:rgba(255,99,132,0.1); border:2px solid #ff6384; border-radius:10px;">
        <h4 style="color:#ff6384;">🎭 Maquiavelismo</h4>
        <p style="font-size:2.5em; font-weight:bold; color:${mach.color};">${sd3.mach ?? 'N/A'}</p>
        <p style="color:var(--text-secondary);">Nivel: <strong style="color:${mach.color};">${mach.nivel}</strong></p>
      </div>
      <div style="padding:20px; background:rgba(54,162,235,0.1); border:2px solid #36a2eb; border-radius:10px;">
        <h4 style="color:#36a2eb;">👑 Narcisismo</h4>
        <p style="font-size:2.5em; font-weight:bold; color:${narc.color};">${sd3.narc ?? 'N/A'}</p>
        <p style="color:var(--text-secondary);">Nivel: <strong style="color:${narc.color};">${narc.nivel}</strong></p>
      </div>
      <div style="padding:20px; background:rgba(255,206,86,0.1); border:2px solid #ffce56; border-radius:10px;">
        <h4 style="color:#ffce56;">⚡ Psicopatía</h4>
        <p style="font-size:2.5em; font-weight:bold; color:${psych.color};">${sd3.psych ?? 'N/A'}</p>
        <p style="color:var(--text-secondary);">Nivel: <strong style="color:${psych.color};">${psych.nivel}</strong></p>
      </div>
    </div>
  `;

  // gráfico radar
  setTimeout(() => {
    const canvas = document.getElementById('grafico-sd3-resultados');
    if (!canvas) return;
    try { const old = Chart.getChart(canvas); if (old) old.destroy(); } catch(e){}
    new Chart(canvas, {
      type: 'radar',
      data: {
        labels: ['Maquiavelismo','Narcisismo','Psicopatía'],
        datasets: [{
          label: 'Perfil',
          data: [sd3.mach || 0, sd3.narc || 0, sd3.psych || 0],
          backgroundColor: 'rgba(127,0,255,0.15)',
          borderColor: '#7f00ff',
          borderWidth: 2,
          pointRadius:5
        }]
      },
      options: { responsive:true, scales: { r: { min:1, max:5, ticks:{ stepSize:1 } } } }
    });
  }, 100);
}

function mostrarTiemposReaccionInvestigador(sd3) {
  const div = document.getElementById('tiempos-detalle');
  if (!div) return;
  if (!sd3 || !sd3.estadisticas_tiempo) { div.innerHTML = '<p>No hay datos de tiempos disponibles.</p>'; return; }
  const stats = sd3.estadisticas_tiempo;
  div.innerHTML = `
    <div class="stats-mini">
      <div class="stat-mini"><div class="stat-mini-label">Tiempo Total</div><div class="stat-mini-value">${((sd3.tiempo_total_ms||0)/1000/60).toFixed(1)} min</div></div>
      <div class="stat-mini"><div class="stat-mini-label">Promedio</div><div class="stat-mini-value">${stats.promedio_segundos}s</div></div>
      <div class="stat-mini"><div class="stat-mini-label">Mediana</div><div class="stat-mini-value">${stats.mediana_segundos}s</div></div>
      <div class="stat-mini"><div class="stat-mini-label">Mínimo</div><div class="stat-mini-value">${stats.minimo_segundos}s</div></div>
      <div class="stat-mini"><div class="stat-mini-label">Máximo</div><div class="stat-mini-value">${stats.maximo_segundos}s</div></div>
      <div class="stat-mini"><div class="stat-mini-label">Desv. estándar</div><div class="stat-mini-value">${stats.desviacion_estandar_segundos}s</div></div>
    </div>
  `;

  // gráfico de tiempos por ítem
  if (sd3.tiempos_respuesta && Object.keys(sd3.tiempos_respuesta).length > 0) {
    setTimeout(() => {
      const tiempos = sd3.tiempos_respuesta;
      const items = Object.keys(tiempos).map(k => parseInt(k)).sort((a,b) => a-b);
      const valores = items.map(i => parseFloat(tiempos[i].tiempo_segundos));
      const canvas = document.getElementById('grafico-tiempos');
      if (!canvas) return;
      try { const old = Chart.getChart(canvas); if (old) old.destroy(); } catch(e){}
      new Chart(canvas, {
        type: 'line',
        data: { labels: items, datasets: [{ label:'Tiempo (segundos)', data: valores, borderColor:'#667eea', backgroundColor:'rgba(102,126,234,0.12)', fill:true }] },
        options: { responsive:true }
      });
    }, 100);
  }
}

function mostrarMicroexpresionesInvestigador(micro) {
  const div = document.getElementById('microexpresiones-detalle');
  if (!div) return;
  if (!micro || !micro.emociones) { div.innerHTML = '<p>No hay datos de microexpresiones.</p>'; return; }

  const dominante = micro.emocion_dominante || 'Desconocida';
  const confianza = (micro.confianza || 0) * 100;

  div.innerHTML = `
    <div style="text-align:center; margin-bottom:20px; padding:20px; border-radius:12px;">
      <h4 style="color:#c080ff;">Emoción dominante</h4>
      <p style="font-size:1.6em; color:#7f00ff; font-weight:700;">${dominante}</p>
      <p style="color:var(--text-secondary);">Confianza: ${confianza.toFixed(1)}%</p>
    </div>
    <h4 style="text-align:center; margin-bottom:12px;">Distribución de emociones</h4>
  `;

  const emociones = Object.entries(micro.emociones).sort((a,b)=> b[1]-a[1]);
  emociones.forEach(([emocion, valor]) => {
    const percentage = (valor*100).toFixed(1);
    div.innerHTML += `
      <div class="emotion-bar"><div class="emotion-label"><strong>${emocion}</strong><span>${percentage}%</span></div>
      <div class="bar-container"><div class="bar-fill" style="width:${percentage}%">${percentage}%</div></div></div>
    `;
  });

  setTimeout(() => {
    const canvas = document.getElementById('grafico-emociones');
    if (!canvas) return;
    try { const old = Chart.getChart(canvas); if (old) old.destroy(); } catch(e){}
    new Chart(canvas, {
      type: 'doughnut',
      data: { labels: Object.keys(micro.emociones), datasets: [{ data: Object.values(micro.emociones).map(v=> (v*100).toFixed(1)), backgroundColor: ['#ff6384','#36a2eb','#ffce56','#4bc0c0','#9966ff','#ff9f40'] }] },
      options: { responsive:true }
    });
  }, 120);
}

function mostrarFACSInvestigador(micro) {
  const div = document.getElementById('facs-detalle');
  if (!div) return;
  if (!micro || !micro.facs || micro.facs.length === 0) { div.innerHTML = '<p>No se detectaron unidades FACS.</p>'; return; }
  div.innerHTML = '<div style="display:grid; gap:12px;">';
  micro.facs.forEach(au => {
    div.innerHTML += `<div class="info-item"><h4 style="margin:0 0 6px 0;">${au.nombre || au.codigo}</h4><p style="color:#888; margin:0 0 6px 0;"><strong>Código:</strong> ${au.codigo}</p><p style="margin:0;">${au.descripcion || ''}</p></div>`;
  });
  div.innerHTML += '</div>';
}

function mostrarAnalisisIntegradoInvestigador(p) {
  const div = document.getElementById('analisis-final');
  if (!div) return;
  const sd3 = p.sd3 || {};
  const micro = p.microexpresiones || {};
  const nivel = (v) => v > 3.4 ? 'alto' : v > 2.4 ? 'medio' : 'bajo';
  div.innerHTML = `
    <p><strong>Perfil de Personalidad:</strong> Maquiavelismo <strong>${nivel(sd3.mach||0)}</strong>, Narcisismo <strong>${nivel(sd3.narc||0)}</strong>, Psicopatía <strong>${nivel(sd3.psych||0)}</strong>.</p>
    <p><strong>Expresión Emocional:</strong> ${micro.emocion_dominante || 'no determinada'} (confianza ${(micro.confianza||0)*100}%).</p>
    <p><strong>Tiempo de Respuesta:</strong> ${(sd3.tiempo_total_ms||0)/1000/60} min, promedio ${sd3.estadisticas_tiempo?.promedio_segundos || 'N/A'}s por ítem.</p>
  `;
}

function mostrarImagenInvestigador(p) {
  const div = document.getElementById('imagen-participante');
  if (!div) return;
  if (p.imagen) {
    div.innerHTML = `<img src="${p.imagen}" alt="Foto participante" style="max-width:100%; max-height:500px; border-radius:10px;">`;
  } else {
    div.innerHTML = '<p>No hay imagen disponible.</p>';
  }
}

/* ========================================
   INICIALIZACIÓN GLOBAL: listeners principales
   ======================================== */
document.addEventListener('DOMContentLoaded', () => {
  // ✅ AGREGAR ESTO AQUÍ - Limpiar sesión al inicio
  sessionStorage.clear();
  imagenCapturada = null;
  tiemposRespuesta = {};
  tiempoInicioItem = {};
  testInicioTimestamp = null;
  console.log('✅ Sesión limpiada al cargar la página');
  
  // botones inicio
  const btnParticipante = document.querySelector('#card-participante .btn-primary');
  const btnInvestigador = document.querySelector('#card-investigador .btn-primary');
  // botones inicio
  const btnParticipante = document.querySelector('#card-participante .btn-primary');
  const btnInvestigador = document.querySelector('#card-investigador .btn-primary');
 btnParticipante?.addEventListener('click', () => {
    // Limpiar todo antes de empezar
    sessionStorage.clear();
    imagenCapturada = null;
    tiemposRespuesta = {};
    tiempoInicioItem = {};
    testInicioTimestamp = null;
    window._capturaInicializada = false;
    
    const formDatos = document.getElementById('form-datos-basicos');
    if (formDatos) formDatos.reset();
    
    console.log('✅ Nueva participación iniciada');
    
    document.getElementById('pagina-inicio')?.classList.add('hidden');
    document.getElementById('seccion-bienvenida')?.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  btnInvestigador?.addEventListener('click', () => {
    document.getElementById('pagina-inicio')?.classList.add('hidden');
    document.getElementById('seccion-login')?.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // form datos básicos -> inicia test
  const formDatos = document.getElementById('form-datos-basicos');
  formDatos?.addEventListener('submit', (e) => {
    e.preventDefault();
    const consentimiento = formDatos.querySelector('input[name="consentimiento"]');
    if (!consentimiento || !consentimiento.checked) {
      alert('Debés aceptar el consentimiento para continuar.');
      return;
    }
    const nombre = formDatos.querySelector('input[name="nombre"]').value.trim();
    const edad = formDatos.querySelector('input[name="edad"]').value;
    const genero = formDatos.querySelector('select[name="genero"]').value;
    const pais = formDatos.querySelector('input[name="pais"]').value.trim();
    if (!nombre || !edad || !genero || !pais) { alert('Completá todos los datos personales requeridos.'); return; }

    // guardar persona
    const persona = { nombre, edad, genero, pais };
    sessionStorage.setItem('datos_personales', JSON.stringify(persona));
    testInicioTimestamp = Date.now();
    generarItemsTest();
    // dejamos un pequeño timeout para que el DOM inserte los elementos antes de configurar tracking
    setTimeout(() => configurarTrackingTiempos(), 50);

    // mostrar test
    document.getElementById('seccion-bienvenida')?.classList.add('hidden');
    document.getElementById('seccion-test')?.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // interceptamos el submit generado en generarItemsTest()
  const formSD3 = document.getElementById('form-sd3');
  formSD3?.addEventListener('submit', (e) => { e.preventDefault(); calcularSD3(); });

  // login investigador
  const btnLoginInv = document.getElementById('btn-login-investigador');
  const inputPasswordInv = document.getElementById('password-investigador');
  btnLoginInv?.addEventListener('click', () => {
    const pw = inputPasswordInv?.value?.trim() || '';
    if (pw === PASSWORD_INVESTIGADOR) {
      document.getElementById('seccion-login')?.classList.add('hidden');
      document.getElementById('seccion-investigador')?.classList.remove('hidden');
      cargarDatosParticipantes();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      alert('❌ Contraseña incorrecta');
      if (inputPasswordInv) inputPasswordInv.value = '';
    }
  });

  // botones volver y navegación del panel
  document.getElementById('btn-volver-inicio-2')?.addEventListener('click', () => {
    document.getElementById('seccion-login')?.classList.add('hidden');
    document.getElementById('pagina-inicio')?.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  document.getElementById('btn-volver-login')?.addEventListener('click', () => {
    document.getElementById('seccion-investigador')?.classList.add('hidden');
    document.getElementById('seccion-login')?.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  document.getElementById('btn-volver-panel')?.addEventListener('click', () => {
    document.getElementById('seccion-resultados')?.classList.add('hidden');
    document.getElementById('seccion-investigador')?.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // inicialización perezosa de cámara si se entra a la sección de micro (por click de navegación)
  // Si preferís inicializar siempre, mové configurarCamaraYSubida() acá.
});

/* ========================================
   FIN DEL ARCHIVO
   ======================================== */
