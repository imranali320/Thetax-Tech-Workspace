import React from "react";
import type { Project, PageProps } from "../types";
import { Icon } from "../components/Icon";
import { TaskDetail } from "../components/TaskDetail";
import { TaskForm } from "../components/TaskForm";
import { Avatar, AvatarStack, Chip, Empty, Field, Modal, PageHead, Stat } from "../components/ui";
import { can } from "../lib/access";
import { SL, isOverdue } from "../lib/tasks";
import { atTime, dateKey, fmtDate, timeAgo, uid } from "../lib/time";
import { useStore } from "../store/StoreContext";

/* ---------------- projects ---------------- */
function ProjectForm({ onClose }: { onClose: () => void }) {
  const { db, me, update, toast } = useStore();
  const [f, setF] = React.useState({ name: "", description: "", managerId: me.id, start: dateKey(), deadline: "", members: [me.id] });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = () => {
    update((n, h) => {
      const id = uid("p");
      n.projects.push({ id, name: f.name.trim(), description: f.description, managerId: f.managerId, members: [...new Set([...f.members, f.managerId])], start: f.start, deadline: f.deadline, status: "Active", activity: [{ at: Date.now(), by: me.id, text: "created the project" }] });
      n.channels.push({ id: "c-" + id, name: f.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"), type: "project", projectId: id, members: [...new Set([...f.members, f.managerId])], topic: "Project channel" });
      h.notify(f.members, "project", `${me.name} added you to project ${f.name.trim()}`, { page: "projects", id });
      h.log("project.create", "project", id, f.name.trim());
    });
    toast("Project created with its own chat channel.");
    onClose();
  };
  return (
    <Modal title="Create project" onClose={onClose} wide
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!f.name.trim() || !f.deadline} onClick={save}>Create project</button></>}>
      <Field label="Project name"><input value={f.name} onChange={set("name")} autoFocus /></Field>
      <Field label="Description"><textarea rows={2} value={f.description} onChange={set("description")} /></Field>
      <div className="grid3">
        <Field label="Project manager"><select value={f.managerId} onChange={set("managerId")}>{db.users.filter((u) => ["owner", "admin", "lead"].includes(u.role)).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
        <Field label="Start"><input type="date" value={f.start} onChange={set("start")} /></Field>
        <Field label="Deadline"><input type="date" value={f.deadline} onChange={set("deadline")} /></Field>
      </div>
      <fieldset className="field"><legend className="field-label">Members</legend>
        <div className="pick-list">{db.users.filter((u) => u.status === "active").map((u) => (
          <label key={u.id} className={`pick ${f.members.includes(u.id) ? "on" : ""}`}><input type="checkbox" checked={f.members.includes(u.id)} onChange={() => setF({ ...f, members: f.members.includes(u.id) ? f.members.filter((x) => x !== u.id) : [...f.members, u.id] })} /><Avatar user={u} size={24} />{u.name}</label>
        ))}</div>
      </fieldset>
    </Modal>
  );
}

function ProjectDetail({ p, onBack }: { p: Project; onBack: () => void }) {
  const { db, me, update, go } = useStore();
  const [openTask, setOpenTask] = React.useState(null);
  const [adding, setAdding] = React.useState(false);
  const tasks = db.tasks.filter((t) => t.project === p.id);
  const done = tasks.filter((t) => t.status === "done").length;
  const od = tasks.filter(isOverdue).length;
  const files = db.files.filter((f) => f.folder.project === p.id);
  const by = (id) => db.users.find((u) => u.id === id);
  const ch = db.channels.find((c) => c.projectId === p.id);
  const daysLeft = Math.ceil((atTime(p.deadline, "23:59") - Date.now()) / 86400000);
  const setStatus = (s) => update((n, h) => { const x = n.projects.find((y) => y.id === p.id); x.status = s; x.activity.unshift({ at: Date.now(), by: me.id, text: `set status to ${s}` }); h.log("project.status", "project", p.id, s); });
  return (
    <div className="page">
      <button className="link back" onClick={onBack}><Icon name="arrowLeft" size={16} />All projects</button>
      <PageHead title={p.name} sub={p.description}>
        {can.manageProjects(me) && <select value={p.status} onChange={(e) => setStatus(e.target.value)} aria-label="Project status">{["Planning", "Active", "On hold", "Completed"].map((s) => <option key={s}>{s}</option>)}</select>}
        {ch && ch.members.includes(me.id) && <button className="btn" onClick={() => go("chat", ch.id)}><Icon name="chat" />Project channel</button>}
        {can.assignTasks(me) && <button className="btn btn-primary" onClick={() => setAdding(true)}><Icon name="plus" />Add task</button>}
      </PageHead>
      <div className="stats">
        <Stat label="Progress" value={`${tasks.length ? Math.round((done / tasks.length) * 100) : 0}%`} tone="green" sub={`${done} of ${tasks.length} tasks`} />
        <Stat label="Overdue" value={od} tone={od ? "red" : undefined} />
        <Stat label="Deadline" value={fmtDate(p.deadline)} sub={daysLeft >= 0 ? `${daysLeft} days left` : `${-daysLeft} days late`} />
        <Stat label="Files" value={files.length} />
      </div>
      <div className="dash-grid">
        <div className="col-main">
          <section className="card">
            <h2 className="card-title">Tasks</h2>
            <div className="stack-list">
              {tasks.map((t) => (
                <button key={t.id} className="task-mini" onClick={() => setOpenTask(t.id)}>
                  <span className="mono small muted">{t.id}</span><span className="grow">{t.title}</span>
                  <AvatarStack ids={t.assignees} size={22} /><Chip tone={t.status === "done" ? "green" : isOverdue(t) ? "red" : "neutral"}>{isOverdue(t) ? "Overdue" : SL[t.status]}</Chip>
                </button>
              ))}
              {tasks.length === 0 && <Empty icon="tasks" title="No tasks in this project yet" />}
            </div>
          </section>
          {p.status === "Completed" && (
            <section className="card">
              <h2 className="card-title">Completion report</h2>
              <dl className="summary">
                <div><dt>Tasks completed</dt><dd>{done} of {tasks.length}</dd></div>
                <div><dt>Ran</dt><dd>{fmtDate(p.start)} – {fmtDate(p.deadline)}</dd></div>
                <div><dt>Members</dt><dd>{p.members.length}</dd></div>
                <div><dt>Files shared</dt><dd>{files.length}</dd></div>
              </dl>
            </section>
          )}
          <section className="card">
            <div className="card-head"><h2 className="card-title">Files</h2><button className="link" onClick={() => go("files", "project:" + p.id)}>Open folder</button></div>
            <div className="stack-list">{files.map((f) => <div key={f.id} className="row gap8"><span className={`ftype ftype-${f.type}`}>{f.type}</span><span className="grow small">{f.name}</span><span className="muted small">v{f.versions.length}</span></div>)}{files.length === 0 && <span className="muted small">No files yet.</span>}</div>
          </section>
        </div>
        <div className="col-side">
          <section className="card">
            <h2 className="card-title">Team</h2>
            <div className="stack-list">{p.members.map((m) => <div key={m} className="who"><Avatar user={by(m)} size={30} dot /><div><strong className="small">{by(m)?.name}</strong><span className="muted small block">{m === p.managerId ? "Project manager" : by(m)?.title}</span></div></div>)}</div>
          </section>
          <section className="card">
            <h2 className="card-title">Activity</h2>
            <ul className="timeline">{p.activity.slice(0, 12).map((a, i) => <li key={i}><strong>{by(a.by)?.name}</strong> {a.text}<span className="muted small"> · {timeAgo(a.at)}</span></li>)}{p.activity.length === 0 && <li className="muted">No activity yet.</li>}</ul>
          </section>
        </div>
      </div>
      {openTask && <TaskDetail id={openTask} onClose={() => setOpenTask(null)} />}
      {adding && <TaskForm onClose={() => setAdding(false)} preset={{ project: p.id }} />}
    </div>
  );
}

export function ProjectsPage({ param }: PageProps) {
  const { db, me } = useStore();
  const [open, setOpen] = React.useState(param && param !== "new" ? param : null);
  const [creating, setCreating] = React.useState(param === "new");
  React.useEffect(() => { if (param === "new") setCreating(true); else if (param) setOpen(param); }, [param]);
  const list = can.seeAll(me) ? db.projects : db.projects.filter((p) => p.members.includes(me.id) || p.managerId === me.id);
  const p = open && db.projects.find((x) => x.id === open);
  if (p) return <ProjectDetail p={p} onBack={() => setOpen(null)} />;
  return (
    <div className="page">
      <PageHead title="Projects" sub={`${list.length} projects you can see`}>
        {can.manageProjects(me) && <button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" />New project</button>}
      </PageHead>
      <div className="proj-grid">
        {list.map((p) => {
          const tasks = db.tasks.filter((t) => t.project === p.id);
          const done = tasks.filter((t) => t.status === "done").length;
          const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
          return (
            <button key={p.id} className="card proj" onClick={() => setOpen(p.id)}>
              <div className="row between"><Chip tone={p.status === "Completed" ? "green" : p.status === "On hold" ? "amber" : "blue"}>{p.status}</Chip><span className="muted small">Due {fmtDate(p.deadline)}</span></div>
              <h2 className="proj-title">{p.name}</h2>
              <p className="muted small clamp2">{p.description}</p>
              <div className="progress" aria-label={`${pct}% complete`}><div style={{ width: pct + "%" }} /></div>
              <div className="row between"><AvatarStack ids={p.members} /><span className="small"><strong>{pct}%</strong> · {done}/{tasks.length} tasks</span></div>
            </button>
          );
        })}
        {list.length === 0 && <Empty icon="briefcase" title="You're not on any projects yet" />}
      </div>
      {creating && <ProjectForm onClose={() => setCreating(false)} />}
    </div>
  );
}
