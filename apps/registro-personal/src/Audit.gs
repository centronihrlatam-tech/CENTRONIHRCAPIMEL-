/**
 * Audit.gs - Modulo de Auditoria y Registro de Ejecuciones
 * Senior Apps Script Architecture
 */

/**
 * Registra una entrada de auditoría en la pestaña 'Log_Auditoria'.
 * 
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss - Hoja de cálculo destino.
 * @param {string} tipoEjecucion - 'MANUAL' o 'TRIGGER_AUTOMATICO'.
 * @param {string} estado - 'EXITO', 'ADVERTENCIA', o 'ERROR'.
 * @param {number} exitosos - Cantidad de archivos procesados correctamente.
 * @param {number} fallidos - Cantidad de archivos que dieron error.
 * @param {number} totalFilas - Total de filas consolidadas.
 * @param {number} duracionMs - Tiempo de ejecución en milisegundos.
 * @param {string} detalles - Mensajes detallados o log de errores.
 */
function registrarAuditoria(ss, tipoEjecucion, estado, exitosos, fallidos, totalFilas, duracionMs, detalles) {
  try {
    var nombreHoja = CONFIG.NOMBRE_HOJA_AUDITORIA || "Log_Auditoria";
    var sheet = ss.getSheetByName(nombreHoja);
    
    if (!sheet) {
      sheet = ss.insertSheet(nombreHoja);
      var encabezados = [
        "Fecha y Hora", 
        "Tipo Ejecución", 
        "Estado", 
        "Archivos Éxito", 
        "Archivos Error", 
        "Filas Consolidadas", 
        "Duración (s)", 
        "Detalles / Errores"
      ];
      sheet.getRange(1, 1, 1, encabezados.length).setValues([encabezados]);
      
      // Estilo visual del encabezado de auditoría
      var headerRange = sheet.getRange(1, 1, 1, encabezados.length);
      headerRange.setBackground("#1B365D")
                 .setFontColor("#FFFFFF")
                 .setFontWeight("bold")
                 .setHorizontalAlignment("center");
      sheet.setFrozenRows(1);
    }
    
    var fechaActual = Utilities.formatDate(new Date(), CONFIG.ZONA_HORARIA || "America/La_Paz", "yyyy-MM-dd HH:mm:ss");
    var duracionSegundos = (duracionMs / 1000).toFixed(2);
    
    var nuevaFila = [
      fechaActual,
      tipoEjecucion,
      estado,
      exitosos,
      fallidos,
      totalFilas,
      duracionSegundos,
      detalles
    ];
    
    sheet.appendRow(nuevaFila);
    
    // Aplicar color al estado según el resultado
    var ultimaFila = sheet.getLastRow();
    var celdaEstado = sheet.getRange(ultimaFila, 3);
    if (estado === "EXITO") {
      celdaEstado.setBackground("#D4EDDA").setFontColor("#155724").setFontWeight("bold");
    } else if (estado === "ADVERTENCIA") {
      celdaEstado.setBackground("#FFF3CD").setFontColor("#856404").setFontWeight("bold");
    } else if (estado === "ERROR") {
      celdaEstado.setBackground("#F8D7DA").setFontColor("#721C24").setFontWeight("bold");
    }
    
  } catch (err) {
    Logger.log("Critical Error in registrarAuditoria: " + err.toString());
  }
}
