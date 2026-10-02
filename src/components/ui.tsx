import React from "react";
import type { IconName } from "./Icon";
import type { User } from "../types";
import { useStore } from "../store/StoreContext";
import { Icon } from "./Icon";

export type Tone = "neutral" | "green" | "amber" | "red" | "blue";

const AV = ["#0B6E69", "#3A5BA0", "#8A4F9E", "#A5572B", "#2F7D4A", "#7A6A1F", "#9C3D54", "#476072"];
export function Avatar({ user, size = 32, dot = false }: { user?: User; size?: number; dot?: boolean }) {
  if (!user) return null;
  const initials = user.name.split(" ").map((s) => s[0]).slice(0, 2).join("");
  const h = [...user.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const pres = { online: "#1E7F46", away: "#C27A12", offline: "#8A939C" }[user.presence || "offline"];
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38, background: AV[h % AV.length] }} title={user.name}>
      {initials}
      {dot && <span className="pres" style={{ background: pres }} aria-label={user.presence} />}
    </span>
  );
}
export function AvatarStack({ ids, max = 4, size = 26 }: { ids: string[]; max?: number; size?: number }) {
  const { db } = useStore();
  const us = ids.map((i) => db.users.find((u) => u.id === i)).filter(Boolean);
  return (
    <span className="stack">
      {us.slice(0, max).map((u) => <Avatar key={u.id} user={u} size={size} />)}
      {us.length > max && <span className="avatar more" style={{ width: size, height: size, fontSize: size * 0.36 }}>+{us.length - max}</span>}
    </span>
  );
}

export function Chip({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`chip chip-${tone}`}>{children}</span>;
}
export const PRIORITY_TONE: Record<string, Tone> = { Low: "neutral", Normal: "blue", High: "amber", Urgent: "red" };
export const STATE_TONE: Record<string, Tone> = { absent: "neutral", working: "green", break: "amber", out: "blue" };

export function Modal({ title, onClose, children, footer, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  React.useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
export function Drawer({ title, onClose, children, actions }: { title: string; onClose: () => void; children: React.ReactNode; actions?: React.ReactNode }) {
  React.useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="overlay drawer-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <div className="row gap8">{actions}<button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button></div>
        </div>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}
export function Empty({ icon = "file", title, children }: { icon?: IconName; title: string; children?: React.ReactNode }) {
  return (
    <div className="empty">
      <Icon name={icon} size={28} />
      <strong>{title}</strong>
      {children && <span>{children}</span>}
    </div>
  );
}
export function Stat({ label, value, tone, sub, onClick }: { label: string; value: React.ReactNode; tone?: Tone; sub?: string; onClick?: () => void }) {
  const cls = `stat ${tone ? "stat-" + tone : ""}`;
  const inner = (
    <>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </>
  );
  return onClick ? <button type="button" className={cls} onClick={onClick}>{inner}</button> : <div className={cls}>{inner}</div>;
}
export function Tabs({ tabs, value, onChange }: { tabs: [string, string][]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map(([id, label]) => (
        <button key={id} role="tab" aria-selected={value === id} className={value === id ? "tab on" : "tab"} onClick={() => onChange(id)}>{label}</button>
      ))}
    </div>
  );
}
export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      <div className="row gap8 wrap">{children}</div>
    </div>
  );
}
