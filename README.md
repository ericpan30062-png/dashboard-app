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
- **Syllabus upload** (`/dashboard/syllabus`): PDF → text (Python/FastAPI +
  pdfplumber microservice, `services/pdf-extractor/`) → structured assignment
  extraction (Claude, `claude-opus-4-8`, via `messages.parse` + a Zod schema)
  → user reviews/edits in a table → confirmed rows are saved to the
  `assignments` Postgres table. See `src/app/api/syllabus/*` and
  `src/components/dashboard/syllabus-uploader.tsx`.

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
   - `GOOGLE_CALENDAR_*`, `CANVAS_*`, `NOTION_*` — see `.env.example` for where
     to get each one. None of these three integrations are wired up yet; the
     sidebar pages under `/dashboard` document which env vars each one needs.
   - `ANTHROPIC_API_KEY` — required for the syllabus upload feature (see
     below); get one at [console.anthropic.com](https://console.anthropic.com).
   - `PDF_EXTRACTOR_URL` — where the syllabus upload feature's PDF-extraction
     microservice is running (defaults to `http://localhost:8000`); see step 5.

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

5. **(Syllabus upload only) Run the PDF-extraction microservice**

   ```bash
   cd services/pdf-extractor
   python3 -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   uvicorn main:app --reload --port 8000
   ```

   See `services/pdf-extractor/README.md` for details. `/dashboard/syllabus`
   calls this over HTTP at `PDF_EXTRACTOR_URL`, so it needs to be running
   (and `ANTHROPIC_API_KEY` set) for uploads to work.

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
      syllabus/               upload + review/edit + saved assignments
    api/syllabus/
      extract/route.ts        PDF -> microservice -> Claude -> unsaved assignments JSON
      assignments/route.ts    GET/POST saved assignments (Prisma, linked to the user)
  components/dashboard/       Sidebar, Topbar, MobileNav, nav-items config
                               syllabus-uploader.tsx, saved-assignments.tsx
  lib/
    prisma.ts                 Prisma client singleton (driver adapter)
    clerk-sync.ts             upserts the Clerk user into the local User table
    anthropic.ts               Anthropic SDK client singleton
    syllabus-schema.ts         shared Zod schema (Claude structured output + API validation)
  proxy.ts                    Next.js 16's Middleware equivalent (session refresh only)
prisma/
  schema.prisma               User, Integration, and Assignment models
services/
  pdf-extractor/               FastAPI + pdfplumber microservice (see its own README)
```

## Useful scripts

- `npm run db:studio` — browse the database with Prisma Studio.
- `npm run db:migrate` — create/apply a migration after editing `schema.prisma`.
- `npm run lint` — ESLint.
- `npm run build` — production build.
