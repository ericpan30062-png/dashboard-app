"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Ruler, Sparkles } from "lucide-react";
import type { Assignment } from "@/generated/prisma/client";
import type { ScoredAssignment } from "@/lib/grade-impact";
import { StudyPlanModal } from "@/components/dashboard/study-plan-modal";
import { StudySizerModal } from "@/components/dashboard/study-sizer-modal";

type SortMode = "impact" | "dueDate";

function formatType(type: Assignment["type"]) {
  return type.charAt(0) + type.slice(1).toLowerCase();
}

function formatDueLabel(daysUntilDue: number) {
  if (daysUntilDue === 0) return "Due today";
  if (daysUntilDue === 1) return "Due tomorrow";
  if (daysUntilDue < 0) return `${Math.abs(daysUntilDue)}d overdue`;
  return `In ${daysUntilDue} days`;
}

function RowActions({
  onSize,
  onPlan,
}: {
  onSize: () => void;
  onPlan: () => void;
}) {
  return (
    <div className="flex shrink-0 gap-1">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSize();
        }}
        title="Estimate time"
        className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-300"
      >
        <Ruler className="h-4 w-4" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onPlan();
        }}
        title="Plan my time"
        className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-300"
      >
        <CalendarClock className="h-4 w-4" strokeWidth={1.75} />
      </button>
    </div>
  );
}

export function PriorityView({
  byImpact,
  byDueDate,
  undated,
  summary,
  canvasConnected,
}: {
  byImpact: ScoredAssignment[];
  byDueDate: ScoredAssignment[];
  undated: Assignment[];
  summary: string | null;
  canvasConnected: boolean;
}) {
  const [sortMode, setSortMode] = useState<SortMode>("impact");
  const [planFor, setPlanFor] = useState<Assignment | null>(null);
  const [sizeFor, setSizeFor] = useState<Assignment | null>(null);

  const items = sortMode === "impact" ? byImpact : byDueDate;
  const maxImpact = useMemo(
    () => Math.max(1, ...byImpact.map((i) => i.impactScore)),
    [byImpact],
  );

  const hasAnyAssignments = byImpact.length > 0 || undated.length > 0;

  if (!hasAnyAssignments) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950">
        No upcoming assignments yet. Upload a syllabus to get started.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {summary ? (
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
          <Sparkles
            className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
            strokeWidth={1.75}
          />
          <p className="text-sm leading-6 text-amber-900 dark:text-amber-200">
            {summary}
          </p>
        </div>
      ) : (
        byImpact.length > 0 && (
          <p className="text-xs text-zinc-500 dark:text-zinc-500">
            AI summary unavailable — connect your Anthropic API key on the
            Settings page.
          </p>
        )
      )}

      {byImpact.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Sort by
          </span>
          <div className="relative flex w-56 rounded-full bg-zinc-100 p-1 dark:bg-zinc-900">
            <div
              className="absolute inset-y-1 w-1/2 rounded-full bg-white shadow-sm transition-transform duration-200 dark:bg-zinc-800"
              style={{
                transform:
                  sortMode === "dueDate" ? "translateX(100%)" : "translateX(0)",
              }}
            />
            <button
              type="button"
              onClick={() => setSortMode("impact")}
              className={`relative z-10 flex-1 rounded-full py-1.5 text-xs font-medium transition-colors ${
                sortMode === "impact"
                  ? "text-zinc-950 dark:text-zinc-50"
                  : "text-zinc-500 dark:text-zinc-500"
              }`}
            >
              Grade impact
            </button>
            <button
              type="button"
              onClick={() => setSortMode("dueDate")}
              className={`relative z-10 flex-1 rounded-full py-1.5 text-xs font-medium transition-colors ${
                sortMode === "dueDate"
                  ? "text-zinc-950 dark:text-zinc-50"
                  : "text-zinc-500 dark:text-zinc-500"
              }`}
            >
              Due date
            </button>
          </div>
        </div>
      )}

      {byImpact.length > 0 && (
        <ul className="flex flex-col gap-2">
          {items.map((item) => {
            const barWidth = Math.max(
              4,
              (item.impactScore / maxImpact) * 100,
            );
            return (
              <li
                key={item.assignment.id}
                className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                      {item.assignment.name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {item.assignment.course && `${item.assignment.course} · `}
                      {formatType(item.assignment.type)}
                      {item.assignment.weight != null &&
                        ` · ${item.assignment.weight}% of grade`}
                      {item.assignment.estimatedHours != null &&
                        ` · ~${item.assignment.estimatedHours}h`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      {formatDueLabel(item.daysUntilDue ?? 0)}
                    </span>
                    <RowActions
                      onSize={() => setSizeFor(item.assignment)}
                      onPlan={() => setPlanFor(item.assignment)}
                    />
                  </div>
                </div>
                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900"
                  role="meter"
                  aria-label={`Impact score ${item.impactScore.toFixed(1)}`}
                  aria-valuenow={Math.round(item.impactScore)}
                  aria-valuemin={0}
                  aria-valuemax={Math.round(maxImpact)}
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-red-500"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {undated.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            No due date
          </h3>
          <ul className="flex flex-col gap-2">
            {undated.map((assignment) => (
              <li
                key={assignment.id}
                className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div>
                  <p className="font-medium text-zinc-950 dark:text-zinc-50">
                    {assignment.name}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {formatType(assignment.type)}
                    {assignment.weight != null &&
                      ` · ${assignment.weight}% of grade`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-zinc-400">
                    {assignment.dueDate ?? "Unknown"}
                  </span>
                  <RowActions
                    onSize={() => setSizeFor(assignment)}
                    onPlan={() => setPlanFor(assignment)}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {planFor && (
        <StudyPlanModal assignment={planFor} onClose={() => setPlanFor(null)} />
      )}
      {sizeFor && (
        <StudySizerModal
          assignment={sizeFor}
          canvasConnected={canvasConnected}
          onClose={() => setSizeFor(null)}
        />
      )}
    </div>
  );
}
