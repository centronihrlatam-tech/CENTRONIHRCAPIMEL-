# mel-report-automator

> Aplicación del monorepo del Centro NIHR LatAm. Índice de aplicaciones y reglas
> comunes de seguridad en el [README raíz](../../README.md). Los hooks de
> `pre-commit` se configuran en la raíz del repositorio, no aquí.

Generación automatizada de informes periódicos de actividad para centros de
investigación, a partir de hojas de planificación individuales en Google
Sheets y una plantilla en Google Docs.

El repositorio **no contiene ningún dato ni identificador institucional**.
Todo lo específico de un centro —nombres, IDs de Drive, taxonomía de
componentes, marcadores de plantilla— vive en archivos de configuración que
no se versionan. Adoptar la herramienta en otro centro no requiere tocar el
código.

---

## Qué hace

Por cada persona activa en el roster:

1. Lee su hoja de planificación y normaliza los nombres de columna.
2. Recorta las actividades a la ventana del periodo (por defecto, del día 25
   al 25).
3. Construye el resumen, las conclusiones y las sugerencias. De forma
   determinista por defecto; opcionalmente con un modelo de lenguaje.
4. Copia la plantilla de Docs a la carpeta destino de esa persona.
5. Rellena las tablas por componente, el anexo de respaldos y los marcadores
   de texto.

El resultado es un documento por persona, listo para revisión humana.

---

## Instalación

```bash
git clone <URL_DEL_REPOSITORIO>
cd mel-report-automator
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
pre-commit install          # activa los controles de fuga de datos
```

## Configuración

```bash
cp config/center.example.yaml config/center.yaml
cp config/roster.example.csv  config/roster.csv
cp .env.example .env
```

Los tres archivos resultantes están en `.gitignore` y **nunca deben
versionarse**. Edítelos:

| Archivo             | Contiene                                                        |
| ------------------- | --------------------------------------------------------------- |
| `config/center.yaml`| Taxonomía, marcadores, política de evidencias y privacidad        |
| `config/roster.csv` | Personas, sus hojas y sus carpetas destino                        |
| `.env`              | ID de la plantilla y claves de API                                |

Ningún secreto ni ID va en el YAML: la configuración declara el **nombre** de
la variable de entorno (`document_id_env: REPORT_TEMPLATE_ID`) y el valor se
resuelve en ejecución. Volcar la configuración a un log nunca expone una
credencial.

## Uso

```bash
# Ensayo: recorre todo el proceso sin escribir en Drive
python scripts/run_reports.py --config config/center.yaml

# Ejecución real
python scripts/run_reports.py --config config/center.yaml --apply

# Una sola persona, para diagnosticar
python scripts/run_reports.py --config config/center.yaml --only P001

# Reproducir un periodo anterior
python scripts/run_reports.py --config config/center.yaml --apply --date 2026-04-01
```

El modo seguro es el que se hereda: `dry_run` está activo por defecto y solo
`--apply` escribe. En Colab, use `notebooks/00_ejecutar_informes.ipynb`, que
es un envoltorio fino sobre el mismo paquete.

Código de salida: `0` si todo fue bien, `1` si alguna persona falló, `2` si la
configuración es inválida.

---

## Decisiones de seguridad

Estas no son opciones: son el comportamiento por defecto.

| Decisión | Motivo |
| --- | --- |
| Los respaldos se insertan como **enlace**, no incrustados | Incrustar una imagen obliga a que el archivo sea legible sin sesión. La opción existe (`evidence.mode: embed`) pero exige declarar el alcance y, para exposición pública, una segunda confirmación explícita. |
| Los permisos que concede la herramienta **se revierten al terminar** | Un permiso temporal que sobrevive a la ejecución deja de ser temporal. |
| El modelo de lenguaje está **desactivado** | Enviar actividad de un centro de investigación a un tercero es una decisión institucional, no un valor por defecto. Sin él, el informe se genera igual con resúmenes deterministas. |
| Lo que sí se envía va **redactado** | Se suprimen enlaces, correos, teléfonos, IDs y nombres del roster antes de salir. Si algo escapa a la redacción, la llamada se aborta. |
| El texto de las hojas se trata como **dato, no como instrucción** | Lo escriben personas y podría contener una inyección de prompt. Se sanea, se delimita y el mensaje de sistema lo declara como material a resumir. |
| El log **no contiene datos personales** | Las personas aparecen por alias y los recursos como hash truncado. Auditable sin ser una segunda fuente de fuga. |
| Los notebooks se versionan **sin salidas** | Un `.ipynb` ejecutado guarda literalmente los datos que imprimió. `nbstripout` y `scripts/sanitize_notebook.py` lo impiden en cada commit. |

Detalle completo en [`docs/SECURITY.md`](docs/SECURITY.md) y
[`docs/DATA_GOVERNANCE.md`](docs/DATA_GOVERNANCE.md).

---

## Adopción en otro centro

Ver [`docs/ADAPTATION_GUIDE.md`](docs/ADAPTATION_GUIDE.md). El resumen es que
solo hacen falta cuatro cosas: los nombres de columna de sus hojas, sus
códigos de componente, los marcadores de su plantilla y su roster. Nada de
eso está en el código.

## Desarrollo

```bash
pytest                       # 22 pruebas: privacidad, periodo, validación
ruff check .
pre-commit run --all-files
python scripts/sanitize_notebook.py <notebook> --check
```

## Estructura

```
config/          plantillas de configuración (.example) — las reales no se versionan
src/mel_reports/
  config.py      carga y validación; rechaza configuraciones inseguras
  secrets.py     resolución de secretos: entorno, Colab, .env, prompt
  auth.py        Google, con ámbitos mínimos
  sources.py     roster y hojas de planificación
  transform.py   ventana temporal, filtros, agregados, resúmenes deterministas
  redact.py      redacción de identificadores y neutralización de inyecciones
  llm.py         capa de lenguaje opcional y aislada
  docs_writer.py escritura en Docs/Drive y gestión acotada de permisos
  audit.py       log estructurado sin datos personales
  pipeline.py    orquestación
scripts/         CLI y saneamiento de notebooks
notebooks/       cuaderno de ejecución, sin datos
tests/           pruebas
docs/            seguridad, gobernanza de datos, guía de adopción
```

## Licencia

MIT. Complete el titular en `LICENSE` antes de publicar.
