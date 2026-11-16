-- CreateTable
CREATE TABLE "suggestions" (
    "eventId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "submitter" TEXT NOT NULL,
    "chart" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "consentToPublicReview" "ConsentToPublicReview",
    "linkedSubmissionId" TEXT,
    "linkedAt" TIMESTAMP(3),
    "linkedById" TEXT,
    "lastReviewAt" TIMESTAMP(3),
    "lastCommentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suggestions_pkey" PRIMARY KEY ("eventId","position")
);

-- CreateTable
CREATE TABLE "suggestion_reviews" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "suggestionPosition" INTEGER NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "rating" INTEGER,
    "passing" INTEGER,
    "scoring" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suggestion_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suggestion_review_basic_checks" (
    "reviewId" TEXT NOT NULL,
    "basicCheckReasonId" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "suggestion_review_basic_checks_pkey" PRIMARY KEY ("reviewId","basicCheckReasonId")
);

-- CreateTable
CREATE TABLE "suggestion_review_revisions" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "rating" INTEGER,
    "passing" INTEGER,
    "scoring" INTEGER,
    "notes" TEXT,
    "supersededAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededById" TEXT NOT NULL,

    CONSTRAINT "suggestion_review_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suggestion_review_revision_basic_checks" (
    "reviewRevisionId" TEXT NOT NULL,
    "basicCheckReasonId" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "suggestion_review_revision_basic_checks_pkey" PRIMARY KEY ("reviewRevisionId","basicCheckReasonId")
);

-- CreateTable
CREATE TABLE "suggestion_comments" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "suggestionPosition" INTEGER NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suggestion_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suggestion_comment_reactions" (
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suggestion_comment_reactions_pkey" PRIMARY KEY ("commentId","userId","emoji")
);

-- CreateIndex
CREATE INDEX "suggestions_linkedSubmissionId_idx" ON "suggestions"("linkedSubmissionId");

-- CreateIndex
CREATE INDEX "suggestion_reviews_eventId_suggestionPosition_idx" ON "suggestion_reviews"("eventId", "suggestionPosition");

-- CreateIndex
CREATE INDEX "suggestion_reviews_reviewerId_idx" ON "suggestion_reviews"("reviewerId");

-- CreateIndex
CREATE UNIQUE INDEX "suggestion_reviews_eventId_suggestionPosition_reviewerId_key" ON "suggestion_reviews"("eventId", "suggestionPosition", "reviewerId");

-- CreateIndex
CREATE INDEX "suggestion_review_revisions_reviewId_idx" ON "suggestion_review_revisions"("reviewId");

-- CreateIndex
CREATE INDEX "suggestion_comments_eventId_suggestionPosition_idx" ON "suggestion_comments"("eventId", "suggestionPosition");

-- AddForeignKey
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_linkedSubmissionId_fkey" FOREIGN KEY ("linkedSubmissionId") REFERENCES "submissions"("fileId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_linkedById_fkey" FOREIGN KEY ("linkedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestion_reviews" ADD CONSTRAINT "suggestion_reviews_eventId_suggestionPosition_fkey" FOREIGN KEY ("eventId", "suggestionPosition") REFERENCES "suggestions"("eventId", "position") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestion_reviews" ADD CONSTRAINT "suggestion_reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestion_review_basic_checks" ADD CONSTRAINT "suggestion_review_basic_checks_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "suggestion_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestion_review_basic_checks" ADD CONSTRAINT "suggestion_review_basic_checks_basicCheckReasonId_fkey" FOREIGN KEY ("basicCheckReasonId") REFERENCES "basic_check_reasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestion_review_revisions" ADD CONSTRAINT "suggestion_review_revisions_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "suggestion_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestion_review_revisions" ADD CONSTRAINT "suggestion_review_revisions_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestion_review_revision_basic_checks" ADD CONSTRAINT "suggestion_review_revision_basic_checks_reviewRevisionId_fkey" FOREIGN KEY ("reviewRevisionId") REFERENCES "suggestion_review_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestion_review_revision_basic_checks" ADD CONSTRAINT "suggestion_review_revision_basic_checks_basicCheckReasonId_fkey" FOREIGN KEY ("basicCheckReasonId") REFERENCES "basic_check_reasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestion_comments" ADD CONSTRAINT "suggestion_comments_eventId_suggestionPosition_fkey" FOREIGN KEY ("eventId", "suggestionPosition") REFERENCES "suggestions"("eventId", "position") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestion_comments" ADD CONSTRAINT "suggestion_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestion_comment_reactions" ADD CONSTRAINT "suggestion_comment_reactions_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "suggestion_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestion_comment_reactions" ADD CONSTRAINT "suggestion_comment_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
