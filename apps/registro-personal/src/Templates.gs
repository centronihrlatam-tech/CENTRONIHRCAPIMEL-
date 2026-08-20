/**
 * Templates.gs - Generación de las plantillas de Google Sheets y Drive
 * ---------------------------------------------------------------------------
 * Permite reconstruir TODO el entorno desde cero sin datos preexistentes:
 *
 *   crearEntornoCompleto()          Ejecuta los 4 pasos en orden (recomendado).
 *   crearPlantillaBaseDatos()       Spreadsheet con la pestaña 'db_per'.
 *   crearPlantillaFormatoPlanner()  Spreadsheet plantilla que se clona por persona.
 *   crearEstructuraCarpetasDrive()  Carpetas raíz, categorías, documentos y fotos.
 *   verificarEntorno()              Diagnóstico del entorno ya configurado.
 *
 * Cada función guarda automáticamente los IDs generados en las Propiedades del
 * script (ver Env.gs), de modo que ningún identificador se escribe en el código.
 * Por seguridad, NO sobreescribe una propiedad que ya tenga valor: para
 * regenerar un recurso, borra primero su propiedad.
 *
 * La estructura declarada aquí es la misma que documenta
 * docs/ESTRUCTURA_DE_DATOS.md y replican los CSV de templates/.
 */

// ============================================================
// 1) DEFINICIÓN DE LAS PLANTILLAS (fuente única de verdad)
// ============================================================
var PLANTILLAS = {

  // --- Pestaña db_per: base de datos de personal ---
  DB_PER: {
    hoja: 'db_per',
    nombreArchivo: 'Base de Datos de Personal (db_per)',
    // Orden sugerido. El código localiza cada columna por su NOMBRE, así que
    // puedes reordenarlas o insertar columnas propias sin romper nada.
    columnas: [
      { nombre: 'nombre_comp',  ancho: 260, nota: 'Nombre completo. Obligatorio. Se usa para nombrar la carpeta: "[nombre_comp] - [id_inv]".' },
      { nombre: 'nombres',      ancho: 150, nota: 'Nombres de pila. Obligatorio. Su inicial forma la 1ª letra de id_inv.' },
      { nombre: 'ap_pat',       ancho: 150, nota: 'Apellido paterno. Obligatorio. Su inicial forma la 2ª letra de id_inv.' },
      { nombre: 'ap_mat',       ancho: 150, nota: 'Apellido materno. Obligatorio.' },
      { nombre: 'cargo',        ancho: 200, nota: 'Obligatorio. Determina la subcarpeta de Drive.', lista: ['Asistente de investigacion', 'Pasante', 'Becario', 'Coordinador', 'Otro especificar'] },
      { nombre: 'correo',       ancho: 230, nota: 'Correo electrónico. Obligatorio, validado por formato.' },
      { nombre: 'Nacimiento',   ancho: 120, nota: 'Fecha de nacimiento. Obligatorio.', formato: 'dd/MM/yyyy' },
      { nombre: 'ci',           ancho: 110, nota: 'Documento de identidad. Obligatorio, solo dígitos.', formato: '@' },
      { nombre: 'celular',      ancho: 120, nota: 'Teléfono. Obligatorio, solo dígitos.', formato: '@' },
      { nombre: 'orcid',        ancho: 240, nota: 'URL de ORCID. Obligatorio, validado como URL.' },
      { nombre: 'pais',         ancho: 90,  nota: 'Obligatorio.', lista: ['BOL', 'GUA', 'COL', 'Otro especificar'] },
      { nombre: 'estado',       ancho: 110, nota: 'Obligatorio. "Retirado" se propaga como RETIRADO al consolidador.', lista: ['Vigente', 'Retirado'] },
      { nombre: 'pasaporte',    ancho: 140, nota: 'Opcional.' },
      { nombre: 'id_inv',       ancho: 100, nota: 'Generado por el servidor (2 iniciales + 3 dígitos). No lo edites a mano.' },
      { nombre: 'fecha_registro', ancho: 160, nota: 'Opcional. Si existe, el backend escribe la fecha y hora del alta.', formato: '@' },
      { nombre: 'CI y Pasaportes escaneados', ancho: 260, nota: 'Opcional. El backend escribe aquí el enlace a la carpeta personal en Drive.' },
      { nombre: 'Imagen actual de los trabajadores', ancho: 260, nota: 'Opcional. El backend escribe aquí el enlace a la fotografía.' }
    ]
  },

  // --- Plantilla que se clona en la carpeta de cada persona ---
  PLANNER: {
    hoja: 'Planner',
    nombreArchivo: 'Formato Planner (PLANTILLA)',
    // Contrato con el consolidador: fila 1 = encabezados, datos desde la fila 2,
    // sin celdas combinadas y sin filas de título por encima.
    columnas: [
      { nombre: 'Fecha',        ancho: 110, formato: 'dd/MM/yyyy' },
      { nombre: 'Actividad',    ancho: 320 },
      { nombre: 'Proyecto',     ancho: 200 },
      { nombre: 'Horas',        ancho: 80,  formato: '0.0' },
      { nombre: 'Estado',       ancho: 130, lista: ['Pendiente', 'En proceso', 'Concluido'] },
      { nombre: 'Entregable',   ancho: 220 },
      { nombre: 'Observaciones', ancho: 320 }
    ]
  },

  // --- Pestañas de la Hoja Maestra (las crea también Setup.gs) ---
  CONFIGURACION_PERSONAS: {
    hoja: 'Configuracion_Personas',
    columnas: [
      { nombre: 'N°', ancho: 60 },
      { nombre: 'Nombre Persona', ancho: 260 },
      { nombre: 'ID Spreadsheet Origen', ancho: 320 },
      { nombre: 'ID Carpeta', ancho: 320 },
      { nombre: 'Estado', ancho: 110, lista: ['ACTIVO', 'RETIRADO'] }
    ]
  },

  CONSOLIDADO_GENERAL: {
    hoja: 'Consolidado_General',
    // A estas 5 columnas de trazabilidad se concatenan, en tiempo de ejecución,
    // los encabezados reales de la primera pestaña de origen que se lea.
    columnas: [
      { nombre: 'N° Persona', ancho: 80 },
      { nombre: 'Nombre Persona', ancho: 240 },
      { nombre: 'ID Sheet Origen', ancho: 300 },
      { nombre: 'Pestaña Origen', ancho: 160 },
      { nombre: 'Fecha Consolidación', ancho: 170 }
    ]
  },

  LOG_AUDITORIA: {
    hoja: 'Log_Auditoria',
    columnas: [
      { nombre: 'Fecha y Hora', ancho: 170 },
      { nombre: 'Tipo Ejecución', ancho: 150 },
      { nombre: 'Estado', ancho: 110 },
      { nombre: 'Archivos Éxito', ancho: 120 },
      { nombre: 'Archivos Error', ancho: 120 },
      { nombre: 'Filas Consolidadas', ancho: 150 },
      { nombre: 'Duración (s)', ancho: 110 },
      { nombre: 'Detalles / Errores', ancho: 420 }
    ]
  }
};

// Subcarpetas de categoría por cargo (deben coincidir con el enrutado del backend).
var SUBCARPETAS_CATEGORIA = ['ASISTENTES_INVESTIGACION', 'PASANTE', 'BECARIO', 'COLABORADORES'];

var COLOR_ENCABEZADO = '#0D9488';

// ============================================================
// 2) ARRANQUE COMPLETO DESDE CERO
// ============================================================
/**
 * Crea todo el entorno (Drive + Sheets) y deja las propiedades configuradas.
 * Ejecútalo una sola vez en un proyecto nuevo.
 */
function crearEntornoCompleto() {
  var resumen = [];

  var drive = crearEstructuraCarpetasDrive();
  resumen.push(drive.mensaje);

  var db = crearPlantillaBaseDatos();
  resumen.push(db.mensaje);

  var planner = crearPlantillaFormatoPlanner();
  resumen.push(planner.mensaje);

  var texto = 'ENTORNO CREADO\n\n' + resumen.join('\n\n') +
              '\n\nSiguiente paso: ejecuta autoconfigurarProyecto() para crear la ' +
              'Hoja Maestra (Consolidado_General, Log_Auditoria, Configuracion_Personas) ' +
              'y los triggers programados.';

  Logger.log(texto);
  mostrarAlerta('Plantillas creadas', texto);
  return texto;
}

// ============================================================
// 3) PLANTILLA: BASE DE DATOS db_per
// ============================================================
function crearPlantillaBaseDatos() {
  var existente = envGet('SPREADSHEET_ID');
  if (existente) {
    var msgExistente = 'SPREADSHEET_ID ya está configurado (' + idAbreviado(existente) + '). ' +
                       'No se crea otra base de datos. Borra la propiedad si quieres regenerarla.';
    Logger.log('[Templates] ' + msgExistente);
    return { creado: false, id: existente, mensaje: msgExistente };
  }

  var plantilla = PLANTILLAS.DB_PER;
  var ss = SpreadsheetApp.create(plantilla.nombreArchivo);
  var hoja = ss.getSheets()[0];
  hoja.setName(plantilla.hoja);

  aplicarPlantillaEnHoja(hoja, plantilla.columnas);
  hoja.getRange('A2:Z1000').setVerticalAlignment('middle');

  envSet('SPREADSHEET_ID', ss.getId());
  envSet('SHEET_NAME', plantilla.hoja);

  var mensaje = 'Base de datos creada: "' + plantilla.nombreArchivo + '"\n' +
                'Pestaña: ' + plantilla.hoja + ' (' + plantilla.columnas.length + ' columnas)\n' +
                'URL: ' + ss.getUrl() + '\n' +
                'Propiedad SPREADSHEET_ID guardada.';
  Logger.log('[Templates] ' + mensaje);
  return { creado: true, id: ss.getId(), url: ss.getUrl(), mensaje: mensaje };
}

// ============================================================
// 4) PLANTILLA: FORMATO PLANNER (se clona por persona)
// ============================================================
function crearPlantillaFormatoPlanner() {
  var existente = envGet('TEMPLATE_FILE_ID');
  if (existente) {
    var msgExistente = 'TEMPLATE_FILE_ID ya está configurado (' + idAbreviado(existente) + '). ' +
                       'No se crea otra plantilla. Borra la propiedad si quieres regenerarla.';
    Logger.log('[Templates] ' + msgExistente);
    return { creado: false, id: existente, mensaje: msgExistente };
  }

  var plantilla = PLANTILLAS.PLANNER;
  var ss = SpreadsheetApp.create(plantilla.nombreArchivo);
  var hoja = ss.getSheets()[0];
  hoja.setName(plantilla.hoja);

  aplicarPlantillaEnHoja(hoja, plantilla.columnas);

  // El consolidador lee la fila 1 como encabezado: nada de títulos combinados
  // por encima ni pestañas ocultas con datos.
  hoja.getRange(1, 1, 1, plantilla.columnas.length)
      .setNote('No insertes filas ni títulos por encima: el consolidador toma la fila 1 como encabezado.');

  envSet('TEMPLATE_FILE_ID', ss.getId());

  var raiz = envGet('ROOT_FOLDER_ID');
  if (raiz) {
    try {
      // Mueve la plantilla junto a la estructura del proyecto, si ya existe.
      DriveApp.getFileById(ss.getId()).moveTo(DriveApp.getFolderById(raiz).getParents().next());
    } catch (e) {
      Logger.log('[Templates] No se pudo mover la plantilla junto a la carpeta raíz: ' + e.message);
    }
  }

  var mensaje = 'Plantilla Planner creada: "' + plantilla.nombreArchivo + '"\n' +
                'URL: ' + ss.getUrl() + '\n' +
                'Propiedad TEMPLATE_FILE_ID guardada.\n' +
                'Ajusta libremente sus columnas: el consolidador es genérico.';
  Logger.log('[Templates] ' + mensaje);
  return { creado: true, id: ss.getId(), url: ss.getUrl(), mensaje: mensaje };
}

// ============================================================
// 5) ESTRUCTURA DE CARPETAS EN DRIVE
// ============================================================
function crearEstructuraCarpetasDrive() {
  var lineas = [];
  var contenedor = null;

  // Carpeta raíz de categorías por cargo
  var rootId = envGet('ROOT_FOLDER_ID');
  if (rootId) {
    lineas.push('ROOT_FOLDER_ID ya configurado (' + idAbreviado(rootId) + '): no se recrea.');
  } else {
    contenedor = DriveApp.createFolder('Automatizacion Personal');
    var raiz = contenedor.createFolder('Categorias de cargo');
    SUBCARPETAS_CATEGORIA.forEach(function (nombre) { raiz.createFolder(nombre); });
    envSet('ROOT_FOLDER_ID', raiz.getId());
    lineas.push('Carpeta raíz creada con las subcarpetas ' + SUBCARPETAS_CATEGORIA.join(', ') +
                '.\nURL: ' + raiz.getUrl());
  }

  // Carpeta de documentos de identidad
  var pasaportesId = envGet('PASAPORTES_FOLDER_ID');
  if (pasaportesId) {
    lineas.push('PASAPORTES_FOLDER_ID ya configurado (' + idAbreviado(pasaportesId) + '): no se recrea.');
  } else {
    var padreDocs = contenedor || DriveApp.getRootFolder();
    var docs = padreDocs.createFolder('Pasaportes y CI');
    envSet('PASAPORTES_FOLDER_ID', docs.getId());
    lineas.push('Carpeta de documentos de identidad creada.\nURL: ' + docs.getUrl() +
                '\nATENCIÓN: restringe su acceso a los responsables del tratamiento (ver SECURITY.md).');
  }

  // Carpeta de fotografías
  var fotosId = envGet('FOTOS_FOLDER_ID');
  if (fotosId) {
    lineas.push('FOTOS_FOLDER_ID ya configurado (' + idAbreviado(fotosId) + '): no se recrea.');
  } else {
    var padreFotos = contenedor || DriveApp.getRootFolder();
    var fotos = padreFotos.createFolder('Fotografias');
    envSet('FOTOS_FOLDER_ID', fotos.getId());
    lineas.push('Carpeta de fotografías creada.\nURL: ' + fotos.getUrl());
  }

  var mensaje = lineas.join('\n\n');
  Logger.log('[Templates] ' + mensaje);
  return { mensaje: mensaje };
}

// ============================================================
// 6) DIAGNÓSTICO DEL ENTORNO
// ============================================================
/**
 * Comprueba que las propiedades estén definidas, que los recursos sean
 * accesibles y que la pestaña db_per tenga las columnas que el código espera.
 */
function verificarEntorno() {
  var lineas = [];
  var errores = 0;

  // --- Propiedades y accesibilidad de los recursos ---
  var recursos = [
    { clave: 'SPREADSHEET_ID', tipo: 'sheet', obligatoria: true },
    { clave: 'ROOT_FOLDER_ID', tipo: 'folder', obligatoria: true },
    { clave: 'TEMPLATE_FILE_ID', tipo: 'file', obligatoria: true },
    { clave: 'PASAPORTES_FOLDER_ID', tipo: 'folder', obligatoria: false },
    { clave: 'FOTOS_FOLDER_ID', tipo: 'folder', obligatoria: false },
    { clave: 'MASTER_SPREADSHEET_ID', tipo: 'sheet', obligatoria: false }
  ];

  recursos.forEach(function (r) {
    var valor = envGet(r.clave);
    if (!valor) {
      lineas.push((r.obligatoria ? 'ERROR   ' : 'aviso   ') + r.clave + ': sin definir.');
      if (r.obligatoria) errores++;
      return;
    }
    try {
      var nombre;
      if (r.tipo === 'folder')      nombre = DriveApp.getFolderById(valor).getName();
      else if (r.tipo === 'sheet')  nombre = SpreadsheetApp.openById(valor).getName();
      else                          nombre = DriveApp.getFileById(valor).getName();
      lineas.push('OK      ' + r.clave + ' -> "' + nombre + '"');
    } catch (e) {
      lineas.push('ERROR   ' + r.clave + ': no accesible (' + e.message + ').');
      errores++;
    }
  });

  // --- Columnas de db_per ---
  var idDb = envGet('SPREADSHEET_ID');
  if (idDb) {
    try {
      var nombreHoja = envGet('SHEET_NAME', PLANTILLAS.DB_PER.hoja);
      var hoja = SpreadsheetApp.openById(idDb).getSheetByName(nombreHoja);
      if (!hoja) {
        lineas.push('ERROR   No existe la pestaña "' + nombreHoja + '" en la base de datos.');
        errores++;
      } else {
        var presentes = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0]
                            .map(function (h) { return String(h).trim().toLowerCase(); });
        var obligatorias = ['nombre_comp', 'nombres', 'ap_pat', 'ap_mat', 'cargo', 'correo',
                            'Nacimiento', 'ci', 'celular', 'orcid', 'pais', 'estado', 'id_inv'];
        var faltan = obligatorias.filter(function (c) { return presentes.indexOf(c.toLowerCase()) === -1; });
        if (faltan.length) {
          lineas.push('ERROR   Faltan columnas en "' + nombreHoja + '": ' + faltan.join(', '));
          errores++;
        } else {
          lineas.push('OK      Columnas obligatorias de "' + nombreHoja + '" completas.');
        }

        var opcionales = ['pasaporte', 'fecha_registro', 'CI y Pasaportes escaneados',
                          'Imagen actual de los trabajadores'];
        var ausentes = opcionales.filter(function (c) { return presentes.indexOf(c.toLowerCase()) === -1; });
        if (ausentes.length) {
          lineas.push('aviso   Columnas opcionales ausentes (se omiten en silencio): ' + ausentes.join(', '));
        }
      }
    } catch (e) {
      lineas.push('ERROR   No se pudo inspeccionar la base de datos: ' + e.message);
      errores++;
    }
  }

  // --- Subcarpetas de categoría ---
  var idRaiz = envGet('ROOT_FOLDER_ID');
  if (idRaiz) {
    try {
      var raiz = DriveApp.getFolderById(idRaiz);
      var faltanCarpetas = SUBCARPETAS_CATEGORIA.filter(function (n) { return !raiz.getFoldersByName(n).hasNext(); });
      if (faltanCarpetas.length) {
        lineas.push('aviso   Subcarpetas de categoría ausentes (el backend las crea al vuelo): ' +
                    faltanCarpetas.join(', '));
      } else {
        lineas.push('OK      Subcarpetas de categoría presentes.');
      }
    } catch (e) {
      lineas.push('ERROR   No se pudo inspeccionar la carpeta raíz: ' + e.message);
      errores++;
    }
  }

  var texto = 'DIAGNÓSTICO DEL ENTORNO\n\n' + lineas.join('\n') + '\n\n' +
              (errores === 0 ? 'Sin errores bloqueantes.' : errores + ' problema(s) a resolver.');
  Logger.log(texto);
  mostrarAlerta('Diagnóstico del entorno', texto);
  return { errores: errores, detalle: lineas };
}

// ============================================================
// 7) UTILIDADES INTERNAS
// ============================================================
/**
 * Escribe los encabezados de una plantilla en una hoja y aplica formato,
 * anchos, notas, formatos de celda y listas de validación.
 */
function aplicarPlantillaEnHoja(hoja, columnas) {
  var nombres = columnas.map(function (c) { return c.nombre; });

  hoja.getRange(1, 1, 1, nombres.length).setValues([nombres]);
  hoja.getRange(1, 1, 1, nombres.length)
      .setBackground(COLOR_ENCABEZADO)
      .setFontColor('#FFFFFF')
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setWrap(true);
  hoja.setFrozenRows(1);

  columnas.forEach(function (col, i) {
    var columna = i + 1;
    if (col.ancho) hoja.setColumnWidth(columna, col.ancho);
    if (col.nota)  hoja.getRange(1, columna).setNote(col.nota);

    var rango = hoja.getRange(2, columna, Math.max(hoja.getMaxRows() - 1, 1), 1);
    if (col.formato) rango.setNumberFormat(col.formato);
    if (col.lista) {
      var regla = SpreadsheetApp.newDataValidation()
        .requireValueInList(col.lista, true)
        .setAllowInvalid(false)
        .setHelpText('Valores admitidos: ' + col.lista.join(' | '))
        .build();
      rango.setDataValidation(regla);
    }
  });

  return hoja;
}

/** Devuelve una versión abreviada de un ID, apta para logs y mensajes. */
function idAbreviado(id) {
  var s = String(id || '');
  return s.length > 10 ? s.substring(0, 6) + '...' : s;
}

/** Muestra una alerta si hay interfaz; si no, solo registra en el log. */
function mostrarAlerta(titulo, mensaje) {
  try {
    SpreadsheetApp.getUi().alert(titulo, mensaje, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    // Ejecución sin interfaz (trigger o editor standalone).
  }
}
