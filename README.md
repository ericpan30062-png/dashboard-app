A Next.js dashboard scaffold with Postgres/Prisma, Clerk authentication,
Google Calendar and Canvas LMS integration, Claude-powered syllabus parsing,
study planning, and workload tools, and a placeholder for Notion.

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
- **Grade impact priorities** (`/dashboard/priorities`): ranks upcoming
  assignments by `weight x urgency multiplier` and asks Claude for a
  2-sentence "focus this week" summary. See `src/lib/grade-impact.ts` and
  `src/lib/priority-summary.ts`.
- **Google Calendar** (`/dashboard/calendar`): OAuth connect flow
  (`google-auth-library`, tokens stored on the `Integration` table) so the
  app can read your events and create new ones. See `src/lib/google-calendar.ts`
  and `src/app/api/integrations/google-calendar/*`.
- **Backward planning**: click any assignment to open "Plan my time" — enter
  a time estimate, and it fetches your free time from Google Calendar between
  now and the due date, asks Claude for a day-by-day study plan, and (after
  you review and confirm) writes each session to your calendar as an event.
  See `src/lib/study-plan.ts`, `src/app/api/planning/*`, and
  `src/components/dashboard/study-plan-modal.tsx`.
- **Crunch predictor** (`/dashboard/crunch`): a 30-day heat map of how loaded
  each day looks — combining grade weight of assignments due within 3 days,
  calendar event count, and estimated study hours into one score per day —
  plus Claude picks out the top 2-3 "danger windows" and what to start early.
  Study hours use the real per-assignment estimate when the study session
  sizer has set one, falling back to a heuristic by assignment type
  otherwise (see `src/lib/crunch-predictor.ts`). See also
  `src/lib/crunch-summary.ts` and `src/components/dashboard/crunch-heatmap.tsx`.
- **"I'm overwhelmed" button** (dashboard Overview page): one click sends
  your incomplete assignments, today's remaining free time, and any exam
  study sessions already on the calendar to Claude, which picks the single
  most important thing to do for the next ~90 minutes (a specific task, not
  a vague category) plus two sentences of honest encouragement. Shown as a
  full-screen takeover that hides the rest of the dashboard until you're
  ready to go back. "Incomplete" means "upcoming" (assignments don't have a
  completed flag yet). See `src/lib/overwhelm-relief.ts`,
  `src/app/api/overwhelmed/relief/route.ts`, and
  `src/components/dashboard/overwhelmed-button.tsx`.
- **Canvas LMS** (`/dashboard/courses`): per-user connection — each user
  pastes their own Canvas URL + personal access token (Account → Settings →
  New Access Token in Canvas), verified and stored on the `Integration`
  table, no global env vars. See `src/lib/canvas.ts` and
  `src/app/api/integrations/canvas/*`.
- **Study session sizer**: click the ruler icon next to any assignment to
  estimate how long it'll take. If Canvas is connected, pick which course
  it's for (saved for next time) and its module names are sent as topics;
  either way, the assignment's name/type/grade weight plus weeks since your
  semester started (set on the Settings page, optional) go to Claude for a
  total-hours estimate with a per-topic breakdown and a confidence
  level + reasoning. Adjust individual topic hours in the expandable
  breakdown (recomputes the total) before saving it to the assignment. See
  `src/lib/study-sizer.ts`, `src/app/api/study-sizer/*`, and
  `src/components/dashboard/study-sizer-modal.tsx`.

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
   - `NOTION_*` — see `.env.example` for where to get each one. Not wired up
     yet; the Notes page documents which env vars it needs.
   - Canvas needs no env vars — each user connects their own Canvas URL +
     personal access token from the Courses page in the dashboard, once
     signed in (see the feature list above).
   - `ANTHROPIC_API_KEY` — required for the syllabus upload and backward
     planning features; get one at
     [console.anthropic.com](https://console.anthropic.com).
   - `PDF_EXTRACTOR_URL` — where the syllabus upload feature's PDF-extraction
     microservice is running (defaults to `http://localhost:8000`); see step 5.
   - `GOOGLE_CALENDAR_CLIENT_ID` / `GOOGLE_CALENDAR_CLIENT_SECRET` /
     `GOOGLE_CALENDAR_REDIRECT_URI` — required for the Calendar page and
     backward planning. In the
     [Google Cloud Console](https://console.cloud.google.com/apis/credentials):
     1. Create a project (or use an existing one) and enable the
        **Google Calendar API**.
     2. Configure the OAuth consent screen (External is fine for testing;
        add your Google account as a test user while the app is unpublished).
     3. Create an **OAuth client ID** of type "Web application".
     4. Add `http://localhost:3000/api/integrations/google-calendar/callback`
        as an authorized redirect URI (must exactly match
        `GOOGLE_CALENDAR_REDIRECT_URI`).
     5. Copy the client ID and secret into `.env`.

3. **Set up the database**

   This machine has a local Postgres 17 server (installed via Postgres.app's
   portable binaries, no Homebrew/system install needed) running as the
   current user, data directory at `~/.local/share/postgres-data`, database
   `dashboard_app`. `DATABASE_URL` in `.env` already points at it.

   ```bash
   # Start/stop the local Postgres server:
   pg_ctl -D ~/.local/share/postgres-data -l ~/.local/share/postgres-data/server.log start
   pg_ctl -D ~/.local/share/postgres-data stop

   # Apply the schema:
   npm run db:migrate   # creates prisma/migrations and applies them
   ```

   This also runs `prisma generate` (via the `postinstall` script) to produce
   the typed client in `src/generated/prisma` (git-ignored). If you'd rather
   point at a different Postgres instance, just change `DATABASE_URL`.

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
      notes/ assistant/
      calendar/               Google Calendar connect/disconnect status
      courses/                Canvas connect form (URL + personal access token)
      settings/               account info, integrations, semester start date
      priorities/             grade impact priority view (toggle: impact/due date)
      crunch/                 30-day load heat map + Claude danger-window analysis
      syllabus/               upload + review/edit + saved assignments
    api/
      syllabus/
        extract/route.ts      PDF -> microservice -> Claude -> unsaved assignments JSON
        assignments/route.ts  GET/POST saved assignments (Prisma, linked to the user)
      integrations/
        google-calendar/
          connect/, callback/ OAuth flow (state cookie for CSRF, stores tokens on Integration)
          disconnect/route.ts deletes the stored Integration row
        canvas/
          connect/route.ts    verifies URL+token, stores on Integration
          disconnect/route.ts deletes the stored Integration row
          courses/route.ts    lists the user's Canvas courses (for the sizer's course picker)
      planning/
        generate/route.ts     assignment + hours estimate -> free/busy from Calendar -> Claude plan (review only)
        commit/route.ts       confirmed sessions -> creates Google Calendar events
      overwhelmed/
        relief/route.ts       assignments + today's free time + exam countdowns -> Claude -> single focus task
      study-sizer/
        estimate/route.ts     assignment (+ Canvas module topics if linked) -> Claude -> hours breakdown (review only)
        save/route.ts         persists the user-adjusted total to Assignment.estimatedHours
      settings/
        semester-start-date/route.ts  persists User.semesterStartDate
  components/dashboard/       Sidebar, Topbar, MobileNav, nav-items config
                               syllabus-uploader.tsx, saved-assignments.tsx, priority-view.tsx
                               google-calendar-connection.tsx, study-plan-modal.tsx, crunch-heatmap.tsx
                               overwhelmed-button.tsx, canvas-connection.tsx, study-sizer-modal.tsx
                               semester-start-date.tsx
  lib/
    prisma.ts                 Prisma client singleton (driver adapter)
    clerk-sync.ts             upserts the Clerk user into the local User table
    anthropic.ts               Anthropic SDK client singleton
    syllabus-schema.ts         shared Zod schema (Claude structured output + API validation)
    grade-impact.ts            due-date parsing + impact-score math (pure, unit-tested)
    priority-summary.ts        Claude call for the priorities "focus this week" summary
    google-calendar.ts          OAuth2Client, Calendar REST calls, free-block math (pure)
    study-plan.ts               Claude call for the study plan + deterministic time-slot assignment
    crunch-predictor.ts         30-day load-score math + heat map color scale (pure, unit-tested)
    crunch-summary.ts           Claude call for the danger-window analysis
    overwhelm-relief.ts         Claude call for the "I'm overwhelmed" single-focus-task plan
    canvas.ts                   per-user Canvas credentials, course list, module-topic list
    study-sizer.ts               Claude call for the study-hours breakdown estimate
  proxy.ts                    Next.js 16's Middleware equivalent (session refresh only)
prisma/
  schema.prisma               User, Integration, and Assignment models (estimatedHours,
                               canvasCourseId, semesterStartDate added for the sizer)
services/
  pdf-extractor/               FastAPI + pdfplumber microservice (see its own README)
```

## Useful scripts

- `npm run db:studio` — browse the database with Prisma Studio.
- `npm run db:migrate` — create/apply a migration after editing `schema.prisma`.
- `npm run lint` — ESLint.
- `npm run build` — production build.
