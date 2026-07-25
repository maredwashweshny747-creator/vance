import type { Metadata } from 'next'
import { Bebas_Neue, DM_Sans, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/ui/Providers'

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'Vance — The All-in-One Gym Management Platform',
  description:
    'Streamline your gym operations with Vance. Member management, class scheduling, payments, analytics, and more — all in one powerful platform.',
  keywords: 'gym management, fitness software, member management, class scheduling, gym billing',
  openGraph: {
    title: 'Vance — Gym Management Made Effortless',
    description: 'The complete platform for gym owners to manage members, classes, payments, and grow their business.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${bebasNeue.variable} ${dmSans.variable} ${jetbrainsMono.variable} font-body antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
