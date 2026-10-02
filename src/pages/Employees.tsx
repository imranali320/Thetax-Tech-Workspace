import React from "react";
import type { PageProps } from "../types";
import { Icon } from "../components/Icon";
import { Avatar, Chip, Drawer, Field, Modal, PageHead, Stat } from "../components/ui";
import { ROLES, can } from "../lib/access";
import { netWork } from "../lib/attendance";
import { addDays, dateKey, fmtDate, fmtDur, fmtSize } from "../lib/time";
import { useStore } from "../store/StoreContext";
import { apiCreateUser, apiListFiles, apiUpdateUser, apiUploadFile, mapApiFile } from "../lib/api";
import type { Department, FileItem, User } from "../types";

/* ================= EMPLOYEES (backend-backed via db.users/db.departments) ================= */

function deptLabel(departments: Department[], id: string) {
  return departments.find((d) => d.id === id)?.name || "—";
}

function EmployeeForm({ departments, users, onSaved, onClose }: { departments: Department[]; users: User[]; onSaved: () => void; onClose: () => void }) {
  const { db, me, update, toast } = useStore();
  const nextNum = users.reduce((max, u) => { const n = Number(u.empId.split("-")[1]); return Number.isFinite(n) ? Math.max(max, n) : max; }, 0) + 1;
  const tmp = "Tmp-" + Math.random().toString(36).slice(2, 7);
  const [f, setF] = React.useState({ empId: "TX-" + String(nextNum).padStart(3, "0"), name: "", email: "", phone: "", dept: departments[0]?.id || "", role: "employee", title: "", managerId: "", shift: "09:00", breakMins: db.settings.defaultBreak, password: tmp });
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const roleOptions = Object.entries(ROLES).filter(([r]) => me.role === "owner" || r !== "owner");

  const save = async () => {
    setBusy(true);
    setErr("");
    try {
      const created = await apiCreateUser({
        emp_id: f.empId, name: f.name, email: f.email, phone: f.phone, role: f.role,
        dept: f.dept || null, title: f.title, manager_id: f.managerId || null,
        shift: f.shift, break_mins: Number(f.breakMins), temp_password: f.password,
      });
      update((n, h) => {
        n.channels.find((c) => c.id === "c-general")?.members.push(created.id);
        h.log("employee.create", "user", created.id, `${f.name} (${f.empId}) as ${ROLES[f.role]}`);
      });
      toast(`${f.name} added. Share the temporary password: ${f.password}`);
      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e.message || "Could not create the employee.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Add employee" onClose={onClose} wide
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!f.name.trim() || !f.email.includes("@") || busy} onClick={save}>{busy ? "Creating…" : "Create account"}</button></>}>
      <div className="grid3">
        <Field label="Employee ID"><input value={f.empId} onChange={set("empId")} /></Field>
        <Field label="Full name"><input value={f.name} onChange={set("name")} autoFocus /></Field>
        <Field label="Designation"><input value={f.title} onChange={set("title")} /></Field>
        <Field label="Email"><input type="email" value={f.email} onChange={set("email")} /></Field>
        <Field label="Phone"><input value={f.phone} onChange={set("phone")} /></Field>
        <Field label="Department"><select value={f.dept} onChange={set("dept")}>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
        <Field label="Role"><select value={f.role} onChange={set("role")}>{roleOptions.map(([r, l]) => <option key={r} value={r}>{l}</option>)}</select></Field>
        <Field label="Manager"><select value={f.managerId} onChange={set("managerId")}><option value="">None</option>{users.filter((u) => ["owner", "admin", "lead"].includes(u.role)).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
        <Field label="Shift starts"><input type="time" value={f.shift} onChange={set("shift")} /></Field>
        <Field label="Break allowance (min)"><input type="number" min="0" value={f.breakMins} onChange={set("breakMins")} /></Field>
        <Field label="Temporary password" hint="They must change it on first login."><input value={f.password} onChange={set("password")} /></Field>
      </div>
      {err && <p className="neg small" role="alert">{err}</p>}
    </Modal>
  );
}

function ImportCSV({ departments, onSaved, onClose }: { departments: Department[]; onSaved: () => void; onClose: () => void }) {
  const { db, update, toast } = useStore();
  const [rows, setRows] = React.useState<any[]>([]);
  const [busy, setBusy] = React.useState(false);
  const pick = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    const head = lines[0].toLowerCase().split(",").map((s) => s.trim());
    setRows(lines.slice(1).map((l) => {
      const c = l.split(",").map((s) => s.trim());
      const get = (k: string) => c[head.indexOf(k)] || "";
      const d = departments.find((x) => x.name.toLowerCase() === get("department").toLowerCase());
      return { name: get("name"), email: get("email"), dept: d?.id || "", title: get("designation"), ok: !!(get("name") && get("email") && d) };
    }));
  };
  const save = async () => {
    setBusy(true);
    let count = 0;
    let nextNum = Date.now() % 100000; // avoids collisions without reading server state per-row
    for (const r of rows.filter((r) => r.ok)) {
      try {
        nextNum++;
        const created = await apiCreateUser({
          emp_id: "TX-" + nextNum, name: r.name, email: r.email, role: "employee",
          dept: r.dept, title: r.title, shift: "09:00", break_mins: db.settings.defaultBreak,
          temp_password: "Tmp-" + Math.random().toString(36).slice(2, 7),
        });
        update((n, h) => { n.channels.find((c) => c.id === "c-general")?.members.push(created.id); h.log("employee.import", "user", created.id, `${r.name} imported from CSV`); });
        count++;
      } catch { /* skip row, continue with the rest */ }
    }
    toast(`${count} of ${rows.filter((r) => r.ok).length} employees imported.`);
    setBusy(false);
    onSaved();
    onClose();
  };
  return (
    <Modal title="Import employees from CSV" onClose={onClose} wide
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!rows.some((r) => r.ok) || busy} onClick={save}>{busy ? "Importing…" : `Import ${rows.filter((r) => r.ok).length} employees`}</button></>}>
      <p className="muted" style={{ marginTop: 0 }}>Columns: <code>name, email, department, designation</code>. Department must match an existing department name.</p>
      <label className="dropzone"><Icon name="upload" size={24} /><strong>Choose a .csv file</strong><input type="file" accept=".csv,text/csv" hidden onChange={pick} /></label>
      {rows.length > 0 && <div className="table-wrap"><table className="table"><thead><tr><th>Name</th><th>Email</th><th>Department</th><th /></tr></thead><tbody>
        {rows.map((r, i) => <tr key={i}><td>{r.name}</td><td>{r.email}</td><td>{deptLabel(departments, r.dept)}</td><td>{r.ok ? <Chip tone="green">Ready</Chip> : <Chip tone="red">Check row</Chip>}</td></tr>)}
      </tbody></table></div>}
    </Modal>
  );
}

function EmployeeProfile({ id, users, departments, onSaved, onClose }: { id: string; users: User[]; departments: Department[]; onSaved: () => void; onClose: () => void }) {
  const { db, me, update, toast } = useStore();
  const u = users.find((x) => x.id === id);
  const [busy, setBusy] = React.useState(false);
  const [docs, setDocs] = React.useState<FileItem[]>([]);
  const reloadDocs = React.useCallback(() => {
    apiListFiles({ employee: id }).then((fs) => setDocs(fs.map(mapApiFile))).catch(() => {});
  }, [id]);
  React.useEffect(() => { reloadDocs(); }, [reloadDocs]);
  if (!u) return null;
  const today = dateKey();
  const recs = db.attendance.filter((a) => a.userId === id && a.date >= addDays(today, -14));
  const days = recs.length;
  const late = recs.filter((a) => a.late).length;
  const avg = days ? recs.reduce((s, a) => s + netWork(a), 0) / days : 0;
  const tasks = db.tasks.filter((t) => t.assignees.includes(id));
  const leaves = db.leaves.filter((l) => l.userId === id);
  const manage = can.manageEmployees(me);

  const patch = async (payload: Parameters<typeof apiUpdateUser>[1], label: string, action: string) => {
    setBusy(true);
    try {
      await apiUpdateUser(id, payload);
      update((n, h) => h.log(action, "user", id, `${u.name}: ${label}`));
      onSaved();
    } catch (e: any) {
      toast(e.message || "Update failed.", "error");
    } finally {
      setBusy(false);
    }
  };

  const uploadDoc = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await apiUploadFile(file, { employee: id }, "hr");
      update((n, h) => h.log("hr.document", "user", id, `Uploaded ${file.name}`));
      reloadDocs();
      toast("Document saved to the restricted HR folder.");
    } catch (e: any) {
      toast(e.message || "Upload failed.", "error");
    }
  };

  return (
    <Drawer title="Employee profile" onClose={onClose}>
      <div className="profile-head">
        <Avatar user={u} size={64} dot />
        <div><h3 className="task-h" style={{ margin: 0 }}>{u.name}</h3><span className="muted">{u.title} · {deptLabel(departments, u.dept)}</span><div className="row gap8 wrap" style={{ marginTop: 6 }}><Chip>{u.empId}</Chip><Chip tone={u.status === "active" ? "green" : "red"}>{u.status === "active" ? "Active" : "Disabled"}</Chip>{u.mustChange && <Chip tone="amber">Temp password</Chip>}</div></div>
      </div>
      <dl className="summary">
        <div><dt>Email</dt><dd>{u.email}</dd></div>
        <div><dt>Phone</dt><dd>{u.phone || "—"}</dd></div>
        <div><dt>Manager</dt><dd>{users.find((x) => x.id === u.managerId)?.name || "—"}</dd></div>
        <div><dt>Shift</dt><dd>{u.shift} start, {u.breakMins} min break</dd></div>
      </dl>
      {manage && (
        <div className="grid2">
          <Field label="Role"><select value={u.role} disabled={busy || (u.role === "owner" && me.role !== "owner")} onChange={(e) => patch({ role: e.target.value }, `role changed to ${ROLES[e.target.value]}`, "permission.change")}>{Object.entries(ROLES).filter(([r]) => me.role === "owner" || r !== "owner").map(([r, l]) => <option key={r} value={r}>{l}</option>)}</select></Field>
          <Field label="Break allowance (min)"><input type="number" min="0" value={u.breakMins} disabled={busy} onChange={(e) => patch({ break_mins: Number(e.target.value) }, `break set to ${e.target.value} min`, "employee.update")} /></Field>
        </div>
      )}
      <h4 className="sub-h">Last 2 weeks</h4>
      <div className="kpi-row"><Stat label="Days present" value={days} /><Stat label="Late" value={late} tone={late ? "red" : undefined} /><Stat label="Avg hours" value={fmtDur(avg)} /><Stat label="Open tasks" value={tasks.filter((t) => !["done", "cancelled"].includes(t.status)).length} /></div>
      <h4 className="sub-h">Leave history</h4>
      {leaves.length ? <ul className="timeline">{leaves.map((l) => <li key={l.id}>{l.type}: {fmtDate(l.start)} – {fmtDate(l.end)} <Chip tone={l.status === "approved" ? "green" : l.status === "rejected" ? "red" : "amber"}>{l.status}</Chip></li>)}</ul> : <p className="muted small">No leave taken.</p>}
      {(can.hrDocs(me) || me.id === id) && <>
        <h4 className="sub-h row gap8"><Icon name="lock" size={16} />Documents</h4>
        <div className="stack-list">{docs.map((f) => <div key={f.id} className="row gap8"><span className={`ftype ftype-${f.type}`}>{f.type}</span><span className="grow small">{f.name}</span><span className="muted small">{fmtSize(f.size)}</span></div>)}{docs.length === 0 && <span className="muted small">No documents.</span>}</div>
        {can.hrDocs(me) && <label className="btn btn-sm" style={{ marginTop: 8 }}><Icon name="upload" size={16} />Add document<input type="file" hidden onChange={uploadDoc} /></label>}
      </>}
      {manage && u.id !== me.id && u.role !== "owner" && (
        <div className="danger">
          <div><strong>{u.status === "active" ? "Disable account" : "Enable account"}</strong><span className="muted small block">{u.status === "active" ? "They are signed out and can't log in. Their records stay." : "They can log in again."}</span></div>
          <button className={`btn ${u.status === "active" ? "btn-danger" : ""}`} disabled={busy} onClick={() => { patch({ status: u.status === "active" ? "disabled" : "active" }, u.status === "active" ? "account disabled" : "account enabled", "employee.status"); toast("Account updated."); }}>{u.status === "active" ? "Disable" : "Enable"}</button>
        </div>
      )}
    </Drawer>
  );
}

export function EmployeesPage({ param }: PageProps) {
  const { db, me, reloadDirectory } = useStore();
  const users = db.users;
  const departments = db.departments;
  const [q, setQ] = React.useState("");
  const [dept, setDept] = React.useState("all");
  const [st, setSt] = React.useState("active");
  const [adding, setAdding] = React.useState(param === "new");
  const [importing, setImporting] = React.useState(false);
  const [open, setOpen] = React.useState<string | null>(null);
  React.useEffect(() => { if (param === "new") setAdding(true); }, [param]);
  React.useEffect(() => { if (me.role === "lead") setDept(me.dept); }, [me]);

  let list = users;
  if (dept !== "all") list = list.filter((u) => u.dept === dept);
  if (st !== "all") list = list.filter((u) => u.status === st);
  if (q) list = list.filter((u) => (u.name + u.empId + u.email + u.title).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="page">
      <PageHead title="Employees" sub={`${users.filter((u) => u.status === "active").length} active employees in ${departments.length} departments`}>
        {can.manageEmployees(me) && <><button className="btn" onClick={() => setImporting(true)}><Icon name="upload" />Import CSV</button><button className="btn btn-primary" onClick={() => setAdding(true)}><Icon name="plus" />Add employee</button></>}
      </PageHead>
      <section className="card">
        <div className="toolbar">
          <div className="search"><Icon name="search" size={16} /><input placeholder="Name, ID, email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search employees" /></div>
          <select value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department"><option value="all">All departments</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          <select value={st} onChange={(e) => setSt(e.target.value)} aria-label="Account status"><option value="active">Active</option><option value="disabled">Disabled</option><option value="all">All</option></select>
        </div>
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Employee</th><th className="hide-sm">Department</th><th className="hide-sm">Role</th><th className="hide-sm">Shift</th><th>Status</th></tr></thead>
          <tbody>{list.map((u) => (
            <tr key={u.id} className="clickable" onClick={() => setOpen(u.id)}>
              <td><button className="who text-left" onClick={() => setOpen(u.id)}><Avatar user={u} size={34} dot /><div><strong>{u.name}</strong><span className="muted small block">{u.empId} · {u.title}</span></div></button></td>
              <td className="hide-sm">{deptLabel(departments, u.dept)}</td>
              <td className="hide-sm small">{ROLES[u.role]}</td>
              <td className="hide-sm small">{u.shift}</td>
              <td><Chip tone={u.status === "active" ? "green" : "red"}>{u.status === "active" ? "Active" : "Disabled"}</Chip></td>
            </tr>
          ))}</tbody>
        </table></div>
      </section>
      {adding && <EmployeeForm departments={departments} users={users} onSaved={reloadDirectory} onClose={() => setAdding(false)} />}
      {importing && <ImportCSV departments={departments} onSaved={reloadDirectory} onClose={() => setImporting(false)} />}
      {open && <EmployeeProfile id={open} users={users} departments={departments} onSaved={reloadDirectory} onClose={() => setOpen(null)} />}
    </div>
  );
}
