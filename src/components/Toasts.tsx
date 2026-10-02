import React from "react";
import { uid } from "../lib/time";

type ToastItem = { id: string; text: string; tone: "ok" | "error" };

export function useToasts(): [(text: string, tone?: "ok" | "error") => void, React.ReactElement] {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const toast = React.useCallback((text: string, tone: "ok" | "error" = "ok") => {
    const id = uid("t");
    setItems((x) => [...x, { id, text, tone }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 3200);
  }, []);
  const view = (
    <div className="toasts" aria-live="polite">
      {items.map((t) => <div key={t.id} className={`toast toast-${t.tone}`}>{t.text}</div>)}
    </div>
  );
  return [toast, view];
}
