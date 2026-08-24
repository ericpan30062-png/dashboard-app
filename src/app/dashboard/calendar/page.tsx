import { auth } from "@clerk/nextjs/server";
import { getOrCreateUser } from "@/lib/clerk-sync";
import { GoogleCalendarConnection } from "@/components/dashboard/google-calendar-connection";
import {
  getAuthenticatedClient,
  listCalendarEvents,
  disconnectStaleIntegration,
  GoogleCalendarAuthError,
  type CalendarEvent,
} from "@/lib/google-calendar";

const UPCOMING_WINDOW_DAYS = 14;

function isAllDayEvent(event: CalendarEvent): boolean {
  const isMidnight = (d: Date) => d.getHours() === 0 && d.getMinutes() === 0;
  return isMidnight(event.start) && isMidnight(event.end);
}

function formatEventTime(event: CalendarEvent): string {
  if (isAllDayEvent(event)) return "All day";
  const fmt = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${fmt(event.start)} – ${fmt(event.end)}`;
}

function dayHeading(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function groupByDay(events: CalendarEvent[]): { heading: string; events: CalendarEvent[] }[] {
  const groups: { heading: string; events: CalendarEvent[] }[] = [];
  for (const event of events) {
    const heading = dayHeading(event.start);
    const last = groups[groups.length - 1];
    if (last && last.heading === heading) {
      last.events.push(event);
    } else {
      groups.push({ heading, events: [event] });
    }
  }
  return groups;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await auth.protect();
  const user = await getOrCreateUser();
  const integration = user?.integrations.find(
    (i) => i.provider === "GOOGLE_CALENDAR",
  );
  const { status } = await searchParams;

  let connected = Boolean(integration?.connectedAt);
  let events: CalendarEvent[] = [];
  let eventsError: string | null = null;

  if (connected && user) {
    const client = await getAuthenticatedClient(user.id);
    if (client) {
      const now = new Date();
      const horizon = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + UPCOMING_WINDOW_DAYS,
      );
      try {
        events = await listCalendarEvents(client, now, horizon);
      } catch (error) {
        if (error instanceof GoogleCalendarAuthError) {
          await disconnectStaleIntegration(user.id);
          connected = false;
        } else {
          console.error("Calendar page: listCalendarEvents failed:", error);
          eventsError = "Couldn't load your upcoming events — try again in a bit.";
        }
      }
    }
  }

  const groups = groupByDay(events);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          Google Calendar &amp; Gmail
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          One connection covers two things: backward planning (click any
          assignment to open &ldquo;Plan my time&rdquo;) reads your calendar
          and adds study sessions, and the office hours nudger sends emails
          on your behalf via Gmail when you confirm a draft.
        </p>
      </div>

      <GoogleCalendarConnection connected={connected} status={status} />

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
          Upcoming events
        </h3>
        {!connected ? (
          <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950">
            Connect Google Calendar above to see what&apos;s coming up,
            including your classes.
          </p>
        ) : eventsError ? (
          <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950">
            {eventsError}
          </p>
        ) : groups.length > 0 ? (
          <div className="flex flex-col gap-4">
            {groups.map((group) => (
              <div key={group.heading}>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {group.heading}
                </p>
                <ul className="flex flex-col gap-1.5">
                  {group.events.map((event, i) => (
                    <li
                      key={i}
                      className="flex items-baseline gap-3 rounded-xl border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                    >
                      <span className="w-32 shrink-0 text-xs text-zinc-500">
                        {formatEventTime(event)}
                      </span>
                      <span className="font-medium text-zinc-950 dark:text-zinc-50">
                        {event.summary || "(untitled event)"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950">
            Nothing on your calendar in the next {UPCOMING_WINDOW_DAYS} days.
          </p>
        )}
      </div>
    </div>
  );
}
