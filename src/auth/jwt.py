"""Supabase JWT verification."""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

import httpx
import jwt
from jwt import PyJWKClient

from cloud.config import cloud_config


@dataclass(frozen=True)
class AuthUser:
    id: str
    email: str | None = None


@lru_cache(maxsize=1)
def _jwks_client() -> PyJWKClient:
    return PyJWKClient(f"{cloud_config.url}/auth/v1/.well-known/jwks.json")


def _verify_via_auth_api(token: str) -> dict:
    response = httpx.get(
        f"{cloud_config.url}/auth/v1/user",
        headers={
            "apikey": cloud_config.anon_key,
            "Authorization": f"Bearer {token}",
        },
        timeout=15.0,
    )
    if response.status_code >= 400:
        raise ValueError("Invalid or expired session.")
    user = response.json()
    user_id = user.get("id")
    if not user_id:
        raise ValueError("Invalid token: missing subject.")
    return {"sub": user_id, "email": user.get("email")}


def verify_access_token(token: str) -> AuthUser:
    if not cloud_config.auth_enabled:
        raise ValueError("Cloud auth is not configured.")

    payload: dict | None = None
    last_error: Exception | None = None

    if cloud_config.jwt_secret:
        try:
            payload = jwt.decode(
                token,
                cloud_config.jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
            )
        except jwt.InvalidTokenError as exc:
            last_error = exc

    if payload is None:
        try:
            signing_key = _jwks_client().get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["ES256", "RS256"],
                audience="authenticated",
            )
        except jwt.InvalidTokenError as exc:
            last_error = exc

    if payload is None:
        try:
            payload = _verify_via_auth_api(token)
        except Exception as exc:
            if last_error is not None:
                raise ValueError("Invalid or expired session.") from last_error
            raise ValueError("Invalid or expired session.") from exc

    user_id = payload.get("sub")
    if not user_id:
        raise ValueError("Invalid token: missing subject.")
    email = payload.get("email")
    return AuthUser(id=str(user_id), email=str(email) if email else None)
