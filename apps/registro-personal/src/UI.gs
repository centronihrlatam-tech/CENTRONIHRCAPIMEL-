/**
 * UI.gs - Menú Interactivo en Google Sheets y Acciones Rápidas para Usuarios
 * Senior Apps Script Architecture
 */

/**
 * Se ejecuta automáticamente al abrir el archivo de Google Sheets.
 * Crea el menú de control personalizado.
 */
function onOpen() {
  try {
    var ui = SpreadsheetApp.getUi();
    ui.createMenu("🔄 Consolidación")
      .addItem("▶️ Consolidar Ahora (Manual)", "menuConsolidarManual")
      .addItem("🗂️ Ir a Base de Datos Consolidada", "menuIrConsolidado")
      .addSeparator()
      .addItem("➕ Añadir Nueva Persona", "menuAgregarPersona")
      .addSeparator()
      .addItem("🛠️ Autoconfigurar Proyecto (1 Clic)", "autoconfigurarProyecto")
      .addItem("⏰ Activar Horarios Automáticos (8am, 1pm, 3pm)", "menuConfigurarTriggers")
      .addItem("❌ Desactivar Horarios Automáticos", "menuEliminarTriggers")
      .addSeparator()
      .addSubMenu(ui.createMenu("🧩 Plantillas y entorno")
        .addItem("🚀 Crear entorno completo (Drive + db_per + Planner)", "crearEntornoCompleto")
        .addItem("🗃️ Crear solo la base de datos 'db_per'", "crearPlantillaBaseDatos")
        .addItem("📋 Crear solo la plantilla 'Formato Planner'", "crearPlantillaFormatoPlanner")
        .addItem("📁 Crear solo la estructura de carpetas en Drive", "crearEstructuraCarpetasDrive")
        .addSeparator()
        .addItem("🔍 Verificar entorno y columnas", "verificarEntorno"))
      .addSeparator()
      .addItem("📊 Ir a Hoja de Auditoría", "menuIrAuditoria")
      .addToUi();
  } catch (e) {
    Logger.log("No se pudo crear el menú en UI (Ejecución fuera de contenedor UI): " + e.toString());
  }
}

/**
 * Función que se asigna a cualquier botón o dibujo insertado en la Hoja de Google Sheets.
 * Puede asignarse haciendo clic derecho en un Dibujo > Asignar Script > menuConsolidarManual
 */
function menuConsolidarManual() {
  var ui = null;
  try { ui = SpreadsheetApp.getUi(); } catch (e) {}
  
  var ss = obtenerOCrearMasterSpreadsheet();
  
  try {
    ss.toast("Procesando los archivos de personas. Por favor espera...", "🔄 Consolidando Datos", -1);
  } catch (e) {}
  
  var resultado = ejecutarConsolidacion("MANUAL");
  
  var mensaje = "✅ ¡Consolidación finalizada con éxito!\n\n" +
                "• Archivos procesados con éxito: " + resultado.exitosos + "\n" +
                "• Total de filas consolidadas: " + resultado.totalFilas + "\n" +
                "• Duración: " + resultado.duracionSegundos + " segundos\n\n" +
                "La información ha sido validada y está limpia en la pestaña '" + CONFIG.NOMBRE_HOJA_CONSOLIDADO + "'.";
                
  if (resultado.fallidos > 0) {
    mensaje += "\n\n⚠️ Atención: Ocurrieron errores en " + resultado.fallidos + " archivos. Revisa la pestaña '" + CONFIG.NOMBRE_HOJA_AUDITORIA + "' para más detalles.";
  }

  if (ui) {
    ui.alert("Resultado de Consolidación", mensaje, ui.ButtonSet.OK);
  } else {
    Logger.log(mensaje);
  }
}

/**
 * Navega directamente a la pestaña 'Consolidado_General' (la base de datos).
 * Si el script es standalone, abre la URL de la hoja maestra en una nueva pestaña del navegador.
 * Puede asignarse a un botón gráfico con: menuIrConsolidado
 */
function menuIrConsolidado() {
  var ss = obtenerOCrearMasterSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.NOMBRE_HOJA_CONSOLIDADO);
  
  if (sheet) {
    try {
      ss.setActiveSheet(sheet);
    } catch (e) {
      // Si no puede activar la hoja (standalone), muestra la URL
      var url = ss.getUrl() + "#gid=" + sheet.getSheetId();
      var html = HtmlService.createHtmlOutput(
        '<script>window.open("' + url + '");google.script.host.close();</script>'
      ).setWidth(10).setHeight(10);
      SpreadsheetApp.getUi().showModalDialog(html, "Abriendo Consolidado...");
    }
  } else {
    try {
      SpreadsheetApp.getUi().alert(
        "Información",
        "La pestaña '" + CONFIG.NOMBRE_HOJA_CONSOLIDADO + "' aún no existe. Ejecuta primero '▶️ Consolidar Ahora' o '🛠️ Autoconfigurar Proyecto'.",
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } catch (e) {
      Logger.log("Pestaña Consolidado_General no encontrada.");
    }
  }
}

/**
 * Añade una nueva persona al consolidado.
 * Pide el nombre y la URL del Google Sheet mediante ventanas emergentes.
 * Agrega la persona a la pestaña 'Configuracion_Personas' para que sea incluida
 * en la próxima consolidación (la base de datos crece hacia abajo).
 * Puede asignarse a un botón gráfico con: menuAgregarPersona
 */
function menuAgregarPersona() {
  var ui = SpreadsheetApp.getUi();
  
  // Paso 1: Pedir nombre de la persona
  var respNombre = ui.prompt(
    "➕ Añadir Nueva Persona",
    "Ingresa el nombre completo de la persona:",
    ui.ButtonSet.OK_CANCEL
  );
  
  if (respNombre.getSelectedButton() !== ui.Button.OK) return;
  var nombre = respNombre.getResponseText().trim();
  if (nombre === "") {
    ui.alert("Error", "El nombre no puede estar vacío.", ui.ButtonSet.OK);
    return;
  }

  // Paso 2: Pedir URL del Google Sheet
  var respUrl = ui.prompt(
    "➕ Añadir Nueva Persona",
    "Pega el enlace (URL) del Google Sheet de " + nombre + ":",
    ui.ButtonSet.OK_CANCEL
  );
  
  if (respUrl.getSelectedButton() !== ui.Button.OK) return;
  var url = respUrl.getResponseText().trim();
  if (url === "") {
    ui.alert("Error", "La URL no puede estar vacía.", ui.ButtonSet.OK);
    return;
  }

  // Paso 3: Extraer el ID del Google Sheet desde la URL
  var spreadsheetId = extraerIdDesdeUrl(url);
  if (!spreadsheetId) {
    ui.alert("Error", "No se pudo extraer el ID del Google Sheet de la URL proporcionada.\n\nAsegúrate de pegar un enlace válido, por ejemplo:\nhttps://docs.google.com/spreadsheets/d/XXXXXXXXX/edit", ui.ButtonSet.OK);
    return;
  }

  // Paso 4: Validar que se puede abrir el archivo
  try {
    var ssNuevo = SpreadsheetApp.openById(spreadsheetId);
    Logger.log("Validación: Se abrió correctamente la hoja de " + nombre + " (" + ssNuevo.getName() + ")");
  } catch (err) {
    ui.alert("Error de Acceso", "No se pudo abrir el Google Sheet.\n\nVerifica que:\n• La URL sea correcta.\n• El archivo esté compartido con tu cuenta.\n\nError: " + err.message, ui.ButtonSet.OK);
    return;
  }

  // Paso 5: Agregar a la pestaña 'Configuracion_Personas'
  var ss = obtenerOCrearMasterSpreadsheet();
  var hojaPersonas = ss.getSheetByName("Configuracion_Personas");
  if (!hojaPersonas) {
    hojaPersonas = obtenerOCrearHoja(ss, "Configuracion_Personas");
    var encPersonas = ["N°", "Nombre Persona", "ID Spreadsheet Origen", "ID Carpeta", "Estado"];
    hojaPersonas.getRange(1, 1, 1, encPersonas.length).setValues([encPersonas]);
    hojaPersonas.getRange(1, 1, 1, encPersonas.length)
                .setBackground("#0D9488").setFontColor("#FFFFFF").setFontWeight("bold").setHorizontalAlignment("center");
    hojaPersonas.setFrozenRows(1);
  }

  // Calcular siguiente número disponible
  var ultimaFila = hojaPersonas.getLastRow();
  var nuevoNumero = 1;
  if (ultimaFila >= 2) {
    var numeros = hojaPersonas.getRange(2, 1, ultimaFila - 1, 1).getValues();
    for (var i = 0; i < numeros.length; i++) {
      var n = parseInt(numeros[i][0], 10);
      if (!isNaN(n) && n >= nuevoNumero) {
        nuevoNumero = n + 1;
      }
    }
  }

  // Insertar nueva fila
  hojaPersonas.appendRow([nuevoNumero, nombre, spreadsheetId, "", "ACTIVO"]);

  // Confirmar y preguntar si quiere consolidar ahora
  var confirmacion = ui.alert(
    "✅ Persona Agregada",
    "Se ha registrado exitosamente a:\n\n" +
    "• N°: " + nuevoNumero + "\n" +
    "• Nombre: " + nombre + "\n" +
    "• ID Sheet: " + spreadsheetId + "\n\n" +
    "¿Deseas ejecutar una consolidación ahora para incluir sus datos en la base?",
    ui.ButtonSet.YES_NO
  );

  if (confirmacion === ui.Button.YES) {
    menuConsolidarManual();
  }
}

/**
 * Extrae el ID de un Google Spreadsheet a partir de su URL.
 * Soporta formatos: 
 *   https://docs.google.com/spreadsheets/d/XXXXXXX/edit...
 *   https://docs.google.com/spreadsheets/d/XXXXXXX
 * 
 * @param {string} url - La URL del Google Sheet.
 * @returns {string|null} El ID extraído o null si no se reconoce.
 */
function extraerIdDesdeUrl(url) {
  if (!url) return null;
  
  // Patrón: .../spreadsheets/d/ID_AQUI/... o .../spreadsheets/d/ID_AQUI
  var match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return match[1];
  }
  
  // Si el usuario pegó directamente un ID (sin URL completa)
  if (/^[a-zA-Z0-9_-]{20,}$/.test(url.trim())) {
    return url.trim();
  }
  
  return null;
}

/**
 * Configura los activadores programados desde la interfaz de usuario.
 */
function menuConfigurarTriggers() {
  var ui = SpreadsheetApp.getUi();
  var confirmacion = ui.alert(
    "Configurar Horarios Automáticos",
    "¿Deseas activar la consolidación automática diaria a las 8:00 AM, 13:00 (1:00 PM) y 15:00 (3:00 PM)?",
    ui.ButtonSet.YES_NO
  );
  
  if (confirmacion === ui.Button.YES) {
    var resultado = crearTriggersProgramados();
    ui.alert("Programación Activada", "✅ " + resultado, ui.ButtonSet.OK);
  }
}

/**
 * Elimina los activadores programados desde la interfaz de usuario.
 */
function menuEliminarTriggers() {
  var ui = SpreadsheetApp.getUi();
  var confirmacion = ui.alert(
    "Desactivar Horarios Automáticos",
    "¿Estás seguro de eliminar los activadores automáticos de consolidación?",
    ui.ButtonSet.YES_NO
  );
  
  if (confirmacion === ui.Button.YES) {
    var resultado = eliminarTriggersConsolidacion();
    ui.alert("Programación Desactivada", "ℹ️ " + resultado, ui.ButtonSet.OK);
  }
}

/**
 * Redirecciona a la hoja de auditoría.
 */
function menuIrAuditoria() {
  var ss = obtenerOCrearMasterSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.NOMBRE_HOJA_AUDITORIA);
  if (sheet) {
    ss.setActiveSheet(sheet);
  } else {
    try {
      SpreadsheetApp.getUi().alert("Información", "La hoja de auditoría se creará automáticamente en la primera consolidación.", SpreadsheetApp.ButtonSet.OK);
    } catch (e) {}
  }
}
