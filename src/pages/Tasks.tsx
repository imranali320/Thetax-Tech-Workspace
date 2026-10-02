import React from "react";
import type { Task, PageProps } from "../types";
import { Icon } from "../components/Icon";
import { TaskDetail } from "../components/TaskDetail";
import { TaskForm } from "../components/TaskForm";
import { AvatarStack, Chip, Empty, PRIORITY_TONE, PageHead } from "../components/ui";
import { can } from "../lib/access";
import { SL, STATUSES, canEditTask, fmtDue, isOverdue, visibleTasks } from "../lib/tasks";
import { useStore } from "../store/StoreContext";

/* ---------------- task board ---------------- */
function TaskCard({ t, onOpen, draggable }: { t: Task; onOpen: (id: string) => void; draggable: boolean }) {
  const { db } = useStore();
  return (
    <button className={`tcard ${isOverdue(t) ? "overdue" : ""}`} onClick={() => onOpen(t.id)} draggable={draggable}
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", t.id); e.dataTransfer.effectAllowed = "move"; }}>
      <div className="row between"><span className="mono small muted">{t.id}</span><Chip tone={PRIORITY_TONE[t.priority]}>{t.priority}</Chip></div>
      <strong className="tcard-title">{t.title}</strong>
      <div className="row between">
        <AvatarStack ids={t.assignees} size={24} />
        <span className="row gap8 small muted">
          {t.comments.length > 0 && <span className="row gap4"><Icon name="chat" size={14} />{t.comments.length}</span>}
          {t.attachments.length > 0 && <span className="row gap4"><Icon name="clip" size={14} />{t.attachments.length}</span>}
          <span className={isOverdue(t) ? "neg" : ""}>{fmtDue(t.dueAt)}</span>
        </span>
      </div>
      {t.project && <span className="small muted">{db.projects.find((p) => p.id === t.project)?.name}</span>}
    </button>
  );
}

export function TasksPage({ param }: PageProps) {
  const { db, me, update, toast } = useStore();
  const [scope, setScope] = React.useState(me.role === "employee" ? "mine" : "all");
  const [project, setProject] = React.useState("all");
  const [prio, setPrio] = React.useState("all");
  const [q, setQ] = React.useState("");
  const [showCancelled, setShowCancelled] = React.useState(false);
  const [open, setOpen] = React.useState(param && param !== "new" ? param : null);
  const [creating, setCreating] = React.useState(param === "new");
  const [over, setOver] = React.useState(null);
  React.useEffect(() => { if (param && param !== "new") setOpen(param); if (param === "new") setCreating(true); }, [param]);

  let tasks = visibleTasks(db, me);
  if (scope === "mine") tasks = tasks.filter((t) => t.assignees.includes(me.id));
  if (scope === "byme") tasks = tasks.filter((t) => t.assignedBy === me.id);
  if (project !== "all") tasks = tasks.filter((t) => (project === "none" ? !t.project : t.project === project));
  if (prio !== "all") tasks = tasks.filter((t) => t.priority === prio);
  if (q) tasks = tasks.filter((t) => (t.title + t.id + t.description).toLowerCase().includes(q.toLowerCase()));
  const cols = STATUSES.filter(([s]) => s !== "cancelled" || showCancelled);

  const move = (id, status) => {
    const t = db.tasks.find((x) => x.id === id);
    if (!t || t.status === status) return;
    if (!canEditTask(t, me)) return toast("You can only move tasks you're assigned to or created.", "error");
    update((n, h) => {
      const x = n.tasks.find((y) => y.id === id);
      x.status = status;
      x.activity.unshift({ at: Date.now(), by: me.id, text: `moved it to ${SL[status]}` });
      h.notify([...x.assignees, x.assignedBy], "task", `${me.name} moved ${id} to ${SL[status]}`, { page: "tasks", id });
      if (x.project) n.projects.find((p) => p.id === x.project)?.activity.unshift({ at: Date.now(), by: me.id, text: `moved ${id} to ${SL[status]}` });
    });
  };

  return (
    <div className="page page-wide">
      <PageHead title="Task Board" sub={`${tasks.filter((t) => !["done", "cancelled"].includes(t.status)).length} open · ${tasks.filter(isOverdue).length} overdue`}>
        {can.assignTasks(me) && <button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" />New task</button>}
      </PageHead>
      <div className="toolbar">
        <select value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Scope">
          <option value="mine">Assigned to me</option>
          {me.role !== "employee" && <option value="all">All I can see</option>}
          {me.role === "employee" && <option value="all">Me and my projects</option>}
          {can.assignTasks(me) && <option value="byme">Assigned by me</option>}
        </select>
        <select value={project} onChange={(e) => setProject(e.target.value)} aria-label="Project"><option value="all">All projects</option><option value="none">No project</option>{db.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select value={prio} onChange={(e) => setPrio(e.target.value)} aria-label="Priority"><option value="all">Any priority</option>{["Urgent", "High", "Normal", "Low"].map((p) => <option key={p}>{p}</option>)}</select>
        <div className="search"><Icon name="search" size={16} /><input placeholder="Search tasks" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search tasks" /></div>
        <label className="check"><input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} />Show cancelled</label>
      </div>

      <div className="kanban desktop-only">
        {cols.map(([s, label]) => {
          const list = tasks.filter((t) => t.status === s).sort((a, b) => a.dueAt - b.dueAt);
          return (
            <div key={s} className={`kcol ${over === s ? "drop" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setOver(s); }} onDragLeave={() => setOver(null)}
              onDrop={(e) => { e.preventDefault(); setOver(null); move(e.dataTransfer.getData("text/plain"), s); }}>
              <div className="kcol-head"><span className={`dot dot-${s}`} />{label}<span className="count">{list.length}</span></div>
              <div className="kcol-body">
                {list.map((t) => <TaskCard key={t.id} t={t} onOpen={setOpen} draggable={canEditTask(t, me)} />)}
                {list.length === 0 && <span className="kempty">Drop tasks here</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mobile-only stack-list">
        {cols.map(([s, label]) => {
          const list = tasks.filter((t) => t.status === s);
          if (!list.length) return null;
          return (
            <section key={s} className="card">
              <h2 className="card-title">{label} <span className="muted">({list.length})</span></h2>
              {list.map((t) => (
                <div key={t.id} className="mtask">
                  <button className="grow text-left" onClick={() => setOpen(t.id)}>
                    <span className="mono small muted">{t.id}</span> <strong>{t.title}</strong>
                    <span className={`small block ${isOverdue(t) ? "neg" : "muted"}`}>{t.priority} · {fmtDue(t.dueAt)}</span>
                  </button>
                  <select value={t.status} disabled={!canEditTask(t, me)} onChange={(e) => move(t.id, e.target.value)} aria-label={`Status of ${t.id}`}>{STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                </div>
              ))}
            </section>
          );
        })}
        {tasks.length === 0 && <Empty icon="tasks" title="No tasks match these filters" />}
      </div>

      {open && <TaskDetail id={open} onClose={() => setOpen(null)} />}
      {creating && <TaskForm onClose={() => setCreating(false)} />}
    </div>
  );
}
