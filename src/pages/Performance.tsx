import React from "react";
import { Icon } from "../components/Icon";
import { Avatar, Empty, Field, PageHead } from "../components/ui";
import { can, deptName } from "../lib/access";
import { addDays, dateKey, fmtDay, uid } from "../lib/time";
import { useStore } from "../store/StoreContext";

/* ================= PERFORMANCE / KPI ================= */
function BarChart({ data, label }: { data: { k: string; l: string; v: number }[]; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.v));
  return (
    <div className="chart" role="img" aria-label={`${label} for the last ${data.length} days`}>
      {data.map((d) => (
        <div key={d.k} className="chart-col">
          <span className="chart-val">{d.v.toLocaleString()}</span>
          <div className="chart-bar" style={{ height: `${(d.v / max) * 100}%` }} />
          <span className="chart-lab">{d.l}</span>
        </div>
      ))}
    </div>
  );
}

export function PerformancePage() {
  const { db, me, update, toast } = useStore();
  const today = dateKey();
  const [dept, setDept] = React.useState(me.dept);
  const defs = db.kpiDefs.filter((k) => k.dept === dept);
  const mine = db.kpiDefs.filter((k) => k.dept === me.dept);
  const existing = (defId) => db.kpiEntries.find((e) => e.defId === defId && e.userId === me.id && e.date === today)?.value ?? "";
  const [vals, setVals] = React.useState(() => Object.fromEntries(mine.map((k) => [k.id, existing(k.id)])));
  const [metric, setMetric] = React.useState(defs[0]?.id);
  const [newField, setNewField] = React.useState({ name: "", type: "number" });
  React.useEffect(() => { setMetric(db.kpiDefs.find((k) => k.dept === dept)?.id); }, [dept]);

  const saveKpi = () => {
    update((n, h) => {
      mine.forEach((k) => {
        const v = vals[k.id];
        if (v === "" || v == null) return;
        const e = n.kpiEntries.find((x) => x.defId === k.id && x.userId === me.id && x.date === today);
        if (e) e.value = Number(v); else n.kpiEntries.push({ id: uid("e"), defId: k.id, userId: me.id, date: today, value: Number(v) });
      });
    });
    toast("Today's numbers saved.");
  };
  const days = [];
  for (let i = 13; i >= 0 && days.length < 10; i--) {
    const d = addDays(today, -i);
    const wd = new Date(d + "T12:00").getDay();
    if (wd !== 0 && wd !== 6) days.push(d);
  }
  const people = db.users.filter((u) => u.dept === dept && u.status === "active");
  const series = days.map((d) => ({ k: d, l: fmtDay(d).split(",")[0].slice(0, 3) + " " + d.slice(8), v: db.kpiEntries.filter((e) => e.defId === metric && e.date === d && (me.role === "employee" ? e.userId === me.id : true)).reduce((s, e) => s + e.value, 0) }));
  const board = people.map((u) => {
    const sum = (defId) => db.kpiEntries.filter((e) => e.defId === defId && e.userId === u.id && e.date >= days[0]).reduce((s, e) => s + e.value, 0);
    const recs = db.attendance.filter((a) => a.userId === u.id && a.date >= days[0]);
    return { u, vals: defs.map((k) => sum(k.id)), done: db.tasks.filter((t) => t.assignees.includes(u.id) && t.status === "done").length, days: recs.length, late: recs.filter((a) => a.late).length };
  });
  const addField = () => {
    update((n, h) => { n.kpiDefs.push({ id: uid("k"), dept, name: newField.name.trim(), type: newField.type as "number" | "currency" }); h.log("kpi.define", "kpi", dept, `Added "${newField.name.trim()}" to ${deptName(n, dept)}`); });
    setNewField({ name: "", type: "number" });
    toast("KPI field added. It appears in the daily sheet right away.");
  };
  const removeField = (k) => update((n, h) => { n.kpiDefs = n.kpiDefs.filter((x) => x.id !== k.id); h.log("kpi.remove", "kpi", k.id, k.name); });
  const seeTeam = me.role !== "employee" && me.role !== "accountant";

  return (
    <div className="page">
      <PageHead title="Performance" sub="Daily department numbers, tasks and attendance together." />
      {mine.length > 0 && (
        <section className="card">
          <div className="card-head"><h2 className="card-title">My numbers for today</h2><span className="muted small">{deptName(db, me.dept)}</span></div>
          <div className="kpi-form">
            {mine.map((k) => <Field key={k.id} label={k.name}><input type="number" min="0" inputMode="numeric" value={vals[k.id] ?? ""} onChange={(e) => setVals({ ...vals, [k.id]: e.target.value })} /></Field>)}
          </div>
          <button className="btn btn-primary" onClick={saveKpi}>Save today's numbers</button>
        </section>
      )}
      <section className="card">
        <div className="card-head wrap">
          <h2 className="card-title">{me.role === "employee" ? "My trend" : "Department trend"}</h2>
          <div className="row gap8 wrap">
            {seeTeam && <select value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department">{db.departments.filter((d) => db.kpiDefs.some((k) => k.dept === d.id) && (can.seeAll(me) || d.id === me.dept)).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>}
            <select value={metric || ""} onChange={(e) => setMetric(e.target.value)} aria-label="Metric">{defs.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</select>
          </div>
        </div>
        {defs.length ? <BarChart data={series} label={defs.find((k) => k.id === metric)?.name || ""} /> : <Empty icon="chart" title="No KPI fields for this department" />}
      </section>
      {seeTeam && (
        <section className="card">
          <h2 className="card-title">Team summary · last {days.length} working days</h2>
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Employee</th>{defs.map((k) => <th key={k.id} className="num">{k.name}</th>)}<th className="num">Tasks done</th><th className="num">Days in</th><th className="num">Late</th></tr></thead>
            <tbody>{board.map((b) => <tr key={b.u.id}><td><div className="who"><Avatar user={b.u} size={28} /><strong className="small">{b.u.name}</strong></div></td>{b.vals.map((v, i) => <td key={i} className="num">{v.toLocaleString()}</td>)}<td className="num">{b.done}</td><td className="num">{b.days}</td><td className={`num ${b.late ? "neg" : ""}`}>{b.late}</td></tr>)}</tbody>
          </table></div>
        </section>
      )}
      {can.manageKpi(me) && (
        <section className="card">
          <h2 className="card-title">KPI fields for {deptName(db, dept)}</h2>
          <p className="muted small" style={{ marginTop: 0 }}>Each department keeps its own fields. Adding one doesn't need a rebuild.</p>
          <div className="row gap8 wrap">{defs.map((k) => <span key={k.id} className="pill row gap4">{k.name}<button className="icon-btn" onClick={() => removeField(k)} aria-label={`Remove ${k.name}`}><Icon name="x" size={14} /></button></span>)}</div>
          <div className="row gap8 wrap" style={{ marginTop: 14, alignItems: "flex-end" }}>
            <Field label="New field"><input value={newField.name} onChange={(e) => setNewField({ ...newField, name: e.target.value })} placeholder="e.g. Proposals sent" /></Field>
            <Field label="Type"><select value={newField.type} onChange={(e) => setNewField({ ...newField, type: e.target.value })}><option value="number">Number</option><option value="currency">Amount (PKR)</option></select></Field>
            <button className="btn" disabled={!newField.name.trim()} onClick={addField}><Icon name="plus" />Add field</button>
          </div>
        </section>
      )}
    </div>
  );
}
