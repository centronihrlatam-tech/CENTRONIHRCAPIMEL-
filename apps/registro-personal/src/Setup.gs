/**
 * Setup.gs - Módulo de Autoconfiguración y Resolución Automática de Hoja Maestra
 * Senior Apps Script Architecture
 */

/**
 * Obtiene o crea la Hoja de Cálculo Maestra del Proyecto.
 * 1. Intenta obtener la hoja activa si el script está enlazado a un contenedor.
 * 2. Si no hay hoja activa (ej. ejecución desde script standalone o trigger background), busca el ID guardado en ScriptProperties.
 * 3. Si no existe ID guardado, CREA AUTOMÁTICAMENTE una nueva Hoja de Cálculo en Google Drive.
 * 
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet} La Hoja de Cálculo Maestra.
 */
function obtenerOCrearMasterSpreadsheet() {
  var ss = null;
  
  // 1. Intentar obtener hoja activa del contenedor
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    ss = null;
  }

  // 2. Si no hay hoja activa, buscar ID guardado en propiedades del script
  var scriptProperties = PropertiesService.getScriptProperties();
  if (!ss) {
    var savedId = scriptProperties.getProperty("MASTER_SPREADSHEET_ID");
    if (savedId && savedId.trim() !== "") {
      try {
        ss = SpreadsheetApp.openById(savedId.trim());
      } catch (err) {
        Logger.log("No se pudo abrir la hoja con el ID guardado ('" + savedId + "'): " + err.message);
        ss = null;
      }
    }
  }

  // 3. Si sigue sin existir, CREAR UNA NUEVA HOJA MAESTRA en Google Drive
  if (!ss) {
    var nombreHojaNueva = CONFIG.NOMBRE_HOJA_MAESTRA || "Consolidado General";
    Logger.log("Creando nueva Hoja Maestra en Google Drive: " + nombreHojaNueva);
    
    ss = SpreadsheetApp.create(nombreHojaNueva);
    var newId = ss.getId();
    scriptProperties.setProperty("MASTER_SPREADSHEET_ID", newId);
    
    Logger.log("✅ Nueva Hoja Maestra creada exitosamente.");
    Logger.log("📌 URL de la Hoja Maestra: " + ss.getUrl());
  } else {
    // Guardar/Actualizar siempre el ID activo en ScriptProperties para ejecuciones en segundo plano (triggers)
    scriptProperties.setProperty("MASTER_SPREADSHEET_ID", ss.getId());
  }

  return ss;
}

/**
 * Autoconfigura todo el entorno de Google Apps Script y Google Sheets.
 * Crea las pestañas necesarias ('Consolidado_General', 'Log_Auditoria', 'Configuracion_Personas'),
 * siembra el catálogo (si existe) y activa los triggers programados (8:00, 13:00, 15:00).
 */
function autoconfigurarProyecto() {
  Logger.log("Iniciando autoconfiguración del proyecto...");

  // 1. Obtener o crear la Hoja Maestra
  var ss = obtenerOCrearMasterSpreadsheet();
  var masterUrl = ss.getUrl();

  // 2. Configurar Hoja de Consolidado General
  var hojaConsolidado = obtenerOCrearHoja(ss, CONFIG.NOMBRE_HOJA_CONSOLIDADO);
  if (hojaConsolidado.getLastRow() === 0) {
    var encConsolidado = ["N° Persona", "Nombre Persona", "ID Sheet Origen", "Pestaña Origen", "Fecha Consolidación", "Estado / Datos"];
    hojaConsolidado.getRange(1, 1, 1, encConsolidado.length).setValues([encConsolidado]);
    hojaConsolidado.getRange(1, 1, 1, encConsolidado.length)
                   .setBackground("#0F172A").setFontColor("#FFFFFF").setFontWeight("bold").setHorizontalAlignment("center");
    hojaConsolidado.setFrozenRows(1);
  }

  // 3. Configurar Hoja de Log de Auditoría
  var hojaAuditoria = obtenerOCrearHoja(ss, CONFIG.NOMBRE_HOJA_AUDITORIA);
  if (hojaAuditoria.getLastRow() === 0) {
    var encAuditoria = ["Fecha y Hora", "Tipo Ejecución", "Estado", "Archivos Éxito", "Archivos Error", "Filas Consolidadas", "Duración (s)", "Detalles / Errores"];
    hojaAuditoria.getRange(1, 1, 1, encAuditoria.length).setValues([encAuditoria]);
    hojaAuditoria.getRange(1, 1, 1, encAuditoria.length)
                 .setBackground("#1B365D").setFontColor("#FFFFFF").setFontWeight("bold").setHorizontalAlignment("center");
    hojaAuditoria.setFrozenRows(1);
  }

  // 4. Configurar la pestaña de catálogo de personas / orígenes a consolidar
  var nombreHojaPersonas = "Configuracion_Personas";
  var hojaPersonas = obtenerOCrearHoja(ss, nombreHojaPersonas);
  
  var encPersonas = ["N°", "Nombre Persona", "ID Spreadsheet Origen", "ID Carpeta", "Estado"];
  hojaPersonas.clearContents();
  hojaPersonas.getRange(1, 1, 1, encPersonas.length).setValues([encPersonas]);
  hojaPersonas.getRange(1, 1, 1, encPersonas.length)
              .setBackground("#0D9488").setFontColor("#FFFFFF").setFontWeight("bold").setHorizontalAlignment("center");
  hojaPersonas.setFrozenRows(1);

  // Sembrado opcional del catálogo. Vacío si el despliegue no incluye
  // Config.local/PERSONAS_SEED: la fuente de verdad en runtime es esta pestaña.
  var filasPersonas = (CONFIG.PERSONAS || []).map(function(p) {
    return [p.numero, p.nombre, p.id, p.carpeta_id, "ACTIVO"];
  });

  if (filasPersonas.length > 0) {
    hojaPersonas.getRange(2, 1, filasPersonas.length, encPersonas.length).setValues(filasPersonas);
  } else {
    Logger.log("Sin catálogo de sembrado: completa la pestaña 'Configuracion_Personas' manualmente.");
  }

  // 5. Activar los Triggers automáticos por tiempo (8:00 AM, 13:00 y 15:00)
  var msgTriggers = crearTriggersProgramados();

  // 6. Mensaje de Notificación
  var mensajeFinal = "🎉 ¡Proyecto Autoconfigurado Exitosamente!\n\n" +
                     "✓ Hoja Maestra: " + ss.getName() + "\n" +
                     "✓ Pestañas inicializadas: '" + CONFIG.NOMBRE_HOJA_CONSOLIDADO + "', '" + CONFIG.NOMBRE_HOJA_AUDITORIA + "' y 'Configuracion_Personas'.\n" +
                     (filasPersonas.length > 0
                        ? "✓ Catálogo de " + filasPersonas.length + " personas sembrado correctamente."
                        : "• Catálogo vacío: completa la pestaña 'Configuracion_Personas' con los Spreadsheets a consolidar.") + "\n" +
                     "✓ " + msgTriggers + "\n\n" +
                     "📌 URL de la Hoja Maestra:\n" + masterUrl;

  Logger.log(mensajeFinal);
  
  try {
    SpreadsheetApp.getUi().alert("Proyecto Autoconfigurado", mensajeFinal, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    // Modo ejecución sin interfaz gráfica (Background/Standalone)
  }

  return {
    mensaje: mensajeFinal,
    masterUrl: masterUrl,
    spreadsheetId: ss.getId()
  };
}

/**
 * Obtiene la lista activa de personas desde la pestaña 'Configuracion_Personas' o desde CONFIG.
 */
function obtenerListaPersonasActivas(ss) {
  try {
    var sheet = ss.getSheetByName("Configuracion_Personas");
    if (!sheet || sheet.getLastRow() < 2) {
      return CONFIG.PERSONAS || [];
    }
    
    var data = sheet.getDataRange().getDisplayValues();
    var lista = [];
    
    for (var r = 1; r < data.length; r++) {
      var row = data[r];
      var num = parseInt(row[0], 10);
      var nombre = row[1];
      var id = row[2];
      var carpetaId = row[3];
      var estado = row[4];
      
      if (id && id.trim() !== "" && (estado.toUpperCase() === "ACTIVO" || estado === "")) {
        lista.push({
          numero: isNaN(num) ? (r + 1) : num,
          nombre: nombre,
          id: id.trim(),
          carpeta_id: carpetaId
        });
      }
    }
    
    return lista.length > 0 ? lista : (CONFIG.PERSONAS || []);
  } catch (err) {
    Logger.log("Error leyendo Configuracion_Personas: " + err.toString());
    return CONFIG.PERSONAS || [];
  }
}
