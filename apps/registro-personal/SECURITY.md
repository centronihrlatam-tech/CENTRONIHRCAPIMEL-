# Seguridad y protección de datos

## Reporte de vulnerabilidades

No abras issues públicos para vulnerabilidades. Repórtalas de forma privada al
mantenedor del repositorio; se responderá en un plazo razonable antes de
cualquier divulgación.

## Qué NO debe entrar nunca al repositorio

- IDs de Spreadsheets, carpetas o archivos de Google Drive.
- Nombres, correos, teléfonos, documentos de identidad, fechas de nacimiento u
  otros datos personales, ni en código, ni en comentarios, ni en documentación.
- Exportaciones de datos (`.csv`, `.xlsx`), capturas con datos reales,
  credenciales, claves o `.clasp.json`.

`.gitignore` bloquea `local/`, `*.local.gs`, credenciales y exportaciones. Antes
de cada commit, revisa lo que estás a punto de subir:

```bash
git diff --cached | grep -nEi "[A-Za-z0-9_-]{25,}"   # posibles IDs de Google
```

Si un secreto llega a publicarse, **rota el recurso** (mueve o recrea la carpeta
o el archivo y revoca accesos) además de reescribir el historial: un ID de Drive
filtrado no se "des-filtra" borrando el commit.

## Datos personales tratados

| Dato | Dónde se almacena | Riesgo |
|---|---|---|
| Nombre, correo, teléfono, CI, fecha de nacimiento | Hoja `db_per` | Identificación directa |
| CI o pasaporte escaneado | Carpeta de Drive `PASAPORTES_FOLDER_ID` | Documento de identidad: alto |
| Fotografía | Carpeta de Drive `FOTOS_FOLDER_ID` | Dato biométrico en sentido amplio |

Recomendaciones de despliegue:

1. **Acceso a la Web App**: publícala como *"Solo usuarios de la organización"*.
   Publicada como *"Cualquier persona"* queda expuesta a envíos anónimos, a
   inserción masiva de filas y a subida de archivos arbitrarios contra el Drive
   del propietario. Si necesitas acceso externo, añade al menos un token en la
   URL, un límite por sesión y revisión manual de las altas.
2. **Permisos de las carpetas**: la carpeta de documentos de identidad debe estar
   restringida a los responsables del tratamiento, nunca "cualquiera con el
   enlace".
3. **Logs**: el código evita registrar datos personales (`resumenSeguroForm()`).
   No reintroduzcas `Logger.log(JSON.stringify(form))`: Cloud Logging retiene esa
   información y es accesible a quien tenga acceso al proyecto.
4. **Retención**: define un plazo de conservación de los documentos de identidad
   y elimínalos al vencer. El sistema no lo hace automáticamente.
5. **Validación**: la del cliente es de usabilidad, no de seguridad; la de
   servidor (`validarFormulario()`) es la que cuenta. Se limita el tamaño de los
   adjuntos (5 MB) y las extensiones permitidas (`pdf`, `jpg`, `jpeg`, `png`).
6. **Mínimo privilegio**: revisa los scopes concedidos al proyecto y no añadas
   `https://www.googleapis.com/auth/drive` completo si basta con `drive.file`.

## Base legal

El tratamiento de estos datos debe contar con la base legal correspondiente
(consentimiento informado o relación contractual) y con información previa a las
personas registradas sobre finalidad, plazo de conservación y responsable.
