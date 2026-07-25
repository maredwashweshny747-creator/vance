# Vance — Fight Club Management SaaS

A complete fight club / combat sports gym management platform built with Next.js 14, Prisma, and Stripe. Members get session-based membership plans, coaches are paid per session taught, and coach-submitted classes go live only after admin approval.

## Quick Start (Ubuntu Linux)

### 1. Install Node.js (if not installed)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # Should show v20+
```

### 2. Install dependencies
```bash
npm install
```

### 3. Setup environment
```bash
cp .env.example .env
# Vance requires a PostgreSQL database (NOT SQLite) — see prisma/schema.prisma.
# The easiest option is a free Prisma Postgres instance: https://www.prisma.io/postgres
# Paste your connection string into DATABASE_URL, and set NEXTAUTH_SECRET to any random 32+ char string
# (generate one with: openssl rand -base64 32)
```

### 4. Setup database
```bash
npm run db:generate
npm run db:push
npm run db:seed
```

### 5. Run development server
```bash
npm run dev
# Open http://localhost:3000
```

### Demo Logins
All demo accounts use the password `demo123456`.

| Role | Email |
|---|---|
| Admin | demo@vancefc.app |
| Receptionist | front-desk@vancefc.app |
| Coach | sarah@vancefc.app (also mike@vancefc.app, dana@vancefc.app) |

## Roles

- **Admin** — full access to every tab, including Payroll, Branches, Analytics, Settings, and approving/rejecting coach-submitted classes.
- **Receptionist** — Members, Leads, Classes, Attendance, Payments, Store & Inventory.
- **Coach** — logs in to submit group classes and private sessions (held as `PENDING` until an admin approves them), marks attendance, and sees their own schedule + estimated per-session earnings on their dashboard.

## Membership Plans

Members are assigned a `MembershipPlan` (e.g. "Contender — 3 sessions/week") instead of a flat Daily/Monthly/Quarterly/Annual type. Manage plans under **Settings → Membership Plans**. Each plan has a name, a weekly session quota (`0` = unlimited), a price, and a billing cycle length in days.

## Coach Payroll

Coaches are paid per session taught, not a monthly salary. Set a coach's rate once when creating their account (**Settings → Team Access**), and **Payroll → Coach Payroll** auto-tallies their approved, already-taught sessions each month — generate the entry, then mark it paid.

## Deploy to Production (Vercel)

1. Push code to GitHub
2. Connect repo to Vercel
3. Add environment variables in Vercel dashboard
4. Make sure DATABASE_URL points to your production PostgreSQL instance
5. Deploy!
