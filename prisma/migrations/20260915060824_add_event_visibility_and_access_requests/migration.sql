-- CreateEnum
CREATE TYPE "EventVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "visibility" "EventVisibility" NOT NULL DEFAULT 'PRIVATE';

-- CreateTable
CREATE TABLE "event_access_requests" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_access_requests_eventId_idx" ON "event_access_requests"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "event_access_requests_eventId_userId_key" ON "event_access_requests"("eventId", "userId");

-- AddForeignKey
ALTER TABLE "event_access_requests" ADD CONSTRAINT "event_access_requests_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_access_requests" ADD CONSTRAINT "event_access_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
