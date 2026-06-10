# Spec: SLA (Service Level Agreement) System

## Objective

Implement a comprehensive SLA tracking system for DeltaJalan that monitors report handling time per priority level across all non-admin roles (supervisor, petugas_eksekusi, petugas_lapangan). The system provides visual indicators, deadline tracking, breach detection, and multi-channel notifications (in-app, web push, email).

## Tech Stack

- Backend: Laravel 11 (PHP 8.2), PostgreSQL
- Frontend: React 19 + TypeScript + Tailwind CSS
- Notifications: Laravel Notification (database, webpush, mail)
- Email: Gmail SMTP with App Password

## SLA Thresholds

| Priority | Review Deadline (from created_at) | Resolution Deadline (from approved_at) | Warning Trigger |
|----------|----------------------------------|----------------------------------------|-----------------|
| Tinggi   | 24 jam                           | 72 jam (3 hari)                        | 8 jam sebelum deadline |
| Sedang   | 72 jam (3 hari)                  | 168 jam (7 hari)                       | 24 jam sebelum  |
| Rendah   | 168 jam (7 hari)                 | 336 jam (14 hari)                      | 48 jam sebelum  |

## Success Criteria

- [ ] SLA deadlines are automatically set when reports are created (review) and approved (resolution)
- [ ] SLA status (on_track / warning / breached) is computed and filterable on all role dashboards
- [ ] Supervisor dashboard shows SLA stats cards + SLA filter + per-card SLA badge
- [ ] Petugas Eksekusi dashboard shows deadline countdown + urgency badges
- [ ] Peta Interaktif filter uses per-priority SLA instead of hardcoded 7/14/30
- [ ] SLA breach triggers notification in-app + webpush + email to supervisor
- [ ] Email sends via Gmail SMTP with App Password

## Project Structure

```
backend_POSTGRESQL/
  config/sla.php                          → SLA threshold config
  database/migrations/xxxx_add_sla_to_reports.php  → New SLA columns
  app/Console/Commands/CheckSla.php       → Scheduled SLA breach check
  app/Notifications/SlaBreachNotification.php      → Breach notification (db+push+mail)
  app/Notifications/SlaWarningNotification.php     → Warning notification (db+push+mail)
  app/Mail/SlaBreachMail.php              → Mailable for breach email
  app/Mail/SlaWarningMail.php             → Mailable for warning email
  app/Http/Controllers/ReportController.php → Modified: set deadlines, sla_status filter, sla-summary

Frontend-stable/src/
  types/laporan.ts                        → Updated: SLA types
  hooks/useReportQueries.ts               → Updated: sla_status param
  components/jk/SlaBadge.tsx              → New: SLA status badge component
  components/jk/SlaStatsCards.tsx          → New: SLA stats banner
  routes/supervisor.tsx                    → Modified: SLA stats + filter + badge
  routes/petugas-eksekusi.tsx              → Modified: deadline countdown + urgency
  components/jk/PetaInteraktif.tsx         → Modified: per-priority SLA filter
```

## Code Style

Follow existing Laravel patterns (Controllers, Notifications, Console Commands) and existing React patterns (hooks, components, Tailwind utility classes).

Example — SLA badge component:
```tsx
export function SlaBadge({ status, remaining }: SlaBadgeProps) {
  const color = status === 'breached' ? 'bg-red-500' : status === 'warning' ? 'bg-yellow-500' : 'bg-green-500';
  return <span className={`px-2 py-0.5 rounded-full text-white text-[11px] font-semibold ${color}`}>{remaining}</span>;
}
```

## Boundaries

- **Always:** Set deadlines on report create/approve, check SLA via scheduled command, add sla_status filter to report queries, show visual indicators on cards
- **Ask first:** Adding new dependencies, changing database schema beyond planned columns
- **Never:** Send real emails without user confirmation, modify auth logic, change existing report status flow

## Implementation Order

Sl 1: Backend — config + migration + set deadlines on store/approve
Sl 2: Backend — CheckSla command + notification classes + email
Sl 3: Backend — sla_status filter + sla-summary endpoint + .env mail setup
Sl 4: Frontend — Types + hooks + SlaBadge + SlaStatsCards
Sl 5: Frontend — Supervisor dashboard integration
Sl 6: Frontend — Petugas Eksekusi dashboard integration
Sl 7: Frontend — Peta Interaktif enhanced SLA filter
