# Menukar — Project Map

Reference for any AI assistant (Claude Code, ChatGPT, etc.) or human picking
up this project cold. Read this first before touching code or debugging.

## What this is

A QR-code digital menu platform, built Next.js 14 (App Router) + Supabase
(Postgres + Auth). Three audiences:

1. **Customers** — scan a QR code, see a live menu, no login.
2. **Restaurant/hotel owners** — sign in, manage their menu(s) from a dashboard.
3. **Platform admins (you)** — `/admin`, manually-granted, oversee all tenants.

## Folder tree, one line each

```
menukar/
├── app/
│   ├── admin/           → platform-admin dashboard (list every account/outlet), gated by platform_admins table
│   ├── auth/callback/   → old magic-link redirect handler, unused now that login is password-based
│   ├── dashboard/       → owner's private area: setup screen, menu editor, QR panel, add-outlet
│   ├── login/           → sign in / create account page (email + password)
│   ├── m/[slug]/        → the public menu customers see after scanning a QR code, no login
│   ├── globals.css      → site-wide styles + dashboard's responsive layout
│   ├── layout.tsx       → root HTML shell, shared across every page
│   └── page.tsx         → the public landing/home page
├── components/          → empty — nothing built here yet
├── demos/                → two standalone HTML mockups (owner dashboard, customer menu), not part of the live app
├── lib/                  → Supabase client setup (browser + server) and money/slug helper functions
├── node_modules/         → installed npm dependencies (not our code)
├── supabase/             → schema.sql — the entire database: tables, RLS policies, functions
├── .env.local            → your real Supabase URL/key (gitignored, never commit or share)
├── .env.local.example    → blank template for the above
├── .gitignore            → tells git which files to ignore (env files, node_modules, etc.)
├── middleware.ts         → blocks unauthenticated users from /dashboard and /admin
├── next-env.d.ts         → auto-generated TypeScript file for Next.js, don't edit
├── next.config.mjs       → Next.js build/runtime configuration
├── package-lock.json     → exact installed dependency versions, auto-generated
├── package.json          → project name, scripts (npm run dev/build), dependency list
├── PROJECT_MAP.md        → this file — read first for anything
├── README.md             → original project intro/setup notes
├── tsconfig.json         → TypeScript compiler settings
└── tsconfig.tsbuildinfo  → TypeScript's incremental build cache, auto-generated
```

Multi-tenant model: an **account** (billing/brand root — one restaurant, or
one hotel) has **memberships** (users, with role owner/manager/staff) and
owns one or more **restaurants** ("outlets" — a hotel's separate shops).

## File-by-file

### Pages (`app/`)

| File | What it does | Touch this when... |
|---|---|---|
| `app/page.tsx` | Public landing/home page | Marketing copy changes |
| `app/layout.tsx` | Root HTML layout, global `<head>` | Site-wide meta, fonts |
| `app/globals.css` | Site-wide styles, dashboard layout, breakpoints | Visual bugs on `/dashboard` or shared UI |
| `app/login/page.tsx` | Sign in / Create account (email + password) | Auth UI, login errors, "Invalid login credentials" |
| `app/auth/callback/route.ts` | OAuth/magic-link callback handler (legacy — app now uses password auth, this is a leftover from the original magic-link flow) | Auth redirect issues (rare now) |
| `app/dashboard/page.tsx` | **Server component.** Looks up the signed-in user's membership → account → outlets. Renders `<Setup/>` if no outlet exists yet, otherwise the real dashboard (stats, menu manager, QR panel, outlet switcher). | "Why does it keep showing Setup even though I have a restaurant" — check this file's membership query and its `console.error` output in the terminal running `npm run dev` |
| `app/dashboard/setup.tsx` | **Client component.** First-run "Name your restaurant" screen. Calls the `create_account_with_outlet` RPC. | Signup/first-account-creation bugs |
| `app/dashboard/add-outlet.tsx` | **Client component.** "+ Add another outlet" — calls the `add_outlet` RPC for accounts that already exist (hotels adding a 2nd/3rd shop). New outlets start with one generic "Menu" category, not the 3 starter categories the first outlet gets. | Adding outlets, or "why doesn't my new outlet have Breakfast/Lunch/Beverages" |
| `app/dashboard/menu-manager.tsx` | **Client component.** Add/edit/delete categories & items, toggle sold-out. Writes directly to `categories`/`items` tables (RLS-gated via `owns_restaurant()`). | Menu editing bugs, item/category CRUD |
| `app/dashboard/qr-panel.tsx` | **Client component.** Generates the downloadable QR code (via the `qrcode` npm package) pointing at `${NEXT_PUBLIC_SITE_URL}/m/{slug}`, and manages promotional banners. | "QR code points to the wrong URL" (check `NEXT_PUBLIC_SITE_URL` in `.env.local`), banner bugs |
| `app/m/[slug]/page.tsx` | **Public page, no auth.** The actual customer-facing menu. Uses an anonymous Supabase client (no session). Revalidates every 10s. | "Site can't be reached" on phone (usually a `localhost` vs LAN-IP problem, see below), menu not showing items/categories, stale data |
| `app/m/[slug]/menu.css` | Styles specific to the public menu (the `.phone`-framed look) | Visual bugs only on the public menu |
| `app/m/[slug]/scan-ping.tsx` | Fires the `record_scan()` RPC on page load to increment the daily scan counter | Scan counts not incrementing |
| `app/m/[slug]/not-found.tsx` | Shown when the slug doesn't match any restaurant | 404 page copy |
| `app/admin/page.tsx` | **Server component.** Platform-admin-only view (gated by the `platform_admins` table). Lists every account and outlet. | Admin dashboard bugs, "how do I see all tenants" |
| `middleware.ts` | Redirects unauthenticated users away from `/dashboard` and `/admin` to `/login` | Auth redirect loops, "why can I/can't I reach a page without logging in" |

### Library (`lib/`)

| File | What it does |
|---|---|
| `lib/supabase-browser.ts` | Creates the Supabase client used in **client components** (`'use client'` files) |
| `lib/supabase-server.ts` | Creates the Supabase client used in **server components**, reads the session from cookies |
| `lib/money.ts` | `toPaise`/`toRupees` (price conversion — prices are stored as integer paise, never floats) and `slugify` (turns a restaurant name into a URL slug) |

### Database (`supabase/schema.sql`)

**This is the single source of truth for the database.** Run the whole file
in Supabase → SQL Editor whenever it changes — it's idempotent
(`create table if not exists`, `drop policy if exists`, `create or replace
function`), safe to re-run in full at any time.

Tables: `accounts`, `memberships`, `platform_admins`, `restaurants`,
`categories`, `items`, `banners`, `scans`.

Key functions:
- `is_member`, `can_manage`, `is_account_owner`, `owns_restaurant`,
  `is_platform_admin` — all `security definer`, used inside RLS policies.
  **Any RLS policy that needs to check membership must go through one of
  these functions, never an inline subquery on `memberships`/`accounts`
  directly** — an inline self-referencing subquery on the same table
  triggers Postgres error `42P17: infinite recursion detected in policy`
  (we hit this once for real; see `memberships_owner_write`).
- `create_account_with_outlet(...)` — the only way a new account+outlet gets
  created (called from `setup.tsx`). Atomic, `security definer`, has an
  idempotency guard (a user who already has an account gets their existing
  outlet back instead of a duplicate).
- `add_outlet(...)` — adds an outlet to an *existing* account (called from
  `add-outlet.tsx`).
- `record_scan(...)` — anonymous-callable, increments the daily scan counter.

### Config

| File | What it does |
|---|---|
| `.env.local` | **Not committed (gitignored).** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`. Editing this requires a full dev-server restart (`Ctrl+C` then `npm run dev`) — Next.js only reads env vars at startup. |
| `.env.local.example` | Template for the above, safe to commit (placeholder values only) |
| `middleware.ts` | See above |
| `next.config.mjs` | Next.js build config |
| `tsconfig.json` | TypeScript config |

## "I have error X, which file do I look at" — quick index

| Symptom | Look at |
|---|---|
| Stuck on "Creating…" forever | `app/dashboard/setup.tsx` (check `finally { setBusy(false) }` is present); check the terminal running `npm run dev` for a Postgres error |
| Dashboard keeps showing "Name your restaurant" even though an account exists | `app/dashboard/page.tsx` membership query + its `console.error` output; also check RLS policies in `supabase/schema.sql` for `42P17` recursion errors |
| Duplicate accounts/restaurants after retries | `create_account_with_outlet` in `supabase/schema.sql` — confirm the idempotency guard (`select ... into existing_rest`) is the deployed version, not an older one |
| `new row violates row-level security policy` | The relevant policy block in `supabase/schema.sql` for that table — check it isn't referencing the same table it's defined on without going through a `security definer` function |
| `infinite recursion detected in policy` (`42P17`) | Same as above — a policy has a raw inline subquery on its own table instead of calling a `security definer` helper |
| Magic-link / OTP email never arrives | Not used anymore — this app uses password auth (`app/login/page.tsx`). If you see OTP code, it's dead code from `app/auth/callback/route.ts` |
| `email rate limit exceeded` | Supabase's shared mailer, unrelated to app code — either wait ~1hr or configure custom SMTP in Supabase dashboard → Authentication → SMTP Settings |
| "Invalid login credentials" for an account you know exists | That account may have been created before password auth existed, or the password differs — check Supabase dashboard → Authentication → Users to reset it |
| QR code / phone shows "site can't be reached" | The QR encodes `NEXT_PUBLIC_SITE_URL`. If that's `localhost`, a phone can't reach it — needs to be your computer's LAN IP (e.g. `192.168.x.x`) for phone testing, and both devices on the same Wi-Fi |
| New outlet missing default categories (Breakfast/Lunch/Beverages) | Expected — `add_outlet` only seeds one "Menu" category by design, only the *first* outlet via `create_account_with_outlet` gets the three defaults |
| `Invalid path specified in request URL` from Supabase | `NEXT_PUBLIC_SUPABASE_URL` in `.env.local` is malformed — should be just `https://<ref>.supabase.co`, no trailing slash, no `/rest/v1` path segment |
| `/admin` redirects you to `/dashboard` | You're not in the `platform_admins` table — grant via SQL Editor: `insert into platform_admins (user_id) values ('<your-uuid>');` (find your uuid via `select id from auth.users where email = '...'`) |
| Menu items/categories not showing on public page | `app/m/[slug]/page.tsx` — check the restaurant's slug is correct, and that categories/items actually exist for that `restaurant_id` |
| Scan counter not incrementing | `app/m/[slug]/scan-ping.tsx` and the `record_scan` function/grant in `supabase/schema.sql` |

## Rules for whoever works on this next

- **Never commit `.env.local`** or paste its values (URL is fine, keys are not) into chat/docs — it's already gitignored.
- **Never use the `service_role` key** anywhere in this app — everything runs through the `anon` key and RLS. If something "needs" `service_role`, that's a sign the RLS policy is wrong, not a reason to add the key.
- **Any new RLS policy that checks membership must call one of the existing `security definer` helper functions** (`is_member`, `can_manage`, `is_account_owner`, `owns_restaurant`, `is_platform_admin`) — never write a raw subquery against `memberships` or `accounts` inline in a policy. See the `42P17` entry above for why.
- **`supabase/schema.sql` is meant to be re-run in full** after any change — keep it idempotent (`if not exists`, `or replace`, `drop ... if exists`) so that's always safe.
