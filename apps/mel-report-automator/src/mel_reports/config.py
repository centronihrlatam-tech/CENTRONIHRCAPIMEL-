"""Carga y validacion de la configuracion del centro.

La configuracion se valida al arrancar (fail fast). Se rechaza cualquier
combinacion insegura -- por ejemplo, compartir evidencias con `anyone` sin
haberlo autorizado explicitamente -- antes de tocar la red.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

# Un ID de Drive/Sheets: solo caracteres validos, longitud plausible.
DRIVE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{20,80}$")


class ConfigError(ValueError):
    """La configuracion es invalida o insegura."""


@dataclass(frozen=True)
class Config:
    raw: dict[str, Any]
    path: Path

    # ---- accesores tipados -------------------------------------------------
    def section(self, name: str) -> dict[str, Any]:
        value = self.raw.get(name)
        if not isinstance(value, dict):
            raise ConfigError(f"Falta la seccion '{name}' en {self.path}")
        return value

    def get(self, dotted: str, default: Any = None) -> Any:
        node: Any = self.raw
        for part in dotted.split("."):
            if not isinstance(node, dict) or part not in node:
                return default
            node = node[part]
        return node

    @property
    def center_name(self) -> str:
        return str(self.get("center.name", "")).strip()

    @property
    def center_code(self) -> str:
        return str(self.get("center.code", "")).strip()

    @property
    def dry_run(self) -> bool:
        return bool(self.get("run.dry_run", True))


_PLACEHOLDER_RE = re.compile(r"^<.*>$")


def _has_placeholders(node: Any, trail: str = "") -> list[str]:
    found: list[str] = []
    if isinstance(node, dict):
        for key, value in node.items():
            found += _has_placeholders(value, f"{trail}.{key}" if trail else str(key))
    elif isinstance(node, list):
        for i, value in enumerate(node):
            found += _has_placeholders(value, f"{trail}[{i}]")
    elif isinstance(node, str) and _PLACEHOLDER_RE.match(node.strip()):
        found.append(trail)
    return found


def _validate(cfg: Config) -> None:
    problems: list[str] = []

    for required in ("center", "period", "roster", "schema", "template", "evidence", "llm", "privacy", "run"):
        if not isinstance(cfg.raw.get(required), dict):
            problems.append(f"falta la seccion '{required}'")
    if problems:
        raise ConfigError("Configuracion incompleta: " + "; ".join(problems))

    placeholders = _has_placeholders(cfg.raw)
    if placeholders:
        problems.append(
            "quedan valores de ejemplo sin reemplazar en: " + ", ".join(placeholders)
        )

    # --- seguridad: nunca aceptar un ID o una clave escritos en el YAML ------
    for dotted in ("template.document_id", "llm.api_key", "roster.sheet_id"):
        if cfg.get(dotted) is not None:
            problems.append(
                f"'{dotted}' no debe existir en el archivo de configuracion; "
                f"use el campo '{dotted}_env' y una variable de entorno"
            )

    for dotted in ("template.document_id_env", "llm.api_key_env"):
        name = cfg.get(dotted)
        if not isinstance(name, str) or not name:
            problems.append(f"'{dotted}' debe indicar el nombre de una variable de entorno")

    # --- seguridad: compartir evidencias -------------------------------------
    mode = str(cfg.get("evidence.mode", "link")).lower()
    if mode not in {"link", "embed"}:
        problems.append("evidence.mode debe ser 'link' o 'embed'")

    share = str(cfg.get("evidence.share_mode", "none")).lower()
    if share not in {"none", "domain", "anyone"}:
        problems.append("evidence.share_mode debe ser 'none', 'domain' o 'anyone'")
    if share == "domain" and not str(cfg.get("evidence.workspace_domain", "")).strip():
        problems.append("evidence.share_mode = 'domain' requiere evidence.workspace_domain")
    if share == "anyone" and not bool(cfg.get("evidence.allow_public_links", False)):
        problems.append(
            "evidence.share_mode = 'anyone' publica archivos en internet; requiere "
            "ademas evidence.allow_public_links: true como confirmacion explicita"
        )
    if mode == "link" and share != "none":
        problems.append("evidence.mode = 'link' no debe modificar permisos: use share_mode 'none'")

    # --- privacidad ----------------------------------------------------------
    if bool(cfg.get("llm.enabled", False)) and not bool(cfg.get("privacy.redact.urls", True)):
        problems.append(
            "con llm.enabled: true no se admite privacy.redact.urls: false "
            "(los enlaces de respaldo identifican archivos internos)"
        )

    # --- taxonomia -----------------------------------------------------------
    components = cfg.get("taxonomy.components", {}) or {}
    if not isinstance(components, dict) or not components:
        problems.append("taxonomy.components debe mapear al menos un codigo a un marcador")

    for pattern in cfg.get("taxonomy.exclude_description_patterns", []) or []:
        try:
            re.compile(str(pattern))
        except re.error as exc:
            problems.append(f"patron invalido en taxonomy.exclude_description_patterns: {pattern} ({exc})")

    if problems:
        raise ConfigError(
            "Configuracion invalida en " + str(cfg.path) + ":\n  - " + "\n  - ".join(problems)
        )


def load_config(path: str | Path = "config/center.yaml") -> Config:
    path = Path(path)
    if not path.is_file():
        raise ConfigError(
            f"No existe {path}. Copie config/center.example.yaml a {path} y complete los valores."
        )
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    if not isinstance(data, dict):
        raise ConfigError(f"{path} no contiene un mapa YAML valido")
    cfg = Config(raw=data, path=path)
    _validate(cfg)
    return cfg


def validate_drive_id(value: str, *, field_name: str) -> str:
    """Rechaza URLs completas y valores malformados; devuelve el ID limpio."""
    value = (value or "").strip()
    if not value:
        raise ConfigError(f"{field_name} vacio")
    # Tolera que alguien pegue la URL completa: extrae el ID.
    match = re.search(r"/d/([A-Za-z0-9_-]{20,80})", value)
    if match:
        value = match.group(1)
    if not DRIVE_ID_RE.match(value):
        raise ConfigError(
            f"{field_name} no parece un identificador de Drive valido. "
            f"Use solo el ID, no la URL completa."
        )
    return value
