"use client";

import { useState } from "react";
import { GraduationCap } from "lucide-react";

type TopicRow = { id: string; topic: string; completed: boolean };

export type ExamPlanSummary = {
  assignmentId: string;
  examName: string;
  daysUntilExam: number;
  todayDate: string | null;
  todayTopics: TopicRow[];
  todayEstimatedMinutes: number;
  totalTopics: number;
  completedTopics: number;
};

function daysLabel(days: number) {
  if (days === 0) return "Exam today";
  if (days === 1) return "Exam tomorrow";
  return `${days} days until exam`;
}

export function ExamCountdownWidget({ plans }: { plans: ExamPlanSummary[] }) {
  const [state, setState] = useState(plans);

  async function toggle(assignmentId: string, topicId: string, completed: boolean) {
    setState((prev) =>
      prev.map((p) =>
        p.assignmentId === assignmentId
          ? {
              ...p,
              todayTopics: p.todayTopics.map((t) =>
                t.id === topicId ? { ...t, completed } : t,
              ),
            }
          : p,
      ),
    );

    try {
      const res = await fetch(`/api/exam-plans/topics/${topicId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });
      if (!res.ok) return;
      const body = await res.json();
      setState((prev) =>
        prev.map((p) =>
          p.assignmentId === assignmentId
            ? {
                ...p,
                totalTopics: body.coverage.totalTopics,
                completedTopics: body.coverage.completedTopics,
              }
            : p,
        ),
      );
    } catch {
      // Leave the optimistic UI update in place — worst case the coverage
      // count is a topic off until the next page load.
    }
  }

  if (state.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {state.map((plan) => {
        const percent =
          plan.totalTopics === 0
            ? 0
            : Math.round((plan.completedTopics / plan.totalTopics) * 100);

        return (
          <div
            key={plan.assignmentId}
            className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-900">
                  <GraduationCap
                    className="h-4 w-4 text-zinc-600 dark:text-zinc-400"
                    strokeWidth={1.75}
                  />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                    {daysLabel(plan.daysUntilExam)}: {plan.examName}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {plan.completedTopics}/{plan.totalTopics} topics covered ({percent}%)
                  </p>
                </div>
              </div>
              {plan.todayEstimatedMinutes > 0 && (
                <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                  {plan.todayEstimatedMinutes} min today
                </span>
              )}
            </div>

            <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600"
                style={{ width: `${percent}%` }}
              />
            </div>

            {plan.todayTopics.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {plan.todayTopics.map((t) => (
                  <li key={t.id}>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={t.completed}
                        onChange={(e) => toggle(plan.assignmentId, t.id, e.target.checked)}
                        className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
                      />
                      <span
                        className={
                          t.completed
                            ? "text-zinc-400 line-through dark:text-zinc-600"
                            : "text-zinc-700 dark:text-zinc-300"
                        }
                      >
                        {t.topic}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-zinc-500">
                Nothing scheduled in this plan for today.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
