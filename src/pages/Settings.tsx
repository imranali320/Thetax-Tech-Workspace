import React from "react";
import { Icon } from "../components/Icon";
import { Chip, Field, PageHead, Tabs } from "../components/ui";
import { DEFAULT_ACCESS, PAGES, ROLES, can } from "../lib/access";
import { fmtSize, uid } from "../lib/time";
import { useStore } from "../store/StoreContext";

/* ================= SETTINGS ================= */
export function SettingsPage() {
  const { db, me, update, toast } = useStore();
  const [tab, setTab] = React.useState("company");
  const [s, setS] = React.useState(db.settings);
  const [newDept, setNewDept] = React.useState("");
  const set = (k: string, num = false) => (e) => setS({ ...s, [k]: e.target.type === "checkbox" ? e.target.checked : num ? Number(e.target.value) : e.target.value });
  const save = () => { update((n, h) => { n.settings = s; h.log("settings.update", "settings", "-", "Company settings changed"); }); toast("Settings saved."); };
  const toggleAccess = (role, page) => update((n, h) => {
    const list = n.access[role];
    n.access[role] = list.includes(page) ? list.filter((p) => p !== page) : [...list, page];
    h.log("permission.change", "role", role, `${ROLES[role]}: ${list.includes(page) ? "removed" : "granted"} ${page}`);
  });
  const runBackup = () => { update((n, h) => { n.backups.unshift({ id: uid("bk"), at: Date.now(), size: 48600000, kind: "Database + files (manual)", status: "OK" }); h.log("backup.run", "backup", "-", "Manual backup"); }); toast("Backup completed."); };
  return (
    <div className="page">
      <PageHead title="Settings" sub="Company configuration. Changes are recorded in the audit log." />
      <Tabs tabs={[["company", "Company"], ["shifts", "Shifts & breaks"], ["depts", "Departments"], ["roles", "Roles & permissions"], ["files", "Files & privacy"], ["backup", "Backups"]]} value={tab} onChange={setTab} />
      <section className="card">
        {tab === "company" && <>
          <div className="grid2">
            <Field label="Company name"><input value={s.company} onChange={set("company")} /></Field>
            <Field label="Timezone"><select value={s.timezone} onChange={set("timezone")}>{["Asia/Karachi", "Asia/Dubai", "Europe/London", "America/New_York"].map((z) => <option key={z}>{z}</option>)}</select></Field>
          </div>
          <button className="btn btn-primary" onClick={save}>Save</button>
        </>}
        {tab === "shifts" && <>
          <div className="grid3">
            <Field label="Late after (minutes past shift start)"><input type="number" min="0" value={s.graceMins} onChange={set("graceMins", true)} /></Field>
            <Field label="Daily work target (hours)"><input type="number" min="1" max="14" value={s.workHours} onChange={set("workHours", true)} /></Field>
            <Field label="Default break allowance (min)"><input type="number" min="0" value={s.defaultBreak} onChange={set("defaultBreak", true)} /></Field>
          </div>
          <label className="check"><input type="checkbox" checked={s.multiBreak} onChange={set("multiBreak")} />Allow several breaks a day within the total allowance</label>
          <p className="hint">Shift start times and personal break allowances are set on each employee's profile. Over-break is flagged in reports; attendance is never changed silently.</p>
          <button className="btn btn-primary" onClick={save}>Save</button>
        </>}
        {tab === "depts" && <>
          <div className="table-wrap"><table className="table"><thead><tr><th>Department</th><th>Manager</th><th className="num">Employees</th><th className="num">KPI fields</th></tr></thead><tbody>
            {db.departments.map((d) => <tr key={d.id}><td><strong>{d.name}</strong></td><td>
              <select value={d.managerId || ""} onChange={(e) => update((n, h) => { n.departments.find((x) => x.id === d.id).managerId = e.target.value; h.log("department.update", "department", d.id, `Manager of ${d.name} changed`); })} aria-label={`Manager of ${d.name}`}>
                {db.users.filter((u) => ["owner", "admin", "lead", "hr"].includes(u.role)).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select></td><td className="num">{db.users.filter((u) => u.dept === d.id).length}</td><td className="num">{db.kpiDefs.filter((k) => k.dept === d.id).length}</td></tr>)}
          </tbody></table></div>
          <div className="row gap8" style={{ marginTop: 14, alignItems: "flex-end" }}>
            <Field label="New department"><input value={newDept} onChange={(e) => setNewDept(e.target.value)} /></Field>
            <button className="btn" disabled={!newDept.trim()} onClick={() => { update((n, h) => { n.departments.push({ id: uid("d"), name: newDept.trim(), managerId: me.id }); h.log("department.create", "department", "-", newDept.trim()); }); setNewDept(""); }}><Icon name="plus" />Add</button>
          </div>
        </>}
        {tab === "roles" && <>
          <p className="muted small" style={{ marginTop: 0 }}>Which pages each role can open. The server repeats these checks on every request, so changing a URL doesn't bypass them.</p>
          <div className="table-wrap"><table className="table matrix">
            <thead><tr><th>Page</th>{Object.entries(ROLES).map(([r, l]) => <th key={r} className="center">{l.split(" /")[0]}</th>)}</tr></thead>
            <tbody>{PAGES.map(([p, label]) => <tr key={p}><td>{label}</td>{Object.keys(ROLES).map((r) => (
              <td key={r} className="center"><input type="checkbox" aria-label={`${ROLES[r]} can open ${label}`} checked={db.access[r].includes(p)} disabled={r === "owner" || (p === "dashboard")} onChange={() => toggleAccess(r, p)} /></td>
            ))}</tr>)}</tbody>
          </table></div>
          <button className="btn btn-sm" onClick={() => update((n, h) => { n.access = structuredClone(DEFAULT_ACCESS); h.log("permission.reset", "role", "-", "Reset to defaults"); })}>Reset to defaults</button>
        </>}
        {tab === "files" && <>
          <div className="grid2">
            <Field label="Maximum file size (MB)"><input type="number" min="1" value={s.maxFileMB} onChange={set("maxFileMB", true)} /></Field>
            <Field label="Keep attendance photos for (days)"><input type="number" min="7" value={s.selfieRetention} onChange={set("selfieRetention", true)} /></Field>
          </div>
          <Field label="Allowed file types" hint="Comma separated extensions."><input value={s.fileTypes} onChange={set("fileTypes")} /></Field>
          <button className="btn btn-primary" onClick={save}>Save</button>
        </>}
        {tab === "backup" && <>
          <div className="grid2">
            <Field label="Daily backup time"><input type="time" value={s.backupTime} onChange={set("backupTime")} /></Field>
            <Field label="Backups to keep"><input type="number" min="3" value={s.backupKeep} onChange={set("backupKeep", true)} /></Field>
          </div>
          <p className="hint">Live data stays on the Hostinger server. The owner's laptop receives an encrypted copy of each backup; it is never the live database.</p>
          <div className="row gap8"><button className="btn btn-primary" onClick={save}>Save schedule</button><button className="btn" onClick={runBackup}>Run backup now</button></div>
          <h4 className="sub-h">Recent backups</h4>
          <div className="table-wrap"><table className="table"><thead><tr><th>When</th><th>Contents</th><th className="num">Size</th><th>Status</th></tr></thead><tbody>
            {db.backups.slice(0, 8).map((b) => <tr key={b.id}><td>{new Date(b.at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</td><td>{b.kind}</td><td className="num">{fmtSize(b.size)}</td><td><Chip tone="green">{b.status}</Chip></td></tr>)}
          </tbody></table></div>
        </>}
      </section>
    </div>
  );
}
