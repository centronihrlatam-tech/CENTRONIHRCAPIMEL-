/**
 * CAPIMEL — Lógica de la aplicación.
 *
 * ⚠️  NO necesitas editar este archivo para adaptar la plataforma a tu centro.
 *     Toda la personalización vive en `Configuracion.gs`.
 *
 * Este archivo contiene:
 *   · doGet()            → sirve la portada como aplicación web
 *   · getAppConfig()     → entrega la configuración al frontend (Index.html)
 *   · askCapi()          → agente conversacional CAPI (base de conocimiento local)
 *   · fileToDataUrl_()   → convierte imágenes de Drive en Data URL
 *
 * Convención de Apps Script: las funciones que terminan en `_` son privadas
 * y NO pueden invocarse desde el cliente con google.script.run.
 */


/**
 * Muestra la portada como aplicación web.
 */
function doGet() {
  return HtmlService
    .createHtmlOutputFromFile('Index')
    .setTitle(CAPIMEL_CONFIG.appName)
    .setXFrameOptionsMode(
      HtmlService.XFrameOptionsMode.ALLOWALL
    )
    .addMetaTag(
      'viewport',
      'width=device-width, initial-scale=1, viewport-fit=cover'
    );
}

/**
 * Envía la configuración a Index.html.
 */
function getAppConfig() {
  return JSON.parse(
    JSON.stringify(CAPIMEL_CONFIG)
  );
}

/**
 * Agente institucional CAPI.
 */
function askCapi(question) {
  const cleanQuestion = String(question || '')
    .trim()
    .slice(0, 500);

  if (!cleanQuestion) {
    return capiResponse_(
      'Escribe una pregunta y con gusto te ayudaré.',
      [
        '¿Qué es CAPIMEL?',
        '¿Qué módulos tiene?',
        '¿Qué significa MEL?'
      ]
    );
  }

  const text = normalizeCapiText_(cleanQuestion);
  const moduleAnswer = findModuleAnswer_(text);

  if (moduleAnswer) {
    return moduleAnswer;
  }

  const knowledge = [
    {
      words: [
        'hola',
        'buen dia',
        'buenas',
        'saludos',
        'hey'
      ],
      answer:
        '¡Hola! Soy CAPI, el asistente de CAPIMEL Bolivia. Puedo explicarte qué es la plataforma, sus módulos y el ciclo de monitoreo, evaluación y aprendizaje.',
      suggestions: [
        '¿Qué es CAPIMEL?',
        '¿Qué módulos tiene?',
        '¿Cómo uso la plataforma?'
      ]
    },
    {
      words: [
        'que es capimel',
        'de que trata',
        'para que sirve',
        'que hace capimel',
        'capimel'
      ],
      answer:
        'CAPIMEL Bolivia es el Centro de Análisis del Progreso Institucional para el Monitoreo, la Evaluación y el Aprendizaje. Integra información, evidencia y herramientas para apoyar decisiones y fortalecer el trabajo del Centro NIHR LatAm en Bolivia.',
      suggestions: [
        '¿Qué significa MEL?',
        '¿Qué módulos tiene?',
        '¿Cuál es su objetivo?'
      ]
    },
    {
      words: [
        'significa capimel',
        'nombre capimel',
        'sigla capimel'
      ],
      answer:
        'CAPIMEL significa Centro de Análisis del Progreso Institucional para el Monitoreo, la Evaluación y el Aprendizaje.',
      suggestions: [
        '¿Qué significa MEL?',
        '¿Cuál es su objetivo?'
      ]
    },
    {
      words: [
        'que significa mel',
        'ciclo mel',
        'monitoreo evaluacion aprendizaje',
        'mel'
      ],
      answer:
        'MEL reúne tres procesos: monitoreo para seguir avances, evaluación para interpretar resultados y aprendizaje para convertir la evidencia en mejoras y decisiones institucionales.',
      suggestions: [
        '¿Qué es monitoreo?',
        '¿Qué es evaluación?',
        '¿Qué es aprendizaje?'
      ]
    },
    {
      words: [
        'monitoreo',
        'monitorear'
      ],
      answer:
        'El monitoreo permite seguir continuamente actividades, avances e indicadores para conocer qué se está realizando y detectar oportunamente necesidades de ajuste.',
      suggestions: [
        '¿Qué es evaluación?',
        '¿Qué es aprendizaje?',
        'Ver los módulos'
      ]
    },
    {
      words: [
        'evaluacion',
        'evaluar'
      ],
      answer:
        'La evaluación analiza la información y la evidencia para comprender resultados, valorar el progreso y respaldar decisiones más claras.',
      suggestions: [
        '¿Qué es monitoreo?',
        '¿Qué es aprendizaje?',
        '¿Cuál es el objetivo?'
      ]
    },
    {
      words: [
        'aprendizaje',
        'aprender'
      ],
      answer:
        'El aprendizaje institucional transforma datos y experiencias en conocimiento útil para mejorar procesos, compartir buenas prácticas y realizar ajustes.',
      suggestions: [
        '¿Qué significa MEL?',
        '¿Qué módulos tiene?'
      ]
    },
    {
      words: [
        'objetivo',
        'proposito',
        'finalidad'
      ],
      answer:
        'El objetivo de CAPIMEL es transformar datos, evidencia y aprendizaje en decisiones que fortalezcan la gestión y el progreso institucional del Centro NIHR LatAm en Bolivia.',
      suggestions: [
        '¿Qué es CAPIMEL?',
        '¿Qué módulos tiene?'
      ]
    },
    {
      words: [
        'modulos',
        'herramientas',
        'accesos',
        'plataformas'
      ],
      answer: buildModulesSummary_(),
      suggestions: [
        'CAPI MasterLab',
        'Radar de Investigación',
        'Pulso del Talento',
        'Centro de Control Financiero'
      ]
    },
    {
      words: [
        'como usar',
        'como uso',
        'usar plataforma',
        'como ingreso',
        'como entrar',
        'navegar',
        'abrir modulo'
      ],
      answer:
        'Presiona “Explorar CAPIMEL” o la barra “CAPIMEL Bolivia activo”. Luego selecciona el módulo que necesites.',
      suggestions: [
        '¿Qué módulos tiene?',
        'CAPI MasterLab',
        'Radar de Investigación'
      ]
    },
    {
      words: [
        'quien eres',
        'capi',
        'asistente'
      ],
      answer:
        'Soy CAPI, el asistente virtual de CAPIMEL Bolivia. Mi función es orientarte sobre la plataforma, el enfoque MEL y sus módulos institucionales.',
      suggestions: [
        '¿Qué es CAPIMEL?',
        '¿Qué puedes responder?'
      ]
    },
    {
      words: [
        'que puedes responder',
        'ayuda',
        'opciones',
        'preguntas'
      ],
      answer:
        'Puedo explicarte qué es CAPIMEL, qué significa MEL, para qué sirve cada módulo y cómo navegar por la plataforma.',
      suggestions: [
        '¿Qué es CAPIMEL?',
        '¿Qué significa MEL?',
        '¿Qué módulos tiene?'
      ]
    },
    {
      words: [
        'bolivia',
        'nihr',
        'centro nihr'
      ],
      answer:
        'CAPIMEL fue diseñado para apoyar al equipo del Centro NIHR LatAm en Bolivia mediante monitoreo, evaluación, aprendizaje y acceso organizado a herramientas institucionales.',
      suggestions: [
        '¿Qué es CAPIMEL?',
        '¿Cuál es su objetivo?'
      ]
    },
    {
      words: [
        'datos personales',
        'privacidad',
        'confidencial',
        'pacientes'
      ],
      answer:
        'CAPI brinda orientación institucional general. No debe recibir ni revelar nombres, diagnósticos u otros datos personales o confidenciales de participantes.',
      suggestions: [
        '¿Qué puedes responder?',
        '¿Qué es CAPIMEL?'
      ]
    }
  ];

  let best = null;
  let bestScore = 0;

  knowledge.forEach(function (item) {
    const score = item.words.reduce(
      function (total, word) {
        return total +
          (
            text.indexOf(word) !== -1
              ? word.split(' ').length
              : 0
          );
      },
      0
    );

    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  });

  if (best) {
    return capiResponse_(
      best.answer,
      best.suggestions
    );
  }

  return capiResponse_(
    'Por ahora puedo ayudarte con información sobre CAPIMEL, el ciclo MEL y sus cuatro módulos.',
    [
      '¿Qué es CAPIMEL?',
      '¿Qué significa MEL?',
      '¿Qué módulos tiene?'
    ]
  );
}

/**
 * Detecta preguntas sobre un módulo.
 */
function findModuleAnswer_(text) {
  const aliases = [
    [
      'masterlab',
      'master lab',
      'masterclass',
      'clases magistrales'
    ],
    [
      'radar de investigacion',
      'radar',
      'investigacion'
    ],
    [
      'pulso del talento',
      'talento',
      'desempeno'
    ],
    [
      'centro de control financiero',
      'control financiero',
      'presupuesto',
      'financiero'
    ]
  ];

  for (
    let index = 0;
    index < aliases.length;
    index += 1
  ) {
    const matches = aliases[index].some(
      function (alias) {
        return text.indexOf(alias) !== -1;
      }
    );

    if (matches) {
      const module =
        CAPIMEL_CONFIG.modules[index];

      return capiResponse_(
        module.name +
          ': ' +
          module.description +
          ' Puedes abrirlo desde “Explorar CAPIMEL”.',
        [
          '¿Qué módulos tiene?',
          '¿Cómo uso la plataforma?'
        ],
        {
          label: 'Abrir ' + module.name,
          url: module.url
        }
      );
    }
  }

  return null;
}

/**
 * Resume los módulos.
 */
function buildModulesSummary_() {
  return (
    'CAPIMEL reúne cuatro accesos: ' +
    CAPIMEL_CONFIG.modules
      .map(function (module) {
        return module.name;
      })
      .join(', ') +
    '.'
  );
}

/**
 * Estructura de respuesta.
 */
function capiResponse_(
  answer,
  suggestions,
  action
) {
  return {
    ok: true,
    answer: answer,
    suggestions: suggestions || [],
    action: action || null
  };
}

/**
 * Normaliza las preguntas.
 */
function normalizeCapiText_(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Respaldo del GIF.
 */
function getCapiGifDataUrl() {
  return fileToDataUrl_(
    CAPIMEL_CONFIG.capiGifId,
    'image/gif'
  );
}

/**
 * Respaldo del logotipo.
 */
function getLogoDataUrl() {
  return fileToDataUrl_(
    CAPIMEL_CONFIG.logoId,
    'image/png'
  );
}

/**
 * Convierte archivos de Drive en Data URL.
 */
function fileToDataUrl_(
  fileId,
  fallbackMimeType
) {
  const blob = DriveApp
    .getFileById(fileId)
    .getBlob();

  const mimeType =
    blob.getContentType() ||
    fallbackMimeType;

  return (
    'data:' +
    mimeType +
    ';base64,' +
    Utilities.base64Encode(
      blob.getBytes()
    )
  );
}

/**
 * Autoriza acceso al GIF y al logo.
 */
function testAssetsAccess() {
  const gif = DriveApp.getFileById(
    CAPIMEL_CONFIG.capiGifId
  );

  const logo = DriveApp.getFileById(
    CAPIMEL_CONFIG.logoId
  );

  const result = {
    ok: true,

    gif: {
      name: gif.getName(),
      mimeType: gif.getMimeType(),
      sizeMB:
        Math.round(
          (
            gif.getSize() /
            1024 /
            1024
          ) * 10
        ) / 10
    },

    logo: {
      name: logo.getName(),
      mimeType: logo.getMimeType(),
      sizeKB:
        Math.round(
          logo.getSize() / 1024
        )
    }
  };

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}

/**
 * Prueba del agente.
 */
function testCapiAgent() {
  const result = askCapi(
    '¿Qué es CAPIMEL?'
  );

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}
