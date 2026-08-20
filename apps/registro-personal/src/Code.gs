/**
 * Code.gs - Punto de Entrada Principal para Google Apps Script
 * Senior Apps Script Architecture
 */

/**
 * Evento al abrir el documento de Google Sheets.
 */
function mainOnOpen(e) {
  onOpen();
}

/**
 * Función principal expuesta para ejecución rápida o pruebas desde el editor.
 */
function testConsolidacion() {
  var res = ejecutarConsolidacion("PRUEBA_MANUAL");
  Logger.log(JSON.stringify(res, null, 2));
}

/**
 * Función para probar la creación de triggers desde el editor.
 */
function testConfigurarTriggers() {
  var res = crearTriggersProgramados();
  Logger.log(res);
}
