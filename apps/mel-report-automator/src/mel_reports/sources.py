"""Lectura del roster y de las hojas de planificacion.

El roster es la unica estructura que asocia una persona con sus recursos de
Drive. Vive fuera del repositorio (CSV git-ignored o una hoja de calculo) y se
carga en memoria; ninguna de sus filas se escribe en el log en claro.
"""

from __future__ import annotations

import csv
import re
import unicodedata
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pandas as pd

from .config import Config, ConfigError, validate_drive_id
from .secrets import get_secret


@dataclass(frozen=True)
class Person:
    alias: str
    nombre: str
    sheet_id: str
    folder_id: str | None
    active: bool = True


def normalize_column(name: Any) -> str:
    """'Respaldo - Link' -> 'respaldo_link'. Estable ante acentos y espacios."""
    text = str(name).strip().lower()
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("utf-8")
    text = re.sub(r"\s+", "_", text)
    text = re.sub(r"[^a-z0-9_]", "", text)
    return re.sub(r"_+", "_", text).strip("_")


def _truthy(value: Any) -> bool:
    return str(value).strip().lower() in {"1", "true", "si", "sí", "yes", "y", "x"}


def load_roster(cfg: Config, clients: Any | None = None) -> list[Person]:
    source = str(cfg.get("roster.source", "csv")).lower()
    if source == "csv":
        rows = _roster_from_csv(Path(str(cfg.get("roster.csv_path", "config/roster.csv"))))
    elif source == "sheet":
        rows = _roster_from_sheet(cfg, clients)
    else:
        raise ConfigError("roster.source debe ser 'csv' o 'sheet'")

    people: list[Person] = []
    seen: set[str] = set()
    for i, row in enumerate(rows, start=2):
        alias = str(row.get("alias", "")).strip()
        nombre = str(row.get("nombre", "")).strip()
        if not alias or not nombre:
            raise ConfigError(f"Roster fila {i}: 'alias' y 'nombre' son obligatorios")
        if alias in seen:
            raise ConfigError(f"Roster fila {i}: alias duplicado '{alias}'")
        seen.add(alias)

        folder_raw = str(row.get("folder_id", "")).strip()
        people.append(
            Person(
                alias=alias,
                nombre=nombre,
                sheet_id=validate_drive_id(
                    str(row.get("sheet_id", "")), field_name=f"roster fila {i} sheet_id"
                ),
                folder_id=(
                    validate_drive_id(folder_raw, field_name=f"roster fila {i} folder_id")
                    if folder_raw
                    else None
                ),
                active=_truthy(row.get("active", "true")),
            )
        )
    if not people:
        raise ConfigError("El roster esta vacio")
    return people


def _roster_from_csv(path: Path) -> list[dict[str, Any]]:
    if not path.is_file():
        raise ConfigError(
            f"No existe {path}. Copie config/roster.example.csv a {path} y complete los datos. "
            f"Ese archivo no se versiona."
        )
    with path.open(encoding="utf-8-sig", newline="") as handle:
        # Se descartan las lineas de comentario del ejemplo.
        lines = [line for line in handle if not line.lstrip().startswith("#")]
    return [dict(row) for row in csv.DictReader(lines)]


def _roster_from_sheet(cfg: Config, clients: Any) -> list[dict[str, Any]]:
    if clients is None:
        raise ConfigError("roster.source = 'sheet' requiere clientes de Google autenticados")
    env_name = str(cfg.get("roster.sheet_id_env", "ROSTER_SHEET_ID"))
    sheet_id = validate_drive_id(get_secret(env_name) or "", field_name=env_name)
    worksheet = clients.gspread.open_by_key(sheet_id).get_worksheet(int(cfg.get("roster.worksheet_index", 0)))
    return worksheet.get_all_records()


# ---------------------------------------------------------------------------
# Hoja de planificacion individual
# ---------------------------------------------------------------------------

def resolve_columns(df: pd.DataFrame, mapping: dict[str, Iterable[str]]) -> dict[str, str]:
    """Empareja las columnas reales de la hoja con los nombres canonicos."""
    present = {normalize_column(c): c for c in df.columns}
    resolved: dict[str, str] = {}
    for canonical, aliases in mapping.items():
        for alias in list(aliases) + [canonical]:
            key = normalize_column(alias)
            if key in present:
                resolved[canonical] = present[key]
                break
    return resolved


def read_planner(clients: Any, person: Person, cfg: Config) -> pd.DataFrame:
    """Devuelve la hoja de la persona con columnas canonicas y fecha tipada."""
    worksheet = clients.gspread.open_by_key(person.sheet_id).get_worksheet(0)
    records = worksheet.get_all_records()
    if not records:
        return pd.DataFrame()

    df = pd.DataFrame(records)
    mapping = cfg.get("schema.columns", {}) or {}
    resolved = resolve_columns(df, mapping)

    missing = [c for c in (cfg.get("schema.required", []) or []) if c not in resolved]
    if missing:
        raise ValueError(
            f"La hoja no contiene las columnas requeridas {missing}. "
            f"Ajuste schema.columns en la configuracion para reflejar los nombres reales."
        )

    df = df.rename(columns={original: canonical for canonical, original in resolved.items()})
    df = df[[c for c in resolved if c in df.columns]].copy()

    df["fecha"] = pd.to_datetime(
        df["fecha"], dayfirst=bool(cfg.get("schema.date_dayfirst", True)), errors="coerce"
    ).dt.normalize()

    return df.sort_values("fecha", kind="stable")
