import { prisma } from "@/lib/prisma";
import { parseDueDate, daysUntil } from "@/lib/grade-impact";
import {
  getAuthenticatedClient,
  listBusyIntervals,
  getAvailableTime,
  type CalendarBusyInterval,
} from "@/lib/google-calendar";
import { getCanvasCredentials, listCourseModuleTopics } from "@/lib/canvas";
import { generateExamPlan } from "@/lib/exam-plan-generator";
import type { Assignment } from "@/generated/prisma/client";

const LOOKAHEAD_DAYS = 7;

async function createExamPlanForAssignment(
  assignment: Assignment,
  dueDate: Date,
  daysUntilExam: number,
  now: Date,
): Promise<void> {
  let topics: string[] = [];
  if (assignment.canvasCourseId) {
    const creds = await getCanvasCredentials(assignment.userId);
    if (creds) {
      try {
        topics = await listCourseModuleTopics(creds, assignment.canvasCourseId);
      } catch (error) {
        console.error(`Canvas module fetch failed for assignment ${assignment.id}:`, error);
      }
    }
  }

  let busy: CalendarBusyInterval[] | null = null;
  const client = await getAuthenticatedClient(assignment.userId);
  if (client) {
    try {
      busy = await listBusyIntervals(client, now, dueDate);
    } catch (error) {
      console.error(`Calendar fetch failed for assignment ${assignment.id}:`, error);
    }
  }
  const availableTimePerDay = getAvailableTime(busy, now, dueDate);

  const planDays = await generateExamPlan({
    examName: assignment.name,
    course: assignment.course,
    topics,
    daysUntilExam,
    availableTimePerDay,
  });

  if (planDays.length === 0) {
    throw new Error("Claude returned an empty exam plan");
  }

  await prisma.examPlan.create({
    data: {
      userId: assignment.userId,
      assignmentId: assignment.id,
      days: {
        create: planDays.map((d) => ({
          date: d.date,
          estimatedDurationMinutes: Math.max(0, Math.round(d.estimatedDurationMinutes)),
          topics: { create: d.topics.map((topic) => ({ topic })) },
        })),
      },
    },
  });
}

export type ExamPlanCheckResult = {
  checked: number;
  created: number;
  errors: { assignmentId: string; message: string }[];
};

// Meant to run daily (see GET /api/cron/exam-plans). Scans every user's EXAM
// assignments; for any that fall within LOOKAHEAD_DAYS and don't already
// have a plan, generates one. Idempotent by design — an assignment that
// already has an ExamPlan is skipped, so a student's checked-off topics are
// never wiped out by a later run of this job.
export async function runExamPlanCheck(now: Date = new Date()): Promise<ExamPlanCheckResult> {
  const examAssignments = await prisma.assignment.findMany({
    where: { type: "EXAM" },
    include: { examPlan: true },
  });

  let checked = 0;
  let created = 0;
  const errors: ExamPlanCheckResult["errors"] = [];

  for (const assignment of examAssignments) {
    const dueDate = parseDueDate(assignment.dueDate);
    if (!dueDate) continue;

    const days = daysUntil(dueDate, now);
    if (days < 0 || days > LOOKAHEAD_DAYS) continue;

    checked += 1;
    if (assignment.examPlan) continue;

    try {
      await createExamPlanForAssignment(assignment, dueDate, days, now);
      created += 1;
    } catch (error) {
      console.error(`Exam plan generation failed for assignment ${assignment.id}:`, error);
      errors.push({
        assignmentId: assignment.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { checked, created, errors };
}
