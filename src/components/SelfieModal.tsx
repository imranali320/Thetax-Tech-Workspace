import React from "react";
import { compressImage, readFile } from "../lib/files";
import { Icon } from "./Icon";
import { Modal } from "./ui";

/* ---------------- selfie capture ---------------- */
export function SelfieModal({ title, onClose, onConfirm }: { title: string; onClose: () => void; onConfirm: (photo: string) => void | Promise<void> }) {
  const video = React.useRef(null);
  const streamRef = React.useRef(null);
  const [camState, setCamState] = React.useState("starting");
  const [photo, setPhoto] = React.useState(null);
  const [busy, setBusy] = React.useState(false);

  const stop = () => streamRef.current?.getTracks().forEach((t) => t.stop());
  React.useEffect(() => {
    let dead = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("no camera");
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640 }, audio: false });
        if (dead) { s.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = s;
        if (video.current) { video.current.srcObject = s; await video.current.play(); }
        setCamState("on");
      } catch {
        setCamState("off");
      }
    })();
    return () => { dead = true; stop(); };
  }, []);

  const snap = async () => {
    const v = video.current;
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    const ctx = c.getContext("2d");
    ctx.translate(c.width, 0); ctx.scale(-1, 1);
    ctx.drawImage(v, 0, 0);
    setPhoto(await compressImage(c.toDataURL("image/jpeg", 0.9)));
    stop(); setCamState("done");
  };
  const pick = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhoto(await compressImage(await readFile(f)));
    stop(); setCamState("done");
  };
  const confirm = async () => {
    setBusy(true);
    await onConfirm(photo);
    setBusy(false);
  };

  return (
    <Modal title={title} onClose={() => { stop(); onClose(); }}
      footer={<>
        <button className="btn" onClick={() => { stop(); onClose(); }}>Cancel</button>
        <button className="btn btn-primary" disabled={!photo || busy} onClick={confirm}>{busy ? "Saving…" : "Confirm check-in"}</button>
      </>}>
      <div className="selfie-box">
        {photo ? <img src={photo} alt="Your attendance photo" /> :
          camState === "off" ? (
            <div className="selfie-empty"><Icon name="camera" size={34} /><span>Camera isn't available here. Upload a photo instead.</span></div>
          ) : <video ref={video} playsInline muted />}
      </div>
      <div className="row gap8 wrap" style={{ marginTop: 14 }}>
        {camState === "on" && !photo && <button className="btn btn-primary" onClick={snap}><Icon name="camera" />Take photo</button>}
        {photo && <button className="btn" onClick={() => { setPhoto(null); setCamState("off"); }}>Retake by upload</button>}
        <label className="btn">
          <Icon name="upload" />Upload photo
          <input type="file" accept="image/*" capture="user" onChange={pick} hidden />
        </label>
      </div>
      <p className="hint" style={{ marginTop: 12 }}>The photo is stored as attendance evidence with the server time. It is not used for face recognition.</p>
    </Modal>
  );
}
