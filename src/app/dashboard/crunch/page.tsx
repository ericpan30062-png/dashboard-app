import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/clerk-sync";
import {
  getAuthenticatedClient,
  listBusyIntervals,
  disconnectStaleIntegration,
  GoogleCalendarAuthError,
} from "@/lib/google-calendar";
import {
  getCanvasCredentials,
  listCanvasCourses,
  listAllCanvasAssignments,
  type CanvasAssignment,
} from "@/lib/canvas";
import { computeDailyLoads } from "@/lib/crunch-predictor";
import { getCrunchAnalysis } from "@/lib/crunch-summary";
import { getAnthropicClientForUser } from "@/lib/anthropic";
import { CrunchHeatmap } from "@/components/dashboard/crunch-heatmap";
import { UpcomingHomework } from "@/components/dashboard/upcoming-homework";

const HORIZON_DAYS = 30;

export default async function CrunchPage() {
  await auth.protect();
  const user = await getOrCreateUser();

  const assignments = user
    ? await prisma.assignment.findMany({ where: { userId: user.id } })
    : [];

  const client = user ? await getAuthenticatedClient(user.id) : null;

  const now = new Date();
  const horizon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + HORIZON_DAYS);

  // Canvas homework is independent of the Google Calendar connection, so
  // it's fetched — and shown — regardless of which branch below returns.
  let homework: CanvasAssignment[] | null = null;
  let homeworkError: string | null = null;
  if (user) {
    const canvasCreds = await getCanvasCredentials(user.id);
    if (canvasCreds) {
      try {
        const courses = await listCanvasCourses(canvasCreds);
        const allAssignments = await listAllCanvasAssignments(canvasCreds, courses);
        homework = allAssignments
          .filter((a) => a.dueAt && new Date(a.dueAt) >= now && new Date(a.dueAt) <= horizon)
          .sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime());
      } catch (error) {
        console.error("Crunch predictor: Canvas homework fetch failed:", error);
        homeworkError = "Couldn't load homework from Canvas — try again in a bit.";
      }
    }
  }
  const homeworkSection = <UpcomingHomework homework={homework} error={homeworkError} />;

  const header = (
    <div>
      <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        Crunch predictor
      </h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        A 30-day forecast of how loaded each day looks, based on assignments
        due soon, your calendar, and estimated study time.
      </p>
    </div>
  );

  const connectPrompt = (message: string) => (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      {header}
      <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950">
        {message}{" "}
        <Link
          href="/dashboard/calendar"
          className="font-medium text-zinc-950 underline dark:text-zinc-50"
        >
          Go to Calendar settings
        </Link>
      </p>
      {homeworkSection}
    </div>
  );

  if (!client) {
    return connectPrompt(
      "Connect Google Calendar to see your crunch forecast — it factors in your actual schedule, not just assignment due dates.",
    );
  }

  let busy;
  try {
    busy = await listBusyIntervals(client, now, horizon);
  } catch (error) {
    if (error instanceof GoogleCalendarAuthError) {
      if (user) await disconnectStaleIntegration(user.id);
      return connectPrompt(
        "Your Google Calendar connection expired — reconnect to see your crunch forecast.",
      );
    }
    console.error("Crunch predictor: listBusyIntervals failed:", error);
    return connectPrompt(
      "Couldn't read your Google Calendar events — try again in a bit, or reconnect if this keeps happening.",
    );
  }

  const dailyLoads = computeDailyLoads(assignments, busy, now);
  const anthropicClient = user ? await getAnthropicClientForUser(user.id) : null;
  const dangerWindows = anthropicClient
    ? await getCrunchAnalysis(anthropicClient, dailyLoads)
    : null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      {header}
      <CrunchHeatmap days={dailyLoads} dangerWindows={dangerWindows} />
      {homeworkSection}
    </div>
  );
}
