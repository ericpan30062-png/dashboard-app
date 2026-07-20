import { OAuth2Client } from "google-auth-library";
import { prisma } from "@/lib/prisma";

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];
const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

// Assumes the server and the signed-in user share a timezone — this is a
// single-user dev scaffold with no stored user timezone preference. A
// production app would ask the user and store it instead.
const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

const WORKDAY_START_HOUR = 9;
const WORKDAY_END_HOUR = 21;
const MIN_FREE_BLOCK_MINUTES = 20;

export function createOAuth2Client(): OAuth2Client {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Google Calendar isn't configured — set GOOGLE_CALENDAR_CLIENT_ID, " +
        "GOOGLE_CALENDAR_CLIENT_SECRET, and GOOGLE_CALENDAR_REDIRECT_URI.",
    );
  }

  return new OAuth2Client({ clientId, clientSecret, redirectUri });
}

export function getGoogleAuthUrl(state: string): string {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    // Forces Google to always return a refresh_token, not just on first
    // consent — otherwise a reconnect after a revoked/expired grant would
    // silently fail to get one.
    prompt: "consent",
    scope: SCOPES,
    state,
  });
}

export async function exchangeCodeForTokens(code: string) {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);
  return tokens;
}

// Builds an OAuth2Client authenticated with a valid (refreshed if needed)
// access token for this user, using their stored refresh token. Returns
// null if Google Calendar isn't connected.
export async function getAuthenticatedClient(
  userId: string,
): Promise<OAuth2Client | null> {
  const integration = await prisma.integration.findUnique({
    where: { userId_provider: { userId, provider: "GOOGLE_CALENDAR" } },
  });
  if (!integration?.refreshToken) return null;

  const client = createOAuth2Client();
  client.setCredentials({
    refresh_token: integration.refreshToken,
    access_token: integration.accessToken ?? undefined,
  });

  const { token } = await client.getAccessToken();
  if (!token) return null;

  if (token !== integration.accessToken) {
    await prisma.integration.update({
      where: { id: integration.id },
      data: { accessToken: token },
    });
  }

  return client;
}

export type CalendarBusyInterval = { start: Date; end: Date };
export type CalendarEvent = { start: Date; end: Date; summary: string; transparent: boolean };

type GoogleCalendarEvent = {
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  transparency?: string;
  summary?: string;
};

// Shared fetch + parse logic behind listBusyIntervals/listCalendarEvents.
// All-day events (no `dateTime`, only `date`) are treated as spanning the
// entire day — we can't know what portion of it is actually busy.
async function fetchEvents(
  client: OAuth2Client,
  timeMin: Date,
  timeMax: Date,
): Promise<CalendarEvent[]> {
  const { token } = await client.getAccessToken();
  const url = new URL(`${CALENDAR_API_BASE}/calendars/primary/events`);
  url.searchParams.set("timeMin", timeMin.toISOString());
  url.searchParams.set("timeMax", timeMax.toISOString());
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Google Calendar list events failed: ${res.status}`);
  }

  const body = (await res.json()) as { items?: GoogleCalendarEvent[] };
  const events: CalendarEvent[] = [];

  for (const event of body.items ?? []) {
    const transparent = event.transparency === "transparent";
    const summary = event.summary ?? "";

    if (event.start?.dateTime && event.end?.dateTime) {
      events.push({
        start: new Date(event.start.dateTime),
        end: new Date(event.end.dateTime),
        summary,
        transparent,
      });
    } else if (event.start?.date && event.end?.date) {
      events.push({
        start: new Date(`${event.start.date}T00:00:00`),
        end: new Date(`${event.end.date}T00:00:00`),
        summary,
        transparent,
      });
    }
  }

  return events;
}

// Busy time between `timeMin` and `timeMax` on the user's primary calendar
// (excludes events explicitly marked "free"/transparent).
export async function listBusyIntervals(
  client: OAuth2Client,
  timeMin: Date,
  timeMax: Date,
): Promise<CalendarBusyInterval[]> {
  const events = await fetchEvents(client, timeMin, timeMax);
  return events.filter((e) => !e.transparent).map(({ start, end }) => ({ start, end }));
}

// Same events, but with the summary (title) text and transparency included
// — needed to spot specific events (e.g. backward-planning's "Study: X"
// sessions) rather than just knowing a time range is busy.
export async function listCalendarEvents(
  client: OAuth2Client,
  timeMin: Date,
  timeMax: Date,
): Promise<CalendarEvent[]> {
  return fetchEvents(client, timeMin, timeMax);
}

export async function createCalendarEvent(
  client: OAuth2Client,
  event: { summary: string; description?: string; start: Date; end: Date },
): Promise<void> {
  const { token } = await client.getAccessToken();
  const res = await fetch(
    `${CALENDAR_API_BASE}/calendars/primary/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: event.summary,
        description: event.description,
        start: { dateTime: toLocalIso(event.start), timeZone: TIME_ZONE },
        end: { dateTime: toLocalIso(event.end), timeZone: TIME_ZONE },
      }),
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Google Calendar create event failed: ${res.status} ${detail}`);
  }
}

// Formats a Date as a wall-clock ISO string with no "Z"/offset suffix, so it
// pairs correctly with an explicit `timeZone` field on a Calendar API event
// (rather than converting to UTC, which would shift the intended local time
// if the server's clock isn't in the same zone as `TIME_ZONE`).
function toLocalIso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
  );
}

export function dateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function atHour(date: Date, hour: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, 0, 0, 0);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export type FreeBlock = { date: string; start: Date; end: Date };

// Computes free time within a daily work window (09:00-21:00), from `now`
// through the end of `dueDate` (inclusive — you can still study on the due
// date itself), with `busy` intervals subtracted out. Blocks shorter than
// MIN_FREE_BLOCK_MINUTES are dropped as not worth scheduling.
export function computeFreeBlocks(
  busy: CalendarBusyInterval[],
  now: Date,
  dueDate: Date,
): FreeBlock[] {
  const blocks: FreeBlock[] = [];
  const lastDay = startOfDay(dueDate).getTime();
  let cursor = startOfDay(now);

  while (cursor.getTime() <= lastDay) {
    const dayWorkStart = atHour(cursor, WORKDAY_START_HOUR);
    const dayWorkEnd = atHour(cursor, WORKDAY_END_HOUR);
    const windowStart = dayWorkStart < now ? now : dayWorkStart;
    const windowEnd = dayWorkEnd;

    if (windowStart < windowEnd) {
      const dayBusy = busy
        .filter((b) => b.end > windowStart && b.start < windowEnd)
        .map((b) => ({
          start: b.start < windowStart ? windowStart : b.start,
          end: b.end > windowEnd ? windowEnd : b.end,
        }))
        .sort((a, b) => a.start.getTime() - b.start.getTime());

      let pointer = windowStart;
      const minMs = MIN_FREE_BLOCK_MINUTES * 60_000;

      for (const b of dayBusy) {
        if (b.start.getTime() - pointer.getTime() >= minMs) {
          blocks.push({ date: dateKey(cursor), start: pointer, end: b.start });
        }
        if (b.end > pointer) pointer = b.end;
      }
      if (windowEnd.getTime() - pointer.getTime() >= minMs) {
        blocks.push({ date: dateKey(cursor), start: pointer, end: windowEnd });
      }
    }

    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
  }

  return blocks;
}
