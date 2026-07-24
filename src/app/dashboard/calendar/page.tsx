import { auth } from "@clerk/nextjs/server";
import { getOrCreateUser } from "@/lib/clerk-sync";
import { GoogleCalendarConnection } from "@/components/dashboard/google-calendar-connection";

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

      <GoogleCalendarConnection
        connected={Boolean(integration?.connectedAt)}
        status={status}
      />
    </div>
  );
}
