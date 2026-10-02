import React from "react";
import type { DB, User } from "../types";
import { apiChangePassword, apiLogin, mapApiUser } from "../lib/api";
import { Icon } from "./Icon";
import { Field } from "./ui";

export function Login({ db, onLogin }: { db: DB; onLogin: (user: User, password: string) => void }) {
  const [email, setEmail] = React.useState("");
  const [pw, setPw] = React.useState("");
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const apiUser = await apiLogin(email.trim(), pw);
      onLogin(mapApiUser(apiUser), pw);
    } catch (e: any) {
      setErr(e.message || "Login failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login-brand">
        <div className="brand-mark"><span>{db.settings.company.split(" ").map((w) => w[0]).join("").slice(0, 2)}</span></div>
        <h1>{db.settings.company} Workplace</h1>
        <p>Attendance, tasks, projects, chat and files for the whole team, in one place.</p>
        <ul className="login-points">
          <li><Icon name="camera" size={18} />Selfie check-in and break timer</li>
          <li><Icon name="tasks" size={18} />Task board and project tracking</li>
          <li><Icon name="chat" size={18} />Team channels, threads and DMs</li>
          <li><Icon name="chart" size={18} />Department KPIs and reports</li>
        </ul>
      </div>
      <div className="login-panel">
        <form className="login-form" onSubmit={submit}>
          <h2>Sign in</h2>
          <Field label="Email"><input value={email} onChange={(e) => { setEmail(e.target.value); setErr(""); }} autoComplete="username" placeholder="owner@yourcompany.com" /></Field>
          <Field label="Password"><input type="password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }} autoComplete="current-password" /></Field>
          {err && <p className="neg small" role="alert">{err}</p>}
          <button className="btn btn-primary btn-lg full" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        </form>
      </div>
    </div>
  );
}

export function ChangePassword({ user, currentPassword, onDone }: { user: User; currentPassword: string | null; onDone: (password: string) => void }) {
  const [a, setA] = React.useState("");
  const [b, setB] = React.useState("");
  const [err, setErr] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const ok = a.length >= 8 && /\d/.test(a) && a === b;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ok || busy) return;
    setBusy(true);
    setErr("");
    try {
      await apiChangePassword(currentPassword || "", a);
      onDone(a);
    } catch (e: any) {
      setErr(e.message || "Could not update password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login-panel center">
        <form className="login-form" onSubmit={submit}>
          <h2>Set your own password</h2>
          <p className="muted">Welcome, {user.name}. Your account has a temporary password. Choose a new one to continue.</p>
          <Field label="New password" hint="At least 8 characters with a number."><input type="password" value={a} onChange={(e) => setA(e.target.value)} autoComplete="new-password" /></Field>
          <Field label="Repeat password"><input type="password" value={b} onChange={(e) => setB(e.target.value)} autoComplete="new-password" /></Field>
          {b && a !== b && <p className="neg small">Passwords don't match.</p>}
          {err && <p className="neg small" role="alert">{err}</p>}
          <button className="btn btn-primary btn-lg full" disabled={!ok || busy}>{busy ? "Saving…" : "Save and continue"}</button>
        </form>
      </div>
    </div>
  );
}
