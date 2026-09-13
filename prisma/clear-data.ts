/**
 * Wipes ALL data from the database — every gym, fighter, class, payment,
 * attendance record, lead, coach, staff account, everything — while leaving
 * the schema and migration history completely untouched.
 *
 * This is a hard reset. There is no confirmation prompt beyond the one
 * below and no undo. Use it to clear seed/test data before going live with
 * real gym data, not on a database you actually care about.
 *
 * Run with:  npx tsx prisma/clear-data.ts
 * Skip the prompt (e.g. in CI):  npx tsx prisma/clear-data.ts --yes
 */
import { PrismaClient } from '@prisma/client'
import * as readline from 'readline'

const prisma = new PrismaClient()

async function confirm(): Promise<boolean> {
  if (process.argv.includes('--yes')) return true
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const answer: string = await new Promise(resolve =>
    rl.question('This will permanently delete ALL data in this database. Type "DELETE" to continue: ', resolve)
  )
  rl.close()
  return answer.trim() === 'DELETE'
}

async function main() {
  const ok = await confirm()
  if (!ok) {
    console.log('Aborted — no data was deleted.')
    return
  }

  console.log('Wiping all data...')

  // Deleted in child-to-parent order so no foreign key is ever violated,
  // regardless of each relation's own onDelete setting.
  await prisma.planExercise.deleteMany()
  await prisma.workoutPlan.deleteMany()
  await prisma.fighterFeedback.deleteMany()
  await prisma.memberProgress.deleteMany()
  await prisma.storeSale.deleteMany()
  await prisma.inventoryItem.deleteMany()
  await prisma.branch.deleteMany()
  await prisma.coachPayrollRun.deleteMany()
  await prisma.payrollRun.deleteMany()
  await prisma.staff.deleteMany()
  await prisma.leadInteraction.deleteMany()
  await prisma.lead.deleteMany()
  await prisma.announcement.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.classBooking.deleteMany()
  await prisma.classAttendance.deleteMany()
  await prisma.classEnrollment.deleteMany()
  await prisma.classOffer.deleteMany()
  await prisma.coachAttendance.deleteMany()
  await prisma.gymClass.deleteMany()
  await prisma.coach.deleteMany()
  await prisma.member.deleteMany()
  await prisma.gym.deleteMany()
  await prisma.session.deleteMany()
  await prisma.account.deleteMany()
  await prisma.user.deleteMany()

  console.log('✓ Database wiped. Schema and migrations are untouched.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
