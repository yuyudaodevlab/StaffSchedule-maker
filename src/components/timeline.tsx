"use client";
import { useMemo, useRef, useState, useEffect, type PointerEvent } from "react";
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Plus,
  Minus,
  LocateFixed,
  ArrowLeftRight,
} from "lucide-react";
import { flushSync } from "react-dom";
import { Modal, Field } from "./ui";
import {
  captureTimeline,
  timelineRegions,
  type CaptureRegion,
} from "@/lib/timeline-image";
import { Project, Session, Filter } from "@/lib/model";
import {
  sorted,
  assignedPeople,
  matches,
  shiftSession,
  ensureDays,
  duplicateSession,
} from "@/lib/project";
import {
  dayBounds,
  displayDayBounds,
  clock,
  instant,
  dateIn,
  overlaps,
  mergeIntervals,
} from "@/lib/time";
import { conflicts } from "@/lib/conflicts";
import { useStore } from "@/stores/project-store";
import { InitialSlot } from "./program-editor";
type Row = {
  key: string;
  venueId: string;
  venue: string;
  groupId: string;
  group: string;
  personId: string;
  name: string;
  kind: "venue" | "group" | "person";
  sessions: Session[];
};
export function Timeline({
  p,
  date,
  filter,
  onEdit,
  onAdd,
  selected,
  onSelect,
}: {
  p: Project;
  date: string;
  filter: Filter;
  onEdit: (id: string) => void;
  onAdd: (initial: InitialSlot) => void;
  selected: string[];
  onSelect: (id: string) => void;
}) {
  const scroll = useRef<HTMLDivElement>(null);
  const [closed, setClosed] = useState<string[]>([]);
  const [context, setContext] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const [livePosition, setPosition] = useState({
    top: 0,
    left: 0,
    height: 650,
    width: 1000,
  });
  const [capture, setCapture] = useState<CaptureRegion | null>(null);
  const position = capture || livePosition;
  const [imageDialog, setImageDialog] = useState(false);
  const [imageScale, setImageScale] = useState(2);
  const [images, setImages] = useState<string[]>([]);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState("");
  const [imageProgress, setImageProgress] = useState("");

  useEffect(() => {
    const el = scroll.current;
    if (!el) return;
    const update = () =>
      setPosition({
        top: el.scrollTop,
        left: el.scrollLeft,
        height: el.clientHeight,
        width: el.clientWidth,
      });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    update();
    return () => observer.disconnect();
  }, []);
  const [now, setNow] = useState(Date.now());
  const [jump, setJump] = useState("12:00");
  const [drag, setDrag] = useState<{
    id: string;
    kind: "move" | "start" | "end";
    origin: number;
    delta: number;
  } | null>(null);
  const moved = useRef(false);
  const edit = useStore((s) => s.edit);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const vertical = p.settings.vertical;
  const rowHeight = p.settings.density === "compact" ? 44 : 62;
  const lane = vertical ? 170 : rowHeight;
  const zone = p.project.timezone;
  const bounds = useMemo(() => {
    if (date) return dayBounds(date, zone);
    if (!p.days.length)
      return dayBounds(dateIn(new Date().toISOString(), zone), zone);
    return [
      dayBounds(p.days.map((d) => d.date).sort()[0], zone)[0],
      dayBounds(
        p.days
          .map((d) => d.date)
          .sort()
          .at(-1)!,
        zone,
      )[1],
    ];
  }, [date, zone, p.days]);
  const [start, end] = useMemo(() => {
    if (!date) return bounds;
    const requested = displayDayBounds(
      date,
      p.settings.startHour,
      p.settings.endHour,
      zone,
    );
    const sessionIndex = new Map(p.sessions.map((s) => [s.id, s]));
    const intervals = [
      ...p.sessions.map((s) => [Date.parse(s.start), Date.parse(s.end)]),
      ...p.assignments.map((a) => {
        const s = sessionIndex.get(a.sessionId)!;
        return [Date.parse(a.start || s.start), Date.parse(a.end || s.end)];
      }),
    ].filter(([a, b]) => overlaps(a, b, bounds[0], bounds[1]));
    const earliest = Math.min(requested[0], ...intervals.map(([a]) => a));
    const latest = Math.max(requested[1], ...intervals.map(([, b]) => b));
    return [
      Math.max(bounds[0], Math.floor(earliest / 3600000) * 3600000),
      Math.min(bounds[1], Math.ceil(latest / 3600000) * 3600000),
    ];
  }, [
    date,
    bounds,
    p.sessions,
    p.assignments,
    p.settings.startHour,
    p.settings.endHour,
    zone,
  ]);
  const ppm = p.settings.zoom;
  const length = ((end - start) / 60000) * ppm;
  const warnings = useMemo(
    () => new Set(conflicts(p).flatMap((c) => c.sessionIds)),
    [p],
  );
  const assignmentIndex = useMemo(() => {
    const index = new Map<string, typeof p.assignments>();
    for (const a of p.assignments)
      index.set(a.sessionId, [...(index.get(a.sessionId) || []), a]);
    return index;
  }, [p.assignments]);
  const rows = useMemo(() => {
    const result: Row[] = [];
    const relevant = p.sessions.filter(
      (s) => filter.highlight || matches(p, s, { ...filter, date: "" }),
    );
    const venues = [...p.venues].sort((a, b) => a.order - b.order);
    if (relevant.some((s) => !s.venueId))
      venues.push({
        id: "",
        name: "会場未割り当て",
        description: "",
        color: "#ddd0bf",
        order: 999,
        notes: "",
        capacity: 1,
        availableStart: "",
        availableEnd: "",
      });
    for (const v of venues) {
      if (filter.venue && v.id !== filter.venue) continue;
      const sessions = relevant.filter(
        (s) =>
          (s.venueId === v.id &&
            overlaps(
              Date.parse(s.start),
              Date.parse(s.end),
              bounds[0],
              bounds[1],
            )) ||
          (s.venueId === v.id &&
            (assignmentIndex.get(s.id) || []).some(
              (a) =>
                a.sessionId === s.id &&
                overlaps(
                  Date.parse(a.start || s.start),
                  Date.parse(a.end || s.end),
                  bounds[0],
                  bounds[1],
                ),
            )),
      );
      result.push({
        key: `v-${v.id}`,
        venueId: v.id,
        venue: v.name,
        groupId: "",
        group: "",
        personId: "",
        name: "会場全体",
        kind: "venue",
        sessions,
      });
      if (closed.includes(`v-${v.id}`)) continue;
      const groups = [
        ...sorted(p.groups, p),
        {
          id: "",
          name: "所属なし",
          personIds: p.people
            .filter((x) => !p.groups.some((g) => g.personIds.includes(x.id)))
            .map((x) => x.id),
          representativeIds: [],
          order: 999,
          description: "",
          notes: "",
          color: "#ddd0bf",
        },
      ];
      for (const g of groups) {
        if (filter.group && g.id !== filter.group) continue;
        const people = sorted(
          p.people.filter(
            (x) =>
              g.personIds.includes(x.id) &&
              !p.settings.hiddenPeople.includes(x.id) &&
              (!filter.person || filter.person === x.id),
          ),
          p,
        );
        const groupSessions = sessions.filter((s) =>
          (assignmentIndex.get(s.id) || []).some(
            (a) =>
              a.sessionId === s.id &&
              ((a.groupId === g.id && g.id !== "") ||
                people.some((person) =>
                  assignedPeople(p, a).includes(person.id),
                )),
          ),
        );
        if (!groupSessions.length && !p.settings.showEmpty) continue;
        const key = `g-${v.id}-${g.id}`;
        result.push({
          key,
          venueId: v.id,
          venue: "",
          groupId: g.id,
          group: g.name,
          personId: "",
          name: "グループ全体",
          kind: "group",
          sessions: groupSessions.filter((s) =>
            (assignmentIndex.get(s.id) || []).some(
              (a) => a.sessionId === s.id && a.groupId === g.id,
            ),
          ),
        });
        if (closed.includes(key)) continue;
        for (const person of people) {
          const ps = sessions.filter((s) =>
            (assignmentIndex.get(s.id) || []).some(
              (a) =>
                a.sessionId === s.id &&
                assignedPeople(p, a).includes(person.id) &&
                (!filter.role || a.roleId === filter.role),
            ),
          );
          if (!ps.length && !p.settings.showEmpty) continue;
          result.push({
            key: `p-${v.id}-${g.id}-${person.id}`,
            venueId: v.id,
            venue: "",
            groupId: g.id,
            group: "",
            personId: person.id,
            name: person.displayName || person.name,
            kind: "person",
            sessions: ps,
          });
        }
      }
    }
    return result;
  }, [p, filter, closed, bounds, assignmentIndex]);
  const toggle = (key: string) =>
    setClosed(
      closed.includes(key) ? closed.filter((k) => k !== key) : [...closed, key],
    );
  const timeRange = (row: Row, s: Session) => {
    if (!row.personId) return [Date.parse(s.start), Date.parse(s.end)];
    const aa = (assignmentIndex.get(s.id) || []).filter(
      (a) =>
        a.sessionId === s.id && assignedPeople(p, a).includes(row.personId),
    );
    return [
      Math.min(...aa.map((a) => Date.parse(a.start || s.start))),
      Math.max(...aa.map((a) => Date.parse(a.end || s.end))),
    ];
  };
  const freeIntervals = (row: Row) => {
    const busy = mergeIntervals(
      row.sessions
        .filter((s) => s.status !== "中止")
        .map((s) => timeRange(row, s) as [number, number]),
    );
    const out: [number, number][] = [];
    let cursor = start;
    for (const [a, b] of busy) {
      if (b <= start || a >= end) continue;
      if (a > cursor) out.push([cursor, a]);
      cursor = Math.max(cursor, b);
    }
    if (cursor < end) out.push([cursor, end]);
    return out;
  };
  const pointerStart = (
    e: PointerEvent,
    id: string,
    kind: "move" | "start" | "end",
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    moved.current = false;
    setDrag({ id, kind, origin: vertical ? e.clientY : e.clientX, delta: 0 });
  };
  const pointerMove = (e: PointerEvent) => {
    if (!drag) return;
    const pixels = (vertical ? e.clientY : e.clientX) - drag.origin;
    if (Math.abs(pixels) > 4) moved.current = true;
    const delta = Math.round(pixels / ppm / p.settings.snap) * p.settings.snap;
    setDrag({ ...drag, delta });
  };
  const pointerEnd = () => {
    if (drag && drag.delta && moved.current) {
      edit((d) => {
        const s = d.sessions.find((s) => s.id === drag.id)!;
        if (drag.kind === "move") shiftSession(d, s.id, drag.delta);
        else {
          const candidate = new Date(
            Date.parse(s[drag.kind]) + drag.delta * 60000,
          ).toISOString();
          if (
            (drag.kind === "start" &&
              Date.parse(candidate) < Date.parse(s.end)) ||
            (drag.kind === "end" && Date.parse(candidate) > Date.parse(s.start))
          ) {
            s[drag.kind] = candidate;
            ensureDays(d, s);
          }
        }
      });
    }
    setDrag(null);
  };
  const go = (time: number) => {
    const offset = Math.max(0, ((time - start) / 60000) * ppm - 200);
    scroll.current?.scrollTo(
      vertical
        ? { top: offset, behavior: "smooth" }
        : { left: offset, behavior: "smooth" },
    );
  };
  let totalSize = 0;
  const layout = rows.map((row) => {
    const ends: number[] = [];
    const tracks = new Map<string, number>();
    for (const session of [...row.sessions].sort(
      (a, b) => timeRange(row, a)[0] - timeRange(row, b)[0],
    )) {
      const [start, end] = timeRange(row, session);
      let track = ends.findIndex((value) => value <= start);
      if (track < 0) track = ends.length;
      ends[track] = end;
      tracks.set(session.id, track);
    }
    const size = Math.max(1, ends.length) * lane;
    const offset = totalSize;
    totalSize += size;
    return { offset, size, tracks };
  });
  const viewportStart = vertical ? position.left : position.top;
  const found = layout.findIndex(
    (item) => item.offset + item.size >= viewportStart,
  );
  const first = Math.max(0, (found < 0 ? rows.length : found) - 2);
  let last = first;
  while (
    last < rows.length &&
    layout[last].offset <
      viewportStart + (vertical ? position.width : position.height) + lane * 3
  )
    last++;
  const visible = rows.slice(first, last);
  const timeOffset = vertical ? position.top : position.left;
  const firstTick = Math.max(
      0,
      Math.floor(timeOffset / (p.settings.tick * ppm)) - 3,
    ),
    lastTick = Math.min(
      Math.ceil((end - start) / 60000 / p.settings.tick),
      firstTick +
        Math.ceil(
          (vertical ? position.height : position.width) /
            (p.settings.tick * ppm),
        ) +
        8,
    );
  const ticks = Array.from(
    { length: Math.max(0, lastTick - firstTick + 1) },
    (_, i) => firstTick + i,
  );
  const exportTimeline = async () => {
    setImageBusy(true);
    setImageError("");
    setImages([]);
    try {
      await document.fonts.ready;
      const regions = timelineRegions(
        vertical ? 80 + totalSize : 360 + length,
        Math.max(300, vertical ? 90 + length : 44 + totalSize),
        vertical ? 80 : 360,
        vertical ? 90 : 44,
      );
      const output: string[] = [];
      for (const [index, region] of regions.entries()) {
        flushSync(() => {
          setCapture(region);
          setImageProgress(`${index + 1} / ${regions.length}枚`);
        });
        const canvas =
          scroll.current?.querySelector<HTMLElement>(".timeline-canvas");
        if (!canvas)
          throw new Error(
            "タイムラインが見つかりません。画面を開き直してください。",
          );
        output.push(
          await captureTimeline(canvas, region, vertical, imageScale),
        );
      }
      setImages(output);
    } catch (error) {
      setImageError(
        error instanceof Error
          ? error.message
          : "画像を作成できませんでした。解像度を下げて再度お試しください。",
      );
    } finally {
      setCapture(null);
      setImageBusy(false);
    }
  };
  return (
    <section className="timeline-shell">
      {imageDialog && (
        <Modal
          title="運営タイムラインを画像にする"
          wide
          onClose={() => {
            if (!imageBusy) {
              setImageDialog(false);
              setImages([]);
            }
          }}
        >
          <p>
            現在の色・目盛り・並び順・表示方向をそのまま画像にします。スクロール外も含みます。折りたたんだ行や非表示の人物は出力しません。
          </p>
          <p className="muted small">
            大きいタイムラインは見出しを繰り返して分割します。分割境界をまたぐ予定は隣の画像へ続きます。
          </p>
          <Field label="タイムライン画像の解像度">
            <select
              disabled={imageBusy}
              value={imageScale}
              onChange={(e) => {
                setImageScale(Number(e.target.value));
                setImages([]);
              }}
            >
              <option value={1}>1倍</option>
              <option value={2}>2倍（高画質）</option>
            </select>
          </Field>
          <button
            className="primary"
            disabled={imageBusy}
            onClick={exportTimeline}
          >
            {imageBusy
              ? `画像を作成中… ${imageProgress}`
              : "タイムライン画像をプレビュー"}
          </button>
          {imageError && <p role="alert">{imageError}</p>}
          <div className="image-preview">
            {images.map((url, index) => (
              <div key={index}>
                <p>
                  {index + 1} / {images.length}枚
                </p>
                <img src={url} alt={`運営タイムライン ${index + 1}枚目`} />
                <a
                  className="button"
                  href={url}
                  download={`運営タイムライン-${date || "全日程"}-${index + 1}.png`}
                >
                  PNGを保存（{index + 1}枚目）
                </a>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {context && (
        <>
          <button
            className="context-shade"
            aria-label="メニューを閉じる"
            onClick={() => setContext(null)}
          />
          <div
            className="context-menu"
            role="menu"
            style={{ left: context.x, top: context.y }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setContext(null);
            }}
          >
            <button
              role="menuitem"
              autoFocus
              onClick={() => {
                onEdit(context.id);
                setContext(null);
              }}
            >
              詳細・編集・削除
            </button>
            <button
              role="menuitem"
              onClick={() => {
                edit((d) => duplicateSession(d, context.id, 30));
                setContext(null);
              }}
            >
              30分後に複製
            </button>
            <button
              role="menuitem"
              onClick={() => {
                onSelect(context.id);
                setContext(null);
              }}
            >
              一括操作の対象にする
            </button>
          </div>
        </>
      )}
      <div className="timeline-tools">
        <div>
          <span className="live-dot" />
          運営タイムライン{" "}
          <span className="muted small">
            {rows.length}行 · {zone}
          </span>
        </div>
        <div className="toolbar">
          <button
            onClick={() => {
              setImageError("");
              setImageDialog(true);
            }}
          >
            画像にする
          </button>
          <button
            title="ズームアウト"
            className="icon-button"
            onClick={() =>
              edit((d) => {
                d.settings.zoom = Math.max(1, d.settings.zoom - 1);
              })
            }
          >
            <Minus size={16} />
          </button>
          <span className="small">{Math.round((ppm / 3) * 100)}%</span>
          <button
            title="ズームイン"
            className="icon-button"
            onClick={() =>
              edit((d) => {
                d.settings.zoom = Math.min(16, d.settings.zoom + 1);
              })
            }
          >
            <Plus size={16} />
          </button>
          <select
            aria-label="時間目盛り"
            value={p.settings.tick}
            onChange={(e) =>
              edit((d) => {
                d.settings.tick = Number(e.target.value);
              })
            }
          >
            {[1, 5, 10, 15, 30, 60].map((n) => (
              <option key={n} value={n}>
                {n}分目盛
              </option>
            ))}
          </select>
          <button onClick={() => go(now)}>
            <LocateFixed size={15} />
            現在
          </button>
          <input
            aria-label="移動する時刻"
            type="time"
            value={jump}
            onChange={(e) => setJump(e.target.value)}
          />
          <button
            onClick={() => {
              try {
                go(
                  Date.parse(
                    instant(`${date || p.days[0]?.date}T${jump}`, zone),
                  ),
                );
              } catch {}
            }}
          >
            移動
          </button>
          <button
            title="時間軸を反転"
            onClick={() =>
              edit((d) => {
                d.settings.vertical = !d.settings.vertical;
              })
            }
          >
            <ArrowLeftRight size={16} />
          </button>
        </div>
      </div>
      <div
        className={`timeline-scroll ${vertical ? "vertical" : ""}`}
        ref={scroll}
        onScroll={(e) => {
          const el = e.currentTarget;
          setPosition({
            top: el.scrollTop,
            left: el.scrollLeft,
            height: el.clientHeight,
            width: el.clientWidth,
          });
        }}
      >
        <div
          className="timeline-canvas"
          style={{
            width: vertical ? 80 + totalSize : 360 + length,
            height: vertical ? 90 + length : 44 + totalSize,
            minHeight: 300,
          }}
        >
          <div
            className="timeline-corner"
            style={{
              left: position.left,
              top: position.top,
              width: vertical ? 80 : 360,
              height: vertical ? 90 : 44,
            }}
          >
            {vertical ? (
              "時間"
            ) : (
              <>
                <span>会場</span>
                <span>グループ</span>
                <span>人物 / 対象</span>
              </>
            )}
          </div>
          <div
            className="time-ruler"
            style={
              vertical
                ? { width: 80, height: length, top: 90, left: position.left }
                : { width: length, height: 44, left: 360, top: position.top }
            }
          >
            {ticks.map((n) => (
              <span
                key={n}
                style={
                  vertical
                    ? { top: n * p.settings.tick * ppm }
                    : { left: n * p.settings.tick * ppm }
                }
              >
                {!date && (
                  <small>
                    {dateIn(
                      new Date(
                        start + n * p.settings.tick * 60000,
                      ).toISOString(),
                      zone,
                    ).slice(5)}{" "}
                  </small>
                )}
                {clock(start + n * p.settings.tick * 60000, zone)}
              </span>
            ))}
          </div>
          {visible.map((row, index) => {
            const i = first + index;
            return (
              <div key={row.key}>
                <div
                  className={`row-label ${row.kind}`}
                  style={
                    vertical
                      ? {
                          left: 80 + layout[i].offset,
                          top: position.top,
                          width: layout[i].size,
                          height: 90,
                        }
                      : {
                          top: 44 + layout[i].offset,
                          left: position.left,
                          width: 360,
                          height: layout[i].size,
                        }
                  }
                >
                  {row.kind === "venue" ? (
                    <>
                      <button
                        onClick={() => toggle(row.key)}
                        aria-label={`${row.venue}を折りたたむ`}
                      >
                        {closed.includes(row.key) ? (
                          <ChevronRight size={14} />
                        ) : (
                          <ChevronDown size={14} />
                        )}
                        <b>{row.venue}</b>
                      </button>
                      <span />
                      <span className="muted">全体</span>
                    </>
                  ) : row.kind === "group" ? (
                    <>
                      <span />
                      <button onClick={() => toggle(row.key)}>
                        {closed.includes(row.key) ? (
                          <ChevronRight size={14} />
                        ) : (
                          <ChevronDown size={14} />
                        )}
                        <b>{row.group}</b>
                      </button>
                      <span className="muted">全体</span>
                    </>
                  ) : (
                    <>
                      <span />
                      <span />
                      <span>
                        <i className="person-dot" />
                        {row.name}
                      </span>
                    </>
                  )}
                </div>
                <div
                  className={`timeline-lane ${row.kind}`}
                  style={
                    vertical
                      ? {
                          left: 80 + layout[i].offset,
                          top: 90,
                          width: layout[i].size,
                          height: length,
                          backgroundSize: `100% ${p.settings.tick * ppm}px`,
                        }
                      : {
                          left: 360,
                          top: 44 + layout[i].offset,
                          width: length,
                          height: layout[i].size,
                          backgroundSize: `${p.settings.tick * ppm}px 100%`,
                        }
                  }
                  onDoubleClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const offset = vertical
                      ? e.clientY - rect.top
                      : e.clientX - rect.left;
                    const t =
                      start +
                      Math.round(offset / ppm / p.settings.snap) *
                        p.settings.snap *
                        60000;
                    onAdd({
                      venueId: row.venueId,
                      personId: row.personId,
                      groupId: row.personId ? "" : row.groupId,
                      start: new Date(t).toISOString(),
                    });
                  }}
                >
                  {Array.from(
                    {
                      length:
                        Math.ceil(
                          (vertical ? position.height : position.width) /
                            (360 * ppm),
                        ) + 2,
                    },
                    (_, index) =>
                      index +
                      Math.max(0, Math.floor(timeOffset / (360 * ppm)) - 1),
                  ).map((n) => (
                    <span
                      className="time-period"
                      key={n}
                      style={
                        vertical
                          ? {
                              top: n * 360 * ppm,
                              height: Math.min(
                                360 * ppm,
                                length - n * 360 * ppm,
                              ),
                              width: "100%",
                              background: n % 2 ? "#e5dff025" : "#d7e7dc22",
                            }
                          : {
                              left: n * 360 * ppm,
                              width: Math.max(
                                0,
                                Math.min(360 * ppm, length - n * 360 * ppm),
                              ),
                              height: "100%",
                              background: n % 2 ? "#e5dff025" : "#d7e7dc22",
                            }
                      }
                    />
                  ))}
                  {p.settings.showFree &&
                    freeIntervals(row)
                      .filter(([a, b]) => ((b - a) / 60000) * ppm > 65)
                      .map(([a, b]) => (
                        <span
                          className="free-interval"
                          key={a}
                          style={
                            vertical
                              ? {
                                  top: ((a - start) / 60000) * ppm,
                                  height: ((b - a) / 60000) * ppm,
                                  width: "100%",
                                }
                              : {
                                  left: ((a - start) / 60000) * ppm,
                                  width: ((b - a) / 60000) * ppm,
                                  height: "100%",
                                }
                          }
                        >
                          空き {Math.round((b - a) / 60000)}分
                        </span>
                      ))}
                  {row.sessions.map((s) => {
                    const program = p.programs.find(
                      (pr) => pr.id === s.programId,
                    )!;
                    let [a, b] = timeRange(row, s);
                    if (drag?.id === s.id) {
                      if (drag.kind !== "end") a += drag.delta * 60000;
                      if (drag.kind !== "start") b += drag.delta * 60000;
                    }
                    if (!overlaps(a, b, start, end)) return null;
                    const x = ((Math.max(a, start) - start) / 60000) * ppm,
                      w =
                        ((Math.min(b, end) - Math.max(a, start)) / 60000) * ppm;
                    if (
                      x + w < timeOffset - 500 ||
                      x >
                        timeOffset +
                          (vertical ? position.height : position.width) +
                          500
                    )
                      return null;
                    const active = now >= a && now < b && s.status !== "中止";
                    return (
                      <button
                        key={s.id}
                        className={`schedule-bar ${active ? "running" : ""} ${selected.includes(s.id) ? "selected" : ""} ${filter.highlight && !matches(p, s, filter) ? "dimmed" : ""}`}
                        style={
                          vertical
                            ? {
                                top: x,
                                height: Math.max(w, 4),
                                left:
                                  5 + (layout[i].tracks.get(s.id) || 0) * lane,
                                width: lane - 14,
                                background: program.color,
                              }
                            : {
                                left: x,
                                width: Math.max(w, 4),
                                top:
                                  7 + (layout[i].tracks.get(s.id) || 0) * lane,
                                height: lane - 18,
                                background: program.color,
                              }
                        }
                        title={`${program.name} ${clock(a, zone)}–${clock(b, zone)}（ドラッグで企画の実施時間を移動）`}
                        onClick={(e) => {
                          if (moved.current) {
                            moved.current = false;
                            return;
                          }
                          if (e.ctrlKey || e.metaKey || e.shiftKey)
                            onSelect(s.id);
                          else onEdit(s.id);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setContext({
                            id: s.id,
                            x: Math.min(e.clientX, window.innerWidth - 230),
                            y: Math.min(e.clientY, window.innerHeight - 150),
                          });
                        }}
                        onPointerDown={(e) => pointerStart(e, s.id, "move")}
                        onPointerMove={pointerMove}
                        onPointerUp={pointerEnd}
                        onPointerCancel={() => setDrag(null)}
                      >
                        <span
                          className="resize-handle start"
                          onPointerDown={(e) => pointerStart(e, s.id, "start")}
                        />
                        <span className="bar-content">
                          {warnings.has(s.id) && <AlertTriangle size={12} />}
                          <b>{program.name}</b>
                          <small>
                            {clock(a, zone)} – {clock(b, zone)}
                          </small>
                        </span>
                        <span
                          className="resize-handle end"
                          onPointerDown={(e) => pointerStart(e, s.id, "end")}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {now >= start &&
            now < end &&
            (!date || dateIn(new Date(now).toISOString(), zone) === date) && (
              <div
                className="now-line"
                style={
                  vertical
                    ? {
                        top: 90 + ((now - start) / 60000) * ppm,
                        left: 80,
                        width: totalSize,
                        height: 2,
                      }
                    : {
                        left: 360 + ((now - start) / 60000) * ppm,
                        top: 44,
                        height: totalSize,
                        width: 2,
                      }
                }
              >
                <span>{clock(now, zone)}</span>
              </div>
            )}
        </div>
      </div>
      <div className="minimap">
        <span>全体マップ</span>
        <input
          aria-label="タイムライン全体の位置"
          type="range"
          min="0"
          max="100"
          value={Math.min(100, (timeOffset / Math.max(1, length)) * 100)}
          onChange={(e) => {
            const v = (Number(e.target.value) / 100) * length;
            scroll.current?.scrollTo(vertical ? { top: v } : { left: v });
          }}
        />
        <span>
          {drag
            ? `${drag.delta >= 0 ? "+" : ""}${drag.delta}分`
            : "空白をダブルクリックで追加 · Ctrl / ⌘ + クリックで複数選択"}
        </span>
      </div>
    </section>
  );
}
