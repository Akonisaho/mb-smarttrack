<div align="center">

<img src="public/logo.png" alt="MB SmartTrack" width="64" />

# MB SmartTrack

**Practice management built for South African law firms.**

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)](https://supabase.com)
[![Electron](https://img.shields.io/badge/Electron-28-47848F?logo=electron)](https://electronjs.org)
[![License](https://img.shields.io/badge/License-Proprietary-red)](#license)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Web-blue)](#)

</div>

---

## Screenshots

<table>
  <tr>
    <td align="center" width="50%">
      <img src="public/screenshots/login.png" alt="Login" width="100%" />
      <br/><sub><b>Login</b></sub>
    </td>
    <td align="center" width="50%">
      <img src="public/screenshots/attorney.png" alt="Attorney Dashboard" width="100%" />
      <br/><sub><b>Attorney — Time Tracking</b></sub>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <img src="public/screenshots/manager.png" alt="Manager Dashboard" width="100%" />
      <br/><sub><b>Manager — Firm Overview</b></sub>
    </td>
    <td align="center" width="50%">
      <img src="public/screenshots/hr.png" alt="HR Dashboard" width="100%" />
      <br/><sub><b>HR — Performance & Leave</b></sub>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <img src="public/screenshots/bookkeeper.png" alt="Bookkeeper Dashboard" width="100%" />
      <br/><sub><b>Bookkeeper — Trust Accounting</b></sub>
    </td>
    <td align="center" width="50%">
      <img src="public/screenshots/portal.png" alt="Client Portal" width="100%" />
      <br/><sub><b>Client Portal</b></sub>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <img src="public/screenshots/electron.png" alt="Electron Agent" width="100%" />
      <br/><sub><b>Electron Agent — System Tray</b></sub>
    </td>
    <td align="center" width="50%">
      <img src="public/screenshots/mobile.png" alt="Mobile View" width="100%" />
      <br/><sub><b>Mobile — Responsive Layout</b></sub>
    </td>
  </tr>
</table>

---

## The Problem

South African law firms lose significant billable time every day — attorneys forget to log hours, invoices are raised from memory, and trust accounting happens in spreadsheets or outdated software that costs thousands per seat. Compliance with the **Legal Practice Act 28 of 2014** and **POPIA** is a manual, error-prone process.

**SmartTrack replaces all of that.**

---

## What It Does

SmartTrack is a full-stack practice management platform with an AI-assisted desktop time tracking agent. It covers every role in a law firm — from the managing partner down to the client — in a single, connected system.

| Who | What they get |
|-----|--------------|
| **Attorney** | Automatic time tracking, matter management, invoice generation, trust accounting |
| **Manager** | Firm-wide oversight, invoice approval, staff performance, branch management |
| **National Manager** | Cross-branch analytics, consolidated reporting |
| **HR** | Leave management, 360° performance reviews, payroll export, staff analytics |
| **Bookkeeper** | Trust accounting, VAT reports, debtors age analysis, period locking |
| **Receptionist** | Client intake, FICA verification, appointment scheduling, service requests |
| **Client (Portal)** | View matters, download invoices, submit documents, track trust balances |

---

## Key Features

### Electron Time Tracking Agent
- Runs silently in the Windows system tray
- Tracks active applications and window titles in real time
- Classifies activity as **Billable**, **Work**, or **Non-billable**
- Rounds up to the standard **6-minute billing unit** (South African legal standard)
- Colour-coded tray icon: green (active) · amber (paused) · grey (idle) · red (error/session expired)
- **Crash recovery** — auto-restarts up to 3 times, notifies attorney if it cannot recover
- **Local session buffer** — time entries survive crashes and sync when connectivity returns
- **Sleep/wake detection** — pauses tracking on laptop sleep, resumes cleanly on wake
- **Session expiry detection** — opens sign-in window automatically without losing tracked data

### Matter Management
- Matter reference numbering (e.g. L2025/042)
- Stage tracking: Instructions → Drafting → Review → Execution → Archived
- Opposing party and counsel capture
- Prescription date alerts
- Conflict of interest checks
- Court roll and hearing dates

### Invoicing & Billing
- Auto-generated invoices from tracked time entries
- Sequential invoice numbering
- **VAT-compliant** (15% — VAT Act)
- Invoice approval workflow (partner sign-off above threshold)
- Credit notes and write-offs
- Payment plans
- Email invoices directly to clients
- PDF download with firm letterhead

### Trust Accounting
- Full receipt / payment / transfer ledger per matter
- **Legal Practice Act compliant** — period locking prevents backdating after close
- Partner approval required for payments above threshold
- Running balance per matter
- Trust-to-fees transfer with VAT split
- Monthly reconciliation reports

### HR & Performance
- Leave management (annual, sick, study, family responsibility)
- 360° feedback (self, peer, manager, HR)
- KPI targets vs actual (billable units)
- Staff satisfaction surveys
- Payroll export (CSV — compatible with major SA payroll systems)
- Branch-scoped visibility for branch managers

### Client Portal
- Secure OTP login (no password to forget)
- View all matters and their status
- Download invoices as PDF
- View trust account balance
- Upload documents (FICA, signed agreements)
- Submit new legal service requests

### Reporting & Analytics
- Debtors age analysis (30 / 60 / 90 / 120+ days)
- VAT output report
- Billing performance by attorney
- Matter revenue by practice area
- Audit trail for all financial transactions
- Branch comparison (national manager view)

### Infrastructure
- **Row-Level Security** enforced at database level — not just UI guards
- **PWA support** — installable on mobile
- **Offline detection** — banner warns when connectivity is lost
- **Global search** across matters, clients, invoices
- **Automated email** on invite, invoice, OTP, and reminders

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (Pages Router), React 18 |
| Styling | Tailwind CSS, custom dark theme |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email/password + OTP) |
| Desktop Agent | Electron 28 |
| Charts | Recharts |
| PDF | jsPDF + jsPDF-AutoTable |
| Search | Fuse.js |
| Testing | Playwright |

---

## Compliance

| Standard | Coverage |
|----------|---------|
| **Legal Practice Act 28 of 2014** | Trust accounting period locking, partner approval thresholds, 6-minute billing units |
| **VAT Act** | 15% VAT on all invoices, VAT output report, trust-to-fees VAT split |
| **POPIA** | Role-based data access, RLS at database level, client data isolation |
| **BCEA** | Leave types and entitlements, payroll export |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                 Next.js Dashboard                │
│  /login  /manager  /hr  /bookkeeper  /portal     │
│  /receptionist  /clients  /documents  /calendar  │
└────────────────────┬────────────────────────────┘
                     │ Supabase JS Client
┌────────────────────▼────────────────────────────┐
│              Supabase (PostgreSQL)               │
│  RLS policies per role on every table            │
│  profiles · matters · invoices · activities      │
│  trust_transactions · leave_requests · branches  │
└────────────────────▲────────────────────────────┘
                     │ Service Role Key
┌────────────────────┴────────────────────────────┐
│            Electron Agent (Windows)              │
│  System tray · app monitoring · activity sync    │
│  Local crash buffer · session management         │
└─────────────────────────────────────────────────┘
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- A Supabase project
- Windows (for the Electron agent)

### 1. Clone and install

```bash
git clone https://github.com/Akonisaho/mb-smarttrack.git
cd mb-smarttrack/dashboard
npm install
```

### 2. Environment variables

Create `.env.local` in the `dashboard/` folder:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Database setup

Run `supabase-setup.sql` in your Supabase SQL Editor to create all tables, RLS policies, and triggers.

### 4. Run the dashboard

```bash
npm run dev
# → http://localhost:3000
```

### 5. Run the Electron agent (Windows)

```bash
cd ../electron-agent
npm install
npm start
```

---

## Ghost Practice Migration

If your firm is migrating from **Ghost Practice**, SmartTrack includes a one-time migration tool that imports matters, outstanding invoices, and trust opening balances from Ghost Practice CSV exports — with no manual data entry.

```bash
cd migration
npm install
# Add your Ghost Practice CSV exports to ghost-export/
node migrate.js
```

Safe to re-run — all operations are upserts. Generates a `migration-report-YYYY-MM-DD.json` on completion.

---

## Testing

```bash
# Run full Playwright test suite
npm test

# Run by role
npm run test:manager
npm run test:hr
npm run test:auth

# View HTML report
npm run test:report
```

---

## Roadmap

| Feature | Status |
|---------|--------|
| Core dashboards (all 7 roles) | ✅ Done |
| Electron time tracking agent | ✅ Done |
| Electron crash recovery + auto-restart | ✅ Done |
| Ghost Practice migration tool | ✅ Done |
| Trust accounting (full ledger) | ✅ Done |
| Client portal (OTP login) | ✅ Done |
| 360° performance reviews | ✅ Done |
| PWA / mobile support | ✅ Done |
| MS365 / Outlook integration | 🔄 In progress |
| Mobile app (React Native) | 📋 Planned |
| LPC e-filing integration | 📋 Planned |
| AI matter summarisation | 📋 Planned |

---

## About

Built for **Motsoeneng Bill** — a South African law firm operating across multiple branches. Designed to replace Ghost Practice and eliminate manual time recording, spreadsheet-based trust accounting, and disconnected HR processes.

---

## License

Proprietary. All rights reserved — Motsoeneng Bill © 2026.
