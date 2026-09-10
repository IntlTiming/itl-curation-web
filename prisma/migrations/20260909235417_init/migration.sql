-- CreateEnum
CREATE TYPE "EventRoleType" AS ENUM ('REVIEWER', 'ADMIN');

-- CreateEnum
CREATE TYPE "Playstyle" AS ENUM ('SINGLE', 'DOUBLE');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('BEGINNER', 'EASY', 'MEDIUM', 'HARD', 'CHALLENGE');

-- CreateEnum
CREATE TYPE "CmodPreference" AS ENUM ('CMOD_OKAY', 'NO_CMOD', 'NOT_STEPARTIST');

-- CreateEnum
CREATE TYPE "ConsentToPublicReview" AS ENUM ('CONSENTS', 'DOES_NOT_CONSENT', 'NOT_STEPARTIST');

-- CreateEnum
CREATE TYPE "TechCategory" AS ENUM ('BXF', 'TECH', 'NOTECH');

-- CreateEnum
CREATE TYPE "DisqualificationStatus" AS ENUM ('ACTIVE', 'POSSIBLY_RESOLVED', 'CLEARED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "discordUsername" TEXT NOT NULL,
    "discordAvatarHash" TEXT,
    "displayName" TEXT,
    "isGlobalAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_roles" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "EventRoleType" NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "fileId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "submitter" TEXT NOT NULL,
    "stepartist" TEXT NOT NULL,
    "pack" TEXT NOT NULL,
    "playstyle" "Playstyle" NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "focus" TEXT NOT NULL,
    "derivedFocus" TEXT NOT NULL,
    "cmodPreference" "CmodPreference" NOT NULL,
    "releaseYear" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "additionalNotes" TEXT NOT NULL,
    "consentToPublicReview" "ConsentToPublicReview",
    "fileUrl" TEXT NOT NULL,
    "driveMd5" TEXT NOT NULL,
    "processingError" TEXT,
    "songDir" TEXT,
    "bannerSlug" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "singleTechTagId" TEXT,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("fileId")
);

-- CreateTable
CREATE TABLE "charts" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleRomaji" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "subtitleRomaji" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "artistRomaji" TEXT NOT NULL,
    "playstyle" "Playstyle" NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "meter" INTEGER NOT NULL,
    "minBpm" INTEGER NOT NULL,
    "maxBpm" INTEGER NOT NULL,
    "totalSteps" INTEGER NOT NULL,
    "totalRolls" INTEGER NOT NULL,
    "totalHolds" INTEGER NOT NULL,
    "totalMines" INTEGER NOT NULL,
    "totalJumps" INTEGER NOT NULL,
    "lengthSeconds" INTEGER NOT NULL,
    "totalMeasures" INTEGER NOT NULL,
    "totalBreakMeasures" INTEGER NOT NULL,
    "totalStreamMeasures" INTEGER NOT NULL,
    "totalTrueStreamMeasures" INTEGER NOT NULL,
    "weightedNps" INTEGER NOT NULL,
    "hasSignificantTimingChanges" BOOLEAN NOT NULL,
    "bracketCount" INTEGER,
    "halfCrossoverCount" INTEGER,
    "fullCrossoverCount" INTEGER,
    "crossoverCount" INTEGER,
    "downFootswitchCount" INTEGER,
    "upFootswitchCount" INTEGER,
    "footswitchCount" INTEGER,
    "doublestepCount" INTEGER,
    "jackCount" INTEGER,
    "sideswitchCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "charts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tech_tags" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" "TechCategory" NOT NULL,

    CONSTRAINT "tech_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_tech_tags" (
    "submissionId" TEXT NOT NULL,
    "techTagId" TEXT NOT NULL,

    CONSTRAINT "submission_tech_tags_pkey" PRIMARY KEY ("submissionId","techTagId")
);

-- CreateTable
CREATE TABLE "basic_check_reasons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "eventId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "basic_check_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "chartHash" TEXT NOT NULL,
    "rating" INTEGER,
    "passing" INTEGER,
    "scoring" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_basic_checks" (
    "reviewId" TEXT NOT NULL,
    "basicCheckReasonId" TEXT NOT NULL,

    CONSTRAINT "review_basic_checks_pkey" PRIMARY KEY ("reviewId","basicCheckReasonId")
);

-- CreateTable
CREATE TABLE "review_revisions" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "chartHash" TEXT NOT NULL,
    "rating" INTEGER,
    "passing" INTEGER,
    "scoring" INTEGER,
    "notes" TEXT,
    "supersededAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededById" TEXT NOT NULL,

    CONSTRAINT "review_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_revision_basic_checks" (
    "reviewRevisionId" TEXT NOT NULL,
    "basicCheckReasonId" TEXT NOT NULL,

    CONSTRAINT "review_revision_basic_checks_pkey" PRIMARY KEY ("reviewRevisionId","basicCheckReasonId")
);

-- CreateTable
CREATE TABLE "disqualification_reasons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "eventId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "disqualification_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disqualifications" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "chartHash" TEXT NOT NULL,
    "reasonId" TEXT NOT NULL,
    "notes" TEXT,
    "disqualifiedById" TEXT NOT NULL,
    "status" "DisqualificationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "disqualifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_discordId_key" ON "users"("discordId");

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

-- CreateIndex
CREATE INDEX "events_date_idx" ON "events"("date");

-- CreateIndex
CREATE INDEX "event_roles_userId_idx" ON "event_roles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "event_roles_eventId_userId_role_key" ON "event_roles"("eventId", "userId", "role");

-- CreateIndex
CREATE INDEX "submissions_eventId_idx" ON "submissions"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "charts_submissionId_key" ON "charts"("submissionId");

-- CreateIndex
CREATE INDEX "charts_hash_idx" ON "charts"("hash");

-- CreateIndex
CREATE UNIQUE INDEX "tech_tags_code_key" ON "tech_tags"("code");

-- CreateIndex
CREATE UNIQUE INDEX "tech_tags_label_key" ON "tech_tags"("label");

-- CreateIndex
CREATE UNIQUE INDEX "basic_check_reasons_eventId_code_key" ON "basic_check_reasons"("eventId", "code");

-- CreateIndex
CREATE INDEX "reviews_submissionId_idx" ON "reviews"("submissionId");

-- CreateIndex
CREATE INDEX "reviews_reviewerId_idx" ON "reviews"("reviewerId");

-- CreateIndex
CREATE INDEX "reviews_chartHash_idx" ON "reviews"("chartHash");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_submissionId_reviewerId_key" ON "reviews"("submissionId", "reviewerId");

-- CreateIndex
CREATE INDEX "review_revisions_reviewId_idx" ON "review_revisions"("reviewId");

-- CreateIndex
CREATE INDEX "review_revisions_chartHash_idx" ON "review_revisions"("chartHash");

-- CreateIndex
CREATE UNIQUE INDEX "disqualification_reasons_eventId_code_key" ON "disqualification_reasons"("eventId", "code");

-- CreateIndex
CREATE INDEX "disqualifications_submissionId_status_idx" ON "disqualifications"("submissionId", "status");

-- CreateIndex
CREATE INDEX "disqualifications_chartHash_idx" ON "disqualifications"("chartHash");

-- AddForeignKey
ALTER TABLE "event_roles" ADD CONSTRAINT "event_roles_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_roles" ADD CONSTRAINT "event_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_singleTechTagId_fkey" FOREIGN KEY ("singleTechTagId") REFERENCES "tech_tags"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charts" ADD CONSTRAINT "charts_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("fileId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_tech_tags" ADD CONSTRAINT "submission_tech_tags_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("fileId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_tech_tags" ADD CONSTRAINT "submission_tech_tags_techTagId_fkey" FOREIGN KEY ("techTagId") REFERENCES "tech_tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "basic_check_reasons" ADD CONSTRAINT "basic_check_reasons_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("fileId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_basic_checks" ADD CONSTRAINT "review_basic_checks_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_basic_checks" ADD CONSTRAINT "review_basic_checks_basicCheckReasonId_fkey" FOREIGN KEY ("basicCheckReasonId") REFERENCES "basic_check_reasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_revisions" ADD CONSTRAINT "review_revisions_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_revisions" ADD CONSTRAINT "review_revisions_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_revision_basic_checks" ADD CONSTRAINT "review_revision_basic_checks_reviewRevisionId_fkey" FOREIGN KEY ("reviewRevisionId") REFERENCES "review_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_revision_basic_checks" ADD CONSTRAINT "review_revision_basic_checks_basicCheckReasonId_fkey" FOREIGN KEY ("basicCheckReasonId") REFERENCES "basic_check_reasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disqualification_reasons" ADD CONSTRAINT "disqualification_reasons_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disqualifications" ADD CONSTRAINT "disqualifications_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("fileId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disqualifications" ADD CONSTRAINT "disqualifications_reasonId_fkey" FOREIGN KEY ("reasonId") REFERENCES "disqualification_reasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disqualifications" ADD CONSTRAINT "disqualifications_disqualifiedById_fkey" FOREIGN KEY ("disqualifiedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
