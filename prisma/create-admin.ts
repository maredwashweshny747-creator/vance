/**
 * Creates a new admin account (a User with role ADMIN) plus the Gym they own.
 * This replaces the self-serve sign-up page, which was intentionally removed —
 * this is now the only way to create a new gym/admin.
 *
 * Usage (interactive prompts for anything not passed as a flag):
 *   npx tsx prisma/create-admin.ts
 *
 * Or fully non-interactive:
 *   npx tsx prisma/create-admin.ts \
 *     --name "Jane Doe" \
 *     --email jane@ironcladfc.com \
 *     --password "a-real-password" \
 *     --gym "Ironclad Fight Club" \
 *     --slug ironclad
 *
 * --slug is optional — if omitted it's generated from the gym name.
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import * as readline from 'readline'

const prisma = new PrismaClient()

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 ? process.argv[i + 1] : undefined
}

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer.trim()) }))
}

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

async function main() {
  const name = flag('name') || await ask('Admin full name: ')
  const email = (flag('email') || await ask('Admin email: ')).toLowerCase().trim()
  const password = flag('password') || await ask('Admin password (min 8 characters): ')
  const gymName = flag('gym') || await ask('Gym name: ')
  let slug = flag('slug') || slugify(gymName)

  if (!name || !email || !password || !gymName) {
    console.error('Name, email, password, and gym name are all required.')
    process.exit(1)
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.')
    process.exit(1)
  }

  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (existingUser) {
    console.error(`A user with email "${email}" already exists.`)
    process.exit(1)
  }

  // Make sure the slug is unique — append a number if it collides.
  let attempt = 0
  while (await prisma.gym.findUnique({ where: { slug } })) {
    attempt++
    slug = `${slugify(gymName)}-${attempt}`
  }

  const hashed = await bcrypt.hash(password, 12)

  const { user, gym } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name, email, password: hashed, role: 'ADMIN' },
    })
    const gym = await tx.gym.create({
      data: { name: gymName, slug, ownerId: user.id },
    })
    return { user, gym }
  })

  console.log('✓ Admin account created')
  console.log(`  Name:  ${user.name}`)
  console.log(`  Email: ${user.email}`)
  console.log(`  Gym:   ${gym.name} (slug: ${gym.slug})`)
  console.log('\nSign in at /auth/login with this email and password.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
