"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Cloud, CircleCheck, Loader2 } from "lucide-react";

const DEFAULT_REDIRECT_URI = "http://localhost:3000/api/integrations/google-calendar/callback";

export function GoogleAppConfig({
  configured,
  initialClientId,
  initialRedirectUri,
}: {
  configured: boolean;
  initialClientId: string | null;
  initialRedirectUri: string | null;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState(initialClientId ?? "");
  const [clientSecret, setClientSecret] = useState("");
  const [redirectUri, setRedirectUri] = useState(initialRedirectUri ?? DEFAULT_REDIRECT_URI);
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setStatus("saving");
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/settings/google-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, clientSecret, redirectUri }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Failed to save");
        setStatus("idle");
        return;
      }
      setClientSecret("");
      setSaved(true);
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-900">
          <Cloud className="h-4 w-4 text-zinc-600 dark:text-zinc-400" strokeWidth={1.75} />
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
            Google OAuth client
          </p>
          <p className="flex items-center gap-1 text-xs text-zinc-500">
            {configured ? (
              <>
                <CircleCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                Configured
              </>
            ) : (
              "Not configured"
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">Client ID</span>
          <input
            type="text"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="rounded-md border border-zinc-200 bg-transparent px-3 py-1.5 dark:border-zinc-800"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">Client secret</span>
          <input
            type="password"
            placeholder={configured ? "Re-enter to update" : ""}
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            className="rounded-md border border-zinc-200 bg-transparent px-3 py-1.5 dark:border-zinc-800"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">Redirect URI</span>
          <input
            type="text"
            value={redirectUri}
            onChange={(e) => setRedirectUri(e.target.value)}
            className="rounded-md border border-zinc-200 bg-transparent px-3 py-1.5 dark:border-zinc-800"
          />
          <span className="text-xs text-zinc-500">
            Must exactly match an authorized redirect URI on the OAuth client in Google Cloud Console.
          </span>
        </label>
        {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
        {saved && !error && (
          <p className="text-sm text-emerald-700 dark:text-emerald-400">Saved.</p>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={status === "saving" || !clientId || !clientSecret || !redirectUri}
          className="flex items-center justify-center gap-2 self-start rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          {status === "saving" && <Loader2 className="h-4 w-4 animate-spin" />}
          Save
        </button>
      </div>
    </div>
  );
}
