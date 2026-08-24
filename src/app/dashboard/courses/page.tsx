import { auth } from "@clerk/nextjs/server";
import { GraduationCap } from "lucide-react";
import { getOrCreateUser } from "@/lib/clerk-sync";
import { CanvasConnection } from "@/components/dashboard/canvas-connection";
import {
  getCanvasCredentials,
  listCanvasCourses,
  listAllCanvasAssignments,
  formatCanvasDueDate,
  type CanvasCourse,
  type CanvasAssignment,
} from "@/lib/canvas";

// Per-course cap so one assignment-heavy course doesn't push every other
// course's homework off screen.
const MAX_ASSIGNMENTS_PER_COURSE = 8;

export default async function CoursesPage() {
  await auth.protect();
  const user = await getOrCreateUser();
  const integration = user?.integrations.find((i) => i.provider === "CANVAS");
  const connected = Boolean(integration?.connectedAt);

  let courses: CanvasCourse[] = [];
  let assignmentsByCourse = new Map<string, CanvasAssignment[]>();
  let coursesError: string | null = null;
  if (connected && user) {
    const creds = await getCanvasCredentials(user.id);
    if (creds) {
      try {
        courses = await listCanvasCourses(creds);
        const assignments = await listAllCanvasAssignments(creds, courses);
        assignments.sort((a, b) => {
          if (!a.dueAt && !b.dueAt) return 0;
          if (!a.dueAt) return 1;
          if (!b.dueAt) return -1;
          return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
        });
        assignmentsByCourse = assignments.reduce((map, a) => {
          const list = map.get(a.courseId) ?? [];
          list.push(a);
          map.set(a.courseId, list);
          return map;
        }, new Map<string, CanvasAssignment[]>());
      } catch (error) {
        console.error("Courses page: Canvas fetch failed:", error);
        coursesError = "Couldn't load your Canvas courses — try again in a bit.";
      }
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          Canvas LMS
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Connect Canvas so the study session sizer can pull in a course&apos;s
          module topics when estimating how long an assignment will take.
        </p>
      </div>

      <CanvasConnection connected={connected} />

      {connected && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            Your courses &amp; homework
          </h3>
          {coursesError ? (
            <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950">
              {coursesError}
            </p>
          ) : courses.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {courses.map((course) => {
                const homework = (assignmentsByCourse.get(course.id) ?? []).slice(
                  0,
                  MAX_ASSIGNMENTS_PER_COURSE,
                );
                return (
                  <li
                    key={course.id}
                    className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    <div className="flex items-center gap-3">
                      <GraduationCap
                        className="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400"
                        strokeWidth={1.75}
                      />
                      <span className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                        {course.name}
                      </span>
                    </div>
                    {homework.length > 0 ? (
                      <ul className="ml-7 flex flex-col gap-1.5 border-l border-zinc-200 pl-3 dark:border-zinc-800">
                        {homework.map((a) => (
                          <li
                            key={a.id}
                            className="flex items-baseline justify-between gap-3 text-xs"
                          >
                            <span className="text-zinc-700 dark:text-zinc-300">{a.name}</span>
                            <span className="shrink-0 text-zinc-500">
                              {formatCanvasDueDate(a.dueAt)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="ml-7 text-xs text-zinc-500">No homework posted.</p>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950">
              No active courses found in Canvas.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
