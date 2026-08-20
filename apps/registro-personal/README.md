# Registro de Personal y Consolidación (Google Apps Script)

> Aplicación del monorepo del Centro NIHR LatAm. Índice de aplicaciones y reglas
> comunes de seguridad en el [README raíz](../../README.md).

Sistema en **Google Apps Script** que automatiza el alta de personal de
investigación y la consolidación periódica de sus planillas de trabajo:

- **Web App de alta** (`WebForm_*`): formulario responsivo con validación en
  cliente y servidor, generación automática de identificador (`id_inv`), alta de
  fila en la hoja `db_per` con mapeo dinámico de columnas, subida de documentos
  a Drive, creación de la estructura de carpetas por cargo y clonado de la
  plantilla "Formato Planner".
- **Consolidador** (`Consolidation.gs`, `Triggers.gs`, `UI.gs`): recorre los
  Spreadsheets registrados en la pestaña `Configuracion_Personas`, unifica los
  datos en `Consolidado_General`, registra incidencias en `Log_Auditoria` y se
  ejecuta automáticamente a las 8:00, 13:00 y 15:00 (hora de La Paz).

> **Nota de privacidad.** Este repositorio no contiene datos personales ni
> identificadores de recursos de Google. Todos los IDs se resuelven en tiempo de
> ejecución desde las *Propiedades del script* (ver más abajo).

---

## Estructura

```
src/                     Proyecto de Apps Script (versión actual)
  appsscript.json        Manifest (zona horaria, runtime V8)
  Env.gs                 Resolución de configuración desde Script Properties
  Config.gs              Parámetros no sensibles
  Templates.gs           Generación de plantillas de Sheets/Drive y diagnóstico
  Code.gs                Puntos de entrada y utilidades de prueba
  Setup.gs               Autoconfiguración de la Hoja Maestra y sus pestañas
  Consolidation.gs       Motor de consolidación
  Audit.gs               Registro de auditoría
  Triggers.gs            Alta y baja de triggers programados
  UI.gs                  Menú y diálogos en Google Sheets
  WebForm_Backend.gs     Backend de la Web App de alta de personal
  WebForm_Index.html     Formulario
  WebForm_Script.html    Lógica de cliente y validaciones
docs/                    Guías de implementación, despliegue y estructura de datos
templates/               Plantillas CSV de cada pestaña (datos ficticios)
examples/                Plantillas de configuración (sin valores reales)
legacy/                  Primera versión del formulario (histórico)
local/                   Lo creas tú: datos reales del despliegue. IGNORADO por git
```

## Configuración

Ningún identificador está escrito en el código. Antes de usar el sistema, define
las **Propiedades del script**:

1. Abre el proyecto en Apps Script y ve a **Configuración del proyecto**.
2. En **Propiedades del script**, añade las siguientes claves (plantilla en
   `examples/script-properties.example.json`):

   | Propiedad | Descripción | Obligatoria |
   |---|---|---|
   | `SPREADSHEET_ID` | Spreadsheet que contiene la pestaña `db_per` | Sí |
   | `ROOT_FOLDER_ID` | Carpeta raíz de Drive con las categorías de cargo | Sí |
   | `TEMPLATE_FILE_ID` | Plantilla "Formato Planner" a clonar | Sí |
   | `PASAPORTES_FOLDER_ID` | Carpeta destino de CI y pasaportes | Solo si se suben documentos |
   | `FOTOS_FOLDER_ID` | Carpeta destino de fotografías | Solo si se suben fotos |
   | `MASTER_SPREADSHEET_ID` | Hoja Maestra del consolidador | No (se autogenera) |
   | `SHEET_NAME` | Nombre de la pestaña de base de datos (por defecto `db_per`) | No |

   Alternativa: rellena y ejecuta una vez `envCargarManualmente()` en `Env.gs`, y
   vuelve a vaciar el objeto antes de guardar.

3. Si falta alguna propiedad obligatoria, la Web App responde con un error de
   configuración explícito en lugar de fallar de forma opaca.

### Catálogo de orígenes a consolidar

La lista de Spreadsheets a consolidar vive en la pestaña `Configuracion_Personas`
de la Hoja Maestra (columnas: número, nombre, ID del Spreadsheet, ID de carpeta,
estado). **No se versiona.**

Para sembrarla automáticamente en un despliegue privado, copia
`examples/Config.local.example.gs` a `local/Config.local.gs`, rellénalo y añade
ese archivo al proyecto de Apps Script con el nombre `Config.local`. `Config.gs`
lo detecta mediante la variable global `PERSONAS_SEED`.

## Plantillas: arrancar desde cero

El repositorio no incluye datos, pero sí la **estructura completa** de cada hoja,
de dos formas equivalentes:

- **Generadas por código** (recomendado): `crearEntornoCompleto()` en
  `src/Templates.gs`, o el menú **🔄 Consolidación → 🧩 Plantillas y entorno →
  🚀 Crear entorno completo**. Crea las carpetas de Drive, el Spreadsheet con la
  pestaña `db_per` y la plantilla "Formato Planner", con formatos, notas y listas
  de validación, y guarda los IDs generados en las Propiedades del script.
  Después, `autoconfigurarProyecto()` crea la Hoja Maestra y los triggers.
- **Importables a mano**: los CSV de [`templates/`](templates) — `db_per`,
  `Formato_Planner`, `Configuracion_Personas`, `Consolidado_General` y
  `Log_Auditoria` — con una fila de ejemplo ficticia cada uno.

`verificarEntorno()` (menú **🔍 Verificar entorno y columnas**) diagnostica un
entorno ya montado: propiedades definidas, recursos accesibles, columnas
obligatorias presentes y columnas opcionales ausentes.

El contrato de datos (columnas, tipos, generación de `id_inv`, enrutado de
carpetas) está en [`docs/ESTRUCTURA_DE_DATOS.md`](docs/ESTRUCTURA_DE_DATOS.md).

## Despliegue

1. Crea el proyecto de Apps Script y sube el contenido de `src/`, manualmente o
   con [`clasp`](https://github.com/google/clasp): copia `.clasp.json.example` a
   `.clasp.json` (está en `.gitignore`) y ejecuta `clasp push` desde esta carpeta.
2. Define las Propiedades del script. Si partes de cero, ejecuta
   `crearEntornoCompleto()` y se rellenarán solas.
3. Desde la Hoja Maestra, menú **🔄 Consolidación → 🛠️ Autoconfigurar Proyecto**.
4. **Implementar → Nueva implementación → Aplicación web**:
   - *Ejecutar como*: yo, el propietario de los recursos de Drive.
   - *Quién tiene acceso*: **restringido a las cuentas de la organización**. Lee
     [SECURITY.md](SECURITY.md) antes de exponerlo a "cualquier persona".

Guía detallada paso a paso: [`docs/GUIA_IMPLEMENTACION.md`](docs/GUIA_IMPLEMENTACION.md).

## Seguridad y datos personales

El sistema procesa datos personales (nombre, correo, teléfono, CI, fecha de
nacimiento) y documentos de identidad. Lee [SECURITY.md](SECURITY.md) antes de
desplegarlo.

## Licencia

[MIT](../../LICENSE) — común a todo el monorepo.
