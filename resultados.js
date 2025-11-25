// ========================================
// CARGAR Y MOSTRAR RESULTADOS
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    cargarResultados();
});

function cargarResultados() {
    // Obtener datos del sessionStorage
    const persona = JSON.parse(sessionStorage.getItem('datos_personales') || '{}');
    const sd3 = JSON.parse(sessionStorage.getItem('resultadosSD3') || '{}');
    const micro = JSON.parse(sessionStorage.getItem('resultadosMicro') || '{}');

    // Verificar que hay datos
    if (!persona.nombre || !sd3.mach) {
        alert('No se encontraron resultados. Por favor completá el test primero.');
        window.location.href = 'index.html';
        return;
    }

    // Mostrar cada sección
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
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
            <div>
                <strong style="color: var(--primary);">Nombre:</strong>
                <p>${persona.nombre}</p>
            </div>
            <div>
                <strong style="color: var(--primary);">Edad:</strong>
                <p>${persona.edad} años</p>
            </div>
            <div>
                <strong style="color: var(--primary);">Género:</strong>
                <p>${persona.genero}</p>
            </div>
            <div>
                <strong style="color: var(--primary);">País:</strong>
                <p>${persona.pais}</p>
            </div>
        </div>
        <p style="margin-top: 20px; color: var(--text-secondary); font-size: 0.9em;">
            <strong>Fecha:</strong> ${new Date().toLocaleDateString('es-AR', { 
                year: 'numeric', month: 'long', day: 'numeric', 
                hour: '2-digit', minute: '2-digit' 
            })}
        </p>
    `;
}

// ========================================
// RESULTADOS SD3
// ========================================
function mostrarResultadosSD3(sd3) {
    const div = document.getElementById('resultados-sd3-detalle');
    
    const interpretarNivel = (valor) => {
        if (valor <= 2.4) return { nivel: 'Bajo', color: '#4CAF50' };
        if (valor <= 3.4) return { nivel: 'Medio', color: '#ffce56' };
        return { nivel: 'Alto', color: '#ff6384' };
    };

    const mach = interpretarNivel(sd3.mach);
    const narc = interpretarNivel(sd3.narc);
    const psych = interpretarNivel(sd3.psych);

    div.innerHTML = `
        <div style="display: grid; gap: 20px; margin-bottom: 30px;">
            <div style="padding: 20px; background: rgba(255, 99, 132, 0.1); border-radius: 10px; border: 2px solid #ff6384;">
                <h4 style="color: #ff6384; margin-bottom: 10px;">🎭 Maquiavelismo</h4>
                <p style="font-size: 2em; font-weight: bold; color: ${mach.color};">${sd3.mach} / 5.0</p>
                <p style="color: var(--text-secondary);">Nivel: <strong style="color: ${mach.color};">${mach.nivel}</strong></p>
                <p style="margin-top: 15px; font-size: 0.95em;">
                    Mide la tendencia a la manipulación estratégica, cinismo interpersonal y pragmatismo amoral.
                </p>
            </div>

            <div style="padding: 20px; background: rgba(54, 162, 235, 0.1); border-radius: 10px; border: 2px solid #36a2eb;">
                <h4 style="color: #36a2eb; margin-bottom: 10px;">👑 Narcisismo</h4>
                <p style="font-size: 2em; font-weight: bold; color: ${narc.color};">${sd3.narc} / 5.0</p>
                <p style="color: var(--text-secondary);">Nivel: <strong style="color: ${narc.color};">${narc.nivel}</strong></p>
                <p style="margin-top: 15px; font-size: 0.95em;">
                    Refleja grandiosidad, necesidad de admiración, sentido de superioridad y derecho especial.
                </p>
            </div>

            <div style="padding: 20px; background: rgba(255, 206, 86, 0.1); border-radius: 10px; border: 2px solid #ffce56;">
                <h4 style="color: #ffce56; margin-bottom: 10px;">⚡ Psicopatía</h4>
                <p style="font-size: 2em; font-weight: bold; color: ${psych.color};">${sd3.psych} / 5.0</p>
                <p style="color: var(--text-secondary);">Nivel: <strong style="color: ${psych.color};">${psych.nivel}</strong></p>
                <p style="margin-top: 15px; font-size: 0.95em;">
                    Indica impulsividad, búsqueda de sensaciones, baja empatía y comportamiento antisocial.
                </p>
            </div>
        </div>
    `;

    // Crear gráfico
    const canvas = document.getElementById('grafico-sd3-resultados');
    if (canvas) {
        new Chart(canvas, {
            type: 'radar',
            data: {
                labels: ['Maquiavelismo', 'Narcisismo', 'Psicopatía'],
                datasets: [{
                    label: 'Tu perfil SD3',
                    data: [sd3.mach, sd3.narc, sd3.psych],
                    backgroundColor: 'rgba(102, 126, 234, 0.2)',
                    borderColor: '#667eea',
                    borderWidth: 3,
                    pointBackgroundColor: '#667eea',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: '#667eea',
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
                            color: '#b0a0ff'
                        },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        pointLabels: { 
                            color: '#e0e0ff',
                            font: { size: 14 }
                        }
                    }
                },
                plugins: {
                    legend: { 
                        labels: { 
                            color: '#e0e0ff',
                            font: { size: 12 }
                        }
                    }
                }
            }
        });
    }
}

// ========================================
// TIEMPOS DE RESPUESTA
// ========================================
function mostrarTiempos(sd3) {
    const div = document.getElementById('tiempos-detalle');
    const stats = sd3.estadisticas_tiempo || {};

    div.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 30px;">
            <div style="text-align: center; padding: 15px; background: rgba(102, 126, 234, 0.1); border-radius: 10px;">
                <p style="color: var(--text-secondary); font-size: 0.9em;">Tiempo total</p>
                <p style="font-size: 1.8em; font-weight: bold; color: var(--primary);">
                    ${(sd3.tiempo_total_ms / 1000 / 60).toFixed(1)} min
                </p>
            </div>
            <div style="text-align: center; padding: 15px; background: rgba(102, 126, 234, 0.1); border-radius: 10px;">
                <p style="color: var(--text-secondary); font-size: 0.9em;">Promedio por ítem</p>
                <p style="font-size: 1.8em; font-weight: bold; color: var(--primary);">
                    ${stats.promedio_segundos}s
                </p>
            </div>
            <div style="text-align: center; padding: 15px; background: rgba(102, 126, 234, 0.1); border-radius: 10px;">
                <p style="color: var(--text-secondary); font-size: 0.9em;">Mediana</p>
                <p style="font-size: 1.8em; font-weight: bold; color: var(--primary);">
                    ${stats.mediana_segundos}s
                </p>
            </div>
            <div style="text-align: center; padding: 15px; background: rgba(102, 126, 234, 0.1); border-radius: 10px;">
                <p style="color: var(--text-secondary); font-size: 0.9em;">Mínimo</p>
                <p style="font-size: 1.8em; font-weight: bold; color: #4CAF50;">
                    ${stats.minimo_segundos}s
                </p>
            </div>
            <div style="text-align: center; padding: 15px; background: rgba(102, 126, 234, 0.1); border-radius: 10px;">
                <p style="color: var(--text-secondary); font-size: 0.9em;">Máximo</p>
                <p style="font-size: 1.8em; font-weight: bold; color: #ff6384;">
                    ${stats.maximo_segundos}s
                </p>
            </div>
            <div style="text-align: center; padding: 15px; background: rgba(102, 126, 234, 0.1); border-radius: 10px;">
                <p style="color: var(--text-secondary); font-size: 0.9em;">Desv. estándar</p>
                <p style="font-size: 1.8em; font-weight: bold; color: var(--primary);">
                    ${stats.desviacion_estandar_segundos}s
                </p>
            </div>
        </div>
    `;

    // Gráfico de tiempos por ítem
    const tiempos = sd3.tiempos_respuesta || {};
    const items = Object.keys(tiempos).map(k => parseInt(k));
    const valores = items.map(i => parseFloat(tiempos[i].tiempo_segundos));

    const canvas = document.getElementById('grafico-tiempos');
    if (canvas && valores.length > 0) {
        new Chart(canvas, {
            type: 'line',
            data: {
                labels: items,
                datasets: [{
                    label: 'Tiempo de respuesta (segundos)',
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
                    legend: { labels: { color: '#e0e0ff' } },
                    title: {
                        display: true,
                        text: 'Tiempo de respuesta por ítem',
                        color: '#e0e0ff',
                        font: { size: 16 }
                    }
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

// ========================================
// MICROEXPRESIONES
// ========================================
function mostrarMicroexpresiones(micro) {
    const div = document.getElementById('microexpresiones-detalle');
    
    if (!micro.emociones || Object.keys(micro.emociones).length === 0) {
        div.innerHTML = '<p style="color: var(--text-secondary);">No se encontraron datos de microexpresiones.</p>';
        return;
    }

    const emociones = micro.emociones;
    const dominante = micro.emocion_dominante || 'Desconocida';
    const confianza = micro.confianza || 0;

    div.innerHTML = `
        <div style="padding: 25px; background: linear-gradient(135deg, rgba(102, 126, 234, 0.2), rgba(118, 75, 162, 0.2)); 
                    border-radius: 15px; margin-bottom: 30px; text-align: center;">
            <h4 style="color: var(--primary); margin-bottom: 10px;">🎯 Emoción Dominante</h4>
            <p style="font-size: 2.5em; font-weight: bold; margin: 15px 0;">${dominante}</p>
            <p style="color: var(--text-secondary);">
                Confianza: <strong style="color: var(--primary);">${(confianza * 100).toFixed(1)}%</strong>
            </p>
        </div>

        <h4 style="margin-bottom: 20px;">Distribución de emociones:</h4>
    `;

    // Barras de emociones
    for (let [emocion, valor] of Object.entries(emociones)) {
        const percentage = (valor * 100).toFixed(1);
        const barWidth = Math.min(percentage, 100);
        
        div.innerHTML += `
            <div style="margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <strong>${emocion}</strong>
                    <span style="color: var(--primary);">${percentage}%</span>
                </div>
                <div style="background: #2a2a3e; border-radius: 10px; height: 12px; overflow: hidden;">
                    <div style="background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); 
                                width: ${barWidth}%; height: 100%; transition: width 0.5s ease;
                                box-shadow: 0 0 10px rgba(102, 126, 234, 0.5);">
                    </div>
                </div>
            </div>
        `;
    }

    // Gráfico de emociones
    const canvas = document.getElementById('grafico-emociones');
    if (canvas) {
        new Chart(canvas, {
            type: 'polarArea',
            data: {
                labels: Object.keys(emociones),
                datasets: [{
                    data: Object.values(emociones).map(v => (v * 100).toFixed(1)),
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.6)',
                        'rgba(54, 162, 235, 0.6)',
                        'rgba(255, 206, 86, 0.6)',
                        'rgba(75, 192, 192, 0.6)',
                        'rgba(153, 102, 255, 0.6)',
                        'rgba(255, 159, 64, 0.6)',
                        'rgba(199, 199, 199, 0.6)'
                    ],
                    borderColor: '#1a1a2e',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { 
                        position: 'right',
                        labels: { color: '#e0e0ff', font: { size: 12 } }
                    },
                    title: {
                        display: true,
                        text: 'Perfil Emocional',
                        color: '#e0e0ff',
                        font: { size: 16 }
                    }
                },
                scales: {
                    r: {
                        ticks: { 
                            color: '#b0a0ff',
                            backdropColor: 'transparent'
                        },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    }
                }
            }
        });
    }
}

// ========================================
// FACS
// ========================================
function mostrarFACS(micro) {
    const div = document.getElementById('facs-detalle');
    
    if (!micro.facs || micro.facs.length === 0) {
        div.innerHTML = '<p style="color: var(--text-secondary);">No se detectaron unidades de acción FACS específicas.</p>';
        return;
    }

    div.innerHTML = '<div style="display: grid; gap: 15px;">';
    
    micro.facs.forEach(au => {
        div.innerHTML += `
            <div style="padding: 20px; background: rgba(102, 126, 234, 0.05); 
                        border: 2px solid var(--border); border-radius: 10px;">
                <h4 style="color: var(--primary); margin-bottom: 10px;">${au.nombre || au.codigo}</h4>
                <p style="color: var(--text-secondary); margin-bottom: 10px;">
                    <strong>Código:</strong> ${au.codigo}
                </p>
                <p>${au.descripcion || 'Unidad de acción facial detectada'}</p>
                ${au.intensidad ? `<p style="margin-top: 10px;">
                    <strong>Intensidad:</strong> <span style="color: var(--primary);">${au.intensidad}</span>
                </p>` : ''}
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
    
    const maquiavelismo = sd3.mach > 3.4 ? 'alto' : sd3.mach > 2.4 ? 'medio' : 'bajo';
    const narcisismo = sd3.narc > 3.4 ? 'alto' : sd3.narc > 2.4 ? 'medio' : 'bajo';
    const psicopatia = sd3.psych > 3.4 ? 'alto' : sd3.psych > 2.4 ? 'medio' : 'bajo';
    
    const emocionDominante = micro.emocion_dominante || 'neutra';
    
    div.innerHTML = `
        <p style="font-size: 1.1em; line-height: 1.8; margin-bottom: 20px;">
            El análisis integrado de tus resultados muestra un perfil con nivel <strong style="color: var(--primary);">${maquiavelismo}</strong> 
            en maquiavelismo, <strong style="color: var(--primary);">${narcisismo}</strong> en narcisismo y 
            <strong style="color: var(--primary);">${psicopatia}</strong> en psicopatía.
        </p>
        
        <p style="font-size: 1.1em; line-height: 1.8; margin-bottom: 20px;">
            El análisis de microexpresiones reveló una expresión emocional predominantemente 
            <strong style="color: var(--primary);">${emocionDominante}</strong>, lo cual puede relacionarse con tu perfil de personalidad.
        </p>
        
        <p style="font-size: 1.1em; line-height: 1.8; margin-bottom: 20px;">
            Los tiempos de respuesta (promedio: <strong>${sd3.estadisticas_tiempo?.promedio_segundos || 'N/A'}s</strong>) 
            sugieren un patrón de procesamiento ${parseFloat(sd3.estadisticas_tiempo?.promedio_segundos) < 5 ? 'rápido' : 
            parseFloat(sd3.estadisticas_tiempo?.promedio_segundos) < 10 ? 'moderado' : 'reflexivo'} 
            en la toma de decisiones.
        </p>
        
        <div style="background: rgba(255, 206, 86, 0.1); border: 2px solid #ffce56; 
                    border-radius: 10px; padding: 20px; margin-top: 30px;">
            <h4 style="color: #ffce56; margin-bottom: 15px;">⚠️ Importante</h4>
            <p style="font-size: 0.95em; line-height: 1.7;">
                Estos resultados son parte de una investigación académica y <strong>no constituyen un diagnóstico clínico</strong>. 
                Los rasgos de personalidad medidos existen en un continuo y todos los individuos presentan algún grado de estas características. 
                Si tenés preocupaciones sobre tu salud mental, consultá con un profesional calificado.
            </p>
        </div>
    `;
}

// ========================================
// DESCARGAR RESULTADOS
// ========================================
function descargarResultados() {
    alert('Funcionalidad de descarga en desarrollo. Por ahora podés usar la función de imprimir del navegador.');
    window.print();
}
