// ============================================
// facs_ui.js
// Módulo para mostrar resultados FACS en el frontend
// ============================================

/**
 * Mostrar resultados completos de FACS
 * @param {Object} facsData - Datos de FACS desde la API
 * @param {string} containerId - ID del contenedor HTML (default: 'facs-container')
 */
function mostrarFACS(facsData, containerId = 'facs-container') {
  const container = document.getElementById(containerId);
  
  if (!container) {
    console.error(`Contenedor #${containerId} no encontrado`);
    return;
  }
  
  // Verificar que existan los datos
  if (!facsData || !facsData.action_units) {
    container.innerHTML = '<p style="color: #999; padding: 15px;">❌ Análisis FACS no disponible</p>';
    return;
  }
  
  const { action_units, interpretation } = facsData;
  
  let html = `
    <div class="facs-results">
      <h3 class="facs-title">🎭 Análisis FACS (Action Units)</h3>
  `;
  
  // Mostrar Action Units
  if (action_units.length > 0) {
    html += '<div class="aus-section">';
    html += '<h4>Action Units Detectados:</h4>';
    
    action_units.forEach(au => {
      const intensidad = (au.intensity * 100).toFixed(0);
      const colorBarra = intensidad > 70 ? '#28a745' : 
                         intensidad > 40 ? '#ffc107' : '#dc3545';
      
      html += `
        <div class="au-card">
          <div class="au-header">
            <span class="au-code">${au.code}</span>
            <span class="au-intensity">${intensidad}%</span>
          </div>
          <div class="au-bar-container">
            <div class="au-bar" style="width: ${intensidad}%; background-color: ${colorBarra}"></div>
          </div>
          <p class="au-description">${au.description}</p>
        </div>
      `;
    });
    
    html += '</div>';
  } else {
    html += '<p>No se detectaron Action Units significativos</p>';
  }
  
  // Mostrar Interpretación
  if (interpretation) {
    const authScore = (interpretation.authenticity_score * 100).toFixed(0);
    const authColor = authScore > 60 ? '#28a745' : 
                      authScore > 30 ? '#ffc107' : '#dc3545';
    const authLabel = authScore > 60 ? 'Alta' : 
                      authScore > 30 ? 'Media' : 'Baja';
    
    html += `
      <div class="interpretation-section">
        <h4>💡 Interpretación</h4>
        
        <div class="interpretation-item">
          <strong>Emoción Principal:</strong> ${interpretation.primary_emotion}
          <span class="confidence">(${(interpretation.confidence * 100).toFixed(0)}% confianza)</span>
        </div>
        
        <div class="interpretation-item">
          <strong>Autenticidad de la Expresión:</strong>
          <div class="auth-bar-container">
            <div class="auth-bar" style="width: ${authScore}%; background-color: ${authColor}"></div>
          </div>
          <span class="auth-label" style="color: ${authColor}">${authScore}% - ${authLabel}</span>
        </div>
    `;
    
    // Microexpresiones identificadas
    if (interpretation.microexpression_indicators && 
        interpretation.microexpression_indicators.length > 0) {
      html += `
        <div class="microexp-indicators">
          <strong>Microexpresiones Identificadas:</strong>
          <ul>
      `;
      
      interpretation.microexpression_indicators.forEach(indicator => {
        html += `
          <li class="indicator-item">
            <strong>${indicator.type}</strong> 
            <span class="badge">${indicator.authenticity}</span>
            <br>
            <small>${indicator.note}</small>
          </li>
        `;
      });
      
      html += '</ul></div>';
    }
    
    html += '</div>';
  }
  
  html += '</div>';
  
  // Insertar HTML en el DOM con animación
  container.style.opacity = '0';
  container.innerHTML = html;
  setTimeout(() => {
    container.style.opacity = '1';
    container.style.transition = 'opacity 0.3s ease';
  }, 50);
}


/**
 * Versión compacta de resultados FACS
 * @param {Object} facsData - Datos de FACS desde la API
 * @param {string} containerId - ID del contenedor HTML
 */
function mostrarFACSCompacto(facsData, containerId = 'facs-container') {
  const container = document.getElementById(containerId);
  
  if (!container) {
    console.error(`Contenedor #${containerId} no encontrado`);
    return;
  }
  
  if (!facsData || !facsData.action_units) {
    container.innerHTML = '';
    return;
  }
  
  const { action_units, interpretation } = facsData;
  const authScore = (interpretation.authenticity_score * 100).toFixed(0);
  
  const html = `
    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 15px;">
      <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
        <div>
          <strong>FACS:</strong> ${action_units.length} Action Units activos
          <br>
          <small style="color: #666;">${action_units.map(au => au.code).join(', ')}</small>
        </div>
        <div>
          <strong>Autenticidad:</strong> ${authScore}%
          <div style="width: 100px; height: 8px; background: #e9ecef; border-radius: 4px; margin-top: 5px;">
            <div style="width: ${authScore}%; height: 100%; background: ${authScore > 60 ? '#28a745' : '#ffc107'}; border-radius: 4px;"></div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  container.innerHTML = html;
}


/**
 * Ocultar resultados FACS
 * @param {string} containerId - ID del contenedor HTML
 */
function ocultarFACS(containerId = 'facs-container') {
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = '';
  }
}


/**
 * Cargar estilos CSS para FACS
 * Se ejecuta automáticamente al cargar el archivo
 */
function cargarEstilosFACS() {
  const styleId = 'facs-styles';
  
  // Evitar duplicados
  if (document.getElementById(styleId)) {
    return;
  }
  
  const css = `
    .facs-results {
      background-color: #fff3cd;
      padding: 20px;
      border-radius: 10px;
      margin-top: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .facs-title {
      color: #856404;
      margin-bottom: 15px;
      font-size: 20px;
    }

    .aus-section {
      margin-bottom: 20px;
    }

    .aus-section h4 {
      color: #333;
      font-size: 16px;
      margin-bottom: 12px;
    }

    .au-card {
      background-color: white;
      padding: 12px;
      border-radius: 8px;
      border-left: 4px solid #ffc107;
      margin-bottom: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .au-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .au-code {
      font-weight: bold;
      color: #333;
      font-size: 14px;
    }

    .au-intensity {
      background-color: #ffc107;
      color: white;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: bold;
    }

    .au-bar-container {
      width: 100%;
      height: 6px;
      background-color: #e9ecef;
      border-radius: 3px;
      overflow: hidden;
      margin-bottom: 8px;
    }

    .au-bar {
      height: 100%;
      transition: width 0.5s ease;
      border-radius: 3px;
    }

    .au-description {
      font-size: 13px;
      color: #666;
      margin: 0;
      line-height: 1.4;
    }

    .interpretation-section {
      background-color: white;
      padding: 15px;
      border-radius: 8px;
      border-left: 4px solid #28a745;
    }

    .interpretation-section h4 {
      color: #333;
      font-size: 16px;
      margin-bottom: 12px;
    }

    .interpretation-item {
      margin-bottom: 15px;
    }

    .interpretation-item strong {
      color: #333;
      font-size: 14px;
    }

    .confidence {
      color: #666;
      font-size: 12px;
      margin-left: 8px;
    }

    .auth-bar-container {
      width: 100%;
      height: 20px;
      background-color: #e9ecef;
      border-radius: 10px;
      overflow: hidden;
      margin: 8px 0;
    }

    .auth-bar {
      height: 100%;
      transition: width 0.5s ease;
      border-radius: 10px;
    }

    .auth-label {
      font-size: 13px;
      font-weight: bold;
    }

    .microexp-indicators {
      margin-top: 15px;
      padding-top: 15px;
      border-top: 1px solid #e9ecef;
    }

    .microexp-indicators ul {
      margin-top: 10px;
      padding-left: 20px;
    }

    .indicator-item {
      margin-bottom: 12px;
      line-height: 1.6;
    }

    .indicator-item strong {
      color: #333;
      font-size: 14px;
    }

    .badge {
      background-color: #28a745;
      color: white;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      margin-left: 8px;
    }

    .indicator-item small {
      color: #666;
      font-size: 12px;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .facs-results {
        padding: 15px;
      }
      
      .au-card {
        padding: 10px;
      }
      
      .facs-title {
        font-size: 18px;
      }
    }
  `;
  
  const styleTag = document.createElement('style');
  styleTag.id = styleId;
  styleTag.textContent = css;
  document.head.appendChild(styleTag);
}

// Cargar estilos automáticamente cuando se incluye el script
cargarEstilosFACS();
