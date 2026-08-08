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
- **Office hours nudger** (`/dashboard/office-hours`): the most involved
  feature here, with several supporting pieces built alongside it —
  - *Office hours* are stored per user (course, instructor, day/time,
    location or Zoom link) — add manually, or click "Import from Canvas",
    which fetches each connected course's **syllabus body text** (Canvas has
    no dedicated office-hours API) and asks Claude to extract entries from
    it, the same extraction pattern as syllabus upload.
  - *Study sessions* are now recorded locally (not just written to Google
    Calendar) whenever backward planning commits a plan, so there's
    something to check in on. A "check in" section lets you mark a past
    session **Made progress** or **I'm blocked** (with an optional note).
  - The *stuck detector* (`src/lib/stuck-detector.ts`, pure + unit-tested)
    flags an assignment as stuck if any session was marked blocked, or if a
    scheduled session's end time passed with no check-in at all.
  - For each stuck assignment, "Draft email" matches it to office hours for
    the same course (matched by the `course` field, set once at syllabus
    upload time — see below), finds the **next occurrence that doesn't
    conflict with your calendar** (`src/lib/office-hours-matcher.ts`, scans
    a few weeks ahead), and asks Claude to draft a short professional email
    referencing the specific blocker (or a general one, if none was given)
    and the matched slot.
  - The draft opens in an editable modal (to/subject/body) and sends via
    the **Gmail API** on Send — this reuses the *same* Google OAuth
    connection as Calendar rather than a second connect flow, by adding the
    `gmail.send` scope to it (see the comment in `src/lib/google-calendar.ts`
    and `src/lib/gmail.ts`).
  - Matching an assignment to office hours needs a course label, which
    assignments didn't have before this feature — syllabus upload now asks
    for one course name applied to the whole batch (one syllabus = one
    course), shown as a column in Saved Assignments/Priorities.
- **Pre-exam countdown mode** (Overview page): a daily background job
  (`GET /api/cron/exam-plans`, meant to be hit once a day by an external
  scheduler — see `CRON_SECRET` below) scans every `EXAM`-type assignment,
  and for any that fall within 7 days and don't already have a plan, asks
  Claude for a day-by-day countdown study plan (topics + estimated minutes
  per day), using Canvas module names as topics when the course is linked
  and real Google Calendar free time when connected (a flat 2h/day fallback
  otherwise). The plan is generated once per exam and never regenerated, so
  a student's checked-off topics survive later runs of the job. The
  dashboard overview shows a countdown card per active plan — today's
  topics as a checklist, an overall completion bar, and estimated minutes
  for today — with checkbox toggles persisted via
  `PATCH /api/exam-plans/topics/[id]`. See `src/lib/exam-plan-generator.ts`
  (the Claude call), `src/lib/exam-plan-job.ts` (the scan/idempotency
  logic), `src/app/api/cron/exam-plans/route.ts`, and
  `src/components/dashboard/exam-countdown-widget.tsx`.
- **Procrastination detector**: a second daily background job
  (`GET /api/cron/procrastination-nudge`, meant to run once a day — e.g.
  8am, see `CRON_SECRET` below) flags an assignment as "avoided" once it's
  more than 3 days old, due within the next 10 days, and has no
  `StudySession` rows (i.e. never scheduled via backward planning). For
  each user with at least one avoided assignment, it ranks candidates by
  the same `weight x urgencyMultiplier` score the Priorities page uses
  (`src/lib/grade-impact.ts`), skips any whose most recent nudge landed
  within the last 48 hours (falling through to the next-most-critical
  candidate instead of just giving up), and asks Claude for a short,
  honest, non-shaming 2-3 sentence nudge about the one it picked. The
  nudge is emailed via the Gmail API (same Google OAuth connection as
  Calendar — see `src/lib/gmail.ts`) and logged to `ProcrastinationNudge`
  so the 48h cooldown has something to check against. Users without Google
  connected are skipped (no other send channel is wired up), as are users
  who muted it via the toggle on the Settings page
  (`User.procrastinationNudgesEnabled`, see
  `src/components/dashboard/notification-settings.tsx`). See
  `src/lib/procrastination-detector.ts` (pure flagging logic),
  `src/lib/procrastination-nudge.ts` (the Claude call),
  `src/lib/procrastination-nudge-job.ts` (per-user orchestration + cooldown
  + send), and `src/app/api/cron/procrastination-nudge/route.ts`.

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
   - Anthropic needs no env var — each user connects their own API key on
     the Settings page (see
     `src/components/dashboard/anthropic-connection.tsx` and
     `src/lib/anthropic.ts`), the same per-user pattern as Canvas below, so
     nobody spends the app owner's credits. Get a key at
     [console.anthropic.com](https://console.anthropic.com). The
     PDF-extraction microservice (step 5) never talks to Anthropic itself —
     it only extracts raw text, which the Next.js app then sends to Claude.
   - `PDF_EXTRACTOR_URL` — where the syllabus upload feature's PDF-extraction
     microservice is running (defaults to `http://localhost:8000`); see step 5.
   - `GOOGLE_CALENDAR_CLIENT_ID` / `GOOGLE_CALENDAR_CLIENT_SECRET` /
     `GOOGLE_CALENDAR_REDIRECT_URI` — required for the Calendar page,
     backward planning, and (via the same connection's `gmail.send` scope —
     see `src/lib/google-calendar.ts`) the office hours nudger's "Send"
     button. In the
     [Google Cloud Console](https://console.cloud.google.com/apis/credentials):
     1. Create a project (or use an existing one) and enable the
        **Google Calendar API** and the **Gmail API**.
     2. Configure the OAuth consent screen (External is fine for testing;
        add your Google account as a test user while the app is unpublished).
     3. Create an **OAuth client ID** of type "Web application".
     4. Add `http://localhost:3000/api/integrations/google-calendar/callback`
        as an authorized redirect URI (must exactly match
        `GOOGLE_CALENDAR_REDIRECT_URI`).
     5. Copy the client ID and secret into `.env`.
   - `CRON_SECRET` — shared by both daily jobs: pre-exam countdown mode
     (`GET /api/cron/exam-plans`) and the procrastination detector
     (`GET /api/cron/procrastination-nudge`). Any random string works for
     local dev (e.g. `openssl rand -hex 24`); trigger either manually with
     `curl "http://localhost:3000/api/cron/<job>?secret=<CRON_SECRET>"`
     or point a scheduler (Vercel Cron, launchd, GitHub Actions) at them
     with `Authorization: Bearer <CRON_SECRET>`.

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
   (and your Anthropic API key connected on the Settings page) for uploads
   to work.

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
      settings/               account info, integrations, semester start date, notification toggles
      priorities/             grade impact priority view (toggle: impact/due date)
      crunch/                 30-day load heat map + Claude danger-window analysis
      office-hours/           office hours CRUD + Canvas import + stuck check-ins + nudge
      syllabus/               upload + review/edit + saved assignments
    api/
      cron/
        exam-plans/route.ts    daily job entrypoint, shared-secret auth (see runExamPlanCheck)
        procrastination-nudge/route.ts  daily job entrypoint (see runProcrastinationNudgeCheck)
      exam-plans/
        topics/[id]/route.ts  PATCH toggles a topic's completed flag, returns recomputed coverage
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
        anthropic/
          connect/route.ts    verifies the API key (models.list), stores on Integration
          disconnect/route.ts deletes the stored Integration row
      planning/
        generate/route.ts     assignment + hours estimate -> free/busy from Calendar -> Claude plan (review only)
        commit/route.ts       confirmed sessions -> creates Google Calendar events + local StudySession rows
      overwhelmed/
        relief/route.ts       assignments + today's free time + exam countdowns -> Claude -> single focus task
      study-sizer/
        estimate/route.ts     assignment (+ Canvas module topics if linked) -> Claude -> hours breakdown (review only)
        save/route.ts         persists the user-adjusted total to Assignment.estimatedHours
      study-sessions/
        [id]/status/route.ts  mark a study session PROGRESS_MADE or BLOCKED (+ optional note)
      office-hours/
        route.ts              GET list / POST create
        [id]/route.ts         DELETE
        import-canvas/route.ts  per connected course: syllabus text -> Claude -> office hours entries
      nudge/
        draft/route.ts        stuck check -> matched office-hours slot (calendar-conflict-checked) -> Claude draft
        send/route.ts         sends the (possibly edited) draft via Gmail
      settings/
        semester-start-date/route.ts  persists User.semesterStartDate
        notifications/route.ts        persists User.procrastinationNudgesEnabled
  components/dashboard/       Sidebar, Topbar, MobileNav, nav-items config
                               syllabus-uploader.tsx, saved-assignments.tsx, priority-view.tsx
                               google-calendar-connection.tsx, study-plan-modal.tsx, crunch-heatmap.tsx
                               overwhelmed-button.tsx, canvas-connection.tsx, study-sizer-modal.tsx,
                               anthropic-connection.tsx
                               semester-start-date.tsx, office-hours-table.tsx,
                               study-session-checkins.tsx, stuck-assignments.tsx, nudge-email-modal.tsx,
                               exam-countdown-widget.tsx, notification-settings.tsx
  lib/
    prisma.ts                 Prisma client singleton (driver adapter)
    clerk-sync.ts             upserts the Clerk user into the local User table
    anthropic.ts               per-user Anthropic client (getAnthropicClientForUser) + key verification
    syllabus-schema.ts         shared Zod schema (Claude structured output + API validation)
    grade-impact.ts            due-date parsing + impact-score math (pure, unit-tested)
    priority-summary.ts        Claude call for the priorities "focus this week" summary
    google-calendar.ts          OAuth2Client, Calendar REST calls, free-block math (pure)
    study-plan.ts               Claude call for the study plan + deterministic time-slot assignment
    crunch-predictor.ts         30-day load-score math + heat map color scale (pure, unit-tested)
    crunch-summary.ts           Claude call for the danger-window analysis
    overwhelm-relief.ts         Claude call for the "I'm overwhelmed" single-focus-task plan
    canvas.ts                   per-user Canvas credentials, course list, module topics, syllabus text
    study-sizer.ts               Claude call for the study-hours breakdown estimate
    office-hours-extractor.ts    Claude call extracting office hours from a Canvas syllabus
    stuck-detector.ts             pure isAssignmentStuck() logic (unit-tested)
    office-hours-matcher.ts       pure next-occurrence + calendar-conflict scan (unit-tested)
    nudge-email.ts                Claude call drafting the office-hours nudge email
    gmail.ts                      sends a message via the Gmail API (shares the Calendar OAuth client)
    exam-plan-generator.ts        Claude call for the day-by-day countdown study plan
    exam-plan-job.ts               daily scan of EXAM assignments, idempotent per assignment
    procrastination-detector.ts    pure "avoided assignment" flagging logic
    procrastination-nudge.ts       Claude call for the short honest nudge message
    procrastination-nudge-job.ts   per-user scan, cooldown filtering, email send + logging
  proxy.ts                    Next.js 16's Middleware equivalent (session refresh only)
prisma/
  schema.prisma               User, Integration, Assignment, OfficeHours, StudySession, ExamPlan, and ProcrastinationNudge models
services/
  pdf-extractor/               FastAPI + pdfplumber microservice (see its own README)
scripts/
  trigger-cron.sh              curls one /api/cron/<job> endpoint using CRON_SECRET from .env
  install-launchd-cron.sh      installs + loads both daily launchd agents (see "Local scheduling")
  uninstall-launchd-cron.sh    unloads + removes them
  launchd/*.plist               source-of-truth plists copied into ~/Library/LaunchAgents
```

## Useful scripts

- `npm run db:studio` — browse the database with Prisma Studio.
- `npm run db:migrate` — create/apply a migration after editing `schema.prisma`.
- `npm run lint` — ESLint.
- `npm run build` — production build.

## Local scheduling (launchd)

Neither this project nor its GitHub repo is deployed anywhere — there's no
Vercel project, no CI, nothing hosting a publicly reachable copy of the app.
So the two daily cron endpoints (`/api/cron/exam-plans`,
`/api/cron/procrastination-nudge`) need something local to actually trigger
them; nothing calls them on its own otherwise.

`scripts/install-launchd-cron.sh` installs two per-user launchd agents (the
macOS equivalent of cron) that curl both endpoints against
`http://localhost:3000` at 8am daily, authenticating with `CRON_SECRET` from
`.env`:

```bash
./scripts/install-launchd-cron.sh    # installs + loads both agents
launchctl list | grep dashboard-app  # confirm they're registered
./scripts/uninstall-launchd-cron.sh  # unloads + removes both
```

Caveats:

- These only fire something if `npm run dev` (or a production `next start`)
  is actually running on port 3000 at 8am — a laptop that's asleep, or a dev
  server that isn't up, means a silent no-op that day, not a retry.
- Logs (including no-op / connection-failure cases, which exit `0` rather
  than erroring so a closed dev server doesn't show up as a launchd
  failure) land in `~/Library/Logs/dashboard-app-cron/<job>.log`.
- The install script is idempotent — re-running it after editing
  `scripts/launchd/*.plist` reloads the updated version.
- If this app is ever deployed (Vercel, etc.), the native equivalent would
  be Vercel Cron (a `crons` array in a `vercel.json` this repo doesn't have
  yet). The `CRON_SECRET` check in each `src/app/api/cron/*/route.ts`
  already matches how Vercel Cron authenticates (`Authorization: Bearer
  <CRON_SECRET>`), so no route code would need to change — only a
  `vercel.json` would need adding at that point.
