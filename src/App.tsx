import React from "react";
import type { DB, Helpers, PageId, User } from "./types";
import "./styles/global.css";
import { Icon } from "./components/Icon";
import { ChangePassword, Login } from "./components/Login";
import { NotificationBell } from "./components/NotificationBell";
import { useToasts } from "./components/Toasts";
import { Avatar, Empty } from "./components/ui";
import { buildSeed } from "./data/seed";
import { apiGetSettings, apiListChannels, apiListDepartments, apiListUsers, apiLogout, apiMe, getToken, mapApiSettings, mapApiUser } from "./lib/api";
import { PAGES, ROLES } from "./lib/access";
import { uid } from "./lib/time";
import { AttendancePage } from "./pages/Attendance";
import { AuditPage } from "./pages/AuditLog";
import { ChatPage } from "./pages/Chat";
import { Dashboard } from "./pages/Dashboard";
import { EmployeesPage } from "./pages/Employees";
import { FilesPage } from "./pages/Files";
import { LeavePage } from "./pages/Leave";
import { NotificationsPage } from "./pages/Notifications";
import { PerformancePage } from "./pages/Performance";
import { ProjectsPage } from "./pages/Projects";
import { ReportsPage } from "./pages/Reports";
import { SettingsPage } from "./pages/Settings";
import { TasksPage } from "./pages/Tasks";
import { Store } from "./store/StoreContext";

const VIEWS: Record<PageId, React.ComponentType<{ param?: string | null }>> = { dashboard: Dashboard, attendance: AttendancePage, tasks: TasksPage, projects: ProjectsPage, chat: ChatPage, files: FilesPage, employees: EmployeesPage, performance: PerformancePage, leave: LeavePage, reports: ReportsPage, notifications: NotificationsPage, settings: SettingsPage, audit: AuditPage };

export default function App() {
  const [db, setDb] = React.useState<DB>(buildSeed);
  const [session, setSession] = React.useState<string | null>(null);
  const [pendingPassword, setPendingPassword] = React.useState<string | null>(null);
  const [restoring, setRestoring] = React.useState(true);
  const [route, setRoute] = React.useState<{ page: PageId; param: string | null; n: number }>({ page: "dashboard", param: null, n: 0 });
  const [navOpen, setNavOpen] = React.useState(false);
  const [toast, toasts] = useToasts();
  const me = session && db.users.find((u) => u.id === session);

  // Fetches the real company directory (users, departments, settings) from the backend
  // and replaces the seed placeholders with it — called after every login/restore and
  // after any action that changes an employee/department/settings record.
  const reloadDirectory = React.useCallback(async () => {
    try {
      const [apiUsers, apiDepts, apiSettings] = await Promise.all([apiListUsers(), apiListDepartments(), apiGetSettings()]);
      setDb((d) => ({
        ...d,
        users: apiUsers.map(mapApiUser),
        departments: apiDepts.map((dep) => ({ id: dep.id, name: dep.name, managerId: dep.manager_id })),
        settings: mapApiSettings(apiSettings),
      }));
    } catch (e: any) {
      toast(e.message || "Could not load company data from the server.", "error");
    }
  }, [toast]);

  // On a hard refresh, React state resets but the JWT in sessionStorage survives —
  // use it to silently re-fetch the signed-in user instead of dropping back to Login.
  React.useEffect(() => {
    if (!getToken()) { setRestoring(false); return; }
    apiMe()
      .then((apiUser) => {
        const user = mapApiUser(apiUser);
        setDb((d) => {
          const online = { ...user, presence: "online" as const };
          const exists = d.users.some((u) => u.id === user.id);
          return { ...d, users: exists ? d.users.map((u) => (u.id === user.id ? online : u)) : [...d.users, online] };
        });
        setSession(user.id);
        reloadDirectory();
      })
      .catch(() => {}) // expired/invalid token — fall through to the login screen
      .finally(() => setRestoring(false));
  }, []);

  const update = React.useCallback((fn: (draft: DB, h: Helpers) => void) => {
    setDb((d) => {
      const n = structuredClone(d);
      const actor = n.users.find((u) => u.id === session);
      const h: Helpers = {
        me: actor,
        log: (action, entity, entityId, meta = "") => n.audit.push({ id: uid("x"), at: Date.now(), userId: actor?.id, action, entity, entityId, meta }),
        notify: (ids, type, text, link) => [...new Set(ids)].filter((i) => i && i !== actor?.id).forEach((userId) => n.notifications.push({ id: uid("n"), userId, type, text, at: Date.now(), link, readAt: null })),
      };
      fn(n, h);
      return n;
    });
  }, [session]);

  const go = React.useCallback((page: PageId, param: string | null = null) => { setRoute((r) => ({ page, param, n: r.n + 1 })); setNavOpen(false); window.scrollTo?.(0, 0); }, []);

  // Real auth now lives in the FastAPI backend (src/lib/api.ts); on success we upsert
  // the authenticated user into local state so the rest of the app (still seed-backed
  // for everything except auth) can keep treating `db.users` as the source of truth.
  const handleLogin = (user: User, password: string) => {
    setDb((d) => {
      const exists = d.users.some((u) => u.id === user.id);
      const online = { ...user, presence: "online" as const };
      const users = exists ? d.users.map((u) => (u.id === user.id ? online : u)) : [...d.users, online];
      return { ...d, users, audit: [...d.audit, { id: uid("x"), at: Date.now(), userId: user.id, action: "login", entity: "auth", entityId: user.id, meta: "" }] };
    });
    setSession(user.id);
    setPendingPassword(user.mustChange ? password : null);
    setRoute({ page: "dashboard", param: null, n: 0 });
    reloadDirectory();
  };
  const logout = () => {
    apiLogout().catch(() => {});
    setDb((d) => ({ ...d, audit: [...d.audit, { id: uid("x"), at: Date.now(), userId: session, action: "logout", entity: "auth", entityId: session, meta: "" }] }));
    setSession(null);
  };

  // disabled while signed in -> kicked out
  React.useEffect(() => { if (me && me.status !== "active") { setSession(null); } }, [me]);

  // Chat moved to the real backend; unread counts for the sidebar badge are
  // computed server-side (per channel) and summed here via light polling.
  const [unreadChat, setUnreadChat] = React.useState(0);
  React.useEffect(() => {
    if (!me) return;
    let dead = false;
    const poll = () => apiListChannels().then((cs) => { if (!dead) setUnreadChat(cs.reduce((s, c) => s + c.unread, 0)); }).catch(() => {});
    poll();
    const id = setInterval(poll, 8000);
    return () => { dead = true; clearInterval(id); };
  }, [me?.id]);

  if (restoring) return <div className="login"><div className="login-panel center"><p className="muted">Loading…</p></div></div>;
  if (!me) return <><Login db={db} onLogin={handleLogin} />{toasts}</>;
  if (me.mustChange) return <ChangePassword user={me} currentPassword={pendingPassword} onDone={(pw) => { setDb((d) => ({ ...d, users: d.users.map((u) => (u.id === me.id ? { ...u, password: pw, mustChange: false } : u)), audit: [...d.audit, { id: uid("x"), at: Date.now(), userId: me.id, action: "password.change", entity: "auth", entityId: me.id, meta: "First login" }] })); setPendingPassword(null); toast("Password updated."); }} />;

  const allowed = db.access[me.role] || [];
  const View = VIEWS[route.page];
  const permitted = allowed.includes(route.page);
  const unreadNotif = db.notifications.filter((n) => n.userId === me.id && !n.readAt).length;
  const pendingLeave = ["owner", "hr", "admin", "lead"].includes(me.role) ? db.leaves.filter((l) => l.status === "pending" && l.userId !== me.id).length : 0;
  const counts = { chat: unreadChat, notifications: unreadNotif, leave: pendingLeave };
  const title = PAGES.find((p) => p[0] === route.page)?.[1];

  return (
    <Store.Provider value={{ db, me, update, go, toast, reloadDirectory }}>
      <div className={`shell ${route.page === "chat" ? "shell-chat" : ""}`}>
        <aside className={`side ${navOpen ? "open" : ""}`} aria-label="Main navigation">
          <div className="side-brand">
            <div className="brand-mark sm"><span>{db.settings.company.split(" ").map((w) => w[0]).join("").slice(0, 2)}</span></div>
            <div><strong>{db.settings.company}</strong><span className="small side-muted block">Workplace</span></div>
          </div>
          <nav className="side-nav">
            {PAGES.filter(([p]) => allowed.includes(p)).map(([p, label, icon]) => (
              <button key={p} className={`nav ${route.page === p ? "on" : ""}`} onClick={() => go(p)} aria-current={route.page === p ? "page" : undefined}>
                <Icon name={icon} size={18} /><span className="grow">{label}</span>{counts[p] > 0 && <span className="badge">{counts[p]}</span>}
              </button>
            ))}
          </nav>
          <div className="side-me">
            <Avatar user={me} size={34} dot />
            <div className="grow"><strong className="small block truncate">{me.name}</strong><span className="small side-muted">{ROLES[me.role]}</span></div>
            <button className="icon-btn side-btn" onClick={logout} aria-label="Sign out" title="Sign out"><Icon name="logout" /></button>
          </div>
        </aside>
        {navOpen && <div className="scrim" onClick={() => setNavOpen(false)} />}
        <main className="main">
          <header className="topbar">
            <button className="icon-btn menu-btn" onClick={() => setNavOpen(true)} aria-label="Open menu"><Icon name="menu" /></button>
            <span className="top-title">{title}</span>
            <div className="grow" />
            <NotificationBell />
            <span className="top-me"><Avatar user={me} size={30} /></span>
          </header>
          <div className="content" key={route.page + route.n}>
            {permitted && View ? <View param={route.param} /> : (
              <div className="page"><Empty icon="lock" title="You don't have access to this page">Ask an admin if you need it.</Empty></div>
            )}
          </div>
        </main>
      </div>
      {toasts}
    </Store.Provider>
  );
}
