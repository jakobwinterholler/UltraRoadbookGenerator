"""FastAPI auth dependencies."""

from __future__ import annotations

from fastapi import Header, HTTPException

from auth.jwt import AuthUser, verify_access_token
from cloud.config import cloud_config


def get_optional_user(authorization: str | None = Header(default=None)) -> AuthUser | None:
    if not authorization or not cloud_config.auth_enabled:
        return None
    if not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        return None
    try:
        return verify_access_token(token)
    except Exception:
        return None


def require_user(authorization: str | None = Header(default=None)) -> AuthUser:
    if not cloud_config.auth_enabled:
        raise HTTPException(status_code=503, detail="Cloud auth is not configured on this server.")
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Sign in required.")
    token = authorization.split(" ", 1)[1].strip()
    try:
        return verify_access_token(token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired session.") from exc
