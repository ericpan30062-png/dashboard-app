"use client";

import { useState } from "react";
import { LifeBuoy, Loader2 } from "lucide-react";

type ReliefPlan = {
  task: string;
  specificFocus: string;
  durationMinutes: number;
  encouragement: string;
};

type Status = "idle" | "loading" | "ready" | "error";

export function OverwhelmedButton() {
  const [status, setStatus] = useState<Status>("idle");
  const [plan, setPlan] = useState<ReliefPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setStatus("loading");
    setError(null);

    try {
      const res = await fetch("/api/overwhelmed/relief", { method: "POST" });
      const body = await res.json();

      if (!res.ok) {
        setError(body.error ?? "Something went wrong");
        setStatus("error");
        return;
      }

      setPlan(body as ReliefPlan);
      setStatus("ready");
    } catch {
      setError("Something went wrong");
      setStatus("error");
    }
  }

  function close() {
    setStatus("idle");
    setPlan(null);
    setError(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 px-6 py-4 text-base font-semibold text-white shadow-sm transition-transform hover:scale-[1.01] hover:from-orange-600 hover:to-red-600"
      >
        <LifeBuoy className="h-5 w-5" strokeWidth={1.75} />
        I&apos;m overwhelmed — just tell me what to do
      </button>

      {status !== "idle" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-50 dark:bg-black">
          <div className="flex w-full max-w-xl flex-col items-center gap-6 px-6 text-center">
            {status === "loading" && (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
                <p className="text-lg text-zinc-600 dark:text-zinc-400">
                  Figuring out what matters most right now…
                </p>
              </>
            )}

            {status === "error" && (
              <>
                <p className="text-lg font-medium text-red-700 dark:text-red-400">
                  {error}
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleClick}
                    className="rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
                  >
                    Try again
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  >
                    Back to dashboard
                  </button>
                </div>
              </>
            )}

            {status === "ready" && plan && (
              <>
                <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-orange-700 dark:bg-orange-950 dark:text-orange-400">
                  Next {plan.durationMinutes} minutes
                </span>
                <h1 className="text-3xl font-bold text-zinc-950 dark:text-zinc-50">
                  {plan.task}
                </h1>
                <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
                  {plan.specificFocus}
                </p>
                <p className="text-base italic leading-7 text-zinc-500 dark:text-zinc-500">
                  {plan.encouragement}
                </p>
                <button
                  type="button"
                  onClick={close}
                  className="mt-4 rounded-full bg-zinc-950 px-6 py-3 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
                >
                  Back to dashboard
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
