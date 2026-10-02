# Theta X Tech Workplace — Employee Management System (Frontend)

React + TypeScript + Vite frontend built from the *Employee Management & Workplace Collaboration System* blueprint.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build locally
```

Requires Node.js 18 or newer.

Demo login: pick any account on the login screen. Password for all demo accounts is `demo123`.

## Folder structure

```
src/
  main.tsx                 entry point
  App.tsx                  app shell: sidebar, top bar, role-based page access
  types.ts                 data model (matches blueprint section 18)
  store/StoreContext.tsx   app state, update(), notifications + audit helpers
  data/seed.ts             demo data (replace with API calls)
  lib/
    time.ts                date/time formatting, useNow hook
    attendance.ts          net work time, break totals, attendance state
    access.ts              roles, page permissions, can.* checks
    tasks.ts               task statuses and visibility rules
    files.ts               CSV export, downloads, image compression
  components/
    ui.tsx                 Avatar, Chip, Modal, Drawer, Field, Stat, Tabs...
    Icon.tsx               inline SVG icons
    Login.tsx              login + forced first-login password change
    NotificationBell.tsx   bell popover
    WorkdayCard.tsx        check-in ring, break timer, check-out
    SelfieModal.tsx        camera capture or photo upload, compressed to 480px
    TaskForm.tsx / TaskDetail.tsx
    Toasts.tsx
  pages/
    Dashboard  Attendance  Tasks  Projects  Chat  Files  Employees
    Performance  Leave  Reports  Notifications  Settings  AuditLog
  styles/global.css        design tokens, light/dark themes, responsive layout
```

## Blueprint coverage

| Blueprint section | Where |
|---|---|
| 3 Roles & permissions | `lib/access.ts`, Settings › Roles & permissions |
| 5 Login & security | `components/Login.tsx` (temp password → forced change, failed-login audit) |
| 6 Dashboards | `pages/Dashboard.tsx` (admin/lead view and employee view) |
| 7, 8, 21 Attendance, breaks, selfie | `components/WorkdayCard.tsx`, `SelfieModal.tsx`, `pages/Attendance.tsx` |
| 9 Tasks (Kanban on desktop, list on mobile) | `pages/Tasks.tsx`, `components/TaskDetail.tsx` |
| 10 Department KPIs (admin-configurable) | `pages/Performance.tsx` |
| 11 Chat (channels, DMs, threads, mentions, reactions, search, unread) | `pages/Chat.tsx` |
| 12 Files (folders, permissions, versions, size/type limits) | `pages/Files.tsx` |
| 13 Projects | `pages/Projects.tsx` |
| 14 Employee profile, HR documents | `pages/Employees.tsx` |
| 15 Notifications | `components/NotificationBell.tsx`, `pages/Notifications.tsx` |
| 16 Reports + CSV export | `pages/Reports.tsx` |
| 17 Admin panel | `pages/Settings.tsx` |
| 22 Backups | Settings › Backups (UI only) |

## What still needs the backend (Laravel + MySQL, per section 19)

Right now all data lives in React state and resets on reload. Before production:

- Replace `data/seed.ts` and `update()` in `App.tsx` with calls to a Laravel REST API.
- Passwords: hash on the server (`Hash::make`); remove the `password` field from the frontend model.
- Permissions: repeat every `can.*` / page check in Laravel policies — the frontend check is only for UX.
- Attendance: the server sets check-in/out timestamps; selfies are uploaded to private storage, not kept as data URLs.
- Chat: add polling or WebSockets; paginate messages.
- Files: upload to server storage with signed download URLs.
- Backups: scheduled job on the server; the Settings screen only shows the schedule.

## Deploying the frontend to Hostinger

`npm run build`, then upload the contents of `dist/` to `public_html` (or a subfolder — `base: "./"` in `vite.config.ts` makes relative paths work).
