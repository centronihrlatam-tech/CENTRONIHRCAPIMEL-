/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  CAPIMEL — ARCHIVO DE CONFIGURACIÓN                                  ║
 * ║                                                                      ║
 * ║  👉 ESTE ES EL ÚNICO ARCHIVO QUE NECESITAS EDITAR para adaptar       ║
 * ║     la plataforma a tu centro de investigación.                      ║
 * ║                                                                      ║
 * ║  Cada bloque marcado con [EDITAR] espera tus datos.                  ║
 * ║  Los valores actuales son los del Centro NIHR LatAm Bolivia y        ║
 * ║  sirven como ejemplo funcional de referencia.                        ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

const CAPIMEL_CONFIG = Object.freeze({

  /* ──────────────────────────────────────────────────────────────────
     1. IDENTIDAD DEL CENTRO                                  [EDITAR]
     ────────────────────────────────────────────────────────────────── */

  // Nombre corto que aparece en la pestaña del navegador y la portada.
  appName: 'CAPIMEL Bolivia',

  // País o región. Se muestra junto al nombre.
  country: 'Bolivia',

  // Nombre completo desarrollado de la plataforma.
  subtitle:
    'Centro de Análisis del Progreso Institucional para el Monitoreo, la Evaluación y el Aprendizaje',

  // Párrafo introductorio de la portada. 1–2 frases.
  description:
    'Un espacio inteligente para transformar datos, evidencia y aprendizaje en decisiones que fortalecen el trabajo del Centro NIHR LatAm en Bolivia.',


  /* ──────────────────────────────────────────────────────────────────
     2. RECURSOS GRÁFICOS EN GOOGLE DRIVE                     [EDITAR]
     ──────────────────────────────────────────────────────────────────

     Cómo obtener un ID de Drive:
       1. Sube la imagen a Google Drive.
       2. Clic derecho → Compartir → «Cualquier persona con el enlace»
          (permiso de sólo lectura).
       3. Copia el enlace. El ID es el tramo entre /d/ y /view:
          https://drive.google.com/file/d/ESTE_ES_EL_ID/view

     Requisito: el archivo debe pertenecer a la MISMA cuenta que ejecuta
     el script, o estar compartido con ella.
     ────────────────────────────────────────────────────────────────── */

  // Avatar animado del asistente. GIF, idealmente < 2 MB, fondo transparente.
  capiGifId: '1ZqicVVTYs3MGaYsyM-cLYdCAwMcrii6a',

  // Logotipo institucional. PNG con fondo transparente, ~512 px de ancho.
  logoId: '1bTN-ax6IQEEnvykQCXOCoED6NqzzHsON',


  /* ──────────────────────────────────────────────────────────────────
     3. TABLERO PRINCIPAL                                     [OPCIONAL]
     ──────────────────────────────────────────────────────────────────
     URL de un dashboard externo (Looker Studio, Power BI, etc.).
     Déjalo como cadena vacía si no lo usas: el botón no se mostrará.
     ────────────────────────────────────────────────────────────────── */

  dashboardUrl: '',


  /* ──────────────────────────────────────────────────────────────────
     4. MÓDULOS DE LA PLATAFORMA                              [EDITAR]
     ──────────────────────────────────────────────────────────────────

     Cada módulo es una tarjeta en la portada que enlaza a otra
     aplicación web (normalmente otro proyecto de Apps Script).

     Puedes tener MÁS o MENOS de cuatro módulos: la portada se adapta
     sola. Sin embargo, el agente CAPI reconoce los módulos por su
     posición usando la lista de alias de `findModuleAnswer_()` en
     `Codigo.gs` — si cambias el número o el orden de los módulos,
     actualiza también esa lista.

     Campos de cada módulo:
       name        Título de la tarjeta.
       detail      Etiqueta breve bajo el título (2–3 palabras).
       description Frase que explica el módulo. También la usa CAPI
                   al responder preguntas sobre él.
       url         Destino del enlace. Usa '' para desactivar la tarjeta.
       color       Color de acento en hexadecimal.

     ⚠️  SEGURIDAD: estas URL quedan visibles para cualquiera que abra
         la portada. NO son un secreto. Protege cada módulo con la
         configuración de despliegue de su propio proyecto de Apps
         Script («Quién tiene acceso»), nunca confiando en que la URL
         permanezca oculta.
     ────────────────────────────────────────────────────────────────── */

  modules: [
    {
      name: 'CAPI MasterLab',
      detail: 'Monitoreo estratégico',
      description:
        'Espacio de masterclasses, formación y fortalecimiento de capacidades del equipo.',
      url:
        'https://script.google.com/a/macros/unifranz.edu.bo/s/AKfycbyy55HnkY5L0c3IC0C8RYw0RIKx4c2T-T6I8xbC35uGqTltsa9_L99jSPMnDl1BwVHE/exec',
      color: '#08b8ca'
    },
    {
      name: 'Radar de Investigación',
      detail: 'Avances y resultados',
      description:
        'Permite visualizar iniciativas, avances, productos y resultados relacionados con investigación.',
      url:
        'https://script.google.com/macros/s/AKfycby1g1ipo6zbS3B8bb2tnlbsxYFOdVn43xpXV_OCla_fXrk85mSBot2gw4zIrn8OwPc-XQ/exec',
      color: '#1774d1'
    },
    {
      name: 'Pulso del Talento',
      detail: 'Conocimiento aplicado',
      description:
        'Apoya el seguimiento del talento, el desempeño y el aprendizaje institucional del equipo.',
      url:
        'https://script.google.com/a/macros/unifranz.edu.bo/s/AKfycbw_X_3Pdrq8cgcn31HAP9nto3_SLta45Kq3qjxdJ0fFwfcHzmb47b6t90TVx_c8BsnXlw/exec',
      color: '#7559d9'
    },
    {
      name: 'Centro de Control Financiero',
      detail: 'Información consolidada',
      description:
        'Organiza la consulta y el seguimiento de la información presupuestaria y financiera autorizada.',
      url:
        'https://script.google.com/a/macros/unifranz.edu.bo/s/AKfycbxlfkasQgdPzsWEbInfxUUM_ethxXQxN1yuOwSq7EbLzZ3-EMpkXS2crB6h17FaT6bcdA/exec',
      color: '#17a979'
    }
  ]

});
