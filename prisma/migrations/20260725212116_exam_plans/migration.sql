-- CreateTable
CREATE TABLE "exam_plans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_plan_days" (
    "id" TEXT NOT NULL,
    "examPlanId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "estimatedDurationMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_plan_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_plan_topics" (
    "id" TEXT NOT NULL,
    "examPlanDayId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_plan_topics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exam_plans_assignmentId_key" ON "exam_plans"("assignmentId");

-- CreateIndex
CREATE INDEX "exam_plans_userId_idx" ON "exam_plans"("userId");

-- CreateIndex
CREATE INDEX "exam_plan_days_examPlanId_idx" ON "exam_plan_days"("examPlanId");

-- CreateIndex
CREATE INDEX "exam_plan_topics_examPlanDayId_idx" ON "exam_plan_topics"("examPlanDayId");

-- AddForeignKey
ALTER TABLE "exam_plans" ADD CONSTRAINT "exam_plans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_plans" ADD CONSTRAINT "exam_plans_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_plan_days" ADD CONSTRAINT "exam_plan_days_examPlanId_fkey" FOREIGN KEY ("examPlanId") REFERENCES "exam_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_plan_topics" ADD CONSTRAINT "exam_plan_topics_examPlanDayId_fkey" FOREIGN KEY ("examPlanDayId") REFERENCES "exam_plan_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;
