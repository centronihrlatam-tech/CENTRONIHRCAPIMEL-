#!/usr/bin/env python3
"""Punto de entrada por linea de comandos.

Ejemplos:

    # Ensayo sin escribir nada en Drive (comportamiento por defecto)
    python scripts/run_reports.py --config config/center.yaml

    # Ejecucion real, solo dos personas
    python scripts/run_reports.py --config config/center.yaml --apply --only P001,P004

    # Reproducir el informe de un mes anterior
    python scripts/run_reports.py --config config/center.yaml --apply --date 2026-04-01
"""

from __future__ import annotations

import argparse
import sys
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from mel_reports.config import ConfigError, load_config  # noqa: E402
from mel_reports.pipeline import run  # noqa: E402


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Genera los informes periodicos del centro.")
    parser.add_argument("--config", default="config/center.yaml",
                        help="Ruta al archivo de configuracion del centro.")
    parser.add_argument("--apply", action="store_true",
                        help="Escribe en Drive. Sin este indicador la ejecucion es un ensayo.")
    parser.add_argument("--only", default="",
                        help="Lista de alias separados por coma; limita el lote.")
    parser.add_argument("--date", default="",
                        help="Fecha de referencia AAAA-MM-DD (por defecto, hoy).")
    parser.add_argument("--overwrite", action="store_true",
                        help="Regenera el informe aunque ya exista uno con el mismo nombre.")
    parser.add_argument("-v", "--verbose", action="store_true")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

    try:
        cfg = load_config(args.config)
    except ConfigError as exc:
        print(f"[configuracion] {exc}", file=sys.stderr)
        return 2

    if args.apply:
        # `dry_run` vive en la configuracion; --apply lo invierte de forma
        # explicita y deliberada, para que el modo seguro sea el que se hereda.
        cfg.raw.setdefault("run", {})["dry_run"] = False
    if not cfg.dry_run:
        print(f"MODO REAL: se crearan documentos en Drive para el centro '{cfg.center_code}'.",
              file=sys.stderr)

    reference = date.today()
    if args.date:
        try:
            reference = datetime.strptime(args.date, "%Y-%m-%d").date()
        except ValueError:
            print("--date debe tener el formato AAAA-MM-DD", file=sys.stderr)
            return 2

    result = run(
        cfg,
        today=reference,
        only=[a for a in args.only.split(",") if a.strip()] or None,
        overwrite=args.overwrite,
        verbose=args.verbose,
    )

    for item in result.results:
        line = f"  {item.alias:<10} {item.status:<18} actividades={item.activities}"
        if item.detail:
            line += f"  ({item.detail})"
        print(line)

    return 1 if result.failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
