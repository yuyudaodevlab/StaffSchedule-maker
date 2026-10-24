"use client";
import { useState, useEffect } from "react";
import { Project, Filter, statuses, emptyFilter } from "@/lib/model";
import { filtered, sessionPeople } from "@/lib/project";
import { stamp, clock, uid, instant } from "@/lib/time";
import { conflicts, personStats, freeSlots } from "@/lib/conflicts";
import { useStore } from "@/stores/project-store";
import { Field, Empty } from "./ui";
import {
  AlertTriangle,
  CalendarDays,
  MapPin,
  Users,
  Coffee,
} from "lucide-react";
export function ProgramList({
  p,
  filter,
  onEdit,
  selected = [],
  onSelect,
}: {
  p: Project;
  filter: Filter;
  onEdit: (id: string) => void;
  selected?: string[];
  onSelect?: (id: string) => void;
}) {
  const sessions = filtered(p, filter);
  return (
    <div className="program-list">
      {sessions.map((s) => {
        const pr = p.programs.find((pr) => pr.id === s.programId)!;
        return (
          <article
            className="program-card"
            key={s.id}
            style={{ borderLeftColor: pr.color }}
          >
            {onSelect && (
              <input
                type="checkbox"
                aria-label={`${pr.name}を選択`}
                checked={selected.includes(s.id)}
                onChange={() => onSelect(s.id)}
              />
            )}
            <button className="program-card-main" onClick={() => onEdit(s.id)}>
              <div className="program-time">
                {stamp(s.start, p.project.timezone)}
                <span>〜 {stamp(s.end, p.project.timezone)}</span>
              </div>
              <div>
                <h3>{pr.name}</h3>
                <p>
                  <MapPin size={13} />
                  {p.venues.find((v) => v.id === s.venueId)?.name ||
                    "会場未割り当て"}{" "}
                  <span>·</span>{" "}
                  {sessionPeople(p, s)
                    .map(
                      (id) =>
                        p.people.find((x) => x.id === id)?.displayName ||
                        p.people.find((x) => x.id === id)?.name,
                    )
                    .join("・") || "担当未割り当て"}
                </p>
                <div className="tags">
                  {[
                    ...new Set(
                      p.assignments
                        .filter((a) => a.sessionId === s.id)
                        .map(
                          (a) => p.roles.find((r) => r.id === a.roleId)?.name,
                        ),
                    ),
                  ]
                    .filter(Boolean)
                    .map((r) => (
                      <span key={r}>{r}</span>
                    ))}
                  {pr.tags.map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </div>
                {s.gather && (
                  <small>集合 {stamp(s.gather, p.project.timezone)}　</small>
                )}
                {s.prepare && (
                  <small>準備 {stamp(s.prepare, p.project.timezone)}</small>
                )}
                {filter.person &&
                  p.assignments
                    .filter(
                      (a) =>
                        a.sessionId === s.id &&
                        (a.personId === filter.person ||
                          p.groups
                            .find((g) => g.id === a.groupId)
                            ?.personIds.includes(filter.person)),
                    )
                    .map((a) => (
                      <small className="block" key={a.id}>
                        担当 {stamp(a.start || s.start, p.project.timezone)} 〜{" "}
                        {stamp(a.end || s.end, p.project.timezone)}
                        {a.gather
                          ? ` / 集合 ${stamp(a.gather, p.project.timezone)}`
                          : ""}
                      </small>
                    ))}
              </div>
              <span className={`badge status-${s.status}`}>{s.status}</span>
            </button>
          </article>
        );
      })}
      {!sessions.length && (
        <Empty title="この条件の予定はありません">
          フィルターを変更するか、新しいプログラムを追加してください。
        </Empty>
      )}
    </div>
  );
}
export function Dashboard({
  p,
  onEdit,
}: {
  p: Project;
  onEdit: (id: string) => void;
}) {
  const warnings = conflicts(p);
  const points = p.sessions
    .flatMap((s) => [
      { time: Date.parse(s.start), delta: 1 },
      { time: Date.parse(s.end), delta: -1 },
    ])
    .sort((a, b) => a.time - b.time || a.delta - b.delta);
  let count = 0,
    peak = 0,
    peakAt = 0;
  for (const point of points) {
    count += point.delta;
    if (count > peak) {
      peak = count;
      peakAt = point.time;
    }
  }
  const [freeQuery, setFreeQuery] = useState({
    start: `${p.days[0]?.date}T09:00`,
    end: `${p.days[0]?.date}T18:00`,
    minutes: 30,
    kind: "people" as "people" | "venues",
  });
  const [result, setResult] = useState<ReturnType<typeof freeSlots> | null>(
    null,
  );
  const [error, setError] = useState("");
  return (
    <>
      <div className="welcome-banner">
        <div>
          <p className="eyebrow">LET'S MAKE A LOVELY EVENT</p>
          <h2>今日も、いい一日をつくろう。</h2>
          <p>
            {p.project.description ||
              "ひとつひとつの予定が、素敵なイベントにつながります。"}
          </p>
        </div>
        <Coffee size={72} strokeWidth={1} />
      </div>
      <div className="stats-grid">
        {[
          [CalendarDays, "プログラム", p.programs.length],
          [MapPin, "会場", p.venues.length],
          [Users, "参加メンバー", p.people.length],
          [AlertTriangle, "重複・時間の警告", warnings.length],
        ].map(([Icon, label, n]) => {
          const I = Icon as typeof Users;
          return (
            <div className="stat-card" key={String(label)}>
              <I size={21} />
              <span>{String(label)}</span>
              <strong>
                {String(n)}
                <small> 件</small>
              </strong>
            </div>
          );
        })}
      </div>
      <div className="section-heading">
        <h3>運営チェック</h3>
        <span className="muted">
          {p.groups.length}グループ · {p.roles.length}ロール
          {peakAt
            ? ` · 最も多い時間 ${clock(peakAt, p.project.timezone)}（${peak}枠）`
            : ""}
        </span>
      </div>
      {warnings.length ? (
        <div className="warning-list">
          {warnings.map((c) => (
            <button key={c.id} onClick={() => onEdit(c.sessionIds[0])}>
              <AlertTriangle size={18} />
              <span>
                <b>
                  {c.target}：{c.reason}
                </b>
                <small>
                  {clock(c.start, p.project.timezone)}–
                  {clock(c.end, p.project.timezone)} / {c.suggestion}
                </small>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="success">重複や移動時間の不足は見つかりませんでした。</p>
      )}
      <h3>
        人物ごとの拘束時間{" "}
        <small className="muted">参考値・重複時間は二重加算しません</small>
      </h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>人物</th>
              <th>総拘束</th>
              <th>空き時間</th>
              <th>最初 / 最後</th>
            </tr>
          </thead>
          <tbody>
            {p.people.map((person) => {
              const st = personStats(p, person.id);
              return (
                <tr key={person.id}>
                  <td>{person.name}</td>
                  <td>{st.total}分</td>
                  <td>{st.free}分</td>
                  <td>
                    {st.first
                      ? `${stamp(new Date(st.first).toISOString(), p.project.timezone)} / ${stamp(new Date(st.last!).toISOString(), p.project.timezone)}`
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <h3>空き時間を探す</h3>
      <div className="toolbar">
        <select
          aria-label="検索対象"
          value={freeQuery.kind}
          onChange={(e) =>
            setFreeQuery({
              ...freeQuery,
              kind: e.target.value as "people" | "venues",
            })
          }
        >
          <option value="people">人物</option>
          <option value="venues">会場</option>
        </select>
        <input
          aria-label="開始"
          type="datetime-local"
          value={freeQuery.start}
          onChange={(e) =>
            setFreeQuery({ ...freeQuery, start: e.target.value })
          }
        />
        <input
          aria-label="終了"
          type="datetime-local"
          value={freeQuery.end}
          onChange={(e) => setFreeQuery({ ...freeQuery, end: e.target.value })}
        />
        <input
          aria-label="必要な空き時間（分）"
          type="number"
          min="1"
          value={freeQuery.minutes}
          onChange={(e) =>
            setFreeQuery({ ...freeQuery, minutes: Number(e.target.value) })
          }
        />
        <button
          onClick={() => {
            try {
              const a = Date.parse(
                  instant(freeQuery.start, p.project.timezone),
                ),
                b = Date.parse(instant(freeQuery.end, p.project.timezone));
              if (a >= b || freeQuery.minutes <= 0) throw new Error();
              setResult(freeSlots(p, freeQuery.kind, a, b, freeQuery.minutes));
              setError("");
            } catch {
              setError("有効な時間範囲と所要時間を入力してください");
            }
          }}
        >
          検索
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {result && (
        <div className="note">
          {result.length
            ? result.map((r) => (
                <p key={r.entity.id}>
                  <b>{r.entity.name}</b>{" "}
                  {r.free
                    .map(
                      ([a, b]) =>
                        `${clock(a, p.project.timezone)}〜${clock(b, p.project.timezone)}`,
                    )
                    .join(" / ")}
                </p>
              ))
            : "条件に合う空き時間はありません。"}
        </div>
      )}
    </>
  );
}
export function Progress({
  p,
  filter,
  onEdit,
}: {
  p: Project;
  filter: Filter;
  onEdit: (id: string) => void;
}) {
  const [now, setNow] = useState(Date.now());
  const edit = useStore((s) => s.edit);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const sessions = filtered(p, filter).filter((s) => s.status !== "中止");
  const running = sessions.filter(
    (s) => Date.parse(s.start) <= now && now < Date.parse(s.end),
  );
  const next = sessions.filter((s) => Date.parse(s.start) > now).slice(0, 3);
  return (
    <div className="progress-mode">
      <div className="progress-clock">
        {clock(now, p.project.timezone)}
        <span>現在時刻 · {p.project.timezone}</span>
      </div>
      {[
        ["NOW", running],
        ["NEXT", next],
      ].map(([label, items]) => (
        <section key={String(label)}>
          <h2>
            {String(label)}{" "}
            <small>
              {label === "NOW" ? "いま、進行中" : "つぎのプログラム"}
            </small>
          </h2>
          {(items as typeof sessions).map((s) => (
            <article className="progress-card" key={s.id}>
              <button className="text-button" onClick={() => onEdit(s.id)}>
                <h2>{p.programs.find((pr) => pr.id === s.programId)?.name}</h2>
              </button>
              <p>
                {p.venues.find((v) => v.id === s.venueId)?.name} ·{" "}
                {clock(s.start, p.project.timezone)}–
                {clock(s.end, p.project.timezone)}
              </p>
              <p>
                {sessionPeople(p, s)
                  .map(
                    (id) => p.people.find((person) => person.id === id)?.name,
                  )
                  .join("・")}
              </p>
              <strong>
                {label === "NOW"
                  ? `予定終了まで ${Math.max(0, Math.ceil((Date.parse(s.end) - now) / 60000))}分`
                  : `開始まで ${Math.ceil((Date.parse(s.start) - now) / 60000)}分`}
              </strong>
              <Field label="手動ステータス">
                <select
                  value={s.status}
                  onChange={(e) =>
                    edit((d) => {
                      d.sessions.find((x) => x.id === s.id)!.status = e.target
                        .value as typeof s.status;
                    })
                  }
                >
                  {statuses.map((st) => (
                    <option key={st}>{st}</option>
                  ))}
                </select>
              </Field>
            </article>
          ))}
          {!(items as typeof sessions).length && (
            <p className="muted">該当する予定はありません</p>
          )}
        </section>
      ))}
      <h3>予定時刻を過ぎた未完了の枠</h3>
      {sessions
        .filter((s) => Date.parse(s.end) < now && s.status !== "完了")
        .map((s) => (
          <button key={s.id} onClick={() => onEdit(s.id)}>
            {p.programs.find((pr) => pr.id === s.programId)?.name} · {s.status}
          </button>
        ))}
      <p className="note">
        NOW /
        NEXTは予定時刻から計算しています。手動ステータスは自動変更されません。完了：
        {sessions.filter((s) => s.status === "完了").length} / {sessions.length}
      </p>
    </div>
  );
}
export function Settings({ p }: { p: Project }) {
  const edit = useStore((s) => s.edit);
  const [name, setName] = useState("");
  return (
    <>
      <p className="eyebrow">MAKE IT YOURS</p>
      <h2>イベントと表示の設定</h2>
      <div className="settings-panel">
        <div className="form-grid">
          <Field label="イベント名">
            <input
              value={p.project.name}
              onChange={(e) =>
                edit((d) => {
                  d.project.name = e.target.value;
                })
              }
            />
          </Field>
          <Field label="タイムゾーン">
            <select
              value={p.project.timezone}
              onChange={(e) =>
                edit((d) => {
                  d.project.timezone = e.target.value;
                })
              }
            >
              {[
                ...new Set([
                  p.project.timezone,
                  "Asia/Tokyo",
                  "UTC",
                  "Asia/Seoul",
                  "Asia/Shanghai",
                  "Europe/London",
                  "Europe/Paris",
                  "America/New_York",
                  "America/Los_Angeles",
                  "Australia/Sydney",
                ]),
              ].map((z) => (
                <option key={z}>{z}</option>
              ))}
            </select>
          </Field>
          <Field label="テーマ">
            <select
              value={p.settings.theme}
              onChange={(e) =>
                edit((d) => {
                  d.settings.theme = e.target.value as typeof d.settings.theme;
                })
              }
            >
              <option value="light">ライト</option>
              <option value="dark">ダーク</option>
              <option value="system">OSに合わせる</option>
            </select>
          </Field>
          <Field label="グループ・人物の並び順">
            <select
              value={p.settings.sort}
              onChange={(e) =>
                edit((d) => {
                  d.settings.sort = e.target.value as typeof d.settings.sort;
                })
              }
            >
              <option value="asc">名前の昇順</option>
              <option value="desc">名前の降順</option>
              <option value="manual">手動（管理画面の矢印で変更）</option>
            </select>
          </Field>
          {(
            [
              "snap",
              "startHour",
              "endHour",
              "travelMinutes",
              "gapMinutes",
            ] as const
          ).map((key, i) => (
            <Field
              key={key}
              label={
                [
                  "ドラッグのスナップ（分）",
                  "表示開始（時）",
                  "表示終了（時）",
                  "会場間の移動時間（分）",
                  "予定間に必要な時間（分）",
                ][i]
              }
            >
              <input
                type="number"
                value={p.settings[key]}
                min={key === "snap" ? 1 : 0}
                max={key === "snap" ? 60 : key.includes("Hour") ? 24 : 240}
                onChange={(e) =>
                  edit((d) => {
                    d.settings[key] = Number(e.target.value);
                  })
                }
              />
            </Field>
          ))}
          <Field label="タイムライン密度">
            <select
              value={p.settings.density}
              onChange={(e) =>
                edit((d) => {
                  d.settings.density = e.target
                    .value as typeof d.settings.density;
                })
              }
            >
              <option value="normal">ゆったり</option>
              <option value="compact">コンパクト</option>
            </select>
          </Field>
        </div>
        <Field label="イベントの説明">
          <textarea
            value={p.project.description}
            onChange={(e) =>
              edit((d) => {
                d.project.description = e.target.value;
              })
            }
          />
        </Field>
        <label className="check">
          <input
            type="checkbox"
            checked={p.settings.showEmpty}
            onChange={(e) =>
              edit((d) => {
                d.settings.showEmpty = e.target.checked;
              })
            }
          />
          予定のないグループ・人物も表示
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={p.settings.vertical}
            onChange={(e) =>
              edit((d) => {
                d.settings.vertical = e.target.checked;
              })
            }
          />
          時間を縦軸にする
        </label>
        <h3>タイムラインに表示する人物</h3>
        <div className="chip-options">
          {p.people.map((person) => (
            <label className="check" key={person.id}>
              <input
                type="checkbox"
                checked={!p.settings.hiddenPeople.includes(person.id)}
                onChange={(e) =>
                  edit((d) => {
                    d.settings.hiddenPeople = e.target.checked
                      ? d.settings.hiddenPeople.filter((id) => id !== person.id)
                      : [...d.settings.hiddenPeople, person.id];
                  })
                }
              />
              {person.name}
            </label>
          ))}
        </div>
        <h3>プログラムテンプレート</h3>
        <div className="tags">
          {p.templates.map((t) => (
            <button
              key={t.id}
              onClick={() =>
                edit((d) => {
                  d.templates = d.templates.filter((x) => x.id !== t.id);
                })
              }
              title="削除"
            >
              {t.name} · {t.duration}分 ×
            </button>
          ))}
        </div>
        <div className="toolbar">
          <input
            aria-label="テンプレート名"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="新しいテンプレート名"
          />
          <button
            disabled={!name.trim()}
            onClick={() => {
              edit((d) =>
                d.templates.push({
                  id: uid(),
                  name,
                  duration: 30,
                  color: "#c7decf",
                }),
              );
              setName("");
            }}
          >
            30分のテンプレートを追加
          </button>
        </div>
        <p className="note">
          保存データはこのブラウザ内に保管されます。ブラウザのデータ削除に備えて、定期的にJSONバックアップを保存してください。
        </p>
      </div>
    </>
  );
}
