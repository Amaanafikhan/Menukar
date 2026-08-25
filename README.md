# Menukar

Live QR menus for small restaurants. The owner edits from a phone; the diner
scans a printed code and sees the current menu, including what has just sold out.

**Stack:** Next.js 14 (App Router) · Supabase (Postgres, Auth, RLS) · TypeScript · Vercel

---

## Run it

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com) — the free tier is enough.
2. Open **SQL Editor → New query**, paste all of `supabase/schema.sql`, and run it.
3. Go to **Project Settings → API** and copy the *Project URL* and the *anon public* key.

### 2. Local

```bash
npm install
cp .env.local.example .env.local   # then paste your two keys in
npm run dev
```

Open http://localhost:3000, sign in with your email, and the setup screen
creates your restaurant with three starter sections.

> Magic-link emails: Supabase's built-in sender is rate-limited to a few per hour.
> That is fine for development. Add an SMTP provider under **Authentication →
> Emails** before real customers use it.

### 3. Deploy

Push to GitHub, import the repo on [Vercel](https://vercel.com), and add three
environment variables:

| Key | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | your project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon key |
| `NEXT_PUBLIC_SITE_URL` | your deployed URL, e.g. `https://menukar.vercel.app` |

Then in Supabase → **Authentication → URL Configuration**, add
`https://your-app.vercel.app/auth/callback` to the redirect allow-list.
Magic links fail silently if you skip this.

---

## Routes

| Route | What it is |
|---|---|
| `/` | Landing page |
| `/login` | Passwordless sign-in |
| `/dashboard` | Owner: menu, sold-out toggles, QR, banners |
| `/m/[slug]` | Public menu — the page behind the QR code |

---

## Decisions worth explaining

**Web, not a native app.** A diner will not install an app to read a menu.
Any friction between scanning and reading kills the product, so the customer
surface has to be a URL. The owner dashboard is responsive rather than native
for the same reason plus one more: one codebase, and fixes ship instantly
instead of waiting on app store review.

**Authorization lives in the database, not the app.** Every table has Row Level
Security enabled. Writes are gated on `owns_restaurant(restaurant_id)`, which
checks ownership against `auth.uid()` in Postgres. The most common way a small
multi-tenant SaaS leaks data is an endpoint that trusts a client-supplied ID;
putting the check in the database means a forgotten check in application code
cannot expose another restaurant's menu.

**Prices are integer paise.** `price_paise int`, never a float. Floating-point
currency produces rounding errors that show up as ₹89.99 where ₹90 was entered.

**The scan counter is a `security definer` function.** Anonymous visitors need to
increment a number they are not allowed to read or edit. `record_scan()` runs
with elevated rights and does exactly one thing, so the `scans` table needs no
public write policy.

**The public menu revalidates every 10 seconds.** It is served from cache, so it
loads fast on poor restaurant wifi, but an owner marking a dish sold out sees it
reflected almost immediately. Rendering it per-request would be correct and slow;
caching it for an hour would be fast and wrong.

**Constraints are in the schema.** Name lengths, price ceiling, and a slug
pattern are `CHECK` constraints rather than only client-side validation, because
client-side validation is a user-experience feature, not a security control.

---

## Deliberately not built yet

Table-side ordering, payments, image uploads, multi-outlet, staff accounts,
analytics charts. Each is a reasonable next feature and each is a reason a first
version never ships. They go in when a paying restaurant asks for them.

## Known limits

- Supabase's free tier pauses a project after 7 days with no database activity.
- No automated backups on the free tier — enable Pro, or schedule `pg_dump`,
  before real customer data is in here.
- Categories and items are ordered by a `position` column, but drag-to-reorder
  is not wired up in the UI yet.
