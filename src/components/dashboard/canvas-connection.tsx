"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, CircleCheck, Loader2 } from "lucide-react";

export function CanvasConnection({ connected }: { connected: boolean }) {
  const router = useRouter();
  const [baseUrl, setBaseUrl] = useState("");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "disconnecting">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    setStatus("saving");
    setError(null);
    try {
      const res = await fetch("/api/integrations/canvas/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl, token }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Failed to connect Canvas");
        setStatus("idle");
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong");
      setStatus("idle");
    }
  }

  async function handleDisconnect() {
    setStatus("disconnecting");
    try {
      await fetch("/api/integrations/canvas/disconnect", { method: "POST" });
      router.refresh();
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-900">
            <GraduationCap
              className="h-4 w-4 text-zinc-600 dark:text-zinc-400"
              strokeWidth={1.75}
            />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
              Canvas LMS
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

        {connected && (
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={status === "disconnecting"}
            className="flex items-center gap-2 rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            {status === "disconnecting" && <Loader2 className="h-4 w-4 animate-spin" />}
            Disconnect
          </button>
        )}
      </div>

      {!connected && (
        <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Generate a personal access token in Canvas under{" "}
            <span className="font-medium">Account → Settings → New Access Token</span>,
            then paste your school&apos;s Canvas URL and the token here.
          </p>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              Canvas URL
            </span>
            <input
              type="text"
              placeholder="https://yourschool.instructure.com"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="rounded-md border border-zinc-200 bg-transparent px-3 py-1.5 dark:border-zinc-800"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              Access token
            </span>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="rounded-md border border-zinc-200 bg-transparent px-3 py-1.5 dark:border-zinc-800"
            />
          </label>
          {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
          <button
            type="button"
            onClick={handleConnect}
            disabled={status === "saving" || !baseUrl || !token}
            className="flex items-center justify-center gap-2 self-start rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            {status === "saving" && <Loader2 className="h-4 w-4 animate-spin" />}
            Connect
          </button>
        </div>
      )}
    </div>
  );
}
