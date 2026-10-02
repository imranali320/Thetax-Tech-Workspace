import React from "react";

/* ---------- time helpers ---------- */
export const pad = (n) => String(n).padStart(2, "0");
export const dateKey = (d = new Date()) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};
export const atTime = (dk, hhmm) => {
  const [y, m, d] = dk.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  return new Date(y, m - 1, d, h, mi).getTime();
};
export const addDays = (dk, n) => {
  const [y, m, d] = dk.split("-").map(Number);
  return dateKey(new Date(y, m - 1, d + n));
};
export const fmtTime = (ts) =>
  ts ? new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—";
export const fmtDate = (dk) => {
  if (!dk) return "—";
  const [y, m, d] = dk.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
};
export const fmtDay = (dk) => {
  const [y, m, d] = dk.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
};
export const fmtDur = (ms) => {
  if (!ms || ms < 0) ms = 0;
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  return h ? `${h}h ${pad(m % 60)}m` : `${m}m`;
};
export const fmtClock = (ms) => {
  if (!ms || ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
};
export const timeAgo = (ts, now = Date.now()) => {
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};
export const fmtSize = (b) =>
  b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
export const uid = (p = "") => p + Math.random().toString(36).slice(2, 9);

export function useNow(ms = 1000) {
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
