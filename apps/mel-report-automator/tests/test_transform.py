from datetime import date

import pandas as pd

from mel_reports.config import Config
from mel_reports.transform import (
    apply_exclusions,
    build_period,
    counts_by,
    deterministic_conclusions,
    slice_period,
    texto_valido,
    top_activities,
)


def cfg(**overrides):
    base = {
        "period": {"cutoff_day": 25, "label_previous_month": True},
        "taxonomy": {"exclude_description_patterns": ["SCRUM"]},
    }
    base.update(overrides)
    return Config(raw=base, path=__file__)


def test_periodo_va_de_corte_a_corte():
    period = build_period(date(2026, 4, 21), cfg())
    assert (period.inicio.month, period.inicio.day) == (3, 25)
    assert (period.fin.month, period.fin.day) == (4, 25)
    assert period.mes_nombre == "marzo"


def test_periodo_cruza_el_cambio_de_anio():
    period = build_period(date(2026, 1, 10), cfg())
    assert period.inicio.year == 2025 and period.inicio.month == 12
    assert period.mes_nombre == "diciembre" and period.anio == 2025


def test_dia_de_corte_31_no_rompe_en_febrero():
    period = build_period(date(2026, 3, 5), cfg(period={"cutoff_day": 31, "label_previous_month": True}))
    assert period.inicio.day == 28  # febrero 2026


def test_texto_valido_descarta_relleno():
    for basura in ("", "-", "n/a", "NaN", "  ", "12"):
        assert not texto_valido(basura)
    assert texto_valido("Reunion de coordinacion")


def test_exclusiones_se_aplican_sin_distinguir_mayusculas():
    df = pd.DataFrame({"descripcion": ["Daily scrum", "Reunion RCT"]})
    assert len(apply_exclusions(df, cfg())) == 1


def test_slice_period_filtra_por_ventana():
    df = pd.DataFrame({"fecha": pd.to_datetime(["2026-03-01", "2026-04-01", "2026-05-01"])})
    assert len(slice_period(df, build_period(date(2026, 4, 21), cfg()))) == 1


def test_conclusiones_deterministas_no_inventan():
    df = pd.DataFrame({"tipo": ["Tarea", "Tarea"], "componente": ["INV", "MEL"]})
    texto = deterministic_conclusions(df, build_period(date(2026, 4, 21), cfg()), cfg())
    assert "2 actividades" in texto and "INV" in texto


def test_counts_by_tolera_columnas_ausentes():
    assert counts_by(pd.DataFrame(), ["tipo"]).empty


def test_top_activities_ordena_por_frecuencia():
    df = pd.DataFrame({"descripcion": ["Revision de informes", "Revision de informes", "Otra tarea"]})
    assert top_activities(df)[0] == ("Revision de informes", 2)
