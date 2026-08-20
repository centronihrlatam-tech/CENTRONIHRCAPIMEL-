/*******************************************************************************
 * SISTEMA DE REGISTRO DE INVESTIGADORES — GOOGLE APPS SCRIPT (BACKEND)
 * ---------------------------------------------------------------------------
 * 1. doGet(): sirve el Web App (Index.html + JavaScript.html).
 * 2. registrarInvestigador(): validación server-side, generación de id_inv,
 *    registro en Google Sheets (mapeo DINÁMICO de columnas) y creación de
 *    estructura de carpetas + clonación de plantilla en Google Drive.
 * 3. Tolerancia a fallos: try/catch, LockService anti-duplicados, Logger.log.
 ******************************************************************************/

// ============================================================
// 1) CONSTANTES GLOBALES
// ============================================================
// Los identificadores se leen de las Propiedades del script; no se escriben
// en el código. Configúralos en: Apps Script > Configuración del proyecto >
// Propiedades del script (SPREADSHEET_ID, ROOT_FOLDER_ID, TEMPLATE_FILE_ID).
function _prop(clave) {
  var v = PropertiesService.getScriptProperties().getProperty(clave);
  if (!v || String(v).trim() === '') {
    throw new Error('Falta la propiedad del script "' + clave + '". Ver README.md.');
  }
  return String(v).trim();
}

var SHEET_NAME = 'db_per'; // Pestaña estricta (se ignoran las demás)

// ============================================================
// 2) ENTRY POINT WEB APP
// ============================================================
function doGet() {
  Logger.log('[doGet] Sirviendo Web App...');
  try {
    var html = HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setTitle('Registro de Investigadores')
      .setFaviconUrl('https://ssl.gstatic.com/docs/script/images/favicon.ico')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
    return html;
  } catch (e) {
    Logger.log('[doGet] ERROR: ' + e.message);
    return ContentService
      .createTextOutput('Error al cargar la aplicación: ' + e.message)
      .setMimeType(ContentService.MimeType.TEXT);
  }
}

// Permite incrustar archivos HTML parciales (ej: JavaScript.html)
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ============================================================
// 3) FUNCIÓN PRINCIPAL: REGISTRO DE INVESTIGADOR
//    Invocada desde el frontend vía google.script.run
// ============================================================
function registrarInvestigador(form) {
  var lock = LockService.getScriptLock();
  try {
    // No se registran datos personales en los logs (CI, correo, teléfono, fecha de nacimiento).
    Logger.log('[registrarInvestigador] INICIO. Cargo: ' + (form && form.cargo ? form.cargo : 'n/d'));

    // ---- Bloqueo anti-duplicados (doble clic / doble pestaña) ----
    if (!lock.tryLock(30000)) {
      Logger.log('[registrarInvestigador] No se pudo obtener el lock (posible doble envío).');
      return { status: 'error', message: 'Otra solicitud está en proceso. Inténtalo de nuevo en unos segundos.' };
    }

    // ---- 3.1 Validación server-side ----
    var msg = validarFormulario(form);
    if (msg) {
      Logger.log('[registrarInvestigador] Validación fallida: ' + msg);
      return { status: 'error', message: msg };
    }

    // ---- 3.2 Resolver valores condicionales ("Otro especificar") ----
    var cargoFinal = String(form.cargo).trim();
    if (cargoFinal.toLowerCase() === 'otro especificar') {
      cargoFinal = String(form.cargo_otro).trim();
    }
    var paisFinal = String(form.pais).trim();
    if (paisFinal.toLowerCase() === 'otro especificar') {
      paisFinal = String(form.pais_otro).trim();
    }

    Logger.log('[registrarInvestigador] cargoFinal="' + cargoFinal + '" | paisFinal="' + paisFinal + '"');

    // ---- 3.3 Conexión estricta a la pestaña db_per ----
    var ss = SpreadsheetApp.openById(_prop("SPREADSHEET_ID"));
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      Logger.log('[registrarInvestigador] ERROR: No existe la pestaña "' + SHEET_NAME + '".');
      return { status: 'error', message: 'No se encontró la pestaña "' + SHEET_NAME + '" en la hoja de cálculo.' };
    }

    // ---- 3.4 Generación automática del ID (id_inv) ----
    var letra1 = String(form.nombres).trim().charAt(0).toUpperCase();
    var letra2 = String(form.ap_pat).trim().charAt(0).toUpperCase();
    var idInv  = generarIdInvitado(sheet, letra1 + letra2);
    Logger.log('[registrarInvestigador] ID generado: ' + idInv);

    // ---- 3.5 Nomenclatura única para Drive ----
    var nombreUnico = String(form.nombre_comp).trim() + ' - ' + idInv;
    Logger.log('[registrarInvestigador] Nomenclatura única: ' + nombreUnico);

    // ---- 3.6 Enrutamiento y creación de estructura en Drive ----
    var driveInfo = crearEstructuraDrive(cargoFinal, nombreUnico);
    if (driveInfo.error) {
      Logger.log('[registrarInvestigador] ERROR en Drive: ' + driveInfo.error);
      return { status: 'error', message: driveInfo.error };
    }

    // ---- 3.7 Registro en Google Sheets (mapeo dinámico de columnas) ----
    var colIndex = getColumnIndexByHeader(sheet, 'id_inv');
    var rowData = {
      nombre_comp : String(form.nombre_comp).trim(),
      nombres     : String(form.nombres).trim(),
      ap_pat      : String(form.ap_pat).trim(),
      ap_mat      : String(form.ap_mat).trim(),
      cargo       : cargoFinal,
      correo      : String(form.correo).trim(),
      Nacimiento  : form.Nacimiento,
      ci          : String(form.ci),
      celular     : String(form.celular),
      orcid       : String(form.orcid).trim(),
      pais        : paisFinal,
      estado      : String(form.estado).trim(),
      pasaporte   : form.pasaporte ? String(form.pasaporte).trim() : '',
      id_inv      : idInv
    };
    var fechaReg = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
    var hasFecha = getColumnIndexByHeader(sheet, 'fecha_registro') !== -1;

    appendRowByHeaders(sheet, rowData);
    if (hasFecha) {
      var lastRow = sheet.getLastRow();
      var fIdx = getColumnIndexByHeader(sheet, 'fecha_registro');
      sheet.getRange(lastRow, fIdx).setValue(fechaReg);
    }

    // ---- 3.8 Link de la carpeta de la persona en "CI y Pasaportes escaneados" ----
    // Búsqueda tolerante (trim + mayúsculas/minúsculas) para no depender del
    // formato exacto del encabezado. Si la columna no existe: no-op (no rompe nada).
    var colCarpeta = getColumnIndexByHeaderTolerante(sheet, 'CI y Pasaportes escaneados');
    if (colCarpeta !== -1) {
      sheet.getRange(sheet.getLastRow(), colCarpeta).setValue(driveInfo.folderUrl);
      Logger.log('[registrarInvestigador] Link de carpeta escrito en db_per: ' + driveInfo.folderUrl);
    } else {
      Logger.log('[registrarInvestigador] Columna "CI y Pasaportes escaneados" no encontrada; se omite el link.');
    }

    Logger.log('[registrarInvestigador] FIN OK. id_inv=' + idInv +
               ' | carpetaDrive=' + driveInfo.folderId);

    return {
      status: 'success',
      id_inv: idInv,
      folderId: driveInfo.folderId,
      folderUrl: driveInfo.folderUrl,
      fileUrl: driveInfo.fileUrl,
      message: 'Investigador registrado correctamente.'
    };

  } catch (e) {
    Logger.log('[registrarInvestigador] EXCEPCIÓN: ' + e.stack || e.message);
    return {
      status: 'error',
      message: 'Error inesperado en el servidor: ' + e.message +
               ' (Revisa los permisos de acceso a Sheets/Drive e intenta de nuevo)'
    };
  } finally {
    try { lock.releaseLock(); } catch (e) { /* el lock pudo no adquirirse */ }
  }
}

// ============================================================
// 4) VALIDACIÓN SERVER-SIDE
// ============================================================
function validarFormulario(form) {
  if (!form || typeof form !== 'object') return 'No se recibieron datos del formulario.';

  var obligatorios = [
    'nombre_comp', 'nombres', 'ap_pat', 'ap_mat', 'cargo',
    'correo', 'Nacimiento', 'ci', 'celular', 'orcid', 'pais', 'estado'
  ];
  for (var i = 0; i < obligatorios.length; i++) {
    var v = form[obligatorios[i]];
    if (v === undefined || v === null || String(v).trim() === '') {
      return 'El campo obligatorio "' + obligatorios[i] + '" está vacío.';
    }
  }

  var correo = String(form.correo).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) {
    return 'El correo electrónico no tiene un formato válido.';
  }

  var orcid = String(form.orcid).trim();
  if (!/^https?:\/\/[^\s$.?#].[^\s]*$/i.test(orcid)) {
    return 'El campo ORCID debe ser una URL válida (https://...).';
  }

  if (!/^\d+$/.test(String(form.ci))) return 'El carnet de identidad (ci) debe contener solo números.';
  if (!/^\d+$/.test(String(form.celular))) return 'El celular debe contener solo números.';

  var cargo = String(form.cargo).trim().toLowerCase();
  if (cargo === 'otro especificar' && String(form.cargo_otro || '').trim() === '') {
    return 'Debes especificar el cargo en el campo "Otro especificar".';
  }
  var pais = String(form.pais).trim().toLowerCase();
  if (pais === 'otro especificar' && String(form.pais_otro || '').trim() === '') {
    return 'Debes especificar el país en el campo "Otro especificar".';
  }

  if (isNaN(Date.parse(form.Nacimiento))) {
    return 'La fecha de nacimiento no es válida.';
  }
  return null;
}

// ============================================================
// 5) GENERACIÓN AUTOMÁTICA DE ID (id_inv)
//    [Inicial nombres][Inicial ap_pat] + secuencia de 3 dígitos
//    Ej: último = AB056  ->  nueva ("Ana Bravo") = AB057
// ============================================================
function generarIdInvitado(sheet, prefijo) {
  var colIndex = getColumnIndexByHeader(sheet, 'id_inv');
  if (colIndex === -1) {
    throw new Error('No se encontró la columna "id_inv" en la pestaña "' + SHEET_NAME + '".');
  }
  var lastRow  = sheet.getLastRow();
  var valores  = lastRow > 1 ? sheet.getRange(1, colIndex, lastRow, 1).getValues() : [];
  var maxNum   = 0;

  for (var i = 1; i < valores.length; i++) { // i=0 es el header
    var raw = String(valores[i][0] || '').trim();
    var match = raw.match(/(\d{3,})\s*$/);
    if (match) {
      var n = parseInt(match[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }

  var numero = Utilities.formatString('%03d', maxNum + 1);
  Logger.log('[generarIdInvitado] Máximo anterior=' + maxNum + ' -> Nuevo=' + prefijo + numero);
  return prefijo + numero;
}

// ============================================================
// 6) MAPEO DINÁMICO DE COLUMNAS
//    Lee los headers de la primera fila y busca el índice por NOMBRE.
// ============================================================
function getColumnIndexByHeader(sheet, headerName) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i]).trim() === headerName) {
      return i + 1; // 1-based (columna A = 1)
    }
  }
  return -1;
}

// Búsqueda tolerante (trim + lowercase) para encabezados con variantes de
// mayúsculas/espacios. No interfiere con getColumnIndexByHeader().
function getColumnIndexByHeaderTolerante(sheet, headerName) {
  var objetivo = String(headerName).trim().toLowerCase();
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i]).trim().toLowerCase() === objetivo) {
      return i + 1;
    }
  }
  return -1;
}

// Escribe una fila alineando cada dato según la posición de su header.
function appendRowByHeaders(sheet, data) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = [];
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i]).trim();
    row.push(data.hasOwnProperty(h) ? data[h] : '');
  }
  sheet.appendRow(row);
  Logger.log('[appendRowByHeaders] Fila escrita alineada a headers: ' + JSON.stringify(row));
}

// ============================================================
// 7) SANITIZACIÓN + ENRUTAMIENTO + CREACIÓN DE ESTRUCTURA DRIVE
// ============================================================

// Determina la subcarpeta destino a partir del cargo (trim + toLowerCase).
function getTipoSubcarpeta(cargo) {
  var c = String(cargo).trim().toLowerCase();
  if (c.indexOf('pasante') !== -1) return 'PASANTE';
  if (c.indexOf('becario') !== -1) return 'BECARIO';
  if (c.indexOf('asistente de investigacion') !== -1) return 'ASISTENTES_INVESTIGACION';
  return 'COLABORADORES';
}

// Obtiene la subcarpeta dentro de la raíz, creándola si no existe.
function getOrCreateSubfolder(rootFolder, nombre) {
  var it = rootFolder.getFoldersByName(nombre);
  if (it.hasNext()) {
    Logger.log('[getOrCreateSubfolder] Subcarpeta existente: ' + nombre);
    return it.next();
  }
  var nueva = rootFolder.createFolder(nombre);
  Logger.log('[getOrCreateSubfolder] Subcarpeta creada: ' + nombre + ' (id=' + nueva.getId() + ')');
  return nueva;
}

// Crea la carpeta individual, clona la plantilla, la renombra y renombra su hoja activa.
function crearEstructuraDrive(cargo, nombreUnico) {
  try {
    var root = DriveApp.getFolderById(_prop("ROOT_FOLDER_ID"));
    var tipo = getTipoSubcarpeta(cargo);
    Logger.log('[crearEstructuraDrive] Cargo="' + cargo + '" -> Subcarpeta="' + tipo + '"');

    var subfolder = getOrCreateSubfolder(root, tipo);

    // --- 7.1 Carpeta individual [nombre_comp] - [id_inv] ---
    var folderIt = subfolder.getFoldersByName(nombreUnico);
    var carpetaPersonal;
    if (folderIt.hasNext()) {
      carpetaPersonal = folderIt.next(); // Idempotente ante reintentos
      Logger.log('[crearEstructuraDrive] Carpeta individual ya existía (reintento): ' + nombreUnico);
    } else {
      carpetaPersonal = subfolder.createFolder(nombreUnico);
      Logger.log('[crearEstructuraDrive] Carpeta individual creada: ' + nombreUnico);
    }

    // --- 7.2 Clonación de la plantilla Formato Planner ---
    var fileIt = carpetaPersonal.getFilesByName(nombreUnico);
    var archivoClon;
    if (fileIt.hasNext()) {
      archivoClon = fileIt.next(); // idempotente
      Logger.log('[crearEstructuraDrive] Plantilla ya clonada (reintento): ' + nombreUnico);
    } else {
      var plantilla = DriveApp.getFileById(_prop("TEMPLATE_FILE_ID"));
      archivoClon = plantilla.makeCopy(nombreUnico, carpetaPersonal);
      Logger.log('[crearEstructuraDrive] Plantilla clonada: ' + nombreUnico +
                 ' (id=' + archivoClon.getId() + ')');
    }

    // --- 7.3 Renombrar hoja activa del clon ---
    var archivoSS = SpreadsheetApp.openById(archivoClon.getId());
    var hojaActiva = archivoSS.getActiveSheet();
    if (hojaActiva.getName() !== nombreUnico) {
      hojaActiva.setName(nombreUnico);
      Logger.log('[crearEstructuraDrive] Hoja activa renombrada a: ' + nombreUnico);
    }

    return {
      folderId: carpetaPersonal.getId(),
      folderUrl: 'https://drive.google.com/drive/folders/' + carpetaPersonal.getId(),
      fileUrl: 'https://docs.google.com/spreadsheets/d/' + archivoClon.getId() + '/edit'
    };
  } catch (e) {
    Logger.log('[crearEstructuraDrive] EXCEPCIÓN: ' + e.message +
               ' | stack: ' + (e.stack || 'n/d'));
    return { error: 'Error creando la estructura en Google Drive: ' + e.message +
                    ' | Verifica que la cuenta tenga permisos sobre la carpeta raíz y la plantilla.' };
  }
}