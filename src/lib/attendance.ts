import React from "react";

/* ---------- attendance math ---------- */
export const breaksTotal = (rec, now = Date.now()) =>
  (rec?.breaks || []).reduce((s, b) => s + ((b.end || now) - b.start), 0);
export const activeBreak = (rec) => (rec?.breaks || []).find((b) => !b.end);
export const netWork = (rec, now = Date.now()) =>
  rec?.checkIn ? Math.max(0, (rec.checkOut || now) - rec.checkIn - breaksTotal(rec, now)) : 0;
export const attState = (rec) => {
  if (!rec || !rec.checkIn) return "absent";
  if (rec.checkOut) return "out";
  if (activeBreak(rec)) return "break";
  return "working";
};
export const STATE_LABEL = { absent: "Not checked in", working: "Working", break: "On break", out: "Checked out" };
