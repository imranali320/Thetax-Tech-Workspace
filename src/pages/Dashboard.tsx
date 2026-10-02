import React from "react";
import type { Task } from "../types";
import { Icon } from "../components/Icon";
import { WorkdayCard } from "../components/WorkdayCard";
import { Avatar, Chip, Empty, PRIORITY_TONE, PageHead, Stat } from "../components/ui";
import { can } from "../lib/access";
import { addDays, dateKey, fmtDur, fmtTime, timeAgo, useNow } from "../lib/time";
import { useStore } from "../store/StoreContext";
import { attendanceRows } from "./Attendance";
import { apiListAttendance, apiListFiles, mapApiAttendance, mapApiFile } from "../lib/api";
import type { AttendanceRecord, FileItem } from "../types";

/* ---------------- dashboards ---------------- */
function TaskMini({ t }: { t: Task }) {
  const { go } = useStore();
  const overdue = t.status !== "done" && t.status !== "cancelled" && t.dueAt < Date.now();
  return (
    <button className="task-mini" onClick={() => go("tasks", t.id)}>
      <span className="mono small muted">{t.id}</span>
      <span className="grow">{t.title}</span>
      <Chip tone={PRIORITY_TONE[t.priority]}>{t.priority}</Chip>
      <span className={`small ${overdue ? "neg" : "muted"}`}>{overdue ? "Overdue" : fmtTime(t.dueAt)}</span>
    </button>
  );
}
function RecentMessages({ limit = 5 }: { limit?: number }) {
  const { db, me, go } = useStore();
  const chans = db.channels.filter((c) => c.members.includes(me.id)).map((c) => c.id);
  const msgs = db.messages.filter((m) => chans.includes(m.channelId) && !m.parentId).sort((a, b) => b.at - a.at).slice(0, limit);
  const chName = (id) => {
    const c = db.channels.find((x) => x.id === id);
    if (c.type === "dm") return db.users.find((u) => u.id === c.members.find((x) => x !== me.id))?.name || "Direct message";
    return "#" + c.name;
  };
  return (
    <section className="card">
      <div className="card-head"><h2 className="card-title">Recent messages</h2><button className="link" onClick={() => go("chat")}>Open chat</button></div>
      <div className="feed">
        {msgs.map((m) => {
          const u = db.users.find((x) => x.id === m.senderId);
          return (
            <button key={m.id} className="feed-item" onClick={() => go("chat", m.channelId)}>
              <Avatar user={u} size={30} />
              <div className="grow"><div className="row gap8"><strong className="small">{u.name}</strong><span className="muted small">{chName(m.channelId)} · {timeAgo(m.at)}</span></div><p className="clamp2">{m.text}</p></div>
            </button>
          );
        })}
        {msgs.length === 0 && <Empty icon="chat" title="No messages yet" />}
      </div>
    </section>
  );
}
function RecentFiles() {
  const { db, go } = useStore();
  const [files, setFiles] = React.useState<FileItem[]>([]);
  React.useEffect(() => {
    apiListFiles().then((fs) => setFiles(fs.map(mapApiFile).filter((f) => f.visibility !== "hr").sort((a, b) => b.at - a.at).slice(0, 4))).catch(() => {});
  }, []);
  return (
    <section className="card">
      <div className="card-head"><h2 className="card-title">Recent files</h2><button className="link" onClick={() => go("files")}>All files</button></div>
      <div className="feed">
        {files.map((f) => (
          <button key={f.id} className="feed-item" onClick={() => go("files", f.id)}>
            <span className={`ftype ftype-${f.type}`}>{f.type}</span>
            <div className="grow"><strong className="small">{f.name}</strong><span className="muted small block">{db.users.find((u) => u.id === f.ownerId)?.name} · {timeAgo(f.at)}</span></div>
          </button>
        ))}
        {files.length === 0 && <Empty icon="folder" title="No files yet" />}
      </div>
    </section>
  );
}

export function Dashboard() {
  const { db, me, go } = useStore();
  const now = useNow(30000);
  const today = dateKey();
  const admin = ["owner", "admin", "hr"].includes(me.role) || me.role === "lead";
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening";
  const myTasks = db.tasks.filter((t) => t.assignees.includes(me.id) && !["done", "cancelled"].includes(t.status)).sort((a, b) => a.dueAt - b.dueAt);
  const [todayRecords, setTodayRecords] = React.useState<AttendanceRecord[]>([]);
  React.useEffect(() => {
    if (!admin) return;
    apiListAttendance({ date: today }).then((rs) => setTodayRecords(rs.map(mapApiAttendance))).catch(() => {});
  }, [admin, today]);

  // personal KPI
  const myDefs = db.kpiDefs.filter((k) => k.dept === me.dept);
  const kpiToday = (defId) => db.kpiEntries.filter((e) => e.defId === defId && e.userId === me.id && e.date === today).reduce((s, e) => s + e.value, 0);
  const kpiAvg = (defId) => {
    const e = db.kpiEntries.filter((x) => x.defId === defId && x.userId === me.id && x.date !== today && x.date >= addDays(today, -10));
    const days = new Set(e.map((x) => x.date)).size || 1;
    return Math.round(e.reduce((s, x) => s + x.value, 0) / days);
  };

  if (!admin) {
    return (
      <div className="page">
        <PageHead title={`${greeting}, ${me.name.split(" ")[0]}`} sub={new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })} />
        <div className="dash-grid">
          <div className="col-main">
            <WorkdayCard />
            <section className="card">
              <div className="card-head"><h2 className="card-title">My open tasks</h2><button className="link" onClick={() => go("tasks")}>Task board</button></div>
              <div className="stack-list">{myTasks.slice(0, 6).map((t) => <TaskMini key={t.id} t={t} />)}{myTasks.length === 0 && <Empty icon="tasks" title="Nothing assigned">New tasks from your lead will appear here.</Empty>}</div>
            </section>
            {myDefs.length > 0 && (
              <section className="card">
                <div className="card-head"><h2 className="card-title">Today's KPIs</h2><button className="link" onClick={() => go("performance")}>Log numbers</button></div>
                <div className="kpi-row">{myDefs.map((k) => <Stat key={k.id} label={k.name} value={kpiToday(k.id).toLocaleString()} sub={`avg ${kpiAvg(k.id).toLocaleString()}/day`} />)}</div>
              </section>
            )}
          </div>
          <div className="col-side"><RecentMessages /><RecentFiles /></div>
        </div>
      </div>
    );
  }

  let rows = attendanceRows(db.users, todayRecords, now);
  if (me.role === "lead") rows = rows.filter((r) => r.user.dept === me.dept || r.user.managerId === me.id || r.user.id === me.id);
  const count = (fn) => rows.filter(fn).length;
  const totalNet = rows.reduce((s, r) => s + r.net, 0);
  const visTasks = me.role === "lead" ? db.tasks.filter((t) => t.dept === me.dept || t.assignedBy === me.id) : db.tasks;
  const tc = (s) => visTasks.filter((t) => t.status === s).length;
  const overdue = visTasks.filter((t) => !["done", "cancelled"].includes(t.status) && t.dueAt < now).length;
  const depts = db.departments.map((d) => {
    const us = rows.filter((r) => r.user.dept === d.id);
    return { ...d, total: us.length, in: us.filter((r) => r.state !== "absent").length };
  }).filter((d) => d.total > 0);
  const todayKpi = ["Calls", "Appointments", "Bids submitted", "Leads generated", "Sales closed"].map((name) => {
    const defs = db.kpiDefs.filter((k) => k.name === name).map((k) => k.id);
    return { name, v: db.kpiEntries.filter((e) => defs.includes(e.defId) && e.date === today).reduce((s, e) => s + e.value, 0) };
  });

  return (
    <div className="page">
      <PageHead title={`${greeting}, ${me.name.split(" ")[0]}`} sub={`${db.settings.company} · ${new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}`}>
        {can.manageEmployees(me) && <button className="btn" onClick={() => go("employees", "new")}><Icon name="plus" />Add employee</button>}
        {can.assignTasks(me) && <button className="btn" onClick={() => go("tasks", "new")}><Icon name="plus" />Assign task</button>}
        {can.manageProjects(me) && <button className="btn" onClick={() => go("projects", "new")}><Icon name="plus" />Create project</button>}
        <button className="btn" onClick={() => go("files", "upload")}><Icon name="upload" />Upload file</button>
      </PageHead>

      <div className="stats">
        <Stat label="Working now" value={count((r) => r.state === "working")} tone="green" onClick={() => go("attendance")} />
        <Stat label="On break" value={count((r) => r.state === "break")} tone="amber" onClick={() => go("attendance")} />
        <Stat label="Late today" value={count((r) => r.late)} tone="red" onClick={() => go("attendance")} />
        <Stat label="Not checked in" value={count((r) => r.state === "absent")} onClick={() => go("attendance")} />
        <Stat label="Checked out" value={count((r) => r.state === "out")} tone="blue" />
        <Stat label="Hours worked today" value={fmtDur(totalNet)} sub={`${rows.length} employees`} />
      </div>

      <div className="dash-grid">
        <div className="col-main">
          <section className="card">
            <div className="card-head"><h2 className="card-title">Who's in today</h2><button className="link" onClick={() => go("attendance")}>Full attendance</button></div>
            <div className="people-strip">
              {rows.map((r) => (
                <div key={r.user.id} className={`person person-${r.state}`}>
                  <Avatar user={r.user} size={40} />
                  <strong className="small">{r.user.name.split(" ")[0]}</strong>
                  <span className="small muted">{r.state === "absent" ? "Not in" : r.state === "break" ? "Break" : r.state === "out" ? "Left" : fmtTime(r.rec.checkIn)}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="card">
            <div className="card-head"><h2 className="card-title">Tasks</h2><button className="link" onClick={() => go("tasks")}>Task board</button></div>
            <div className="kpi-row">
              <Stat label="To do" value={tc("todo")} /><Stat label="In progress" value={tc("progress")} tone="blue" /><Stat label="In review" value={tc("review")} tone="amber" /><Stat label="Completed" value={tc("done")} tone="green" /><Stat label="Overdue" value={overdue} tone="red" />
            </div>
          </section>
          <section className="card">
            <h2 className="card-title">Department attendance</h2>
            <div className="bars">
              {depts.map((d) => (
                <div key={d.id} className="bar-row">
                  <span className="bar-label">{d.name}</span>
                  <div className="bar-track"><div className="bar-fill" style={{ width: `${(d.in / d.total) * 100}%` }} /></div>
                  <span className="num small">{d.in}/{d.total}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="card">
            <div className="card-head"><h2 className="card-title">Today's department numbers</h2><button className="link" onClick={() => go("performance")}>Performance</button></div>
            <div className="kpi-row">{todayKpi.map((k) => <Stat key={k.name} label={k.name} value={k.v} />)}</div>
          </section>
        </div>
        <div className="col-side">
          <WorkdayCard compact />
          <RecentMessages />
          <RecentFiles />
        </div>
      </div>
    </div>
  );
}
