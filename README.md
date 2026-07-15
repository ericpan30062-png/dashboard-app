A Next.js dashboard scaffold with Postgres/Prisma, Clerk authentication, and
placeholders for Google Calendar, Canvas LMS, Anthropic, and Notion.

## Stack

- **Next.js 16** (App Router, Turbopack). Note: this version renamed
  `middleware.ts` to `proxy.ts` — see `src/proxy.ts`.
- **Prisma 7** with the `prisma-client` generator and the `@prisma/adapter-pg`
  driver adapter (this version needs an explicit adapter, not just a
  `DATABASE_URL` in the schema) — see `src/lib/prisma.ts`.
- **Clerk** for auth, with resource-based protection (`auth.protect()` in each
  page) rather than Middleware path-matching — see `src/app/dashboard/*/page.tsx`
  and the note in `src/proxy.ts`.
- **Tailwind CSS v4**.

## Getting started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment variables**

   Copy `.env.example` to `.env` (already done for local dev with empty
   placeholders) and fill in real values:

   - `DATABASE_URL` — a Postgres connection string.
   - Clerk keys — create an app at [dashboard.clerk.com](https://dashboard.clerk.com)
     and copy `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY`. If you
     leave these blank, Clerk falls back to a "keyless" dev mode and prints a
     claim link in the terminal the first time you run `next dev`.
   - `GOOGLE_CALENDAR_*`, `CANVAS_*`, `ANTHROPIC_API_KEY`, `NOTION_*` — see
     `.env.example` for where to get each one. None of the integrations are
     wired up yet; the sidebar pages under `/dashboard` document which env
     vars each one needs.

3. **Set up the database**

   ```bash
   npm run db:migrate   # creates prisma/migrations and applies them
   ```

   This also runs `prisma generate` (via the `postinstall` script) to produce
   the typed client in `src/generated/prisma` (git-ignored).

4. **Run the dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Project structure

```
src/
  app/
    page.tsx                 landing page (redirects signed-in users to /dashboard)
    sign-in/, sign-up/       Clerk's prebuilt <SignIn>/<SignUp>
    dashboard/
      layout.tsx             sidebar + topbar shell
      page.tsx                overview
      calendar/ courses/ notes/ assistant/ settings/
  components/dashboard/       Sidebar, Topbar, MobileNav, nav-items config
  lib/
    prisma.ts                 Prisma client singleton (driver adapter)
    clerk-sync.ts             upserts the Clerk user into the local User table
  proxy.ts                    Next.js 16's Middleware equivalent (session refresh only)
prisma/
  schema.prisma               User + Integration models
```

## Useful scripts

- `npm run db:studio` — browse the database with Prisma Studio.
- `npm run db:migrate` — create/apply a migration after editing `schema.prisma`.
- `npm run lint` — ESLint.
- `npm run build` — production build.
