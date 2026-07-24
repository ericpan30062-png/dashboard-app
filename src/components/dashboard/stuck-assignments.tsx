"use client";

import { useState } from "react";
import { MailWarning } from "lucide-react";
import type { Assignment } from "@/generated/prisma/client";
import type { StuckResult } from "@/lib/stuck-detector";
import { NudgeEmailModal } from "@/components/dashboard/nudge-email-modal";

function reasonText(reason: StuckResult["reason"]) {
  return reason === "blocked"
    ? "Marked blocked during a study session"
    : "A scheduled study session passed with no check-in";
}

export function StuckAssignments({
  items,
}: {
  items: { assignment: Assignment; stuck: StuckResult }[];
}) {
  const [draftFor, setDraftFor] = useState<Assignment | null>(null);

  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
        Stuck assignments
      </h3>
      <ul className="flex flex-col gap-2">
        {items.map(({ assignment, stuck }) => (
          <li
            key={assignment.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950"
          >
            <div>
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                {assignment.name}
                {assignment.course && (
                  <span className="ml-2 text-xs font-normal text-amber-700 dark:text-amber-400">
                    {assignment.course}
                  </span>
                )}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {reasonText(stuck.reason)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDraftFor(assignment)}
              className="flex shrink-0 items-center gap-2 rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              <MailWarning className="h-4 w-4" strokeWidth={1.75} />
              Draft email
            </button>
          </li>
        ))}
      </ul>

      {draftFor && (
        <NudgeEmailModal assignment={draftFor} onClose={() => setDraftFor(null)} />
      )}
    </div>
  );
}
