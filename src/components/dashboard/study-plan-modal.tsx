"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, X } from "lucide-react";
import type { Assignment } from "@/generated/prisma/client";

type PlanSession = {
  date: string;
  durationMinutes: number;
  focus: string;
  schedulable: boolean;
  start: string | null;
  end: string | null;
};

type Step = "form" | "loading" | "review" | "committing" | "success" | "error";

function formatDateTime(iso: string) {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function StudyPlanModal({
  assignment,
  onClose,
}: {
  assignment: Pick<Assignment, "id" | "name" | "dueDate">;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>("form");
  const [hours, setHours] = useState("2");
  const [sessions, setSessions] = useState<PlanSession[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [needsGoogleConnect, setNeedsGoogleConnect] = useState(false);
  const [commitResult, setCommitResult] = useState<{
    created: number;
    failed: number;
  } | null>(null);

  async function handleGenerate() {
    const hoursEstimate = Number(hours);
    if (!Number.isFinite(hoursEstimate) || hoursEstimate <= 0) {
      setError("Enter a valid number of hours.");
      setStep("error");
      return;
    }

    setError(null);
    setNeedsGoogleConnect(false);
    setStep("loading");

    try {
      const res = await fetch("/api/planning/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId: assignment.id, hoursEstimate }),
      });
      const body = await res.json();

      if (!res.ok) {
        setError(body.error ?? "Failed to generate a plan");
        setNeedsGoogleConnect(Boolean(body.needsGoogleConnect));
        setStep("error");
        return;
      }

      setSessions(body.sessions as PlanSession[]);
      setStep("review");
    } catch {
      setError("Something went wrong");
      setStep("error");
    }
  }

  async function handleConfirm() {
    const schedulable = sessions.filter((s) => s.schedulable && s.start && s.end);
    setStep("committing");

    try {
      const res = await fetch("/api/planning/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId: assignment.id, sessions: schedulable }),
      });
      const body = await res.json();

      if (!res.ok) {
        setError(body.error ?? "Failed to add events to your calendar");
        setNeedsGoogleConnect(Boolean(body.needsGoogleConnect));
        setStep("error");
        return;
      }

      setCommitResult({ created: body.created, failed: body.failed });
      setStep("success");
    } catch {
      setError("Something went wrong");
      setStep("error");
    }
  }

  const schedulableCount = sessions.filter((s) => s.schedulable).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-zinc-950">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div>
            <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              Plan my time: {assignment.name}
            </h2>
            <p className="text-xs text-zinc-500">
              Due {assignment.dueDate ?? "date unknown"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {step === "form" && (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  How many hours will this take, roughly?
                </span>
                <input
                  type="number"
                  min={0.25}
                  step={0.25}
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  className="w-32 rounded-md border border-zinc-200 bg-transparent px-3 py-1.5 dark:border-zinc-800"
                />
              </label>
              <p className="text-xs text-zinc-500">
                We&apos;ll check your Google Calendar for free time between now
                and the due date and draft a study schedule.
              </p>
            </div>
          )}

          {(step === "loading" || step === "committing") && (
            <div className="flex flex-col items-center gap-2 py-8 text-sm text-zinc-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              {step === "loading" ? "Building your study plan…" : "Adding events to your calendar…"}
            </div>
          )}

          {step === "review" && (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-zinc-500">
                {schedulableCount} of {sessions.length} sessions could be
                scheduled in your free time. Review, then confirm to add them
                to Google Calendar.
              </p>
              <ul className="flex flex-col gap-2">
                {sessions.map((session, i) => (
                  <li
                    key={i}
                    className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800"
                  >
                    {session.schedulable && session.start && session.end ? (
                      <p className="font-medium text-zinc-800 dark:text-zinc-200">
                        {formatDateTime(session.start)} –{" "}
                        {new Date(session.end).toLocaleTimeString(undefined, {
                          hour: "numeric",
                          minute: "2-digit",
                        })}{" "}
                        <span className="text-zinc-400">
                          ({session.durationMinutes} min)
                        </span>
                      </p>
                    ) : (
                      <p className="font-medium text-amber-600 dark:text-amber-400">
                        {session.date} — couldn&apos;t fit ({session.durationMinutes} min needed)
                      </p>
                    )}
                    <p className="text-zinc-600 dark:text-zinc-400">{session.focus}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {step === "error" && (
            <div className="flex flex-col gap-2 py-4">
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
              {needsGoogleConnect && (
                <Link
                  href="/dashboard/calendar"
                  className="text-sm font-medium text-zinc-950 underline dark:text-zinc-50"
                >
                  Go to Calendar settings
                </Link>
              )}
            </div>
          )}

          {step === "success" && commitResult && (
            <div className="flex flex-col gap-1 py-4 text-sm">
              <p className="font-medium text-emerald-700 dark:text-emerald-400">
                Added {commitResult.created} session
                {commitResult.created === 1 ? "" : "s"} to your calendar.
              </p>
              {commitResult.failed > 0 && (
                <p className="text-zinc-500">
                  {commitResult.failed} session
                  {commitResult.failed === 1 ? "" : "s"} failed to save —
                  try again from here later.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
          {step === "form" && (
            <button
              type="button"
              onClick={handleGenerate}
              className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              Generate plan
            </button>
          )}
          {step === "review" && (
            <>
              <button
                type="button"
                onClick={() => setStep("form")}
                className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={schedulableCount === 0}
                className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                Confirm &amp; add to calendar
              </button>
            </>
          )}
          {step === "error" && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Close
            </button>
          )}
          {step === "success" && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
