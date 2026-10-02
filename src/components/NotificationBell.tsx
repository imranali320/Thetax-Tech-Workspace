import React from "react";
import { timeAgo } from "../lib/time";
import { Store } from "../store/StoreContext";
import { Icon } from "./Icon";
import { Empty } from "./ui";

export function NotificationBell() {
  const { db, me, update, go } = React.useContext(Store);
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const list = db.notifications.filter((n) => n.userId === me.id).sort((a, b) => b.at - a.at);
  const unread = list.filter((n) => !n.readAt).length;
  React.useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div className="bell" ref={ref}>
      <button className="icon-btn" onClick={() => setOpen(!open)} aria-label={`Notifications, ${unread} unread`} aria-expanded={open}>
        <Icon name="bell" />{unread > 0 && <span className="badge abs">{unread}</span>}
      </button>
      {open && (
        <div className="popover">
          <div className="row between pop-head"><strong>Notifications</strong><button className="link small" onClick={() => update((n) => n.notifications.forEach((x) => { if (x.userId === me.id) x.readAt = x.readAt || Date.now(); }))}>Mark all read</button></div>
          {list.slice(0, 7).map((x) => (
            <button key={x.id} className={`pop-item ${x.readAt ? "" : "unread"}`} onClick={() => { update((n) => { n.notifications.find((y) => y.id === x.id).readAt = Date.now(); }); setOpen(false); x.link && go(x.link.page, x.link.id); }}>
              <span>{x.text}</span><span className="muted small">{timeAgo(x.at)}</span>
            </button>
          ))}
          {list.length === 0 && <Empty icon="bell" title="No notifications" />}
          <button className="link pop-all" onClick={() => { setOpen(false); go("notifications"); }}>See all</button>
        </div>
      )}
    </div>
  );
}
