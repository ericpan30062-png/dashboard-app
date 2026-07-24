"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, X } from "lucide-react";
import type { Assignment } from "@/generated/prisma/client";

type TopicEstimate = { topic: string; hours: number };
type StudySizeEstimate = {
  totalHours: number;
  topics: TopicEstimate[];
  confidenceLevel: "low" | "medium" | "high";
  confidenceReasoning: string;
};
type CanvasCourse = { id: string; name: string };

type Step =
  | "course-select"
  | "loading"
  | "review"
  | "saving"
  | "done"
  | "error";

const CONFIDENCE_STYLES: Record<StudySizeEstimate["confidenceLevel"], string> = {
  low: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  high: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
};

export function StudySizerModal({
  assignment,
  canvasConnected,
  onClose,
}: {
  assignment: Pick<Assignment, "id" | "name" | "canvasCourseId">;
  canvasConnected: boolean;
  onClose: () => void;
}) {
  const needsCourseSelect = canvasConnected && !assignment.canvasCourseId;

  const [step, setStep] = useState<Step>(needsCourseSelect ? "course-select" : "loading");
  const [courses, setCourses] = useState<CanvasCourse[] | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [estimate, setEstimate] = useState<StudySizeEstimate | null>(null);
  const [topics, setTopics] = useState<TopicEstimate[]>([]);
  const [totalHours, setTotalHours] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runEstimate(courseId?: string) {
    setStep("loading");
    setError(null);
    try {
      const res = await fetch("/api/study-sizer/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: assignment.id,
          canvasCourseId: courseId ?? null,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Couldn't generate an estimate");
        setStep("error");
        return;
      }

      const result = body as StudySizeEstimate;
      setEstimate(result);
      setTopics(result.topics);
      setTotalHours(result.totalHours);
      setStep("review");
    } catch {
      setError("Couldn't generate an estimate");
      setStep("error");
    }
  }

  function updateTopicHours(index: number, hours: number) {
    setTopics((prev) => {
      const next = prev.map((t, i) => (i === index ? { ...t, hours } : t));
      setTotalHours(next.reduce((sum, t) => sum + t.hours, 0));
      return next;
    });
  }

  async function handleSave() {
    setStep("saving");
    try {
      const res = await fetch("/api/study-sizer/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId: assignment.id, totalHours }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Couldn't save the estimate");
        setStep("error");
        return;
      }
      setStep("done");
    } catch {
      setError("Couldn't save the estimate");
      setStep("error");
    }
  }

  useEffect(() => {
    if (needsCourseSelect) {
      fetch("/api/integrations/canvas/courses")
        .then(async (res) => {
          const body = await res.json();
          if (!res.ok) {
            setError(body.error ?? "Couldn't load Canvas courses");
            setStep("error");
            return;
          }
          setCourses(body.courses);
        })
        .catch(() => {
          setError("Couldn't load Canvas courses");
          setStep("error");
        });
    } else {
      // Deferred a tick so the setState calls inside runEstimate don't run
      // synchronously within this effect (cascading-render lint rule).
      queueMicrotask(() => runEstimate(assignment.canvasCourseId ?? undefined));
    }
    // Run once on mount — this modal is only ever opened for one assignment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-zinc-950">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            Estimate time: {assignment.name}
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
          {step === "course-select" && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Which Canvas course is this assignment for? We&apos;ll pull its
                module topics to make the estimate more specific.
              </p>
              {courses === null ? (
                <div className="flex items-center gap-2 py-4 text-sm text-zinc-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading your courses…
                </div>
              ) : (
                <select
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="rounded-md border border-zinc-200 bg-transparent px-3 py-2 text-sm dark:border-zinc-800"
                >
                  <option value="">Skip — estimate without topics</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {(step === "loading" || step === "saving") && (
            <div className="flex flex-col items-center gap-2 py-8 text-sm text-zinc-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              {step === "loading" ? "Sizing up this assignment…" : "Saving…"}
            </div>
          )}

          {step === "review" && estimate && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-zinc-950 dark:text-zinc-50">
                  {totalHours.toFixed(1)}h
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${CONFIDENCE_STYLES[estimate.confidenceLevel]}`}
                >
                  {estimate.confidenceLevel} confidence
                </span>
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {estimate.confidenceReasoning}
              </p>

              {topics.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setExpanded((e) => !e)}
                    className="flex items-center gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    {expanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    Breakdown by topic ({topics.length})
                  </button>
                  {expanded && (
                    <ul className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                      {topics.map((t, i) => (
                        <li key={i} className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-zinc-700 dark:text-zinc-300">{t.topic}</span>
                          <input
                            type="number"
                            min={0}
                            step={0.25}
                            value={t.hours}
                            onChange={(e) => updateTopicHours(i, Number(e.target.value))}
                            className="w-20 rounded-md border border-zinc-200 bg-transparent px-2 py-1 text-right dark:border-zinc-800"
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    Total hours
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={0.25}
                    value={totalHours}
                    onChange={(e) => setTotalHours(Number(e.target.value))}
                    className="w-28 rounded-md border border-zinc-200 bg-transparent px-3 py-1.5 dark:border-zinc-800"
                  />
                </label>
              )}
            </div>
          )}

          {step === "error" && (
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          )}

          {step === "done" && (
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              Saved — this assignment is now estimated at {totalHours.toFixed(1)} hours.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
          {step === "course-select" && (
            <button
              type="button"
              onClick={() => runEstimate(selectedCourseId || undefined)}
              disabled={courses === null}
              className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              Continue
            </button>
          )}
          {step === "review" && (
            <button
              type="button"
              onClick={handleSave}
              className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              Save estimate
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
