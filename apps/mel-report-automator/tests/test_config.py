"""La validacion debe rechazar las configuraciones inseguras antes de la red."""

import textwrap

import pytest

from mel_reports.config import ConfigError, load_config, validate_drive_id

BASE = """
center: {name: Centro X, code: CX, timezone: America/La_Paz, locale: es}
period: {cutoff_day: 25, label_previous_month: true}
roster: {source: csv, csv_path: config/roster.csv, worksheet_index: 0}
schema:
  columns: {descripcion: [descripcion], fecha: [fecha]}
  required: [descripcion, fecha]
  date_dayfirst: true
taxonomy:
  activity_types: {task: Tarea, meeting: Reunion}
  components: {INV: "{{Tabla1}}"}
  exclude_description_patterns: []
template:
  document_id_env: REPORT_TEMPLATE_ID
  output_name_pattern: "Informe {persona}"
  markers: {nombre: "{{NOMBRE}}"}
  table_headers: [Actividad, Fecha, Respaldo]
evidence: {mode: link, share_mode: none, workspace_domain: "", allow_public_links: false, revoke_after_run: true, max_items: 50}
llm: {enabled: false, provider: openai, model: gpt-4o-mini, api_key_env: OPENAI_API_KEY}
privacy: {redact: {urls: true, emails: true, phones: true, ids: true, roster_names: true}, fail_closed_on_leak: true}
audit: {log_path: logs/run.jsonl, log_pii: false}
run: {dry_run: true, skip_if_exists: true, max_workers: 1}
"""


def write(tmp_path, body):
    path = tmp_path / "center.yaml"
    path.write_text(textwrap.dedent(body), encoding="utf-8")
    return path


def test_configuracion_base_es_valida(tmp_path):
    cfg = load_config(write(tmp_path, BASE))
    assert cfg.center_code == "CX" and cfg.dry_run is True


def test_rechaza_id_de_plantilla_escrito_en_el_yaml(tmp_path):
    body = BASE.replace("document_id_env: REPORT_TEMPLATE_ID",
                        "document_id_env: REPORT_TEMPLATE_ID\n  document_id: 1AbCdEfGhIjKlMnOpQrStUvWxYz012345")
    with pytest.raises(ConfigError, match="no debe existir"):
        load_config(write(tmp_path, body))


def test_rechaza_publicacion_sin_confirmacion_explicita(tmp_path):
    body = BASE.replace("mode: link, share_mode: none", "mode: embed, share_mode: anyone")
    with pytest.raises(ConfigError, match="allow_public_links"):
        load_config(write(tmp_path, body))


def test_rechaza_share_domain_sin_dominio(tmp_path):
    body = BASE.replace("mode: link, share_mode: none", "mode: embed, share_mode: domain")
    with pytest.raises(ConfigError, match="workspace_domain"):
        load_config(write(tmp_path, body))


def test_rechaza_llm_con_redaccion_de_urls_apagada(tmp_path):
    body = BASE.replace("llm: {enabled: false", "llm: {enabled: true").replace(
        "redact: {urls: true", "redact: {urls: false")
    with pytest.raises(ConfigError, match="redact.urls"):
        load_config(write(tmp_path, body))


def test_rechaza_valores_de_ejemplo_sin_reemplazar(tmp_path):
    body = BASE.replace("name: Centro X", "name: <NOMBRE DEL CENTRO>")
    with pytest.raises(ConfigError, match="ejemplo"):
        load_config(write(tmp_path, body))


def test_validate_drive_id_acepta_url_y_rechaza_basura():
    assert validate_drive_id(
        "https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/edit#gid=0",
        field_name="x",
    ) == "1AbCdEfGhIjKlMnOpQrStUvWxYz012345"
    with pytest.raises(ConfigError):
        validate_drive_id("no-es-un-id", field_name="x")
