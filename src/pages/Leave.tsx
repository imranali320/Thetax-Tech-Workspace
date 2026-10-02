import React from "react";
import type { Leave } from "../types";
import { Avatar, Chip, Empty, Field, Modal, PageHead, Tabs } from "../components/ui";
import { can } from "../lib/access";
import { addDays, dateKey, fmtDate, uid } from "../lib/time";
import { useStore } from "../store/StoreContext";

/* ================= LEAVE & HR ================= */
export function LeavePage() {
  const { db, me, update, toast } = useStore();
  const approver = can.approveLeave(me);
  const [tab, setTab] = React.useState(approver ? "approvals" : "mine");
  const [f, setF] = React.useState({ type: "Annual", start: addDays(dateKey(), 1), end: addDays(dateKey(), 1), reason: "" });
  const [decide, setDecide] = React.useState(null);
  const [note, setNote] = React.useState("");
  const mine = db.leaves.filter((l) => l.userId === me.id).sort((a, b) => b.at - a.at);
  let queue = db.leaves.filter((l) => l.userId !== me.id);
  if (me.role === "lead") queue = queue.filter((l) => { const u = db.users.find((x) => x.id === l.userId); return u.dept === me.dept || u.managerId === me.id; });
  queue.sort((a, b) => (a.status === "pending" ? -1 : 1) - (b.status === "pending" ? -1 : 1) || b.at - a.at);
  const daysBetween = (a, b) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000) + 1;
  const apply = () => {
    update((n, h) => {
      n.leaves.push({ id: uid("l"), userId: me.id, ...f, status: "pending", at: Date.now(), decidedBy: null, note: "" });
      const approvers = n.users.filter((u) => ["hr", "owner"].includes(u.role) || u.id === me.managerId).map((u) => u.id);
      h.notify(approvers, "leave", `${me.name} requested ${f.type} leave (${fmtDate(f.start)} – ${fmtDate(f.end)})`, { page: "leave" });
    });
    setF({ ...f, reason: "" });
    toast("Leave request sent for approval.");
  };
  const finish = (status) => {
    update((n, h) => {
      const l = n.leaves.find((x) => x.id === decide.id);
      l.status = status; l.decidedBy = me.id; l.note = note;
      h.notify([l.userId], "leave", `Your ${l.type} leave (${fmtDate(l.start)}) was ${status}${note ? ": " + note : ""}`, { page: "leave" });
      h.log("leave." + status, "leave", l.id, `${n.users.find((u) => u.id === l.userId).name}, ${l.type}`);
    });
    setDecide(null); setNote("");
    toast(`Leave ${status}.`);
  };
  const Row = ({ l, showUser = false }: { l: Leave; showUser?: boolean }) => {
    const u = db.users.find((x) => x.id === l.userId);
    return (
      <tr>
        {showUser && <td><div className="who"><Avatar user={u} size={28} /><strong className="small">{u.name}</strong></div></td>}
        <td>{l.type}</td><td className="small">{fmtDate(l.start)} – {fmtDate(l.end)}</td><td className="num">{daysBetween(l.start, l.end)}</td>
        <td className="small muted hide-sm">{l.reason}</td>
        <td><Chip tone={l.status === "approved" ? "green" : l.status === "rejected" ? "red" : "amber"}>{l.status}</Chip>{l.note && <span className="muted small block">{l.note}</span>}</td>
        {showUser && <td>{l.status === "pending" && <button className="btn btn-sm" onClick={() => setDecide(l)}>Review</button>}</td>}
      </tr>
    );
  };
  return (
    <div className="page">
      <PageHead title="Leave & HR" sub="Requests, approvals and leave history." />
      <Tabs tabs={[...(approver ? [["approvals", `Approvals (${queue.filter((l) => l.status === "pending").length})`]] : []), ["mine", "My leave"]] as [string, string][]} value={tab} onChange={setTab} />
      {tab === "mine" && (
        <div className="dash-grid">
          <section className="card col-main">
            <h2 className="card-title">My requests</h2>
            {mine.length ? <div className="table-wrap"><table className="table"><thead><tr><th>Type</th><th>Dates</th><th className="num">Days</th><th className="hide-sm">Reason</th><th>Status</th></tr></thead><tbody>{mine.map((l) => <Row key={l.id} l={l} />)}</tbody></table></div> : <Empty icon="calendar" title="No leave requests yet" />}
          </section>
          <section className="card col-side">
            <h2 className="card-title">Request leave</h2>
            <Field label="Type"><select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{["Annual", "Casual", "Sick", "Unpaid"].map((t) => <option key={t}>{t}</option>)}</select></Field>
            <div className="grid2"><Field label="From"><input type="date" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value, end: e.target.value > f.end ? e.target.value : f.end })} /></Field><Field label="To"><input type="date" min={f.start} value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></Field></div>
            <Field label="Reason"><textarea rows={3} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
            <button className="btn btn-primary" disabled={!f.reason.trim()} onClick={apply}>Send request · {daysBetween(f.start, f.end)} day{daysBetween(f.start, f.end) > 1 ? "s" : ""}</button>
          </section>
        </div>
      )}
      {tab === "approvals" && (
        <section className="card">
          {queue.length ? <div className="table-wrap"><table className="table"><thead><tr><th>Employee</th><th>Type</th><th>Dates</th><th className="num">Days</th><th className="hide-sm">Reason</th><th>Status</th><th /></tr></thead><tbody>{queue.map((l) => <Row key={l.id} l={l} showUser />)}</tbody></table></div> : <Empty icon="calendar" title="No requests to review" />}
        </section>
      )}
      {decide && (
        <Modal title="Review leave request" onClose={() => setDecide(null)}
          footer={<><button className="btn btn-danger" onClick={() => finish("rejected")}>Reject</button><button className="btn btn-primary" onClick={() => finish("approved")}>Approve</button></>}>
          <dl className="summary">
            <div><dt>Employee</dt><dd>{db.users.find((u) => u.id === decide.userId).name}</dd></div>
            <div><dt>Type</dt><dd>{decide.type}</dd></div>
            <div><dt>Dates</dt><dd>{fmtDate(decide.start)} – {fmtDate(decide.end)} ({daysBetween(decide.start, decide.end)} days)</dd></div>
            <div><dt>Reason</dt><dd>{decide.reason}</dd></div>
          </dl>
          <Field label="Note to employee (optional)"><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </Modal>
      )}
    </div>
  );
}
