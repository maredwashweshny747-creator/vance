'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import {
  Zap, LayoutDashboard, Users, Calendar, CreditCard, BarChart3,
  Settings, LogOut, Menu, X, Bell, UserCheck, Target,
  Package, Building2, DollarSign, ExternalLink, Shield, FileDown, Swords,
} from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'

type Role = 'ADMIN' | 'RECEPTIONIST' | 'COACH'

// roles: which roles see this item. Admin always has full access regardless of what's listed.
const ALL_NAV_GROUPS = [
  {
    label: 'Main',
    items: [
      { href: '/dashboard',            icon: LayoutDashboard, label: 'Dashboard',        roles: ['ADMIN','RECEPTIONIST','COACH'] as Role[] },
      { href: '/dashboard/leads',      icon: Target,          label: 'Leads & CRM',      roles: ['ADMIN','RECEPTIONIST'] as Role[] },
      { href: '/dashboard/members',    icon: Users,           label: 'Members',          roles: ['ADMIN','RECEPTIONIST'] as Role[] },
      { href: '/dashboard/attendance', icon: UserCheck,       label: 'Attendance',       roles: ['ADMIN','RECEPTIONIST','COACH'] as Role[] },
    ],
  },
  {
    label: 'Classes & Schedule',
    items: [
      { href: '/dashboard/classes',    icon: Calendar,        label: 'Classes',          roles: ['ADMIN','RECEPTIONIST','COACH'] as Role[] },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/dashboard/payments',   icon: CreditCard,      label: 'Payments',         roles: ['ADMIN','RECEPTIONIST'] as Role[] },
      { href: '/dashboard/payroll',    icon: DollarSign,      label: 'Payroll',          roles: ['ADMIN'] as Role[] },
      { href: '/dashboard/inventory',  icon: Package,         label: 'Store & Inventory',roles: ['ADMIN','RECEPTIONIST'] as Role[] },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/dashboard/branches',   icon: Building2,       label: 'Branches',         roles: ['ADMIN'] as Role[] },
      { href: '/dashboard/analytics',  icon: BarChart3,       label: 'Analytics',        roles: ['ADMIN'] as Role[] },
    ],
  },
  {
    label: 'Admin',
    items: [
      { href: '/dashboard/import-export', icon: FileDown, label: 'Import & Export', roles: ['ADMIN'] as Role[] },
      { href: '/dashboard/settings',   icon: Settings,        label: 'Settings',         roles: ['ADMIN'] as Role[] },
    ],
  },
]

const ROLE_STYLES: Record<Role, { badge: string; label: string; full: string }> = {
  ADMIN:        { badge: 'bg-primary-400/15 text-primary-400', label: 'Admin',       full: 'Administrator' },
  RECEPTIONIST: { badge: 'bg-blue-400/15 text-blue-400',       label: 'Reception',   full: 'Receptionist'  },
  COACH:        { badge: 'bg-crimson-400/15 text-crimson-400', label: 'Coach',       full: 'Coach'         },
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname    = usePathname()
  const { data: session } = useSession()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const role: Role = ((session?.user as any)?.role ?? 'ADMIN')
  const isAdmin = role === 'ADMIN'
  const roleStyle = ROLE_STYLES[role] || ROLE_STYLES.ADMIN

  // Filter groups based on role — admin always sees everything
  const navGroups = ALL_NAV_GROUPS
    .map(g => ({
      ...g,
      items: g.items.filter(item => isAdmin || item.roles.includes(role)),
    }))
    .filter(g => g.items.length > 0)

  const userName  = session?.user?.name ?? 'User'
  const userEmail = session?.user?.email ?? ''

  return (
    <div className="min-h-screen bg-dark-950 flex">

      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 w-64 bg-dark-900 border-r border-dark-700 flex flex-col transition-transform duration-300',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      )}>

        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-dark-700 flex-shrink-0">
          <div className="w-8 h-8 bg-primary-400 rounded-lg flex items-center justify-center flex-shrink-0">
            <Swords size={16} className="text-dark-950" />
          </div>
          <span className="font-display text-lg tracking-wider text-white">VANCE</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto lg:hidden text-dark-400 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
          {navGroups.map(group => (
            <div key={group.label}>
              <p className="text-dark-600 text-xs font-mono uppercase tracking-widest px-3 mb-1.5">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map(item => {
                  const active = pathname === item.href
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all',
                        active
                          ? 'bg-primary-400/10 text-primary-400 font-medium'
                          : 'text-dark-300 hover:text-white hover:bg-dark-800',
                      )}
                    >
                      <item.icon size={16} className="flex-shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Fighter portal link */}
          <div>
            <p className="text-dark-600 text-xs font-mono uppercase tracking-widest px-3 mb-1.5">
              Portal Access
            </p>
            <a
              href="/portal"
              target="_blank"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-dark-300 hover:text-white hover:bg-dark-800 transition-all"
            >
              <ExternalLink size={16} className="flex-shrink-0" />
              <span className="flex-1">Fighter Portal</span>
              <span className="text-xs bg-blue-400/15 text-blue-400 border border-blue-400/20 px-1.5 py-0.5 rounded-full font-mono leading-none">
                ↗
              </span>
            </a>
          </div>
        </nav>

        {/* User / logout */}
        <div className="p-3 border-t border-dark-700 flex-shrink-0">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-dark-800 transition-colors">
            <div className="w-8 h-8 rounded-full bg-primary-400/20 border border-primary-400/30 flex items-center justify-center text-xs font-bold text-primary-400 flex-shrink-0">
              {getInitials(userName)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-white text-xs font-medium truncate">{userName}</span>
                <span className={cn('text-xs px-1.5 py-0.5 rounded font-mono flex-shrink-0', roleStyle.badge)}>
                  {roleStyle.label}
                </span>
              </div>
              <div className="text-dark-400 text-xs truncate">{userEmail}</div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="text-dark-400 hover:text-crimson-400 transition-colors flex-shrink-0"
              title="Sign out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Main content ─────────────────────────────────────────── */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">

        {/* Top bar */}
        <header className="sticky top-0 z-30 h-16 bg-dark-950/90 backdrop-blur border-b border-dark-700 flex items-center gap-4 px-6 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 rounded-lg hover:bg-dark-800 text-dark-400"
          >
            <Menu size={20} />
          </button>

          <div className="flex-1" />

          {/* Role indicator in top bar (mobile) */}
          <span className={cn(
            'hidden sm:flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border',
            role === 'ADMIN' ? 'bg-primary-400/10 text-primary-400 border-primary-400/20'
            : role === 'COACH' ? 'bg-crimson-400/10 text-crimson-400 border-crimson-400/20'
            : 'bg-blue-400/10 text-blue-400 border-blue-400/20',
          )}>
            <Shield size={11} />
            {roleStyle.full}
          </span>

          <button className="p-2 rounded-xl hover:bg-dark-800 text-dark-400 hover:text-white transition-colors relative">
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary-400" />
          </button>

          <Link href="/" className="text-xs text-dark-400 hover:text-white transition-colors">
            ← Back to site
          </Link>
        </header>

        {/* Page content */}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
