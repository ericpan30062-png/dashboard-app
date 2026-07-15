import { z } from "zod";

// Mirrors the Prisma `AssignmentType` enum (prisma/schema.prisma) — kept as
// a separate zod enum because the Claude structured-output schema and the
// client-side review form both need it without importing the generated
// Prisma client.
export const AssignmentTypeEnum = z.enum([
  "EXAM",
  "PAPER",
  "HOMEWORK",
  "PROJECT",
]);

export const ExtractedAssignmentSchema = z.object({
  name: z.string(),
  // Free text: syllabus due dates are often irregular ("Week 5 Friday",
  // "TBD"), and null means the syllabus didn't state one.
  dueDate: z.string().nullable(),
  // Percentage of the final grade, e.g. 25 for "25%". Null if not stated.
  weight: z.number().nullable(),
  type: AssignmentTypeEnum,
});

export const ExtractedAssignmentsSchema = z.object({
  assignments: z.array(ExtractedAssignmentSchema),
});

export type ExtractedAssignment = z.infer<typeof ExtractedAssignmentSchema>;
