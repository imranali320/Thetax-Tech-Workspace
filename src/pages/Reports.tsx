import React from "react";
import { Icon } from "../components/Icon";
import { Empty, Field, PageHead, Tabs } from "../components/ui";
import { deptName } from "../lib/access";
import { breaksTotal, netWork } from "../lib/attendance";
import { exportCSV } from "../lib/files";
import { addDays, dateKey, fmtTime } from "../lib/time";
import { useStore } from "../store/StoreContext";

/* ================= REPORTS ================= */
export function ReportsPage() {
  const { db, me, toast } = useStore();
  const today = dateKey();
  const [tab, setTab] = React.useState("attendance");
  const [from, setFrom] = React.useState(addDays(today, -7));
  const [to, setTo] = React.useState(today);
  const [dept, setDept] = React.useState(me.role === "lead" ? me.dept : "all");
  const users = db.users.filter((u) => (dept === "all" || u.dept === dept));
  const uIds = users.map((u) => u.id);
  const inRange = (d) => d >= from && d <= to;
  const tabs: [string, string][] = [["attendance", "Attendance"], ["hours", "Working hours"], ["tasks", "Tasks"], ["kpi", "KPIs"], ...(["owner", "admin"].includes(me.role) ? [["files", "File activity"] as [string, string]] : [])];

  let head = [], rows = [];
  if (tab === "attendance") {
    head = ["Date", "Employee ID", "Name", "Department", "Check-in", "Check-out", "Late", "Break (min)", "Net hours", "Corrected"];
    rows = db.attendance.filter((a) => inRange(a.date) && uIds.includes(a.userId)).sort((a, b) => b.date.localeCompare(a.date)).map((a) => {
      const u = db.users.find((x) => x.id === a.userId);
      return [a.date, u.empId, u.name, deptName(db, u.dept), fmtTime(a.checkIn), fmtTime(a.checkOut), a.late ? "Yes" : "No", Math.round(breaksTotal(a) / 60000), (netWork(a) / 3600000).toFixed(2), a.corrections.length ? "Yes" : "No"];
    });
  } else if (tab === "hours") {
    head = ["Employee ID", "Name", "Department", "Days present", "Late days", "Total hours", "Total break (h)", "Avg hours/day", "Over-break days"];
    rows = users.map((u) => {
      const r = db.attendance.filter((a) => a.userId === u.id && inRange(a.date));
      const net = r.reduce((s, a) => s + netWork(a), 0), br = r.reduce((s, a) => s + breaksTotal(a), 0);
      return [u.empId, u.name, deptName(db, u.dept), r.length, r.filter((a) => a.late).length, (net / 3600000).toFixed(1), (br / 3600000).toFixed(1), r.length ? (net / r.length / 3600000).toFixed(1) : "0", r.filter((a) => breaksTotal(a) > u.breakMins * 60000).length];
    });
  } else if (tab === "tasks") {
    head = ["Employee", "Department", "Assigned", "Completed", "In progress", "Overdue", "Completion %"];
    rows = users.map((u) => {
      const t = db.tasks.filter((x) => x.assignees.includes(u.id));
      const done = t.filter((x) => x.status === "done").length;
      return [u.name, deptName(db, u.dept), t.length, done, t.filter((x) => x.status === "progress").length, t.filter((x) => !["done", "cancelled"].includes(x.status) && x.dueAt < Date.now()).length, t.length ? Math.round((done / t.length) * 100) + "%" : "—"];
    }).filter((r) => r[2] > 0);
  } else if (tab === "kpi") {
    head = ["Department", "Metric", "Employee", "Total", "Days logged"];
    const defs = db.kpiDefs.filter((k) => dept === "all" || k.dept === dept);
    defs.forEach((k) => users.filter((u) => u.dept === k.dept).forEach((u) => {
      const e = db.kpiEntries.filter((x) => x.defId === k.id && x.userId === u.id && inRange(x.date));
      if (e.length) rows.push([deptName(db, k.dept), k.name, u.name, e.reduce((s, x) => s + x.value, 0), e.length]);
    }));
  } else {
    head = ["When", "User", "Action", "Details"];
    rows = db.audit.filter((a) => a.action.startsWith("file.")).map((a) => [new Date(a.at).toLocaleString(), db.users.find((u) => u.id === a.userId)?.name, a.action, a.meta]);
  }
  return (
    <div className="page page-wide">
      <PageHead title="Reports" sub="Filter, check on screen, then export for payroll or review.">
        <button className="btn btn-primary" disabled={!rows.length} onClick={() => exportCSV(`${tab}-report-${from}-to-${to}.csv`, [head, ...rows], toast)}><Icon name="download" />Export CSV</button>
      </PageHead>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      <section className="card">
        <div className="toolbar">
          <Field label="From"><input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To"><input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} /></Field>
          {me.role !== "lead" && <Field label="Department"><select value={dept} onChange={(e) => setDept(e.target.value)}><option value="all">All</option>{db.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>}
          <span className="muted small grow text-right">{rows.length} rows</span>
        </div>
        <div className="table-wrap"><table className="table">
          <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{rows.slice(0, 200).map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={typeof c === "number" ? "num" : ""}>{c}</td>)}</tr>)}</tbody>
        </table></div>
        {!rows.length && <Empty icon="report" title="No data for these filters" />}
        {rows.length > 200 && <p className="muted small">Showing the first 200 rows. The export includes all {rows.length}.</p>}
      </section>
    </div>
  );
}
