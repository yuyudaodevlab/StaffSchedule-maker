"use client";
import { Project, Filter, emptyFilter, statuses } from "@/lib/model";
import { Field } from "./ui";
import { Search, SlidersHorizontal, X } from "lucide-react";
export function Filters({
  p,
  value,
  onChange,
  compact = false,
}: {
  p: Project;
  value: Filter;
  onChange: (f: Filter) => void;
  compact?: boolean;
}) {
  return (
    <div className="filters">
      <div className="search-box">
        <Search size={17} />
        <input
          id="schedule-search"
          aria-label="予定を検索"
          value={value.query}
          onChange={(e) => onChange({ ...value, query: e.target.value })}
          placeholder="プログラム、人物、タグを検索…"
        />
        <kbd>⌘ F</kbd>
      </div>
      {(["venue", "group", "person", "role"] as const).map((key, i) => (
        <select
          key={key}
          aria-label={["会場", "グループ", "人物", "ロール"][i]}
          value={value[key]}
          onChange={(e) => onChange({ ...value, [key]: e.target.value })}
        >
          <option value="">
            すべての{["会場", "グループ", "人物", "ロール"][i]}
          </option>
          {p[(["venues", "groups", "people", "roles"] as const)[i]].map((x) => (
            <option value={x.id} key={x.id}>
              {x.name}
            </option>
          ))}
        </select>
      ))}
      <details className="filter-details">
        <summary>
          <SlidersHorizontal size={15} />
          詳細
        </summary>
        <div className="filter-popover">
            <Field label="プログラム"><select value={value.program} onChange={e=>onChange({...value,program:e.target.value})}><option value="">すべてのプログラム</option>{p.programs.map(pr=><option key={pr.id} value={pr.id}>{pr.name}</option>)}</select></Field>
          <Field label="ステータス">
            <select
              value={value.status}
              onChange={(e) => onChange({ ...value, status: e.target.value })}
            >
              <option value="">すべて</option>
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="タグ">
            <input
              value={value.tag}
              onChange={(e) => onChange({ ...value, tag: e.target.value })}
            />
          </Field>
          <Field label="開始以降">
            <input
              type="datetime-local"
              value={value.from}
              onChange={(e) => onChange({ ...value, from: e.target.value })}
            />
          </Field>
          <Field label="終了以前">
            <input
              type="datetime-local"
              value={value.to}
              onChange={(e) => onChange({ ...value, to: e.target.value })}
            />
          </Field>
          {!compact && (
            <label className="check">
              <input
                type="checkbox"
                checked={value.highlight}
                onChange={(e) =>
                  onChange({ ...value, highlight: e.target.checked })
                }
              />
              一致した予定を強調（タイムライン）
            </label>
          )}
          <button
            onClick={() => onChange({ ...emptyFilter(), date: value.date })}
          >
            <X size={14} />
            条件をクリア
          </button>
        </div>
      </details>
    </div>
  );
}
