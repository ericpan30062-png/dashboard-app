"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

function toDateInputValue(date: Date | null): string {
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function SemesterStartDate({
  initialDate,
}: {
  initialDate: Date | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(toDateInputValue(initialDate));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    if (!value) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/settings/semester-start-date", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: value }),
      });
      if (res.ok) {
        setSaved(true);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">
          Semester start date
        </span>
        <input
          type="date"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          className="rounded-md border border-zinc-200 bg-transparent px-3 py-1.5 text-sm dark:border-zinc-800"
        />
      </label>
      <button
        type="button"
        onClick={handleSave}
        disabled={saving || !value}
        className="flex items-center gap-2 rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Save
      </button>
      {saved && (
        <span className="text-xs text-emerald-600 dark:text-emerald-400">Saved</span>
      )}
    </div>
  );
}
