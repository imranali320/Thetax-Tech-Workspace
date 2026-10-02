import React from "react";
import type { IconName } from "../components/Icon";
import { Icon } from "../components/Icon";
import { Empty, PageHead } from "../components/ui";
import { timeAgo } from "../lib/time";
import { useStore } from "../store/StoreContext";

/* ================= NOTIFICATIONS ================= */
export function NotificationsPage() {
  const { db, me, update, go } = useStore();
  const list = db.notifications.filter((n) => n.userId === me.id).sort((a, b) => b.at - a.at);
  const markAll = () => update((n) => n.notifications.forEach((x) => { if (x.userId === me.id && !x.readAt) x.readAt = Date.now(); }));
  const open = (x) => { update((n) => { n.notifications.find((y) => y.id === x.id).readAt = Date.now(); }); if (x.link) go(x.link.page, x.link.id); };
  return (
    <div className="page">
      <PageHead title="Notifications" sub={`${list.filter((n) => !n.readAt).length} unread`}><button className="btn" onClick={markAll}>Mark all as read</button></PageHead>
      <section className="card">
        <div className="feed">
          {list.map((x) => (
            <button key={x.id} className={`feed-item notif ${x.readAt ? "" : "unread"}`} onClick={() => open(x)}>
              <span className={`notif-ico n-${x.type}`}><Icon name={({ task: "tasks", mention: "chat", message: "chat", file: "folder", leave: "calendar", attendance: "clock", project: "briefcase" }[x.type] || "bell") as IconName} size={16} /></span>
              <div className="grow"><p>{x.text}</p><span className="muted small">{timeAgo(x.at)}</span></div>
              {!x.readAt && <span className="unread-dot" aria-label="Unread" />}
            </button>
          ))}
          {list.length === 0 && <Empty icon="bell" title="You're all caught up" />}
        </div>
      </section>
    </div>
  );
}
