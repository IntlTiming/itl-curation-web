/*
  Warnings:

  - Added the required column `submittedAt` to the `submissions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "submissions" ADD COLUMN     "submittedAt" TIMESTAMP(3) NOT NULL;
