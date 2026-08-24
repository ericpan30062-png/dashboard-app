import Link from "next/link";
import { formatCanvasDueDate, type CanvasAssignment } from "@/lib/canvas";

// `homework === null` means Canvas isn't connected (distinct from an empty
// array, which means "connected, nothing due") — the two need different
// messaging, so this isn't collapsed into a single "no homework" state.
export function UpcomingHomework({
  homework,
  error,
}: {
  homework: CanvasAssignment[] | null;
  error: string | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
        Upcoming homework
      </h3>
      {error ? (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950">
          {error}
        </p>
      ) : homework === null ? (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950">
          Connect Canvas to see homework due here.{" "}
          <Link
            href="/dashboard/courses"
            className="font-medium text-zinc-950 underline dark:text-zinc-50"
          >
            Go to Courses settings
          </Link>
        </p>
      ) : homework.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {homework.map((a) => (
            <li
              key={a.id}
              className="flex items-baseline justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <span className="font-medium text-zinc-950 dark:text-zinc-50">{a.name}</span>
              <span className="shrink-0 text-xs text-zinc-500">
                {a.courseName} · {formatCanvasDueDate(a.dueAt)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950">
          Nothing due in the next 30 days.
        </p>
      )}
    </div>
  );
}
