"""Resolucion de secretos.

Orden de busqueda, de mas a menos seguro:

1. Variable de entorno del proceso.
2. Gestor de secretos de Google Colab (`google.colab.userdata`).
3. Archivo `.env` del directorio de trabajo (solo para desarrollo local).
4. Peticion interactiva, sin eco, si hay TTY.

Nunca se escribe un secreto en disco ni se registra en el log. La funcion
`get_secret` devuelve el valor; el resto del paquete solo maneja el *nombre*
de la variable, de modo que un volcado de configuracion jamas expone la clave.
"""

from __future__ import annotations

import getpass
import os
import sys
from pathlib import Path

_ENV_FILE_CACHE: dict[str, str] | None = None


def _load_env_file(path: Path = Path(".env")) -> dict[str, str]:
    global _ENV_FILE_CACHE
    if _ENV_FILE_CACHE is not None:
        return _ENV_FILE_CACHE
    values: dict[str, str] = {}
    if path.is_file():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            values[key.strip()] = value.strip().strip('"').strip("'")
    _ENV_FILE_CACHE = values
    return values


def _from_colab(name: str) -> str | None:
    try:
        from google.colab import userdata  # type: ignore
    except Exception:
        return None
    try:
        return userdata.get(name) or None
    except Exception:
        return None


def get_secret(name: str, *, required: bool = True, prompt: str | None = None) -> str | None:
    """Devuelve el valor del secreto `name`, o None si no existe y no es obligatorio."""
    value = os.environ.get(name) or _from_colab(name) or _load_env_file().get(name)

    if not value and sys.stdin is not None and sys.stdin.isatty():
        value = getpass.getpass(prompt or f"Valor para {name} (no se mostrara): ").strip() or None

    if value:
        # Se expone al resto del proceso, pero nunca se persiste.
        os.environ[name] = value
        return value

    if required:
        raise RuntimeError(
            f"Falta el secreto '{name}'. Definalo como variable de entorno, "
            f"en el gestor de secretos de Colab, o en un archivo .env local. "
            f"No lo escriba en el codigo ni en config/center.yaml."
        )
    return None


def mask(value: str | None, keep: int = 4) -> str:
    """Representacion segura de un identificador para logs y mensajes."""
    if not value:
        return "<vacio>"
    if len(value) <= keep:
        return "*" * len(value)
    return f"{value[:keep]}{'*' * (len(value) - keep)}"
