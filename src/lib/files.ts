import React from "react";

/* ---------- downloads ---------- */
export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadDataUrl(filename: string, dataUrl: string) {
  const blob = await (await fetch(dataUrl)).blob();
  downloadBlob(filename, blob);
}

/* CSV export (opens directly in Excel) */
export function exportCSV(filename: string, rows: (string | number | null | undefined)[][], toast?: (t: string, tone?: "ok" | "error") => void) {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  downloadBlob(filename, new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
  toast?.("Export downloaded.");
}

/* read a picked image and shrink it before upload */
export function compressImage(src: string, maxW = 480): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, maxW / img.width);
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = rej;
    img.src = src;
  });
}

export const readFile = (file: Blob): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
