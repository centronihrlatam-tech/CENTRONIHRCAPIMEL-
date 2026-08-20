/*******************************************************************************
 * WebForm_Backend.gs — ALTA DE NUEVO PERSONAL (Web App) + Integración
 * ---------------------------------------------------------------------------
 * Convive en el proyecto existente (Setup.gs, UI.gs, Consolidation.gs, Config.gs)
 * sin modificar su lógica: CONSUME obtenerOCrearMasterSpreadsheet(),
 * obtenerOCrearHoja() y extraerIdDesdeUrl() cuando existen.
 *
 * Flujo (5 pasos granulares, cada uno con su propio try/catch interno vía
 * el paso marcado en el manejador central):
 *   1. registro_db_per       -> ID id_inv + fila en pestaña db_per (mapeo dinámico)
 *   2. subida_documentos     -> Base64 -> carpeta "Pasaportes y CI"/[nombre_comp]
 *   3. estructura_drive      -> subcarpeta por cargo + carpeta usuario + clon Planner
 *                              + carpeta de respaldo "RESPALDO - [nombre_comp]"
 *   4. integracion_consolidador -> fila en Configuracion_Personas de la Hoja Maestra
 *
 * Respuestas al Frontend: {status:'success', ...} | {status:'error', step, message}
 ******************************************************************************/

// ============================================================
// 1) CONFIGURACIÓN DEL WEB FORM (namespace propio: no toca CONFIG)
// ------------------------------------------------------------
// Los identificadores de Drive/Sheets NO están en el código: se leen de las
// Propiedades del script mediante Env.gs. Ver README.md → "Configuración".
// ============================================================
var WFRM = {
  // Getters: la lectura es diferida (en tiempo de acceso), de modo que no
  // depende del orden de carga de archivos y refleja cambios de propiedades.
  get SPREADSHEET_ID()        { return envCached('SPREADSHEET_ID'); },        // pestaña db_per
  get SHEET_NAME()            { return envCached('SHEET_NAME', 'db_per'); },
  get ROOT_FOLDER_ID()        { return envCached('ROOT_FOLDER_ID'); },        // categorías de cargo
  get PASAPORTES_FOLDER_ID()  { return envCached('PASAPORTES_FOLDER_ID'); },  // pasaportes y CI
  get FOTOS_FOLDER_ID()       { return envCached('FOTOS_FOLDER_ID'); },       // fotografías
  get TEMPLATE_FILE_ID()      { return envCached('TEMPLATE_FILE_ID'); },      // plantilla Formato Planner
  // Solo se usa como fallback autónomo si el proyecto no incluye Setup.gs.
  get MASTER_SPREADSHEET_ID() { return envCached('MASTER_SPREADSHEET_ID'); },
  CONSOLIDADOR_HOJA: 'Configuracion_Personas',
  MAX_FILE_BYTES: 5 * 1024 * 1024,                       // 5 MB
  EXT_PERMITIDAS: ['pdf', 'jpg', 'jpeg', 'png'],
  EXT_FOTO: ['jpg', 'jpeg', 'png']
};

// Propiedades imprescindibles para que el formulario pueda operar.
var WFRM_REQUERIDAS = ['SPREADSHEET_ID', 'ROOT_FOLDER_ID', 'TEMPLATE_FILE_ID'];

/**
 * Devuelve un resumen del formulario apto para logs: sin datos personales.
 * Evita volcar CI, fecha de nacimiento, teléfono, correo o adjuntos Base64 a
 * Cloud Logging, donde quedarían retenidos y accesibles a terceros.
 */
function resumenSeguroForm(form) {
  if (!form) return '{}';
  var f = form || {};
  return JSON.stringify({
    cargo: f.cargo || '',
    pais: f.pais || '',
    estado: f.estado || '',
    tiene_documento: !!(f.documentoBase64 || f.docBase64 || f.archivoBase64),
    tiene_foto: !!(f.fotoBase64),
    campos: Object.keys(f).length
  });
}

// ============================================================
// 2) ENTRY POINT WEB APP
// ============================================================
function doGet() {
  Logger.log('[WebForm] doGet() sirviendo Web App...');
  try {
    return HtmlService.createTemplateFromFile('WebForm_Index')
      .evaluate()
      .setTitle('Alta de Nuevo Personal')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch (e) {
    Logger.log('[WebForm] doGet ERROR: ' + e.message);
    return ContentService.createTextOutput('Error al cargar la app: ' + e.message)
      .setMimeType(ContentService.MimeType.TEXT);
  }
}

// Permite incrustar WebForm_Script.html desde WebForm_Index.html
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ============================================================
// 3) FUNCIÓN PRINCIPAL (invocada por google.script.run)
// ============================================================
function registrarPersonal(form) {
  var lock = LockService.getScriptLock();
  var paso = 'inicio';
  try {
    Logger.log('[WebForm] INICIO. Metadatos: ' + resumenSeguroForm(form));

    // ---- Bloqueo anti-duplicados (doble clic / doble pestaña) ----
    if (!lock.tryLock(30000)) {
      return { status: 'error', step: 'lock', message: 'Otra solicitud está en proceso. Inténtalo en unos segundos.' };
    }

    // ---- PASO 0a: Configuración del despliegue ----
    paso = 'configuracion';
    var cfg = envValidar(WFRM_REQUERIDAS);
    if (!cfg.ok) {
      Logger.log('[WebForm] Configuración incompleta: ' + cfg.faltantes.join(', '));
      return {
        status: 'error',
        step: paso,
        message: 'El servicio no está configurado (faltan propiedades del script: ' +
                 cfg.faltantes.join(', ') + '). Contacta al administrador.'
      };
    }

    // ---- PASO 0b: Validación server-side ----
    paso = 'validacion';
    var msg = validarFormulario(form);
    if (msg) return { status: 'error', step: paso, message: msg };

    // ---- PASO 1: Generación de id_inv + registro en db_per ----
    paso = 'registro_db_per';
    var db = registrarEnDbPer(form);
    var idInv = db.idInv;
    var nombreUnico = db.nombreUnico;
    var cargoFinal = db.cargoFinal;
    Logger.log('[WebForm] id_inv=' + idInv + ' | nomenclatura="' + nombreUnico + '"');

    // ---- PASO 2: Subida de documentos (CI / pasaporte) ----
    paso = 'subida_documentos';
    if (form.documentos && form.documentos.base64) {
      guardarDocumentoIdentidad(form, idInv);
    } else {
      Logger.log('[WebForm] Sin documento adjunto (opcional).');
    }

    // ---- PASO 2.1: Subida de foto de perfil (opcional) ----
    paso = 'foto_perfil';
    var fotoUrl = null;
    if (form.foto && form.foto.base64) {
      fotoUrl = guardarFotoPerfil(form, idInv);
      Logger.log('[WebForm] Foto de perfil guardada: ' + fotoUrl);
    } else {
      Logger.log('[WebForm] Sin foto de perfil adjunta (opcional).');
    }

    // ---- PASO 3: Estructura Drive (carpeta + clon Planner + respaldo) ----
    paso = 'estructura_drive';
    var drive = crearEstructuraDrive(cargoFinal, form.nombre_comp, nombreUnico);

    // ---- PASO 3.1: Link de la carpeta de la persona en db_per ----
    registrarLinkCarpetaDbPer(db, drive.folderUrl);

    // ---- PASO 3.2: Link de la foto en "Imagen actual de los trabajadores" ----
    if (fotoUrl) {
      registrarLinkImagenDbPer(db, fotoUrl);
    }

    // ---- PASO 4: Integración con el sistema consolidador ----
    paso = 'integracion_consolidador';
    var numConsolidador = integrarConsolidador(form, drive);
    Logger.log('[WebForm] Integrado en Configuracion_Personas con N°=' + numConsolidador);

    Logger.log('[WebForm] FIN OK. id_inv=' + idInv);
    return {
      status: 'success',
      id_inv: idInv,
      numeroConsolidador: numConsolidador,
      folderUrl: drive.folderUrl,
      fileUrl: drive.fileUrl,
      backupFolderId: drive.backupFolderId,
      fotoUrl: fotoUrl || ''
    };

  } catch (e) {
    Logger.log('[WebForm] EXCEPCIÓN en paso "' + paso + '": ' + (e.stack || e.message));
    return {
      status: 'error',
      step: paso,
      message: 'Fallo en [' + paso + ']: ' + e.message +
               ' | Revisa permisos de Sheets/Drive y el Log (Ejecuciones).'
    };
  } finally {
    try { lock.releaseLock(); } catch (e) { /* lock no adquirido */ }
  }
}

// ============================================================
// 4) PASO 1 — REGISTRO EN db_per (mapeo dinámico de columnas)
// ============================================================
function registrarEnDbPer(form) {
  var ss = SpreadsheetApp.openById(WFRM.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(WFRM.SHEET_NAME); // búsqueda ESTRICTA
  if (!sheet) {
    throw new Error('No se encontró la pestaña "' + WFRM.SHEET_NAME + '" (se ignoran las demás).');
  }

  var cargoFinal = resolverCargo(form);
  var paisFinal  = resolverPais(form);
  var idInv      = generarIdInvitado(sheet, form);
  var nombreUnico = form.nombre_comp.trim() + ' - ' + idInv;

  var fila = {
    nombre_comp: form.nombre_comp.trim(),
    nombres:     form.nombres.trim(),
    ap_pat:      form.ap_pat.trim(),
    ap_mat:      form.ap_mat.trim(),
    cargo:       cargoFinal,
    correo:      form.correo.trim(),
    Nacimiento:  form.Nacimiento,
    ci:          String(form.ci),
    celular:     String(form.celular),
    orcid:       form.orcid.trim(),
    pais:        paisFinal,
    estado:      form.estado.trim(),
    pasaporte:   form.pasaporte ? form.pasaporte.trim() : '',
    id_inv:      idInv
  };
  appendRowByHeaders(sheet, fila);

  // Fecha de registro si la columna existe
  if (getColumnIndexByHeader(sheet, 'fecha_registro') !== -1) {
    var fIdx = getColumnIndexByHeader(sheet, 'fecha_registro');
    var fecha = Utilities.formatDate(new Date(), 'America/La_Paz', 'dd/MM/yyyy HH:mm:ss');
    sheet.getRange(sheet.getLastRow(), fIdx).setValue(fecha);
  }

  return { idInv: idInv, nombreUnico: nombreUnico, cargoFinal: cargoFinal, paisFinal: paisFinal, filaIndex: sheet.getLastRow() };
}

function resolverCargo(form) {
  var cargo = String(form.cargo).trim();
  return (cargo.toLowerCase() === 'otro especificar') ? String(form.cargo_otro).trim() : cargo;
}

function resolverPais(form) {
  var pais = String(form.pais).trim();
  return (pais.toLowerCase() === 'otro especificar') ? String(form.pais_otro).trim() : pais;
}

// ============================================================
// 5) GENERACIÓN DE ID: [inicial nombres][inicial ap_pat] + 3 dígitos
//    Ej: último AB056 -> "Ana Bravo" = AB057
// ============================================================
function generarIdInvitado(sheet, form) {
  var prefijo = String(form.nombres).trim().charAt(0).toUpperCase() +
                String(form.ap_pat).trim().charAt(0).toUpperCase();

  var colIndex = getColumnIndexByHeader(sheet, 'id_inv');
  if (colIndex === -1) throw new Error('No existe la columna "id_inv" en db_per.');

  var lastRow = sheet.getLastRow();
  var valores = lastRow > 1 ? sheet.getRange(1, colIndex, lastRow, 1).getValues() : [];
  var maxNum = 0;

  for (var i = 1; i < valores.length; i++) { // fila 0 = encabezado
    var m = String(valores[i][0] || '').trim().match(/(\d{3,})\s*$/);
    if (m) {
      var n = parseInt(m[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  var numero = Utilities.formatString('%03d', maxNum + 1);
  Logger.log('[WebForm] generarIdInvitado: max=' + maxNum + ' -> ' + prefijo + numero);
  return prefijo + numero;
}

// ============================================================
// 6) MAPEO DINÁMICO DE COLUMNAS (sin índices fijos)
// ============================================================
function getColumnIndexByHeader(sheet, headerName) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i]).trim() === headerName) return i + 1;
  }
  return -1;
}

// Búsqueda tolerante (trim + lowercase) para encabezados con variantes de
// mayúsculas/espacios. No interfiere con getColumnIndexByHeader().
function getColumnIndexByHeaderTolerante(sheet, headerName) {
  var objetivo = String(headerName).trim().toLowerCase();
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i]).trim().toLowerCase() === objetivo) return i + 1;
  }
  return -1;
}

function appendRowByHeaders(sheet, data) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = [];
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i]).trim();
    row.push(data.hasOwnProperty(h) ? data[h] : '');
  }
  sheet.appendRow(row);
  // No se registra el contenido de la fila (datos personales); solo su forma.
  Logger.log('[WebForm] Fila escrita en db_per: ' + row.length + ' columnas alineadas a headers.');
}

// ============================================================
// 6.1) LINK DE LA CARPETA DE LA PERSONA EN db_per
//      Escribe el enlace de la carpeta individual (creada en PASO 3)
//      en la columna "CI y Pasaportes escaneados". Búsqueda tolerante;
//      si la columna no existe, es un no-op (no rompe ningún proceso).
// ============================================================
function registrarLinkCarpetaDbPer(db, folderUrl) {
  var ss = SpreadsheetApp.openById(WFRM.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(WFRM.SHEET_NAME);
  if (!sheet) {
    Logger.log('[WebForm] registrarLinkCarpetaDbPer: no existe "' + WFRM.SHEET_NAME + '", se omite.');
    return;
  }
  var col = getColumnIndexByHeaderTolerante(sheet, 'CI y Pasaportes escaneados');
  if (col === -1) {
    Logger.log('[WebForm] registrarLinkCarpetaDbPer: columna "CI y Pasaportes escaneados" no encontrada, se omite.');
    return;
  }
  var fila = (db && db.filaIndex) ? db.filaIndex : sheet.getLastRow();
  sheet.getRange(fila, col).setValue(folderUrl);
  Logger.log('[WebForm] Link de carpeta escrito en db_per fila ' + fila + ': ' + folderUrl);
}

// ============================================================
// 6.2) LINK DE LA FOTO EN db_per
//      Escribe el enlace embebible de la foto de perfil en la
//      columna "Imagen actual de los trabajadores". Búsqueda
//      tolerante; si la columna no existe, es un no-op.
// ============================================================
function registrarLinkImagenDbPer(db, photoUrl) {
  var ss = SpreadsheetApp.openById(WFRM.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(WFRM.SHEET_NAME);
  if (!sheet) {
    Logger.log('[WebForm] registrarLinkImagenDbPer: no existe "' + WFRM.SHEET_NAME + '", se omite.');
    return;
  }
  var col = getColumnIndexByHeaderTolerante(sheet, 'Imagen actual de los trabajadores');
  if (col === -1) {
    Logger.log('[WebForm] registrarLinkImagenDbPer: columna "Imagen actual de los trabajadores" no encontrada, se omite.');
    return;
  }
  var fila = (db && db.filaIndex) ? db.filaIndex : sheet.getLastRow();
  sheet.getRange(fila, col).setValue(photoUrl);
  Logger.log('[WebForm] Link de foto escrito en db_per fila ' + fila + ': ' + photoUrl);
}

// ============================================================
// 7) PASO 2 — SUBIDA DE DOCUMENTOS (Pasaportes y CI)
// ============================================================
function guardarDocumentoIdentidad(form, idInv) {
  var doc = form.documentos;

  var root = DriveApp.getFolderById(WFRM.PASAPORTES_FOLDER_ID);
  var subcarpeta = getOrCreateSubfolder(root, form.nombre_comp.trim());
  Logger.log('[WebForm] Subcarpeta documentos: ' + subcarpeta.getName());

  var bytes = Utilities.base64Decode(doc.base64);
  var mime = doc.mimeType || 'application/pdf';
  var nombreArchivo = sanearNombreArchivo(doc.fileName || ('CI_' + form.nombre_comp.trim() + '_' + idInv + '.pdf'));

  var archivo = subcarpeta.createFile(Utilities.newBlob(bytes, mime, nombreArchivo));
  Logger.log('[WebForm] Documento guardado: ' + archivo.getName() + ' (' + archivo.getId() + ')');
  return archivo.getUrl();
}

function sanearNombreArchivo(nombre) {
  return String(nombre).replace(/[\\/:*?"<>|]/g, '_').trim();
}

// ============================================================
// 7.1) PASO 2.1 — SUBIDA DE FOTO DE PERFIL (opcional)
//      Guarda la imagen JPG/PNG en FOTOS_FOLDER_ID con el nombre
//      "[nombre_comp] - [id_inv].ext". Idempotente ante reintentos
//      (reutiliza/sobrescribe el archivo del mismo nombre).
//      Devuelve un enlace EMBEBIBLE (uc?export=view) para usarlo
//      directamente en <img> (p. ej. desde Lovable). La foto se
//      comparte como "cualquier persona con el enlace" para que
//      pueda cargarse fuera del dominio de Drive.
// ============================================================
function guardarFotoPerfil(form, idInv) {
  var doc = form.foto;
  var nombreBase = sanearNombreArchivo(String(form.nombre_comp).trim() + ' - ' + idInv);
  var ext = String(doc.fileName || '').split('.').pop().toLowerCase();
  if (!ext || WFRM.EXT_FOTO.indexOf(ext) === -1) ext = 'jpg';
  var mime = (ext === 'png') ? 'image/png' : 'image/jpeg';
  var nombreArchivo = nombreBase + '.' + ext;

  var carpeta = DriveApp.getFolderById(WFRM.FOTOS_FOLDER_ID);
  var it = carpeta.getFilesByName(nombreArchivo);
  var archivo;
  if (it.hasNext()) {
    // Reintento idempotente: sobrescribe el mismo archivo (una foto por persona)
    archivo = it.next();
    archivo.setContent(Utilities.base64Decode(doc.base64));
    archivo.setMimeType(mime);
    Logger.log('[WebForm] Foto de perfil sobrescrita (reintento): ' + nombreArchivo);
  } else {
    archivo = carpeta.createFile(Utilities.newBlob(Utilities.base64Decode(doc.base64), mime, nombreArchivo));
    Logger.log('[WebForm] Foto de perfil creada: ' + nombreArchivo + ' (' + archivo.getId() + ')');
  }

  // Permiso "cualquier persona con el enlace" (best-effort: si falla, no bloquea el registro)
  try {
    archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    Logger.log('[WebForm] AVISO: no se pudo compartir la foto "' + nombreArchivo + '": ' + e.message);
  }

  return 'https://drive.google.com/uc?export=view&id=' + archivo.getId();
}

// ============================================================
// 8) PASO 3 — ESTRUCTURA DRIVE (categorías + clon + respaldo)
// ============================================================
function getTipoSubcarpeta(cargo) {
  var c = String(cargo).trim().toLowerCase();
  if (c.indexOf('pasante') !== -1) return 'PASANTE';
  if (c.indexOf('becario') !== -1) return 'BECARIO';
  if (c.indexOf('asistente de investigacion') !== -1) return 'ASISTENTES_INVESTIGACION';
  return 'COLABORADORES';
}

function getOrCreateSubfolder(parentFolder, nombre) {
  var it = parentFolder.getFoldersByName(nombre);
  if (it.hasNext()) return it.next();
  var nueva = parentFolder.createFolder(nombre);
  Logger.log('[WebForm] Carpeta creada: "' + nombre + '" (' + nueva.getId() + ')');
  return nueva;
}

function crearEstructuraDrive(cargoFinal, nombreComp, nombreUnico) {
  var root = DriveApp.getFolderById(WFRM.ROOT_FOLDER_ID);
  var tipo = getTipoSubcarpeta(cargoFinal);
  Logger.log('[WebForm] Cargo="' + cargoFinal + '" -> Subcarpeta="' + tipo + '"');

  // 8.1 Carpeta individual [nombre_comp] - [id_inv] dentro de la categoría
  var subcategoria = getOrCreateSubfolder(root, tipo);
  var carpetaUsuario = getOrCreateSubfolder(subcategoria, nombreUnico);

  // 8.2 Clonación del Planner (idempotente ante reintentos)
  var fileIt = carpetaUsuario.getFilesByName(nombreUnico);
  var archivoClon;
  if (fileIt.hasNext()) {
    archivoClon = fileIt.next();
    Logger.log('[WebForm] Planner ya clonado (reintento).');
  } else {
    archivoClon = DriveApp.getFileById(WFRM.TEMPLATE_FILE_ID).makeCopy(nombreUnico, carpetaUsuario);
    Logger.log('[WebForm] Planner clonado: ' + archivoClon.getId());
  }

  // 8.3 Renombrar hoja activa del clon
  var ssClon = SpreadsheetApp.openById(archivoClon.getId());
  if (ssClon.getActiveSheet().getName() !== nombreUnico) {
    ssClon.getActiveSheet().setName(nombreUnico);
  }

  // 8.4 Carpeta de respaldo vacía: "RESPALDO - [nombre_comp]"
  var backup = getOrCreateSubfolder(carpetaUsuario, 'RESPALDO - ' + nombreComp);

  return {
    folderUrl: 'https://drive.google.com/drive/folders/' + carpetaUsuario.getId(),
    fileUrl: 'https://docs.google.com/spreadsheets/d/' + archivoClon.getId() + '/edit',
    spreadsheetId: archivoClon.getId(),
    backupFolderId: backup.getId()
  };
}

// ============================================================
// 9) PASO 4 — INTEGRACIÓN CON EL CONSOLIDADOR (Configuracion_Personas)
// ============================================================
function integrarConsolidador(form, drive) {
  // 9.1 Resolver la Hoja Maestra: usa Setup.gs si existe; si no, resolución autónoma.
  var ss = null;
  if (typeof obtenerOCrearMasterSpreadsheet === 'function') {
    ss = obtenerOCrearMasterSpreadsheet();
  } else {
    Logger.log('[WebForm] obtenerOCrearMasterSpreadsheet() no existe -> usando resolución autónoma.');
    ss = resolverHojaMaestraAutonoma();
  }
  if (!ss) {
    throw new Error('No se pudo localizar la Hoja Maestra. Soluciones: ' +
                    '(1) agregar Setup.gs al proyecto, o ' +
                    '(2) fijar WFRM.MASTER_SPREADSHEET_ID con el ID de la Hoja Maestra.');
  }

  // 9.2 Localizar (o crear con headers si falta) la pestaña Configuracion_Personas
  var sheet = ss.getSheetByName(WFRM.CONSOLIDADOR_HOJA);
  if (!sheet) {
    if (typeof obtenerOCrearHoja === 'function') {
      sheet = obtenerOCrearHoja(ss, WFRM.CONSOLIDADOR_HOJA);
    } else {
      sheet = ss.insertSheet(WFRM.CONSOLIDADOR_HOJA); // fallback autónomo
    }
    var enc = ['N°', 'Nombre Persona', 'ID Spreadsheet Origen', 'ID Carpeta', 'Estado'];
    sheet.getRange(1, 1, 1, enc.length).setValues([enc]);
    sheet.getRange(1, 1, 1, enc.length)
         .setBackground('#0D9488').setFontColor('#FFFFFF').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  // 9.3 Mapeo dinámico de columnas del consolidador
  var idx = {
    num:     getColumnIndexByHeader(sheet, 'N°'),
    nombre:  getColumnIndexByHeader(sheet, 'Nombre Persona'),
    spread:  getColumnIndexByHeader(sheet, 'ID Spreadsheet Origen'),
    carpeta: getColumnIndexByHeader(sheet, 'ID Carpeta'),
    estado:  getColumnIndexByHeader(sheet, 'Estado')
  };
  var nombresCol = { num: 'N°', nombre: 'Nombre Persona', spread: 'ID Spreadsheet Origen', carpeta: 'ID Carpeta', estado: 'Estado' };
  for (var k in idx) {
    if (idx[k] === -1) throw new Error('Falta la columna "' + nombresCol[k] + '" en ' + WFRM.CONSOLIDADOR_HOJA + '.');
  }

  // 9.4 N° secuencial: mismo método que menuAgregarPersona() (máximo + 1)
  var numero = calcularSiguienteNumero(sheet, idx.num);

  // 9.5 ID Spreadsheet Origen: se guarda una fórmula HYPERLINK que muestra el
  //     enlace completo pero cuyo VALOR (label) es el ID puro. Así la celda se
  //     ve como URL para el usuario, mientras obtenerListaPersonasActivas()
  //     (lee con getDisplayValues) y ejecutarConsolidacion() (openById) siguen
  //     recibiendo el ID sin modificar lógica existente.
  var urlCompleta = 'https://docs.google.com/spreadsheets/d/' + drive.spreadsheetId + '/edit';
  var idSpreadsheet = '=HYPERLINK("' + urlCompleta + '","' + drive.spreadsheetId + '")';

  // 9.6 Estado: mapeo para el consolidador. obtenerListaPersonasActivas() solo
  //     incluye filas con estado "ACTIVO" o vacío; "Vigente" -> ACTIVO.
  var estado = mapearEstadoConsolidador(form.estado);

  // 9.7 Insertar fila alineada a los headers (nunca índices fijos)
  var fila = new Array(sheet.getLastColumn()).fill('');
  fila[idx.num - 1]     = numero;
  fila[idx.nombre - 1]  = form.nombre_comp.trim();
  fila[idx.spread - 1]  = idSpreadsheet;
  fila[idx.carpeta - 1] = drive.backupFolderId;
  fila[idx.estado - 1]  = estado;
  sheet.appendRow(fila);

  Logger.log('[WebForm] Configuracion_Personas: fila N°' + numero + ' agregada.');
  return numero;
}

// Fallback autónomo de obtenerOCrearMasterSpreadsheet() (Setup.gs), por si el
// Web Form corre en un proyecto separado que no incluye Setup.gs.
function resolverHojaMaestraAutonoma() {
  var ss = null;

  // 1. Hoja activa (solo aplica si el script está enlazado a un contenedor)
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { ss = null; }

  // 2. ID configurado en WFRM.MASTER_SPREADSHEET_ID (recomendado)
  if (!ss && WFRM.MASTER_SPREADSHEET_ID) {
    try { ss = SpreadsheetApp.openById(WFRM.MASTER_SPREADSHEET_ID); }
    catch (e) { Logger.log('[WebForm] No se pudo abrir WFRM.MASTER_SPREADSHEET_ID: ' + e.message); ss = null; }
  }

  // 3. ID guardado por autoconfigurarProyecto() en Script Properties
  if (!ss) {
    var idGuardado = PropertiesService.getScriptProperties().getProperty('MASTER_SPREADSHEET_ID');
    if (idGuardado) {
      try { ss = SpreadsheetApp.openById(idGuardado); }
      catch (e) { Logger.log('[WebForm] No se pudo abrir MASTER_SPREADSHEET_ID de properties: ' + e.message); ss = null; }
    }
  }
  return ss;
}

function calcularSiguienteNumero(sheet, colNum) {
  var ultimaFila = sheet.getLastRow();
  var nuevo = 1;
  if (ultimaFila >= 2) {
    var valores = sheet.getRange(2, colNum, ultimaFila - 1, 1).getValues();
    for (var i = 0; i < valores.length; i++) {
      var n = parseInt(valores[i][0], 10);
      if (!isNaN(n) && n >= nuevo) nuevo = n + 1;
    }
  }
  Logger.log('[WebForm] Siguiente N° en consolidador: ' + nuevo);
  return nuevo;
}

function mapearEstadoConsolidador(estadoFrontend) {
  var e = String(estadoFrontend || '').trim().toUpperCase();
  return (e === 'RETIRADO') ? 'RETIRADO' : 'ACTIVO'; // "Vigente" y cualquier otro -> ACTIVO
}

// ============================================================
// 10) VALIDACIÓN SERVER-SIDE
// ============================================================
function validarFormulario(form) {
  if (!form || typeof form !== 'object') return 'No se recibieron datos del formulario.';

  var obligatorios = ['nombre_comp', 'nombres', 'ap_pat', 'ap_mat', 'cargo',
                      'correo', 'Nacimiento', 'ci', 'celular', 'orcid', 'pais', 'estado'];
  for (var i = 0; i < obligatorios.length; i++) {
    if (form[obligatorios[i]] === undefined || String(form[obligatorios[i]]).trim() === '') {
      return 'El campo obligatorio "' + obligatorios[i] + '" está vacío.';
    }
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.correo.trim())) return 'Correo electrónico inválido.';
  if (!/^https?:\/\/[^\s$.?#].[^\s]*$/i.test(form.orcid.trim())) return 'ORCID debe ser una URL válida (https://...).';
  if (!/^\d+$/.test(String(form.ci))) return 'El CI debe contener solo números.';
  if (!/^\d+$/.test(String(form.celular))) return 'El celular debe contener solo números.';
  if (isNaN(Date.parse(form.Nacimiento))) return 'Fecha de nacimiento inválida.';

  var cargo = String(form.cargo).trim().toLowerCase();
  if (cargo === 'otro especificar' && String(form.cargo_otro || '').trim() === '') {
    return 'Debes especificar el cargo en "Otro especificar".';
  }
  var pais = String(form.pais).trim().toLowerCase();
  if (pais === 'otro especificar' && String(form.pais_otro || '').trim() === '') {
    return 'Debes especificar el país en "Otro especificar".';
  }

  // Validación del documento (opcional pero estricta si llega)
  if (form.documentos) {
    var nombreDoc = String(form.documentos.fileName || '');
    var ext = nombreDoc.split('.').pop().toLowerCase();
    if (WFRM.EXT_PERMITIDAS.indexOf(ext) === -1) {
      return 'El documento debe ser PDF, JPG, JPEG o PNG.';
    }
    var bytesEstimados = Math.floor((String(form.documentos.base64 || '').length * 3) / 4);
    if (bytesEstimados > WFRM.MAX_FILE_BYTES) {
      return 'El documento supera el tamaño máximo de 5 MB.';
    }
  }

  // Validación de la foto de perfil (opcional pero estricta si llega)
  if (form.foto) {
    var nombreFoto = String(form.foto.fileName || '');
    var extFoto = nombreFoto.split('.').pop().toLowerCase();
    if (WFRM.EXT_FOTO.indexOf(extFoto) === -1) {
      return 'La foto de perfil debe ser JPG o PNG.';
    }
    var bytesFoto = Math.floor((String(form.foto.base64 || '').length * 3) / 4);
    if (bytesFoto > WFRM.MAX_FILE_BYTES) {
      return 'La foto de perfil supera el tamaño máximo de 5 MB.';
    }
  }
  return null;
}

// ============================================================
// 11) MIGRACIÓN RETROACTIVA DE FOTOS ("Imagen actual de los trabajadores")
// ---------------------------------------------------------------------------
// USO:
//   1. Colocar las fotos en FOTOS_FOLDER_ID con el nombre
//      "[nombre_comp] - [id_inv].jpg|jpeg|png" (mismo formato del formulario).
//      Ej: "Juan Perez - MA057.jpg" (coincidencia insensible a mayúsculas).
//   2. Ejecutar MANUALMENTE la función migrarFotosExistentes() desde el editor
//      de Apps Script (una sola vez; es idempotente, se puede repetir).
// NO toca filas que ya tengan enlace; solo completa las vacías.
// Devuelve un resumen: { actualizadas, yaCompletas, sinFoto }.
// ============================================================
function migrarFotosExistentes() {
  var ss = SpreadsheetApp.openById(WFRM.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(WFRM.SHEET_NAME);
  if (!sheet) throw new Error('No existe la pestaña "' + WFRM.SHEET_NAME + '".');

  var idxNombre = getColumnIndexByHeader(sheet, 'nombre_comp');
  var idxId     = getColumnIndexByHeader(sheet, 'id_inv');
  var idxFoto   = getColumnIndexByHeaderTolerante(sheet, 'Imagen actual de los trabajadores');
  if (idxNombre === -1 || idxId === -1) {
    throw new Error('Faltan las columnas "nombre_comp" / "id_inv" en db_per.');
  }
  if (idxFoto === -1) {
    throw new Error('No existe la columna "Imagen actual de los trabajadores" en db_per.');
  }

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { actualizadas: 0, yaCompletas: 0, sinFoto: 0 };

  var datos = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  var carpeta = DriveApp.getFolderById(WFRM.FOTOS_FOLDER_ID);

  var actualizadas = 0, yaCompletas = 0, sinFoto = 0;

  for (var i = 0; i < datos.length; i++) {
    var fila = i + 2;
    var nombre = String(datos[i][idxNombre - 1] || '').trim();
    var idInv  = String(datos[i][idxId - 1] || '').trim();
    var valorActual = String(datos[i][idxFoto - 1] || '').trim();

    if (!nombre || !idInv) continue; // fila vacía / sin datos
    if (valorActual) { yaCompletas++; continue; } // ya enlazada: no tocar

    var url = buscarFotoEnCarpeta(carpeta, nombre, idInv);
    if (url) {
      sheet.getRange(fila, idxFoto).setValue(url);
      actualizadas++;
      Logger.log('[Migracion] Fila ' + fila + ' (' + idInv + '): foto enlazada.');
    } else {
      sinFoto++;
      Logger.log('[Migracion] Fila ' + fila + ' (' + idInv + ' - ' + nombre + '): SIN foto en la carpeta.');
    }
  }

  Logger.log('[Migracion] FIN: ' + actualizadas + ' enlazada(s), ' + yaCompletas +
             ' ya completa(s), ' + sinFoto + ' sin foto.');
  return { actualizadas: actualizadas, yaCompletas: yaCompletas, sinFoto: sinFoto };
}

// Busca "[nombre] - [id_inv].jpg/jpeg/png" (insensible a mayúsculas), la
// comparte "cualquier persona con el enlace" y devuelve el enlace embebible.
function buscarFotoEnCarpeta(carpeta, nombre, idInv) {
  var base = sanearNombreArchivo(nombre + ' - ' + idInv).toLowerCase();
  var it = carpeta.getFiles();
  var archivo = null;

  while (it.hasNext()) {
    var f = it.next();
    var name = f.getName();
    var ext = name.split('.').pop().toLowerCase();
    if (WFRM.EXT_FOTO.indexOf(ext) === -1) continue; // solo imágenes permitidas
    var sinExt = name.replace(/\.[^.]+$/, '').trim().toLowerCase();
    if (sinExt === base) { archivo = f; break; }
  }

  if (!archivo) return null;

  try {
    archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    Logger.log('[Migracion] AVISO: no se pudo compartir "' + archivo.getName() + '": ' + e.message);
  }
  return 'https://drive.google.com/uc?export=view&id=' + archivo.getId();
}