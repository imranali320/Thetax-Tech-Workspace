import React from "react";
import type { Priority } from "../types";
import { can } from "../lib/access";
import { atTime, dateKey } from "../lib/time";
import { useStore } from "../store/StoreContext";
import { Avatar, Field, Modal } from "./ui";

/* ---------------- task form ---------------- */
export function TaskForm({ onClose, preset = {} }: { onClose: () => void; preset?: { project?: string } }) {
  const { db, me, update, toast, go } = useStore();
  const [f, setF] = React.useState({ title: "", description: "", assignees: [], priority: "Normal", due: dateKey(), dueTime: "18:00", project: preset.project || "", dept: me.dept, ...preset });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const people = db.users.filter((u) => u.status === "active" && (can.seeAll(me) || u.dept === me.dept || u.managerId === me.id));
  const toggle = (id) => setF({ ...f, assignees: f.assignees.includes(id) ? f.assignees.filter((x) => x !== id) : [...f.assignees, id] });
  const save = () => {
    let newId;
    update((n, h) => {
      const max = Math.max(...n.tasks.map((t) => Number(t.id.split("-")[1])), 1000);
      newId = `T-${max + 1}`;
      n.tasks.push({ id: newId, title: f.title.trim(), description: f.description, assignees: f.assignees, assignedBy: me.id, dept: f.dept, priority: f.priority as Priority, status: "todo", dueAt: atTime(f.due, f.dueTime), project: f.project || null, comments: [], attachments: [], createdAt: Date.now(), activity: [{ at: Date.now(), by: me.id, text: "created the task" }] });
      h.notify(f.assignees, "task", `${me.name} assigned you ${newId}: ${f.title.trim()}`, { page: "tasks", id: newId });
      h.log("task.create", "task", newId, f.title.trim());
      if (f.project) n.projects.find((p) => p.id === f.project)?.activity.unshift({ at: Date.now(), by: me.id, text: `created ${newId}` });
    });
    toast(`${newId} created and assigned.`);
    onClose();
  };
  return (
    <Modal title="Assign a task" onClose={onClose} wide
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!f.title.trim() || f.assignees.length === 0} onClick={save}>Assign task</button></>}>
      <Field label="Title"><input value={f.title} onChange={set("title")} placeholder="What needs to be done?" autoFocus /></Field>
      <Field label="Description"><textarea rows={3} value={f.description} onChange={set("description")} /></Field>
      <div className="grid3">
        <Field label="Priority"><select value={f.priority} onChange={set("priority")}>{["Low", "Normal", "High", "Urgent"].map((p) => <option key={p}>{p}</option>)}</select></Field>
        <Field label="Due date"><input type="date" value={f.due} onChange={set("due")} /></Field>
        <Field label="Due time"><input type="time" value={f.dueTime} onChange={set("dueTime")} /></Field>
        <Field label="Department"><select value={f.dept} onChange={set("dept")}>{db.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
        <Field label="Project"><select value={f.project} onChange={set("project")}><option value="">No project</option>{db.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
      </div>
      <fieldset className="field">
        <legend className="field-label">Assign to ({f.assignees.length} selected)</legend>
        <div className="pick-list">
          {people.map((u) => (
            <label key={u.id} className={`pick ${f.assignees.includes(u.id) ? "on" : ""}`}>
              <input type="checkbox" checked={f.assignees.includes(u.id)} onChange={() => toggle(u.id)} />
              <Avatar user={u} size={24} /><span>{u.name}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </Modal>
  );
}
