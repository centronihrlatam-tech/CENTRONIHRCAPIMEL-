/**
 * AI Planner Bot
 *
 * Automatización de registro de actividades mediante Telegram, Google Apps Script,
 * OpenAI, Google Sheets y Google Drive.
 *
 * La configuración específica de cada despliegue se mantiene fuera del código
 * mediante Google Apps Script Script Properties.
 *
 * Propiedades requeridas:
 * - TELEGRAM_TOKEN
 * - WEBHOOK_SECRET
 * - OPENAI_API_KEY
 * - DIRECTORIO_CARPETAS      (JSON: Telegram user ID -> Drive folder ID)
 * - PLANNERS_CONTRATADOS     (JSON: Telegram user ID -> Sheet ID)
 * - PLANNERS_PASANTES        (JSON: Telegram user ID -> Sheet ID)
 *
 * Propiedades opcionales:
 * - ID_PLANILLA_ANALITICAS
 * - ANALYTICS_USER_ALIASES   (JSON: Telegram user ID -> alias analítico)
 * - SUPPORT_EMAIL
 * - TIME_ZONE
 * - OPENAI_MODEL
 */

// =========================
// CONFIGURACIÓN SEGURA
// =========================

function getScriptProperty_(key, fallback = "") {
  const value = PropertiesService.getScriptProperties().getProperty(key);
  return value !== null && value !== undefined ? value : fallback;
}

function getJsonProperty_(key, fallback = {}) {
  const raw = getScriptProperty_(key, "");
  if (!raw) return fallback;

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`La propiedad ${key} no contiene un JSON válido.`);
  }
}

function getConfig_() {
  return {
    telegramToken: getScriptProperty_("TELEGRAM_TOKEN"),
    webhookSecret: getScriptProperty_("WEBHOOK_SECRET"),
    openaiApiKey: getScriptProperty_("OPENAI_API_KEY"),
    idPlanillaAnaliticas: getScriptProperty_("ID_PLANILLA_ANALITICAS"),
    analyticsUserAliases: getJsonProperty_("ANALYTICS_USER_ALIASES", {}),
    supportEmail: getScriptProperty_("SUPPORT_EMAIL", ""),
    timeZone: getScriptProperty_("TIME_ZONE", "Etc/UTC"),
    openaiModel: getScriptProperty_("OPENAI_MODEL", "gpt-4o-mini"),
    directorioCarpetas: getJsonProperty_("DIRECTORIO_CARPETAS", {}),
    plannersContratados: getJsonProperty_("PLANNERS_CONTRATADOS", {}),
    plannersPasantes: getJsonProperty_("PLANNERS_PASANTES", {})
  };
}

function validarConfiguracion_() {
  const config = getConfig_();

  const requeridas = [
    ["TELEGRAM_TOKEN", config.telegramToken],
    ["WEBHOOK_SECRET", config.webhookSecret],
    ["OPENAI_API_KEY", config.openaiApiKey],
  ];

  const faltantes = requeridas
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (faltantes.length > 0) {
    throw new Error(
      "Faltan propiedades de Script Properties: " + faltantes.join(", ")
    );
  }

  if (config.webhookSecret.length < 32) {
    throw new Error("WEBHOOK_SECRET debe tener al menos 32 caracteres.");
  }

  [
    ["DIRECTORIO_CARPETAS", config.directorioCarpetas],
    ["PLANNERS_CONTRATADOS", config.plannersContratados],
    ["PLANNERS_PASANTES", config.plannersPasantes],
    ["ANALYTICS_USER_ALIASES", config.analyticsUserAliases]
  ].forEach(([nombre, mapa]) => {
    if (!mapa || Array.isArray(mapa) || typeof mapa !== "object") {
      throw new Error("La propiedad " + nombre + " debe ser un objeto JSON.");
    }
    Object.keys(mapa).forEach(id => {
      if (!/^\d+$/.test(id)) {
        throw new Error(nombre + " debe usar IDs numéricos de Telegram como claves.");
      }
    });
  });

  return config;
}


// =========================
// UTILIDADES DE USUARIO
// =========================

function buscarEnDiccionario(diccionario, telegramUserId) {
  if (!diccionario || !telegramUserId) return null;

  const key = String(telegramUserId);
  return Object.prototype.hasOwnProperty.call(diccionario, key)
    ? diccionario[key]
    : null;
}

function identificarUsuario(telegramUserId) {
  const config = getConfig_();

  const plannerContratado = buscarEnDiccionario(
    config.plannersContratados,
    telegramUserId
  );

  if (plannerContratado) {
    return { id: plannerContratado, rol: "contratado" };
  }

  const plannerPasante = buscarEnDiccionario(
    config.plannersPasantes,
    telegramUserId
  );

  if (plannerPasante) {
    return { id: plannerPasante, rol: "pasante" };
  }

  return null;
}

function obtenerAliasAnaliticas_(telegramUserId) {
  const config = getConfig_();
  return buscarEnDiccionario(config.analyticsUserAliases, telegramUserId) || "Sin alias";
}

function obtenerIdTelegram_(from) {
  if (!from || !Number.isSafeInteger(Number(from.id))) return "";
  return String(from.id);
}

function esChatPrivadoDelUsuario_(chat, from) {
  return Boolean(
    chat &&
    from &&
    chat.type === "private" &&
    String(chat.id) === String(from.id)
  );
}

function obtenerOpcionPorIndice_(lista, callbackData, prefijo) {
  if (!Array.isArray(lista) || typeof callbackData !== "string") return "";
  const indice = Number(callbackData.substring(prefijo.length));
  return Number.isInteger(indice) && indice >= 0 && indice < lista.length
    ? lista[indice]
    : "";
}

function sanitizarParaCelda_(value) {
  if (typeof value !== "string") return value;
  const limpio = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  return /^[\s]*[=+\-@]/.test(limpio) ? "'" + limpio : limpio;
}

function textoParaIA_(value) {
  return String(value || "")
    .slice(0, 4000)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[CORREO_REDACTADO]")
    .replace(/https?:\/\/\S+/gi, "[URL_REDACTADA]")
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, "[TELEFONO_REDACTADO]");
}


// =========================
// GOOGLE SHEETS
// =========================

function getUltimaFilaReal(sheet) {
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const data = sheet.getRange(1, 1, lastRow, 5).getDisplayValues();

  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i].some(value => String(value).trim() !== "")) {
      return i + 1;
    }
  }

  return 1;
}


// =========================
// WEBHOOK PRINCIPAL
// =========================

function doPost(e) {
  const config = validarConfiguracion_();

  if (!e || !e.parameter || e.parameter.secret !== config.webhookSecret) {
    return HtmlService.createHtmlOutput("OK");
  }

  if (!e || !e.postData || !e.postData.contents) {
    return HtmlService.createHtmlOutput("OK");
  }

  let data;

  try {
    data = JSON.parse(e.postData.contents);
  } catch (error) {
    return HtmlService.createHtmlOutput("OK");
  }

  if (data.callback_query) {
    manejarBotones(data.callback_query);
    return HtmlService.createHtmlOutput("OK");
  }

  const message = data.message;

  if (!message) {
    return HtmlService.createHtmlOutput("OK");
  }

  if (!esChatPrivadoDelUsuario_(message.chat, message.from)) {
    return HtmlService.createHtmlOutput("OK");
  }

  const chatId = message.chat.id;
  const textoMensaje = message.text || message.caption || "";
  const telegramUserId = obtenerIdTelegram_(message.from);

  if (!telegramUserId) return HtmlService.createHtmlOutput("OK");

  const nombreRemitente =
    message.from.first_name ||
    "usuario";

  const datosUsuario = identificarUsuario(telegramUserId);

  const idCarpetaDestino = buscarEnDiccionario(
    config.directorioCarpetas,
    telegramUserId
  );

  if (!datosUsuario) {
    enviarMensajeTelegram(
      chatId,
      "❌ Hola " +
        nombreRemitente +
        ", no encontré un planner asociado a tu usuario."
    );

    return HtmlService.createHtmlOutput("OK");
  }

  const {
    id: idPlanillaDestino,
    rol
  } = datosUsuario;

  const comandoLower = textoMensaje
    .trim()
    .toLowerCase();


  // =========================
  // COMANDOS
  // =========================

  if (comandoLower === "/start") {
    const msjStart =
      "👋 ¡Hola " +
      nombreRemitente +
      "! El bot está funcionando correctamente y enlazado a tu planner.\n\n" +
      "Para conocer cómo enviar tus actividades y ver todas las funciones, " +
      "escribe y envía en el chat el comando /tutorial";

    enviarMensajeTelegram(
      chatId,
      msjStart
    );

    return HtmlService.createHtmlOutput("OK");
  }


  if (comandoLower === "/tutorial") {
    const msjTutorial =
      "🤖 *TUTORIAL: ¿CÓMO REGISTRAR TUS ACTIVIDADES?* 🤖\n\n" +

      "Este bot utiliza Inteligencia Artificial para entender tus mensajes " +
      "e integrarlos automáticamente en tu planner.\n\n" +

      "📋 *¿Cómo entiende el bot tu mensaje?*\n" +

      "La estructura de lo que escribes se basa directamente en las " +
      "*columnas de tu planner* (los encabezados de tu hoja: " +
      "*tipo, compo, sub_comp, descripción, fecha, hora inicio, hora fin*). " +

      "El bot buscará estas palabras clave en tu texto para saber exactamente " +
      "en qué celda colocar cada dato.\n\n" +

      "Tienes *dos métodos* para registrar tus actividades:\n\n" +

      "---\n\n" +

      "### 🛠️ MÉTODO 1: ESCRITURA LIBRE\n" +

      "Escribe y envía un único mensaje describiendo tu actividad en el chat. " +
      "No importa si lo redactas de forma muy ordenada o totalmente desordenada; " +
      "la IA analizará tu texto, buscará las columnas de tu planner y adaptará " +
      "tus palabras a la etiqueta oficial más cercana de tu hoja de cálculo.\n\n" +

      "📝 *Ejemplo Ordenado:*\n" +

      "`Fecha: 14/07/2026 Tipo: reunión. Compo: General. " +
      "Subcompo: Otro. Tarea: Organización de archivos. " +
      "Hora inicio: 8:30. Hora final: 9:00`\n\n" +

      "📝 *Ejemplo Desordenado:*\n" +

      "`tipo reunion, compo general subcompo otro. " +
      "Organización de archivos de 1000 a 1030. 14/07/26`\n\n" +

      "⚡ *Valores Automáticos:*\n" +

      "• *¿No pusiste Fecha?* El bot registrará automáticamente la fecha del día de *hoy*.\n" +

      "• *¿No pusiste el Tipo?* Si no especificas si es una \"reunión\" o una \"tarea\", " +
      "el bot asumirá que es una *Tarea* por defecto.\n\n" +

      "💡 *Truco de productividad:* Puedes escribir todo el texto cómodamente " +
      "en Telegram desde tu computadora y luego abrir el celular únicamente " +
      "para adjuntar la foto/evidencia y presionar enviar.\n\n" +

      "---\n\n" +

      "### 🎛️ MÉTODO 2: USO DE BOTONES\n" +

      "Si prefieres no escribir todo el texto junto, puedes usar botones " +
      "interactivos mandando comandos específicos:\n\n" +

      "• *Escribe y envía en el chat /tarea*\n" +

      "El bot te mostrará botones interactivos para seleccionar el Tipo, " +
      "luego el Componente, el Subcomponente " +
      "(y el Encargado en caso de ser pasante).\n\n" +

      "_(Nota: Estos botones se generan leyendo tu propio planner. " +
      "Si nunca has usado una etiqueta en las tareas anteriores de tu planner, " +
      "el botón correspondiente no aparecerá)._\n\n" +

      "• *Escribe y envía en el chat /cancelar*\n" +

      "Si estabas usando los botones de `/tarea` para registrar una actividad " +
      "y te equivocaste, o simplemente decides ya no realizar ese registro, " +
      "este comando te permite cancelar el proceso actual.\n\n" +

      "---\n\n" +

      "### 🚦 ¿QUÉ SIGNIFICA EL ESTADO?\n" +

      "• *Proceso:* Aparece si falta algún dato importante o si no has enviado " +
      "una foto/captura como evidencia.\n" +

      "• *Terminado:* Aparece automáticamente cuando envías todos los datos " +
      "completos junto con su respectiva imagen de evidencia.\n\n" +

      "---\n\n" +

      "📩 *Soporte, Dudas o Sugerencias*\n" +

      "Si tienes inconvenientes, ideas de mejora o alguna duda con tu planner, " +
      "puedes escribir al correo de soporte:\n" +

      "📧 " +
      (config.supportEmail || "No configurado");

    enviarMensajeTelegram(
      chatId,
      msjTutorial
    );

    return HtmlService.createHtmlOutput("OK");
  }


  if (comandoLower === "/tarea") {
    enviarBotonesIniciales(chatId);
    return HtmlService.createHtmlOutput("OK");
  }


  if (
    comandoLower === "/cancelar" ||
    comandoLower === "/cancel"
  ) {
    CacheService
      .getScriptCache()
      .remove("tarea_" + telegramUserId);

    enviarMensajeTelegram(
      chatId,
      "🚫 Proceso cancelado. La memoria se ha limpiado. " +
      "Usa /tarea para empezar de nuevo."
    );

    return HtmlService.createHtmlOutput("OK");
  }


  if (comandoLower.startsWith("/")) {
    enviarMensajeTelegram(
      chatId,
      "⚠️ Comando no reconocido. Escribe y envía /tutorial " +
      "para ver los comandos válidos. No se ha registrado ninguna tarea."
    );

    return HtmlService.createHtmlOutput("OK");
  }


  // =========================
  // EVIDENCIA
  // =========================

  const fecha = new Date();

  const fechaFormateada =
    Utilities.formatDate(
      fecha,
      config.timeZone,
      "dd/MM/yyyy"
    );

  let linkEvidencia = "";

  if (
    message.photo &&
    message.photo.length > 0
  ) {

    if (!idCarpetaDestino) {

      linkEvidencia =
        "Error: No tienes una carpeta asignada.";

    } else {

      try {

        const fileId =
          message.photo[
            message.photo.length - 1
          ].file_id;

        const fileResponse =
          UrlFetchApp.fetch(
            "https://api.telegram.org/bot" +
            config.telegramToken +
            "/getFile?file_id=" +
            encodeURIComponent(fileId)
          );

        const fileData =
          JSON.parse(
            fileResponse.getContentText()
          );

        const filePath =
          fileData.result.file_path;

        const fileUrl =
          "https://api.telegram.org/file/bot" +
          config.telegramToken +
          "/" +
          filePath;

        const imageResponse =
          UrlFetchApp.fetch(fileUrl);

        const blob =
          imageResponse.getBlob();

        blob.setName(
          "Evidencia_" +
          Utilities.formatDate(
            new Date(),
            config.timeZone,
            "yyyyMMdd_HHmmss"
          ) +
          ".jpg"
        );

        const folder =
          DriveApp.getFolderById(
            idCarpetaDestino
          );

        const file =
          folder.createFile(blob);

        linkEvidencia =
          file.getUrl();

      } catch (error) {

        linkEvidencia =
          "Error interno al guardar la evidencia.";
      }
    }
  }


  // =========================
  // PROCESAMIENTO CON IA
  // =========================

  const etiquetasReales =
    obtenerEtiquetasUnicas(
      idPlanillaDestino,
      rol
    );

  const datosGPT =
    procesarConGPT(
      textoMensaje,
      etiquetasReales,
      rol
    );


  // =========================
  // CACHE DE BOTONES
  // =========================

  const cache =
    CacheService.getScriptCache();

  const cacheKey =
    "tarea_" + telegramUserId;

  const datosCacheados =
    JSON.parse(
      cache.get(cacheKey) ||
      "{}"
    );

  const tipoFinal =
    datosGPT.tipo ||
    datosCacheados.tipo ||
    "Tarea";

  const compoFinal =
    datosGPT.compo ||
    datosCacheados.compo ||
    "";

  const sub_compFinal =
    datosGPT.sub_comp ||
    datosCacheados.sub_comp ||
    "";

  const encargadoFinal =
    datosGPT.encargado ||
    datosCacheados.encargado ||
    "";

  const descFinal =
    datosGPT.descripcion ||
    "";

  const hInicioFinal =
    datosGPT.horaInicio ||
    "";

  const hFinFinal =
    datosGPT.horaFin ||
    "";

  let fechaFinal =
    fechaFormateada;

  if (
    datosGPT.fecha &&
    datosGPT.fecha !== "HOY" &&
    datosGPT.fecha !== ""
  ) {
    fechaFinal =
      datosGPT.fecha;
  }


  // =========================
  // ESTADO
  // =========================

  let estadoFinal =
    "Proceso";

  if (
    compoFinal !== "" &&
    sub_compFinal !== "" &&
    descFinal !== "" &&
    hInicioFinal !== "" &&
    linkEvidencia !== "" &&
    !linkEvidencia.startsWith("Error")
  ) {
    estadoFinal =
      "Terminado";
  }


  // =========================
  // ESCRITURA EN PLANNER
  // =========================

  const sheet =
    SpreadsheetApp
      .openById(idPlanillaDestino)
      .getActiveSheet();

  const maxCols =
    Math.max(
      sheet.getLastColumn(),
      15
    );

  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        maxCols
      )
      .getValues()[0];

  const ultimaFila =
    getUltimaFilaReal(sheet);

  const nuevaFila =
    ultimaFila + 1;

  const buscarColumna =
    (nombre) =>
      headers.findIndex(
        h =>
          h &&
          h
            .toString()
            .toLowerCase()
            .trim()
            .replace(/\s+/g, " ") ===
          nombre
      );

  const idxRespaldoLink =
    buscarColumna("respaldo - link");

  const idxRespaldo =
    idxRespaldoLink !== -1
      ? idxRespaldoLink
      : buscarColumna("respaldo");

  const columnasAEditar = [
    {
      idx: buscarColumna("tipo"),
      valor: tipoFinal
    },
    {
      idx: buscarColumna("compo"),
      valor: compoFinal
    },
    {
      idx: buscarColumna("sub_comp"),
      valor: sub_compFinal
    },
    {
      idx: buscarColumna("descripcion"),
      valor: descFinal
    },
    {
      idx: buscarColumna("fecha"),
      valor: fechaFinal
    },
    {
      idx: buscarColumna("hora inicio"),
      valor: hInicioFinal
    },
    {
      idx: buscarColumna("hora fin"),
      valor: hFinFinal
    },
    {
      idx: buscarColumna("estado"),
      valor: estadoFinal
    },
    {
      idx: idxRespaldo,
      valor: linkEvidencia
    }
  ];

  if (rol === "pasante") {

    const idxEncargado =
      buscarColumna("encargado");

    if (idxEncargado !== -1) {

      columnasAEditar.push({
        idx: idxEncargado,
        valor: encargadoFinal
      });
    }
  }

  columnasAEditar.forEach(
    col => {

      if (col.idx !== -1) {

        sheet
          .getRange(
            nuevaFila,
            col.idx + 1
          )
          .setValue(
            sanitizarParaCelda_(col.valor)
          );
      }
    }
  );


  cache.remove(cacheKey);


  // =========================
  // ANALÍTICAS
  // =========================

  try {

    if (config.idPlanillaAnaliticas) {

      const masterSheet =
        SpreadsheetApp
          .openById(
            config.idPlanillaAnaliticas
          )
          .getActiveSheet();

      const timestampAnaliticas =
        Utilities.formatDate(
          new Date(),
          config.timeZone,
          "dd/MM/yyyy HH:mm:ss"
        );

      const evidenciaStatus =
        (
          linkEvidencia !== "" &&
          !linkEvidencia.startsWith("Error")
        )
          ? "Con Evidencia"
          : "Sin Evidencia";

      const aliasAnaliticas = obtenerAliasAnaliticas_(telegramUserId);

      masterSheet.appendRow([
        timestampAnaliticas,
        aliasAnaliticas,
        rol,
        estadoFinal,
        evidenciaStatus,
        tipoFinal,
        compoFinal,
        sub_compFinal,
        fechaFinal
      ].map(sanitizarParaCelda_));
    }

  } catch (error) {
    // Evita exponer información sensible del error al usuario.
    console.error(
      "Error registrando analíticas."
    );
  }


  // =========================
  // CONFIRMACIÓN
  // =========================

  let resumenClasificacion =
    compoFinal +
    " / " +
    sub_compFinal;

  if (
    rol === "pasante" &&
    encargadoFinal
  ) {

    resumenClasificacion +=
      " / Enc: " +
      encargadoFinal;
  }

  enviarMensajeTelegram(
    chatId,
    "✅ Registrado en el planner de " +
    nombreRemitente +
    ".\n*Estado:* " +
    estadoFinal +
    "\n*Tarea:* " +
    (descFinal || "Sin descripción") +
    "\n*Clasificación:* " +
    resumenClasificacion
  );

  return HtmlService.createHtmlOutput("OK");
}


// =========================
// BOTONES
// =========================

function manejarBotones(callbackQuery) {

  const config =
    validarConfiguracion_();

  const chatId =
    callbackQuery.message.chat.id;

  const messageId =
    callbackQuery.message.message_id;

  const data =
    callbackQuery.data;

  if (!esChatPrivadoDelUsuario_(callbackQuery.message.chat, callbackQuery.from)) {
    return;
  }

  const telegramUserId = obtenerIdTelegram_(callbackQuery.from);

  if (!telegramUserId || typeof data !== "string") return;

  const datosUsuario =
    identificarUsuario(telegramUserId);

  if (!datosUsuario) {
    return;
  }

  UrlFetchApp.fetch(
    "https://api.telegram.org/bot" +
    config.telegramToken +
    "/answerCallbackQuery",
    {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({
        callback_query_id:
          callbackQuery.id
      })
    }
  );

  if (
    data === "CANCELAR_TODO"
  ) {

    CacheService
      .getScriptCache()
      .remove(
        "tarea_" + telegramUserId
      );

    editarMensajeTelegram(
      chatId,
      messageId,
      "🚫 Proceso cancelado."
    );

    return;
  }

  const cache =
    CacheService.getScriptCache();

  const cacheKey =
    "tarea_" + telegramUserId;

  let estadoActual =
    JSON.parse(
      cache.get(cacheKey) ||
      "{}"
    );

  const {
    id: idPlanilla,
    rol
  } = datosUsuario;

  const etiquetas =
    obtenerEtiquetasUnicas(
      idPlanilla,
      rol
    );

  const filaControles =
    siguientePaso => [
      {
        text: "⏭️ Omitir",
        callback_data:
          "OMITIR_" +
          siguientePaso
      },
      {
        text: "❌ Cancelar",
        callback_data:
          "CANCELAR_TODO"
      }
    ];


  if (
    data.startsWith("TIPO_") ||
    data === "OMITIR_TIPO"
  ) {

    estadoActual.tipo =
      data === "OMITIR_TIPO"
        ? ""
        : data.split("_")[1];

    cache.put(
      cacheKey,
      JSON.stringify(
        estadoActual
      ),
      21600
    );

    let botonesCompo = [];

    etiquetas.compos.forEach(
      (c, index) => {
        botonesCompo.push([
          {
            text: c,
            callback_data: "COMPO_" + index
          }
        ]);
      }
    );

    botonesCompo.push(
      filaControles("COMPO")
    );

    editarMensajeTelegram(
      chatId,
      messageId,
      "Tipo: " +
      (
        estadoActual.tipo ||
        "Tarea (Por defecto)"
      ) +
      "\n\nSelecciona el Componente:",
      {
        inline_keyboard:
          botonesCompo
      }
    );
  }


  else if (
    data.startsWith("COMPO_") ||
    data === "OMITIR_COMPO"
  ) {

    estadoActual.compo =
      data === "OMITIR_COMPO"
        ? ""
        : obtenerOpcionPorIndice_(etiquetas.compos, data, "COMPO_");

    cache.put(
      cacheKey,
      JSON.stringify(
        estadoActual
      ),
      21600
    );

    let botonesSub = [];

    etiquetas.subCompos.forEach(
      (s, index) => {
        botonesSub.push([
          {
            text: s,
            callback_data: "SUB_" + index
          }
        ]);
      }
    );

    botonesSub.push(
      filaControles("SUB")
    );

    editarMensajeTelegram(
      chatId,
      messageId,
      "Componente: " +
      estadoActual.compo +
      "\n\nSelecciona el Subcomponente:",
      {
        inline_keyboard:
          botonesSub
      }
    );
  }


  else if (
    data.startsWith("SUB_") ||
    data === "OMITIR_SUB"
  ) {

    estadoActual.sub_comp =
      data === "OMITIR_SUB"
        ? ""
        : obtenerOpcionPorIndice_(etiquetas.subCompos, data, "SUB_");

    cache.put(
      cacheKey,
      JSON.stringify(
        estadoActual
      ),
      21600
    );

    if (
      rol === "pasante"
    ) {

      let botonesEnc = [];

      etiquetas.encargados.forEach(
        (e, index) => {
          botonesEnc.push([
            {
              text: e,
              callback_data: "ENC_" + index
            }
          ]);
        }
      );

      botonesEnc.push(
        filaControles("ENC")
      );

      editarMensajeTelegram(
        chatId,
        messageId,
        "Selecciona el Encargado:",
        {
          inline_keyboard:
            botonesEnc
        }
      );

    } else {

      editarMensajeTelegram(
        chatId,
        messageId,
        "✅ Etiquetas guardadas.\n\n" +
        "Envía la descripción, hora y foto adjunta para registrar."
      );
    }
  }


  else if (
    data.startsWith("ENC_") ||
    data === "OMITIR_ENC"
  ) {

    estadoActual.encargado =
      data === "OMITIR_ENC"
        ? ""
        : obtenerOpcionPorIndice_(etiquetas.encargados, data, "ENC_");

    cache.put(
      cacheKey,
      JSON.stringify(
        estadoActual
      ),
      21600
    );

    editarMensajeTelegram(
      chatId,
      messageId,
      "✅ Etiquetas guardadas.\n\n" +
      "Envía la descripción, hora y foto adjunta para registrar."
    );
  }
}


function enviarBotonesIniciales(chatId) {

  const teclado = {
    inline_keyboard: [
      [
        {
          text: "Tarea",
          callback_data:
            "TIPO_Tarea"
        },
        {
          text: "Reunión",
          callback_data:
            "TIPO_Reunion"
        }
      ],
      [
        {
          text: "❌ Cancelar",
          callback_data:
            "CANCELAR_TODO"
        }
      ]
    ]
  };

  enviarMensajeTelegram(
    chatId,
    "¿Qué tipo de registro vas a ingresar?",
    teclado
  );
}


// =========================
// ETIQUETAS
// =========================

function obtenerEtiquetasUnicas(
  idPlanilla,
  rol
) {

  try {

    const sheet =
      SpreadsheetApp
        .openById(idPlanilla)
        .getActiveSheet();

    const data =
      sheet
        .getRange(
          2,
          2,
          200,
          4
        )
        .getValues();

    let composSet =
      new Set();

    let subComposSet =
      new Set();

    let encargadosSet =
      new Set();

    data.forEach(
      row => {

        if (row[0]) {
          composSet.add(
            row[0]
              .toString()
              .trim()
          );
        }

        if (row[1]) {
          subComposSet.add(
            row[1]
              .toString()
              .trim()
          );
        }

        if (
          rol === "pasante" &&
          row[3]
        ) {
          encargadosSet.add(
            row[3]
              .toString()
              .trim()
          );
        }
      }
    );

    try {

      const rangoN =
        sheet
          .getRange(
            2,
            14,
            50,
            1
          )
          .getValues();

      const rangoO =
        sheet
          .getRange(
            2,
            15,
            50,
            1
          )
          .getValues();

      rangoN.forEach(
        row => {
          if (row[0]) {
            composSet.add(
              row[0]
                .toString()
                .trim()
            );
          }
        }
      );

      rangoO.forEach(
        row => {
          if (row[0]) {
            subComposSet.add(
              row[0]
                .toString()
                .trim()
            );
          }
        }
      );

      if (
        rol === "pasante"
      ) {

        const rangoP =
          sheet
            .getRange(
              2,
              16,
              50,
              1
            )
            .getValues();

        rangoP.forEach(
          row => {

            if (row[0]) {

              encargadosSet.add(
                row[0]
                  .toString()
                  .trim()
              );
            }
          }
        );
      }

    } catch (error) {
      // Rango opcional.
    }

    return {
      compos:
        Array
          .from(composSet)
          .filter(String),

      subCompos:
        Array
          .from(subComposSet)
          .filter(String),

      encargados:
        Array
          .from(encargadosSet)
          .filter(String)
    };

  } catch (error) {

    return {
      compos: ["General"],
      subCompos: ["Otro"],
      encargados: ["Otro"]
    };
  }
}


// =========================
// OPENAI
// =========================

function procesarConGPT(
  texto,
  etiquetas,
  rol
) {

  const config =
    validarConfiguracion_();

  const url =
    "https://api.openai.com/v1/chat/completions";

  const anioActual =
    Utilities.formatDate(
      new Date(),
      config.timeZone,
      "yyyy"
    );

  let systemPrompt =
    `Eres un asistente de productividad. Extrae los datos del mensaje.
Opciones exactas 'compo': [${etiquetas.compos.join(", ")}].
Opciones exactas 'sub_comp': [${etiquetas.subCompos.join(", ")}].
`;

  if (
    rol === "pasante"
  ) {

    systemPrompt +=
      `Opciones exactas 'encargado': [${etiquetas.encargados.join(", ")}].
`;
  }

  systemPrompt +=
    `Reglas de extracción:
1. "tipo": Clasifica ESTRICTAMENTE como "Tarea" o "Reunion" (respetando la primera letra mayúscula). Si no se especifica explícitamente, devuelve "Tarea".
2. "compo", "sub_comp" ${rol === "pasante" ? 'y "encargado"' : ""}: Selecciona la etiqueta de la lista que mejor coincida. Si escriben algo incompleto, devuelve OBLIGATORIAMENTE la versión oficial idéntica a la lista.
3. "descripcion": Resume la acción en menos de 10 palabras. Debes poder extraer esto incluso si el usuario escribe todo el mensaje en MAYÚSCULAS.
4. "horaInicio" y "horaFin": Formato HH:MM:SS.
5. "fecha": Formato DD/MM/YYYY o "HOY". Estamos en el año ${anioActual}. Si el usuario menciona un día y mes sin año, asigna el año ${anioActual}.

Si NO menciona un dato (excepto "tipo", que debe ser "Tarea" si no se menciona), devuelve "".
No inventes datos.
Devuelve ÚNICAMENTE un JSON válido sin markdown.`;

  const payload = {
    model: config.openaiModel,
    messages: [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: textoParaIA_(texto)
      }
    ],
    temperature: 0.1
  };

  const options = {
    method: "post",
    headers: {
      Authorization:
        "Bearer " +
        config.openaiApiKey,

      "Content-Type":
        "application/json"
    },
    payload:
      JSON.stringify(payload),

    muteHttpExceptions:
      true
  };

  try {

    const response =
      UrlFetchApp.fetch(
        url,
        options
      );

    const statusCode =
      response.getResponseCode();

    if (
      statusCode < 200 ||
      statusCode >= 300
    ) {

      console.error(
        "OpenAI respondió con un estado no exitoso."
      );

      throw new Error(
        "Error al procesar la solicitud de IA."
      );
    }

    const json =
      JSON.parse(
        response.getContentText()
      );

    if (
      !json.choices ||
      !json.choices.length ||
      !json.choices[0].message
    ) {

      throw new Error(
        "Respuesta de IA inesperada."
      );
    }

    let content =
      json
        .choices[0]
        .message
        .content
        .trim();

    if (
      content.startsWith("```json")
    ) {

      content =
        content
          .replace(
            /^```json/,
            ""
          )
          .replace(
            /```$/,
            ""
          )
          .trim();

    } else if (
      content.startsWith("```")
    ) {

      content =
        content
          .replace(
            /^```/,
            ""
          )
          .replace(
            /```$/,
            ""
          )
          .trim();
    }

    return JSON.parse(content);

  } catch (error) {

    console.error(
      "Error procesando IA."
    );

    return {
      tipo: "Tarea",
      compo: "",
      sub_comp: "",
      descripcion: "",
      horaInicio: "",
      horaFin: "",
      fecha: "HOY",
      encargado: ""
    };
  }
}


// =========================
// TELEGRAM
// =========================

function enviarMensajeTelegram(
  chatId,
  texto,
  teclado = null
) {

  const config =
    validarConfiguracion_();

  const url =
    "https://api.telegram.org/bot" +
    config.telegramToken +
    "/sendMessage";

  const payload = {
    chat_id: chatId,
    text: texto,
    parse_mode: "Markdown"
  };

  if (teclado) {
    payload.reply_markup =
      teclado;
  }

  UrlFetchApp.fetch(
    url,
    {
      method: "post",
      contentType:
        "application/json",
      payload:
        JSON.stringify(payload)
    }
  );
}


function editarMensajeTelegram(
  chatId,
  messageId,
  texto,
  teclado = null
) {

  const config =
    validarConfiguracion_();

  const url =
    "https://api.telegram.org/bot" +
    config.telegramToken +
    "/editMessageText";

  const payload = {
    chat_id: chatId,
    message_id: messageId,
    text: texto,
    parse_mode: "Markdown"
  };

  if (teclado) {
    payload.reply_markup =
      teclado;
  }

  UrlFetchApp.fetch(
    url,
    {
      method: "post",
      contentType:
        "application/json",
      payload:
        JSON.stringify(payload)
    }
  );
}
