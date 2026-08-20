# Plantillas de hojas de cálculo

Estructura exacta de cada pestaña que usa el sistema, en CSV importable a Google
Sheets. Los datos de ejemplo son **ficticios**.

| Archivo | Pestaña destino | Dónde vive |
|---|---|---|
| `db_per.csv` | `db_per` | Spreadsheet de `SPREADSHEET_ID` |
| `Formato_Planner.csv` | `Planner` | Spreadsheet de `TEMPLATE_FILE_ID` (se clona por persona) |
| `Configuracion_Personas.csv` | `Configuracion_Personas` | Hoja Maestra |
| `Consolidado_General.csv` | `Consolidado_General` | Hoja Maestra (se regenera automáticamente) |
| `Log_Auditoria.csv` | `Log_Auditoria` | Hoja Maestra (la escribe el sistema) |

## Recomendado: generarlas con código

En lugar de importar los CSV a mano, ejecuta `crearEntornoCompleto()`
(`src/Templates.gs`) o usa el menú **🔄 Consolidación → 🧩 Plantillas y entorno**.
Además de los encabezados, aplica anchos de columna, formatos, notas por columna
y listas de validación, y guarda los IDs generados en las Propiedades del script.

`verificarEntorno()` comprueba después que todo esté accesible y que no falte
ninguna columna.

## Importación manual

**Archivo → Importar → Subir**, ubicación *Reemplazar hoja actual*, separador
*coma*. Desmarca "convertir texto a números y fechas" para conservar `ci` como
texto. Renombra la pestaña con el nombre exacto de la tabla y borra la fila de
ejemplo.

El contrato completo (columnas obligatorias, opcionales, generación de `id_inv`,
estructura de carpetas) está en [`../docs/ESTRUCTURA_DE_DATOS.md`](../docs/ESTRUCTURA_DE_DATOS.md).
