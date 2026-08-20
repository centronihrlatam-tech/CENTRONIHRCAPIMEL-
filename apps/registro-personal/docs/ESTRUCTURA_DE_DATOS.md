# Estructura de datos y plantillas

Este documento es el **contrato** entre las hojas de cálculo y el código. Con él
y con los CSV de [`templates/`](../templates) puedes reconstruir el sistema
completo desde cero, sin partir de ningún archivo preexistente.

La vía rápida es generarlo todo con código: menú **🔄 Consolidación → 🧩
Plantillas y entorno → 🚀 Crear entorno completo**, o ejecutar
`crearEntornoCompleto()` en el editor de Apps Script (ver `src/Templates.gs`).
Esa función crea las carpetas y las hojas, aplica formatos y listas de
validación, y guarda los IDs resultantes en las Propiedades del script.

---

## Reglas generales

1. **La fila 1 es siempre el encabezado.** Nada por encima: ni títulos, ni
   celdas combinadas, ni filas en blanco.
2. **Las columnas se localizan por nombre, no por posición.** Puedes reordenarlas
   o añadir columnas propias sin tocar el código. Lo que sí rompe el sistema es
   *renombrar* una columna que el código busca.
3. La búsqueda es exacta (`trim`) para las columnas de datos y **tolerante a
   mayúsculas** para las tres columnas de enlaces (`CI y Pasaportes escaneados`,
   `Imagen actual de los trabajadores`).
4. Las columnas opcionales ausentes se omiten en silencio: el alta no falla.
5. Ejecuta `verificarEntorno()` tras cualquier cambio manual de estructura.

---

## 1. `db_per` — base de datos de personal

Pestaña de nombre exacto `db_per` (configurable con la propiedad `SHEET_NAME`)
dentro del Spreadsheet indicado por `SPREADSHEET_ID`. Plantilla:
[`templates/db_per.csv`](../templates/db_per.csv).

| Columna | Tipo | Oblig. | Notas |
|---|---|---|---|
| `nombre_comp` | Texto | Sí | Nombre completo. Forma el nombre de carpeta y archivo: `[nombre_comp] - [id_inv]` |
| `nombres` | Texto | Sí | Su inicial es la **1.ª letra** de `id_inv` |
| `ap_pat` | Texto | Sí | Su inicial es la **2.ª letra** de `id_inv` |
| `ap_mat` | Texto | Sí | |
| `cargo` | Lista | Sí | `Asistente de investigacion`, `Pasante`, `Becario`, `Coordinador`, `Otro especificar`. Determina la subcarpeta de Drive |
| `correo` | Email | Sí | Validado por formato en el servidor |
| `Nacimiento` | Fecha | Sí | Ojo a la mayúscula inicial: el nombre es `Nacimiento` |
| `ci` | Texto numérico | Sí | Solo dígitos. Formatea la columna como **texto** para no perder ceros iniciales |
| `celular` | Texto numérico | Sí | Solo dígitos |
| `orcid` | URL | Sí | Debe empezar por `http://` o `https://` |
| `pais` | Lista | Sí | `BOL`, `GUA`, `COL`, `Otro especificar` |
| `estado` | Lista | Sí | `Vigente` / `Retirado`. `Retirado` se propaga como `RETIRADO` al consolidador |
| `pasaporte` | Texto | No | |
| `id_inv` | Texto | Sí | **Lo genera el servidor**: 2 iniciales + 3 dígitos correlativos (`AB001`). No editar a mano |
| `fecha_registro` | Texto | No | Si la columna existe, el backend escribe fecha y hora del alta |
| `CI y Pasaportes escaneados` | Texto | No | El backend escribe el enlace a la carpeta personal de Drive |
| `Imagen actual de los trabajadores` | Texto | No | El backend escribe el enlace a la fotografía |

**Generación de `id_inv`**: se toma el mayor correlativo existente en la columna
`id_inv` y se suma 1, conservando 3 dígitos. Si la última fila es `AB056`, el
alta de "Ana Bravo" produce `AB057`. La columna debe existir aunque esté vacía.

> Esta pestaña contiene datos personales y un documento de identidad por
> persona. Restringe su acceso; ver [SECURITY.md](../SECURITY.md).

## 2. `Formato Planner` — plantilla que se clona por persona

Spreadsheet indicado por `TEMPLATE_FILE_ID`. En cada alta se clona dentro de la
carpeta de la persona, se renombra a `[nombre_comp] - [id_inv]` y su pestaña
activa recibe el mismo nombre. Plantilla:
[`templates/Formato_Planner.csv`](../templates/Formato_Planner.csv).

| Columna | Tipo | Notas |
|---|---|---|
| `Fecha` | Fecha | |
| `Actividad` | Texto | |
| `Proyecto` | Texto | |
| `Horas` | Número | |
| `Estado` | Lista | `Pendiente`, `En proceso`, `Concluido` |
| `Entregable` | Texto | |
| `Observaciones` | Texto | |

**Estas columnas son una propuesta, no un requisito**: el consolidador es
genérico y copia los encabezados que encuentre. Adáptalas a tu proceso
respetando el contrato:

- Fila 1 = encabezados, datos desde la fila 2.
- Sin celdas combinadas ni filas de título por encima.
- Las pestañas **ocultas** se ignoran, igual que las llamadas
  `Log_Auditoria`, `Instrucciones`, `Plantilla_Base`, `Consolidado_General` y
  `Configuracion_Personas` (lista en `CONFIG.PESTANAS_EXCLUIDAS`).
- Los encabezados de la **primera pestaña leída** definen las columnas del
  consolidado; si cada persona usa encabezados distintos, los datos quedan
  desalineados. Mantén una única plantilla para todos.

## 3. `Configuracion_Personas` — catálogo de orígenes

Pestaña de la Hoja Maestra. Es la **fuente de verdad en tiempo de ejecución**:
el consolidador solo lee de aquí. Plantilla:
[`templates/Configuracion_Personas.csv`](../templates/Configuracion_Personas.csv).

| Columna | Notas |
|---|---|
| `N°` | Correlativo; si falta se usa el número de fila |
| `Nombre Persona` | Etiqueta del origen. Evita datos personales innecesarios |
| `ID Spreadsheet Origen` | ID del Planner clonado de esa persona. Si está vacío, la fila se cuenta como error |
| `ID Carpeta` | ID de su carpeta en Drive (informativo) |
| `Estado` | `ACTIVO` (o vacío) se consolida; `RETIRADO` se omite |

El alta por formulario añade la fila automáticamente. También puedes usar el menú
**➕ Añadir Nueva Persona**, o pegar filas a mano.

## 4. `Consolidado_General` — salida

Se **regenera por completo** en cada consolidación: no escribas nada a mano.
Plantilla ilustrativa:
[`templates/Consolidado_General.csv`](../templates/Consolidado_General.csv).

Cinco columnas de trazabilidad — `N° Persona`, `Nombre Persona`,
`ID Sheet Origen`, `Pestaña Origen`, `Fecha Consolidación` — seguidas de los
encabezados reales del origen. Las columnas que quedan completamente vacías se
eliminan antes de escribir.

## 5. `Log_Auditoria` — bitácora

Una fila por ejecución (manual o automática). Plantilla:
[`templates/Log_Auditoria.csv`](../templates/Log_Auditoria.csv).

`Fecha y Hora`, `Tipo Ejecución`, `Estado`, `Archivos Éxito`, `Archivos Error`,
`Filas Consolidadas`, `Duración (s)`, `Detalles / Errores`.

## 6. Estructura de carpetas en Drive

```
Automatizacion Personal/
├── Categorias de cargo/                  <- ROOT_FOLDER_ID
│   ├── ASISTENTES_INVESTIGACION/
│   │   └── [nombre_comp] - [id_inv]/     <- carpeta personal
│   │       ├── [nombre_comp] - [id_inv]  <- clon del Formato Planner
│   │       └── RESPALDO - [nombre_comp]/
│   ├── PASANTE/
│   ├── BECARIO/
│   └── COLABORADORES/                    <- cualquier otro cargo
├── Pasaportes y CI/                      <- PASAPORTES_FOLDER_ID
│   └── [nombre_comp]/
└── Fotografias/                          <- FOTOS_FOLDER_ID
```

El enrutado por cargo aplica `trim().toLowerCase()` y busca subcadenas:
`pasante` → `PASANTE/`, `becario` → `BECARIO/`,
`asistente de investigacion` → `ASISTENTES_INVESTIGACION/`, y cualquier otro
valor → `COLABORADORES/`. Las subcarpetas que falten se crean al vuelo.

## Importar los CSV a Google Sheets

1. Crea un Spreadsheet nuevo (o abre el existente).
2. **Archivo → Importar → Subir**, elige el CSV.
3. Ubicación: *Reemplazar hoja actual*; separador: *coma*. **Desmarca** "convertir
   texto a números y fechas" si quieres conservar `ci` como texto.
4. Renombra la pestaña con el nombre exacto de la tabla (`db_per`, etc.).
5. Borra la fila de ejemplo antes de usarla en producción.

Los datos de ejemplo de los CSV son **ficticios**; no introduzcas datos reales en
archivos del repositorio.
