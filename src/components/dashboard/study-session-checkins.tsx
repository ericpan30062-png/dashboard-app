"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, Loader2 } from "lucide-react";
import type { Assignment, StudySession } from "@/generated/prisma/client";

type SessionWithAssignment = StudySession & { assignment: Assignment };

function formatDateTime(date: Date) {
  return new Date(date).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function StudySessionCheckins({
  sessions,
}: {
  sessions: SessionWithAssignment[];
}) {
  const router = useRouter();
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function markStatus(id: string, status: "PROGRESS_MADE" | "BLOCKED", blockedNote?: string) {
    setBusyId(id);
    try {
      await fetch(`/api/study-sessions/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, blockedNote: blockedNote ?? null }),
      });
      router.refresh();
    } finally {
      setBusyId(null);
      setNoteFor(null);
      setNote("");
    }
  }

  if (sessions.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
        Check in on past study sessions
      </h3>
      <ul className="flex flex-col gap-2">
        {sessions.map((s) => (
          <li
            key={s.id}
            className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                  {s.assignment.name}
                </p>
                <p className="text-xs text-zinc-500">
                  Scheduled {formatDateTime(s.scheduledStart)}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => markStatus(s.id, "PROGRESS_MADE")}
                  disabled={busyId === s.id}
                  className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {busyId === s.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CircleCheck className="h-3.5 w-3.5" />
                  )}
                  Made progress
                </button>
                <button
                  type="button"
                  onClick={() => setNoteFor(noteFor === s.id ? null : s.id)}
                  disabled={busyId === s.id}
                  className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  I&apos;m blocked
                </button>
              </div>
            </div>

            {noteFor === s.id && (
              <div className="flex flex-col gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-900">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What's blocking you? (optional, helps draft a better email later)"
                  rows={2}
                  className="rounded-md border border-zinc-200 bg-transparent px-3 py-1.5 text-sm dark:border-zinc-800"
                />
                <button
                  type="button"
                  onClick={() => markStatus(s.id, "BLOCKED", note)}
                  disabled={busyId === s.id}
                  className="self-start rounded-full bg-zinc-950 px-4 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
                >
                  Confirm blocked
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
