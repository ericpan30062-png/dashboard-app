-- CreateTable
CREATE TABLE "procrastination_nudges" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "procrastination_nudges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "procrastination_nudges_userId_idx" ON "procrastination_nudges"("userId");

-- CreateIndex
CREATE INDEX "procrastination_nudges_assignmentId_idx" ON "procrastination_nudges"("assignmentId");

-- AddForeignKey
ALTER TABLE "procrastination_nudges" ADD CONSTRAINT "procrastination_nudges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procrastination_nudges" ADD CONSTRAINT "procrastination_nudges_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
