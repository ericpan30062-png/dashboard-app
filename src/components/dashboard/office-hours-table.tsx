"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import type { OfficeHours } from "@/generated/prisma/client";

const DAYS: OfficeHours["dayOfWeek"][] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

function formatDay(day: OfficeHours["dayOfWeek"]) {
  return day.charAt(0) + day.slice(1).toLowerCase();
}

const emptyForm = {
  course: "",
  instructorName: "",
  instructorEmail: "",
  dayOfWeek: "MONDAY" as OfficeHours["dayOfWeek"],
  startTime: "14:00",
  endTime: "15:00",
  location: "",
};

export function OfficeHoursTable({
  initialOfficeHours,
}: {
  initialOfficeHours: OfficeHours[];
}) {
  const router = useRouter();
  const [entries, setEntries] = useState(initialOfficeHours);
  const [form, setForm] = useState(emptyForm);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!form.course || !form.instructorName || !form.location) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/office-hours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          instructorEmail: form.instructorEmail || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Couldn't save that entry");
        return;
      }
      setEntries((prev) => [...prev, body.officeHours]);
      setForm(emptyForm);
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    await fetch(`/api/office-hours/${id}`, { method: "DELETE" });
  }

  async function handleImport() {
    setImporting(true);
    setImportMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/office-hours/import-canvas", { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Couldn't import from Canvas");
        return;
      }
      setImportMessage(
        `Imported ${body.importedCount} office hours entr${body.importedCount === 1 ? "y" : "ies"}.`,
      );
      router.refresh();
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleImport}
          disabled={importing}
          className="flex items-center gap-2 rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          {importing && <Loader2 className="h-4 w-4 animate-spin" />}
          Import from Canvas
        </button>
        {importMessage && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400">
            {importMessage}
          </span>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
              <th className="px-4 py-2 font-medium">Course</th>
              <th className="px-4 py-2 font-medium">Instructor</th>
              <th className="px-4 py-2 font-medium">Day</th>
              <th className="px-4 py-2 font-medium">Time</th>
              <th className="px-4 py-2 font-medium">Location</th>
              <th className="px-4 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr
                key={e.id}
                className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
              >
                <td className="px-4 py-2 text-zinc-800 dark:text-zinc-200">{e.course}</td>
                <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                  {e.instructorName}
                </td>
                <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                  {formatDay(e.dayOfWeek)}
                </td>
                <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                  {e.startTime}–{e.endTime}
                </td>
                <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{e.location}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => handleDelete(e.id)}
                    aria-label="Delete"
                    className="text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-zinc-500">
                  No office hours yet — add one below or import from Canvas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:grid-cols-3">
        <input
          placeholder="Course (e.g. CS 101)"
          value={form.course}
          onChange={(e) => setForm((f) => ({ ...f, course: e.target.value }))}
          className="rounded-md border border-zinc-200 bg-transparent px-3 py-1.5 text-sm dark:border-zinc-800"
        />
        <input
          placeholder="Instructor name"
          value={form.instructorName}
          onChange={(e) => setForm((f) => ({ ...f, instructorName: e.target.value }))}
          className="rounded-md border border-zinc-200 bg-transparent px-3 py-1.5 text-sm dark:border-zinc-800"
        />
        <input
          placeholder="Instructor email (optional)"
          value={form.instructorEmail}
          onChange={(e) => setForm((f) => ({ ...f, instructorEmail: e.target.value }))}
          className="rounded-md border border-zinc-200 bg-transparent px-3 py-1.5 text-sm dark:border-zinc-800"
        />
        <select
          value={form.dayOfWeek}
          onChange={(e) =>
            setForm((f) => ({ ...f, dayOfWeek: e.target.value as OfficeHours["dayOfWeek"] }))
          }
          className="rounded-md border border-zinc-200 bg-transparent px-3 py-1.5 text-sm dark:border-zinc-800"
        >
          {DAYS.map((d) => (
            <option key={d} value={d}>
              {formatDay(d)}
            </option>
          ))}
        </select>
        <input
          type="time"
          value={form.startTime}
          onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
          className="rounded-md border border-zinc-200 bg-transparent px-3 py-1.5 text-sm dark:border-zinc-800"
        />
        <input
          type="time"
          value={form.endTime}
          onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
          className="rounded-md border border-zinc-200 bg-transparent px-3 py-1.5 text-sm dark:border-zinc-800"
        />
        <input
          placeholder="Location or Zoom link"
          value={form.location}
          onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
          className="col-span-2 rounded-md border border-zinc-200 bg-transparent px-3 py-1.5 text-sm dark:border-zinc-800 sm:col-span-2"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={adding || !form.course || !form.instructorName || !form.location}
          className="flex items-center justify-center gap-2 rounded-md bg-zinc-950 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          {adding && <Loader2 className="h-4 w-4 animate-spin" />}
          Add
        </button>
      </div>
    </div>
  );
}
