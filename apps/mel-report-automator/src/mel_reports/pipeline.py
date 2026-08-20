"""Orquestacion: de la hoja de planificacion al documento generado.

El flujo por persona es el mismo en todos los centros; lo que cambia entre
instituciones esta en la configuracion, no aqui. Un fallo en una persona no
detiene al resto, pero se contabiliza y se refleja en el codigo de salida.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any

import pandas as pd

from .audit import AuditLog, resource_ref, setup_logging
from .config import Config, validate_drive_id
from .docs_writer import DocumentWriter, permission_scope
from .llm import LLMClient, LLMDisabled
from .secrets import get_secret
from .sources import Person, load_roster, read_planner
from .transform import (
    apply_exclusions,
    build_period,
    deterministic_conclusions,
    deterministic_summary,
    slice_period,
    texto_valido,
    top_activities,
)


@dataclass
class PersonResult:
    alias: str
    status: str          # created | skipped_existing | no_data | error | dry_run
    document_id: str | None = None
    activities: int = 0
    detail: str = ""


@dataclass
class RunResult:
    results: list[PersonResult] = field(default_factory=list)

    @property
    def failed(self) -> int:
        return sum(1 for r in self.results if r.status == "error")

    def counts(self) -> dict[str, int]:
        out: dict[str, int] = {}
        for r in self.results:
            out[r.status] = out.get(r.status, 0) + 1
        return out


def _build_texts(df: pd.DataFrame) -> list[str]:
    """Une descripcion y comentario por fila, descartando relleno."""
    textos: list[str] = []
    for _, row in df.iterrows():
        partes = [
            str(row[col]).strip()
            for col in ("descripcion", "comentario")
            if col in row.index and texto_valido(row.get(col))
        ]
        if partes:
            textos.append(" | ".join(partes))
    return textos


def _narrative(
    df: pd.DataFrame, llm: LLMClient, cfg: Config, period, names: list[str], audit: AuditLog
) -> tuple[str, str, str]:
    """Devuelve (resumen, conclusiones, sugerencias).

    Con el modelo desactivado, o si la llamada falla, se usan los resumenes
    deterministas: el informe siempre se genera, nunca queda a medias.
    """
    items = top_activities(df, "descripcion", n=7)
    resumen = deterministic_summary(items, period)
    conclusiones = deterministic_conclusions(df, period, cfg)
    sugerencias = ""

    if not llm.enabled:
        return resumen, conclusiones, sugerencias

    textos = _build_texts(df)
    periodo_txt = f"{period.inicio:%d/%m/%Y} a {period.fin:%d/%m/%Y}"
    try:
        generado = llm.resumen(textos, names=names, periodo=periodo_txt)
        if generado:
            resumen = generado
        c, s = llm.conclusiones_y_sugerencias(textos, names=names, periodo=periodo_txt)
        conclusiones = c or conclusiones
        sugerencias = s
    except LLMDisabled:
        pass
    except Exception as exc:  # noqa: BLE001 - se degrada a la version determinista
        audit.event("narrative_fallback", error_type=type(exc).__name__)
    return resumen, conclusiones, sugerencias


def process_person(
    person: Person,
    *,
    clients: Any,
    cfg: Config,
    period,
    template_id: str,
    llm: LLMClient,
    audit: AuditLog,
    roster_names: list[str],
    overwrite: bool = False,
) -> PersonResult:
    audit.event("person_start", alias=person.alias, sheet=resource_ref(person.sheet_id))

    df = read_planner(clients, person, cfg)
    if df.empty:
        audit.event("person_empty_sheet", alias=person.alias)
        return PersonResult(person.alias, "no_data", detail="hoja vacia")

    df_period = apply_exclusions(slice_period(df, period), cfg)
    if df_period.empty:
        audit.event("person_no_activity", alias=person.alias)
        return PersonResult(person.alias, "no_data", detail="sin actividades en el periodo")

    writer = DocumentWriter(
        docs=clients.docs, drive=clients.drive, cfg=cfg, audit=audit, dry_run=cfg.dry_run
    )

    name = str(cfg.get("template.output_name_pattern", "Informe {persona}")).format(
        mes_abrev=period.mes_abrev,
        mes=period.mes_nombre,
        aa=period.anio_corto,
        anio=period.anio,
        center_code=cfg.center_code,
        center_name=cfg.center_name,
        persona=person.nombre,
        alias=person.alias,
    )

    if bool(cfg.get("run.skip_if_exists", True)) and not overwrite and not cfg.dry_run:
        existing = writer.find_existing(name, person.folder_id)
        if existing:
            audit.event("person_skipped_existing", alias=person.alias, document=resource_ref(existing))
            return PersonResult(person.alias, "skipped_existing", existing, len(df_period))

    resumen, conclusiones, sugerencias = _narrative(df_period, llm, cfg, period, roster_names, audit)

    document_id = writer.create_from_template(template_id, name, person.folder_id)

    with permission_scope(clients.drive, cfg, audit) as broker:
        components = cfg.get("taxonomy.components", {}) or {}
        if "componente" in df_period.columns:
            for code, marker in components.items():
                subset = df_period[df_period["componente"].astype(str).str.strip() == str(code)]
                writer.insert_table(document_id, marker, subset)

        split = cfg.get("taxonomy.meeting_split", {}) or {}
        meeting_label = str(cfg.get("taxonomy.activity_types.meeting", "Reunion"))
        if split.get("enabled") and {"tipo", "descripcion"} <= set(df_period.columns):
            meetings = df_period[df_period["tipo"].astype(str).str.strip() == meeting_label].copy()
            pattern = str(split.get("pattern", ""))
            if pattern:
                match = meetings["descripcion"].astype(str).str.contains(
                    pattern, case=False, na=False, regex=True
                )
                writer.insert_table(document_id, str(split.get("marker_match")), meetings[match])
                writer.insert_table(document_id, str(split.get("marker_rest")), meetings[~match])

        anexo = str(cfg.get("template.markers.anexo", "")).strip()
        if anexo:
            writer.insert_evidence(document_id, anexo, df_period, broker)

    markers = cfg.get("template.markers", {}) or {}
    writer.replace_markers(document_id, {
        markers.get("nombre", "{{NOMBRE}}"): person.nombre,
        markers.get("fecha", "{{FECHA}}"): period.fecha_texto,
        markers.get("mes", "{{mesN}}"): period.mes_nombre,
        markers.get("mes_anterior", "{{mesN-1}}"): period.mes_anterior,
        markers.get("resumen", "{{Resumen}}"): resumen,
        markers.get("conclusiones", "{{Conclusiones}}"): conclusiones,
        markers.get("sugerencias", "{{Sugerencias}}"): sugerencias
            or "No se registraron elementos suficientes para formular sugerencias.",
    })

    status = "dry_run" if cfg.dry_run else "created"
    audit.event("person_done", alias=person.alias, status=status,
                document=resource_ref(document_id), activities=len(df_period))
    return PersonResult(person.alias, status, document_id, len(df_period))


def run(
    cfg: Config,
    *,
    today: date | None = None,
    only: list[str] | None = None,
    overwrite: bool = False,
    verbose: bool = False,
) -> RunResult:
    logger = setup_logging(verbose)
    audit = AuditLog(
        str(cfg.get("audit.log_path", "logs/run.jsonl")),
        log_pii=bool(cfg.get("audit.log_pii", False)),
    )

    period = build_period(today or date.today(), cfg)
    audit.event("run_start", center=cfg.center_code, dry_run=cfg.dry_run,
                periodo=f"{period.inicio:%Y-%m-%d}/{period.fin:%Y-%m-%d}")
    logger.info(
        "Periodo %s a %s | dry_run=%s | llm=%s",
        f"{period.inicio:%d/%m/%Y}", f"{period.fin:%d/%m/%Y}",
        cfg.dry_run, bool(cfg.get("llm.enabled", False)),
    )

    from .auth import build_clients

    clients = build_clients()
    audit.event("authenticated", principal=clients.principal)

    template_id = validate_drive_id(
        get_secret(str(cfg.get("template.document_id_env", "REPORT_TEMPLATE_ID"))) or "",
        field_name="template.document_id_env",
    )

    people = [p for p in load_roster(cfg, clients) if p.active]
    if only:
        wanted = {a.strip() for a in only}
        people = [p for p in people if p.alias in wanted]
    roster_names = [p.nombre for p in people]

    llm = LLMClient(cfg=cfg, audit=audit)
    result = RunResult()

    for person in people:
        try:
            result.results.append(
                process_person(
                    person,
                    clients=clients,
                    cfg=cfg,
                    period=period,
                    template_id=template_id,
                    llm=llm,
                    audit=audit,
                    roster_names=roster_names,
                    overwrite=overwrite,
                )
            )
        except Exception as exc:  # noqa: BLE001 - una persona no detiene el lote
            # El mensaje de la excepcion puede contener datos: se registra el
            # tipo, y el detalle solo va al log local del operador.
            audit.event("person_error", alias=person.alias, error_type=type(exc).__name__)
            logger.error("Fallo con %s: %s: %s", person.alias, type(exc).__name__, exc)
            result.results.append(PersonResult(person.alias, "error", detail=type(exc).__name__))

    audit.event("run_end", **result.counts())
    logger.info("Resultado: %s", result.counts())
    return result
