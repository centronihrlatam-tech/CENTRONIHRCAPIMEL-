# Migración desde el notebook original

Este paquete reemplaza a `Automatizador_informes.ipynb`. La lógica funcional
se conservó; cambió dónde vive y qué controles la rodean.

## Correspondencia

| Notebook original | Ahora |
| --- | --- |
| Celda 0–1: instalación y `auth.authenticate_user()` | `auth.build_clients()`, con ámbitos mínimos y soporte de cuenta de servicio |
| Celda 2: lista `personas` con nombres, URLs y `carpeta_id` | `config/roster.csv` (no versionado) |
| Celda 2: `TEMPLATE_ID = "..."` | Variable de entorno `REPORT_TEMPLATE_ID` |
| Celda 3b: `getpass` de la clave | `secrets.get_secret()`, con cuatro fuentes en orden de preferencia |
| Celda 5: `find_marker_index`, `insert_table_from_filter` | `docs_writer.find_marker`, `DocumentWriter.insert_table` |
| Celda 6: `insert_images_from_links` | `DocumentWriter.insert_evidence` + `PermissionBroker` |
| Celda 7: diccionarios de meses | `transform.MESES`, `MESES_ABREV` |
| Celda 8: `call_gpt` con backoff | `LLMClient.complete`, con jitter y clasificación de errores |
| Celda 11: `limpiar_nombre_columna` | `sources.normalize_column` |
| Celda 13/26: cálculo del periodo | `transform.build_period` |
| Celda 17: `texto_valido`, `limpiar_texto_con_ia` | `transform.texto_valido`; la limpieza por fila es ahora opcional |
| Celda 19/30/31: conteos (duplicadas) | `transform.counts_by`, una sola vez |
| Celda 25: `generar_conclusiones_y_mejoras` | `LLMClient.conclusiones_y_sugerencias` |
| Celda 34: bucle principal | `pipeline.process_person` y `pipeline.run` |

## Cambios de comportamiento

Estos alteran lo que el proceso hace, no solo cómo está organizado:

1. **Los respaldos ya no se publican.** El original ejecutaba
   `permissions().create(role="reader", type="anyone")` sobre cada imagen,
   dentro de un `except: pass`. Ahora el modo por defecto inserta un enlace y
   no toca permisos; incrustar exige configuración explícita y revierte el
   permiso al terminar.

2. **El modelo de lenguaje es opcional y está apagado.** El original siempre
   llamaba a la API. Ahora, sin activarlo, el informe se genera con resúmenes
   deterministas construidos a partir de los conteos.

3. **Lo que se envía va redactado.** El original enviaba las descripciones tal
   cual, incluidos enlaces de Drive y nombres.

4. **Modo de ensayo por defecto.** El original escribía en Drive en cuanto se
   ejecutaba la celda. Ahora hace falta `--apply`.

5. **Sin duplicados.** Si ya existe un informe con el mismo nombre en la
   carpeta destino, se omite salvo `--overwrite`. El original creaba una copia
   nueva en cada ejecución.

6. **El documento se crea directamente en la carpeta destino**, en lugar de
   crearse en la raíz y moverse con `removeParents="root"`, que fallaba si el
   archivo no estaba en la raíz.

7. **Los errores se registran, no se ocultan.** Los `except: pass` y los
   `print` de emoji fueron reemplazados por eventos en `logs/run.jsonl`.

8. **Cierre de sesión sobre el periodo.** `cutoff_day: 31` ya no lanza
   `ValueError` en febrero.

## Qué hacer con el notebook original

**No lo suba al repositorio.** Contiene, en el código, 21 nombres completos
con sus IDs de hoja y de carpeta; y en las salidas guardadas, 355 filas de
actividad real, nombres de clínicas y profesionales, identificadores de
archivos de Drive y una URL de reunión con la contraseña incrustada.

Para conservarlo como referencia interna, primero:

```bash
python scripts/sanitize_notebook.py "ruta/al/original.ipynb" \
    --redact --out referencia_saneada.ipynb
python scripts/sanitize_notebook.py referencia_saneada.ipynb --check
```

Y aun saneado, guárdelo fuera del repositorio: la versión redactada conserva
la estructura del proceso, que ya está documentada aquí, y no aporta nada que
el paquete no cubra.

## Acciones pendientes tras la migración

- [ ] Rotar la clave de OpenAI que se usó en el notebook.
- [ ] Revisar en Drive qué archivos quedaron con permiso `Cualquier persona
      con el enlace` a raíz de las ejecuciones anteriores, y retirarlo.
- [ ] Cambiar la contraseña de la sala de Zoom cuya URL quedó en las salidas.
- [ ] Verificar que ninguna copia del notebook con salidas esté ya en un
      repositorio, un correo o una carpeta compartida.
