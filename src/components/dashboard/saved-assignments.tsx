"use client";

import { useState } from "react";
import { CalendarClock, Ruler } from "lucide-react";
import type { Assignment } from "@/generated/prisma/client";
import { StudyPlanModal } from "@/components/dashboard/study-plan-modal";
import { StudySizerModal } from "@/components/dashboard/study-sizer-modal";

function formatType(type: Assignment["type"]) {
  return type.charAt(0) + type.slice(1).toLowerCase();
}

export function SavedAssignments({
  assignments,
  canvasConnected,
}: {
  assignments: Assignment[];
  canvasConnected: boolean;
}) {
  const [planFor, setPlanFor] = useState<Assignment | null>(null);
  const [sizeFor, setSizeFor] = useState<Assignment | null>(null);

  if (assignments.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-500">
        No assignments saved yet. Upload a syllabus above to get started.
      </p>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Due date</th>
              <th className="px-4 py-2 font-medium">Weight</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Est. hours</th>
              <th className="px-4 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {assignments.map((a) => (
              <tr
                key={a.id}
                className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
              >
                <td className="px-4 py-2 text-zinc-800 dark:text-zinc-200">
                  {a.name}
                </td>
                <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                  {a.dueDate ?? "—"}
                </td>
                <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                  {a.weight != null ? `${a.weight}%` : "—"}
                </td>
                <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                  {formatType(a.type)}
                </td>
                <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                  {a.estimatedHours != null ? `${a.estimatedHours}h` : "—"}
                </td>
                <td className="px-4 py-2">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => setSizeFor(a)}
                      title="Estimate time"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-300"
                    >
                      <Ruler className="h-4 w-4" strokeWidth={1.75} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlanFor(a)}
                      title="Plan my time"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-300"
                    >
                      <CalendarClock className="h-4 w-4" strokeWidth={1.75} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
    </>
  );
}
