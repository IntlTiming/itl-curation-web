-- CreateEnum
CREATE TYPE "SelectionAction" AS ENUM ('SELECTED', 'UNSELECTED');

-- CreateTable
CREATE TABLE "submission_selections" (
    "submissionId" TEXT NOT NULL,
    "selectedById" TEXT NOT NULL,
    "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_selections_pkey" PRIMARY KEY ("submissionId")
);

-- CreateTable
CREATE TABLE "submission_selection_logs" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "SelectionAction" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_selection_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "submission_selection_logs_submissionId_createdAt_idx" ON "submission_selection_logs"("submissionId", "createdAt");

-- AddForeignKey
ALTER TABLE "submission_selections" ADD CONSTRAINT "submission_selections_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("fileId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_selections" ADD CONSTRAINT "submission_selections_selectedById_fkey" FOREIGN KEY ("selectedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_selection_logs" ADD CONSTRAINT "submission_selection_logs_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("fileId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_selection_logs" ADD CONSTRAINT "submission_selection_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
