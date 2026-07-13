# Cloud sync setup (Phase 1)

## 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com)
2. Run `supabase/migrations/001_phase1.sql` in the SQL editor
3. Create a **private** storage bucket named `race-assets`
4. Add storage policy (SQL editor):

```sql
create policy "Users read own race assets"
  on storage.objects for select
  using (
    bucket_id = 'race-assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
```

5. Copy from **Project Settings → API**:
   - Project URL → `SUPABASE_URL` / `VITE_SUPABASE_URL`
   - **anon** or **publishable** key → `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY`
   - service_role key → `SUPABASE_SERVICE_ROLE_KEY` (backend only)
   - JWT secret → `SUPABASE_JWT_SECRET` (backend only)

> **Note:** Supabase’s Next.js guide uses `NEXT_PUBLIC_*` and `@supabase/ssr`. This project uses **Vite** (`VITE_*` env vars) and **`@supabase/supabase-js`** in `shared/auth/` — do not add Next.js middleware or `@supabase/ssr` unless you migrate to Next.js.

## 2. Google OAuth

1. [Google Cloud Console](https://console.cloud.google.com/) → OAuth client (Web)
2. Authorized redirect URIs:
   - `https://<project-ref>.supabase.co/auth/v1/callback`
3. Supabase → Authentication → Providers → Google → paste client ID + secret
4. Supabase → Authentication → URL Configuration → add redirect URLs:
   - `http://127.0.0.1:5173/**`
   - `http://127.0.0.1:5175/**`
   - `https://companion-flax.vercel.app/**`
   - Site URL: `http://127.0.0.1:5173` for local dev

## 3. Local environment

```bash
cp .env.example .env
# fill in Supabase values

cp .env.example frontend/.env.local
cp .env.example companion/.env.local
# same VITE_* values in both
```

Backend loads `.env` from repo root when starting uvicorn.

## 4. Run locally

```bash
pip install -r requirements.txt
cd frontend && npm install
cd companion && npm install
cd shared && npm install

./run_dev.sh                 # desktop → http://127.0.0.1:5173
cd companion && npm run dev  # companion → http://127.0.0.1:5175
```

## 5. iPhone / production Companion

The Companion reads **directly from Supabase** (race list + bundle download). You do **not** need to deploy FastAPI for the phone app.

Set these Vercel environment variables for the `companion` project:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Do **not** set `VITE_API_BASE_URL` unless you want to route reads through FastAPI instead.

FastAPI only needs to run on your desktop (via `./run_dev.sh`) to analyze GPX files and push races to the cloud.

## 6. End-to-end workflow

1. **Desktop:** Sign in (Settings → Account) → import GPX → analyze → verify stops
2. Races sync automatically to Supabase in the background
3. **Companion (iPhone):** Sign in with the same Google account → race list appears
4. Tap a race → downloads for offline → open without internet

## 7. Verify sync

After signing in on desktop and analyzing a race:

```bash
# From Supabase dashboard → Table Editor → races
# Row should exist with has_bundle = true

# Or via API (optional):
curl -H "Authorization: Bearer <jwt>" http://127.0.0.1:8000/api/sync/races
```
