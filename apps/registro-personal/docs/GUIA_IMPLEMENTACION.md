# GUÍA DE IMPLEMENTACIÓN — Web App "Alta de Nuevo Personal" + Integración con Consolidador

> Proyecto destino: proyecto de Apps Script completo (12 archivos) — lista exacta en §2.
> Antes de empezar, define las **Propiedades del script** descritas en el `README.md`
> (`SPREADSHEET_ID`, `ROOT_FOLDER_ID`, `TEMPLATE_FILE_ID`, etc.). Ningún ID va en el código.
> Duración estimada: 5-10 minutos.

---

## 0. Requisitos previos (verificar ANTES de empezar)

| # | Requisito | Dónde verificar |
|---|-----------|-----------------|
| 1 | La hoja `db_per` existe en el Spreadsheet indicado por la propiedad `SPREADSHEET_ID` con headers en fila 1 (`nombre_comp`, `nombres`, `ap_pat`, `ap_mat`, `cargo`, `correo`, `Nacimiento`, `ci`, `celular`, `orcid`, `pais`, `estado`, `pasaporte`, `id_inv`, `fecha_registro` opcional) | Abrir el Sheets y mirar la fila 1 |
| 2 | Tienes acceso a los recursos configurados en `ROOT_FOLDER_ID`, `PASAPORTES_FOLDER_ID`, `FOTOS_FOLDER_ID` y `TEMPLATE_FILE_ID` | Abrir cada uno en el navegador |
| 3 | Hoja Maestra del consolidador: en proyecto NUEVO la crea `autoconfigurarProyecto` (§3). En proyecto EXISTENTE, verificar que tiene la pestaña `Configuracion_Personas` | Abrir la Hoja Maestra (la que tiene el menú "🔄 Consolidación") |

> ⚠️ El backend asume que la persona que ejecuta el Web App ("Ejecutar como: Yo") es la misma que tiene permisos sobre Sheets, Drive y la Hoja Maestra.

---

## 1. Abrir el proyecto de Apps Script

1. Ve a **script.google.com** → inicia sesión con tu cuenta.
2. En **Mis proyectos**, abre tu proyecto (el de este sistema) o crea uno nuevo con **+ Nuevo proyecto**.
3. Verifica a la izquierda que **NO** exista otro archivo con `function doGet()` ni `function include()` (solo debe haberlos en `WebForm_Backend`); si existen de un sistema anterior, elimínalos o renómbralos.

---

## 2. Crear TODOS los archivos del proyecto (12 archivos)

> Los contenidos están en la carpeta `src/` del repositorio (y estos son los nombres EXACTOS que debes usar).

| # | Archivo a crear | Tipo | Contenido (copiar de) |
|---|---|---|---|
| 1 | `Setup` | Script (.gs) | `Setup.gs` |
| 2 | `Config` | Script (.gs) | `Config.gs` |
| 2b | `Env` | Script (.gs) | `Env.gs` |
| 2c | `Templates` | Script (.gs) | `Templates.gs` |
| 3 | `Consolidation` | Script (.gs) | `Consolidation.gs` |
| 4 | `UI` | Script (.gs) | `UI.gs` |
| 5 | `Triggers` | Script (.gs) | `Triggers.gs` |
| 6 | `Audit` | Script (.gs) | `Audit.gs` |
| 7 | `Code` | Script (.gs) | `Code.gs` |
| 8 | `WebForm_Backend` | Script (.gs) | `WebForm_Backend.gs` |
| 9 | `WebForm_Index` | HTML | `WebForm_Index.html` |
| 10 | `WebForm_Script` | HTML | `WebForm_Script.html` |
| 11 | `appsscript.json` | Manifest (JSON) | `appsscript.json` |

1. Clic en el **+ (signo más / "Archivo nuevo")** → elige el tipo (Script o HTML) según la tabla y pega el contenido completo de cada archivo.
2. Para `appsscript.json`: clic en **Configuración del proyecto ⚙️ (icono engranaje, izquierda)** → marca **"Mostrar el archivo manifest 'appsscript.json'"** → pega el contenido del JSON.
3. Guarda con **Ctrl+S**. Verifica que `WebForm_Index.html` contiene la línea `<?!= include('WebForm_Script'); ?>` coincidiendo con el nombre del archivo HTML de script.

> Nota sobre doGet: solo `WebForm_Backend.gs` define `doGet()` e `include()`. Si el proyecto tuviera otro archivo con esas funciones (de un sistema anterior), elimina o renombra el viejo.

---

## 3. Configurar el proyecto por PRIMERA VEZ (solo proyecto nuevo)

> Si no tienes todavía la base de datos `db_per`, la plantilla Planner ni las
> carpetas de Drive, ejecuta antes **`crearEntornoCompleto()`** (`Templates.gs`):
> las crea y guarda sus IDs en las Propiedades del script. Estructura y CSV
> equivalentes en `docs/ESTRUCTURA_DE_DATOS.md` y `templates/`.

1. En el editor, selecciona la función **`autoconfigurarProyecto`** (barra superior) → **Ejecutar ▶** → autoriza permisos de Sheets/Drive (**Revisar permisos → Avanzado → Ir a ... (no seguro) → Permitir**).
2. Verifica en **Ejecuciones** que terminó "Completado": habrá creado la **Hoja Maestra** nueva con las pestañas `Consolidado_General`, `Log_Auditoria`, `Configuracion_Personas` (vacía, o sembrada desde `Config.local` si lo has añadido al proyecto).
   - ⚠️ Si ya tenías una Hoja Maestra con datos propios (personas agregadas manualmente con el menú del consolidador), **NO** ejecutes esto: la recrearía desde cero. En ese caso define la **propiedad del script** `MASTER_SPREADSHEET_ID` con el ID de tu Hoja Maestra existente (el ID de su URL `/spreadsheets/d/<ID>/`).
3. Si quieres el menú "🔄 Consolidación" dentro de la Hoja Maestra: abre esa hoja → **Extensiones → Apps Script** (el script queda vinculado a la hoja y el menú aparece al abrirla). Si lo dejas standalone, ejecutas las funciones desde el editor.

---

## 4. Autorizar permisos del Web App (primera ejecución)

1. En el editor, selecciona la función `doGet` (barra de herramientas, arriba) y haz clic en **Ejecutar ▶**.
2. Primer diálogo: **Autorizar acceso** → clic **Revisar permisos**.
3. Elige tu cuenta → **Avanzado → Ir a "Registro de Nuevo Personal (no seguro)" → Permitir**.
4. En la ventana de permisos acepta los de **Google Sheets** y **Google Drive** (se solicitan automáticamente).
5. Verifica en el panel **Ejecuciones** (izquierda, icono reloj/check) que `doGet` terminó sin errores (estado: Completado).
6. (Opcional) Prueba lógica directa: en el editor llama a `registrarPersonal` con un objeto de prueba — mejor dejarlo para el checklist del punto 6 para no crear datos duplicados.

---

## 5. Desplegar como Web App

1. Clic en **Implementar → Nueva implementación** (botón azul "Implementar", arriba a la derecha).
2. Tipo: clic en el **icono de engranaje ⚙️** junto a "Tipo de implementación" → selecciona **Aplicación web**.
3. Configura:
   - **Descripción:** `WebForm Alta Personal v1`
   - **Ejecutar como:** `Yo (tu cuenta)` ← OBLIGATORIO
   - **Quién tiene acceso:**
     - `Cualquier persona con cuenta de Google` → para que el personal entre con su Gmail (recomendado)
     - `Cualquiera` → acceso sin login (útil para TestSprite sin credenciales)
4. Clic **Implementar**.
5. En el diálogo final aparece la URL tipo `https://script.google.com/macros/s/AKfycb.../exec`:
   - Clic en **Copiar URL** (⚠️ NO copies la URL de la barra de direcciones: puede traer `/u/N/` y dar "página no encontrada").
6. Abre la URL en una ventana de incógnito o con otra cuenta para confirmar que carga el formulario.

> ⚠️ Cada vez que modifiques código: **Implementar → Administrar implementaciones → ✏️ Editar (lápiz) → Nueva versión → Implementar**. Si solo reabres la URL sin hacer esto, verás la versión vieja.

---

## 6. Checklist de prueba funcional (QA manual)

Abre la URL del Web App y prueba en este orden:

**Validaciones de formulario:**
- [ ] Enviar vacío → mensaje rojo con la lista de campos faltantes.
- [ ] Correo `abc@` → error de formato.
- [ ] ORCID `www.orcid.org/...` (sin https) → error de URL.
- [ ] CI con letras (`123a45`) → se bloquea la escritura (input numérico).
- [ ] Fecha de nacimiento futura → bloqueada (max=hoy).

**Lógica dinámica:**
- [ ] Cargo = "Otro especificar" → aparece el campo extra y es obligatorio.
- [ ] País = "Otro especificar" → igual.
- [ ] Cargo "Pasante" (y luego "Becario", "Asistente de investigacion", "Coordinador") → la carpeta debe crearse en la subcarpeta correcta.

**Archivo adjunto (opcional):**
- [ ] Sin archivo → el registro se completa igual (es opcional).
- [ ] Archivo `.txt` → rechazado con mensaje de formato.
- [ ] Archivo > 5 MB → rechazado con mensaje de tamaño.
- [ ] PDF/JPG válido (< 5 MB) → se sube a Drive.

**Anti-duplicados:**
- [ ] Doble clic rápido en "Registrar Personal" → el botón se deshabilita durante el proceso; solo queda 1 fila.

**Éxito:**
- [ ] Mensaje verde con `ID asignado` (formato `XX###`), `N° consolidador`, y enlaces a la carpeta y al Planner.

---

## 7. Verificación de la integración (después de UN registro real de prueba)

1. **db_per** (hoja principal): nueva fila con todos los datos + `id_inv` = iniciales + secuencia (ej: `MA057`) y `fecha_registro`.
2. **Drive → Pasaportes y CI**: carpeta `[nombre_comp]` con el archivo subido adentro.
3. **Drive → Carpeta Raíz → subcarpeta según cargo**:
   - Carpeta `[nombre_comp] - [id_inv]`.
   - Archivo clonado del Planner con el MISMO nombre (carpeta y archivo).
   - Pestaña activa del clon renombrada a `[nombre_comp] - [id_inv]`.
   - Subcarpeta vacía `RESPALDO - [nombre_comp]` (anota su ID o la URL).
4. **Hoja Maestra → Configuracion_Personas**: nueva fila con:
   - `N°` = máximo existente + 1.
   - `Nombre Persona` = nombre_comp.
   - `ID Spreadsheet Origen` = celda con enlace visible (hipervínculo) cuyo texto es el ID (al hacer clic abre el Planner).
   - `ID Carpeta` = ID de la carpeta `RESPALDO - ...`.
   - `Estado` = `ACTIVO` (si elegiste "Vigente") o `RETIRADO` (si elegiste "Retirado").
5. **Prueba de consolidación final**: en la Hoja Maestra, menú **🔄 Consolidación → ▶️ Consolidar Ahora (Manual)** y verifica que en `Consolidado_General` aparecen las pestañas del Planner clonado de la nueva persona.

---

## 8. Limpieza de datos de prueba

- Borra la(s) fila(s) de prueba en `db_per` y `Configuracion_Personas`.
- En Drive, elimina la carpeta de prueba en Categorías y el documento en Pasaportes y CI (si no quieres conservarlo).
- Re-ejecuta la consolidación manual para refrescar `Consolidado_General`.

---

## 9. Troubleshooting rápido

| Síntoma | Causa probable | Solución |
|---|---|---|
| "No se encontró la página" | URL con `/u/N/` o versión vieja | Usar URL de *Administrar implementaciones*; si no, crear Nueva versión |
| Error 403 al abrir | Acceso no compatible | Redesplegar con acceso "Cualquier persona con cuenta de Google" |
| "No se encontró la pestaña db_per" | Sheets sin esa pestaña | Crearla con los headers en fila 1 |
| No se sube el documento | Permiso sobre la carpeta de pasaportes | Compartir la carpeta con tu cuenta y verificar la propiedad `PASAPORTES_FOLDER_ID` |
| No clona el Planner | Permiso sobre la plantilla (`TEMPLATE_FILE_ID`) | Abrir el archivo una vez y verificar que tu cuenta es editor |
| Falla en `integracion_consolidador` (dice que no existe `obtenerOCrearMasterSpreadsheet()`) | El proyecto no tiene `Setup.gs` | Verificar que creaste el archivo `Setup` (§2, fila 1). El backend tiene además un fallback autónomo: si no existe la función, busca la Hoja Maestra en la propiedad del script `MASTER_SPREADSHEET_ID` |
| Error "No se pudo localizar la Hoja Maestra" | `Setup.gs` ausente y `MASTER_SPREADSHEET_ID` vacío | Ejecutar `autoconfigurarProyecto` una vez (§3) o definir la propiedad `MASTER_SPREADSHEET_ID` |
| El nuevo registro no sale en el Consolidado | Estado en la celda no es `ACTIVO`/vacío | Verificar §7.4 (mapeo: Vigente→ACTIVO) |
| Cambios no se reflejan | Falta "Nueva versión" | Implementar → Administrar → Editar → Nueva versión |
| Ver errores del backend | — | Apps Script → panel **Ejecuciones** y `Logger.log` |

---

## 10. Revisión con TestSprite (opcional)

1. Despliega con acceso **"Cualquiera"** (más simple) o configura un Login Profile con un Gmail en TestSprite.
2. Crea la App en testsprite.com con la URL `.../exec` (sin `/u/N/`).
3. Escribe objetivos en lenguaje natural, ej:
   > "Register a new researcher with valid data and an attached PDF, verify success message with generated ID, then test empty required fields and the 'Otro especificar' flow for cargo and país."
4. Borra los datos de prueba al terminar (§8).