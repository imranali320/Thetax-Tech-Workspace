// Data model — mirrors the tables in section 18 of the blueprint.
// When the Laravel API is added, these become the API response types.

export type Role = "owner" | "admin" | "hr" | "lead" | "employee" | "accountant";
export type PageId =
  | "dashboard" | "attendance" | "tasks" | "projects" | "chat" | "files" | "employees"
  | "performance" | "leave" | "reports" | "notifications" | "settings" | "audit";
export type Presence = "online" | "away" | "offline";

export interface Department { id: string; name: string; managerId: string | null }

export interface User {
  id: string; empId: string; name: string; email: string; phone: string;
  role: Role; dept: string; title: string; managerId: string | null;
  shift: string;            // "09:00"
  breakMins: number;        // daily break allowance
  joined: string;           // YYYY-MM-DD
  status: "active" | "disabled";
  presence: Presence;
  password: string;         // demo only — the backend stores a hash, never this
  mustChange: boolean;      // forces a password change on first login
}

export interface Break { id: string; start: number; end: number | null }
export interface AttendanceCorrection { at: number; by: string; reason: string; before: string }
export interface AttendanceRecord {
  id: string; userId: string; date: string;
  checkIn: number | null; checkOut: number | null;
  late: boolean; selfie: string | null;
  breaks: Break[]; corrections: AttendanceCorrection[];
  events: { type: string; at: number }[];
}

export type TaskStatus = "todo" | "progress" | "review" | "done" | "cancelled";
export type Priority = "Low" | "Normal" | "High" | "Urgent";
export interface Activity { at: number; by: string; text: string }
export interface Comment { id: string; by: string; at: number; text: string }
export interface Task {
  id: string; title: string; description: string;
  assignees: string[]; assignedBy: string; dept: string;
  priority: Priority; status: TaskStatus; dueAt: number; project: string | null;
  comments: Comment[]; attachments: string[]; createdAt: number; activity: Activity[];
}

export interface Project {
  id: string; name: string; description: string; managerId: string; members: string[];
  start: string; deadline: string; status: string; activity: Activity[];
}

export interface Channel {
  id: string; name: string; type: "channel" | "project" | "dm";
  members: string[]; topic?: string; projectId?: string;
  unread?: number; // populated from the API's unread count; not persisted
}
export interface Message {
  id: string; channelId: string; senderId: string; at: number; text: string;
  reactions: Record<string, string[]>; parentId: string | null; attachments: string[]; edited?: boolean;
}

export type Visibility = "company" | "department" | "project" | "private" | "hr";
export interface FileItem {
  id: string; name: string; size: number; type: string; ownerId: string;
  folder: { dept?: string; project?: string; employee?: string };
  visibility: Visibility; at: number;
  versions: { v: number; at: number; by: string }[];
  data: string | null; mime?: string;
}

export interface KpiDef { id: string; dept: string; name: string; type: "number" | "currency" }
export interface KpiEntry { id: string; defId: string; userId: string; date: string; value: number }

export interface Leave {
  id: string; userId: string; type: string; start: string; end: string; reason: string;
  status: "pending" | "approved" | "rejected"; at: number; decidedBy: string | null; note: string;
}

export interface NotificationLink { page: PageId; id?: string }
export interface AppNotification {
  id: string; userId: string; type: string; text: string; at: number;
  link?: NotificationLink; readAt: number | null;
}

export interface AuditEntry {
  id: string; at: number; userId: string | null; action: string; entity: string; entityId: string; meta: string;
}
export interface Backup { id: string; at: number; size: number; kind: string; status: string }

export interface Settings {
  company: string; timezone: string; graceMins: number; workHours: number; defaultBreak: number;
  multiBreak: boolean; maxFileMB: number; fileTypes: string; selfieRetention: number;
  backupTime: string; backupKeep: number;
}

export interface DB {
  settings: Settings;
  access: Record<Role, PageId[]>;
  departments: Department[]; users: User[]; attendance: AttendanceRecord[];
  tasks: Task[]; projects: Project[]; channels: Channel[]; messages: Message[]; files: FileItem[];
  kpiDefs: KpiDef[]; kpiEntries: KpiEntry[]; leaves: Leave[]; notifications: AppNotification[];
  audit: AuditEntry[]; backups: Backup[];
  lastRead: Record<string, Record<string, number>>;
}

export interface Helpers {
  me: User;
  log: (action: string, entity: string, entityId: string, meta?: string) => void;
  notify: (userIds: string[], type: string, text: string, link?: NotificationLink) => void;
}

export interface PageProps { param?: string | null }
