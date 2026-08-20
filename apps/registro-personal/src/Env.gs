/**
 * Env.gs - Resolución de configuración sensible desde Propiedades del script
 * ---------------------------------------------------------------------------
 * Ningún identificador de Google Drive/Sheets está escrito en el código. Se
 * cargan desde Apps Script → Configuración del proyecto → Propiedades del
 * script, de forma que el repositorio pueda ser público sin exponer recursos.
 *
 * Propiedades reconocidas:
 *   SPREADSHEET_ID          Hoja con la pestaña 'db_per' (base de datos)
 *   ROOT_FOLDER_ID          Carpeta raíz de categorías de cargo en Drive
 *   PASAPORTES_FOLDER_ID    Carpeta destino de CI / pasaportes escaneados
 *   FOTOS_FOLDER_ID         Carpeta destino de fotografías
 *   TEMPLATE_FILE_ID        Plantilla "Formato Planner" a clonar
 *   MASTER_SPREADSHEET_ID   Hoja Maestra del consolidador (opcional/autogenerada)
 */

/** Lee una propiedad del script. Devuelve `porDefecto` si no está definida. */
function envGet(clave, porDefecto) {
  try {
    var valor = PropertiesService.getScriptProperties().getProperty(clave);
    if (valor === null || String(valor).trim() === "") {
      return (typeof porDefecto === "undefined") ? "" : porDefecto;
    }
    return String(valor).trim();
  } catch (e) {
    Logger.log("[Env] No se pudo leer la propiedad '" + clave + "': " + e.message);
    return (typeof porDefecto === "undefined") ? "" : porDefecto;
  }
}

var _ENV_CACHE = {};

/** Igual que envGet, memoizando el valor durante la ejecución actual. */
function envCached(clave, porDefecto) {
  if (!(clave in _ENV_CACHE)) _ENV_CACHE[clave] = envGet(clave, porDefecto);
  return _ENV_CACHE[clave];
}

/** Lee una propiedad obligatoria. Lanza un error claro si falta. */
function envRequerido(clave) {
  var valor = envGet(clave, "");
  if (!valor) {
    throw new Error(
      "Configuración incompleta: falta la propiedad del script '" + clave + "'. " +
      "Defínela en Extensiones/Apps Script → Configuración del proyecto → " +
      "Propiedades del script (ver README.md)."
    );
  }
  return valor;
}

/** Guarda o actualiza una propiedad del script. */
function envSet(clave, valor) {
  PropertiesService.getScriptProperties().setProperty(clave, String(valor).trim());
}

/**
 * Verifica que estén presentes las propiedades necesarias.
 * @returns {{ok: boolean, faltantes: string[]}}
 */
function envValidar(clavesRequeridas) {
  var faltantes = [];
  (clavesRequeridas || []).forEach(function (clave) {
    if (!envGet(clave, "")) faltantes.push(clave);
  });
  return { ok: faltantes.length === 0, faltantes: faltantes };
}

/**
 * Utilidad de un solo uso para cargar la configuración desde el editor de
 * Apps Script SIN escribir los IDs en el repositorio: pega los valores aquí,
 * ejecuta la función una vez y vuelve a vaciar el objeto antes de guardar.
 */
function envCargarManualmente() {
  var valores = {
    // SPREADSHEET_ID: "",
    // ROOT_FOLDER_ID: "",
    // PASAPORTES_FOLDER_ID: "",
    // FOTOS_FOLDER_ID: "",
    // TEMPLATE_FILE_ID: ""
  };
  var claves = Object.keys(valores);
  if (!claves.length) {
    Logger.log("[Env] Nada que cargar: descomenta y rellena el objeto 'valores'.");
    return;
  }
  PropertiesService.getScriptProperties().setProperties(valores, false);
  Logger.log("[Env] Propiedades cargadas: " + claves.join(", "));
}
