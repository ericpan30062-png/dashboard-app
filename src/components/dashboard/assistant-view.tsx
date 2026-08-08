"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

type Status = "idle" | "loading" | "ready" | "error";

export function AssistantView() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleAsk() {
    if (!question.trim()) return;
    setStatus("loading");
    setError(null);
    setAnswer(null);
    try {
      const res = await fetch("/api/assistant/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Something went wrong");
        setStatus("error");
        return;
      }
      setAnswer(body.answer);
      setStatus("ready");
    } catch {
      setError("Something went wrong");
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <textarea
          placeholder="Ask about your assignments, schedule, courses, or notes..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={3}
          className="resize-y rounded-md border border-zinc-200 bg-transparent px-3 py-1.5 text-sm dark:border-zinc-800"
        />
        <button
          type="button"
          onClick={handleAsk}
          disabled={status === "loading" || !question.trim()}
          className="flex items-center justify-center gap-2 self-start rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          {status === "loading" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" strokeWidth={1.75} />
          )}
          Ask
        </button>
      </div>

      {status === "error" && error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          {error}
        </p>
      )}

      {status === "ready" && answer && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-800 dark:text-zinc-200">
            {answer}
          </p>
        </div>
      )}
    </div>
  );
}
