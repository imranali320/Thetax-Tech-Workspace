import React from "react";
import { can } from "./access";
import { dateKey, fmtDate, fmtTime } from "./time";

export const STATUSES = [["todo", "To Do"], ["progress", "In Progress"], ["review", "Review"], ["done", "Completed"], ["cancelled", "Cancelled"]];
export const SL = Object.fromEntries(STATUSES);
export const isOverdue = (t) => !["done", "cancelled"].includes(t.status) && t.dueAt < Date.now();
export const fmtDue = (ts) => {
  const d = dateKey(new Date(ts));
  const today = dateKey();
  return d === today ? `Today ${fmtTime(ts)}` : `${fmtDate(d)}`;
};

export function visibleTasks(db, me) {
  if (can.seeAll(me) || me.role === "accountant") return db.tasks.filter((t) => can.seeAll(me) || t.assignees.includes(me.id));
  if (me.role === "lead") return db.tasks.filter((t) => t.dept === me.dept || t.assignedBy === me.id || t.assignees.includes(me.id));
  const myProjects = db.projects.filter((p) => p.members.includes(me.id)).map((p) => p.id);
  return db.tasks.filter((t) => t.assignees.includes(me.id) || (t.project && myProjects.includes(t.project)));
}
export const canEditTask = (t, me) => can.moderate(me) || t.assignedBy === me.id || t.assignees.includes(me.id);
