// ========================================
// CONFIGURACIÓN
// ========================================
const PASSWORD_INVESTIGADOR = "DarkLness2024"; // ⚠️ Cambiá esta contraseña
const GOOGLE_SHEETS_READ_URL = "https://script.google.com/macros/s/AKfycbwm8kIl1h0Avas55eNI0dbiKj-MPCbuXyQp7ndsQYiDdmcsmDGYgyirgt2sorvOFLEZgA/exec";

let participantesData = [];
let participanteSeleccionado = null;

// ========================================
// LOGIN
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    const formLogin = document.getElementById('form-login');
    
    // Verificar si ya está logueado
    if (sessionStorage.getItem('investigador_logged') === 'true') {
        mostrarPanel();
    }
    
    if (formLogin) {
        formLogin.addEventListener('submit', (e) => {
            e.preventDefault();
            const password = document.getElementById('password').value;
            
            if (password === PASSWORD_INVESTIGADOR) {
                sessionStorage.setItem('investigador_logged', 'true');
                mostrarPanel();
            } else {
                alert('❌ Contraseña incorrecta');
                document.getElementById('password').value = '';
            }
        });
    }
});

function mostrarPanel() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('panel-investigador').classList.remove('hidden');
    cargarDatosParticipantes();
}

function cerrarSesion() {
    sessionStorage.removeItem('investigador_logged');
    window.location.reload();
}

// ========================================
// CARGAR DATOS DE GOOGLE SHEETS
// ========================================
async function cargarDatosParticipantes() {
    const statsDiv = document.getElementById('stats-generales');
    statsDiv.innerHTML = '<p>📡 Cargando datos desde Google Sheets...</p>';

    try {
        // Intentar cargar desde Google Sheets
        const response = await fetch(GOOGLE_SHEETS_READ_URL + '?action=getAll');
        const data = await response.json();
        
        if (data && data.participantes) {
            participantesData = data.participantes;
        } else {
            throw new Error('No se recibieron datos');
        }
    } catch (error) {
        console.warn('No se pudieron cargar datos de Google Sheets:', error);
        // Usar datos de ejemplo para demostración
        participantesData = generarDatosEjemplo();
    }

    mostrarEstadisticasGenerales();
    poblarSelectorParticipantes();
}

function generarDatosEjemplo() {
    // Datos de ejemplo para testing
    return [
        {
            id: 1,
            timestamp: new Date().toISOString(),
            persona: { nombre: 'Participante Demo 1', edad: 28, genero: 'masculino', pais: 'Argentina' },
            sd3: {
                mach: 3.2,
                narc: 2.8,
                psych: 2.5,
                respuestas: {},
                tiempos_respuesta: {},
                tiempo_total_ms: 420000,
                estadisticas_tiempo: {
                    promedio_segundos: '8.50',
                    mediana_segundos: '7.20',
                    minimo_segundos: '2.10',
                    maximo_segundos: '18.50',
                    desviacion_estandar_segundos: '3.40'
                }
            },
            microexpresiones: {
                emociones: { 'Felicidad': 0.45, 'Neutral': 0.30, 'Sorpresa': 0.15, 'Tristeza': 0.10 },
                emocion_dominante: 'Felicidad',
                confianza: 0.85,
                facs: [
                    { codigo: 'AU6', nombre: 'Elevación mejillas', descripcion: 'Indica sonrisa genuina' },
                    { codigo: 'AU12', nombre: 'Comisura labial hacia arriba', descripcion: 'Sonrisa' }
                ]
            }
        },
        {
            id: 2,
            timestamp: new Date(Date.now() - 86400000).toISOString(),
            persona: { nombre: 'Participante Demo 2', edad: 35, genero: 'femenino', pais: 'Argentina' },
            sd3: {
                mach: 2.1,
                narc: 3.5,
                psych: 1.8,
                respuestas: {},
                tiempos_respuesta: {},
                tiempo_total_ms: 380000,
                estadisticas_tiempo: {
                    promedio_segundos: '6.80',
                    mediana_segundos: '6.00',
                    minimo_segundos: '1.50',
                    maximo_segundos: '15.20',
                    desviacion_estandar_segundos: '2.90'
                }
            },
            microexpresiones: {
                emociones: { 'Neutral': 0.50, 'Felicidad': 0.25, 'Tristeza': 0.15, 'Miedo': 0.10 },
                emocion_dominante: 'Neutral',
                confianza: 0.78,
                facs: [
                    { codigo: 'AU1', nombre: 'Elevación parte interna ceja', descripcion: 'Indica preocupación leve' }
                ]
            }
        }
    ];
}

// ========================================
// ESTADÍSTICAS GENERALES
// ========================================
function mostrarEstadisticasGenerales() {
    const div = document.getElementById('stats-generales');
    const total = participantesData.length;
    
    if (total === 0) {
        div.innerHTML = '<p>No hay participantes registrados aún.</p>';
        return;
    }

    const promedioMach = (participantesData.reduce((sum, p) => sum + (p.sd3?.mach || 0), 0) / total).toFixed(2);
    const promedioNarc = (participantesData.reduce((sum, p) => sum + (p.sd3?.narc || 0), 0) / total).toFixed(2);
    const promedioPsych = (participantesData.reduce((sum, p) => sum + (p.sd3?.psych || 0), 0) / total).toFixed(2);

    const generos = participantesData.reduce((acc, p) => {
        acc[p.persona?.genero || 'no especificado'] = (acc[p.persona?.genero] || 0) + 1;
        return acc;
    }, {});

    div.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px;">
            <div style="text-align: center; padding: 20px; background: rgba(102, 126, 234, 0.1); border-radius: 10px;">
                <p style="color: var(--text-secondary);">Total Participantes</p>
                <p style="font-size: 2.5em; font-weight: bold; color: var(--primary);">${total}</p>
            </div>
            <div style="text-align: center; padding: 20px; background: rgba(255, 99, 132, 0.1); border-radius: 10px;">
                <p style="color: var(--text-secondary);">Maquiavelismo</p>
                <p style="font-size: 2.5em; font-weight: bold; color: #ff6384;">${promedioMach}</p>
            </div>
            <div style="text-align: center; padding: 20px; background: rgba(54, 162, 235, 0.1); border-radius: 10px;">
                <p style="color: var(--text-secondary);">Narcisismo</p>
                <p style="font-size: 2.5em; font-weight: bold; color: #36a2eb;">${promedioNarc}</p>
            </div>
            <div style="text-align: center; padding: 20px; background: rgba(255, 206, 86, 0.1); border-radius: 10px;">
                <p style="color: var(--text-secondary);">Psicopatía</p>
                <p style="font-size: 2.5em; font-weight: bold; color: #ffce56;">${promedioPsych}</p>
            </div>
        </div>

        <div style="padding: 20px; background: rgba(102, 126, 234, 0.05); border-radius: 10px;">
            <h4 style="margin-bottom: 15px;">Distribución por género:</h4>
            ${Object.entries(generos).map(([gen, cant]) => `
                <p><strong>${gen}:</strong> ${cant} (${((cant/total)*100).toFixed(1)}%)</p>
            `).join('')}
        </div>
    `;
}

// ========================================
// SELECTOR DE PARTICIPANTES
// ========================================
function poblarSelectorParticipantes() {
    const select = document.getElementById('select-participante');
    select.innerHTML = '<option value="">-- Seleccioná un participante --</option>';
    
    participantesData.forEach((p, index) => {
        const fecha = new Date(p.timestamp).toLocaleDateString('es-AR');
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${p.persona?.nombre || 'Sin nombre'} - ${fecha}`;
        select.appendChild(option);
    });
}

// ========================================
// CARGAR DATOS DE PARTICIPANTE
// ========================================
function cargarParticipante() {
    const select = document.getElementById('select-participante');
    const index = parseInt(select.value);
    
    if (isNaN(index)) {
        alert('Seleccioná un participante primero');
        return;
    }

    participanteSeleccionado = participantesData[index];
    document.getElementById('datos-participante').classList.remove('hidden');
    
    mostrarInfoBasica(participanteSeleccionado);
    mostrarResultadosSD3(participanteSeleccionado.sd3);
    mostrarTiemposReaccion(participanteSeleccionado.sd3);
    mostrarMicroexpresiones(participanteSeleccionado.microexpresiones);
    mostrarFACS(participanteSeleccionado.microexpresiones);
    mostrarAnalisisIntegrado(participanteSeleccionado);
    mostrarImagen(participanteSeleccionado);

    // Scroll suave
    document.getElementById('datos-participante').scrollIntoView({ behavior: 'smooth' });
}

// ========================================
// MOSTRAR INFORMACIÓN BÁSICA
// ========================================
function mostrarInfoBasica(p) {
    const div = document.getElementById('info-basica');
    const persona = p.persona || {};
    const fecha = new Date(p.timestamp).toLocaleString('es-AR');

    div.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
            <div>
                <p style="color: var(--primary); font-weight: bold;">Nombre:</p>
                <p>${persona.nombre || 'N/A'}</p>
            </div>
            <div>
                <p style="color: var(--primary); font-weight: bold;">Edad:</p>
                <p>${persona.edad || 'N/A'} años</p>
            </div>
            <div>
                <p style="color: var(--primary); font-weight: bold;">Género:</p>
                <p>${persona.genero || 'N/A'}</p>
            </div>
            <div>
                <p style="color: var(--primary); font-weight: bold;">País:</p>
                <p>${persona.pais || 'N/A'}</p>
            </div>
            <div>
                <p style="color: var(--primary); font-weight: bold;">Fecha y hora:</p>
                <p>${fecha}</p>
            </div>
            <div>
                <p style="color: var(--primary); font-weight: bold;">ID:</p>
                <p>#${p.id || 'N/A'}</p>
            </div>
        </div>
    `;
}

// ========================================
// RESULTADOS SD3
// ========================================
function mostrarResultadosSD3(sd3) {
    const div = document.getElementById('resultados-sd3');
    if (!sd3) {
        div.innerHTML = '<p>No hay datos SD3 disponibles.</p>';
        return;
    }

    const interpretarNivel = (valor) => {
        if (valor <= 2.4) return { nivel: 'Bajo', color: '#4CAF50' };
        if (valor <= 3.4) return { nivel: 'Medio', color: '#ffce56' };
        return { nivel: 'Alto', color: '#ff6384' };
    };

    const mach = interpretarNivel(sd3.mach);
    const narc = interpretarNivel(sd3.narc);
    const psych = interpretarNivel(sd3.psych);

    div.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
            <div style="padding: 20px; background: rgba(255, 99, 132, 0.1); border: 2px solid #ff6384; border-radius: 10px;">
                <h4 style="color: #ff6384;">🎭 Maquiavelismo</h4>
                <p style="font-size: 2.5em; font-weight: bold; color: ${mach.color};">${sd3.mach}</p>
                <p style="color: var(--text-secondary);">Nivel: <strong style="color: ${mach.color};">${mach.nivel}</strong></p>
            </div>
            <div style="padding: 20px; background: rgba(54, 162, 235, 0.1); border: 2px solid #36a2eb; border-radius: 10px;">
                <h4 style="color: #36a2eb;">👑 Narcisismo</h4>
                <p style="font-size: 2.5em; font-weight: bold; color: ${narc.color};">${sd3.narc}</p>
                <p style="color: var(--text-secondary);">Nivel: <strong style="color: ${narc.color};">${narc.nivel}</strong></p>
            </div>
            <div style="padding: 20px; background: rgba(255, 206, 86, 0.1); border: 2px solid #ffce56; border-radius: 10px;">
                <h4 style="color: #ffce56;">⚡ Psicopatía</h4>
                <p style="font-size: 2.5em; font-weight: bold; color: ${psych.color};">${sd3.psych}</p>
                <p style="color: var(--text-secondary);">Nivel: <strong style="color: ${psych.color};">${psych.nivel}</strong></p>
            </div>
        </div>
    `;

    // Gráfico radar
    const canvas = document.getElementById('grafico-sd3-investigador');
    if (canvas) {
        // Destruir gráfico anterior si existe
        const existingChart = Chart.getChart(canvas);
        if (existingChart) existingChart.destroy();

        new Chart(canvas, {
            type: 'radar',
            data: {
                labels: ['Maquiavelismo', 'Narcisismo', 'Psicopatía'],
                datasets: [{
                    label: 'Participante',
                    data: [sd3.mach, sd3.narc, sd3.psych],
                    backgroundColor: 'rgba(102, 126, 234, 0.3)',
                    borderColor: '#667eea',
                    borderWidth: 3,
                    pointRadius: 6
                }]
            },
            options: {
                responsive: true,
                scales: {
                    r: {
                        min: 1,
                        max: 5,
                        ticks: { color: '#b0a0ff', stepSize: 1 },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        pointLabels: { color: '#e0e0ff', font: { size: 14 } }
                    }
                },
                plugins: {
                    legend: { labels: { color: '#e0e0ff' } }
                }
            }
        });
    }
}

// ========================================
// TIEMPOS DE REACCIÓN
// ========================================
function mostrarTiemposReaccion(sd3) {
    const div = document.getElementById('tiempos-reaccion');
    if (!sd3 || !sd3.estadisticas_tiempo) {
        div.innerHTML = '<p>No hay datos de tiempos disponibles.</p>';
        return;
    }

    const stats = sd3.estadisticas_tiempo;

    div.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px;">
            <div style="text-align: center; padding: 15px; background: rgba(102, 126, 234, 0.1); border-radius: 10px;">
                <p style="color: var(--text-secondary); font-size: 0.9em;">Tiempo total</p>
                <p style="font-size: 1.8em; font-weight: bold; color: var(--primary);">
                    ${(sd3.tiempo_total_ms / 1000 / 60).toFixed(1)} min
                </p>
            </div>
            <div style="text-align: center; padding: 15px; background: rgba(102, 126, 234, 0.1); border-radius: 10px;">
                <p style="color: var(--text-secondary); font-size: 0.9em;">Promedio</p>
                <p style="font-size: 1.8em; font-weight: bold; color: var(--primary);">${stats.promedio_segundos}s</p>
            </div>
            <div style="text-align: center; padding: 15px; background: rgba(102, 126, 234, 0.1); border-radius: 10px;">
                <p style="color: var(--text-secondary); font-size: 0.9em;">Mediana</p>
                <p style="font-size: 1.8em; font-weight: bold; color: var(--primary);">${stats.mediana_segundos}s</p>
            </div>
            <div style="text-align: center; padding: 15px; background: rgba(102, 126, 234, 0.1); border-radius: 10px;">
                <p style="color: var(--text-secondary); font-size: 0.9em;">Mínimo</p>
                <p style="font-size: 1.8em; font-weight: bold; color: #4CAF50;">${stats.minimo_segundos}s</p>
            </div>
            <div style="text-align: center; padding: 15px; background: rgba(102, 126, 234, 0.1); border-radius: 10px;">
                <p style="color: var(--text-secondary); font-size: 0.9em;">Máximo</p>
                <p style="font-size: 1.8em; font-weight: bold; color: #ff6384;">${stats.maximo_segundos}s</p>
            </div>
            <div style="text-align: center; padding: 15px; background: rgba(102, 126, 234, 0.1); border-radius: 10px;">
                <p style="color: var(--text-secondary); font-size: 0.9em;">Desv. estándar</p>
                <p style="font-size: 1.8em; font-weight: bold; color: var(--primary);">${stats.desviacion_estandar_segundos}s</p>
            </div>
        </div>
    `;

    // Gráfico de tiempos (si hay datos detallados)
    if (sd3.tiempos_respuesta && Object.keys(sd3.tiempos_respuesta).length > 0) {
        const tiempos = sd3.tiempos_respuesta;
        const items = Object.keys(tiempos).map(k => parseInt(k));
        const valores = items.map(i => parseFloat(tiempos[i].tiempo_segundos));

        const canvas = document.getElementById('grafico-tiempos-investigador');
        if (canvas) {
            const existingChart = Chart.getChart(canvas);
            if (existingChart) existingChart.destroy();

            new Chart(canvas, {
                type: 'line',
                data: {
                    labels: items,
                    datasets: [{
                        label: 'Tiempo (segundos)',
                        data: valores,
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { labels: { color: '#e0e0ff' } }
                    },
                    scales: {
                        x: { 
                            title: { display: true, text: 'Ítem', color: '#b0a0ff' },
                            ticks: { color: '#b0a0ff' },
                            grid: { color: 'rgba(255, 255, 255, 0.1)' }
                        },
                        y: { 
                            title: { display: true, text: 'Segundos', color: '#b0a0ff' },
                            ticks: { color: '#b0a0ff' },
                            grid: { color: 'rgba(255, 255, 255, 0.1)' }
                        }
                    }
                }
            });
        }
    }
}

// ========================================
// MICROEXPRESIONES
// ========================================
function mostrarMicroexpresiones(micro) {
    const div = document.getElementById('microexpresiones');
    if (!micro || !micro.emociones) {
        div.innerHTML = '<p>No hay datos de microexpresiones disponibles.</p>';
        return;
    }

    div.innerHTML = `
        <div style="padding: 25px; background: linear-gradient(135deg, rgba(102, 126, 234, 0.2), rgba(118, 75, 162, 0.2)); 
                    border-radius: 15px; margin-bottom: 20px; text-align: center;">
            <h4 style="color: var(--primary);">🎯 Emoción Dominante</h4>
            <p style="font-size: 2.5em; font-weight: bold; margin: 15px 0;">${micro.emocion_dominante || 'N/A'}</p>
            <p style="color: var(--text-secondary);">
                Confianza: <strong style="color: var(--primary);">${((micro.confianza || 0) * 100).toFixed(1)}%</strong>
            </p>
        </div>
    `;

    // Barras de emociones
    for (let [emocion, valor] of Object.entries(micro.emociones)) {
        const percentage = (valor * 100).toFixed(1);
        div.innerHTML += `
            <div style="margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <strong>${emocion}</strong>
                    <span style="color: var(--primary);">${percentage}%</span>
                </div>
                <div style="background: #2a2a3e; border-radius: 10px; height: 10px;">
                    <div style="background: linear-gradient(90deg, #667eea, #764ba2); 
                                width: ${Math.min(percentage, 100)}%; height: 100%; border-radius: 10px;"></div>
                </div>
            </div>
        `;
    }

    // Gráfico
    const canvas = document.getElementById('grafico-emociones-investigador');
    if (canvas) {
        const existingChart = Chart.getChart(canvas);
        if (existingChart) existingChart.destroy();

        new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: Object.keys(micro.emociones),
                datasets: [{
                    data: Object.values(micro.emociones).map(v => (v * 100).toFixed(1)),
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.7)',
                        'rgba(54, 162, 235, 0.7)',
                        'rgba(255, 206, 86, 0.7)',
                        'rgba(75, 192, 192, 0.7)',
                        'rgba(153, 102, 255, 0.7)'
                    ],
                    borderColor: '#1a1a2e',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { labels: { color: '#e0e0ff' } }
                }
            }
        });
    }
}

// ========================================
// FACS
// ========================================
function mostrarFACS(micro) {
    const div = document.getElementById('facs');
    if (!micro || !micro.facs || micro.facs.length === 0) {
        div.innerHTML = '<p>No se detectaron unidades de acción FACS.</p>';
        return;
    }

    div.innerHTML = '<div style="display: grid; gap: 15px;">';
    micro.facs.forEach(au => {
        div.innerHTML += `
            <div style="padding: 20px; background: rgba(102, 126, 234, 0.05); border: 2px solid var(--border); border-radius: 10px;">
                <h4 style="color: var(--primary);">${au.nombre || au.codigo}</h4>
                <p style="color: var(--text-secondary);"><strong>Código:</strong> ${au.codigo}</p>
                <p>${au.descripcion || 'Unidad de acción facial detectada'}</p>
            </div>
        `;
    });
    div.innerHTML += '</div>';
}

// ========================================
// ANÁLISIS INTEGRADO
// ========================================
function mostrarAnalisisIntegrado(p) {
    const div = document.getElementById('analisis-integrado');
    const sd3 = p.sd3 || {};
    const micro = p.microexpresiones || {};

    const interpretarSD3 = (valor) => valor > 3.4 ? 'alto' : valor > 2.4 ? 'medio' : 'bajo';

    div.innerHTML = `
        <p style="font-size: 1.1em; line-height: 1.8; margin-bottom: 20px;">
            <strong>Perfil de Personalidad:</strong> El participante presenta niveles 
            <span style="color: var(--primary);">${interpretarSD3(sd3.mach)}</span> en maquiavelismo,
            <span style="color: var(--primary);">${interpretarSD3(sd3.narc)}</span> en narcisismo y
            <span style="color: var(--primary);">${interpretarSD3(sd3.psych)}</span> en psicopatía.
        </p>
        <p style="font-size: 1.1em; line-height: 1.8; margin-bottom: 20px;">
            <strong>Expresión Emocional:</strong> La emoción facial dominante es 
            <span style="color: var(--primary);">${micro.emocion_dominante || 'no determinada'}</span>
            con una confianza del <span style="color: var(--primary);">${((micro.confianza || 0) * 100).toFixed(1)}%</span>.
        </p>
        <p style="font-size: 1.1em; line-height: 1.8;">
            <strong>Tiempo de Respuesta:</strong> El participante completó el test en
            <span style="color: var(--primary);">${(sd3.tiempo_total_ms / 1000 / 60).toFixed(1)} minutos</span>
            con un promedio de <span style="color: var(--primary);">${sd3.estadisticas_tiempo?.promedio_segundos || 'N/A'}s</span> por ítem.
        </p>
    `;
}

// ========================================
// MOSTRAR IMAGEN
// ========================================
function mostrarImagen(p) {
    const div = document.getElementById('imagen-participante');
    if (p.imagen) {
        div.innerHTML = `
            <img src="${p.imagen}" alt="Foto del participante" 
                 style="max-width: 100%; max-height: 500px; border-radius: 10px; 
                        box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        `;
    } else {
        div.innerHTML = '<p>No hay imagen disponible.</p>';
    }
}

// ========================================
// EXPORTAR DATOS
// ========================================
function exportarDatos() {
    if (!participanteSeleccionado) return;
    
    const dataStr = JSON.stringify(participanteSeleccionado, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `participante_${participanteSeleccionado.id || 'data'}.json`;
    link.click();
    URL.revokeObjectURL(url);
}
