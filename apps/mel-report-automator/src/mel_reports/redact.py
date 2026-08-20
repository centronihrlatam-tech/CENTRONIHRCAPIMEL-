"""Redaccion y saneamiento de texto antes de enviarlo a un tercero.

Dos responsabilidades distintas, deliberadamente separadas:

- `redact`   : elimina identificadores directos (URLs, correos, telefonos,
               IDs de Drive, nombres del roster). Reduce lo que sale del
               centro al minimo necesario para redactar un resumen.
- `neutralize`: neutraliza intentos de inyeccion de prompt. El contenido de
               la hoja lo escriben personas y no es de confianza: podria
               contener "ignora las instrucciones anteriores y ...". Se
               eliminan caracteres de control, se recorta la longitud y el
               texto se entrega al modelo dentro de un bloque delimitado que
               el prompt declara explicitamente como datos, no instrucciones.
"""

from __future__ import annotations

import re
import unicodedata

URL_RE = re.compile(r"https?://\S+|www\.\S+", re.IGNORECASE)
EMAIL_RE = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b")
# Telefonos internacionales o locales de 7 a 15 digitos, con separadores.
PHONE_RE = re.compile(r"(?<!\w)(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,4}\d{2,4}(?!\w)")
# Identificadores opacos largos: IDs de Drive, UUIDs, tokens.
OPAQUE_ID_RE = re.compile(r"\b(?=[A-Za-z0-9_-]{20,})(?=[^\s]*\d)[A-Za-z0-9_-]{20,}\b")
CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
# Caracteres invisibles usados para ocultar instrucciones en texto pegado.
INVISIBLE_RE = re.compile(r"[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]")

# Frases tipicas de inyeccion. No se confia en esta lista como unica defensa;
# es una senal que se registra, ademas del encuadre estructural del prompt.
INJECTION_PATTERNS = [
    re.compile(p, re.IGNORECASE)
    for p in (
        r"ignor(a|e|en|ar)\s+(las\s+)?(instrucciones|reglas|lo\s+anterior)",
        r"ignore\s+(all\s+)?(previous|above)\s+instructions",
        r"olvida\s+(todo|las\s+instrucciones)",
        r"disregard\s+(the\s+)?(above|previous)",
        r"system\s*prompt",
        r"act(ua|ue|ing)\s+as\s+(a\s+)?(system|developer|admin)",
        r"</?(system|assistant|user)>",
        r"\{\{\s*\w+\s*\}\}",  # marcadores de plantilla insertados por el usuario
    )
]


def _strip_accents(text: str) -> str:
    return unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")


def name_variants(full_name: str) -> list[str]:
    """Fragmentos de un nombre que conviene buscar en texto libre."""
    parts = [p for p in re.split(r"\s+", full_name.strip()) if len(p) > 2]
    variants = {full_name.strip()}
    variants.update(parts)
    if len(parts) >= 2:
        variants.add(f"{parts[0]} {parts[-1]}")
    return sorted((v for v in variants if v), key=len, reverse=True)


def redact(
    text: str,
    *,
    urls: bool = True,
    emails: bool = True,
    phones: bool = True,
    ids: bool = True,
    names: list[str] | None = None,
) -> str:
    """Sustituye identificadores por etiquetas genericas."""
    if not text:
        return ""
    out = str(text)
    if urls:
        out = URL_RE.sub("[ENLACE]", out)
    if emails:
        out = EMAIL_RE.sub("[CORREO]", out)
    if ids:
        out = OPAQUE_ID_RE.sub("[ID]", out)
    if phones:
        out = PHONE_RE.sub("[TELEFONO]", out)
    for name in names or []:
        for variant in name_variants(name):
            out = re.sub(rf"\b{re.escape(variant)}\b", "[PERSONA]", out, flags=re.IGNORECASE)
            ascii_variant = _strip_accents(variant)
            if ascii_variant != variant:
                out = re.sub(rf"\b{re.escape(ascii_variant)}\b", "[PERSONA]", out, flags=re.IGNORECASE)
    return re.sub(r"[ \t]{2,}", " ", out).strip()


def neutralize(text: str, *, max_chars: int = 2000) -> tuple[str, list[str]]:
    """Limpia el texto para uso como *dato* dentro de un prompt.

    Devuelve el texto saneado y la lista de patrones de inyeccion detectados.
    """
    if not text:
        return "", []
    out = INVISIBLE_RE.sub("", CONTROL_RE.sub(" ", str(text)))
    out = unicodedata.normalize("NFKC", out)

    flags = [p.pattern for p in INJECTION_PATTERNS if p.search(out)]

    # Se rompen las secuencias que podrian cerrar el bloque de datos.
    out = out.replace("```", "'''").replace("<<<", "<").replace(">>>", ">")
    out = re.sub(r"\n{3,}", "\n\n", out).strip()
    if len(out) > max_chars:
        out = out[:max_chars].rsplit(" ", 1)[0] + " [...]"
    return out, flags


def residual_leaks(text: str) -> list[str]:
    """Comprueba que un texto ya redactado no conserve identificadores.

    Se usa como control de cierre (`privacy.fail_closed_on_leak`): si algo
    escapo a la redaccion, la ejecucion se detiene en lugar de enviarlo.
    """
    leaks = []
    if URL_RE.search(text):
        leaks.append("url")
    if EMAIL_RE.search(text):
        leaks.append("email")
    if OPAQUE_ID_RE.search(text):
        leaks.append("id")
    return leaks
