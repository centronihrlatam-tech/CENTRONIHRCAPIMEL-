/**
 * Triggers.gs - Gestión Automática de Activadores Horarios (8:00, 13:00, 15:00)
 * Senior Apps Script Architecture
 */

/**
 * Función envoltorio para los triggers automáticos por tiempo.
 */
function ejecutarConsolidacionTrigger() {
  ejecutarConsolidacion("TRIGGER_AUTOMATICO");
}

/**
 * Configura los 3 activadores diarios automáticos (8:00 AM, 13:00 y 15:00).
 * Limpia automáticamente cualquier activador previo de consolidación para evitar duplicados.
 */
function crearTriggersProgramados() {
  // 1. Eliminar activadores existentes para consolidación
  eliminarTriggersConsolidacion();
  
  var horarios = CONFIG.HORARIOS_TRIGGERS || [8, 13, 15];
  var creados = [];
  
  for (var i = 0; i < horarios.length; i++) {
    var hora = horarios[i];
    
    var trigger = ScriptApp.newTrigger("ejecutarConsolidacionTrigger")
      .timeBased()
      .atHour(hora)
      .everyDays(1)
      .inTimezone(CONFIG.ZONA_HORARIA || "America/La_Paz")
      .create();
      
    creados.push(hora + ":00 hrs (ID: " + trigger.getUniqueId() + ")");
  }
  
  var mensaje = "Activadores programados creados exitosamente para los horarios: " + horarios.map(function(h) { return h + ":00"; }).join(", ");
  Logger.log(mensaje);
  
  return mensaje;
}

/**
 * Elimina todos los activadores asociados a la función de consolidación.
 */
function eliminarTriggersConsolidacion() {
  var todosTriggers = ScriptApp.getProjectTriggers();
  var contador = 0;
  
  for (var i = 0; i < todosTriggers.length; i++) {
    var trigger = todosTriggers[i];
    var funcionAsociada = trigger.getHandlerFunction();
    
    if (funcionAsociada === "ejecutarConsolidacionTrigger" || funcionAsociada === "ejecutarConsolidacion") {
      ScriptApp.deleteTrigger(trigger);
      contador++;
    }
  }
  
  var msg = "Se eliminaron " + contador + " activadores previos de consolidación.";
  Logger.log(msg);
  return msg;
}
