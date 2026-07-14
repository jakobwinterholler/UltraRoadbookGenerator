"""Supabase / cloud sync configuration."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover
    load_dotenv = None

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if load_dotenv is not None:
    load_dotenv(PROJECT_ROOT / ".env")


@dataclass(frozen=True)
class CloudConfig:
    url: str
    anon_key: str
    service_role_key: str
    jwt_secret: str
    storage_bucket: str = "race-assets"

    @property
    def auth_enabled(self) -> bool:
        """Google Sign-In + JWT verification (no service role required)."""
        return bool(self.url and self.anon_key)

    @property
    def sync_enabled(self) -> bool:
        """Desktop → cloud upload (service role and/or signed-in user token)."""
        return bool(self.url and (self.service_role_key or self.anon_key))

    @property
    def enabled(self) -> bool:
        return self.sync_enabled


def load_cloud_config() -> CloudConfig:
    service_role = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        or os.getenv("SUPABASE_SECRET_KEY", "")
    )
    return CloudConfig(
        url=os.getenv("SUPABASE_URL", "").rstrip("/"),
        anon_key=os.getenv("SUPABASE_ANON_KEY", ""),
        service_role_key=service_role,
        jwt_secret=os.getenv("SUPABASE_JWT_SECRET", ""),
    )


cloud_config = load_cloud_config()
