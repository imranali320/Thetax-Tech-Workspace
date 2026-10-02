import React from "react";
import { can } from "../lib/access";
import { readFile } from "../lib/files";
import { SL, STATUSES, canEditTask, isOverdue } from "../lib/tasks";
import { atTime, dateKey, fmtDate, fmtSize, pad, timeAgo, uid } from "../lib/time";
import { useStore } from "../store/StoreContext";
import { Icon } from "./Icon";
import { Avatar, Chip, Drawer, Field, PRIORITY_TONE } from "./ui";

/* ---------------- task detail ---------------- */
export function TaskDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { db, me, update, toast } = useStore();
  const t = db.tasks.find((x) => x.id === id);
  const [comment, setComment] = React.useState("");
  if (!t) return null;
  const editable = canEditTask(t, me);
  const by = (uidv) => db.users.find((u) => u.id === uidv);
  const change = (field, value, label) => {
    update((n, h) => {
      const x = n.tasks.find((y) => y.id === id);
      x[field] = value;
      x.activity.unshift({ at: Date.now(), by: me.id, text: label });
      const others = [...x.assignees, x.assignedBy];
      h.notify(others, "task", `${me.name} ${label} on ${id}`, { page: "tasks", id });
      if (x.project) n.projects.find((p) => p.id === x.project)?.activity.unshift({ at: Date.now(), by: me.id, text: `${label} on ${id}` });
    });
  };
  const addComment = () => {
    const text = comment.trim();
    if (!text) return;
    update((n, h) => {
      const x = n.tasks.find((y) => y.id === id);
      x.comments.push({ id: uid("c"), by: me.id, at: Date.now(), text });
      x.activity.unshift({ at: Date.now(), by: me.id, text: "commented" });
      const mentioned = n.users.filter((u) => text.includes("@" + u.name)).map((u) => u.id);
      h.notify(mentioned, "mention", `${me.name} mentioned you on ${id}`, { page: "tasks", id });
      h.notify([...x.assignees, x.assignedBy].filter((u) => !mentioned.includes(u)), "task", `${me.name} commented on ${id}`, { page: "tasks", id });
    });
    setComment("");
  };
  const attach = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > db.settings.maxFileMB * 1048576) return toast(`File is over the ${db.settings.maxFileMB} MB limit.`, "error");
    const data = file.size < 3 * 1048576 ? await readFile(file) : null;
    update((n) => {
      const fid = uid("f");
      const ext = file.name.split(".").pop().toLowerCase();
      n.files.push({ id: fid, name: file.name, size: file.size, type: ext, ownerId: me.id, folder: { dept: t.dept, project: t.project || undefined }, visibility: t.project ? "project" : "department", at: Date.now(), versions: [{ v: 1, at: Date.now(), by: me.id }], data, mime: file.type });
      const x = n.tasks.find((y) => y.id === id);
      x.attachments.push(fid);
      x.activity.unshift({ at: Date.now(), by: me.id, text: `attached ${file.name}` });
    });
    toast("File attached.");
    e.target.value = "";
  };
  const dueVal = dateKey(new Date(t.dueAt));
  const dueTime = `${pad(new Date(t.dueAt).getHours())}:${pad(new Date(t.dueAt).getMinutes())}`;

  return (
    <Drawer title={`${t.id}`} onClose={onClose}>
      <h3 className="task-h">{t.title}</h3>
      <div className="row gap8 wrap">
        <Chip tone={PRIORITY_TONE[t.priority]}>{t.priority}</Chip>
        <Chip tone={t.status === "done" ? "green" : t.status === "review" ? "amber" : "blue"}>{SL[t.status]}</Chip>
        {isOverdue(t) && <Chip tone="red">Overdue</Chip>}
      </div>
      {t.description && <p className="prose">{t.description}</p>}
      <div className="grid2 detail-grid">
        <Field label="Status"><select disabled={!editable} value={t.status} onChange={(e) => change("status", e.target.value, `moved it to ${SL[e.target.value]}`)}>{STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
        <Field label="Priority"><select disabled={!(can.assignTasks(me) && editable)} value={t.priority} onChange={(e) => change("priority", e.target.value, `set priority to ${e.target.value}`)}>{["Low", "Normal", "High", "Urgent"].map((p) => <option key={p}>{p}</option>)}</select></Field>
        <Field label="Due"><input type="date" disabled={!(can.assignTasks(me) && editable)} value={dueVal} onChange={(e) => e.target.value && change("dueAt", atTime(e.target.value, dueTime), `changed due date to ${fmtDate(e.target.value)}`)} /></Field>
        <div className="field"><span className="field-label">Assigned by</span><div className="who"><Avatar user={by(t.assignedBy)} size={24} /><span>{by(t.assignedBy)?.name}</span></div></div>
      </div>
      <div className="field"><span className="field-label">Assignees</span><div className="row gap8 wrap">{t.assignees.map((a) => <span key={a} className="who pill"><Avatar user={by(a)} size={22} />{by(a)?.name}</span>)}</div></div>
      {t.project && <p className="muted small">Project: {db.projects.find((p) => p.id === t.project)?.name} · {db.departments.find((d) => d.id === t.dept)?.name}</p>}

      <h4 className="sub-h">Attachments</h4>
      <div className="stack-list">
        {t.attachments.map((fid) => { const f = db.files.find((x) => x.id === fid); return f && <div key={fid} className="row gap8"><span className={`ftype ftype-${f.type}`}>{f.type}</span><span className="grow small">{f.name}</span><span className="muted small">{fmtSize(f.size)}</span></div>; })}
        {t.attachments.length === 0 && <span className="muted small">No files yet.</span>}
      </div>
      {editable && <label className="btn btn-sm" style={{ marginTop: 8 }}><Icon name="clip" size={16} />Attach file<input type="file" hidden onChange={attach} /></label>}

      <h4 className="sub-h">Comments</h4>
      <div className="comments">
        {t.comments.map((c) => (
          <div key={c.id} className="comment"><Avatar user={by(c.by)} size={28} /><div><div className="row gap8"><strong className="small">{by(c.by)?.name}</strong><span className="muted small">{timeAgo(c.at)}</span></div><p>{c.text}</p></div></div>
        ))}
        {t.comments.length === 0 && <span className="muted small">No comments yet.</span>}
      </div>
      <div className="composer-mini">
        <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Write a comment. Use @Full Name to mention." aria-label="Comment"
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) addComment(); }} />
        <button className="btn btn-primary btn-sm" onClick={addComment} disabled={!comment.trim()}>Comment</button>
      </div>

      <h4 className="sub-h">Activity</h4>
      <ul className="timeline">
        {t.activity.map((a, i) => <li key={i}><strong>{by(a.by)?.name}</strong> {a.text}<span className="muted small"> · {timeAgo(a.at)}</span></li>)}
      </ul>
    </Drawer>
  );
}
