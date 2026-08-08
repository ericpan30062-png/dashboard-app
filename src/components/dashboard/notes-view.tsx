"use client";

import { useState } from "react";
import { Loader2, Pencil, Trash2, X } from "lucide-react";
import type { Note } from "@/lib/notion";

const BODY_MAX = 2000;
const emptyForm = { title: "", body: "" };

function formatUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NotesView({ initialNotes }: { initialNotes: Note[] }) {
  const [notes, setNotes] = useState(initialNotes);
  const [form, setForm] = useState(emptyForm);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!form.title.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Couldn't create the note");
        return;
      }
      setNotes((prev) => [body.note, ...prev]);
      setForm(emptyForm);
    } finally {
      setAdding(false);
    }
  }

  function startEdit(note: Note) {
    setEditingId(note.id);
    setEditForm({ title: note.title, body: note.body });
    setError(null);
  }

  async function handleSaveEdit(id: string) {
    if (!editForm.title.trim()) return;
    setSavingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/notes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Couldn't save the note");
        return;
      }
      setNotes((prev) => prev.map((n) => (n.id === id ? body.note : n)));
      setEditingId(null);
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    await fetch(`/api/notes/${id}`, { method: "DELETE" });
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <input
          placeholder="Note title"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          className="rounded-md border border-zinc-200 bg-transparent px-3 py-1.5 text-sm dark:border-zinc-800"
        />
        <textarea
          placeholder="Write your note..."
          value={form.body}
          maxLength={BODY_MAX}
          onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
          rows={4}
          className="resize-y rounded-md border border-zinc-200 bg-transparent px-3 py-1.5 text-sm dark:border-zinc-800"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500">
            {form.body.length}/{BODY_MAX}
          </span>
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding || !form.title.trim()}
            className="flex items-center justify-center gap-2 rounded-md bg-zinc-950 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            {adding && <Loader2 className="h-4 w-4 animate-spin" />}
            Add note
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {notes.map((note) => (
          <div
            key={note.id}
            className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
          >
            {editingId === note.id ? (
              <div className="flex flex-col gap-3">
                <input
                  value={editForm.title}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, title: e.target.value }))
                  }
                  className="rounded-md border border-zinc-200 bg-transparent px-3 py-1.5 text-sm font-medium dark:border-zinc-800"
                />
                <textarea
                  value={editForm.body}
                  maxLength={BODY_MAX}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, body: e.target.value }))
                  }
                  rows={4}
                  className="resize-y rounded-md border border-zinc-200 bg-transparent px-3 py-1.5 text-sm dark:border-zinc-800"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">
                    {editForm.body.length}/{BODY_MAX}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-900"
                    >
                      <X className="h-4 w-4" strokeWidth={1.75} />
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(note.id)}
                      disabled={savingId === note.id || !editForm.title.trim()}
                      className="flex items-center gap-2 rounded-md bg-zinc-950 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
                    >
                      {savingId === note.id && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      Save
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-zinc-950 dark:text-zinc-50">
                    {note.title}
                  </p>
                  {note.body && (
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                      {note.body}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-zinc-500">
                    Updated {formatUpdatedAt(note.updatedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => startEdit(note)}
                    aria-label="Edit"
                    className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                  >
                    <Pencil className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(note.id)}
                    aria-label="Delete"
                    className="text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {notes.length === 0 && (
          <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950">
            No notes yet — add one above.
          </p>
        )}
      </div>
    </div>
  );
}
