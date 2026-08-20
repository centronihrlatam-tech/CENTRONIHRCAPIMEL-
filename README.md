# Centro NIHR LatAm — Plataforma técnica

Monorepo con las aplicaciones de **monitoreo, evaluación, aprendizaje y gestión
interna** del Centro NIHR LatAm en Bolivia. Todas están construidas sobre
**Google Apps Script**: sin servidores, sin costes de alojamiento y sin
dependencias externas.

Cada aplicación es un proyecto de Apps Script independiente y se despliega por
separado. Comparten repositorio, licencia y criterios de seguridad.

---

## Aplicaciones

| Aplicación | Qué hace | Documentación |
|---|---|---|
| **[CAPIMEL](apps/capimel)** | Portada institucional MEL: tarjetas de acceso a los tableros del centro, agente conversacional CAPI y galería social. | [`apps/capimel/README.md`](apps/capimel/README.md) |
| **[Registro de personal](apps/registro-personal)** | Alta de personal de investigación por formulario web (validación, generación de identificador, estructura de carpetas en Drive) y consolidación automática de las planillas de trabajo. | [`apps/registro-personal/README.md`](apps/registro-personal/README.md) |

```
.
├── README.md                   Este índice
├── LICENSE                     MIT (aplica a todo el monorepo)
├── .gitignore                  Reglas comunes: secretos, datos reales, exportaciones
└── apps/
    ├── capimel/                Portada institucional MEL
    │   ├── Configuracion.gs    ← archivo a editar para adaptar la plataforma
    │   ├── Codigo.gs
    │   ├── Index.html
    │   └── appsscript.json
    └── registro-personal/      Registro de personal y consolidador
        ├── src/                Proyecto de Apps Script
        ├── docs/               Guías y contrato de datos
        ├── templates/          Plantillas CSV de cada hoja
        ├── examples/           Plantillas de configuración
        └── legacy/             Primera versión del formulario
```

## Empezar

Cada aplicación tiene sus propios requisitos e instrucciones; entra en su carpeta
y sigue su README. En ambos casos el flujo es el mismo:

1. Crear un proyecto en [script.google.com](https://script.google.com).
2. Subir el contenido de la carpeta de la aplicación, a mano o con
   [`clasp`](https://github.com/google/clasp): copia el `.clasp.json.example` de
   esa aplicación a `.clasp.json` (ignorado por git), pon tu `scriptId` y ejecuta
   `clasp push`.
3. Configurar los valores propios del despliegue **fuera del código** (ver
   siguiente sección).
4. Desplegar como aplicación web y restringir el acceso.

## Reglas de seguridad del monorepo

Estas reglas aplican a todas las aplicaciones:

- **Ningún identificador de recursos de Google en el código.** IDs de
  Spreadsheets, carpetas o archivos van en las *Propiedades del script*
  (Apps Script → Configuración del proyecto), no en los archivos versionados.
- **Ningún dato personal en el repositorio**: ni en código, ni en comentarios, ni
  en documentación, ni en capturas. Los datos de ejemplo son ficticios.
- **`.clasp.json` nunca se versiona** (contiene el `scriptId` del despliegue).
- **Nada de datos reales exportados** (`.csv`, `.xlsx`): el `.gitignore` los
  bloquea, con la única excepción de las plantillas de estructura vacías.
- **Aplicaciones web restringidas** a las cuentas de la organización salvo que
  exista una razón explícita para abrirlas, sobre todo si escriben en Sheets o
  Drive.
- Si un secreto se publica, **rotar el recurso** además de reescribir el
  historial: un ID filtrado no se "des-filtra" borrando el commit.

Detalle del tratamiento de datos personales de la aplicación de registro:
[`apps/registro-personal/SECURITY.md`](apps/registro-personal/SECURITY.md).

## Licencia

[MIT](LICENSE) — Centro NIHR LatAm, Bolivia.
