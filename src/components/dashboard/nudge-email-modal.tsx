"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import type { Assignment } from "@/generated/prisma/client";

type Step = "loading" | "review" | "sending" | "done" | "error";

type Slot = {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  location: string;
  date: string;
};

export function NudgeEmailModal({
  assignment,
  onClose,
}: {
  assignment: Pick<Assignment, "id" | "name">;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>("loading");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [slot, setSlot] = useState<Slot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/nudge/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignmentId: assignment.id }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Couldn't draft an email");
          setStep("error");
          return;
        }
        setTo(data.to ?? "");
        setSubject(data.subject);
        setBody(data.body);
        setSlot(data.slot);
        setStep("review");
      })
      .catch(() => {
        setError("Couldn't draft an email");
        setStep("error");
      });
    // Run once on mount for this assignment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSend() {
    setStep("sending");
    setError(null);
    try {
      const res = await fetch("/api/nudge/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't send the email");
        setStep("error");
        return;
      }
      setStep("done");
    } catch {
      setError("Couldn't send the email");
      setStep("error");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-zinc-950">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            Email instructor: {assignment.name}
          </h2>
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
          {step === "loading" && (
            <div className="flex flex-col items-center gap-2 py-8 text-sm text-zinc-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Finding a good office hours slot and drafting an email…
            </div>
          )}

          {step === "sending" && (
            <div className="flex flex-col items-center gap-2 py-8 text-sm text-zinc-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Sending…
            </div>
          )}

          {(step === "review" || step === "sending") && slot && (
            <p className="mb-3 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              Referencing office hours:{" "}
              {new Date(slot.date).toLocaleDateString(undefined, {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
              , {slot.startTime}–{slot.endTime}, {slot.location}
            </p>
          )}

          {step === "review" && (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">To</span>
                <input
                  type="email"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="instructor@school.edu"
                  className="rounded-md border border-zinc-200 bg-transparent px-3 py-1.5 dark:border-zinc-800"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">Subject</span>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="rounded-md border border-zinc-200 bg-transparent px-3 py-1.5 dark:border-zinc-800"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">Body</span>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={8}
                  className="rounded-md border border-zinc-200 bg-transparent px-3 py-1.5 dark:border-zinc-800"
                />
              </label>
            </div>
          )}

          {step === "error" && (
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          )}

          {step === "done" && (
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              Email sent to {to}.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
          {step === "review" && (
            <button
              type="button"
              onClick={handleSend}
              disabled={!to || !subject || !body}
              className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              Send
            </button>
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
          {step === "done" && (
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
