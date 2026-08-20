"""Ventana temporal, filtrado y agregados del periodo."""

from __future__ import annotations

import calendar
import re
from dataclasses import dataclass
from datetime import date

import pandas as pd

from .config import Config

MESES = {
    1: "enero", 2: "febrero", 3: "marzo", 4: "abril", 5: "mayo", 6: "junio",
    7: "julio", 8: "agosto", 9: "septiembre", 10: "octubre", 11: "noviembre", 12: "diciembre",
}
MESES_ABREV = {n: nombre[:3] for n, nombre in MESES.items()}

BASURA = {"", "-", "--", "---", "na", "n/a", "nan", "none", "null", ".", "s/d"}


@dataclass(frozen=True)
class Period:
    inicio: pd.Timestamp
    fin: pd.Timestamp
    mes_nombre: str
    mes_abrev: str
    mes_anterior: str
    anio: int
    fecha_texto: str

    @property
    def anio_corto(self) -> str:
        return f"{self.anio % 100:02d}"


def _safe_date(year: int, month: int, day: int) -> pd.Timestamp:
    """Evita ValueError cuando cutoff_day = 31 en un mes corto."""
    return pd.Timestamp(year=year, month=month, day=min(day, calendar.monthrange(year, month)[1]))


def build_period(today: date, cfg: Config) -> Period:
    cutoff = int(cfg.get("period.cutoff_day", 25))
    fin = _safe_date(today.year, today.month, cutoff)
    if today.month == 1:
        inicio = _safe_date(today.year - 1, 12, cutoff)
    else:
        inicio = _safe_date(today.year, today.month - 1, cutoff)

    if bool(cfg.get("period.label_previous_month", True)):
        etiqueta_mes = 12 if today.month == 1 else today.month - 1
        etiqueta_anio = today.year - 1 if today.month == 1 else today.year
    else:
        etiqueta_mes, etiqueta_anio = today.month, today.year

    anterior = 12 if etiqueta_mes == 1 else etiqueta_mes - 1

    return Period(
        inicio=inicio,
        fin=fin,
        mes_nombre=MESES[etiqueta_mes],
        mes_abrev=MESES_ABREV[etiqueta_mes],
        mes_anterior=MESES[anterior],
        anio=etiqueta_anio,
        fecha_texto=f"{today.day} de {MESES[today.month]} de {today.year}",
    )


def texto_valido(value) -> bool:
    """True si el valor aporta contenido real y no un relleno."""
    if pd.isna(value):
        return False
    text = str(value).strip()
    if len(text) < 2 or text.lower() in BASURA:
        return False
    return bool(re.search(r"[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]", text))


def slice_period(df: pd.DataFrame, period: Period) -> pd.DataFrame:
    if df.empty or "fecha" not in df.columns:
        return df.iloc[0:0].copy()
    mask = (df["fecha"] >= period.inicio) & (df["fecha"] <= period.fin)
    return df.loc[mask].sort_values("fecha", kind="stable").copy()


def apply_exclusions(df: pd.DataFrame, cfg: Config) -> pd.DataFrame:
    patterns = cfg.get("taxonomy.exclude_description_patterns", []) or []
    if df.empty or "descripcion" not in df.columns or not patterns:
        return df
    combined = "|".join(f"(?:{p})" for p in patterns)
    keep = ~df["descripcion"].astype(str).str.contains(combined, case=False, na=False, regex=True)
    return df.loc[keep].copy()


def counts_by(df: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    """Conteo agrupado, util para tableros e indicadores MEL."""
    available = [c for c in columns if c in df.columns]
    if df.empty or not available:
        return pd.DataFrame(columns=[*columns, "cantidad"])
    return (
        df.groupby(available, dropna=False)
        .size()
        .reset_index(name="cantidad")
        .sort_values([*available[:1], "cantidad"], ascending=[True, False], kind="stable")
    )


def top_activities(df: pd.DataFrame, column: str = "descripcion", n: int = 7) -> list[tuple[str, int]]:
    if df.empty or column not in df.columns:
        return []
    valid = df[column][df[column].apply(texto_valido)]
    return [(str(k), int(v)) for k, v in valid.value_counts().head(n).items()]


def deterministic_summary(items: list[tuple[str, int]], period: Period) -> str:
    """Resumen sin LLM. Es la salida por defecto cuando llm.enabled = false."""
    if not items:
        return f"No se registraron actividades entre el {period.inicio:%d/%m/%Y} y el {period.fin:%d/%m/%Y}."
    lineas = [
        f"- {texto}" + (f" (x{veces})" if veces > 1 else "")
        for texto, veces in items
    ]
    return "\n".join(lineas)


def deterministic_conclusions(df: pd.DataFrame, period: Period, cfg: Config) -> str:
    """Parrafo factual construido con conteos, sin generacion de lenguaje."""
    total = len(df)
    if total == 0:
        return f"No se registraron actividades en el periodo {period.inicio:%d/%m/%Y}-{period.fin:%d/%m/%Y}."
    partes = [
        f"Entre el {period.inicio:%d/%m/%Y} y el {period.fin:%d/%m/%Y} se registraron {total} actividades"
    ]
    if "tipo" in df.columns:
        por_tipo = df["tipo"].astype(str).str.strip().replace("", "sin clasificar").value_counts()
        detalle = ", ".join(f"{n} de tipo {t}" for t, n in por_tipo.items())
        partes.append(f", distribuidas en {detalle}")
    if "componente" in df.columns:
        por_comp = df["componente"].astype(str).str.strip().replace("", "sin componente").value_counts()
        detalle = ", ".join(f"{c} ({n})" for c, n in por_comp.items())
        partes.append(f". Por componente: {detalle}")
    return "".join(partes) + "."
