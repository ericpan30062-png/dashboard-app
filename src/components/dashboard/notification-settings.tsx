"use client";

import { useState } from "react";

export function NotificationSettings({
  initialProcrastinationNudgesEnabled,
}: {
  initialProcrastinationNudgesEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialProcrastinationNudgesEnabled);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    const next = !enabled;
    setEnabled(next);
    setSaving(true);
    try {
      const res = await fetch("/api/settings/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ procrastinationNudgesEnabled: next }),
      });
      if (!res.ok) setEnabled(!next);
    } catch {
      setEnabled(!next);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Procrastination nudge emails
        </p>
        <p className="text-xs text-zinc-500">
          A daily check for assignments you&rsquo;ve been avoiding, with a short
          honest nudge about the most critical one — sent to your email once
          every 48 hours at most.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Toggle procrastination nudge emails"
        onClick={toggle}
        disabled={saving}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
          enabled ? "bg-emerald-500" : "bg-zinc-200 dark:bg-zinc-800"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            enabled ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
