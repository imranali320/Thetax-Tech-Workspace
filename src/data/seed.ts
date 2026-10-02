import type { DB } from "../types";
import { DEFAULT_ACCESS } from "../lib/access";
import { addDays, atTime, dateKey, uid } from "../lib/time";

/* ---------- seed data ---------- */
export function buildSeed(): DB {
  const today = dateKey();
  const now = Date.now();
  const departments = [
    { id: "d1", name: "Management", managerId: "u1" },
    { id: "d2", name: "Development", managerId: "u4" },
    { id: "d3", name: "Sales", managerId: "u2" },
    { id: "d4", name: "Marketing", managerId: "u2" },
    { id: "d5", name: "Upwork / Bidding", managerId: "u7" },
    { id: "d6", name: "HR", managerId: "u3" },
    { id: "d7", name: "Accounts", managerId: "u1" },
  ];
  const mk = (id, empId, name, role, dept, title, shift, joined, managerId, presence) => ({
    id, empId, name, role, dept, title, shift, joined, managerId, presence,
    email: name.toLowerCase().split(" ")[0] + "@thetaxtech.com",
    phone: "03xx xxxxxxx", breakMins: 30, status: "active", password: "demo123", mustChange: false,
  });
  const users = [
    mk("u1", "TX-001", "Hamza Siddiqui", "owner", "d1", "Chief Executive", "09:00", "2022-03-01", null, "online"),
    mk("u2", "TX-002", "Ayesha Khan", "admin", "d1", "Operations Manager", "09:00", "2022-06-15", "u1", "online"),
    mk("u3", "TX-003", "Sana Raza", "hr", "d6", "HR Executive", "09:00", "2023-01-09", "u2", "online"),
    mk("u4", "TX-004", "Bilal Ahmed", "lead", "d2", "Lead Engineer", "09:00", "2022-09-01", "u1", "online"),
    mk("u5", "TX-005", "Usman Tariq", "employee", "d2", "Software Engineer", "09:00", "2024-02-12", "u4", "online"),
    mk("u6", "TX-006", "Mahnoor Iqbal", "employee", "d3", "Sales Executive", "10:00", "2024-05-06", "u2", "away"),
    mk("u7", "TX-007", "Faizan Ali", "lead", "d5", "Bidding Lead", "12:00", "2023-04-17", "u2", "online"),
    mk("u8", "TX-008", "Hira Nadeem", "employee", "d4", "Marketing Associate", "09:00", "2024-08-19", "u2", "away"),
    mk("u9", "TX-009", "Zain Qureshi", "accountant", "d7", "Accountant", "09:00", "2023-07-03", "u1", "offline"),
    mk("u10", "TX-010", "Daniyal Shah", "employee", "d2", "Junior Developer", "09:00", "2025-01-20", "u4", "offline"),
  ];

  // attendance history: last 6 working days + today
  const attendance = [];
  const seedTimes = { u1: [-8, 0], u2: [-2, 5], u3: [3, 0], u4: [22, 10], u5: [1, -5], u6: [-4, 20], u7: [6, 0], u8: [12, 15], u9: [-3, 0], u10: [30, 0] };
  let dk = today, day = 0, safety = 0;
  while (day < 7 && safety < 20) {
    safety++;
    const wd = new Date(atTime(dk, "12:00")).getDay();
    if (wd !== 0 && wd !== 6) {
      users.forEach((u, i) => {
        const isToday = dk === today;
        if (isToday && ["u5", "u9", "u10"].includes(u.id)) return; // not in yet (u5 is the demo employee)
        if (!isToday && (i + day) % 9 === 4) return; // occasional absence
        const [lateMin, outMin] = seedTimes[u.id];
        const jitter = ((i * 7 + day * 13) % 11) - 5;
        const inTs = atTime(dk, u.shift) + (lateMin + jitter) * 60000;
        const late = lateMin + jitter > 15;
        const brStart = inTs + (3.5 * 3600000);
        const brLen = (25 + ((i + day) % 4) * 5 + (u.id === "u8" && day === 2 ? 20 : 0)) * 60000;
        const rec = { id: uid("a"), userId: u.id, date: dk, checkIn: inTs, checkOut: null, late, selfie: null, breaks: [], corrections: [], events: [{ type: "check_in", at: inTs }] };
        if (isToday) {
          if (brStart < now) rec.breaks.push({ id: uid("b"), start: brStart, end: u.id === "u8" ? null : Math.min(now, brStart + brLen) });
        } else {
          rec.breaks.push({ id: uid("b"), start: brStart, end: brStart + brLen });
          rec.checkOut = inTs + (8 * 60 + 30 + outMin) * 60000;
          rec.events.push({ type: "check_out", at: rec.checkOut });
        }
        if (inTs > now) return;
        attendance.push(rec);
      });
      day++;
    }
    dk = addDays(dk, -1);
  }

  const due = (d, hm = "18:00") => atTime(addDays(today, d), hm);
  const T = (n, title, description, assignees, assignedBy, dept, priority, status, dueAt, project, comments = []) => ({
    id: `T-${n}`, title, description, assignees, assignedBy, dept, priority, status, dueAt, project,
    comments, attachments: [], createdAt: now - (1024 - n + 40) * 3600000,
    activity: [{ at: now - (1024 - n + 40) * 3600000, by: assignedBy, text: "created the task" }],
  });
  const tasks = [
    T(1011, "Set up staging server on Hostinger", "Create staging subdomain, SSL and deploy pipeline for the client portal.", ["u5"], "u4", "d2", "High", "done", due(-3), "p1"),
    T(1014, "Design login and first-password screens", "Match the new brand. Include forced password change for new accounts.", ["u5", "u10"], "u4", "d2", "Normal", "review", due(0, "17:00"), "p1",
      [{ id: uid("c"), by: "u5", at: now - 5400000, text: "Screens are in Figma, @Bilal Ahmed please review." }]),
    T(1018, "Attendance API: check-in with selfie", "POST endpoint, server timestamp, compress image to 480px before storing.", ["u5"], "u4", "d2", "Urgent", "progress", due(0, "18:00"), "p1"),
    T(1019, "Fix timezone bug in daily report", "Reports show UTC dates for late check-ins. Use Asia/Karachi.", ["u10"], "u4", "d2", "High", "todo", due(-1), "p1"),
    T(1020, "Kanban drag and drop on task board", "Desktop drag and drop, simple list view on mobile.", ["u5"], "u4", "d2", "Normal", "todo", due(3), "p1"),
    T(1021, "Call back 20 warm leads from the expo list", "Log each call in the KPI sheet.", ["u6"], "u2", "d3", "High", "progress", due(0), "p2"),
    T(1022, "Prepare proposal for Al-Noor Traders", "Pricing for 3 packages, send by Thursday.", ["u6"], "u2", "d3", "Normal", "todo", due(2), "p2"),
    T(1023, "Launch October Meta campaign", "Two creatives, lead form, daily budget as approved.", ["u8"], "u2", "d4", "Urgent", "review", due(1), "p2"),
    T(1024, "Submit 15 bids on ML / data projects", "Focus on fixed-price jobs over $500 with verified clients.", ["u7"], "u2", "d5", "High", "progress", due(0, "21:00"), "p3"),
    T(1025, "Refresh Upwork profile portfolio", "Add three recent case studies with screenshots.", ["u7", "u8"], "u2", "d5", "Normal", "todo", due(4), "p3"),
    T(1026, "Collect updated CNIC copies for records", "Only for employees whose copies have expired.", ["u3"], "u2", "d6", "Low", "todo", due(5), null),
    T(1027, "Reconcile September bank statement", "Match payments with invoices and flag differences.", ["u9"], "u1", "d7", "High", "progress", due(1), null),
  ];

  const projects = [
    { id: "p1", name: "Client Portal Revamp", managerId: "u4", members: ["u4", "u5", "u10", "u2"], start: addDays(today, -21), deadline: addDays(today, 24), status: "Active", description: "New client portal with attendance, tasks and reporting modules.", activity: [{ at: now - 86400000, by: "u4", text: "moved T-1014 to Review" }, { at: now - 3 * 86400000, by: "u5", text: "completed T-1011" }] },
    { id: "p2", name: "Q4 Lead Generation", managerId: "u2", members: ["u2", "u6", "u8"], start: addDays(today, -10), deadline: addDays(today, 50), status: "Active", description: "Paid campaigns plus outbound calling to fill the Q4 pipeline.", activity: [{ at: now - 2 * 86400000, by: "u8", text: "uploaded campaign creatives" }] },
    { id: "p3", name: "Upwork Growth Sprint", managerId: "u7", members: ["u7", "u8", "u2"], start: addDays(today, -5), deadline: addDays(today, 25), status: "Active", description: "Raise bid volume and reply rate on ML and automation jobs.", activity: [] },
  ];

  const channels = [
    { id: "c-general", name: "general", type: "channel", members: users.map((u) => u.id), topic: "Company-wide announcements" },
    { id: "c-dev", name: "development", type: "channel", members: ["u1", "u2", "u4", "u5", "u10"], topic: "Engineering team" },
    { id: "c-sales", name: "sales-marketing", type: "channel", members: ["u1", "u2", "u6", "u8"], topic: "Leads, campaigns, calls" },
    { id: "c-bid", name: "bidding", type: "channel", members: ["u1", "u2", "u7", "u8"], topic: "Upwork bids and replies" },
    { id: "c-p1", name: "client-portal", type: "project", projectId: "p1", members: ["u4", "u5", "u10", "u2"], topic: "Project channel" },
    { id: "dm:u4:u5", name: "", type: "dm", members: ["u4", "u5"] },
  ];
  const M = (ch, by, minsAgo, text, extra = {}) => ({ id: uid("m"), channelId: ch, senderId: by, at: now - minsAgo * 60000, text, reactions: {}, parentId: null, attachments: [], ...extra });
  const m1 = M("c-general", "u2", 180, "Good morning team. Reminder: attendance selfies are required from today, check in from the dashboard.");
  const messages = [
    m1,
    M("c-general", "u1", 170, "Thanks Ayesha. Monthly review meeting is on Friday at 4 pm.", { reactions: { "👍": ["u4", "u5", "u6"] } }),
    M("c-general", "u3", 30, "Leave requests for next month should be submitted by the 25th please."),
    M("c-dev", "u4", 150, "@Usman Tariq the attendance API is the priority today. Staging is ready."),
    M("c-dev", "u5", 140, "On it. I'll push the first version before lunch."),
    M("c-dev", "u10", 60, "Looking at the timezone bug now, it's the report query."),
    M("c-sales", "u6", 90, "12 calls done so far, 3 appointments booked."),
    M("c-sales", "u8", 45, "Campaign creatives are in Files > Marketing. Waiting for approval."),
    M("c-bid", "u7", 120, "8 bids out this morning, 2 replies already."),
    M("c-p1", "u4", 200, "Kickoff notes uploaded to the project folder."),
    M("dm:u4:u5", "u4", 25, "Can you share the API response format when ready?"),
  ];
  messages.push(M("c-general", "u5", 160, "Noted, done for today.", { parentId: m1.id }));

  const F = (name, size, type, ownerId, folder, visibility, extra = {}) => ({ id: uid("f"), name, size, type, ownerId, folder, visibility, at: now - Math.floor(Math.random() * 6 + 1) * 86400000, versions: [{ v: 1, at: now - 6 * 86400000, by: ownerId }], data: null, ...extra });
  const files = [
    F("Employee Handbook 2026.pdf", 1840000, "pdf", "u3", { dept: "d6" }, "company"),
    F("Leave Policy.docx", 96000, "docx", "u3", { dept: "d6" }, "company"),
    F("Portal Kickoff Notes.docx", 54000, "docx", "u4", { dept: "d2", project: "p1" }, "project"),
    F("API Spec v2.pdf", 420000, "pdf", "u5", { dept: "d2", project: "p1" }, "project", { versions: [{ v: 1, at: now - 9 * 86400000, by: "u5" }, { v: 2, at: now - 2 * 86400000, by: "u5" }] }),
    F("October Campaign Creatives.pptx", 6200000, "pptx", "u8", { dept: "d4", project: "p2" }, "project"),
    F("Sales Pricing Sheet.xlsx", 88000, "xlsx", "u2", { dept: "d3" }, "department"),
    F("September Invoices.xlsx", 210000, "xlsx", "u9", { dept: "d7" }, "department"),
    F("Contract - Usman Tariq.pdf", 310000, "pdf", "u3", { dept: "d6", employee: "u5" }, "hr"),
    F("Contract - Mahnoor Iqbal.pdf", 305000, "pdf", "u3", { dept: "d6", employee: "u6" }, "hr"),
  ];

  const kpiDefs = [
    ["d3", "Calls", "number"], ["d3", "Leads contacted", "number"], ["d3", "Appointments", "number"], ["d3", "Sales closed", "number"], ["d3", "Revenue (PKR)", "currency"],
    ["d4", "Posts", "number"], ["d4", "Campaigns", "number"], ["d4", "Leads generated", "number"], ["d4", "Ad spend (PKR)", "currency"],
    ["d5", "Bids submitted", "number"], ["d5", "Connects used", "number"], ["d5", "Replies", "number"], ["d5", "Interviews", "number"], ["d5", "Jobs won", "number"],
    ["d2", "Tasks completed", "number"], ["d2", "Tickets resolved", "number"], ["d2", "Bugs fixed", "number"],
    ["d6", "Candidates contacted", "number"], ["d6", "Interviews", "number"], ["d6", "Hires", "number"],
    ["d7", "Invoices", "number"], ["d7", "Payments recorded", "number"], ["d7", "Reconciliations", "number"],
  ].map(([dept, name, type], i) => ({ id: "k" + i, dept, name, type }));
  const kpiEntries = [];
  const base = { Calls: 30, "Leads contacted": 18, Appointments: 3, "Sales closed": 1, "Revenue (PKR)": 85000, Posts: 3, Campaigns: 1, "Leads generated": 22, "Ad spend (PKR)": 6000, "Bids submitted": 12, "Connects used": 150, Replies: 3, Interviews: 1, "Jobs won": 0, "Tasks completed": 3, "Tickets resolved": 4, "Bugs fixed": 2, "Candidates contacted": 10, Hires: 0, Invoices: 6, "Payments recorded": 5, Reconciliations: 1 };
  for (let d = 1; d <= 9; d++) {
    const dk2 = addDays(today, -d);
    const wd = new Date(atTime(dk2, "12:00")).getDay();
    if (wd === 0 || wd === 6) continue;
    users.forEach((u, i) => {
      kpiDefs.filter((k) => k.dept === u.dept).forEach((k) => {
        const b = base[k.name] ?? 2;
        const v = Math.max(0, Math.round(b * (0.6 + (((i + 1) * (d + 3) * 7 + k.name.length) % 9) / 10)));
        kpiEntries.push({ id: uid("e"), defId: k.id, userId: u.id, date: dk2, value: v });
      });
    });
  }
  // some today entries
  [["u6", "Calls", 12], ["u6", "Appointments", 3], ["u7", "Bids submitted", 8], ["u7", "Replies", 2], ["u8", "Leads generated", 14]].forEach(([u, n, v]) => {
    const k = kpiDefs.find((x) => x.name === n && x.dept === users.find((y) => y.id === u).dept);
    kpiEntries.push({ id: uid("e"), defId: k.id, userId: u, date: today, value: v });
  });

  const leaves = [
    { id: uid("l"), userId: "u6", type: "Casual", start: addDays(today, 6), end: addDays(today, 7), reason: "Family wedding", status: "pending", at: now - 7200000, decidedBy: null, note: "" },
    { id: uid("l"), userId: "u10", type: "Sick", start: addDays(today, -12), end: addDays(today, -11), reason: "Fever", status: "approved", at: now - 13 * 86400000, decidedBy: "u3", note: "Get well soon" },
    { id: uid("l"), userId: "u5", type: "Annual", start: addDays(today, 20), end: addDays(today, 24), reason: "Trip to Hunza", status: "pending", at: now - 86400000, decidedBy: null, note: "" },
  ];

  const N = (userId, type, text, minsAgo, link, read = false) => ({ id: uid("n"), userId, type, text, at: now - minsAgo * 60000, link, readAt: read ? now : null });
  const notifications = [
    N("u5", "task", "Bilal Ahmed assigned you T-1018: Attendance API: check-in with selfie", 200, { page: "tasks", id: "T-1018" }),
    N("u5", "mention", "Bilal Ahmed mentioned you in #development", 150, { page: "chat", id: "c-dev" }),
    N("u5", "task", "T-1019 is overdue", 60, { page: "tasks", id: "T-1019" }, true),
    N("u4", "mention", "Usman Tariq mentioned you on T-1014", 90, { page: "tasks", id: "T-1014" }),
    N("u2", "leave", "Mahnoor Iqbal requested Casual leave", 120, { page: "leave" }),
    N("u3", "leave", "Mahnoor Iqbal requested Casual leave", 120, { page: "leave" }),
    N("u1", "announcement", "Daily backup completed successfully", 400, { page: "settings" }, true),
  ];

  const audit = [
    { id: uid("x"), at: now - 5 * 86400000, userId: "u1", action: "permission.change", entity: "user", entityId: "u7", meta: "Role changed to Team Lead / Manager" },
    { id: uid("x"), at: now - 2 * 86400000, userId: "u3", action: "attendance.correct", entity: "attendance", entityId: "-", meta: "Hira Nadeem check-out set to 18:05. Reason: forgot to check out" },
    { id: uid("x"), at: now - 86400000, userId: "u2", action: "login.failed", entity: "auth", entityId: "TX-006", meta: "Wrong password" },
    { id: uid("x"), at: now - 3600000, userId: "u2", action: "login", entity: "auth", entityId: "TX-002", meta: "" },
  ];

  const backups = [0, 1, 2].map((d) => ({ id: uid("bk"), at: atTime(addDays(today, -d), "02:00"), size: 48000000 - d * 400000, kind: "Database + files", status: "OK" }));

  return {
    settings: { company: "Theta X Tech", timezone: "Asia/Karachi", graceMins: 15, workHours: 8, defaultBreak: 30, multiBreak: true, maxFileMB: 25, fileTypes: "pdf, doc, docx, xls, xlsx, ppt, pptx, jpg, jpeg, png, csv, txt", selfieRetention: 90, backupTime: "02:00", backupKeep: 14 },
    access: DEFAULT_ACCESS, departments, users, attendance, tasks, projects, channels, messages, files, kpiDefs, kpiEntries, leaves, notifications, audit, backups, lastRead: {},
  } as DB;
}
