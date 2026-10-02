import type { PageId, Role, User } from "../types";
import type { IconName } from "../components/Icon";
import { Dashboard } from "../pages/Dashboard";

/* ---------- roles & access ---------- */
export const ROLES: Record<Role, string> = {
  owner: "Super Admin / Owner",
  admin: "Admin / Operations",
  hr: "HR",
  lead: "Team Lead / Manager",
  employee: "Employee",
  accountant: "Accountant",
};
export const PAGES: [PageId, string, IconName][] = [
  ["dashboard", "Dashboard", "grid"],
  ["attendance", "Attendance", "clock"],
  ["tasks", "Task Board", "tasks"],
  ["projects", "Projects", "briefcase"],
  ["chat", "Team Chat", "chat"],
  ["files", "Files & Documents", "folder"],
  ["employees", "Employees", "users"],
  ["performance", "Performance", "chart"],
  ["leave", "Leave & HR", "calendar"],
  ["reports", "Reports", "report"],
  ["notifications", "Notifications", "bell"],
  ["settings", "Settings", "settings"],
  ["audit", "Audit Log", "shield"],
];
export const DEFAULT_ACCESS: Record<Role, PageId[]> = {
  owner: PAGES.map((p) => p[0]),
  admin: PAGES.map((p) => p[0]),
  hr: ["dashboard", "attendance", "tasks", "chat", "files", "employees", "performance", "leave", "reports", "notifications"],
  lead: ["dashboard", "attendance", "tasks", "projects", "chat", "files", "employees", "performance", "leave", "reports", "notifications"],
  employee: ["dashboard", "attendance", "tasks", "projects", "chat", "files", "performance", "leave", "notifications"],
  accountant: ["dashboard", "attendance", "tasks", "chat", "files", "performance", "leave", "reports", "notifications"],
};
export const can: Record<string, (u: User) => boolean> = {
  manageEmployees: (u) => ["owner", "admin", "hr"].includes(u.role),
  assignTasks: (u) => ["owner", "admin", "lead"].includes(u.role),
  correctAttendance: (u) => ["owner", "admin", "hr"].includes(u.role),
  seeTeamAttendance: (u) => ["owner", "admin", "hr", "lead"].includes(u.role),
  seeAll: (u) => ["owner", "admin", "hr"].includes(u.role),
  approveLeave: (u) => ["owner", "admin", "hr", "lead"].includes(u.role),
  hrDocs: (u) => ["owner", "hr"].includes(u.role),
  manageProjects: (u) => ["owner", "admin", "lead"].includes(u.role),
  manageKpi: (u) => ["owner", "admin"].includes(u.role),
  moderate: (u) => ["owner", "admin"].includes(u.role),
};


export const deptName = (db, id) => db.departments.find((d) => d.id === id)?.name || "—";
