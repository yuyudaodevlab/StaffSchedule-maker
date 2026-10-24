"use client";
import Dexie, { type Table } from "dexie";
import { create } from "zustand";
import { Project, validateProject } from "@/lib/model";
const db = new Dexie("koyomi-kissa-v1") as Dexie & {
  projects: Table<Project, string>;
};
db.version(1).stores({ projects: "project.id,project.updatedAt" });
let timer: ReturnType<typeof setTimeout> | undefined;
let revision = 0;
let writes: Promise<void> = Promise.resolve();
type State = {
  projects: Project[];
  current: Project | null;
  past: Project[];
  future: Project[];
  ready: boolean;
  status: "保存済み" | "保存中" | "保存失敗";
  error: string;
  load: () => Promise<void>;
  open: (id: string) => void;
  close: () => Promise<void>;
  add: (p: Project) => Promise<void>;
  remove: (id: string) => Promise<void>;
  edit: (fn: (p: Project) => void) => boolean;
  replace: (p: Project) => boolean;
  undo: () => void;
  redo: () => void;
  save: () => Promise<void>;
  clearError: () => void;
};
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(() => void useStore.getState().save(), 600);
}
export const useStore = create<State>((set, get) => ({
  projects: [],
  current: null,
  past: [],
  future: [],
  ready: false,
  status: "保存済み",
  error: "",
  load: async () => {
    try {
      const values = await db.projects.toArray();
      const projects: Project[] = [];
      const invalid: string[] = [];
      for (const v of values) {
        try {
          projects.push(validateProject(v));
        } catch {
          invalid.push(v.project?.name || "不明");
        }
      }
      set({
        projects,
        ready: true,
        error: invalid.length
          ? `読込エラー: ${invalid.join("・")}。保存データは削除していません。バックアップから復元してください。`
          : "",
      });
    } catch {
      set({
        ready: true,
        error:
          "保存データを読み込めません。ブラウザの保存設定を確認してください。",
      });
    }
  },
  open: (id) => {
    if (get().current && get().status !== "保存済み") return;
    const current = get().projects.find((p) => p.project.id === id);
    if (current)
      set({ current: structuredClone(current), past: [], future: [] });
  },
  close: async () => {
    await get().save();
    if (get().status !== "保存失敗")
      set({ current: null, past: [], future: [] });
  },
  add: async (p) => {
    try {
      const valid = validateProject(p);
      await db.projects.put(valid);
      set((s) => ({
        projects: [
          ...s.projects.filter((x) => x.project.id !== valid.project.id),
          valid,
        ],
      }));
    } catch (e) {
      set({
        error: `保存に失敗しました: ${e instanceof Error ? e.message : ""}`,
        status: "保存失敗",
      });
      throw e;
    }
  },
  remove: async (id) => {
    try {
      await db.projects.delete(id);
      set((s) => ({ projects: s.projects.filter((p) => p.project.id !== id) }));
    } catch {
      set({ error: "削除に失敗しました。もう一度お試しください。" });
    }
  },
  edit: (fn) => {
    const old = get().current;
    if (!old) return false;
    try {
      const next = structuredClone(old);
      fn(next);
      next.project.updatedAt = new Date().toISOString();
      const valid = validateProject(next);
      revision++;
      set((s) => ({
        current: valid,
        past: [...s.past.slice(-49), old],
        future: [],
        status: "保存中",
        error: "",
      }));
      schedule();
      return true;
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "変更を保存できませんでした",
      });
      return false;
    }
  },
  replace: (p) =>
    get().edit((draft) =>
      Object.assign(draft, {
        ...p,
        project: { ...p.project, id: draft.project.id },
      }),
    ),
  undo: () => {
    const s = get(),
      prev = s.past.at(-1);
    if (!prev || !s.current) return;
    revision++;
    set({
      current: structuredClone(prev),
      past: s.past.slice(0, -1),
      future: [s.current, ...s.future],
      status: "保存中",
    });
    schedule();
  },
  redo: () => {
    const s = get(),
      next = s.future[0];
    if (!next || !s.current) return;
    revision++;
    set({
      current: structuredClone(next),
      past: [...s.past, s.current],
      future: s.future.slice(1),
      status: "保存中",
    });
    schedule();
  },
  save: async () => {
    clearTimeout(timer);
    const p = get().current;
    if (!p) return;
    const version = revision;
    set({ status: "保存中" });
    const job = async () => {
      try {
        await db.projects.put(p);
        set((s) => ({
          projects: [
            ...s.projects.filter((x) => x.project.id !== p.project.id),
            p,
          ],
          ...(version === revision ? { status: "保存済み" as const } : {}),
        }));
      } catch {
        set({
          status: "保存失敗",
          error:
            "保存に失敗しました。空き容量や保存権限を確認し、JSONバックアップをダウンロードしてください。",
        });
      }
    };
    writes = writes.then(job, job);
    await writes;
  },
  clearError: () => set({ error: "" }),
}));
