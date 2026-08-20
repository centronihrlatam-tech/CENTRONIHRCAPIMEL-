# Guía de adopción en otro centro

El objetivo del diseño es que otro centro no empiece desde cero ni tenga que
leer el código. Todo lo específico de una institución está en configuración.

Tiempo estimado: media jornada, la mayor parte dedicada a preparar la
plantilla de Docs.

---

## Paso 1 — Preparar la plantilla de Google Docs

Cree un documento con el formato de informe que use su centro y coloque
marcadores donde deba entrar contenido generado:

| Marcador | Se reemplaza por |
| --- | --- |
| `{{NOMBRE}}` | Nombre de la persona |
| `{{FECHA}}` | Fecha de emisión, en texto |
| `{{mesN}}` / `{{mesN-1}}` | Mes del informe y mes anterior |
| `{{Resumen}}` | Resumen de actividades |
| `{{Conclusiones}}` | Párrafo de conclusiones |
| `{{Sugerencias}}` | Párrafo de sugerencias |
| `{{Tabla1}}`, `{{Tabla2}}`, … | Una tabla por componente |
| `{{Anexo}}` | Respaldos del periodo |

Los nombres son configurables en `template.markers`; use los que prefiera
siempre que coincidan con el documento. Cada marcador debe aparecer **una
sola vez** y en su propio párrafo.

Copie el ID del documento (el tramo entre `/d/` y `/edit`) a `.env` como
`REPORT_TEMPLATE_ID`. No lo escriba en el YAML.

## Paso 2 — Describir sus hojas de planificación

`schema.columns` traduce los nombres reales de sus columnas a los nombres
canónicos que usa el código. La comparación ignora mayúsculas, acentos y
espacios, así que `"Descripción "` y `descripcion` coinciden solos.

```yaml
schema:
  columns:
    descripcion: ["descripcion", "actividad", "detalle"]   # sus nombres reales
    fecha:       ["fecha", "dia"]
    componente:  ["area", "linea"]
    enlace:      ["evidencia", "respaldo"]
  required: ["descripcion", "fecha"]
  date_dayfirst: true      # false si sus hojas usan mes/día/año
```

Solo se leen las columnas mapeadas. Lo que no aparezca aquí no entra al
proceso.

## Paso 3 — Definir su taxonomía

```yaml
taxonomy:
  activity_types:
    task: "Tarea"          # el valor literal que aparece en su hoja
    meeting: "Reunión"
  components:
    SALUD: "{{Tabla1}}"    # su código -> el marcador de su plantilla
    FORMACION: "{{Tabla2}}"
  exclude_description_patterns:
    - "SCRUM"              # actividades internas que no van al informe
```

`components` puede tener cuantas entradas necesite. Si su centro no separa
por componentes, deje una sola entrada que agrupe todo.

## Paso 4 — Cargar el roster

`config/roster.csv`, una fila por persona:

```csv
alias,nombre,sheet_id,folder_id,active
P001,Nombre Apellido,1AbC...,1XyZ...,true
```

`alias` es un identificador estable sin datos personales: es lo que aparece
en los logs y en la salida de la consola. `active: false` desactiva a alguien
sin borrar su fila.

El archivo no se versiona. Si prefiere mantener el roster en una hoja de
cálculo, use `roster.source: sheet` y `ROSTER_SHEET_ID` en `.env`.

## Paso 5 — Definir la ventana del periodo

```yaml
period:
  cutoff_day: 25            # 1 para meses calendario
  label_previous_month: true
```

Con `cutoff_day: 25`, el informe de abril cubre del 25 de marzo al 25 de
abril. El cambio de año se maneja solo, y un día de corte inexistente en un
mes corto (31 en febrero) se ajusta al último día real.

## Paso 6 — Decidir la política de datos

Dos decisiones que conviene tomar explícitamente, no por defecto:

```yaml
evidence:
  mode: "link"        # empiece aquí; no modifica permisos de Drive
llm:
  enabled: false      # actívelo solo tras revisar docs/DATA_GOVERNANCE.md
```

Con ambos así, el proceso funciona íntegramente dentro de su Workspace.

## Paso 7 — Probar

```bash
python scripts/run_reports.py --config config/center.yaml --only P001
```

Es un ensayo: recorre el proceso completo sin escribir nada. Cuando el
resultado sea correcto, añada `--apply` para una persona, revise el documento
generado y solo entonces ejecute el lote completo.

---

## Ajustes frecuentes

**Su plantilla tiene más o menos tablas.** Añada o quite entradas en
`taxonomy.components`. Un marcador sin componente correspondiente queda sin
reemplazar y se registra como `marker_not_found`.

**Quiere separar las reuniones en dos tablas** (por ejemplo, internas y
externas):

```yaml
taxonomy:
  meeting_split:
    enabled: true
    pattern: "TEXTO_QUE_DISTINGUE"
    marker_match: "{{Tabla7}}"
    marker_rest: "{{Tabla8}}"
```

**Necesita indicadores para su tablero MEL.** `transform.counts_by` devuelve
el conteo agrupado por las columnas que indique; consúmalo desde su propio
script sin pasar por la generación de documentos.

**Su centro no usa Google Workspace.** El acoplamiento a Google está en
`auth.py`, `sources.py` y `docs_writer.py`. `transform.py`, `redact.py` y
`llm.py` son independientes y se reutilizan tal cual con otro backend.

**Otro proveedor de modelos.** Implemente el cliente en `LLMClient._ensure_client`.
El resto del paquete no conoce al proveedor.

## Lo que no debería cambiar

Los valores por defecto de `privacy` y de `evidence.share_mode` existen por
las razones que documenta [`SECURITY.md`](SECURITY.md). Si necesita
relajarlos, hágalo con una decisión registrada del centro, no como atajo para
que algo funcione.
