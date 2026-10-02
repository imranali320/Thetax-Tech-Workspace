import React from "react";
import { Icon } from "../components/Icon";
import { PageHead } from "../components/ui";
import { can } from "../lib/access";
import { exportCSV } from "../lib/files";
import { useStore } from "../store/StoreContext";

/* ================= AUDIT ================= */
export function AuditPage() {
  const { db, toast } = useStore();
  const [q, setQ] = React.useState("");
  const [kind, setKind] = React.useState("all");
  const kinds = [...new Set(db.audit.map((a) => a.action.split(".")[0]))];
  let list = [...db.audit].sort((a, b) => b.at - a.at);
  if (kind !== "all") list = list.filter((a) => a.action.startsWith(kind + "."));
  if (q) list = list.filter((a) => (a.meta + a.action + (db.users.find((u) => u.id === a.userId)?.name || "")).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="page">
      <PageHead title="Audit Log" sub="Security events and admin changes. Entries can't be edited.">
        <button className="btn" onClick={() => exportCSV("audit-log.csv", [["When", "User", "Action", "Entity", "Details"], ...list.map((a) => [new Date(a.at).toISOString(), db.users.find((u) => u.id === a.userId)?.name, a.action, a.entity, a.meta])], toast)}><Icon name="download" />Export</button>
      </PageHead>
      <section className="card">
        <div className="toolbar">
          <div className="search"><Icon name="search" size={16} /><input placeholder="Search log" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search audit log" /></div>
          <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Event type"><option value="all">All events</option>{kinds.map((k) => <option key={k}>{k}</option>)}</select>
        </div>
        <div className="table-wrap"><table className="table">
          <thead><tr><th>When</th><th>User</th><th>Action</th><th>Details</th></tr></thead>
          <tbody>{list.map((a) => <tr key={a.id}><td className="small">{new Date(a.at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</td><td className="small">{db.users.find((u) => u.id === a.userId)?.name || "System"}</td><td><code>{a.action}</code></td><td className="small">{a.meta}</td></tr>)}</tbody>
        </table></div>
      </section>
    </div>
  );
}
