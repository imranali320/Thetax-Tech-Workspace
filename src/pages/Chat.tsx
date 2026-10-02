import React from "react";
import type { Channel, FileItem, Message as ChatMessage, PageProps } from "../types";
import { Icon } from "../components/Icon";
import { Avatar, Empty, Modal } from "../components/ui";
import { can } from "../lib/access";
import { dateKey, fmtDate, fmtSize, fmtTime, timeAgo } from "../lib/time";
import { useStore } from "../store/StoreContext";
import {
  apiCreateChannel, apiDeleteMessage, apiEditMessage, apiFetchFileBlob, apiListChannels, apiListFiles,
  apiListMessages, apiMarkChannelRead, apiSearchMessages, apiSendMessage, apiToggleReaction, apiUploadFile,
  mapApiChannel, mapApiFile, mapApiMessage,
} from "../lib/api";

/* ================= CHAT (backend-backed, polling) ================= */
const QUICK = ["👍", "✅", "😂", "❤️", "🙏"];
const CHANNEL_POLL_MS = 6000;
const MESSAGE_POLL_MS = 3000;

function renderText(text: string, users: { name: string }[]) {
  const names = users.map((u) => "@" + u.name).sort((a, b) => b.length - a.length);
  if (!names.length) return text;
  const re = new RegExp(`(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
  return text.split(re).map((part, i) => (names.includes(part) ? <span key={i} className="mention">{part}</span> : part));
}

function AttachmentView({ file }: { file: FileItem }) {
  const [url, setUrl] = React.useState<string | null>(null);
  const isImage = file.mime?.startsWith("image/");
  React.useEffect(() => {
    if (!isImage) return;
    let objectUrl: string | null = null;
    apiFetchFileBlob(file.id).then((blob) => { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); }).catch(() => {});
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [file.id, isImage]);
  if (isImage) return url ? <img className="msg-img" src={url} alt={file.name} /> : <span className="muted small">Loading image…</span>;
  return <div className="msg-file"><span className={`ftype ftype-${file.type}`}>{file.type}</span><span>{file.name}</span><span className="muted small">{fmtSize(file.size)}</span></div>;
}

function Composer({ channel, parentId, placeholder, onSent }: { channel: Channel; parentId?: string; placeholder: string; onSent?: () => void }) {
  const { db, me, toast } = useStore();
  const [text, setText] = React.useState("");
  const [att, setAtt] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const members = db.users.filter((u) => channel.members.includes(u.id) && u.id !== me.id);
  const m = text.match(/@([\w ]{0,20})$/);
  const sugg = m ? members.filter((u) => u.name.toLowerCase().startsWith(m[1].toLowerCase())).slice(0, 5) : [];

  const send = async () => {
    const t = text.trim();
    if ((!t && !att) || busy) return;
    setBusy(true);
    try {
      let attachmentId: string | null = null;
      if (att) {
        const created = await apiUploadFile(att, channel.projectId ? { project: channel.projectId } : { dept: me.dept }, channel.projectId ? "project" : "department");
        attachmentId = created.id;
      }
      await apiSendMessage(channel.id, { text: t, parent_id: parentId || null, attachment_file_id: attachmentId });
      setText(""); setAtt(null);
      onSent?.();
    } catch (e: any) {
      toast(e.message || "Could not send message.", "error");
    } finally {
      setBusy(false);
    }
  };
  const pick = (e: any) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > db.settings.maxFileMB * 1048576) { toast(`File is over the ${db.settings.maxFileMB} MB limit.`, "error"); return; }
    setAtt(f);
    e.target.value = "";
  };
  const insert = (u: { name: string }) => { setText(text.replace(/@([\w ]{0,20})$/, "@" + u.name + " ")); ref.current?.focus(); };

  return (
    <div className="composer">
      {sugg.length > 0 && <div className="mention-menu" role="listbox">{sugg.map((u) => <button key={u.id} role="option" onClick={() => insert(u)}><Avatar user={u} size={22} />{u.name}</button>)}</div>}
      {att && <div className="att-chip"><Icon name="clip" size={14} />{att.name}<button className="icon-btn" onClick={() => setAtt(null)} aria-label="Remove attachment"><Icon name="x" size={14} /></button></div>}
      <div className="composer-row">
        <label className="icon-btn" aria-label="Attach file" title="Attach file"><Icon name="clip" /><input type="file" hidden onChange={pick} /></label>
        <textarea ref={ref} rows={1} value={text} placeholder={placeholder} aria-label="Message"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (sugg.length) insert(sugg[0]); else send(); } }} />
        <button className="btn btn-primary btn-icon" onClick={send} disabled={(!text.trim() && !att) || busy} aria-label="Send"><Icon name="send" /></button>
      </div>
    </div>
  );
}

function Message({ m, replies, allFiles, onThread, onChanged, inThread = false }: { m: ChatMessage; replies: ChatMessage[]; allFiles: FileItem[]; onThread?: (id: string) => void; onChanged: () => void; inThread?: boolean }) {
  const { db, me, toast } = useStore();
  const [editing, setEditing] = React.useState(false);
  const [val, setVal] = React.useState(m.text);
  const [busy, setBusy] = React.useState(false);
  const u = db.users.find((x) => x.id === m.senderId);
  const mine = m.senderId === me.id;

  const react = async (e: string) => {
    try { await apiToggleReaction(m.id, e); onChanged(); } catch (err: any) { toast(err.message || "Reaction failed.", "error"); }
  };
  const saveEdit = async () => {
    setBusy(true);
    try { await apiEditMessage(m.id, val); setEditing(false); onChanged(); }
    catch (e: any) { toast(e.message || "Edit failed.", "error"); }
    finally { setBusy(false); }
  };
  const del = async () => {
    try { await apiDeleteMessage(m.id); onChanged(); } catch (e: any) { toast(e.message || "Delete failed.", "error"); }
  };

  return (
    <div className="msg">
      <Avatar user={u} size={34} />
      <div className="msg-body">
        <div className="row gap8"><strong>{u?.name || "Unknown"}</strong><span className="muted small">{fmtTime(m.at)}{m.edited ? " · edited" : ""}</span></div>
        {editing ? (
          <div className="stack-list"><textarea rows={2} value={val} onChange={(e) => setVal(e.target.value)} aria-label="Edit message" /><div className="row gap8"><button className="btn btn-sm btn-primary" disabled={busy} onClick={saveEdit}>Save</button><button className="btn btn-sm" onClick={() => setEditing(false)}>Cancel</button></div></div>
        ) : m.text && <p className="msg-text">{renderText(m.text, db.users)}</p>}
        {m.attachments.map((fid) => {
          const f = allFiles.find((x) => x.id === fid);
          return f ? <AttachmentView key={fid} file={f} /> : null;
        })}
        <div className="row gap4 wrap">
          {Object.entries(m.reactions).map(([e, ids]) => (
            <button key={e} className={`reaction ${ids.includes(me.id) ? "on" : ""}`} onClick={() => react(e)} title={ids.map((i) => db.users.find((x) => x.id === i)?.name).join(", ")}>{e} {ids.length}</button>
          ))}
          {!inThread && replies.length > 0 && <button className="link small" onClick={() => onThread?.(m.id)}>{replies.length} {replies.length === 1 ? "reply" : "replies"}</button>}
        </div>
      </div>
      <div className="msg-actions">
        {QUICK.slice(0, 3).map((e) => <button key={e} className="icon-btn" onClick={() => react(e)} aria-label={`React ${e}`}>{e}</button>)}
        {!inThread && <button className="icon-btn" onClick={() => onThread?.(m.id)} aria-label="Reply in thread"><Icon name="reply" size={16} /></button>}
        {mine && <button className="icon-btn" onClick={() => setEditing(true)} aria-label="Edit"><Icon name="edit" size={16} /></button>}
        {(mine || can.moderate(me)) && <button className="icon-btn" onClick={del} aria-label="Delete"><Icon name="trash" size={16} /></button>}
      </div>
    </div>
  );
}

export function ChatPage({ param }: PageProps) {
  const { db, me, toast } = useStore();
  const [channels, setChannels] = React.useState<Channel[]>([]);
  const [channelsLoaded, setChannelsLoaded] = React.useState(false);
  const [active, setActive] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [allFiles, setAllFiles] = React.useState<FileItem[]>([]);
  const [thread, setThread] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");
  const [results, setResults] = React.useState<ChatMessage[] | null>(null);
  const [dmPick, setDmPick] = React.useState(false);
  const [mobileList, setMobileList] = React.useState(!param);
  const listRef = React.useRef<HTMLDivElement>(null);
  const requestedParam = React.useRef(param);

  const loadChannels = React.useCallback(() => {
    apiListChannels().then((cs) => {
      const mapped = cs.map(mapApiChannel);
      setChannels(mapped);
      setChannelsLoaded(true);
      setActive((cur) => {
        if (cur && mapped.some((c) => c.id === cur)) return cur;
        const wanted = requestedParam.current;
        if (wanted && !wanted.includes(":") && wanted !== "upload" && mapped.some((c) => c.id === wanted)) return wanted;
        return mapped.find((c) => c.name === "general")?.id || mapped[0]?.id || null;
      });
    }).catch((e) => toast(e.message || "Could not load channels.", "error"));
  }, [toast]);

  React.useEffect(() => { loadChannels(); const id = setInterval(loadChannels, CHANNEL_POLL_MS); return () => clearInterval(id); }, [loadChannels]);

  const loadMessages = React.useCallback(() => {
    if (!active) return;
    apiListMessages(active).then((ms) => setMessages(ms.map(mapApiMessage))).catch(() => {});
  }, [active]);

  React.useEffect(() => {
    if (!active) return;
    loadMessages();
    const id = setInterval(loadMessages, MESSAGE_POLL_MS);
    return () => clearInterval(id);
  }, [active, loadMessages]);

  React.useEffect(() => {
    if (!active) return;
    apiMarkChannelRead(active).catch(() => {});
  }, [active, messages.length]);

  React.useEffect(() => { listRef.current && (listRef.current.scrollTop = listRef.current.scrollHeight); }, [messages.length, active]);

  const refreshFiles = React.useCallback(() => {
    apiListFiles().then((fs) => setAllFiles(fs.map(mapApiFile))).catch(() => {});
  }, []);
  React.useEffect(() => { refreshFiles(); }, [refreshFiles]);

  const channel = channels.find((c) => c.id === active) || null;
  const topMsgs = messages.filter((m) => !m.parentId).sort((a, b) => a.at - b.at);
  const repliesOf = (id: string) => messages.filter((m) => m.parentId === id);
  const title = (c: Channel) => (c.type === "dm" ? db.users.find((u) => u.id === c.members.find((x) => x !== me.id))?.name : c.name);

  const openDM = async (uidv: string) => {
    try {
      const created = await apiCreateChannel({ type: "dm", member_ids: [uidv] });
      loadChannels();
      setActive(created.id);
      setDmPick(false); setMobileList(false); setThread(null);
    } catch (e: any) {
      toast(e.message || "Could not open DM.", "error");
    }
  };

  React.useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults(null); return; }
    const t = setTimeout(() => {
      apiSearchMessages(term).then((ms) => setResults(ms.map(mapApiMessage))).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const threadMsg = thread ? messages.find((m) => m.id === thread) : null;
  let lastDay = "";

  const ChanBtn = ({ c }: { c: Channel }) => {
    const other = c.type === "dm" ? db.users.find((x) => x.id === c.members.find((y) => y !== me.id)) : null;
    return (
      <button className={`chan ${c.id === active ? "on" : ""} ${c.unread ? "unread" : ""}`} onClick={() => { setActive(c.id); setThread(null); setMobileList(false); setQ(""); }}>
        {other ? <Avatar user={other} size={22} dot /> : <Icon name={c.type === "project" ? "briefcase" : "hash"} size={16} />}
        <span className="grow truncate">{title(c)}</span>
        {c.unread > 0 && <span className="badge">{c.unread}</span>}
      </button>
    );
  };

  if (!channelsLoaded) return <div className="page"><Empty icon="chat" title="Loading chat…" /></div>;
  if (!channel) return <div className="page"><Empty icon="chat" title="No channels yet" /></div>;

  return (
    <div className="chat">
      <aside className={`chat-side ${mobileList ? "show" : ""}`}>
        <div className="search"><Icon name="search" size={16} /><input placeholder="Search messages" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search messages" /></div>
        <div className="chan-group"><span className="chan-h">Channels</span>{channels.filter((c) => c.type === "channel").map((c) => <ChanBtn key={c.id} c={c} />)}</div>
        <div className="chan-group"><span className="chan-h">Projects</span>{channels.filter((c) => c.type === "project").map((c) => <ChanBtn key={c.id} c={c} />)}</div>
        <div className="chan-group"><span className="chan-h row between">Direct messages<button className="icon-btn" onClick={() => setDmPick(true)} aria-label="New direct message"><Icon name="plus" size={16} /></button></span>{channels.filter((c) => c.type === "dm").map((c) => <ChanBtn key={c.id} c={c} />)}</div>
      </aside>

      <section className={`chat-main ${mobileList ? "hide-m" : ""}`}>
        <header className="chat-head">
          <button className="icon-btn mobile-only" onClick={() => setMobileList(true)} aria-label="Back to channels"><Icon name="arrowLeft" /></button>
          <div className="grow">
            <strong>{channel.type === "dm" ? title(channel) : "#" + channel.name}</strong>
            <span className="muted small block">{channel.type === "dm" ? db.users.find((u) => u.id === channel.members.find((x) => x !== me.id))?.presence : `${channel.members.length} members · ${channel.topic || ""}`}</span>
          </div>
        </header>
        {results ? (
          <div className="msg-list">
            <p className="muted small">{results.length} results for "{q}"</p>
            {results.map((m) => (
              <button key={m.id} className="result" onClick={() => { setActive(m.channelId); setQ(""); setResults(null); if (m.parentId) setThread(m.parentId); }}>
                <span className="muted small">{(() => { const c = channels.find((x) => x.id === m.channelId); return c ? title(c) : ""; })()} · {timeAgo(m.at)}</span>
                <span><strong>{db.users.find((u) => u.id === m.senderId)?.name}:</strong> {m.text}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="msg-list" ref={listRef}>
            {topMsgs.length === 0 && <Empty icon="chat" title="No messages yet">Say hello to start the conversation.</Empty>}
            {topMsgs.map((m) => {
              const d = dateKey(new Date(m.at));
              const sep = d !== lastDay; lastDay = d;
              return <React.Fragment key={m.id}>{sep && <div className="day-sep"><span>{d === dateKey() ? "Today" : fmtDate(d)}</span></div>}<Message m={m} replies={repliesOf(m.id)} allFiles={allFiles} onThread={setThread} onChanged={() => { loadMessages(); refreshFiles(); }} /></React.Fragment>;
            })}
          </div>
        )}
        <Composer channel={channel} placeholder={`Message ${channel.type === "dm" ? title(channel) : "#" + channel.name}`} onSent={() => { loadMessages(); loadChannels(); refreshFiles(); }} />
      </section>

      {threadMsg && (
        <aside className="thread">
          <header className="chat-head"><strong className="grow">Thread</strong><button className="icon-btn" onClick={() => setThread(null)} aria-label="Close thread"><Icon name="x" /></button></header>
          <div className="msg-list">
            <Message m={threadMsg} replies={[]} allFiles={allFiles} onChanged={() => { loadMessages(); refreshFiles(); }} inThread />
            <div className="day-sep"><span>{repliesOf(thread!).length} replies</span></div>
            {repliesOf(thread!).sort((a, b) => a.at - b.at).map((m) => <Message key={m.id} m={m} replies={[]} allFiles={allFiles} onChanged={() => { loadMessages(); refreshFiles(); }} inThread />)}
          </div>
          <Composer channel={channel} parentId={thread} placeholder="Reply in thread" onSent={() => { loadMessages(); refreshFiles(); }} />
        </aside>
      )}

      {dmPick && (
        <Modal title="New direct message" onClose={() => setDmPick(false)}>
          <div className="stack-list">{db.users.filter((u) => u.id !== me.id && u.status === "active").map((u) => (
            <button key={u.id} className="feed-item" onClick={() => openDM(u.id)}><Avatar user={u} size={30} dot /><div className="grow"><strong className="small">{u.name}</strong><span className="muted small block">{u.title}</span></div></button>
          ))}</div>
        </Modal>
      )}
    </div>
  );
}
