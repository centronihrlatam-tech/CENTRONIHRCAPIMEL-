/**
 * Config.gs - Configuración global (SIN datos sensibles)
 * ---------------------------------------------------------------------------
 * Este archivo es público: solo contiene parámetros no sensibles.
 *
 * Los identificadores de Google Drive / Sheets se leen en tiempo de ejecución
 * desde las Propiedades del script (ver Env.gs y README.md).
 *
 * El catálogo de personas NO se versiona: la fuente de verdad en runtime es la
 * pestaña 'Configuracion_Personas' de la Hoja Maestra. Opcionalmente, para el
 * sembrado inicial, puede existir un archivo privado `Config.local` que defina
 * la variable global `PERSONAS_SEED` (ver examples/Config.local.example.gs).
 */

var CONFIG = {
  NOMBRE_HOJA_CONSOLIDADO: "Consolidado_General",
  NOMBRE_HOJA_AUDITORIA: "Log_Auditoria",
  NOMBRE_HOJA_PERSONAS: "Configuracion_Personas",
  NOMBRE_HOJA_MAESTRA: "Consolidado General",
  HORARIOS_TRIGGERS: [8, 13, 15], // 8:00, 13:00 y 15:00 hora local
  ZONA_HORARIA: "America/La_Paz",

  // Pestañas a omitir en cada Spreadsheet origen si existieran
  PESTANAS_EXCLUIDAS: ["Log_Auditoria", "Instrucciones", "Plantilla_Base", "Consolidado_General"],

  /**
   * Catálogo de sembrado inicial. Vacío por defecto.
   * Se rellena únicamente si el despliegue privado incluye `Config.local`
   * con la variable `PERSONAS_SEED`.
   */
  PERSONAS: (typeof PERSONAS_SEED !== "undefined" && PERSONAS_SEED) ? PERSONAS_SEED : []
};
