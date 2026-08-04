-- AlterTable
ALTER TABLE "CoachAttendance" ADD COLUMN     "assignedCoachId" TEXT;

-- CreateTable
CREATE TABLE "ClassOffer" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "months" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "label" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FighterFeedback" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FighterFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FighterFeedback_gymId_isRead_idx" ON "FighterFeedback"("gymId", "isRead");

-- AddForeignKey
ALTER TABLE "ClassOffer" ADD CONSTRAINT "ClassOffer_classId_fkey" FOREIGN KEY ("classId") REFERENCES "GymClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FighterFeedback" ADD CONSTRAINT "FighterFeedback_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FighterFeedback" ADD CONSTRAINT "FighterFeedback_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
