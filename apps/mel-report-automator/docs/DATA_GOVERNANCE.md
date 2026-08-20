# Gobernanza de datos

Documento de referencia para el responsable de datos del centro. Describe qué
datos toca el proceso, hasta dónde llegan y qué decisiones quedan en manos de
la institución.

## Alcance

El proceso trata **datos operativos y administrativos** de gestión: qué
actividad realizó cada integrante del equipo, cuándo, bajo qué componente y
con qué respaldo documental.

Queda **fuera de alcance** el dato científico o clínico producido por cada
proyecto. Esta herramienta no lo lee, no lo transforma y no sustituye los
sistemas específicos que lo gestionan. Esa frontera es deliberada y conviene
mantenerla: mezclar ambos flujos elevaría la clasificación de todo el
proceso.

Advertencia práctica: los campos de descripción son texto libre y nada impide
que alguien escriba en ellos un nombre de paciente o el sitio de un ensayo.
El proceso los trata como potencialmente sensibles por esa razón, no porque
deban serlo.

## Categorías de datos

| Categoría | Ejemplo | Dónde reside | Sale del centro |
| --- | --- | --- | --- |
| Identidad del personal | Nombre, alias | `config/roster.csv`, local | No |
| Recursos de Drive | IDs de hoja y carpeta | `config/roster.csv`, `.env` | No |
| Actividad | Descripción, fecha, componente | Google Sheets del centro | Solo redactada, si `llm.enabled` |
| Respaldos | Archivos en Drive | Google Drive del centro | No |
| Credenciales | Claves de API, cuenta de servicio | Entorno / gestor de secretos | No |
| Registro de ejecución | Alias, hashes, contadores | `logs/run.jsonl`, local | No |

## Flujos de salida

Solo existe uno, y es opcional: la llamada al proveedor de modelos cuando
`llm.enabled: true`.

Lo que sale: descripciones y comentarios de actividad, previamente redactados
para suprimir enlaces, correos, teléfonos, identificadores opacos y nombres
del roster.

Lo que no sale: nombres del personal, IDs de Drive, contenido de los archivos
de respaldo, el roster, y cualquier texto en el que la redacción haya fallado
(la ejecución se detiene antes de enviarlo).

## Decisiones que corresponden a la institución

Estas no las resuelve el software:

1. **¿Se autoriza el uso de un proveedor externo de modelos?** Requiere
   verificar el tratamiento de datos del proveedor, si los usa para
   entrenamiento y dónde los almacena. Hasta que exista esa decisión, deje
   `llm.enabled: false`: el informe se genera igual, con resúmenes
   deterministas.
2. **¿Quién ejecuta el proceso y con qué identidad?** Se recomienda una
   cuenta de servicio dedicada, con acceso solo a las carpetas necesarias,
   en lugar de la cuenta personal de quien coordina.
3. **¿Se informó al personal?** Sus registros de actividad se procesan y, en
   su caso, se envían a un tercero. Corresponde comunicarlo.
4. **¿Cuánto se conserva el log?** `logs/run.jsonl` crece sin límite. Defina
   una rotación.
5. **¿Los respaldos pueden salir de Drive?** Si activa `evidence.mode: embed`,
   revise antes qué contienen esos archivos.

## Ciclo de vida

| Etapa | Responsable | Nota |
| --- | --- | --- |
| Registro | Cada integrante, en su hoja | Punto de entrada de calidad |
| Consolidación | Este proceso, mensual | Sin escritura sobre la hoja origen |
| Generación | Este proceso | Un documento por persona |
| **Revisión** | Coordinación | **Obligatoria antes de uso oficial** |
| Conservación | Carpeta de Drive por persona | Según política del centro |

El paso de revisión no es una formalidad. El texto de las conclusiones puede
provenir de un modelo de lenguaje, que puede errar o ser influido por el
contenido de la hoja. Ningún informe debería circular sin que una persona lo
haya leído.

## Calidad del dato

El proceso descarta silenciosamente lo que no puede interpretar: fechas
ilegibles (`NaT`), descripciones de relleno (`-`, `n/a`, `nan`) y filas fuera
de la ventana. Eso mantiene el informe limpio, pero también oculta problemas
de registro. Revise periódicamente el log: `person_no_data` recurrente en la
misma persona indica un problema de registro, no de actividad.

## Minimización

Antes de añadir una columna al flujo, pregunte si el informe la necesita. La
configuración de `schema.columns` es una lista blanca: lo que no está mapeado
no se lee. Es más fácil añadir una columna después que retirar un dato que ya
circuló.
