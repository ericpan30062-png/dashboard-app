"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, UploadCloud } from "lucide-react";
import type { ExtractedAssignment } from "@/lib/syllabus-schema";

const ASSIGNMENT_TYPES: ExtractedAssignment["type"][] = [
  "EXAM",
  "PAPER",
  "HOMEWORK",
  "PROJECT",
];

type DraftRow = ExtractedAssignment & { id: string };

let nextRowId = 0;
function makeRow(a: ExtractedAssignment): DraftRow {
  nextRowId += 1;
  return { ...a, id: `row-${nextRowId}` };
}

export function SyllabusUploader() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<
    "idle" | "extracting" | "reviewing" | "saving"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<DraftRow[]>([]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setStatus("extracting");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/syllabus/extract", {
        method: "POST",
        body: formData,
      });
      const body = await res.json();

      if (!res.ok) {
        throw new Error(body.error ?? "Failed to extract assignments");
      }

      const assignments = body.assignments as ExtractedAssignment[];
      if (assignments.length === 0) {
        setError("No assignments were found in that PDF.");
        setStatus("idle");
        return;
      }

      setRows(assignments.map(makeRow));
      setStatus("reviewing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("idle");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function updateRow(id: string, patch: Partial<ExtractedAssignment>) {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((row) => row.id !== id));
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      makeRow({ name: "", dueDate: null, weight: null, type: "HOMEWORK" }),
    ]);
  }

  async function handleConfirm() {
    setError(null);
    setStatus("saving");
    try {
      const res = await fetch("/api/syllabus/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignments: rows.map((row) => ({
            name: row.name,
            dueDate: row.dueDate,
            weight: row.weight,
            type: row.type,
          })),
        }),
      });
      const body = await res.json();

      if (!res.ok) {
        throw new Error(body.error ?? "Failed to save assignments");
      }

      setRows([]);
      setStatus("idle");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("reviewing");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {status !== "reviewing" && status !== "saving" && (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center transition-colors hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:border-zinc-600">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            disabled={status === "extracting"}
            onChange={handleFileChange}
          />
          {status === "extracting" ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                Extracting assignments&hellip;
              </span>
            </>
          ) : (
            <>
              <UploadCloud
                className="h-6 w-6 text-zinc-500"
                strokeWidth={1.75}
              />
              <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Upload a syllabus PDF
              </span>
              <span className="text-xs text-zinc-500">
                We&apos;ll pull out assignments, due dates, and grade weights
                for you to review.
              </span>
            </>
          )}
        </label>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          {error}
        </p>
      )}

      {(status === "reviewing" || status === "saving") && (
        <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              Review before saving
            </h3>
            <button
              type="button"
              onClick={addRow}
              disabled={status === "saving"}
              className="text-xs font-medium text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              + Add row
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                  <th className="py-2 pr-2 font-medium">Name</th>
                  <th className="py-2 pr-2 font-medium">Due date</th>
                  <th className="py-2 pr-2 font-medium">Weight %</th>
                  <th className="py-2 pr-2 font-medium">Type</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                  >
                    <td className="py-2 pr-2">
                      <input
                        value={row.name}
                        onChange={(e) =>
                          updateRow(row.id, { name: e.target.value })
                        }
                        disabled={status === "saving"}
                        className="w-full rounded-md border border-zinc-200 bg-transparent px-2 py-1 text-sm dark:border-zinc-800"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        value={row.dueDate ?? ""}
                        onChange={(e) =>
                          updateRow(row.id, {
                            dueDate: e.target.value || null,
                          })
                        }
                        placeholder="e.g. 2026-10-15"
                        disabled={status === "saving"}
                        className="w-full rounded-md border border-zinc-200 bg-transparent px-2 py-1 text-sm dark:border-zinc-800"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={row.weight ?? ""}
                        onChange={(e) =>
                          updateRow(row.id, {
                            weight:
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
                          })
                        }
                        disabled={status === "saving"}
                        className="w-20 rounded-md border border-zinc-200 bg-transparent px-2 py-1 text-sm dark:border-zinc-800"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <select
                        value={row.type}
                        onChange={(e) =>
                          updateRow(row.id, {
                            type: e.target.value as ExtractedAssignment["type"],
                          })
                        }
                        disabled={status === "saving"}
                        className="rounded-md border border-zinc-200 bg-transparent px-2 py-1 text-sm dark:border-zinc-800"
                      >
                        {ASSIGNMENT_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t.charAt(0) + t.slice(1).toLowerCase()}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        disabled={status === "saving"}
                        aria-label="Remove row"
                        className="text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                setRows([]);
                setStatus("idle");
              }}
              disabled={status === "saving"}
              className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={status === "saving" || rows.length === 0}
              className="flex items-center gap-2 rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              {status === "saving" && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Confirm &amp; save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
