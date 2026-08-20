#!/usr/bin/env python3
"""Limpia un notebook antes de versionarlo.

Hace tres cosas, en este orden:

1. **Elimina todas las salidas y el contador de ejecucion.** Es la fuga mas
   habitual: un `.ipynb` ejecutado guarda literalmente los datos que se
   imprimieron, incluidas filas completas de una hoja de calculo.
2. **Escanea el codigo restante** en busca de identificadores incrustados
   (IDs de Drive, claves de API, URLs con contrasena, correos) y los reporta.
3. Con `--redact`, sustituye lo encontrado por un marcador de posicion.

Uso:
    python scripts/sanitize_notebook.py entrada.ipynb --out salida.ipynb
    python scripts/sanitize_notebook.py entrada.ipynb --check     # solo informa
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

# Patrones de riesgo. La deteccion es deliberadamente amplia: es preferible un
# falso positivo que revisar a mano, a un identificador que se escapa.
PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("clave_openai", re.compile(r"\bsk-[A-Za-z0-9_\-]{20,}\b")),
    ("clave_google", re.compile(r"\bAIza[0-9A-Za-z_\-]{35}\b")),
    (
        "token_generico",
        re.compile(
            r"(?i)\b(api[_-]?key|secret|token|password|passwd|pwd)\b"
            r"\s*[:=]\s*['\"][^'\"]{8,}['\"]"
        ),
    ),
    ("url_con_password", re.compile(r"https?://\S*[?&]pwd=[^\s&'\"]+")),
    ("id_drive_en_url", re.compile(r"https?://(?:docs|drive)\.google\.com/\S+")),
    ("id_drive_suelto", re.compile(r"(?<![\w/-])[A-Za-z0-9_-]{28,60}(?![\w/-])")),
    ("correo", re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b")),
]

REPLACEMENT = {
    "clave_openai": "os.environ['OPENAI_API_KEY']",
    "clave_google": "<CLAVE_EN_VARIABLE_DE_ENTORNO>",
    "token_generico": "<SECRETO_EN_VARIABLE_DE_ENTORNO>",
    "url_con_password": "<ENLACE_CON_CREDENCIAL_ELIMINADO>",
    "id_drive_en_url": "<URL_EN_CONFIGURACION>",
    "id_drive_suelto": "<ID_EN_CONFIGURACION>",
    "correo": "<CORREO>",
}


def scan(text: str) -> list[tuple[str, str]]:
    hits: list[tuple[str, str]] = []
    for label, pattern in PATTERNS:
        for match in pattern.finditer(text):
            hits.append((label, match.group(0)))
    return hits


def redact_text(text: str) -> str:
    for label, pattern in PATTERNS:
        text = pattern.sub(REPLACEMENT[label], text)
    return text


def process(path: Path, *, redact: bool) -> tuple[dict, list[tuple[int, str, str]]]:
    notebook = json.loads(path.read_text(encoding="utf-8"))
    findings: list[tuple[int, str, str]] = []

    for i, cell in enumerate(notebook.get("cells", [])):
        # 1. Salidas fuera.
        if cell.get("cell_type") == "code":
            if cell.get("outputs"):
                findings.append((i, "salida_guardada", f"{len(cell['outputs'])} salida(s)"))
            cell["outputs"] = []
            cell["execution_count"] = None

        # 2. Escanear el codigo fuente.
        source = "".join(cell.get("source", []))
        for label, value in scan(source):
            preview = value if len(value) <= 24 else value[:12] + "..." + value[-6:]
            findings.append((i, label, preview))

        if redact and source:
            cleaned = redact_text(source)
            if cleaned != source:
                cell["source"] = cleaned.splitlines(keepends=True)

    # 3. Metadatos que arrastran contexto del entorno original.
    notebook.get("metadata", {}).pop("colab", None)
    notebook.get("metadata", {}).pop("widgets", None)
    return notebook, findings


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Elimina salidas y secretos de un notebook.")
    parser.add_argument("notebook", type=Path)
    parser.add_argument("--out", type=Path, help="Destino. Por defecto sobrescribe la entrada.")
    parser.add_argument("--check", action="store_true", help="Solo informa; no escribe nada.")
    parser.add_argument("--redact", action="store_true",
                        help="Sustituye los valores detectados por marcadores de posicion.")
    args = parser.parse_args(argv)

    if not args.notebook.is_file():
        print(f"No existe {args.notebook}", file=sys.stderr)
        return 2

    notebook, findings = process(args.notebook, redact=args.redact and not args.check)

    if findings:
        print(f"{len(findings)} hallazgo(s) en {args.notebook.name}:")
        for index, label, preview in findings:
            print(f"  celda {index:>3}  {label:<18} {preview}")
    else:
        print(f"Sin hallazgos en {args.notebook.name}.")

    if args.check:
        return 1 if findings else 0

    destination = args.out or args.notebook
    destination.write_text(json.dumps(notebook, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Escrito: {destination}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
