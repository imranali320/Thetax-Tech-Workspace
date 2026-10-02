import type { AttendanceRecord, Channel, FileItem, Message, Role, Settings, User, Visibility } from "../types";

// Points at the local FastAPI backend in dev; override with VITE_API_URL for other environments.
const API_BASE = (import.meta as any).env?.VITE_API_URL || "http://127.0.0.1:8000";

export interface ApiUser {
  id: string; emp_id: string; name: string; email: string; phone: string;
  role: string; dept: string | null; title: string; manager_id: string | null;
  shift: string; break_mins: number; joined: string; status: string; presence: string;
  must_change: boolean;
}

let token: string | null = sessionStorage.getItem("theta_token");

export function getToken() {
  return token;
}

function setToken(t: string | null) {
  token = t;
  if (t) sessionStorage.setItem("theta_token", t);
  else sessionStorage.removeItem("theta_token");
}

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = Array.isArray(body.detail) ? body.detail[0]?.msg : body.detail;
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return res.status === 204 ? null : res.json();
}

export async function apiLogin(email: string, password: string): Promise<ApiUser> {
  const data = await request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  setToken(data.access_token);
  return data.user;
}

export function apiMe(): Promise<ApiUser> {
  return request("/auth/me");
}

export async function apiLogout() {
  try {
    await request("/auth/logout", { method: "POST" });
  } finally {
    setToken(null);
  }
}

export function apiChangePassword(current_password: string, new_password: string) {
  return request("/auth/change-password", { method: "POST", body: JSON.stringify({ current_password, new_password }) });
}

// Backend uses snake_case (matches the blueprint's §18 column names); the frontend model is camelCase.
export function mapApiUser(u: ApiUser): User {
  return {
    id: u.id, empId: u.emp_id, name: u.name, email: u.email, phone: u.phone,
    role: u.role as Role, dept: u.dept || "", title: u.title, managerId: u.manager_id,
    shift: u.shift, breakMins: u.break_mins, joined: u.joined,
    status: u.status as User["status"], presence: u.presence as User["presence"],
    password: "", mustChange: u.must_change,
  };
}

export interface ApiDepartment { id: string; name: string; manager_id: string | null }

export function apiListUsers(): Promise<ApiUser[]> {
  return request("/users");
}

export interface CreateUserPayload {
  emp_id: string; name: string; email: string; phone?: string; role: string;
  dept?: string | null; title?: string; manager_id?: string | null;
  shift?: string; break_mins?: number; temp_password: string;
}

export function apiCreateUser(payload: CreateUserPayload): Promise<ApiUser> {
  return request("/users", { method: "POST", body: JSON.stringify(payload) });
}

export interface UpdateUserPayload {
  name?: string; phone?: string; role?: string; dept?: string | null;
  title?: string; manager_id?: string | null; shift?: string;
  break_mins?: number; status?: string;
}

export function apiUpdateUser(id: string, payload: UpdateUserPayload): Promise<ApiUser> {
  return request(`/users/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function apiListDepartments(): Promise<ApiDepartment[]> {
  return request("/departments");
}

export function apiCreateDepartment(name: string): Promise<ApiDepartment> {
  return request("/departments", { method: "POST", body: JSON.stringify({ name }) });
}

export interface ApiFileVersion { v: number; at: string; by: string }
export interface ApiFile {
  id: string; name: string; size: number; mime_type: string; owner_id: string;
  folder_dept: string | null; folder_project: string | null; folder_employee: string | null;
  visibility: string; at: string; versions: ApiFileVersion[];
}

export function mapApiFile(f: ApiFile): FileItem {
  return {
    id: f.id, name: f.name, size: f.size, type: f.name.split(".").pop()?.toLowerCase() || "",
    ownerId: f.owner_id,
    folder: { dept: f.folder_dept || undefined, project: f.folder_project || undefined, employee: f.folder_employee || undefined },
    visibility: f.visibility as Visibility, at: new Date(f.at).getTime(),
    versions: f.versions.map((v) => ({ v: v.v, at: new Date(v.at).getTime(), by: v.by })),
    data: null, mime: f.mime_type,
  };
}

export function apiListFiles(params: { dept?: string; project?: string; employee?: string } = {}): Promise<ApiFile[]> {
  const qs = new URLSearchParams();
  if (params.dept) qs.set("dept", params.dept);
  if (params.project) qs.set("project", params.project);
  if (params.employee) qs.set("employee", params.employee);
  const suffix = qs.toString() ? `?${qs}` : "";
  return request(`/files${suffix}`);
}

export async function apiUploadFile(file: File, folder: { dept?: string; project?: string; employee?: string }, visibility: string): Promise<ApiFile> {
  const form = new FormData();
  form.append("file", file);
  if (folder.dept) form.append("folder_dept", folder.dept);
  if (folder.project) form.append("folder_project", folder.project);
  if (folder.employee) form.append("folder_employee", folder.employee);
  form.append("visibility", visibility);
  const res = await fetch(`${API_BASE}/files`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = Array.isArray(body.detail) ? body.detail[0]?.msg : body.detail;
    throw new Error(detail || `Upload failed (${res.status})`);
  }
  return res.json();
}

async function fetchFileBlob(id: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/files/${id}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Could not load the file (${res.status})`);
  return res.blob();
}

export const apiFetchFileBlob = fetchFileBlob;

export async function apiDownloadFile(id: string, filename: string) {
  const blob = await fetchFileBlob(id);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface ApiSettings {
  company: string; timezone: string; grace_mins: number; work_hours: number; default_break: number;
  multi_break: boolean; max_file_mb: number; file_types: string; selfie_retention: number;
  backup_time: string; backup_keep: number;
}

export function apiGetSettings(): Promise<ApiSettings> {
  return request("/settings");
}

export function apiUpdateSettings(payload: Partial<ApiSettings>): Promise<ApiSettings> {
  return request("/settings", { method: "PATCH", body: JSON.stringify(payload) });
}

export function mapApiSettings(s: ApiSettings): Settings {
  return {
    company: s.company, timezone: s.timezone, graceMins: s.grace_mins, workHours: s.work_hours,
    defaultBreak: s.default_break, multiBreak: s.multi_break, maxFileMB: s.max_file_mb, fileTypes: s.file_types,
    selfieRetention: s.selfie_retention, backupTime: s.backup_time, backupKeep: s.backup_keep,
  };
}

export interface ApiBreak { id: string; start: number; end: number | null }
export interface ApiCorrection { at: number; by: string; reason: string; before: string }
export interface ApiEvent { type: string; at: number }
export interface ApiAttendance {
  id: string; user_id: string; date: string; check_in: number | null; check_out: number | null;
  late: boolean; selfie: string | null; breaks: ApiBreak[]; corrections: ApiCorrection[]; events: ApiEvent[];
}

export function mapApiAttendance(a: ApiAttendance): AttendanceRecord {
  return {
    id: a.id, userId: a.user_id, date: a.date, checkIn: a.check_in, checkOut: a.check_out, late: a.late,
    selfie: a.selfie, breaks: a.breaks, corrections: a.corrections, events: a.events,
  };
}

export function apiCheckIn(selfie: string | null): Promise<ApiAttendance> {
  return request("/attendance/check-in", { method: "POST", body: JSON.stringify({ selfie }) });
}

export function apiBreakStart(): Promise<ApiAttendance> {
  return request("/attendance/break/start", { method: "POST" });
}

export function apiBreakEnd(): Promise<ApiAttendance> {
  return request("/attendance/break/end", { method: "POST" });
}

export function apiCheckOut(): Promise<ApiAttendance> {
  return request("/attendance/check-out", { method: "POST" });
}

export function apiTodayAttendance(): Promise<ApiAttendance | null> {
  return request("/attendance/today");
}

export function apiListAttendance(params: { date?: string; user_id?: string; limit?: number } = {}): Promise<ApiAttendance[]> {
  const qs = new URLSearchParams();
  if (params.date) qs.set("date", params.date);
  if (params.user_id) qs.set("user_id", params.user_id);
  if (params.limit) qs.set("limit", String(params.limit));
  const suffix = qs.toString() ? `?${qs}` : "";
  return request(`/attendance${suffix}`);
}

export function apiCorrectAttendance(payload: { user_id: string; date: string; check_in: string | null; check_out: string | null; reason: string }): Promise<ApiAttendance> {
  return request("/attendance/correct", { method: "POST", body: JSON.stringify(payload) });
}

export async function apiFetchSelfieBlob(attendanceId: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/attendance/${attendanceId}/selfie`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Could not load selfie (${res.status})`);
  return res.blob();
}

export interface ApiChannel { id: string; name: string; type: string; project_id: string | null; topic: string; members: string[]; unread: number }
export interface ApiMessage {
  id: string; channel_id: string; sender_id: string | null; text: string; at: number;
  parent_id: string | null; edited: boolean; attachments: string[]; reactions: Record<string, string[]>;
}

export function mapApiChannel(c: ApiChannel): Channel {
  return { id: c.id, name: c.name, type: c.type as Channel["type"], members: c.members, topic: c.topic || undefined, projectId: c.project_id || undefined, unread: c.unread };
}

export function mapApiMessage(m: ApiMessage): Message {
  return {
    id: m.id, channelId: m.channel_id, senderId: m.sender_id || "", at: m.at, text: m.text,
    reactions: m.reactions, parentId: m.parent_id, attachments: m.attachments, edited: m.edited || undefined,
  };
}

export function apiListChannels(): Promise<ApiChannel[]> {
  return request("/channels");
}

export function apiCreateChannel(payload: { name?: string; type: string; project_id?: string | null; topic?: string; member_ids: string[] }): Promise<ApiChannel> {
  return request("/channels", { method: "POST", body: JSON.stringify(payload) });
}

export function apiListMessages(channelId: string): Promise<ApiMessage[]> {
  return request(`/channels/${channelId}/messages`);
}

export function apiSendMessage(channelId: string, payload: { text: string; parent_id?: string | null; attachment_file_id?: string | null }): Promise<ApiMessage> {
  return request(`/channels/${channelId}/messages`, { method: "POST", body: JSON.stringify(payload) });
}

export function apiMarkChannelRead(channelId: string): Promise<{ ok: boolean }> {
  return request(`/channels/${channelId}/read`, { method: "POST" });
}

export function apiEditMessage(id: string, text: string): Promise<ApiMessage> {
  return request(`/messages/${id}`, { method: "PATCH", body: JSON.stringify({ text }) });
}

export function apiDeleteMessage(id: string): Promise<null> {
  return request(`/messages/${id}`, { method: "DELETE" });
}

export function apiToggleReaction(id: string, emoji: string): Promise<ApiMessage> {
  return request(`/messages/${id}/reactions`, { method: "POST", body: JSON.stringify({ emoji }) });
}

export function apiSearchMessages(q: string): Promise<ApiMessage[]> {
  return request(`/messages/search?q=${encodeURIComponent(q)}`);
}
