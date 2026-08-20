"""Autenticacion con Google, independiente del entorno de ejecucion.

Se resuelve en este orden:

1. Cuenta de servicio, si GOOGLE_APPLICATION_CREDENTIALS apunta a un archivo.
   Es la opcion recomendada para ejecuciones desatendidas: la identidad no es
   la de una persona y su acceso se puede revocar sin afectar a nadie.
2. Autenticacion de Colab, si el codigo corre en Colab.
3. Credenciales por defecto del entorno (ADC).

Los ambitos (`scopes`) son los minimos necesarios. `drive.file` limita el
acceso a los archivos que la propia aplicacion crea o abre explicitamente, en
lugar del acceso total a Drive que concede el ambito amplio.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

SCOPES_DEFAULT = [
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/drive.file",
]

# Necesario solo cuando la plantilla o las carpetas destino no fueron creadas
# por esta aplicacion (caso habitual la primera vez).
SCOPES_BROAD_DRIVE = [
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/drive",
]


@dataclass
class GoogleClients:
    credentials: Any
    gspread: Any
    docs: Any
    drive: Any
    principal: str


def _in_colab() -> bool:
    try:
        import google.colab  # noqa: F401
        return True
    except Exception:
        return False


def build_clients(*, broad_drive_scope: bool = True) -> GoogleClients:
    import gspread
    from googleapiclient.discovery import build

    scopes = SCOPES_BROAD_DRIVE if broad_drive_scope else SCOPES_DEFAULT
    sa_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "").strip()

    if sa_path and os.path.isfile(sa_path):
        from google.oauth2 import service_account

        creds = service_account.Credentials.from_service_account_file(sa_path, scopes=scopes)
        principal = f"service-account:{getattr(creds, 'service_account_email', 'desconocida')}"
    elif _in_colab():
        from google.auth import default
        from google.colab import auth as colab_auth

        colab_auth.authenticate_user()
        creds, _ = default(scopes=scopes)
        principal = "colab-user"
    else:
        from google.auth import default

        creds, _ = default(scopes=scopes)
        principal = "application-default-credentials"

    return GoogleClients(
        credentials=creds,
        gspread=gspread.authorize(creds),
        docs=build("docs", "v1", credentials=creds, cache_discovery=False),
        drive=build("drive", "v3", credentials=creds, cache_discovery=False),
        principal=principal,
    )
