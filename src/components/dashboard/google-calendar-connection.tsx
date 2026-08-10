"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, CircleCheck, Loader2 } from "lucide-react";

const STATUS_MESSAGES: Record<string, { tone: "success" | "error"; text: string }> = {
  connected: { tone: "success", text: "Google Calendar connected." },
  denied: { tone: "error", text: "Google Calendar connection was cancelled." },
  invalid_state: {
    tone: "error",
    text: "That connection attempt expired or was invalid — try again.",
  },
  no_refresh_token: {
    tone: "error",
    text: "Google didn't grant lasting access — try connecting again.",
  },
  not_configured: {
    tone: "error",
    text: "Google Calendar isn't configured yet — set up the OAuth client on the Settings page.",
  },
  error: {
    tone: "error",
    text: "Something went wrong connecting Google Calendar.",
  },
};

export function GoogleCalendarConnection({
  connected,
  status,
}: {
  connected: boolean;
  status?: string;
}) {
  const router = useRouter();
  const [disconnecting, setDisconnecting] = useState(false);
  const statusMessage = status ? STATUS_MESSAGES[status] : undefined;

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await fetch("/api/integrations/google-calendar/disconnect", {
        method: "POST",
      });
      router.refresh();
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {statusMessage && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            statusMessage.tone === "success"
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
              : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400"
          }`}
        >
          {statusMessage.text}
        </p>
      )}

      <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-900">
            <Calendar
              className="h-4 w-4 text-zinc-600 dark:text-zinc-400"
              strokeWidth={1.75}
            />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
              Google Calendar
            </p>
            <p className="flex items-center gap-1 text-xs text-zinc-500">
              {connected ? (
                <>
                  <CircleCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  Connected
                </>
              ) : (
                "Not connected"
              )}
            </p>
          </div>
        </div>

        {connected ? (
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="flex items-center gap-2 rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            {disconnecting && <Loader2 className="h-4 w-4 animate-spin" />}
            Disconnect
          </button>
        ) : (
          <a
            href="/api/integrations/google-calendar/connect"
            className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Connect
          </a>
        )}
      </div>
    </div>
  );
}
