/*
  Warnings:

  - A unique constraint covering the columns `[phone]` on the table `Member` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "parentPhone" TEXT;

-- CreateIndex
CREATE INDEX "ClassAttendance_classId_date_idx" ON "ClassAttendance"("classId", "date");

-- CreateIndex
CREATE INDEX "ClassAttendance_memberId_idx" ON "ClassAttendance"("memberId");

-- CreateIndex
CREATE INDEX "Lead_gymId_status_idx" ON "Lead"("gymId", "status");

-- CreateIndex
CREATE INDEX "Lead_gymId_createdAt_idx" ON "Lead"("gymId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Member_phone_key" ON "Member"("phone");

-- CreateIndex
CREATE INDEX "Member_gymId_idx" ON "Member"("gymId");

-- CreateIndex
CREATE INDEX "Payment_gymId_paidAt_idx" ON "Payment"("gymId", "paidAt");

-- CreateIndex
CREATE INDEX "Payment_gymId_status_idx" ON "Payment"("gymId", "status");

-- CreateIndex
CREATE INDEX "Payment_memberId_idx" ON "Payment"("memberId");

-- CreateIndex
CREATE INDEX "Payment_classId_idx" ON "Payment"("classId");

-- CreateIndex
CREATE INDEX "Payment_enrollmentId_idx" ON "Payment"("enrollmentId");
