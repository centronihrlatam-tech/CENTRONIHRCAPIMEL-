<!-- Histórico: despliegue de la primera versión del formulario
     (`legacy/v1-registro-investigadores/`). La versión vigente se documenta
     en README.md y docs/GUIA_IMPLEMENTACION.md. -->

# INSTRUCCIONES DE DESPLIEGUE — Sistema de Registro de Investigadores

## 1. Preparar el proyecto Apps Script

1. Ve a **script.google.com** y haz clic en **+ Nuevo proyecto** (o Nuevo → Apps Script).
2. Elimina el archivo `Código.gs` por defecto y crea estos **3 archivos nuevos** con nombres EXACTOS (la extensión del archivo JS parcial es `.html` obligatoriamente):
   - `Code.gs` → pega todo el contenido del archivo `Code.gs`
   - `Index.html` → pega todo el contenido de `Index.html`
   - `JavaScript.html` → pega todo el contenido de `JavaScript.html`
3. Guarda el proyecto (Ctrl+S) y ponle un nombre, p. ej. `RegistroInvestigadores`.

## 2. Autorizar permisos (primera ejecución)

1. En `Code.gs`, elige la función `doGet` y haz clic en **Ejecutar** ▶ (o simplemente despliega, te pedirá autorizar).
2. Aparecerá el diálogo **Autorizar acceso** → elige la cuenta → **No seguro** → **Avanzado** → **Ir a ... (no seguro)** → **Permitir**.
3. Acepta los permisos de **Google Sheets** y **Google Drive** (scopes automáticos del proyecto).
4. Verifica en **Ejecuciones** que `doGet` corrió sin errores.

## 3. Desplegar como Web App

1. Haz clic en **Implementar → Nueva implementación**.
2. Tipo: **Aplicación web**.
3. Configura así:
   - **Descripción:** `v1.0`
   - **Ejecutar como:** `Yo (tu cuenta)` ← OBLIGATORIO, para que use tus permisos de Sheets/Drive.
   - **Quién tiene acceso:**
     - `Cualquier persona con cuenta de Google` → recomendado (los investigadores entran con su Gmail).
     - `Cualquiera` → si quieres acceso sin login (más fácil para que TestSprite pruebe sin credenciales).
4. Haz clic en **Implementar** y **copia la URL** de la Web App (formato `https://script.google.com/macros/s/XXXX/exec`).
5. Al abrirla por primera vez puede tardar unos segundos en "calentar".

## 4. Prueba manual (QA Smoke Test)

1. Abre la Web App y envía un registro real de prueba (o un dato falsificado tipo `Prueba QA - xyz`).
2. Verifica:
   - Fila nueva en la pestaña **db_per** con `id_inv` formado (2 iniciales + 3 dígitos secuenciales).
   - Carpeta creada en la subcarpeta correcta (`PASANTE`, `BECARIO`, `ASISTENTES_INVESTIGACION`, `COLABORADORES`).
   - El archivo clonado del Planner existe con el nombre `[nombre_comp] - [id_inv]` y su pestaña activa renombrada.
3. Prueba los casos límite:
   - Doble clic rápido en "Registrar" → no debe duplicarse.
   - Cargo/país "Otro especificar" → el campo extra debe aparecer y ser obligatorio.
   - Correo inválido, ORCID sin `https`, CI con letras → deben bloquearse en el frontend.

## 5. Revisión con TestSprite (QA con IA)

TestSprite (testsprite.com) prueba la app contra la URL desplegada usando un agente de IA en un navegador real:

1. Crea cuenta en **testsprite.com** → **Sign up**.
2. Crea una **App** nueva y pega la **URL de la Web App**.
3. (Opcional, solo si desplegaste como "Cualquier persona con cuenta de Google") configura un **Login Profile** con una cuenta Google válida dentro de TestSprite.
4. Escríbele a la IA tus objetivos de prueba en lenguaje natural, por ejemplo:
   > "Test the researcher registration form: 1) submit with empty required fields and verify the error messages appear. 2) Fill all fields correctly and register a researcher named Test QA. 3) Verify that after submission the success message shows an ID like XX###. 4) Select 'Otro especificar' for cargo and verify the extra text field appears."
5. Ejecuta y revisa el reporte generado (casos aprobados/fallidos, capturas, causa raíz). Repara las fallas reales y vuelve a correr.

**Nota importante:** TestSprite navega como un usuario normal, así que la pestaña `db_per` recibirá filas de prueba reales; bórralas después o usa datos marcados como `PRUEBA TESTS` y límpialos del Sheets y de Drive al finalizar.

## 6. Troubleshooting rápido

| Síntoma | Solución |
|---|---|
| "Error 403 / Forbidden" al abrir | Reimplementa con **Implementar → Administrar implementaciones → Editar → Nueva versión** |
| No escribe en Sheets | Confirma que la pestaña `db_per` existe con headers en fila 1 |
| No crea carpeta | Verifica que tu cuenta tiene acceso a la carpeta raíz y a la plantilla |
| Cambios no se reflejan | Cada edición de código requiere **Implementar → Administrar → Editar → Nueva versión** |
| Revisar errores | Menú **Ejecuciones** y los `Logger.log` del código |