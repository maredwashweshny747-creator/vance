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
- **Receptionist** — Fighters, Leads, Classes, Attendance, Payments, Store & Inventory.
- **Coach** — logs in to submit group classes and private sessions (held as `PENDING` until an admin approves them), manages attendance rosters for their own classes, and sees their own schedule + estimated per-session earnings on their dashboard.

## Classes Are the Plan

There's no separate "membership plan" concept — a `GymClass` (e.g. "Kickboxing Adults") *is* what a fighter subscribes to: it has a weekly schedule (which days it meets), a price, and a billing cycle length in days. Fighters sign into a class directly from their profile, and can be signed into more than one at once (e.g. MMA + Kickboxing). A fighter can switch from one class to another mid-cycle — remaining days carry over, no new charge.

A subscription (`ClassEnrollment`) automatically expires when either condition is met, whichever comes first: the fighter has used up all sessions allotted for the cycle, or the cycle's day count has passed.

## Attendance

Attendance is taken per class, per date — open a class's **Manage Attendance** page, pick a date, and mark each signed-in fighter Attended / Absent / Excused. This also powers each fighter's month-to-date summary on their profile. QR/manual check-in at the front desk writes to the same records.

## Fighter IDs & the Portal

Every fighter gets an auto-generated 8-digit Fighter ID (starting at `00002000`), shown on their profile and usable in place of an email address — email is optional. This ID is also how a fighter logs into the self-service portal at `/portal` (along with your gym's slug), so no email is required to use it.

## Coach Payroll

Coaches are paid per session taught, not a monthly salary. Set a coach's rate once when creating their account (**Settings → Team Access**), and **Payroll → Coach Payroll** auto-tallies sessions actually attended in their classes each month — generate the entry, then mark it paid.

## Deploy to Production (Vercel)

1. Push code to GitHub
2. Connect repo to Vercel
3. Add environment variables in Vercel dashboard
4. Make sure DATABASE_URL points to your production PostgreSQL instance
5. Deploy!
