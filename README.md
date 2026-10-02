# Real Makoya Agency — Retail Intelligence & Compliance Platform

A field data capture platform for retail store assessments, built for Real
Makoya Agency to collect, store, and present FMCG market intelligence to
brand-owner clients.

## What it captures (per store visit)

1. **Ownership & registration** — owner details, contact, municipal
   registration status and number.
2. **Top-selling product lines** — category, brand, sales rank, estimated
   monthly units, to build a live demand picture.
3. **Trade & distribution routes** — formal wholesaler / informal bulk buyer
   / unverified supplier, plus supplier name and location.
4. **Compliance & CoA verification** — Certificate of Analysis on file,
   health permit + number/expiry, brand authenticity markers.
5. **Counterfeit screening** — overall risk rating plus specific flags for
   packaging, batch code, and pricing anomalies, with free-text notes.

## Roles & access levels

| Role | Can do |
|---|---|
| **Super Admin** | Everything, including creating other Admins/Super Admins |
| **Admin** | Manage field agents & clients, full store/report access, cannot create Super Admins |
| **Field Agent** | Capture and edit stores & assessments; cannot manage users |
| **Client (FMCG company)** | Read-only professional report; can be scoped to specific brands only, or given full market access |

Admins create every login from **Users & Access** in the dashboard — there is
no public sign-up. Client accounts can be restricted to a comma-separated
list of brand names, so e.g. a household-goods client only ever sees data
tied to their own brands, never a competitor's.

Internal notes captured by field agents are flagged in the database as
agency-only and are never queried into the client-facing report.

## Tech stack

- **Next.js 14** (App Router, TypeScript) — deploys natively on Vercel
- **PostgreSQL + Prisma** — works with Neon, Vercel Postgres, or Supabase
- **NextAuth.js** (credentials + JWT sessions, bcrypt password hashing)
- **Tailwind CSS**
- CSV export of raw data (agency roles only); print-to-PDF client report

This uses only Vercel's serverless-friendly building blocks — no background
workers, no binaries — so it deploys with zero extra configuration.

---

## 1. Local setup

```bash
npm install
cp .env.example .env       # then fill in DATABASE_URL and NEXTAUTH_SECRET
npx prisma db push          # creates all tables in your database
npm run db:seed             # creates the first Super Admin login
npm run dev
```

Open http://localhost:3000 and log in with the email/password printed by the
seed script (from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `.env`).

**Change that password immediately** by creating your real admin account
from the Users page and deactivating the seed account, or by seeding with
your own credentials directly in `.env` before running `db:seed`.

## 2. Get a free Postgres database (Neon)

1. Go to https://neon.tech and create a free project.
2. Copy the connection string it gives you (starts with `postgresql://`).
3. Paste it into `DATABASE_URL` in `.env` (and later into Vercel's
   environment variables — step 4 below). Keep `?sslmode=require` at the end.

Vercel Postgres or Supabase work identically — just swap the connection
string.

## 3. Push this code to GitHub

```bash
git init
git add .
git commit -m "Initial commit: Real Makoya platform"
git branch -M main
git remote add origin <your-empty-github-repo-url>
git push -u origin main
```

## 4. Deploy to Vercel

1. Go to https://vercel.com/new and import the GitHub repo.
2. Under **Environment Variables**, add:
   - `DATABASE_URL` — your Neon/Postgres connection string
   - `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
   - `NEXTAUTH_URL` — your production URL, e.g. `https://real-makoya.vercel.app`
     (you can add this after the first deploy once you know the URL, then
     redeploy)
3. Click **Deploy**. Vercel runs `prisma generate` automatically via the
   `postinstall` script.
4. After the first deploy, run the schema push and seed once against the
   production database from your local machine:
   ```bash
   DATABASE_URL="<your prod connection string>" npx prisma db push
   DATABASE_URL="<your prod connection string>" npm run db:seed
   ```
5. Log in at your Vercel URL with the seeded admin account and start
   creating real users.

## 3-minute walkthrough for new agency staff

1. **Admin** logs in → **Users & Access** → creates a **Field Agent** login.
2. **Field Agent** logs in → **Stores** → **Capture New Store** → fills in
   ownership & registration → is taken straight into the full assessment
   form (product lines, trade routes, compliance, counterfeit screening).
3. **Admin** reviews everything under **Stores**, exports raw data as CSV
   for internal analysis.
4. **Admin** creates a **Client** login for an FMCG company (optionally
   restricted to their own brand names) → shares the credentials → the
   client logs in and sees only the polished **Reports** page, with a
   "Print / Save as PDF" button for sharing offline.

## Extending this further

- **Photo evidence**: `Assessment.photoUrls` is already in the schema as a
  string array — wire up a Vercel Blob or S3 upload in the assessment form
  to start attaching counterfeit-indicator photos.
- **Map view**: `Store.latitude`/`longitude` fields are ready for a map
  widget (e.g. Mapbox or Google Maps) once you're capturing GPS coordinates
  from the field.
- **Audit trail**: every assessment already records which agent captured it
  and when; add a change-log table if you need full edit history too.
- **Automated compliance certifications**: this platform gives you clean,
  structured data and solid engineering practices (hashed passwords,
  role-based access control, audit fields), but claims like "meets industry
  standard X" (e.g. a specific FMCG/regulatory certification) depend on
  your own legal/compliance review — happy to help wire up whatever specific
  standard you're targeting once you tell me which one.
