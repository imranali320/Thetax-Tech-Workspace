import React from "react";
import type { DB, Helpers, PageId, User } from "../types";

export interface StoreValue {
  db: DB;
  me: User;
  update: (fn: (draft: DB, h: Helpers) => void) => void;
  go: (page: PageId, param?: string | null) => void;
  toast: (text: string, tone?: "ok" | "error") => void;
  reloadDirectory: () => Promise<void>;
}

// Holds the whole app state. When the Laravel API is added, replace `update`
// with API calls (or a data library such as TanStack Query) page by page.
export const Store = React.createContext<StoreValue>(null as unknown as StoreValue);
export const useStore = () => React.useContext(Store);
