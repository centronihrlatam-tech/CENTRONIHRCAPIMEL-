/**
 * Consolidation.gs - Lógica Principal de Consolidación y Normalización de Datos
 * Senior Apps Script Architecture
 */

/**
 * Función principal invocada manualmente por el menú, botón o automáticamente por Triggers.
 * @param {string} [tipoOrigen='MANUAL'] - Origen de la llamada ('MANUAL' o 'TRIGGER_AUTOMATICO')
 */
function ejecutarConsolidacion(tipoOrigen) {
  var inicioTiempo = new Date().getTime();
  var modoEjecucion = (typeof tipoOrigen === "string") ? tipoOrigen : "MANUAL";
  
  // Resuelve la Hoja Maestra (activa, guardada en ScriptProperties o recién creada)
  var ssDestino = obtenerOCrearMasterSpreadsheet();
  var hojaConsolidado = obtenerOCrearHoja(ssDestino, CONFIG.NOMBRE_HOJA_CONSOLIDADO);
  
  var exitosos = 0;
  var fallidos = 0;
  var totalFilasConsolidadas = 0;
  var listaErrores = [];
  
  var bufferDatosMaster = [];
  var encabezadoMaster = null;
  var timestampConsolidacion = Utilities.formatDate(new Date(), CONFIG.ZONA_HORARIA, "yyyy-MM-dd HH:mm:ss");

  // Obtener la lista activa de personas (desde la hoja 'Configuracion_Personas' o desde CONFIG)
  var personasActivas = obtenerListaPersonasActivas(ssDestino);
  Logger.log("Iniciando consolidación para " + personasActivas.length + " personas...");

  // Límite de seguridad de tiempo para evitar timeout en Apps Script (4.5 minutos = 270,000 ms)
  var MAX_DURACION_MS = 270000;

  // Iterar sobre el catálogo de personas
  for (var i = 0; i < personasActivas.length; i++) {
    // Control preventivo de tiempo
    var tiempoTranscurrido = new Date().getTime() - inicioTiempo;
    if (tiempoTranscurrido > MAX_DURACION_MS) {
      var msgTimeout = "Advertencia: Se alcanzó el límite de tiempo de ejecución de seguridad (4.5 min). Se procesaron " + i + " de " + personasActivas.length + " personas.";
      Logger.log(msgTimeout);
      listaErrores.push(msgTimeout);
      break;
    }

    var persona = personasActivas[i];
    var nombrePersona = persona.nombre;
    var numPersona = persona.numero;
    var spreadsheetId = persona.id;
    
    if (!spreadsheetId || spreadsheetId.trim() === "") {
      fallidos++;
      listaErrores.push("Persona #" + numPersona + " (" + nombrePersona + "): ID de archivo vacío.");
      continue;
    }
    
    try {
      var ssOrigen = SpreadsheetApp.openById(spreadsheetId);
      var hojas = ssOrigen.getSheets();
      var procesadoConExito = false;
      
      for (var h = 0; h < hojas.length; h++) {
        var hojaOrigen = hojas[h];
        
        // Omitir hojas ocultas
        if (hojaOrigen.isSheetHidden()) {
          continue;
        }

        var nombrePestana = hojaOrigen.getName();
        
        // Excluir pestañas de sistema o auditoría
        if (esPestanaExcluida(nombrePestana)) {
          continue;
        }
        
        var datosHoja = hojaOrigen.getDataRange().getDisplayValues();
        if (!datosHoja || datosHoja.length < 2) {
          // Hoja vacía o solo contiene 1 fila (encabezado sin datos)
          continue;
        }
        
        // La primera fila de la primera hoja leída define los encabezados base
        var encabezadoFila = datosHoja[0];
        if (!encabezadoMaster) {
          encabezadoMaster = ["N° Persona", "Nombre Persona", "ID Sheet Origen", "Pestaña Origen", "Fecha Consolidación"].concat(encabezadoFila);
        }
        
        // Procesar filas de datos (a partir de la fila index 1)
        for (var f = 1; f < datosHoja.length; f++) {
          var filaActual = datosHoja[f];
          
          // Validar que la fila no esté completamente vacía
          if (esFilaVacia(filaActual)) {
            continue;
          }
          
          // Construir fila consolidada con metadatos de trazabilidad
          var filaConMetadatos = [
            numPersona,
            nombrePersona,
            spreadsheetId,
            nombrePestana,
            timestampConsolidacion
          ].concat(filaActual);
          
          bufferDatosMaster.push(filaConMetadatos);
          totalFilasConsolidadas++;
        }
        
        procesadoConExito = true;
      }
      
      if (procesadoConExito) {
        exitosos++;
      } else {
        exitosos++; // Contabiliza si abrió correctamente sin hojas válidas
      }
      
    } catch (err) {
      fallidos++;
      var msgError = "Persona #" + numPersona + " (" + nombrePersona + "): " + err.message;
      listaErrores.push(msgError);
      Logger.log("Error leyendo spreadsheet: " + msgError);
    }
  }

  // Eliminar columnas completamente en blanco antes de escribir
  var resultadoFiltrado = eliminarColumnasEnBlanco(encabezadoMaster, bufferDatosMaster);
  var encabezadoLimpio = resultadoFiltrado.encabezadoLimpio;
  var bufferLimpio = resultadoFiltrado.filasLimpias;

  // Escribir datos validados y filtrados en la hoja Consolidado_General
  escribirConsolidadoEnHoja(hojaConsolidado, encabezadoLimpio, bufferLimpio);

  var finTiempo = new Date().getTime();
  var duracionMs = finTiempo - inicioTiempo;
  var estadoFinal = "EXITO";
  if (fallidos > 0 && exitosos > 0) {
    estadoFinal = "ADVERTENCIA";
  } else if (fallidos > 0 && exitosos === 0) {
    estadoFinal = "ERROR";
  }
  
  var detalleFinal = "Consolidación finalizada. Archivos procesados: " + exitosos + "/" + personasActivas.length + ". Total filas: " + totalFilasConsolidadas + ". Columnas finales: " + (encabezadoLimpio ? encabezadoLimpio.length : 0) + ".";
  if (listaErrores.length > 0) {
    detalleFinal += " Errores en: " + listaErrores.join(" | ");
  }

  // Registrar auditoría
  registrarAuditoria(
    ssDestino, 
    modoEjecucion, 
    estadoFinal, 
    exitosos, 
    fallidos, 
    totalFilasConsolidadas, 
    duracionMs, 
    detalleFinal
  );
  
  Logger.log(detalleFinal);
  
  return {
    estado: estadoFinal,
    exitosos: exitosos,
    fallidos: fallidos,
    totalFilas: totalFilasConsolidadas,
    duracionSegundos: (duracionMs / 1000).toFixed(2),
    detalles: detalleFinal,
    masterUrl: ssDestino.getUrl()
  };
}

/**
 * Elimina las columnas que estén completamente en blanco en la matriz de datos consolidados.
 * 
 * @param {Array<string>} encabezado - Arreglo de nombres de columnas.
 * @param {Array<Array<any>>} filas - Matriz de filas consolidadas.
 * @returns {{encabezadoLimpio: Array<string>, filasLimpias: Array<Array<any>>}}
 */
function eliminarColumnasEnBlanco(encabezado, filas) {
  if (!filas || filas.length === 0 || !encabezado || encabezado.length === 0) {
    return { encabezadoLimpio: encabezado, filasLimpias: filas };
  }

  var numCols = encabezado.length;
  var columnasAConservar = [];

  // Evaluar cada columna (las primeras 5 son metadatos de trazabilidad y siempre se conservan)
  for (var col = 0; col < numCols; col++) {
    if (col < 5) {
      columnasAConservar.push(col);
      continue;
    }

    var estaVaciaEnTodasLasFilas = true;
    for (var f = 0; f < filas.length; f++) {
      var val = filas[f][col];
      if (val !== null && val !== undefined && String(val).trim() !== "") {
        estaVaciaEnTodasLasFilas = false;
        break;
      }
    }

    // Conservar la columna solo si contiene al menos un dato no vacío
    if (!estaVaciaEnTodasLasFilas) {
      columnasAConservar.push(col);
    }
  }

  var encabezadoLimpio = columnasAConservar.map(function(cIdx) {
    return encabezado[cIdx];
  });

  var filasLimpias = filas.map(function(row) {
    return columnasAConservar.map(function(cIdx) {
      return row[cIdx];
    });
  });

  Logger.log("Columnas reducidas de " + numCols + " a " + columnasAConservar.length + " (se eliminaron " + (numCols - columnasAConservar.length) + " columnas vacías).");

  return {
    encabezadoLimpio: encabezadoLimpio,
    filasLimpias: filasLimpias
  };
}

/**
 * Escribir masivamente los datos consolidados formateando encabezados y optimizando lotes.
 */
function escribirConsolidadoEnHoja(sheet, encabezado, filas) {
  sheet.clearContents();
  sheet.clearFormats();
  
  if (!encabezado) {
    encabezado = ["N° Persona", "Nombre Persona", "ID Sheet Origen", "Pestaña Origen", "Fecha Consolidación", "Estado / Datos"];
  }
  
  // Escribir Encabezado
  sheet.getRange(1, 1, 1, encabezado.length).setValues([encabezado]);
  
  // Estilo Premium al Encabezado
  var rangeHeader = sheet.getRange(1, 1, 1, encabezado.length);
  rangeHeader.setBackground("#0F172A")
             .setFontColor("#FFFFFF")
             .setFontWeight("bold")
             .setHorizontalAlignment("center");
  sheet.setFrozenRows(1);
  
  if (filas && filas.length > 0) {
    // Normalizar longitud de columnas para evitar inconsistencias
    var maxCols = encabezado.length;
    var filasNormalizadas = filas.map(function(r) {
      if (r.length < maxCols) {
        while (r.length < maxCols) r.push("");
        return r;
      } else if (r.length > maxCols) {
        return r.slice(0, maxCols);
      }
      return r;
    });
    
    // Escritura masiva en bloques de 2000 filas para evitar timeout de memoria
    var tamanoLote = 2000;
    for (var i = 0; i < filasNormalizadas.length; i += tamanoLote) {
      var lote = filasNormalizadas.slice(i, i + tamanoLote);
      sheet.getRange(i + 2, 1, lote.length, maxCols).setValues(lote);
    }
  }

  // Eliminar columnas sobrantes a la derecha para mantener la hoja limpia
  var colsTotalesGrid = sheet.getMaxColumns();
  if (colsTotalesGrid > encabezado.length) {
    sheet.deleteColumns(encabezado.length + 1, colsTotalesGrid - encabezado.length);
  }
}

/**
 * Verifica si una pestaña debe ser ignorada.
 */
function esPestanaExcluida(nombrePestana) {
  if (!nombrePestana) return true;
  var excluidas = (CONFIG.PESTANAS_EXCLUIDAS || []).concat(["Configuracion_Personas"]);
  for (var i = 0; i < excluidas.length; i++) {
    if (nombrePestana.toLowerCase().trim() === excluidas[i].toLowerCase().trim()) {
      return true;
    }
  }
  return false;
}

/**
 * Determina si una fila está totalmente vacía.
 */
function esFilaVacia(fila) {
  if (!fila || fila.length === 0) return true;
  for (var c = 0; c < fila.length; c++) {
    if (fila[c] !== null && fila[c] !== undefined && String(fila[c]).trim() !== "") {
      return false;
    }
  }
  return true;
}

/**
 * Busca u obtiene la hoja especificada en el libro.
 */
function obtenerOCrearHoja(ss, nombreHoja) {
  var sheet = ss.getSheetByName(nombreHoja);
  if (!sheet) {
    sheet = ss.insertSheet(nombreHoja);
  }
  return sheet;
}
