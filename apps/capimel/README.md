# CAPIMEL — Plantilla de portada institucional MEL

**Centro de Análisis del Progreso Institucional para el Monitoreo, la Evaluación y el Aprendizaje**

Portada web para centros de investigación que reúne, en un solo punto de entrada, los tableros y herramientas de monitoreo, evaluación y aprendizaje (MEL) de la institución. Incluye un asistente conversacional que orienta al usuario sobre la plataforma.

Construida sobre **Google Apps Script**: sin servidores, sin costes de alojamiento y sin dependencias externas. Si tu institución ya usa Google Workspace, no necesitas nada más.

> Este repositorio es una **plantilla anonimizada**, publicada para que cualquier centro de investigación pueda copiarla y adaptarla. La versión de referencia es la del Centro NIHR LatAm en Bolivia.

---

## Índice

- [Qué incluye](#qué-incluye)
- [Cómo funciona](#cómo-funciona)
- [Requisitos previos](#requisitos-previos)
- [Instalación](#instalación)
  - [Opción A — Editor web (sin herramientas)](#opción-a--editor-web-sin-herramientas)
  - [Opción B — clasp (recomendada)](#opción-b--clasp-recomendada)
- [Adaptar la plataforma a tu centro](#adaptar-la-plataforma-a-tu-centro)
- [Configuración de despliegue y seguridad](#configuración-de-despliegue-y-seguridad)
- [Solución de problemas](#solución-de-problemas)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Contribuir](#contribuir)
- [Licencia y citación](#licencia-y-citación)

---

## Qué incluye

| Componente | Descripción |
|---|---|
| **Portada adaptable** | Diseño de una sola página, responsive, con identidad configurable. |
| **Tarjetas de módulos** | Enlaces a tus tableros MEL. El número de tarjetas es libre. |
| **Agente CAPI** | Asistente conversacional que responde sobre la plataforma y sus módulos. Base de conocimiento local, escrita a mano: **no usa ninguna API de IA externa, no tiene coste y no envía datos a terceros**. |
| **Galería social** | Publicaciones y reels de Instagram que orbitan alrededor de la mascota, con modal de reproducción. |
| **Respaldo sin conexión** | Si el servidor no responde, la portada se dibuja igualmente con una configuración de reserva. |

---

## Cómo funciona

```
┌──────────────────────────────────────────────────────────────┐
│  NAVEGADOR                                                   │
│                                                              │
│  Index.html   ── portada, estilos y lógica de interfaz       │
│       │                                                      │
│       │  google.script.run  (RPC de Apps Script)             │
│       ▼                                                      │
├──────────────────────────────────────────────────────────────┤
│  SERVIDOR — Google Apps Script                               │
│                                                              │
│  Codigo.gs        doGet()            sirve la portada        │
│                   getAppConfig()     entrega la config       │
│                   askCapi()          responde preguntas      │
│                   getLogoDataUrl()   imágenes desde Drive    │
│       │                                                      │
│       ▼                                                      │
│  Configuracion.gs   CAPIMEL_CONFIG  ← lo único que editas    │
│       │                                                      │
│       ▼                                                      │
│  Google Drive       logotipo + GIF del asistente             │
└──────────────────────────────────────────────────────────────┘
```

El agente CAPI funciona por **coincidencia de palabras clave**: `askCapi()` normaliza la pregunta (minúsculas, sin tildes, sin puntuación) y la contrasta con una base de conocimiento declarada en `Codigo.gs`. Cada entrada tiene palabras disparadoras, una respuesta y sugerencias de seguimiento. Es determinista, auditable y gratuito — pero solo sabe lo que le escribas.

---

## Requisitos previos

- Una **cuenta de Google** (personal o de Workspace).
- Acceso a [script.google.com](https://script.google.com).
- Un logotipo institucional (PNG con fondo transparente) y, opcionalmente, un GIF de mascota.
- *Solo para la Opción B:* [Node.js](https://nodejs.org) 18 o superior.

No hace falta saber programar para la instalación básica. Para adaptar la plataforma basta con editar texto dentro de un archivo de configuración.

---

## Instalación

### Opción A — Editor web (sin herramientas)

La vía más rápida. Ideal si solo quieres ponerlo en marcha.

**1. Crear el proyecto**

Entra en [script.google.com](https://script.google.com) → **Nuevo proyecto**. Ponle nombre (por ejemplo `CAPIMEL - Mi Centro`).

**2. Crear los archivos**

En el panel izquierdo, crea exactamente estos tres archivos y pega el contenido de este repositorio:

| Archivo en Apps Script | Tipo | Contenido de |
|---|---|---|
| `Codigo` | Script | `Codigo.gs` |
| `Configuracion` | Script | `Configuracion.gs` |
| `Index` | HTML | `Index.html` |

> ⚠️ El nombre `Index` debe escribirse **exactamente así**. `doGet()` lo busca por ese nombre con `createHtmlOutputFromFile('Index')`. Apps Script añade la extensión solo, no la escribas.

Puedes borrar el archivo `Código.gs` que Apps Script crea por defecto.

**3. Aplicar el manifiesto**

Icono ⚙️ **Configuración del proyecto** → marca **«Mostrar el archivo de manifiesto appsscript.json»**. Aparecerá en el panel izquierdo: reemplaza su contenido por el `appsscript.json` de este repositorio.

**4. Subir las imágenes a Drive**

Sube tu logotipo y tu GIF a Google Drive, compártelos como **«Cualquier persona con el enlace»** en modo lectura, y copia sus ID (ver instrucciones dentro de `Configuracion.gs`).

**5. Autorizar el acceso a Drive**

En el selector de funciones elige `testAssetsAccess` y pulsa **Ejecutar**. Google pedirá autorización — acéptala. Verás una advertencia de «app no verificada»: es normal en proyectos propios; entra en **Configuración avanzada → Ir a (nombre del proyecto)**.

Si el registro muestra los nombres y tamaños de tus dos imágenes, la configuración es correcta.

**6. Desplegar**

**Implementar → Nueva implementación** → tipo **Aplicación web**:

| Campo | Valor |
|---|---|
| Ejecutar como | **Yo** |
| Quién tiene acceso | Ver la [sección de seguridad](#configuración-de-despliegue-y-seguridad) |

Copia la URL `/exec` resultante. Esa es tu plataforma.

---

### Opción B — clasp (recomendada)

Mantiene el código en git, permite revisión por pares y despliegues reproducibles.

```bash
# 1. Instalar clasp e iniciar sesión
npm install -g @google/clasp
clasp login

# 2. Clonar esta plantilla
git clone https://github.com/centronihrlatam-tech/CENTRONIHRCAPIMEL-.git mi-capimel
cd mi-capimel

# 3. Desvincular del repositorio original y crear el tuyo
rm -rf .git
git init

# 4. Crear tu propio proyecto de Apps Script
clasp create --type webapp --title "CAPIMEL - Mi Centro" --rootDir .

# 5. Editar Configuracion.gs con los datos de tu centro
#    (y el bloque FALLBACK_CONFIG de Index.html — ver siguiente sección)

# 6. Subir y desplegar
clasp push
clasp deploy --description "Despliegue inicial"

# 7. Abrir en el navegador para autorizar los permisos de Drive
clasp open
```

`clasp create` genera un `.clasp.json` con el ID de tu proyecto. **Está en `.gitignore` a propósito**: es específico de tu instalación. El archivo `.clasp.json.example` documenta su formato.

---

## Adaptar la plataforma a tu centro

### ⚠️ La configuración vive en DOS lugares

Es la fuente de error más común al adaptar esta plantilla. Los mismos valores existen en:

1. **`Configuracion.gs`** → fuente de verdad, la sirve el servidor.
2. **`Index.html`, bloque `FALLBACK_CONFIG`** (cerca de la línea 4930) → respaldo que se usa **solo si la llamada al servidor falla**.

Si editas únicamente el primero, todo parecerá funcionar... hasta que un usuario con conexión inestable vea la identidad del centro anterior. **Edita siempre los dos.**

### Lista de comprobación

| # | Qué cambiar | Dónde | Obligatorio |
|---|---|---|---|
| 1 | Nombre, país, subtítulo, descripción | `Configuracion.gs` §1 + `FALLBACK_CONFIG` | ✅ |
| 2 | ID del logotipo y del GIF en Drive | `Configuracion.gs` §2 + `FALLBACK_CONFIG` | ✅ |
| 3 | Módulos: nombre, descripción, URL, color | `Configuracion.gs` §4 + `FALLBACK_CONFIG` | ✅ |
| 4 | Alias del agente CAPI | `Codigo.gs`, `findModuleAnswer_()` (línea ~314) | ✅ si cambias los módulos |
| 5 | Base de conocimiento del agente | `Codigo.gs`, array `knowledge` en `askCapi()` | Recomendado |
| 6 | Publicaciones de Instagram | `Index.html`, `INSTAGRAM_MEDIA` (línea ~5040) | Opcional |
| 7 | Zona horaria | `appsscript.json` → `timeZone` | Recomendado |
| 8 | Titular del copyright | `LICENSE` | ✅ |

### Sobre el punto 4 — los alias del agente

`findModuleAnswer_()` asocia los módulos **por posición**, no por nombre:

```js
const aliases = [
  ['masterlab', 'master lab', 'masterclass'],       // → modules[0]
  ['radar de investigacion', 'radar'],              // → modules[1]
  ['pulso del talento', 'talento', 'desempeno'],    // → modules[2]
  ['centro de control financiero', 'financiero']    // → modules[3]
];
```

Si cambias el número o el orden de tus módulos, **actualiza este array en paralelo** o CAPI enviará a la gente al módulo equivocado. Escribe los alias en minúsculas, sin tildes y sin signos de puntuación: así es como `normalizeCapiText_()` deja las preguntas antes de compararlas.

### Sobre el punto 5 — enseñarle a CAPI

Añadir conocimiento es añadir un objeto al array `knowledge`:

```js
{
  words: ['datos abiertos', 'open data', 'compartir datos'],
  answer: 'Nuestro centro publica sus conjuntos de datos bajo …',
  suggestions: ['¿Cómo cito los datos?', '¿Qué licencia tienen?']
}
```

Incluye variantes reales de escritura en `words` — con y sin tilde, en singular y plural, siglas y forma desarrollada. La coincidencia es por subcadena, así que `'investigacion'` también captura `'investigaciones'`.

### Verificar los cambios

```bash
clasp push && clasp open
```

En el editor, ejecuta `testCapiAgent` para comprobar el agente y `testAssetsAccess` para las imágenes. Después abre la URL `/exec` en una **ventana de incógnito**: es la única forma fiable de ver lo que ve un usuario real, sin tu sesión de administrador.

---

## Configuración de despliegue y seguridad

En Apps Script la seguridad **no está en el código, está en la configuración de despliegue**. Cada módulo que enlaces es un proyecto independiente con sus propios permisos.

### Elegir «Quién tiene acceso»

| Valor | Quién entra | Cuándo usarlo |
|---|---|---|
| `Solo yo` | Únicamente tú | Durante el desarrollo |
| `Cualquier usuario de tu-dominio.edu` | Miembros de tu Workspace | **Cualquier módulo con datos internos** |
| `Cualquier usuario` | Todo internet, sin sesión | Solo portadas puramente informativas |

**Regla práctica:** si un módulo muestra datos financieros, de personal o cualquier información no publicable, debe estar restringido al dominio institucional. Las URL `/exec` son visibles para cualquiera que abra la portada — no son un secreto y no deben tratarse como tal.

Esta plantilla se distribuye con `"access": "ANYONE_ANONYMOUS"` en `appsscript.json` porque la portada de referencia es pública e informativa. **Revisa este valor antes de tu primer despliegue.**

### Consideraciones adicionales

- **Incrustación en iframes.** `doGet()` usa `XFrameOptionsMode.ALLOWALL`, lo que permite embeber la portada en Google Sites o el portal de tu institución. También permite que la embeba cualquier otro sitio. Si no necesitas incrustarla, cámbialo a `XFrameOptionsMode.DEFAULT` en `Codigo.gs`.
- **Permisos mínimos.** El manifiesto solo pide `drive.readonly`. No amplíes los scopes salvo que añadas funciones que lo requieran.
- **Funciones invocables.** En Apps Script, toda función **sin `_` final** puede ser llamada desde el cliente vía `google.script.run`. Si añades funciones que lean datos sensibles, termínalas en `_` o valida la identidad con `Session.getActiveUser().getEmail()`.
- **Archivos de Drive.** Comparte solo el logotipo y el GIF, nunca la carpeta que los contiene: los permisos se heredan hacia abajo.
- **Nunca subas secretos al repositorio.** Si en el futuro necesitas claves o tokens, guárdalos en `PropertiesService.getScriptProperties()`, jamás en el código. El `.gitignore` incluido cubre los descuidos más habituales.

---

## Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| Pantalla en blanco al abrir `/exec` | El archivo HTML no se llama `Index` | Renómbralo exactamente a `Index` |
| Se ve el nombre del centro anterior | Solo editaste `Configuracion.gs` | Edita también `FALLBACK_CONFIG` en `Index.html` |
| El logotipo o el GIF no cargan | ID incorrecto, o archivo no compartido | Ejecuta `testAssetsAccess` y revisa el registro |
| `Exception: No item with the given ID` | El archivo no pertenece a la cuenta que ejecuta el script | Compártelo con esa cuenta o súbelo desde ella |
| CAPI abre el módulo equivocado | Los alias no coinciden con el orden de `modules` | Sincroniza `findModuleAnswer_()` con tu array |
| CAPI no entiende una pregunta obvia | Falta esa variante en `words` | Añade la forma normalizada: minúsculas, sin tildes |
| Los reels de Instagram no se ven | Cuenta privada, o publicación eliminada | Solo se pueden incrustar cuentas públicas |
| Los cambios no aparecen tras `clasp push` | Estás mirando un despliegue antiguo | Crea una nueva versión, o usa la URL `/dev` para probar |
| `clasp push` falla con «User has not enabled the Apps Script API» | API desactivada en tu cuenta | Actívala en [script.google.com/home/usersettings](https://script.google.com/home/usersettings) |
| Advertencia de «app no verificada» | Proyecto propio sin verificar por Google | Es esperado: **Configuración avanzada → Ir a (proyecto)** |

---

## Estructura del repositorio

Esta aplicación vive en `apps/capimel/` dentro del monorepo del centro
(ver el [README raíz](../../README.md)).

```
apps/capimel/
├── Configuracion.gs        ← EDITA ESTE ARCHIVO para adaptar la plataforma
├── Codigo.gs               Lógica del servidor: doGet, getAppConfig, agente CAPI
├── Index.html              Portada completa: estructura, estilos e interacción
├── appsscript.json         Manifiesto: scopes, zona horaria, tipo de despliegue
├── .clasp.json.example     Plantilla de configuración de clasp
└── README.md               Este documento
```

El `.gitignore` y la `LICENSE` son comunes a todo el monorepo y están en la raíz.
Al usar `clasp`, ejecútalo desde esta carpeta.

`Index.html` es un archivo único y extenso (~8.400 líneas) que contiene HTML, CSS y JavaScript juntos. No es un descuido: **Apps Script sirve un único documento HTML**, y mantenerlo autocontenido evita dependencias externas y hace la plataforma reproducible tal cual. Las secciones están delimitadas por comentarios de bloque en mayúsculas para facilitar la navegación.

---

## Contribuir

Las adaptaciones y mejoras son bienvenidas. Si tu centro despliega una variante, un *issue* contándolo ayuda a otros a orientarse.

Al enviar un *pull request*:

- Verifica que no incluya ID de Drive, URL de despliegue ni datos de tu institución.
- Conserva el estilo del código existente (funciones privadas con `_`, comentarios en español).
- Describe qué probaste y en qué navegadores.

**Reporte de vulnerabilidades:** si encuentras un problema de seguridad, no abras un *issue* público. Escribe directamente al mantenedor del repositorio.

---

## Licencia y citación

Distribuido bajo licencia [MIT](../../LICENSE) — puedes usar, copiar, modificar y redistribuir el código, incluso con fines institucionales, conservando el aviso de copyright.

Si esta plantilla resulta útil en un contexto académico, una citación ayuda a sostener el trabajo:

```bibtex
@software{capimel2026,
  title  = {CAPIMEL: Plantilla de portada institucional para
            Monitoreo, Evaluación y Aprendizaje},
  author = {{Centro NIHR LatAm Bolivia}},
  year   = {2026},
  url    = {https://github.com/centronihrlatam-tech/CENTRONIHRCAPIMEL-},
  note   = {Licencia MIT}
}
```

---

<sub>Desarrollado por el Centro NIHR LatAm en Bolivia · Publicado como plantilla reproducible para la comunidad de investigación en salud de América Latina.</sub>
