import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/auth/login',
    newUser: '/auth/register',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email:    { label: 'Email',    type: 'email'    },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        })
        if (!user || !user.password) return null
        const isValid = await bcrypt.compare(credentials.password, user.password)
        if (!isValid) return null
        return {
          id:         user.id,
          email:      user.email,
          name:       user.name  ?? undefined,
          image:      user.image ?? undefined,
          role:       user.role,
          staffGymId: user.staffGymId ?? undefined,
        } as any
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id         = (user as any).id
        token.role       = (user as any).role
        token.staffGymId = (user as any).staffGymId
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id         = token.id
        ;(session.user as any).role       = token.role
        ;(session.user as any).staffGymId = token.staffGymId
      }
      return session
    },
  },
}
