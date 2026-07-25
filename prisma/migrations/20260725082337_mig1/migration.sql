/*
  Warnings:

  - You are about to drop the column `endDate` on the `Member` table. All the data in the column will be lost.
  - You are about to drop the column `freezeStartedAt` on the `Member` table. All the data in the column will be lost.
  - You are about to drop the column `freezeWeeks` on the `Member` table. All the data in the column will be lost.
  - You are about to drop the column `membershipPlanId` on the `Member` table. All the data in the column will be lost.
  - You are about to drop the column `membershipStatus` on the `Member` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `Member` table. All the data in the column will be lost.
  - You are about to drop the column `totalFreezeWeeks` on the `Member` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Member" DROP CONSTRAINT "Member_membershipPlanId_fkey";

-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "sports" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "CheckIn" ADD COLUMN     "memberPlanId" TEXT;

-- AlterTable
ALTER TABLE "GymClass" ADD COLUMN     "createdById" TEXT;

-- AlterTable
ALTER TABLE "Member" DROP COLUMN "endDate",
DROP COLUMN "freezeStartedAt",
DROP COLUMN "freezeWeeks",
DROP COLUMN "membershipPlanId",
DROP COLUMN "membershipStatus",
DROP COLUMN "startDate",
DROP COLUMN "totalFreezeWeeks",
ADD COLUMN     "createdById" TEXT;

-- AlterTable
ALTER TABLE "MembershipPlan" ADD COLUMN     "category" TEXT;

-- CreateTable
CREATE TABLE "MemberPlan" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "freezeStartedAt" TIMESTAMP(3),
    "totalFreezeDaysLeft" INTEGER DEFAULT 0,
    "addedById" TEXT,
    "lastAction" TEXT,
    "lastActionById" TEXT,
    "lastActionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceException" (
    "id" TEXT NOT NULL,
    "memberPlanId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceException_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MemberPlan" ADD CONSTRAINT "MemberPlan_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberPlan" ADD CONSTRAINT "MemberPlan_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MembershipPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_memberPlanId_fkey" FOREIGN KEY ("memberPlanId") REFERENCES "MemberPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceException" ADD CONSTRAINT "AttendanceException_memberPlanId_fkey" FOREIGN KEY ("memberPlanId") REFERENCES "MemberPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
