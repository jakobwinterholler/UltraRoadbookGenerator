#!/usr/bin/env python3
"""Apply supabase/migrations/001_phase1.sql to the remote Supabase project."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from urllib.parse import quote_plus

try:
    import httpx
except ImportError:
    httpx = None  # type: ignore[assignment]

try:
    import psycopg2
except ImportError:
    psycopg2 = None  # type: ignore[assignment]

PROJECT_ROOT = Path(__file__).resolve().parent.parent
MIGRATION = PROJECT_ROOT / "supabase" / "migrations" / "001_phase1.sql"
DEFAULT_PROJECT_REF = "lxorwwrtxwffiwzdmtez"


def load_dotenv() -> None:
    try:
        from dotenv import load_dotenv as _load

        _load(PROJECT_ROOT / ".env")
    except ImportError:
        pass


def build_dsn(project_ref: str, password: str) -> str:
    if url := os.getenv("DATABASE_URL"):
        return url
    host = os.getenv("SUPABASE_DB_HOST", f"db.{project_ref}.supabase.co")
    port = os.getenv("SUPABASE_DB_PORT", "5432")
    user = os.getenv("SUPABASE_DB_USER", "postgres")
    database = os.getenv("SUPABASE_DB_NAME", "postgres")
    encoded = quote_plus(password)
    return f"postgresql://{user}:{encoded}@{host}:{port}/{database}?sslmode=require"


def verify_tables(cursor) -> None:
    cursor.execute(
        """
        select table_name
        from information_schema.tables
        where table_schema = 'public'
          and table_name in ('profiles', 'races')
        order by table_name
        """
    )
    tables = {row[0] for row in cursor.fetchall()}
    missing = {"profiles", "races"} - tables
    if missing:
        raise RuntimeError(f"Missing tables after migration: {', '.join(sorted(missing))}")
    print("✓ public.profiles exists")
    print("✓ public.races exists")


def verify_rls(cursor) -> None:
    cursor.execute(
        """
        select tablename, rowsecurity
        from pg_tables
        where schemaname = 'public'
          and tablename in ('profiles', 'races')
        order by tablename
        """
    )
    for table, enabled in cursor.fetchall():
        if not enabled:
            raise RuntimeError(f"RLS not enabled on public.{table}")
        print(f"✓ RLS enabled on public.{table}")


def verify_bucket(cursor) -> None:
    cursor.execute(
        "select id, public from storage.buckets where id = 'race-assets'"
    )
    row = cursor.fetchone()
    if not row:
        raise RuntimeError("storage bucket race-assets missing")
    if row[1]:
        raise RuntimeError("race-assets bucket must be private")
    print("✓ storage bucket race-assets exists (private)")


def apply_via_management_api(project_ref: str, sql: str, access_token: str) -> None:
    if httpx is None:
        raise RuntimeError("Install httpx: pip install httpx")

    url = f"https://api.supabase.com/v1/projects/{project_ref}/database/query"
    response = httpx.post(
        url,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
        json={"query": sql},
        timeout=120.0,
    )
    if response.status_code >= 400:
        raise RuntimeError(
            f"Management API migration failed ({response.status_code}): {response.text}"
        )
    print("✓ migration SQL executed via Supabase Management API")


def verify_via_rest(project_ref: str) -> None:
    if httpx is None:
        return
    load_dotenv()
    anon_key = os.getenv("SUPABASE_ANON_KEY", "")
    if not anon_key:
        return
    base = os.getenv("SUPABASE_URL", f"https://{project_ref}.supabase.co").rstrip("/")
    for table in ("profiles", "races"):
        response = httpx.get(
            f"{base}/rest/v1/{table}?select=id&limit=1",
            headers={"apikey": anon_key, "Authorization": f"Bearer {anon_key}"},
            timeout=30.0,
        )
        if response.status_code == 404 and "PGRST205" in response.text:
            raise RuntimeError(f"public.{table} still missing in PostgREST schema cache")
        print(f"✓ REST API can reach public.{table}")


def main() -> int:
    load_dotenv()
    parser = argparse.ArgumentParser(description="Apply Phase 1 Supabase migration")
    parser.add_argument(
        "--project-ref",
        default=os.getenv("SUPABASE_PROJECT_REF", DEFAULT_PROJECT_REF),
    )
    parser.add_argument(
        "--password",
        default=os.getenv("SUPABASE_DB_PASSWORD", ""),
        help="Database password (or set SUPABASE_DB_PASSWORD / DATABASE_URL)",
    )
    args = parser.parse_args()

    if not MIGRATION.is_file():
        print(f"Migration not found: {MIGRATION}", file=sys.stderr)
        return 1

    sql = MIGRATION.read_text(encoding="utf-8")
    access_token = os.getenv("SUPABASE_ACCESS_TOKEN", "")

    if access_token:
        print(f"Applying migration to project {args.project_ref} via Management API…")
        apply_via_management_api(args.project_ref, sql, access_token)
        verify_via_rest(args.project_ref)
        print("Migration applied successfully.")
        return 0

    if psycopg2 is None:
        print("Install psycopg2-binary: pip install psycopg2-binary", file=sys.stderr)
        return 1

    password = args.password
    if not password and not os.getenv("DATABASE_URL"):
        print(
            "Set SUPABASE_ACCESS_TOKEN, SUPABASE_DB_PASSWORD, or DATABASE_URL",
            file=sys.stderr,
        )
        return 1

    dsn = build_dsn(args.project_ref, password)
    print(f"Applying migration to project {args.project_ref} via Postgres…")

    with psycopg2.connect(dsn) as conn:
        conn.autocommit = True
        with conn.cursor() as cursor:
            cursor.execute(sql)
            verify_tables(cursor)
            verify_rls(cursor)
            verify_bucket(cursor)

    print("Migration applied successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
