import React from "react";
import type { Visibility } from "../types";
import type { IconName } from "../components/Icon";
import type { PageProps } from "../types";
import { Icon } from "../components/Icon";
import { Drawer, Empty, Field, Modal, PageHead } from "../components/ui";
import { can } from "../lib/access";
import { fmtSize, timeAgo, uid } from "../lib/time";
import { useStore } from "../store/StoreContext";
import { apiDownloadFile, apiFetchFileBlob, apiListFiles, apiUploadFile, mapApiFile } from "../lib/api";
import type { FileItem } from "../types";

/* ================= FILES (backend-backed) ================= */
type FolderKey = { all?: boolean; mine?: boolean; hr?: boolean; dept?: string; project?: string };

function useFiles() {
  const { toast } = useStore();
  const [files, setFiles] = React.useState<FileItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const reload = React.useCallback(async () => {
    try {
      const apiFiles = await apiListFiles();
      setFiles(apiFiles.map(mapApiFile));
    } catch (e: any) {
      toast(e.message || "Could not load files from the server.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);
  React.useEffect(() => { reload(); }, [reload]);
  return { files, loading, reload };
}

export const VIS = { company: "Everyone in the company", department: "Department members", project: "Project members", private: "Only me and admins", hr: "HR and owner only" };

function UploadModal({ onClose, onSaved, folder }: { onClose: () => void; onSaved: () => void; folder: { dept?: string; project?: string } | null }) {
  const { db, me, update, toast } = useStore();
  const [file, setFile] = React.useState<File | null>(null);
  const [dept, setDept] = React.useState(folder?.dept || me.dept);
  const [project, setProject] = React.useState(folder?.project || "");
  const [vis, setVis] = React.useState<Visibility>(folder?.project ? "project" : "department");
  const [busy, setBusy] = React.useState(false);
  const allowed = db.settings.fileTypes.split(",").map((s) => s.trim().toLowerCase());
  const ext = file?.name.split(".").pop()?.toLowerCase();
  const err = !file ? null : file.size > db.settings.maxFileMB * 1048576 ? `Over the ${db.settings.maxFileMB} MB limit.` : !allowed.includes(ext || "") ? `.${ext} files aren't allowed. Allowed: ${db.settings.fileTypes}.` : null;

  const save = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const created = await apiUploadFile(file, { dept, project: project || undefined }, vis);
      const isNewVersion = created.versions.length > 1;
      update((n, h) => {
        const audience = vis === "company" ? n.users.map((u) => u.id) : vis === "department" ? n.users.filter((u) => u.dept === dept).map((u) => u.id) : vis === "project" ? (n.projects.find((p) => p.id === project)?.members || []) : [];
        if (!isNewVersion) h.notify(audience, "file", `${me.name} shared ${file.name}`, { page: "files", id: created.id });
        h.log(isNewVersion ? "file.version" : "file.upload", "file", created.id, file.name);
        if (project) n.projects.find((p) => p.id === project)?.activity.unshift({ at: Date.now(), by: me.id, text: `uploaded ${file.name}` });
      });
      toast(isNewVersion ? `New version of ${file.name} saved.` : `${file.name} uploaded.`);
      onSaved();
      onClose();
    } catch (e: any) {
      toast(e.message || "Upload failed.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Upload file" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!file || !!err || busy} onClick={save}>{busy ? "Uploading…" : "Upload"}</button></>}>
      <label className="dropzone">
        <Icon name="upload" size={26} />
        <strong>{file ? file.name : "Choose a file"}</strong>
        <span className="muted small">{file ? fmtSize(file.size) : `Up to ${db.settings.maxFileMB} MB`}</span>
        <input type="file" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </label>
      {err && <p className="neg small">{err}</p>}
      <div className="grid2">
        <Field label="Department folder"><select value={dept} onChange={(e) => setDept(e.target.value)}>{db.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
        <Field label="Project folder"><select value={project} onChange={(e) => { setProject(e.target.value); if (e.target.value) setVis("project"); }}><option value="">None</option>{db.projects.filter((p) => can.seeAll(me) || p.members.includes(me.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
      </div>
      <Field label="Who can see it" hint="Uploading a file with the same name into the same folder saves a new version.">
        <select value={vis} onChange={(e) => setVis(e.target.value as Visibility)}>
          <option value="company">{VIS.company}</option><option value="department">{VIS.department}</option>
          {project && <option value="project">{VIS.project}</option>}
          <option value="private">{VIS.private}</option>
          {can.hrDocs(me) && <option value="hr">{VIS.hr}</option>}
        </select>
      </Field>
    </Modal>
  );
}

function FilePreview({ f }: { f: FileItem }) {
  const [url, setUrl] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!f.mime?.startsWith("image/")) return;
    let objectUrl: string | null = null;
    apiFetchFileBlob(f.id).then((blob) => {
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }).catch(() => {});
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [f.id, f.mime]);
  if (f.mime?.startsWith("image/")) {
    return url ? <img className="preview" src={url} alt={f.name} /> : <div className="preview-box"><span className="muted small">Loading preview…</span></div>;
  }
  return <div className="preview-box"><span className={`ftype ftype-${f.type} big`}>{f.type}</span><span className="muted small">Preview isn't available for this type. Download to open it.</span></div>;
}

export function FilesPage({ param }: PageProps) {
  const { db, me, toast, update } = useStore();
  const { files, loading, reload } = useFiles();
  const [folder, setFolder] = React.useState<FolderKey>(param?.startsWith("project:") ? { project: param.split(":")[1] } : { all: true });
  const [q, setQ] = React.useState("");
  const [uploading, setUploading] = React.useState(param === "upload");
  const [open, setOpen] = React.useState(param && !param.includes(":") && param !== "upload" ? param : null);
  React.useEffect(() => { if (param === "upload") setUploading(true); }, [param]);

  let list = files;
  if (folder.dept) list = list.filter((f) => f.folder.dept === folder.dept && !f.folder.project && f.visibility !== "hr");
  if (folder.project) list = list.filter((f) => f.folder.project === folder.project);
  if (folder.mine) list = list.filter((f) => f.ownerId === me.id);
  if (folder.hr) list = list.filter((f) => f.visibility === "hr");
  if (q) list = list.filter((f) => f.name.toLowerCase().includes(q.toLowerCase()));
  list = [...list].sort((a, b) => b.at - a.at);

  const f = open && files.find((x) => x.id === open);
  const by = (id: string) => db.users.find((u) => u.id === id);
  const loc = (x: FileItem) => [db.departments.find((d) => d.id === x.folder.dept)?.name, x.folder.project && db.projects.find((p) => p.id === x.folder.project)?.name].filter(Boolean).join(" / ");
  const projs = db.projects.filter((p) => can.seeAll(me) || p.members.includes(me.id));
  const Folder = ({ k, label, icon = "folder", indent = false }: { k: FolderKey; label: string; icon?: IconName; indent?: boolean }) => {
    const on = JSON.stringify(folder) === JSON.stringify(k);
    return <button className={`folder ${on ? "on" : ""} ${indent ? "indent" : ""}`} onClick={() => setFolder(k)}><Icon name={icon} size={16} />{label}</button>;
  };
  const download = async (x: FileItem) => {
    try {
      await apiDownloadFile(x.id, x.name);
      update((n, h) => h.log("file.download", "file", x.id, x.name));
    } catch (e: any) {
      toast(e.message || "Download failed.", "error");
    }
  };

  return (
    <div className="page page-wide">
      <PageHead title="Files & Documents" sub={loading ? "Loading from the server…" : "Company › Department › Project"}>
        <button className="btn btn-primary" onClick={() => setUploading(true)}><Icon name="upload" />Upload</button>
      </PageHead>
      <div className="files">
        <nav className="folders" aria-label="Folders">
          <Folder k={{ all: true }} label="All files" />
          <Folder k={{ mine: true }} label="My uploads" icon="upload" />
          {can.hrDocs(me) && <Folder k={{ hr: true }} label="HR documents" icon="lock" />}
          <span className="chan-h">Departments</span>
          {db.departments.filter((d) => can.seeAll(me) || d.id === me.dept).map((d) => <Folder key={d.id} k={{ dept: d.id }} label={d.name} indent />)}
          <span className="chan-h">Projects</span>
          {projs.map((p) => <Folder key={p.id} k={{ project: p.id }} label={p.name} indent icon="briefcase" />)}
        </nav>
        <section className="card grow">
          <div className="toolbar"><div className="search grow"><Icon name="search" size={16} /><input placeholder="Search files" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search files" /></div></div>
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Name</th><th className="hide-sm">Location</th><th className="hide-sm">Owner</th><th>Size</th><th className="hide-sm">Updated</th></tr></thead>
            <tbody>
              {list.map((x) => (
                <tr key={x.id} className="clickable" onClick={() => setOpen(x.id)}>
                  <td><button className="who text-left" onClick={() => setOpen(x.id)}><span className={`ftype ftype-${x.type}`}>{x.type}</span><span><strong className="small">{x.name}</strong>{x.versions.length > 1 && <span className="muted small"> · v{x.versions.length}</span>}{x.visibility === "hr" && <span className="muted small"> · restricted</span>}</span></button></td>
                  <td className="hide-sm small muted">{loc(x)}</td>
                  <td className="hide-sm small">{by(x.ownerId)?.name}</td>
                  <td className="small num">{fmtSize(x.size)}</td>
                  <td className="hide-sm small muted">{timeAgo(x.at)}</td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={5}><Empty icon="folder" title="This folder is empty">Upload a file to share it with the team.</Empty></td></tr>}
            </tbody>
          </table></div>
        </section>
      </div>
      {f && (
        <Drawer title={f.name} onClose={() => setOpen(null)} actions={<button className="btn btn-sm" onClick={() => download(f)}><Icon name="download" size={16} />Download</button>}>
          <FilePreview f={f} />
          <dl className="summary">
            <div><dt>Location</dt><dd>{loc(f)}</dd></div>
            <div><dt>Owner</dt><dd>{by(f.ownerId)?.name}</dd></div>
            <div><dt>Size</dt><dd>{fmtSize(f.size)}</dd></div>
            <div><dt>Access</dt><dd>{VIS[f.visibility]}</dd></div>
          </dl>
          <h4 className="sub-h">Version history</h4>
          <ul className="timeline">{[...f.versions].reverse().map((v) => <li key={v.v}><strong>v{v.v}</strong> by {by(v.by)?.name || v.by}<span className="muted small"> · {timeAgo(v.at)}</span></li>)}</ul>
        </Drawer>
      )}
      {uploading && <UploadModal onSaved={reload} onClose={() => setUploading(false)} folder={folder.project ? { project: folder.project, dept: db.projects.find((p) => p.id === folder.project) && me.dept } : folder.dept ? { dept: folder.dept } : null} />}
    </div>
  );
}
