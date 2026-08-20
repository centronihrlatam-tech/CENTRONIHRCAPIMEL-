"""Registro estructurado de la ejecucion.

El log es JSON Lines y por defecto no contiene datos personales: las personas
aparecen por su `alias` del roster y los identificadores de Drive se registran
como hash truncado, suficiente para correlacionar dos ejecuciones sin revelar
el recurso. Es el rastro que permite auditar que hizo el proceso, sin
convertirse el mismo en una fuente de fuga.
"""

from __future__ import annotations

import hashlib
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_LOGGER_NAME = "mel_reports"


def resource_ref(value: str | None) -> str:
    """Referencia estable y no reversible a un identificador de Drive."""
    if not value:
        return "none"
    return "res_" + hashlib.sha256(value.encode("utf-8")).hexdigest()[:12]


class AuditLog:
    def __init__(self, path: str | Path, *, log_pii: bool = False, echo: bool = True) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.log_pii = log_pii
        self.echo = echo
        self._counts: dict[str, int] = {}

    def event(self, event: str, **fields: Any) -> None:
        self._counts[event] = self._counts.get(event, 0) + 1
        record: dict[str, Any] = {
            "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "event": event,
        }
        for key, value in fields.items():
            if not self.log_pii and key in {"nombre", "name", "descripcion", "texto", "content"}:
                continue
            record[key] = value
        line = json.dumps(record, ensure_ascii=False)
        with self.path.open("a", encoding="utf-8") as handle:
            handle.write(line + "\n")
        if self.echo:
            logging.getLogger(_LOGGER_NAME).info("%s %s", event,
                                                 " ".join(f"{k}={v}" for k, v in fields.items()
                                                          if k not in {"nombre", "descripcion"}))

    def summary(self) -> dict[str, int]:
        return dict(self._counts)


def setup_logging(verbose: bool = False) -> logging.Logger:
    logger = logging.getLogger(_LOGGER_NAME)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stderr)
        handler.setFormatter(logging.Formatter("%(asctime)s  %(levelname)-7s %(message)s", "%H:%M:%S"))
        logger.addHandler(handler)
    logger.setLevel(logging.DEBUG if verbose else logging.INFO)
    return logger
