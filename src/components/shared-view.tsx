"use client";
import { useState, useEffect } from "react";
import { Coffee, Download, Search, Upload } from "lucide-react";
import { ShareSnapshot, decodeSnapshot, parseSnapshot } from "@/lib/sharing";
import { SnapshotCards, SharedTimeline, ExportDialog } from "./sharing-ui";
import { Modal } from "./ui";
export function SharedView() {
  const [data, setData] = useState<ShareSnapshot | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [day, setDay] = useState("");
  const [view, setView] = useState("list");
  const [exportOpen, setExportOpen] = useState(false);
  const [detail, setDetail] = useState("");
  useEffect(() => {
    async function load() {
      const encoded = new URLSearchParams(location.hash.slice(1)).get("s");
      if (!encoded) {
        setLoading(false);
        return;
      }
      try {
        setData(await decodeSnapshot(encoded));
      } catch (e) {
        setError(e instanceof Error ? e.message : "共有データを読み込めません");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);
  const dateOf = (iso: string) =>
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: data?.timezone || "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  const shown = data
    ? {
        ...data,
        entries: data.entries.filter(
          (e) =>
            (!day ||
              (e.start &&
                e.end &&
                dateOf(e.start) <= day &&
                dateOf(e.end) >= day)) &&
            JSON.stringify(e)
              .normalize("NFKC")
              .toLowerCase()
              .includes(query.normalize("NFKC").toLowerCase()),
        ),
      }
    : null;
  return (
    <div className="shared-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-icon">
            <Coffee />
          </span>
          <span>
            こよみ喫茶<small>SHARED SCHEDULE</small>
          </span>
        </div>
        <span className="badge">閲覧専用</span>
      </header>
      <main className="shared-main">
        {loading ? (
          <p>スケジュールを読み込んでいます…</p>
        ) : data ? (
          <>
            <p className="eyebrow">A SCHEDULE, JUST FOR YOU</p>
            <h1>{data.name}</h1>
            <p className="snapshot-notice">
              このスケジュールは
              {new Intl.DateTimeFormat("ja-JP", {
                timeZone: data.timezone,
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "numeric",
              }).format(new Date(data.createdAt))}
              時点の情報です。
              <br />
              元のスケジュールの更新は自動反映されません。
            </p>
            <div className="toolbar shared-toolbar">
              <div className="search-box">
                <Search size={17} />
                <input
                  aria-label="共有予定を検索"
                  placeholder="予定・人物を検索"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <select
                aria-label="日付"
                value={day}
                onChange={(e) => setDay(e.target.value)}
              >
                <option value="">全日程</option>
                {[
                  ...new Set(
                    data.entries
                      .flatMap((e) => [
                        e.start ? dateOf(e.start) : "",
                        e.end ? dateOf(e.end) : "",
                      ])
                      .filter(Boolean),
                  ),
                ]
                  .sort()
                  .map((d) => (
                    <option key={d}>{d}</option>
                  ))}
              </select>
              <div className="segmented">
                <button
                  className={view === "list" ? "active" : ""}
                  onClick={() => setView("list")}
                >
                  一覧
                </button>
                <button
                  className={view === "timeline" ? "active" : ""}
                  onClick={() => setView("timeline")}
                >
                  タイムライン
                </button>
              </div>
              <button onClick={() => setExportOpen(true)}>
                <Download size={16} />
                ダウンロード・印刷
              </button>
            </div>
            {shown &&
              (view === "list" ? (
                <SnapshotCards data={shown} onDetail={setDetail} />
              ) : (
                <SharedTimeline data={shown} />
              ))}
            <p className="muted small">
              {data.timezone} ·
              リンクを知っている人が閲覧できるスナップショットです。
            </p>
          </>
        ) : (
          <>
            <h1>共有スケジュールを開く</h1>
            <p>共有リンクを開くか、受け取った共有用JSONを選んでください。</p>
          </>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <label className="button">
          <Upload size={15} />
          共有用JSONを開く
          <input
            className="sr-only"
            type="file"
            accept=".json"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                if (file.size > 2000000)
                  throw new Error("共有JSONは2MB以下にしてください");
                setData(parseSnapshot(await file.text()));
                setError("");
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : "共有用JSONではありません",
                );
              }
            }}
          />
        </label>
      </main>
      {exportOpen && shown && (
        <ExportDialog data={shown} onClose={() => setExportOpen(false)} />
      )}{" "}
      {detail && data && (
        <Modal title="プログラムの詳細" onClose={() => setDetail("")}>
          <SnapshotCards
            data={{
              ...data,
              entries: data.entries.filter((e) => e.id === detail),
            }}
          />
        </Modal>
      )}
    </div>
  );
}
