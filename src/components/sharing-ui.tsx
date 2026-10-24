"use client";
import { useState, useMemo } from "react";
import { Project, Filter, emptyFilter } from "@/lib/model";
import {
  ShareSnapshot,
  snapshot,
  shareFields,
  shareLabels,
  ShareField,
  encodeSnapshot,
} from "@/lib/sharing";
import { exportIcs } from "@/lib/ics";
import { download, renderImages, ImageOptions } from "@/lib/export";
import { subset, filtered } from "@/lib/project";
import { stamp } from "@/lib/time";
import { Modal, Field, Empty } from "./ui";
import { Filters } from "./filters";
import {
  Download,
  Copy,
  Link as LinkIcon,
  Printer,
  Image as ImageIcon,
} from "lucide-react";
export function SnapshotCards({
  data,
  query = "",
  onDetail,
}: {
  data: ShareSnapshot;
  query?: string;
  onDetail?: (id: string) => void;
}) {
  const entries = data.entries.filter((e) =>
    JSON.stringify(e)
      .normalize("NFKC")
      .toLowerCase()
      .includes(query.normalize("NFKC").toLowerCase()),
  );
  return (
    <div className="snapshot-cards">
      {entries.map((e) => (
        <article
          className="snapshot-card"
          key={e.id}
          style={{ borderLeftColor: e.color }}
        >
          {e.start && e.end && (
            <p className="snapshot-time">
              {stamp(e.start, data.timezone)} 〜 {stamp(e.end, data.timezone)}
            </p>
          )}
          <h3>
            {onDetail ? (
              <button className="text-button" onClick={() => onDetail(e.id)}>
                {e.name || "予定"}
              </button>
            ) : (
              e.name || "予定"
            )}
          </h3>
          {e.venue && <p>{e.venue}</p>}
          <div className="tags">
            {e.status && <span>{e.status}</span>}
            {e.tags?.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
          {e.people?.map((person, i) => (
            <p key={i}>
              {person.name}
              {person.role ? ` / ${person.role}` : ""}
              {person.start && person.end && (
                <small className="block">
                  担当 {stamp(person.start, data.timezone)} 〜{" "}
                  {stamp(person.end, data.timezone)}
                </small>
              )}
              {person.gather && (
                <small className="block">
                  集合 {stamp(person.gather, data.timezone)}
                </small>
              )}
            </p>
          ))}
          {e.groups?.length ? (
            <p className="small">グループ：{e.groups.join("・")}</p>
          ) : null}
          {e.roles?.length ? (
            <p className="small">ロール：{e.roles.join("・")}</p>
          ) : null}
          {(["gather", "prepare", "rehearsal", "cleanup"] as const).map(
            (k, i) =>
              e[k] && (
                <p className="small" key={k}>
                  {["集合", "準備", "リハーサル", "撤収終了"][i]}：
                  {stamp(e[k]!, data.timezone)}
                </p>
              ),
          )}
          {e.notes && <p className="public-note">{e.notes}</p>}
        </article>
      ))}
      {!entries.length && <Empty title="表示する予定はありません" />}
    </div>
  );
}
export function SharedTimeline({ data }: { data: ShareSnapshot }) {
  const entries = data.entries.filter((e) => e.start && e.end);
  if (!entries.length) return <Empty title="時刻が共有されていません" />;
  const start = Math.min(...entries.map((e) => Date.parse(e.start!))),
    end = Math.max(...entries.map((e) => Date.parse(e.end!)));
  return (
    <div className="shared-timeline">
      {entries.map((e) => (
        <div key={e.id}>
          <b>
            {e.name || "予定"}
            <small>{e.venue}</small>
          </b>
          <div>
            <span
              style={{
                left: `${((Date.parse(e.start!) - start) / (end - start)) * 100}%`,
                width: `${Math.max(1, ((Date.parse(e.end!) - Date.parse(e.start!)) / (end - start)) * 100)}%`,
                background: e.color,
              }}
            >
              {stamp(e.start!, data.timezone)}–{stamp(e.end!, data.timezone)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
export function ShareDialog({
  p,
  filter,
  onClose,
}: {
  p: Project;
  filter: Filter;
  onClose: () => void;
}) {
  const [f, setF] = useState(filter);
  const [fields, setFields] = useState<ShareField[]>([...shareFields]);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [preset, setPreset] = useState("カスタム");
  const [busy, setBusy] = useState(false);
  const data = useMemo(() => snapshot(p, f, fields), [p, f, fields]);
  const change = (next: Filter) => {
    setF(next);
    setLink("");
  };
  return (
    <Modal title="必要な予定だけ、おすそわけ。" onClose={onClose} wide>
      <p className="muted">
        作成時点のスケジュールを、閲覧専用のリンクで共有します。
      </p>
      <div className="form-grid">
        <Field label="共有プリセット">
          <select
            value={preset}
            onChange={(e) => {
              setPreset(e.target.value);
              setLink("");
              if (e.target.value === "全体公開用") {
                setF(emptyFilter());
                setFields(["name", "time", "venue", "notes", "status", "tags"]);
              } else {
                setFields([...shareFields]);
              }
            }}
          >
            {[
              "全体公開用",
              "登壇者向け",
              "スタッフ向け",
              "会場責任者向け",
              "カスタム",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="対象日">
          <select
            value={f.date}
            onChange={(e) => change({ ...f, date: e.target.value })}
          >
            <option value="">全日程</option>
            {p.days.map((d) => (
              <option key={d.id}>{d.date}</option>
            ))}
          </select>
        </Field>
      </div>
      {preset === "登壇者向け" && !f.person && (
        <p className="note">対象の人物を選択してください。</p>
      )}
      {preset === "スタッフ向け" && !f.role && (
        <p className="note">対象のロールを選択してください。</p>
      )}
      {preset === "会場責任者向け" && !f.venue && (
        <p className="note">対象の会場を選択してください。</p>
      )}
      <Filters p={p} value={f} onChange={change} compact />
      <h3>共有に含める情報</h3>
      <div className="chip-options">
        {shareFields.map((key) => (
          <label className="check" key={key}>
            <input
              type="checkbox"
              checked={fields.includes(key)}
              onChange={(e) => {
                setFields(
                  e.target.checked
                    ? [...fields, key]
                    : fields.filter((k) => k !== key),
                );
                setLink("");
              }}
            />
            {shareLabels[key]}
          </label>
        ))}
      </div>
      <p className="note">
        内部メモ・連絡先・人物の非公開情報は含まれません。リンクを知っている人は誰でも閲覧できます。元の変更は自動反映されず、期限設定や取り消しはできません。
      </p>
      <h3>
        閲覧者へのプレビュー <small>{data.entries.length}件</small>
      </h3>
      <div className="share-preview">
        <SnapshotCards data={data} />
      </div>
      {error && <p className="error">{error}</p>}
      {link && (
        <>
          <Field label="共有リンク">
            <textarea readOnly value={link} rows={3} />
          </Field>
          {link.length > 8000 && (
            <p className="warning">
              URLが長いため送信先で開けない可能性があります。共有用JSONをご利用ください。
            </p>
          )}
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setError("リンクをコピーしました");
              } catch {
                setError(
                  "自動コピーできません。リンク欄を選択してコピーしてください。",
                );
              }
            }}
          >
            <Copy size={16} />
            リンクをコピー
          </button>
        </>
      )}
      <footer>
        <button
          onClick={() =>
            download(JSON.stringify(data, null, 2), "共有スケジュール.json")
          }
        >
          共有用JSON
        </button>
        <button
          className="primary"
          disabled={
            busy ||
            (preset === "登壇者向け" && !f.person) ||
            (preset === "スタッフ向け" && !f.role) ||
            (preset === "会場責任者向け" && !f.venue)
          }
          onClick={async () => {
            setBusy(true);
            try {
              const encoded = await encodeSnapshot(data);
              setLink(
                `${location.origin}${process.env.NEXT_PUBLIC_BASE_PATH || ""}/share/#s=${encoded}`,
              );
              setError("");
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "共有リンクを作成できません",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <LinkIcon size={16} />
          {busy ? "作成中…" : "この内容でリンクを作成"}
        </button>
      </footer>
    </Modal>
  );
}
export function ExportDialog({
  p,
  filter,
  data: shared,
  onClose,
}: {
  p?: Project;
  filter?: Filter;
  data?: ShareSnapshot;
  onClose: () => void;
}) {
  const [f, setF] = useState(filter || emptyFilter());
  const [options, setOptions] = useState<ImageOptions>({
    scale: 2,
    fontSize: 15,
    background: "#fffaf3",
    title: true,
    notes: false,
    legend: true,
    padding: 28,
    width: 1400,
    tick:30, venue:true, date:true,
  });
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [paper, setPaper] = useState("A4");
  const [orientation, setOrientation] = useState("landscape");
  const data = useMemo(() => shared || snapshot(p!, f), [p, f, shared]);
  return (
    <Modal title="スケジュールを書き出す" onClose={onClose} wide>
      {p && (
        <>
          <Field label="対象日">
            <select
              value={f.date}
              onChange={(e) => {
                setF({ ...f, date: e.target.value });
                setImages([]);
              }}
            >
              <option value="">全日程</option>
              {p.days.map((d) => (
                <option key={d.id}>{d.date}</option>
              ))}
            </select>
          </Field>
          <Filters
            p={p}
            value={f}
            onChange={(value) => {
              setF(value);
              setImages([]);
            }}
            compact
          />
        </>
      )}
      <p>{data.entries.length}件の予定が出力対象です。</p>
      <div className="export-options">
        <button
          onClick={() => {
            const sessions = p ? filtered(p,f) : [];
            const d = {...data, entries:data.entries.map((entry,index)=>({...entry,id:p ? (sessions[index].icsUid || sessions[index].id+'@koyomi-kissa') : entry.id}))};
            download(
              exportIcs(d),
              "schedule.ics",
              "text/calendar;charset=utf-8",
            );
          }}
          disabled={!data.entries.some((e) => e.start && e.end)}
        >
          <Download />
          カレンダー (.ics)
        </button>
        {p && (
          <button
            onClick={() =>
              download(JSON.stringify(subset(p, f), null, 2), "schedule.json")
            }
          >
            <Download />
            対象範囲のJSON
          </button>
        )}
        {p && (
          <button
            onClick={() => download(JSON.stringify(p, null, 2), "backup.json")}
          >
            <Download />
            完全バックアップ
          </button>
        )}
        {shared && (
          <button
            onClick={() =>
              download(JSON.stringify(shared, null, 2), "共有スケジュール.json")
            }
          >
            <Download />
            共有用JSON
          </button>
        )}
      </div>
      <h3>PNG画像</h3>
      <div className="toolbar"><Field label="目盛りの最小単位"><select value={options.tick} onChange={e=>{setOptions({...options,tick:Number(e.target.value)});setImages([]);}}>{[1,5,10,15,30,60].map(t=><option key={t} value={t}>{t}分（重ならない間隔に自動調整）</option>)}</select></Field>{(["venue","date"] as const).map(key=><label className="check" key={key}><input type="checkbox" checked={options[key]} onChange={e=>{setOptions({...options,[key]:e.target.checked});setImages([]);}}/>{key==="venue"?"会場を表示":"日付を表示"}</label>)}</div>
      <p className="muted small">
        スクロール外も含めた全件を描画します。長い一覧は高さ4,000px以内に分割します。
      </p>
      <div className="form-grid three">
        <Field label="解像度">
          <select
            value={options.scale}
            onChange={(e) => {
              setOptions({ ...options, scale: Number(e.target.value) });
              setImages([]);
            }}
          >
            {[1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {n}倍
              </option>
            ))}
          </select>
        </Field>
        <Field label="画像の幅">
          <select
            value={options.width}
            onChange={(e) => {
              setOptions({ ...options, width: Number(e.target.value) });
              setImages([]);
            }}
          >
            {[1000, 1400, 2000].map((n) => (
              <option key={n} value={n}>
                {n}px
              </option>
            ))}
          </select>
        </Field>
        <Field label="文字サイズ">
          <input
            type="number"
            min="10"
            max="24"
            value={options.fontSize}
            onChange={(e) => {
              setOptions({ ...options, fontSize: Number(e.target.value) });
              setImages([]);
            }}
          />
        </Field>
        <Field label="背景色">
          <input
            type="color"
            value={options.background}
            onChange={(e) => {
              setOptions({ ...options, background: e.target.value });
              setImages([]);
            }}
          />
        </Field>
        <Field label="余白">
          <input
            type="number"
            min="10"
            max="80"
            value={options.padding}
            onChange={(e) => {
              setOptions({ ...options, padding: Number(e.target.value) });
              setImages([]);
            }}
          />
        </Field>
      </div>
      <div className="chip-options">
        {(["title", "notes", "legend"] as const).map((key, i) => (
          <label className="check" key={key}>
            <input
              type="checkbox"
              checked={options[key]}
              onChange={(e) => {
                setOptions({ ...options, [key]: e.target.checked });
                setImages([]);
              }}
            />
            {["タイトルを表示", "公開メモを表示", "凡例を表示"][i]}
          </label>
        ))}
      </div>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            setImages(await renderImages(data, options));
          } catch {
            setError(
              "画像を作成できませんでした。解像度や出力幅を小さくしてください。",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <ImageIcon size={16} />
        {busy ? "画像を作成中…" : "プレビューを作成"}
      </button>
      {images.length > 1 && (
        <p className="note">
          {images.length}枚に分割しました。各画像を確認して保存してください。
        </p>
      )}
      {images.map((url, i) => (
        <div key={i} className="image-preview">
          <img src={url} alt={`スケジュール出力プレビュー ${i + 1}`} />
          <a
            className="button primary"
            href={url}
            download={`schedule-${i + 1}.png`}
          >
            画像 {i + 1} を保存
          </a>
        </div>
      ))}
      {error && <p className="error">{error}</p>}
      <h3>印刷 / PDFとして保存</h3>
      <div className="toolbar">
        <select
          aria-label="用紙サイズ"
          value={paper}
          onChange={(e) => setPaper(e.target.value)}
        >
          <option>A4</option>
          <option>A3</option>
        </select>
        <select
          aria-label="用紙の向き"
          value={orientation}
          onChange={(e) => setOrientation(e.target.value)}
        >
          <option value="landscape">横向き</option>
          <option value="portrait">縦向き</option>
        </select>
        <button
          onClick={() => {
            document.documentElement.style.setProperty(
              "--print-margin",
              "12mm",
            );
            const style = document.createElement("style");
            style.textContent = `@media print { @page {size:${paper} ${orientation};margin:12mm;} }`;
            document.head.appendChild(style);
            window.print();
            setTimeout(() => style.remove(), 1000);
          }}
        >
          <Printer size={16} />
          印刷する
        </button>
      </div>
      <div className="print-content">
        <h1>{data.name}</h1>
        <SnapshotCards data={data} />
      </div>
    </Modal>
  );
}
