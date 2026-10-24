"use client";
import { useEffect, useState, useMemo } from "react";
import {
  Coffee,
  Plus,
  CalendarDays,
  LayoutDashboard,
  Users,
  MapPin,
  BadgeCheck,
  Play,
  Settings as SettingsIcon,
  FolderOpen,
  Search,
  Share2,
  Download,
  ArrowLeft,
  Undo2,
  Redo2,
  Moon,
  Menu,
  X,
  Copy,
  Trash2,
  ArrowRight,
  CheckCircle2,
  Upload,
  ChevronRight,
} from "lucide-react";
import { useStore } from "@/stores/project-store";
import { Project, Filter, emptyFilter } from "@/lib/model";
import {
  newProject,
  sampleProject,
  remap,
  filtered,
  duplicateSession,
  deleteSession,
  shiftSession,
} from "@/lib/project";
import { addDays, dayLabel, dateIn, uid, instant, stamp } from "@/lib/time";
import { download } from "@/lib/export";
import { conflicts } from "@/lib/conflicts";
import { Modal, Field, Empty, Confirm } from "./ui";
import { ProgramEditor, InitialSlot } from "./program-editor";
import { Timeline } from "./timeline";
import { Masters, MasterKind } from "./masters";
import { Dashboard, ProgramList, Progress, Settings } from "./views";
import { Filters } from "./filters";
import { ShareDialog, ExportDialog } from "./sharing-ui";
import { BatchDialog } from "./batch-dialog";
import { dateShiftMinutes, type BatchOptions } from "@/lib/editing";
import { ImportDialog } from "./import-dialog";
type View =
  "dashboard" | "schedule" | "programs" | MasterKind | "progress" | "settings";
const navigation = [
  ["dashboard", "ダッシュボード", LayoutDashboard],
  ["schedule", "スケジュール", CalendarDays],
  ["programs", "プログラム", FolderOpen],
  ["people", "人物", Users],
  ["groups", "グループ", Users],
  ["venues", "会場", MapPin],
  ["roles", "ロール", BadgeCheck],
  ["progress", "進行モード", Play],
] as const;
export function Workspace() {
  const store = useStore();
  const p = store.current;
  const [view, setView] = useState<View>("schedule");
  const [date, setDate] = useState("");
  const [filter, setFilter] = useState<Filter>(emptyFilter());
  const [editor, setEditor] = useState<{
    id?: string;
    initial?: InitialSlot;
  } | null>(null);
  const [dialog, setDialog] = useState<
    "new" | "share" | "export" | "import" | "day" | "batch" | "help" | null
  >(null);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [sidebar, setSidebar] = useState(false);
  const [deleteProject, setDeleteProject] = useState<string | null>(null);
  const [rename, setRename] = useState<Project | null>(null);
  const [dateInput, setDateInput] = useState("");
  const [dayAction, setDayAction] = useState("add");
  const [batchAction, setBatchAction] =
    useState<BatchOptions["action"]>("shift");
  const [presetName, setPresetName] = useState("");
  const [toast, setToast] = useState("");
  const [scheduleMode, setScheduleMode] = useState("timeline");
  useEffect(() => {
    void useStore.getState().load();
  }, []);
  useEffect(() => {
    if (p) {
      setDate(p.days[0]?.date || "");
      setFilter(emptyFilter());
      setSelected([]);
    }
  }, [p?.project.id]);
  useEffect(() => {
    let stored = "system";
    try {
      stored = localStorage.getItem("koyomi-theme") || "system";
    } catch {}
    const theme = p?.settings.theme || stored;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      (document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme);
    apply();
    try {
      localStorage.setItem("koyomi-theme", theme);
    } catch {}
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [p?.settings.theme]);
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => {
      if (useStore.getState().status !== "保存済み") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      const input =
        e.target instanceof HTMLElement &&
        (e.target.matches("input,textarea,select") ||
          e.target.isContentEditable);
      const command = e.ctrlKey || e.metaKey;
      if (command && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void store.save();
        return;
      }
      if (input) return;
      if (command && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? store.redo() : store.undo();
      }
      if (command && e.key.toLowerCase() === "f") {
        e.preventDefault();
        document.getElementById("schedule-search")?.focus();
      }
      if (e.key === "Escape") {
        setEditor(null);
        setDialog(null);
      }
      if (e.key === "Delete" && selected.length) {
        setBatchAction("delete");
        setDialog("batch");
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [store, selected]);
  const actualFilter = { ...filter, date };
  const warningCount = useMemo(() => (p ? conflicts(p).length : 0), [p]);
  const toggleSelected = (id: string) =>
    setSelected(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    );
  const open = (id: string) => {
    store.open(id);
    setView("schedule");
  };
  async function create(sample = false) {
    const next = sample
      ? sampleProject()
      : newProject(name.trim() || "新しいイベント");
    try {
      await store.add(next);
      open(next.project.id);
      setDialog(null);
      setName("");
      setToast("プロジェクトを作成しました");
    } catch {}
  }
  if (!store.ready)
    return (
      <main className="loading">
        <Coffee size={40} />
        <h2>スケジュールを読み込んでいます…</h2>
      </main>
    );
  return (
    <div className="app-shell">
      {p && (
        <aside className={`sidebar ${sidebar ? "is-open" : ""}`}>
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              void store.close();
            }}
          >
            <span className="brand-icon">
              <Coffee size={24} />
            </span>
            <span>
              運営向け
              <span className="brand-name-line">スケジュールメーカー</span>
              <small>EVENT SCHEDULE MAKER</small>
            </span>
          </a>
          <div className="sidebar-project">
            <span className="eyebrow">MY EVENT</span>
            <strong>{p.project.name}</strong>
            <span className="small muted">{p.days.length}日間のものがたり</span>
          </div>
          <nav>
            {navigation.map(([id, label, Icon], i) => (
              <button
                key={id}
                className={view === id ? "active" : ""}
                onClick={() => {
                  setView(id);
                  setSidebar(false);
                }}
              >
                <Icon size={18} />
                {label}
                {id === "programs" && (
                  <span className="nav-count">{p.programs.length}</span>
                )}
                {i === 6 && <span />}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <button
              onClick={() => {
                setView("settings");
                setSidebar(false);
              }}
            >
              <SettingsIcon size={18} />
              設定
            </button>
            <button onClick={() => void store.close()}>
              <FolderOpen size={18} />
              プロジェクト一覧
            </button>
            <div className="coffee-note">
              <Coffee size={24} />
              <p>
                ひと息ついて、
                <br />
                いいイベントを。
              </p>
              <button onClick={() => setDialog("help")}>
                使い方を見る <ArrowRight size={13} />
              </button>
            </div>
            <span className="small muted">LOCAL FIRST · MADE WITH CARE</span>
          </div>
        </aside>
      )}
      {sidebar && (
        <button
          className="sidebar-shade"
          aria-label="ナビゲーションを閉じる"
          onClick={() => setSidebar(false)}
        />
      )}
      <div className={p ? "main-shell" : "home-shell"}>
        <header className="app-header">
          {p ? (
            <>
              <div className="header-title">
                <button
                  className="icon-button mobile-menu"
                  onClick={() => setSidebar(!sidebar)}
                  aria-label="メニュー"
                >
                  <Menu size={20} />
                </button>
                <span className="breadcrumb">
                  マイイベント <ChevronRight size={14} />
                </span>
                <b>{p.project.name}</b>
              </div>
              <div className="header-actions">
                <button
                  className={`save-state ${store.status === "保存失敗" ? "danger" : ""}`}
                  onClick={() => void store.save()}
                >
                  <CheckCircle2 size={14} />
                  {store.status}
                </button>
                <button
                  className="icon-button"
                  aria-label="テーマ切替"
                  onClick={() =>
                    store.edit((d) => {
                      d.settings.theme =
                        document.documentElement.dataset.theme === "dark"
                          ? "light"
                          : "dark";
                    })
                  }
                >
                  <Moon size={18} />
                </button>
                <button onClick={() => setDialog("export")}>
                  <Download size={16} />
                  <span>エクスポート</span>
                </button>
                <button className="primary" onClick={() => setDialog("share")}>
                  <Share2 size={16} />
                  <span>共有する</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="brand">
                <span className="brand-icon">
                  <Coffee />
                </span>
                <span>
                  運営向け
                  <span className="brand-name-line">スケジュールメーカー</span>
                  <small>EVENT SCHEDULE MAKER</small>
                </span>
              </div>
              <button onClick={() => setDialog("help")}>使い方</button>
            </>
          )}
        </header>
        <main className="main-content">
          {!p ? (
            <>
              <div className="home-hero">
                <p className="eyebrow">A LITTLE ORDER, A LOT OF POSSIBILITY.</p>
                <h1>
                  複雑なイベント運営を、
                  <br />
                  <em>やさしく、わかりやすく。</em>
                </h1>
                <p>
                  人も、場所も、時間も。ひとつのタイムラインに。
                  <br />
                  みんなの「次はなに？」が、すっとわかるスケジュールをつくろう。
                </p>
                <div className="toolbar">
                  <button
                    className="primary large"
                    onClick={() => setDialog("new")}
                  >
                    <Plus size={18} />
                    イベントをつくる
                  </button>
                  <button className="large" onClick={() => void create(true)}>
                    <Coffee size={18} />
                    サンプルを試す
                  </button>
                </div>
                <div className="hero-art" aria-hidden="true">
                  <div className="art-card">
                    <span>こもれびフェス</span>
                    <div className="art-rule" />
                    <div className="art-bar one">オープニング</div>
                    <div className="art-bar two">コーヒーブレイク</div>
                    <div className="art-bar three">トークセッション</div>
                    <Coffee size={50} />
                  </div>
                  <span className="art-spark">✦</span>
                </div>
              </div>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">YOUR EVENTS</p>
                  <h2>
                    マイイベント <small>{store.projects.length}</small>
                  </h2>
                </div>
                <button onClick={() => setDialog("import")}>
                  <Upload size={16} />
                  JSON / ICSを読み込む
                </button>
              </div>
              <div className="project-grid">
                {[...store.projects]
                  .sort((a, b) =>
                    b.project.updatedAt.localeCompare(a.project.updatedAt),
                  )
                  .map((project, i) => (
                    <article className="project-card" key={project.project.id}>
                      <div className="project-card-top">
                        <span
                          style={{
                            background: ["#e3eddf", "#f4dfd7", "#e8e1f1"][
                              i % 3
                            ],
                          }}
                        >
                          <CalendarDays size={25} />
                        </span>
                        <small>{project.days.length} DAYS</small>
                      </div>
                      <button
                        className="project-open"
                        onClick={() => open(project.project.id)}
                      >
                        <h3>{project.project.name}</h3>
                        <p>
                          {project.days.map((d) => d.date).sort()[0] ||
                            "日付未設定"}{" "}
                          {project.days.length > 1 ? "〜" : ""}
                        </p>
                        <div className="project-counts">
                          <span>{project.venues.length} 会場</span>
                          <span>{project.people.length} 人物</span>
                          <span>{project.programs.length} プログラム</span>
                        </div>
                      </button>
                      <div className="project-actions">
                        <span>
                          更新{" "}
                          {stamp(
                            project.project.updatedAt,
                            project.project.timezone,
                          )}
                        </span>
                        <button
                          aria-label="名前変更"
                          title="名前変更"
                          onClick={() => {
                            setRename(project);
                            setName(project.project.name);
                          }}
                        >
                          名称
                        </button>
                        <button
                          className="icon-button"
                          title="複製"
                          onClick={async () => {
                            const copy = remap(project);
                            copy.project.name += "（コピー）";
                            try {
                              await store.add(copy);
                              setToast("複製しました");
                            } catch {}
                          }}
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          className="icon-button"
                          title="JSON出力"
                          onClick={() =>
                            download(
                              JSON.stringify(project, null, 2),
                              `${project.project.name}.json`,
                            )
                          }
                        >
                          <Download size={14} />
                        </button>
                        <button
                          className="icon-button danger"
                          title="削除"
                          onClick={() => setDeleteProject(project.project.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </article>
                  ))}
                <button
                  className="new-project-card"
                  onClick={() => setDialog("new")}
                >
                  <Plus size={26} />
                  <b>新しいイベント</b>
                  <span>次のわくわくを、ここから。</span>
                </button>
              </div>
              <p className="backup-note">
                <CheckCircle2 size={16} />
                アカウント不要・このブラウザに自動保存。大切な予定はJSONでもバックアップしましょう。
              </p>
            </>
          ) : (
            <>
              {view === "dashboard" && (
                <Dashboard p={p} onEdit={(id) => setEditor({ id })} />
              )}{" "}
              {(["people", "groups", "venues", "roles"] as string[]).includes(
                view,
              ) && <Masters key={view} p={p} kind={view as MasterKind} />}{" "}
              {view === "settings" && <Settings p={p} />}{" "}
              {["schedule", "programs", "progress"].includes(view) && (
                <>
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">
                        {view === "progress"
                          ? "ON THE DAY"
                          : "EVERY MOMENT, TOGETHER"}
                      </p>
                      <h1>
                        {view === "programs"
                          ? "プログラム一覧"
                          : view === "progress"
                            ? "今日の進行"
                            : "スケジュール"}{" "}
                        <span className="heading-dot">●</span>
                      </h1>
                      <p className="muted">
                        {view === "progress"
                          ? "いま、そして次のひとコマを。"
                          : "一日の流れを、ひと目で。みんなの動きを、ひとつに。"}
                      </p>
                    </div>
                    <div className="toolbar">
                      <button
                        className="icon-button"
                        title="取り消し (Ctrl+Z)"
                        disabled={!store.past.length}
                        onClick={store.undo}
                      >
                        <Undo2 size={17} />
                      </button>
                      <button
                        className="icon-button"
                        title="やり直し (Ctrl+Shift+Z)"
                        disabled={!store.future.length}
                        onClick={store.redo}
                      >
                        <Redo2 size={17} />
                      </button>
                      <button
                        className="primary"
                        onClick={() =>
                          setEditor({
                            initial: {
                              start: date
                                ? instant(`${date}T10:00`, p.project.timezone)
                                : undefined,
                              venueId: filter.venue,
                              personId: filter.person,
                              groupId: filter.group,
                            },
                          })
                        }
                      >
                        <Plus size={17} />
                        プログラム追加
                      </button>
                    </div>
                  </div>
                  <div className="schedule-topline">
                    <div className="date-tabs">
                      {[...p.days]
                        .sort((a, b) => a.date.localeCompare(b.date))
                        .map((d, i) => (
                          <button
                            className={date === d.date ? "active" : ""}
                            key={d.id}
                            onClick={() => setDate(d.date)}
                          >
                            <small>DAY {String(i + 1).padStart(2, "0")}</small>
                            {dayLabel(d.date)}
                          </button>
                        ))}
                      <button
                        className={!date ? "active" : ""}
                        onClick={() => setDate("")}
                      >
                        全日程
                      </button>
                      <button
                        title="日付を管理"
                        onClick={() => {
                          setDateInput(
                            date
                              ? addDays(date, 1)
                              : dateIn(
                                  new Date().toISOString(),
                                  p.project.timezone,
                                ),
                          );
                          setDialog("day");
                        }}
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                    <button
                      className="text-button small"
                      onClick={() =>
                        setDate(
                          dateIn(new Date().toISOString(), p.project.timezone),
                        )
                      }
                    >
                      今日へ
                    </button>
                  </div>
                  <div className="view-toolbar">
                    <div className="segmented">
                      {[
                        ["timeline", "タイムライン"],
                        ["list", "一覧"],
                        ["person", "人物別"],
                        ["role", "ロール別"],
                        ["venue", "会場別"],
                      ].map(([id, label]) => (
                        <button
                          className={scheduleMode === id ? "active" : ""}
                          key={id}
                          onClick={() => setScheduleMode(id)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <span className="muted small">
                      {filtered(p, actualFilter).length}件の予定{" "}
                      <span className="separator">/</span>
                      <button
                        className={
                          warningCount
                            ? "warning-text text-button"
                            : "text-button"
                        }
                        onClick={() => setView("dashboard")}
                      >
                        {warningCount}件の警告
                      </button>
                    </span>
                  </div>
                  <Filters p={p} value={filter} onChange={setFilter} />
                  <div className="preset-bar">
                    <select
                      aria-label="保存済みフィルター"
                      value=""
                      onChange={(e) => {
                        const preset = p.presets.find(
                          (x) => x.id === e.target.value,
                        );
                        if (preset) setFilter(preset.filter);
                      }}
                    >
                      <option value="">保存したフィルター</option>
                      {p.presets.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                    </select>
                    <input
                      aria-label="プリセット名"
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      placeholder="フィルター名"
                    />
                    <button
                      disabled={!presetName.trim()}
                      className="text-button"
                      onClick={() => {
                        store.edit((d) =>
                          d.presets.push({
                            id: uid(),
                            name: presetName,
                            filter,
                          }),
                        );
                        setPresetName("");
                        setToast("フィルターを保存しました");
                      }}
                    >
                      条件を保存
                    </button>
                    <button
                      className="text-button"
                      onClick={() => setDialog("import")}
                    >
                      JSON / ICS読込
                    </button>
                  </div>
                  {selected.length > 0 && (
                    <div className="selection-bar">
                      <b>{selected.length}件を選択中</b>
                      <button
                        onClick={() => {
                          setBatchAction("shift");
                          setDialog("batch");
                        }}
                      >
                        一括編集・コピー・時間調整
                      </button>
                      <button onClick={() => setSelected([])}>選択解除</button>
                    </div>
                  )}
                  {view === "progress" ? (
                    <Progress
                      p={p}
                      filter={actualFilter}
                      onEdit={(id) => setEditor({ id })}
                    />
                  ) : view === "schedule" && scheduleMode === "timeline" ? (
                    <>
                      <div className="desktop-timeline">
                        <Timeline
                          p={p}
                          date={date}
                          filter={actualFilter}
                          onEdit={(id) => setEditor({ id })}
                          onAdd={(initial) => setEditor({ initial })}
                          selected={selected}
                          onSelect={toggleSelected}
                        />
                      </div>
                      <div className="mobile-programs">
                        <ProgramList
                          p={p}
                          filter={actualFilter}
                          onEdit={(id) => setEditor({ id })}
                          selected={selected}
                          onSelect={toggleSelected}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      {scheduleMode === "person" && !filter.person && (
                        <p className="note">
                          上の人物フィルターで対象者を選ぶと、担当時間も表示されます。
                        </p>
                      )}
                      {scheduleMode === "role" && !filter.role && (
                        <p className="note">
                          上のロールフィルターで担当を選択してください。
                        </p>
                      )}
                      <ProgramList
                        p={p}
                        filter={actualFilter}
                        onEdit={(id) => setEditor({ id })}
                        selected={selected}
                        onSelect={toggleSelected}
                      />
                    </>
                  )}
                  <div className="schedule-footer">
                    <span>
                      <i className="legend-dot mint" />
                      運営・準備
                    </span>
                    <span>
                      <i className="legend-dot pink" />
                      ステージ
                    </span>
                    <span className="muted">
                      色は各プログラムで変更できます
                    </span>
                    <span className="footer-right">
                      ゆとりのある進行で、いい一日を。☕
                    </span>
                  </div>
                </>
              )}
            </>
          )}
        </main>
      </div>
      {store.error && (
        <div className="toast error" role="alert">
          <span>{store.error}</span>
          <button
            className="icon-button"
            aria-label="通知を閉じる"
            onClick={store.clearError}
          >
            <X size={17} />
          </button>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={17} />
          {toast}
        </div>
      )}
      {p && editor && (
        <ProgramEditor
          p={p}
          sessionId={editor.id}
          initial={editor.initial}
          onClose={() => setEditor(null)}
        />
      )}{" "}
      {p && dialog === "share" && (
        <ShareDialog
          p={p}
          filter={actualFilter}
          onClose={() => setDialog(null)}
        />
      )}{" "}
      {p && dialog === "export" && (
        <ExportDialog
          p={p}
          filter={actualFilter}
          onClose={() => setDialog(null)}
        />
      )}{" "}
      {dialog === "import" && (
        <ImportDialog p={p || undefined} onClose={() => setDialog(null)} />
      )}{" "}
      {dialog === "new" && (
        <Modal title="新しいイベントをつくる" onClose={() => setDialog(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
          >
            <Field label="イベント名">
              <input
                autoFocus
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例：こもれびフェス 2026"
              />
            </Field>
            <p className="note">
              保存先はこのブラウザです。タイムゾーンの初期設定はAsia/Tokyoです。
            </p>
            <footer>
              <button className="primary" type="submit">
                つくりはじめる
              </button>
            </footer>
          </form>
        </Modal>
      )}
      {rename && (
        <Modal title="イベント名を変更" onClose={() => setRename(null)}>
          <Field label="イベント名">
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <footer>
            <button
              disabled={!name.trim()}
              className="primary"
              onClick={async () => {
                try {
                  await store.add({
                    ...rename,
                    project: {
                      ...rename.project,
                      name,
                      updatedAt: new Date().toISOString(),
                    },
                  });
                  setRename(null);
                } catch {}
              }}
            >
              保存
            </button>
          </footer>
        </Modal>
      )}
      {deleteProject && (
        <Confirm
          title="プロジェクトを削除しますか？"
          onClose={() => setDeleteProject(null)}
          onConfirm={() => void store.remove(deleteProject)}
        >
          プロジェクトの全データを削除します。この操作は取り消せません。必要な場合は先にJSONを保存してください。
        </Confirm>
      )}
      {p && dialog === "day" && (
        <Modal title="日付を管理" onClose={() => setDialog(null)}>
          <Field label="操作">
            <select
              value={dayAction}
              onChange={(e) => setDayAction(e.target.value)}
            >
              <option value="add">日付を追加</option>
              <option value="copy">表示中の日の予定を別日にコピー</option>
              <option value="delete">表示中の日を削除</option>
            </select>
          </Field>
          {dayAction !== "delete" && (
            <Field label="日付">
              <input
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
              />
            </Field>
          )}
          {dayAction === "delete" && (
            <p className="warning">
              {date || "日付を選択してください"}
              に開始する実施枠と担当を削除します。前日から続く予定は残ります。
            </p>
          )}
          <footer>
            <button
              className="primary"
              disabled={dayAction === "delete" ? !date : !dateInput}
              onClick={() => {
                store.edit((d) => {
                  if (dayAction === "delete") {
                    d.sessions
                      .filter(
                        (s) => dateIn(s.start, d.project.timezone) === date,
                      )
                      .forEach((s) => deleteSession(d, s.id));
                    d.days = d.days.filter((x) => x.date !== date);
                  } else {
                    if (!d.days.some((x) => x.date === dateInput))
                      d.days.push({ id: uid(), date: dateInput });
                    if (dayAction === "copy" && date) {
                      [...d.sessions]
                        .filter(
                          (s) => dateIn(s.start, d.project.timezone) === date,
                        )
                        .forEach((s) =>
                          duplicateSession(
                            d,
                            s.id,
                            dateShiftMinutes(
                              s.start,
                              dateInput,
                              d.project.timezone,
                            ),
                          ),
                        );
                    }
                  }
                });
                setDate(dayAction === "delete" ? "" : dateInput);
                setDialog(null);
              }}
            >
              実行する
            </button>
          </footer>
        </Modal>
      )}
      {p && dialog === "batch" && (
        <BatchDialog
          p={p}
          selected={selected}
          initialAction={batchAction}
          onClose={() => setDialog(null)}
          onDone={() => {
            setSelected([]);
            setDialog(null);
          }}
        />
      )}
      {dialog === "help" && (
        <Modal
          title="運営向けスケジュールメーカーへようこそ"
          onClose={() => setDialog(null)}
        >
          <ol className="tutorial">
            <li>
              <b>イベントをつくる</b>
              <p>サンプルから試すこともできます。</p>
            </li>
            <li>
              <b>会場・人物・グループ・ロールを登録</b>
              <p>人物は複数のグループに所属できます。</p>
            </li>
            <li>
              <b>プログラムを追加</b>
              <p>
                担当時間を必要に応じて個別に設定。タイムラインの空白をダブルクリックして追加できます。
              </p>
            </li>
            <li>
              <b>確認して、共有する</b>
              <p>
                ダッシュボードで警告を確認し、共有範囲と項目を選んでリンクを作成します。
              </p>
            </li>
            <li>
              <b>JSONでバックアップ</b>
              <p>ブラウザの保存データは削除される可能性があります。</p>
            </li>
          </ol>
          <p className="note">
            Ctrl / ⌘ + S：保存 · Z：取り消し · Shift + Z：やり直し · F：検索 ·
            Escape：閉じる · Delete：選択した予定の削除確認
          </p>
        </Modal>
      )}
    </div>
  );
}
