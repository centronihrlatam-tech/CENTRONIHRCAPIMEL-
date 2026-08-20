# Seguridad

## Modelo de amenaza

El proceso toca tres cosas valiosas: los **datos de actividad** del personal
(que en un centro clínico pueden referirse a pacientes, sitios y estudios en
curso), las **credenciales** que dan acceso a Drive y a un proveedor de
modelos, y los **archivos de respaldo** en Drive. Los actores relevantes no
son atacantes sofisticados sino los habituales en un repositorio académico:

| Amenaza | Vector realista |
| --- | --- |
| Publicación involuntaria de datos | Un `.ipynb` con salidas guardadas se sube a un repositorio público |
| Exposición de archivos de Drive | El código concede lectura pública para poder incrustar imágenes |
| Fuga de credenciales | Una clave de API escrita en una celda y versionada |
| Exfiltración vía modelo de lenguaje | Texto libre con enlaces y nombres enviado a un tercero sin acuerdo |
| Manipulación del informe | Una persona escribe una instrucción en su hoja y el modelo la obedece |
| Pérdida de trazabilidad | No hay registro de qué se generó, cuándo ni con qué identidad |

## Controles implementados

### 1. Secretos

Nunca en el código ni en la configuración. `mel_reports.secrets.get_secret`
resuelve por orden: variable de entorno → gestor de secretos de Colab →
`.env` local → petición interactiva sin eco. La configuración declara el
*nombre* de la variable; `config.py` **rechaza** un YAML que contenga
`template.document_id`, `llm.api_key` o `roster.sheet_id` con valor literal.

`mask()` produce representaciones seguras para mensajes y logs.

### 2. Permisos de Drive

El modo por defecto (`evidence.mode: link`) no modifica ningún permiso: los
respaldos se referencian como hipervínculo.

Si se necesita incrustar imágenes, `PermissionBroker` concede el acceso
mínimo y lo retira al terminar mediante un `contextmanager`, de modo que la
revocación ocurre también si la ejecución falla. La validación de
configuración impide `share_mode: anyone` salvo que además se declare
`allow_public_links: true`, y exige un dominio para `share_mode: domain`.

Un fallo al conceder permiso **degrada a enlace** y queda registrado; nunca se
silencia.

### 3. Ámbitos de autenticación

`auth.py` prefiere una cuenta de servicio, cuya identidad no es la de una
persona y puede revocarse sin afectar a nadie. Los ámbitos son los mínimos:
`spreadsheets.readonly` para leer, `documents` para escribir, y `drive.file`
cuando basta con los archivos que la aplicación gestiona.

### 4. Salida de datos hacia terceros

`llm.enabled: false` por defecto: sin él no hay tráfico saliente y el informe
se construye con `transform.deterministic_*`.

Cuando se activa, todo texto pasa por `redact.redact` antes de salir. Como
control de cierre, `redact.residual_leaks` revisa el resultado y, con
`privacy.fail_closed_on_leak: true`, aborta el envío si algo escapó.

### 5. Inyección de prompt

El contenido de las hojas lo escriben personas y no es de confianza. Tres
capas:

- `redact.neutralize` elimina caracteres de control e invisibles, normaliza
  Unicode, rompe las secuencias que podrían cerrar el bloque de datos y
  recorta la longitud.
- El material se entrega delimitado y el mensaje de sistema declara
  explícitamente que ese bloque es contenido a resumir, no instrucciones.
- Las coincidencias con patrones conocidos de inyección se registran como
  evento `prompt_injection_detected` para revisión.

Ninguna de las tres es suficiente por sí sola; el informe generado sigue
requiriendo revisión humana antes de su uso oficial.

### 6. Registro

`audit.py` escribe JSON Lines. Por defecto no contiene datos personales: las
personas aparecen por alias del roster y los recursos de Drive como hash
SHA-256 truncado, estable entre ejecuciones pero no reversible. Los mensajes
de excepción, que pueden contener datos, se registran por tipo; el detalle
solo va al log local del operador.

### 7. Higiene del repositorio

- `.gitignore` excluye `config/*.yaml`, `config/*.csv`, `.env`, credenciales,
  `data/` y `logs/`; solo se versionan los `.example`.
- `pre-commit` ejecuta `nbstripout` (salidas), `gitleaks` (secretos),
  `detect-private-key` y `scripts/sanitize_notebook.py --check`.
- `sanitize_notebook.py` detecta salidas guardadas, claves, IDs de Drive,
  URLs con contraseña y correos; con `--redact` los sustituye.

## Antes de publicar el repositorio

- [ ] `pre-commit run --all-files` sin hallazgos.
- [ ] `git log -p | grep -iE "sk-|AIza|docs.google.com/(spreadsheets|document)/d/"` vacío.
      Si aparece algo, **no basta con un commit de corrección**: el historial
      conserva el valor. Reescriba con `git filter-repo` o empiece un
      repositorio nuevo.
- [ ] Ningún `.ipynb` con `outputs` no vacíos.
- [ ] `config/center.yaml`, `config/roster.csv` y `.env` no están en
      `git ls-files`.
- [ ] Titular completado en `LICENSE`.

## Rotación de credenciales

Si una clave estuvo alguna vez en un archivo versionado, considérela
comprometida y rótela, aunque el repositorio nunca haya sido público: el
historial se copia con cada clon.

- Clave de OpenAI: revocar en el panel del proveedor y emitir una nueva.
- Cuenta de servicio de Google: eliminar la clave en IAM y generar otra.
- Archivos de Drive expuestos con `type: anyone`: retirar el permiso en
  *Compartir* de cada archivo. Un enlace público pudo indexarse.

## Reporte de vulnerabilidades

Escriba al responsable de datos del centro antes de abrir una incidencia
pública. Incluya versión, configuración (sin secretos) y pasos de
reproducción.
