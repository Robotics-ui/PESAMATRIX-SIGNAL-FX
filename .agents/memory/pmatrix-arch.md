---
name: PMATRIX Architecture
description: Key decisions, migration quirks, and frontend patterns for the PMATRIX copy-trading backend project.
---

## Stack
- Node.js 20, TypeScript, Express v5, tsx runtime (no compile step)
- Drizzle ORM + PostgreSQL (DATABASE_URL secret)
- Redis + BullMQ (started in start.sh)
- Frontend: vanilla HTML/CSS/JS served statically from `public/` — NOT React/Tailwind despite the feature spec saying so
- CSS vars: --accent #00e5a0, --bg #070a0f, --bg-card #111827

## Express v5 gotcha
`app.options('*', ...)` throws — must use `app.options(/.*/, ...)` regex form.

## Migration quirk — PostgreSQL constraints
`ALTER TABLE ADD CONSTRAINT IF NOT EXISTS` is NOT valid PostgreSQL syntax (raises syntax error at "NOT"). Use a DO block instead:
```sql
DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "name" UNIQUE("col");
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;
```
For FK constraints use `EXCEPTION WHEN duplicate_object THEN NULL`.

## Migration journal
- 0000: 0000_narrow_santa_claus (initial schema)
- 0001: 0001_media_contacts (media_files + contacts)
- 0002: 0002_production_features (users.fullName/phoneNumber, subscriptions.tradingDays/totalAmount/nullable planId, subscription_settings, master_accounts, user_provider_subscriptions)

## Frontend sidebar pattern
Sidebar is JS-driven via `buildSidebar(activePage)` in `public/js/app.js`. Each HTML page has `<div id="sidebarContainer"></div>` and calls `initSidebar('page-id')` from its page JS. Admin-only links appear only when `user.role === 'admin'`.

## Trading days calculator
Mon-Fri only, available in both app.js (frontend) and subscription.controller.ts (backend):
```javascript
function addTradingDays(start, days) {
  const d = new Date(start); let count = 0;
  while (count < days) { d.setDate(d.getDate()+1); if (d.getDay()>=1&&d.getDay()<=5) count++; }
  return d;
}
```

## Admin account
admin@pmatrix.com / admin123 (created during initial setup)

## CORS
Origin locked to: https://pesamatrix-signal-fx-f--signalfx.replit.app
