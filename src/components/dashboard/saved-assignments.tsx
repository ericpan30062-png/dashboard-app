"use client";

import { useState } from "react";
import type { Assignment } from "@/generated/prisma/client";
import { StudyPlanModal } from "@/components/dashboard/study-plan-modal";

function formatType(type: Assignment["type"]) {
  return type.charAt(0) + type.slice(1).toLowerCase();
}

export function SavedAssignments({
  assignments,
}: {
  assignments: Assignment[];
}) {
  const [selected, setSelected] = useState<Assignment | null>(null);

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
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Due date</th>
              <th className="px-4 py-2 font-medium">Weight</th>
              <th className="px-4 py-2 font-medium">Type</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((a) => (
              <tr
                key={a.id}
                onClick={() => setSelected(a)}
                className="cursor-pointer border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-900 dark:hover:bg-zinc-900"
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <StudyPlanModal assignment={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
