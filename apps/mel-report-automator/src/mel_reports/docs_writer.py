"""Escritura en Google Docs y Drive.

Diferencias de seguridad frente a un guion directo contra la API:

- **No se amplian permisos por defecto.** Insertar una imagen con la API de
  Docs exige que el archivo sea legible sin sesion, lo que empuja a conceder
  lectura publica. Aqui el modo por defecto (`evidence.mode: link`) inserta un
  hipervinculo y no toca ningun permiso. El modo `embed` existe, pero exige
  declarar `share_mode` y, para exposicion publica, una segunda confirmacion
  explicita en la configuracion.
- **Los permisos concedidos se revierten.** Si `revoke_after_run` esta activo,
  cada permiso creado por esta herramienta se elimina al terminar, incluso si
  la ejecucion falla.
- **Los fallos de permisos no se silencian.** Se registran y se propagan como
  degradacion visible, no con un `except: pass`.
- **Ubicacion determinista.** El documento se crea directamente en la carpeta
  destino en lugar de crearse en la raiz y moverse despues.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Any

import pandas as pd

from .audit import AuditLog, resource_ref
from .config import Config
from .transform import texto_valido

DRIVE_FILE_MARKERS = ("drive.google.com/file", "docs.google.com/", "drive.google.com/open")


# ---------------------------------------------------------------------------
# Utilidades de documento
# ---------------------------------------------------------------------------

def find_marker(doc: dict[str, Any], marker: str) -> int | None:
    """Indice absoluto de la primera aparicion del marcador en el cuerpo."""
    for block in doc.get("body", {}).get("content", []):
        paragraph = block.get("paragraph")
        if not paragraph:
            continue
        text = "".join(
            element.get("textRun", {}).get("content", "")
            for element in paragraph.get("elements", [])
            if "textRun" in element
        )
        if marker in text:
            return block.get("startIndex", 0) + text.index(marker)
    return None


def extract_drive_id(url: str) -> str | None:
    """ID de Drive a partir de una URL, sin asumir un unico formato."""
    import re

    for pattern in (r"/d/([A-Za-z0-9_-]{20,})", r"[?&]id=([A-Za-z0-9_-]{20,})"):
        match = re.search(pattern, url or "")
        if match:
            return match.group(1)
    return None


# ---------------------------------------------------------------------------
# Gestion acotada de permisos
# ---------------------------------------------------------------------------

@dataclass
class PermissionBroker:
    """Concede el minimo acceso necesario y lo retira al terminar."""

    drive: Any
    cfg: Config
    audit: AuditLog
    granted: list[tuple[str, str]] = field(default_factory=list)

    @property
    def share_mode(self) -> str:
        return str(self.cfg.get("evidence.share_mode", "none")).lower()

    def ensure_readable(self, file_id: str) -> bool:
        """True si el archivo puede leerse sin sesion tras esta llamada."""
        if self.share_mode == "none":
            return False

        if self.share_mode == "domain":
            domain = str(self.cfg.get("evidence.workspace_domain", "")).strip()
            body = {"role": "reader", "type": "domain", "domain": domain}
        elif self.share_mode == "anyone":
            # La validacion de configuracion ya exigio allow_public_links: true.
            body = {"role": "reader", "type": "anyone"}
        else:
            return False

        try:
            permission = self.drive.permissions().create(
                fileId=file_id, body=body, fields="id", sendNotificationEmail=False
            ).execute()
        except Exception as exc:  # noqa: BLE001 - se degrada, no se oculta
            self.audit.event(
                "permission_grant_failed",
                file=resource_ref(file_id),
                mode=self.share_mode,
                error_type=type(exc).__name__,
            )
            return False

        self.granted.append((file_id, permission["id"]))
        self.audit.event("permission_granted", file=resource_ref(file_id), mode=self.share_mode)
        return True

    def revoke_all(self) -> None:
        if not bool(self.cfg.get("evidence.revoke_after_run", True)):
            if self.granted:
                self.audit.event("permissions_left_in_place", count=len(self.granted))
            return
        for file_id, permission_id in self.granted:
            try:
                self.drive.permissions().delete(fileId=file_id, permissionId=permission_id).execute()
                self.audit.event("permission_revoked", file=resource_ref(file_id))
            except Exception as exc:  # noqa: BLE001
                self.audit.event(
                    "permission_revoke_failed",
                    file=resource_ref(file_id),
                    error_type=type(exc).__name__,
                )
        self.granted.clear()


@contextmanager
def permission_scope(drive: Any, cfg: Config, audit: AuditLog) -> Iterator[PermissionBroker]:
    broker = PermissionBroker(drive=drive, cfg=cfg, audit=audit)
    try:
        yield broker
    finally:
        broker.revoke_all()


# ---------------------------------------------------------------------------
# Escritor
# ---------------------------------------------------------------------------

@dataclass
class DocumentWriter:
    docs: Any
    drive: Any
    cfg: Config
    audit: AuditLog
    dry_run: bool = True

    # -- creacion ------------------------------------------------------------
    def find_existing(self, name: str, folder_id: str | None) -> str | None:
        safe_name = name.replace("'", r"\'")
        query = f"name = '{safe_name}' and trashed = false"
        if folder_id:
            query += f" and '{folder_id}' in parents"
        try:
            result = self.drive.files().list(
                q=query, fields="files(id)", pageSize=1, spaces="drive"
            ).execute()
        except Exception as exc:  # noqa: BLE001
            self.audit.event("existing_lookup_failed", error_type=type(exc).__name__)
            return None
        files = result.get("files", [])
        return files[0]["id"] if files else None

    def create_from_template(self, template_id: str, name: str, folder_id: str | None) -> str:
        if self.dry_run:
            self.audit.event("dry_run_create", template=resource_ref(template_id),
                             folder=resource_ref(folder_id))
            return "DRY-RUN-DOCUMENT-ID"
        body: dict[str, Any] = {"name": name}
        if folder_id:
            # Se crea ya dentro de la carpeta: evita el paso por la raiz.
            body["parents"] = [folder_id]
        copied = self.drive.files().copy(fileId=template_id, body=body, fields="id, parents").execute()
        document_id = copied["id"]
        self.audit.event("document_created", document=resource_ref(document_id),
                         folder=resource_ref(folder_id))
        return document_id

    # -- contenido -----------------------------------------------------------
    def _batch(self, document_id: str, requests: list[dict[str, Any]]) -> None:
        if not requests:
            return
        if self.dry_run:
            self.audit.event("dry_run_batch", document=resource_ref(document_id), requests=len(requests))
            return
        self.docs.documents().batchUpdate(documentId=document_id, body={"requests": requests}).execute()

    def replace_markers(self, document_id: str, replacements: dict[str, str]) -> None:
        requests = [
            {
                "replaceAllText": {
                    "containsText": {"text": marker, "matchCase": True},
                    "replaceText": str(value or ""),
                }
            }
            for marker, value in replacements.items()
        ]
        self._batch(document_id, requests)
        self.audit.event("markers_replaced", document=resource_ref(document_id), count=len(requests))

    def insert_table(self, document_id: str, marker: str, df: pd.DataFrame) -> bool:
        """Sustituye `marker` por una tabla con las filas de `df`."""
        headers = list(self.cfg.get("template.table_headers", ["Actividad", "Fecha", "Respaldo"]))
        rows: list[list[str]] = [headers]

        if df.empty:
            rows.append(["Sin actividades de este tipo", "-", "-"])
        else:
            work = df.copy()
            if "fecha" in work.columns:
                work["fecha"] = pd.to_datetime(work["fecha"], errors="coerce").dt.strftime("%d/%m/%Y")
            for _, row in work.iterrows():
                rows.append([
                    _cell(row.get("descripcion")),
                    _cell(row.get("fecha")),
                    _cell(row.get("enlace")),
                ])

        if self.dry_run:
            self.audit.event("dry_run_table", marker=marker, rows=len(rows))
            return True

        doc = self.docs.documents().get(documentId=document_id).execute()
        index = find_marker(doc, marker)
        if index is None:
            self.audit.event("marker_not_found", document=resource_ref(document_id), marker=marker)
            return False

        # Borrar el marcador e insertar la tabla vacia en su lugar.
        self._batch(document_id, [
            {"deleteContentRange": {"range": {"startIndex": index, "endIndex": index + len(marker)}}},
            {"insertTable": {"rows": len(rows), "columns": len(rows[0]), "location": {"index": index}}},
        ])

        # Releer para obtener los indices reales de cada celda.
        doc = self.docs.documents().get(documentId=document_id).execute()
        table = next(
            (el for el in doc.get("body", {}).get("content", [])
             if "table" in el and el.get("startIndex", 0) >= index),
            None,
        )
        if table is None:
            self.audit.event("table_not_found_after_insert", marker=marker)
            return False

        positions: list[tuple[int, int, int]] = []
        for r, table_row in enumerate(table["table"].get("tableRows", [])):
            for c, cell in enumerate(table_row.get("tableCells", [])):
                content = cell.get("content") or []
                positions.append((content[0].get("startIndex", index + 1) if content else index + 1, r, c))

        # Se insertan en orden inverso para que cada insercion no desplace las
        # posiciones aun no escritas.
        requests = [
            {"insertText": {"location": {"index": position}, "text": rows[r][c]}}
            for position, r, c in sorted(positions, key=lambda item: item[0], reverse=True)
            if rows[r][c]
        ]
        self._batch(document_id, requests)
        self.audit.event("table_inserted", marker=marker, rows=len(rows))
        return True

    def insert_evidence(
        self, document_id: str, marker: str, df: pd.DataFrame, broker: PermissionBroker
    ) -> None:
        """Inserta los respaldos del periodo en el anexo.

        En modo `link` no se modifica ningun permiso. En modo `embed` se pide
        acceso al broker y, si no se obtiene, se degrada a enlace en lugar de
        forzar la exposicion del archivo.
        """
        mode = str(self.cfg.get("evidence.mode", "link")).lower()
        max_items = int(self.cfg.get("evidence.max_items", 50))

        candidates: list[tuple[str, str]] = []
        if not df.empty and "enlace" in df.columns:
            for _, row in df.head(max_items).iterrows():
                url = str(row.get("enlace", "")).strip()
                if not url or not any(m in url for m in DRIVE_FILE_MARKERS):
                    continue
                descripcion = str(row.get("descripcion", "")).strip() or "Respaldo"
                candidates.append((descripcion, url))

        if self.dry_run:
            self.audit.event("dry_run_evidence", marker=marker, items=len(candidates), mode=mode)
            return

        doc = self.docs.documents().get(documentId=document_id).execute()
        index = find_marker(doc, marker)
        if index is None:
            self.audit.event("marker_not_found", document=resource_ref(document_id), marker=marker)
            return

        self._batch(document_id, [
            {"deleteContentRange": {"range": {"startIndex": index, "endIndex": index + len(marker)}}}
        ])

        if not candidates:
            self._batch(document_id, [
                {"insertText": {"location": {"index": index},
                                "text": "\nNo se registraron respaldos en este periodo.\n"}}
            ])
            return

        height_pt = float(self.cfg.get("evidence.image_height_pt", 200))
        width_pt = float(self.cfg.get("evidence.image_width_pt", 200))
        embedded = 0
        linked = 0
        for descripcion, url in candidates:
            file_id = extract_drive_id(url)
            caption = f"\n{descripcion}\n"

            image_uri: str | None = None
            if mode == "embed" and file_id:
                mime = self._mime_type(file_id)
                if mime and mime.startswith("image/") and broker.ensure_readable(file_id):
                    image_uri = f"https://drive.google.com/uc?export=view&id={file_id}"

            if image_uri:
                self._batch(document_id, [
                    {"insertText": {"location": {"index": index}, "text": caption}}
                ])
                index += len(caption)
                try:
                    self._batch(document_id, [{
                        "insertInlineImage": {
                            "uri": image_uri,
                            "location": {"index": index},
                            "objectSize": {
                                "height": {"magnitude": height_pt, "unit": "PT"},
                                "width": {"magnitude": width_pt, "unit": "PT"},
                            },
                        }
                    }])
                    index += 1
                    embedded += 1
                    continue
                except Exception as exc:  # noqa: BLE001 - se degrada a enlace
                    self.audit.event("image_embed_failed", error_type=type(exc).__name__)

            texto = f"\n{descripcion}: {url}\n"
            self._batch(document_id, [
                {"insertText": {"location": {"index": index}, "text": texto}}
            ])
            index += len(texto)
            linked += 1

        self.audit.event("evidence_inserted", embedded=embedded, linked=linked, mode=mode)

    def _mime_type(self, file_id: str) -> str | None:
        try:
            meta = self.drive.files().get(fileId=file_id, fields="mimeType").execute()
            return meta.get("mimeType")
        except Exception as exc:  # noqa: BLE001
            self.audit.event("evidence_metadata_failed", file=resource_ref(file_id),
                             error_type=type(exc).__name__)
            return None


def _cell(value: Any) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return "-"
    text = str(value).strip()
    return text if texto_valido(text) or text.startswith("http") else (text or "-")
