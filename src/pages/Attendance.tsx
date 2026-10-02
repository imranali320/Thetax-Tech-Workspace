import React from "react";
import type { User, AttendanceRecord } from "../types";
import { Icon } from "../components/Icon";
import { WorkdayCard } from "../components/WorkdayCard";
import { Avatar, Chip, Empty, Field, Modal, PageHead, STATE_TONE, Tabs } from "../components/ui";
import { can, deptName } from "../lib/access";
import { STATE_LABEL, attState, breaksTotal, netWork } from "../lib/attendance";
import { exportCSV } from "../lib/files";
import { dateKey, fmtDay, fmtDur, fmtTime, pad, timeAgo, useNow } from "../lib/time";
import { useStore } from "../store/StoreContext";
import { apiCorrectAttendance, apiFetchSelfieBlob, apiListAttendance, mapApiAttendance } from "../lib/api";

/* ---------------- authenticated selfie image ---------------- */
function SelfieImg({ attendanceId, alt, className }: { attendanceId: string; alt: string; className?: string }) {
  const [url, setUrl] = React.useState<string | null>(null);
  React.useEffect(() => {
    let objectUrl: string | null = null;
    apiFetchSelfieBlob(attendanceId).then((blob) => { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); }).catch(() => {});
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [attendanceId]);
  if (!url) return <span className="muted small">Loading…</span>;
  return <img className={className} src={url} alt={alt} />;
}

/* ---------------- correction ---------------- */
function CorrectionModal({ rec, user, date, onClose, onSaved }: { rec?: AttendanceRecord; user: User; date: string; onClose: () => void; onSaved: () => void }) {
  const { toast } = useStore();
  const [busy, setBusy] = React.useState(false);
  const toHM = (ts: number | null | undefined) => (ts ? `${pad(new Date(ts).getHours())}:${pad(new Date(ts).getMinutes())}` : "");
  const [inT, setIn] = React.useState(toHM(rec?.checkIn));
  const [outT, setOut] = React.useState(toHM(rec?.checkOut));
  const [reason, setReason] = React.useState("");
  const save = async () => {
    setBusy(true);
    try {
      await apiCorrectAttendance({ user_id: user.id, date, check_in: inT || null, check_out: outT || null, reason });
      toast("Attendance corrected and logged.");
      onSaved();
      onClose();
    } catch (e: any) {
      toast(e.message || "Correction failed.", "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={`Correct attendance — ${user.name}`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={reason.trim().length < 4 || busy} onClick={save}>{busy ? "Saving…" : "Save correction"}</button></>}>
      <p className="muted" style={{ marginTop: 0 }}>{fmtDay(date)}. The original values stay in the history and the change is written to the audit log.</p>
      <div className="grid2">
        <Field label="Check-in"><input type="time" value={inT} onChange={(e) => setIn(e.target.value)} /></Field>
        <Field label="Check-out"><input type="time" value={outT} onChange={(e) => setOut(e.target.value)} /></Field>
      </div>
      <Field label="Reason (required)"><textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Forgot to check out, confirmed with team lead" /></Field>
      {rec?.corrections?.length > 0 && (
        <div className="history">
          <strong>Previous corrections</strong>
          {rec.corrections.map((c, i) => <div key={i} className="muted small">{timeAgo(c.at)}: was {c.before}. {c.reason}</div>)}
        </div>
      )}
    </Modal>
  );
}

/* ---------------- attendance page ---------------- */
export function attendanceRows(users: User[], records: AttendanceRecord[], now = Date.now()) {
  return users.filter((u) => u.status === "active").map((u) => {
    const rec = records.find((a) => a.userId === u.id);
    const allowance = u.breakMins * 60000;
    const br = breaksTotal(rec, now);
    return { user: u, rec, state: attState(rec), late: !!rec?.late, br, over: br > allowance, net: netWork(rec, now) };
  });
}

export function AttendancePage() {
  const { db, me, toast } = useStore();
  const now = useNow(30000);
  const today = dateKey();
  const [tab, setTab] = React.useState(can.seeTeamAttendance(me) ? "team" : "mine");
  const [date, setDate] = React.useState(today);
  const [dept, setDept] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [q, setQ] = React.useState("");
  const [fix, setFix] = React.useState<{ rec?: AttendanceRecord; user: User } | null>(null);
  const [photo, setPhoto] = React.useState<{ rec: AttendanceRecord; user: User } | null>(null);

  const [mine, setMine] = React.useState<AttendanceRecord[]>([]);
  const [dayRecords, setDayRecords] = React.useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = React.useState(false);

  const loadMine = React.useCallback(() => {
    apiListAttendance({ user_id: me.id, limit: 14 }).then((rs) => setMine(rs.map(mapApiAttendance))).catch((e) => toast(e.message || "Could not load your history.", "error"));
  }, [me.id, toast]);
  const loadDay = React.useCallback(() => {
    setLoading(true);
    apiListAttendance({ date }).then((rs) => setDayRecords(rs.map(mapApiAttendance))).catch((e) => toast(e.message || "Could not load attendance.", "error")).finally(() => setLoading(false));
  }, [date, toast]);

  React.useEffect(() => { if (tab === "mine") loadMine(); }, [tab, loadMine]);
  React.useEffect(() => { if (tab === "team") loadDay(); }, [tab, loadDay]);

  let rows = attendanceRows(db.users, dayRecords, now);
  if (me.role === "lead") rows = rows.filter((r) => r.user.dept === me.dept || r.user.managerId === me.id);
  if (dept !== "all") rows = rows.filter((r) => r.user.dept === dept);
  if (status !== "all") rows = rows.filter((r) => (status === "late" ? r.late : status === "over" ? r.over : r.state === status));
  if (q) rows = rows.filter((r) => r.user.name.toLowerCase().includes(q.toLowerCase()) || r.user.empId.toLowerCase().includes(q.toLowerCase()));

  const doExport = () => exportCSV(`attendance-${date}.csv`, [
    ["Employee ID", "Name", "Department", "Date", "Check-in", "Check-out", "Break (min)", "Net hours", "Status", "Late", "Over-break"],
    ...rows.map((r) => [r.user.empId, r.user.name, deptName(db, r.user.dept), date, fmtTime(r.rec?.checkIn), fmtTime(r.rec?.checkOut), Math.round(r.br / 60000), (r.net / 3600000).toFixed(2), STATE_LABEL[r.state], r.late ? "Yes" : "No", r.over ? "Yes" : "No"]),
  ], toast);

  return (
    <div className="page">
      <PageHead title="Attendance" sub="Check-in, breaks and the daily attendance record." />
      <WorkdayCard />
      {can.seeTeamAttendance(me) && <Tabs tabs={[["team", me.role === "lead" ? "My team" : "Everyone"], ["mine", "My history"]]} value={tab} onChange={setTab} />}

      {tab === "mine" && (
        <section className="card">
          <h2 className="card-title">My last two weeks</h2>
          {mine.length === 0 ? <Empty icon="clock" title="No attendance yet">Your check-ins will appear here.</Empty> : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Date</th><th>Check-in</th><th>Check-out</th><th>Breaks</th><th>Net</th><th>Status</th></tr></thead>
              <tbody>{mine.map((a) => (
                <tr key={a.id}>
                  <td>{fmtDay(a.date)}</td><td>{fmtTime(a.checkIn)}</td><td>{fmtTime(a.checkOut)}</td>
                  <td>{fmtDur(breaksTotal(a, now))}</td><td className="num">{fmtDur(netWork(a, now))}</td>
                  <td className="row gap4 wrap">{a.late ? <Chip tone="red">Late</Chip> : <Chip tone="green">On time</Chip>}{breaksTotal(a, now) > me.breakMins * 60000 && <Chip tone="amber">Over-break</Chip>}{a.corrections.length > 0 && <Chip>Corrected</Chip>}</td>
                </tr>))}</tbody>
            </table></div>
          )}
        </section>
      )}

      {tab === "team" && (
        <section className="card">
          <div className="toolbar">
            <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} aria-label="Date" />
            {me.role !== "lead" && <select value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department">
              <option value="all">All departments</option>{db.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>}
            <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
              <option value="all">All statuses</option><option value="working">Working</option><option value="break">On break</option><option value="out">Checked out</option><option value="absent">Not checked in</option><option value="late">Late</option><option value="over">Over-break</option>
            </select>
            <div className="search"><Icon name="search" size={16} /><input placeholder="Name or ID" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search employees" /></div>
            <button className="btn" onClick={doExport}><Icon name="download" />Export CSV</button>
          </div>
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Employee</th><th>Selfie</th><th>Check-in</th><th>Check-out</th><th>Breaks</th><th>Net</th><th>Status</th>{can.correctAttendance(me) && <th><span className="sr">Actions</span></th>}</tr></thead>
            <tbody>
              {loading && <tr><td colSpan={8}><Empty icon="clock" title="Loading…" /></td></tr>}
              {!loading && rows.map((r) => (
                <tr key={r.user.id}>
                  <td><div className="who"><Avatar user={r.user} size={30} /><div><strong>{r.user.name}</strong><span className="muted small">{r.user.empId} · {deptName(db, r.user.dept)}</span></div></div></td>
                  <td>{r.rec?.selfie ? <button className="thumb" onClick={() => setPhoto({ rec: r.rec!, user: r.user })} aria-label={`View selfie of ${r.user.name}`}><SelfieImg attendanceId={r.rec.id} alt="" /></button> : <span className="muted small">—</span>}</td>
                  <td>{fmtTime(r.rec?.checkIn)}</td>
                  <td>{fmtTime(r.rec?.checkOut)}</td>
                  <td className={r.over ? "neg" : ""}>{r.rec ? fmtDur(r.br) : "—"}</td>
                  <td className="num">{r.rec ? fmtDur(r.net) : "—"}</td>
                  <td><div className="row gap4 wrap"><Chip tone={STATE_TONE[r.state]}>{STATE_LABEL[r.state]}</Chip>{r.late && <Chip tone="red">Late</Chip>}{r.over && <Chip tone="amber">Over-break</Chip>}{r.rec?.corrections?.length > 0 && <Chip>Corrected</Chip>}</div></td>
                  {can.correctAttendance(me) && <td><button className="btn btn-sm" onClick={() => setFix({ rec: r.rec, user: r.user })}>Correct</button></td>}
                </tr>
              ))}
              {!loading && rows.length === 0 && <tr><td colSpan={8}><Empty icon="users" title="Nobody matches these filters" /></td></tr>}
            </tbody>
          </table></div>
        </section>
      )}
      {fix && <CorrectionModal rec={fix.rec} user={fix.user} date={date} onClose={() => setFix(null)} onSaved={loadDay} />}
      {photo && <Modal title={`${photo.user.name} — ${fmtTime(photo.rec.checkIn)}`} onClose={() => setPhoto(null)}><div className="selfie-box"><SelfieImg attendanceId={photo.rec.id} alt={`Attendance photo of ${photo.user.name}`} /></div></Modal>}
    </div>
  );
}
