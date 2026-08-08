import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateUser } from "@/lib/clerk-sync";
import { AssistantView } from "@/components/dashboard/assistant-view";

export default async function AssistantPage() {
  await auth.protect();
  const user = await getOrCreateUser();
  const anthropicConnected = Boolean(
    user?.integrations.some((i) => i.provider === "ANTHROPIC" && i.connectedAt),
  );

  const header = (
    <div>
      <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        AI Assistant
      </h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Ask a question and get an answer grounded in your assignments, and —
        if connected — your calendar, Canvas courses, and Notion notes.
      </p>
    </div>
  );

  if (!anthropicConnected) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        {header}
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950">
          Connect your Anthropic API key to use the assistant.{" "}
          <Link
            href="/dashboard/settings"
            className="font-medium text-zinc-950 underline dark:text-zinc-50"
          >
            Go to Settings
          </Link>
        </p>
      </div>
    );
  }

  const connectedLabels = [
    "Assignments",
    user?.integrations.some((i) => i.provider === "GOOGLE_CALENDAR" && i.connectedAt)
      ? "Calendar"
      : null,
    user?.integrations.some((i) => i.provider === "CANVAS" && i.connectedAt)
      ? "Canvas"
      : null,
    user?.integrations.some((i) => i.provider === "NOTION" && i.connectedAt)
      ? "Notes"
      : null,
  ].filter((label): label is string => Boolean(label));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      {header}
      <p className="text-xs text-zinc-500">
        Answering from: {connectedLabels.join(", ")}
        {connectedLabels.length < 4 &&
          " — connect Calendar, Canvas, or Notion on their pages for broader answers."}
      </p>
      <AssistantView />
    </div>
  );
}
