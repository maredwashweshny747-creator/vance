import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

/**
 * Call at the top of every API route.
 * Returns { session, gym } for valid users (ADMIN, RECEPTIONIST, and COACH).
 * Returns { error: NextResponse } if unauthorized or gym not found.
 */
export async function getSessionAndGym() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const user = session.user as any

  let gym = null

  if ((user.role === 'RECEPTIONIST' || user.role === 'COACH') && user.staffGymId) {
    // Receptionist / Coach: look up gym by staffGymId
    gym = await prisma.gym.findUnique({ where: { id: user.staffGymId } })
  } else {
    // Admin: look up gym by ownerId
    gym = await prisma.gym.findUnique({ where: { ownerId: user.id } })
  }

  if (!gym) {
    return { error: NextResponse.json({ error: 'Gym not found. Please complete setup.' }, { status: 404 }) }
  }

  return { session, gym, user }
}

/** Returns true if the current user is an admin */
export function isAdmin(session: any) {
  return (session?.user as any)?.role === 'ADMIN'
}

/** Returns true if the current user is a coach */
export function isCoach(session: any) {
  return (session?.user as any)?.role === 'COACH'
}

/** Returns true if the current user is a receptionist */
export function isReceptionist(session: any) {
  return (session?.user as any)?.role === 'RECEPTIONIST'
}

/**
 * For a COACH-role session, returns their own Coach profile (or null).
 * Used to scope classes/payroll/etc to "my own" records.
 */
export async function getOwnCoachProfile(gymId: string, userId: string) {
  return prisma.coach.findFirst({ where: { gymId, userId } })
}
