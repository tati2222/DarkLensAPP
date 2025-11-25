// ========================================
// CARGAR Y MOSTRAR RESULTADOS
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    cargarResultados();
});

function cargarResultados() {
    const persona = JSON.parse(sessionStorage.getItem('datos_personales') || '{}');
    const sd3 = JSON.parse(sessionStorage.getItem('resultadosSD3') || '{}');
    const micro = JSON.parse(sessionStorage.getItem('resultadosMicro') || '{}');

    if (!persona.nombre || !sd3.mach) {
        alert('No se encontraron resultados. Por favor completá el test primero.');
        window.location.href = 'participante.html';
        return;
    }

    mostrarInfoParticipante(persona);
    mostrarResultadosSD3(sd3);
    mostrarTiempos(sd3);
    mostrarMicroexpresiones(micro);
    mostrarFACS(micro);
    mostrarAnalisisFinal(sd3, micro);
}

// ========================================
// INFO PARTICIPANTE
// ========================================
function mostrarInfoParticipante(persona) {
    const div = document.getElementById('info-participante');
    div.innerHTML = `
        <div class="info-grid">
            <div class="info-item">
                <strong>Nombre:</strong>
                <p>${persona.nombre || 'Anónimo'}</p>
            </div>
            <div class="info-item">
                <strong>Edad:</strong>
                <p>${persona.edad} años</p>
            </div>
            <div class="info-item">
                <strong>Género:</strong>
                <p>${persona.genero}</p>
            </div>
            <div class="info-item">
                <strong>País:</strong>
                <p>${persona.pais}</p>
            </div>
        </div>
        <p style="margin-top: 20px; text-align: center; color: #888; font-size: 0.95em;">
            <strong>Fecha:</strong> ${new Date().toLocaleDateString('es-AR', { 
                year: 'numeric', month: 'long', day: 'numeric', 
                hour: '2-digit', minute: '2-digit' 
            })}
        </p>
    `;
}

// ========================================
// RESULTADOS SD3 CON TARJETAS Y BARRAS
// ========================================
function mostrarResultadosSD3(sd3) {
    const div = document.getElementById('resultados-sd3-detalle');
    
    const interpretarNivel = (valor) => {
        if (valor <= 2.4) return { nivel: 'Bajo', clase: 'nivel-bajo', emoji: '✅' };
        if (valor <= 3.4) return { nivel: 'Medio', clase: 'nivel-medio', emoji: '⚡' };
        return { nivel: 'Alto', clase: 'nivel-alto', emoji: '🔥' };
    };

    const mach = interpretarNivel(sd3.mach);
    const narc = interpretarNivel(sd3.narc);
    const psych = interpretarNivel(sd3.psych);

    div.innerHTML = `
        <div class="scores-grid">
            <!-- MAQUIAVELISMO -->
            <div class="score-card">
                <span class="score-icon">🎭</span>
                <div class="score-label">Maquiavelismo</div>
                <div class="score-value">${sd3.mach}</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${(sd3.mach / 5) * 100}%"></div>
                </div>
                <span class="score-level ${mach.clase}">${mach.emoji} ${mach.nivel}</span>
                <p style="margin-top: 15px; font-size: 0.9em; color: #b0a0ff;">
                    Manipulación estratégica y pragmatismo
                </p>
            </div>

            <!-- NARCISISMO -->
            <div class="score-card">
                <span class="score-icon">👑</span>
                <div class="score-label">Narcisismo</div>
                <div class="score-value">${sd3.narc}</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${(sd3.narc / 5) * 100}%"></div>
                </div>
                <span class="score-level ${narc.clase}">${narc.emoji} ${narc.nivel}</span>
                <p style="margin-top: 15px; font-size: 0.9em; color: #b0a0ff;">
                    Grandiosidad y necesidad de admiración
                </p>
            </div>

            <!-- PSICOPATÍA -->
            <div class="score-card">
                <span class="score-icon">⚡</span>
                <div class="score-label">Psicopatía</div>
                <div class="score-value">${sd3.psych}</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${(sd3.psych / 5) * 100}%"></div>
                </div>
                <span class="score-level ${psych.clase}">${psych.emoji} ${psych.nivel}</span>
                <p style="margin-top: 15px; font-size: 0.9em; color: #b0a0ff;">
                    Impulsividad y búsqueda de sensaciones
                </p>
            </div>
        </div>
    `;

    // GRÁFICO RADAR
    setTimeout(() => {
        const canvas = document.getElementById('grafico-sd3-resultados');
        if (canvas) {
            new Chart(canvas, {
                type: 'radar',
                data: {
                    labels: ['Maquiavelismo', 'Narcisismo', 'Psicopatía'],
                    datasets: [{
                        label: 'Tu perfil',
                        data: [sd3.mach, sd3.narc, sd3.psych],
                        backgroundColor: 'rgba(127, 0, 255, 0.2)',
                        borderColor: '#7f00ff',
                        borderWidth: 3,
                        pointBackgroundColor: '#c080ff',
                        pointBorderColor: '#fff',
                        pointRadius: 6
                    }, {
                        label: 'Promedio poblacional',
                        data: [3.0, 2.8, 2.5],
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                        borderWidth: 2,
                        pointRadius: 4,
                        borderDash: [5, 5]
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        r: {
                            min: 1,
                            max: 5,
                            ticks: { 
                                stepSize: 1,
                                color: '#b0a0ff',
                                backdropColor: 'transparent'
                            },
                            grid: { color: 'rgba(192, 128, 255, 0.2)' },
                            pointLabels: { 
                                color: '#c080ff',
                                font: { size: 14, weight: '600' }
                            }
                        }
                    },
                    plugins: {
                        legend: { 
                            labels: { color: '#e0e0ff', font: { size: 12 } }
                        }
                    }
                }
            });
        }
    }, 100);
}

// ========================================
// TIEMPOS DE RESPUESTA
// ========================================
function mostrarTiempos(sd3) {
    const div = document.getElementById('tiempos-detalle');
    const stats = sd3.estadisticas_tiempo || {};

    div.innerHTML = `
        <div class="stats-mini">
            <div class="stat-mini">
                <div class="stat-mini-label">Tiempo Total</div>
                <div class="stat-mini-value">${(sd3.tiempo_total_ms / 1000 / 60).toFixed(1)} min</div>
            </div>
            <div class="stat-mini">
                <div class="stat-mini-label">Promedio</div>
                <div class="stat-mini-value">${stats.promedio_segundos}s</div>
            </div>
            <div class="stat-mini">
                <div class="stat-mini-label">Mediana</div>
                <div class="stat-mini-value">${stats.mediana_segundos}s</div>
            </div>
            <div class="stat-mini">
                <div class="stat-mini-label">Mínimo</div>
                <div class="stat-mini-value">${stats.minimo_segundos}s</div>
            </div>
            <div class="stat-mini">
                <div class="stat-mini-label">Máximo</div>
                <div class="stat-mini-value">${stats.maximo_segundos}s</div>
            </div>
            <div class="stat-mini">
                <div class="stat-mini-label">Desv. Estándar</div>
                <div class="stat-mini-value">${stats.desviacion_estandar_segundos}s</div>
            </div>
        </div>
    `;

    // GRÁFICO DE LÍNEA
    const tiempos = sd3.tiempos_respuesta || {};
    const items = Object.keys(tiempos).map(k => parseInt(k)).sort((a,b) => a - b);
    const valores = items.map(i => parseFloat(tiempos[i]?.tiempo_segundos || 0));

    setTimeout(() => {
        const canvas = document.getElementById('grafico-tiempos');
        if (canvas && valores.length > 0) {
            new Chart(canvas, {
                type: 'line',
                data: {
                    labels: items,
                    datasets: [{
                        label: 'Tiempo (segundos)',
                        data: valores,
                        borderColor: '#7f00ff',
                        backgroundColor: 'rgba(127, 0, 255, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 4,
                        pointBackgroundColor: '#c080ff'
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { labels: { color: '#e0e0ff' } }
                    },
                    scales: {
                        x: { 
                            title: { display: true, text: 'Ítem del Test', color: '#c080ff', font: { size: 14 } },
                            ticks: { color: '#b0a0ff' },
                            grid: { color: 'rgba(192, 128, 255, 0.1)' }
                        },
                        y: { 
                            title: { display: true, text: 'Segundos', color: '#c080ff', font: { size: 14 } },
                            ticks: { color: '#b0a0ff' },
                            grid: { color: 'rgba(192, 128, 255, 0.1)' }
                        }
                    }
                }
            });
        }
    }, 100);
}

// ========================================
// MICROEXPRESIONES CON BARRAS HORIZONTALES
// ========================================
function mostrarMicroexpresiones(micro) {
    const div = document.getElementById('microexpresiones-detalle');
    
    if (!micro.emociones || Object.keys(micro.emociones).length === 0) {
        div.innerHTML = '<p style="text-align: center; color: #888;">No hay datos de microexpresiones.</p>';
        return;
    }

    const dominante = micro.emocion_dominante || 'Desconocida';
    const confianza = (micro.confianza || 0) * 100;

    div.innerHTML = `
        <div style="text-align: center; margin-bottom: 30px; padding: 30px; background: rgba(0,0,0,0.2); border-radius: 15px;">
            <div style="font-size: 4em; margin-bottom: 15px;">😊</div>
            <h4 style="color: #c080ff; margin: 10px 0;">Emoción Dominante</h4>
            <p style="font-size: 2em; font-weight: 800; color: #7f00ff; margin: 15px 0;">${dominante}</p>
            <p style="font-size: 1.1em; color: #b0a0ff;">Confianza: <strong>${confianza.toFixed(1)}%</strong></p>
        </div>

        <h4 style="text-align: center; margin: 30px 0 20px;">Distribución de Emociones Detectadas</h4>
    `;

    // BARRAS HORIZONTALES
    const emociones = Object.entries(micro.emociones).sort((a, b) => b[1] - a[1]);
    emociones.forEach(([emocion, valor]) => {
        const percentage = (valor * 100).toFixed(1);
        div.innerHTML += `
            <div class="emotion-bar">
                <div class="emotion-label">
                    <strong>${emocion}</strong>
                    <span>${percentage}%</span>
                </div>
                <div class="bar-container">
                    <div class="bar-fill" style="width: ${percentage}%">
                        ${percentage}%
                    </div>
                </div>
            </div>
        `;
    });

    // GRÁFICO CIRCULAR
    setTimeout(() => {
        const canvas = document.getElementById('grafico-emociones');
        if (canvas) {
            new Chart(canvas, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(micro.emociones),
                    datasets: [{
                        data: Object.values(micro.emociones).map(v => (v * 100).toFixed(1)),
                        backgroundColor: [
                            'rgba(255, 99, 132, 0.8)',
                            'rgba(54, 162, 235, 0.8)',
                            'rgba(255, 206, 86, 0.8)',
                            'rgba(75, 192, 192, 0.8)',
                            'rgba(153, 102, 255, 0.8)',
                            'rgba(255, 159, 64, 0.8)'
                        ],
                        borderColor: '#1a1a2e',
                        borderWidth: 3
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { 
                            position: 'bottom',
                            labels: { color: '#e0e0ff', font: { size: 13 }, padding: 15 }
                        }
                    }
                }
            });
        }
    }, 100);
}

// ========================================
// FACS
// ========================================
function mostrarFACS(micro) {
    const div = document.getElementById('facs-detalle');
    
    if (!micro.facs || micro.facs.length === 0) {
        div.innerHTML = '<p style="text-align: center; color: #888;">No se detectaron unidades de acción FACS específicas.</p>';
        return;
    }

    div.innerHTML = '<div style="display: grid; gap: 15px;">';
    micro.facs.forEach(au => {
        div.innerHTML += `
            <div class="info-item" style="padding: 20px;">
                <h4 style="color: #c080ff; margin: 0 0 10px 0;">${au.nombre || au.codigo}</h4>
                <p style="color: #888; margin-bottom: 10px;"><strong>Código:</strong> ${au.codigo}</p>
                <p style="margin: 0;">${au.descripcion || 'Unidad de acción facial detectada'}</p>
            </div>
        `;
    });
    div.innerHTML += '</div>';
}

// ========================================
// ANÁLISIS FINAL
// ========================================
function mostrarAnalisisFinal(sd3, micro) {
    const div = document.getElementById('analisis-final');
    
    const nivel = (val) => val > 3.4 ? 'alto' : val > 2.4 ? 'medio' : 'bajo';
    const emocion = micro.emocion_dominante || 'neutral';

    div.innerHTML = `
        <p style="font-size: 1.15em; line-height: 1.9;">
            <strong style="color: #c080ff;">Perfil de Personalidad:</strong> 
            Tu evaluación muestra un nivel <strong>${nivel(sd3.mach)}</strong> en maquiavelismo, 
            <strong>${nivel(sd3.narc)}</strong> en narcisismo y 
            <strong>${nivel(sd3.psych)}</strong> en psicopatía subclínica.
        </p>
        
        <p style="font-size: 1.15em; line-height: 1.9;">
            <strong style="color: #c080ff;">Expresión Emocional:</strong> 
            El análisis de tu rostro reveló una expresión predominantemente <strong>${emocion}</strong> 
            con una confianza del <strong>${((micro.confianza || 0) * 100).toFixed(1)}%</strong>.
        </p>
        
        <p style="font-size: 1.15em; line-height: 1.9;">
            <strong style="color: #c080ff;">Patrón de Respuesta:</strong> 
            Completaste el test en <strong>${(sd3.tiempo_total_ms / 1000 / 60).toFixed(1)} minutos</strong>, 
            con un tiempo promedio de <strong>${sd3.estadisticas_tiempo?.promedio_segundos || 'N/A'} segundos</strong> por ítem.
        </p>
    `;
}

// ========================================
// DESCARGAR RESULTADOS
// ========================================
function descargarResultados() {
    alert('Funcionalidad de descarga PDF en desarrollo. Por ahora podés usar Imprimir (Ctrl+P).');
}
