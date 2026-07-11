# Deploying Shreevan CRM

This app has three pieces. We host them on two platforms:

| Piece | Where | Cost |
|-------|-------|------|
| PostgreSQL database | **Railway** (managed Postgres) | free trial, then ~$5/mo |
| NestJS API (`server/`) | **Railway** (Docker) | same project |
| React web app (root, Vite) | **Vercel** (static) | free |

The frontend (Vercel) talks to the API (Railway) over HTTPS. Deploy order matters because each side needs the other's URL — follow the steps top to bottom.

> You need three free accounts first: **GitHub**, **Railway** (railway.app), **Vercel** (vercel.com). Sign in to Railway and Vercel *with GitHub* — it makes connecting the repo one click.

---

## Step 1 — Push the code to GitHub

The repo is already initialized and committed locally. Create an **empty** repo on GitHub (no README/license), then:

```bash
cd /Users/harshvishwas/Desktop/Claude/shreevan-crm
git remote add origin https://github.com/<your-username>/shreevan-crm.git
git branch -M main
git push -u origin main
```

✅ `.env` files and `node_modules` are git-ignored, so no secrets get pushed.

---

## Step 2 — Railway: database + API

1. **New Project → Deploy from GitHub repo →** pick `shreevan-crm`.
2. When the service appears, open it → **Settings**:
   - **Root Directory:** `server`
   - **Build:** it auto-detects the `Dockerfile` (Builder = Dockerfile). Leave as is.
3. **Add the database:** in the project, click **＋ New → Database → Add PostgreSQL**.
4. Open the **API service → Variables** and add these:

   | Variable | Value |
   |----------|-------|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` ← type exactly this; Railway links it |
   | `JWT_ACCESS_SECRET` | *(the access secret generated in chat)* |
   | `JWT_REFRESH_SECRET` | *(the refresh secret generated in chat)* |
   | `JWT_ACCESS_TTL` | `900` |
   | `JWT_REFRESH_TTL` | `2592000` |
   | `ENABLE_SIMULATION` | `false` |
   | `CORS_ORIGIN` | `http://localhost:5173` *(temporary — we fix this in Step 5)* |

   > Don't set `PORT` — Railway injects it and the API reads it automatically.
5. **Settings → Networking → Generate Domain.** Copy the URL, e.g.
   `https://shreevan-crm-production.up.railway.app`
6. The API auto-runs database migrations on every deploy, so the tables get created on this first deploy. Check **Deployments → Logs** for:
   `Shreevan CRM API on http://localhost:<port>/api/v1`

Quick test in your browser: open `https://<your-railway-domain>/api/docs` — you should see the Swagger API page.

---

## Step 3 — Seed the database (one time)

The database is empty after migrations, so there's **no login yet**. Seed it once from your Mac, pointing at Railway's *public* database URL:

1. Railway → **Postgres service → Variables →** copy **`DATABASE_PUBLIC_URL`**.
2. Run:

```bash
cd /Users/harshvishwas/Desktop/Claude/shreevan-crm/server
DATABASE_URL="<paste DATABASE_PUBLIC_URL here>" npm run db:seed
```

You should see `Seed complete. Admin login: harsh@shreevanwellness.com / changeme123`.

---

## Step 4 — Vercel: the web app

1. **Add New → Project →** import `shreevan-crm` from GitHub.
2. Vercel detects **Vite** automatically (`vercel.json` pins the build). Leave **Root Directory** as `./`.
3. **Environment Variables →** add:

   | Variable | Value |
   |----------|-------|
   | `VITE_API_URL` | `https://<your-railway-domain>/api/v1` |

   ⚠️ Include the `/api/v1` at the end. This value is baked in at build time.
4. **Deploy.** Copy the resulting URL, e.g. `https://shreevan-crm.vercel.app`.

---

## Step 5 — Connect the two (CORS)

1. Back in **Railway → API service → Variables**, change:
   - `CORS_ORIGIN` = `https://shreevan-crm.vercel.app` *(your exact Vercel URL, no trailing slash)*
2. Railway redeploys automatically.

---

## Step 6 — Log in 🎉

Open your Vercel URL and sign in:

- **Email:** `harsh@shreevanwellness.com` (the admin)
- **Password:** `changeme123`

The seed only creates this one admin. Add teammates from **Settings → Team & roles** once logged in — invite with a real name, title and screen access, no need to touch the seed script.

---

## After deploy — good to know

- **Future updates:** `git push` → both Vercel and Railway redeploy automatically.
- **Change the seed password immediately:** log in, then use **Settings → Your account → Change password** (and enable 2FA while you're there). This is a real login on a public URL — don't leave it on `changeme123`.
- **Custom domain:** add it in Vercel (web) and/or Railway (API); then update `VITE_API_URL` / `CORS_ORIGIN` to match.
- **`ENABLE_SIMULATION=false`** is important in production — it disables the dev-only fake-inbound tooling.
- **Channel integrations (WhatsApp/Instagram/Email)** stay simulated until you add real provider credentials — those env vars are listed in `server/.env.example`.
- **Cost note:** Railway's free trial is time/credit limited; the API + Postgres need the Hobby plan (~$5/mo) to stay always-on. Vercel's frontend stays free.
