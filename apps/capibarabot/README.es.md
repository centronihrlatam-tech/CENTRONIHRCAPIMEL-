# CAPIBARABOT

> Aplicación del monorepo del Centro NIHR LatAm, desplegada bajo el nombre
> **CAPIBARABOT**. Código base: *AI Planner Bot*, de
> [Fernandrezz](https://github.com/Fernandrezz/ai-planner-bot), integrado aquí
> con su autorización. Conserva sus propios términos de uso: **no está cubierto
> por la licencia MIT de la raíz** del monorepo (ver "Estado y licencia").
> Índice de aplicaciones en el [README raíz](../../README.md).


[English version](README.md)

**AI Planner Bot** es una herramienta de automatización basada en mensajería que reduce el tiempo necesario para registrar actividades diarias en un planner estructurado de Google Sheets.

Fue desarrollada en el contexto operativo de un **centro de investigación** e integra **Telegram, Google Apps Script, OpenAI, Google Sheets y Google Drive** para que los usuarios puedan registrar actividades desde un teléfono o una computadora mediante lenguaje natural, botones interactivos o una combinación de ambos. La evidencia fotográfica puede enviarse directamente por Telegram, almacenarse en Drive y vincularse automáticamente al registro correspondiente.

Este repositorio contiene una **versión pública anonimizada y autorizada para fines académicos y de portafolio profesional**. No incluye credenciales de producción, asociaciones reales de usuarios, datos organizacionales ni identificadores privados de recursos de Google Workspace.

## El problema

El proyecto comenzó a partir de una tarea asignada de mejora de procesos relacionada con recordatorios recurrentes en Google Calendar y seguimiento mediante planner. Durante el análisis de ese flujo se identificó una oportunidad más amplia: registrar una sola actividad podía requerir varios pasos repetitivos.

```text
Actividad realizada
      ↓
Abrir el planner
      ↓
Completar varios campos requeridos
      ↓
Subir evidencia a Google Drive
      ↓
Copiar el enlace
      ↓
Volver al planner
      ↓
Pegar el enlace de evidencia
```

Este proceso se vuelve especialmente poco eficiente cuando una persona:

- realiza muchas actividades en un mismo día;
- trabaja fuera de oficina;
- realiza trabajo de campo donde transportar o utilizar una computadora puede ser poco práctico;
- necesita ponerse al día después de regresar del campo;
- debe subir y enlazar evidencias de forma repetitiva;
- tiene una forma de escribir distinta a la de otros miembros del equipo.

## La solución

AI Planner Bot convierte una plataforma de mensajería en una interfaz ligera para el planner, accesible desde celular y computadora.

```text
Actividad realizada
      ↓
Mensaje de Telegram + imagen opcional
      ↓
Interpretación asistida por IA
      ↓
Evidencia almacenada en Google Drive
      ↓
Registro estructurado en Google Sheets
      ↓
Evento de uso registrado para analíticas
```

El objetivo no es obligar a las personas a utilizar un formulario rígido, sino adaptar mensajes informales a la estructura que ya utiliza el equipo.

## ¿Por qué Telegram?

Telegram fue elegido para la implementación actual porque ofrece una API de bots estable y accesible sin requerir infraestructura de mensajería de pago para este caso de uso.

La solución **no depende conceptualmente de Telegram**. Podría adaptarse a otra plataforma estable si ofrece capacidades equivalentes para texto, imágenes/archivos, respuestas interactivas, identificación de usuarios, webhooks y respuestas programáticas.

Telegram también puede utilizarse tanto desde **teléfonos móviles como desde computadoras**, lo que resulta útil para el trabajo en oficina, desplazamientos y registro posterior a actividades de campo.

## Funcionalidades principales

- Registro de actividades desde Telegram.
- Uso desde celular o computadora.
- Interpretación de lenguaje natural mediante OpenAI.
- Reconocimiento flexible de fechas y horarios.
- Relación de categorías escritas aproximadamente con etiquetas válidas del planner.
- Registro retrospectivo de actividades realizadas en fechas anteriores.
- Carga directa de evidencia fotográfica a Google Drive.
- Inserción automática del enlace de evidencia en el planner.
- Registro guiado mediante botones interactivos.
- Modos de escritura libre e híbrido.
- Manejo de diferentes roles y planners.
- Lectura dinámica de etiquetas válidas desde cada planner.
- Asignación automática del estado `Proceso` o `Terminado`.
- Analíticas centralizadas de uso y adopción.
- Tutorial integrado mediante `/tutorial`.
- Canal configurable de soporte y retroalimentación.

## Registro flexible

Una misma actividad puede escribirse de distintas maneras.

Una versión estructurada:

```text
03/07/2026. Revisión de documentos. 11:00 - 12:30.
Compo General. Subcompo Otro.
```

Una versión más natural:

```text
Revision de documentos de 1100 a 1230 compo general subcompo otro el 03072026
```

Ambas pueden normalizarse como:

```text
Fecha: 03/07/2026
Descripción: Revisión de documentos
Hora inicio: 11:00
Hora fin: 12:30
Componente: General
Subcomponente: Otro
```

También se puede escribir únicamente:

```text
revision documentos de 1100 a 1230
```

y adjuntar la imagen de evidencia. Las etiquetas previamente seleccionadas mediante botones pueden combinarse con el mensaje libre. Si todavía falta información requerida, la actividad permanece en `Proceso` sin obligar al usuario a comenzar desde cero.

El sistema busca tolerar variaciones habituales como:

```text
11:00 a 12:30
1100 a 1230
03/07/2026
03072026
```

Esto reduce el tiempo invertido en corregir formato, signos, mayúsculas o pequeñas diferencias en la forma de escribir.

## Flujo guiado e híbrido

El comando `/tarea` inicia un registro guiado:

```text
Tipo
  ↓
Componente
  ↓
Subcomponente
  ↓
Encargado, cuando corresponde
  ↓
Descripción + horario + evidencia
```

Los botones se generan a partir de etiquetas válidas que ya existen en el planner de cada usuario, en lugar de mostrar el mismo menú fijo para todos.

También es posible combinar ambos métodos: seleccionar algunas categorías mediante botones y completar la actividad con un mensaje libre y una imagen.

## Automatización de evidencias y trabajo de campo

Uno de los principales puntos de fricción del flujo original era el manejo de evidencias.

### Proceso manual

```text
Tomar fotografía
  ↓
Abrir Google Drive
  ↓
Buscar la carpeta correcta
  ↓
Subir la imagen
  ↓
Copiar el enlace
  ↓
Abrir el planner
  ↓
Pegar el enlace
```

### Con AI Planner Bot

```text
Adjuntar imagen en Telegram
          ↓
Carga a Drive + enlace en planner de forma automática
```

Esto resulta especialmente útil en trabajo de campo. Si una actividad no puede registrarse inmediatamente, el usuario puede completarla posteriormente indicando la fecha y horario correspondientes y ponerse al día en menos tiempo desde el celular o la computadora.

## Analíticas de uso y adopción

Además del registro individual en el planner, el bot puede generar un evento centralizado de analíticas por cada envío.

La implementación pública permite utilizar un **alias analítico privado**, configurado mediante Script Properties, para medir adopción sin almacenar el ID real de Telegram en la hoja de analíticas.

El registro analítico incluye:

- fecha y hora del envío;
- alias configurado del usuario;
- rol;
- estado final;
- presencia o ausencia de evidencia;
- tipo de actividad;
- componente;
- subcomponente;
- fecha de la actividad.

De forma intencional, la hoja de analíticas **no almacena** la descripción de la tarea, el ID de Telegram, el enlace de evidencia ni el cuerpo completo del mensaje.

Estas métricas permiten:

- identificar mayor o menor adopción;
- observar cambios en el uso a lo largo del tiempo;
- detectar usuarios que podrían necesitar acompañamiento;
- orientar conversaciones específicas de retroalimentación;
- generar gráficos e indicadores de uso;
- integrar las métricas del bot con otras analíticas automatizadas de la organización.

Así se genera un ciclo de **implementación → medición → retroalimentación → mejora**.

## Tutorial, incorporación y soporte

El bot incorpora el comando `/tutorial` para facilitar la incorporación de nuevos usuarios. La guía explica:

- registro mediante escritura libre;
- flujo guiado con `/tarea`;
- campos reconocidos por el planner;
- carga de evidencia;
- estados `Proceso` y `Terminado`;
- cancelación de un registro iniciado;
- ejemplos de distintas formas válidas de escribir una actividad.

El correo de soporte puede configurarse mediante `SUPPORT_EMAIL` en Script Properties para que los usuarios puedan realizar consultas, informar problemas o proponer mejoras. El repositorio no incluye ninguna dirección real utilizada en producción.

## Uso en un entorno real

La herramienta se encuentra en uso activo por una parte importante del equipo para el cual fue desarrollada. Esto permite obtener datos reales de utilización y retroalimentación directa de los usuarios, de modo que las mejoras puedan basarse en la adopción observada y no únicamente en supuestos.

Su utilidad resulta especialmente visible cuando deben registrarse varias actividades en un mismo día o cuando las tareas realizadas en campo necesitan documentarse posteriormente.

## Arquitectura

```text
                         ┌──────────────────────┐
                         │       Usuario        │
                         │   Móvil / Escritorio │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │      Telegram        │
                         └──────────┬───────────┘
                                    │ Webhook
                                    ▼
                         ┌──────────────────────┐
                         │ Google Apps Script   │
                         └──────┬───────┬───────┘
                                │       │
                   ┌────────────┘       └────────────┐
                   ▼                                 ▼
          ┌──────────────────┐             ┌──────────────────┐
          │    OpenAI API    │             │   Google Drive   │
          │ Interpreta texto │             │ Guarda evidencia │
          └────────┬─────────┘             └────────┬─────────┘
                   │                                │
                   └──────────────┬─────────────────┘
                                  ▼
                         ┌──────────────────────┐
                         │    Google Sheets     │
                         │ Planner + Analíticas │
                         └──────────────────────┘
```

## Tecnologías

| Tecnología | Uso |
|---|---|
| Google Apps Script | Backend y automatización del flujo |
| Telegram Bot API | Interfaz de mensajería |
| OpenAI API | Interpretación de lenguaje natural |
| Google Sheets | Planners y analíticas |
| Google Drive | Almacenamiento de evidencias |
| PropertiesService | Configuración privada del despliegue |
| CacheService | Estado temporal de los flujos guiados |

## Estructura del planner

La implementación localiza las columnas por el nombre de sus encabezados, reduciendo la dependencia de posiciones fijas.

Los encabezados habituales incluyen:

```text
tipo
compo
sub_comp
descripcion
fecha
hora inicio
hora fin
estado
respaldo - link
```

Algunos roles también pueden utilizar:

```text
encargado
```

La estructura responde al flujo para el cual se desarrolló originalmente la herramienta y puede adaptarse a otros equipos.

## Configuración

Los valores específicos de cada despliegue se almacenan mediante **Google Apps Script Script Properties** y no forman parte del código versionado.

Consulta [CONFIGURATION.example.md](CONFIGURATION.example.md) para ver el ejemplo completo.

Las principales propiedades son:

- `TELEGRAM_TOKEN`
- `WEBHOOK_SECRET`
- `OPENAI_API_KEY`
- `DIRECTORIO_CARPETAS`
- `PLANNERS_CONTRATADOS`
- `PLANNERS_PASANTES`
- `ID_PLANILLA_ANALITICAS` (opcional)
- `ANALYTICS_USER_ALIASES` (opcional; recomendado cuando se utilizan analíticas de adopción)
- `SUPPORT_EMAIL` (opcional)
- `TIME_ZONE` (opcional)
- `OPENAI_MODEL` (opcional)

Las autorizaciones de producción utilizan IDs numéricos estables de Telegram. Los IDs reales de usuarios y recursos de Google permanecen únicamente en Script Properties.

## Seguridad y privacidad

El repositorio público está separado intencionalmente del entorno de producción.

La implementación incluye, entre otras medidas:

- secreto específico para autenticar el webhook;
- validación de chats privados;
- autorización mediante ID estable de Telegram;
- credenciales y asociaciones de recursos fuera del repositorio;
- neutralización de inyección de fórmulas antes de escribir en Sheets;
- redacción básica de correos, URLs y cadenas similares a teléfonos antes de enviar el texto de la tarea a clasificación por IA;
- analíticas basadas en alias configurables en lugar de IDs reales de Telegram;
- exclusión de cuerpos de mensajes, descripciones y enlaces de evidencia de la hoja de analíticas.

El texto de la tarea y las etiquetas necesarias del planner sí se envían al proveedor de IA configurado para realizar la clasificación. La redacción automática no garantiza una desidentificación completa, por lo que cada despliegue debe definir sus propias medidas de privacidad, retención, cumplimiento contractual y gobernanza de datos.

Consulta [SECURITY.md](SECURITY.md).

## Procedencia del proyecto y relevancia profesional

El software surgió de una necesidad real de mejora de procesos dentro de un **centro de investigación**. La tarea inicial estaba orientada a optimizar un flujo de recordatorios y planner; posteriormente, el autor del repositorio diseñó y desarrolló la implementación más amplia basada en bot que se documenta aquí.

**El diseño técnico y el desarrollo del código fuente de esta implementación pública fueron realizados por el autor del repositorio.**

La versión pública anonimizada se publica con autorización para **fines académicos y de portafolio profesional**. La institución no se identifica y se excluyen datos de producción, credenciales, información de usuarios, evidencias e infraestructura privada.

Desde una perspectiva curricular, el proyecto documenta el recorrido completo de:

**necesidad operativa → rediseño del flujo → implementación técnica → uso real → medición de adopción → mejora iterativa**.

Consulta [PROVENANCE.md](PROVENANCE.md) para la nota de procedencia del proyecto.

## Limitaciones actuales

- Dependencia de las cuotas y límites de Google Apps Script.
- La lógica principal del sistema se ejecuta actualmente en Google Apps Script, una solución adecuada para la escala actual, aunque una implementación considerablemente mayor podría requerir infraestructura más escalable.
- La calidad de la interpretación de lenguaje natural depende de la respuesta del modelo configurado.
- Las analíticas están orientadas al seguimiento operativo de adopción y no constituyen un sistema completo de telemetría de producto.
- La interfaz está optimizada para el flujo de planner existente.

## Posibles mejoras futuras

- Edición o corrección de actividades previamente registradas desde Telegram.
- Transcripción de mensajes de voz.
- Múltiples evidencias por actividad.
- Validación estructurada de las respuestas de IA.
- Dashboards automáticos e informes configurables.
- Recordatorios para registros incompletos.
- Pruebas automatizadas y mayor modularización del código.
- Integración con otras plataformas de mensajería.
- Migración a infraestructura más escalable si el uso crece de forma considerable.

## Despliegue

1. Crear un proyecto de Google Apps Script.
2. Añadir `Code.gs` y `appsscript.json`.
3. Configurar las Script Properties requeridas.
4. Autorizar los servicios de Google necesarios.
5. Implementar el proyecto como aplicación web.
6. Añadir el `WEBHOOK_SECRET` privado a la URL de despliegue.
7. Configurar esa URL privada como webhook de Telegram.
8. Probar con un usuario de prueba antes de ampliar el uso.

Para flujos basados en clasp se incluye `.clasp.json.example`, mientras que el `.clasp.json` real queda excluido mediante `.gitignore`.

## Estado y licencia

**Estado:** Activo / en mejora continua.

Redistribuido dentro de este monorepo con autorización del autor, bajo el
nombre CAPIBARABOT. El `LICENSE` (MIT) de la raíz **no** aplica a este
directorio.

Esta versión de portafolio no incluye una licencia de código abierto. La disponibilidad pública del código no concede a terceros permiso para copiarlo, modificarlo, redistribuirlo, comercializarlo o implementarlo. Cualquier derecho adicional de reutilización debe solicitarse al titular de derechos que corresponda.

---

**Stack:** JavaScript · Google Apps Script · Telegram Bot API · OpenAI API · Google Sheets · Google Drive
