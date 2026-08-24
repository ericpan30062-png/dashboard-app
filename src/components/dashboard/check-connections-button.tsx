"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function CheckConnectionsButton() {
  const router = useRouter();
  const [checking, setChecking] = useState(false);

  async function handleCheck() {
    setChecking(true);
    try {
      await fetch("/api/settings/check-connections", { method: "POST" });
      router.refresh();
    } finally {
      setChecking(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCheck}
      disabled={checking}
      className="flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
    >
      <RefreshCw className={`h-3 w-3 ${checking ? "animate-spin" : ""}`} strokeWidth={1.75} />
      {checking ? "Checking…" : "Check now"}
    </button>
  );
}
