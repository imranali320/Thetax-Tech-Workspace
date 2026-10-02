import React from "react";
import { SelfieModal } from "./SelfieModal";
import { STATE_LABEL, activeBreak, attState, breaksTotal, netWork } from "../lib/attendance";
import { atTime, dateKey, fmtClock, fmtDur, fmtTime, useNow } from "../lib/time";
import { useStore } from "../store/StoreContext";
import { Icon } from "./Icon";
import { Chip, Modal, STATE_TONE } from "./ui";
import { apiBreakEnd, apiBreakStart, apiCheckIn, apiCheckOut, apiTodayAttendance, mapApiAttendance } from "../lib/api";
import type { AttendanceRecord } from "../types";

/* ---------------- workday card (backend-backed) ---------------- */
export function WorkdayCard({ compact = false }: { compact?: boolean }) {
  const { db, me, update, toast } = useStore();
  const now = useNow(1000);
  const today = dateKey();
  const [rec, setRec] = React.useState<AttendanceRecord | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  React.useEffect(() => {
    apiTodayAttendance().then((a) => setRec(a ? mapApiAttendance(a) : null)).finally(() => setLoaded(true));
  }, [me.id]);

  const st = attState(rec);
  const [selfie, setSelfie] = React.useState(false);
  const [confirmOut, setConfirmOut] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const shiftStart = atTime(today, me.shift);
  const allowance = me.breakMins * 60000;
  const used = breaksTotal(rec, now);
  const remaining = allowance - used;
  const ab = activeBreak(rec);
  const net = netWork(rec, now);
  const target = db.settings.workHours * 3600000;
  const hadBreak = (rec?.breaks || []).some((b) => b.end);

  const checkIn = async (photo: string | null) => {
    setBusy(true);
    try {
      const a = await apiCheckIn(photo);
      const mapped = mapApiAttendance(a);
      setRec(mapped);
      update((n, h) => h.log("attendance.check_in", "attendance", me.id, mapped.late ? "Late check-in" : "On time"));
      setSelfie(false);
      toast(mapped.late ? `Checked in at ${fmtTime(mapped.checkIn)} — marked late.` : `Checked in at ${fmtTime(mapped.checkIn)}.`);
    } catch (e: any) {
      toast(e.message || "Check-in failed.", "error");
    } finally {
      setBusy(false);
    }
  };
  const startBreak = async () => {
    if (ab || busy) return;
    setBusy(true);
    try {
      setRec(mapApiAttendance(await apiBreakStart()));
    } catch (e: any) {
      toast(e.message || "Could not start break.", "error");
    } finally {
      setBusy(false);
    }
  };
  const endBreak = async () => {
    if (busy) return;
    setBusy(true);
    try {
      setRec(mapApiAttendance(await apiBreakEnd()));
    } catch (e: any) {
      toast(e.message || "Could not end break.", "error");
    } finally {
      setBusy(false);
    }
  };
  const checkOut = async () => {
    setBusy(true);
    try {
      const a = await apiCheckOut();
      const mapped = mapApiAttendance(a);
      setRec(mapped);
      update((n, h) => h.log("attendance.check_out", "attendance", me.id, `Net ${fmtDur(netWork(mapped))}`));
      setConfirmOut(false);
      toast("Checked out. Have a good evening.");
    } catch (e: any) {
      toast(e.message || "Check-out failed.", "error");
    } finally {
      setBusy(false);
    }
  };

  // ring
  const R = 74, C = 2 * Math.PI * R;
  const workPct = Math.min(1, net / target);
  const brPct = Math.min(0.25, used / target);

  if (!loaded) return <section className={`card workday ${compact ? "compact" : ""}`} aria-label="Today's workday"><p className="muted">Loading…</p></section>;

  return (
    <section className={`card workday ${compact ? "compact" : ""}`} aria-label="Today's workday">
      <div className="workday-ring">
        <svg viewBox="0 0 180 180" width="180" height="180" role="img" aria-label={`Worked ${fmtDur(net)} of ${db.settings.workHours} hours`}>
          <circle cx="90" cy="90" r={R} fill="none" stroke="var(--line)" strokeWidth="12" />
          <circle cx="90" cy="90" r={R} fill="none" stroke="var(--brand)" strokeWidth="12" strokeLinecap="round"
            strokeDasharray={`${workPct * C} ${C}`} transform="rotate(-90 90 90)" />
          {used > 0 && <circle cx="90" cy="90" r={R - 16} fill="none" stroke="var(--amber)" strokeWidth="6" strokeLinecap="round"
            strokeDasharray={`${brPct * 4 * (2 * Math.PI * (R - 16))} ${2 * Math.PI * (R - 16)}`} transform="rotate(-90 90 90)" />}
        </svg>
        <div className="ring-center">
          <span className="ring-time">{st === "break" ? fmtClock(now - ab.start) : fmtClock(net)}</span>
          <span className="ring-label">{st === "break" ? "on break" : "worked today"}</span>
        </div>
      </div>

      <div className="workday-body">
        <div className="row gap8 wrap">
          <Chip tone={STATE_TONE[st]}>{STATE_LABEL[st]}</Chip>
          {rec?.late && <Chip tone="red">Late</Chip>}
          {remaining < 0 && <Chip tone="red">Over break by {fmtDur(-remaining)}</Chip>}
        </div>
        <h2 className="workday-title">
          {st === "absent" && `Your shift starts at ${fmtTime(shiftStart)}`}
          {st === "working" && `Checked in at ${fmtTime(rec!.checkIn)}`}
          {st === "break" && `Break started at ${fmtTime(ab.start)}`}
          {st === "out" && `Day closed at ${fmtTime(rec!.checkOut)}`}
        </h2>
        <dl className="workday-facts">
          <div><dt>Break used</dt><dd>{fmtDur(used)}</dd></div>
          <div><dt>Break left</dt><dd className={remaining < 0 ? "neg" : ""}>{remaining < 0 ? "0m" : fmtDur(remaining)}</dd></div>
          <div><dt>Target</dt><dd>{db.settings.workHours}h</dd></div>
        </dl>
        <div className="row gap8 wrap">
          {st === "absent" && <button className="btn btn-primary btn-lg" onClick={() => setSelfie(true)}><Icon name="camera" />Check in with selfie</button>}
          {st === "working" && <>
            <button className="btn btn-amber btn-lg" onClick={startBreak} disabled={busy || (!db.settings.multiBreak && hadBreak)}><Icon name="coffee" />Start break</button>
            <button className="btn btn-lg" onClick={() => setConfirmOut(true)} disabled={busy}><Icon name="logout" />Check out</button>
          </>}
          {st === "break" && <>
            <button className="btn btn-primary btn-lg" onClick={endBreak} disabled={busy}><Icon name="stop" />End break</button>
            <button className="btn btn-lg" onClick={() => setConfirmOut(true)} disabled={busy}><Icon name="logout" />Check out</button>
          </>}
          {st === "out" && <span className="muted">Net work time {fmtDur(net)}, breaks {fmtDur(used)}.</span>}
        </div>
        {st === "working" && !db.settings.multiBreak && hadBreak && <p className="hint">Only one break is allowed per day.</p>}
      </div>

      {selfie && <SelfieModal title="Check in" onClose={() => setSelfie(false)} onConfirm={checkIn} />}
      {confirmOut && rec && (
        <Modal title="Check out for today?" onClose={() => setConfirmOut(false)}
          footer={<><button className="btn" onClick={() => setConfirmOut(false)}>Keep working</button><button className="btn btn-primary" disabled={busy} onClick={checkOut}>Check out</button></>}>
          <dl className="summary">
            <div><dt>Checked in</dt><dd>{fmtTime(rec.checkIn)}</dd></div>
            <div><dt>Breaks</dt><dd>{fmtDur(used)}{remaining < 0 ? ` (${fmtDur(-remaining)} over)` : ""}</dd></div>
            <div><dt>Net work time</dt><dd>{fmtDur(net)}</dd></div>
          </dl>
          {ab && <p className="hint">Your active break will be ended at check-out.</p>}
        </Modal>
      )}
    </section>
  );
}
