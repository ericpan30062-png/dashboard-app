-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "canvasCourseId" TEXT,
ADD COLUMN     "estimatedHours" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "semesterStartDate" TIMESTAMP(3);
