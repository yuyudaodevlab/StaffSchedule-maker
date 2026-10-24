"use client";
import { useMemo, useState } from "react";
import { Project, statuses } from "@/lib/model";
import { BatchOptions, batchPreview } from "@/lib/editing";
import { stamp } from "@/lib/time";
import { useStore } from "@/stores/project-store";
import { Modal, Field } from "./ui";
export function BatchDialog({
  p,
  selected,
  initialAction = "shift",
  onClose,
  onDone,
}: {
  p: Project;
  selected: string[];
  initialAction?: BatchOptions["action"];
  onClose: () => void;
  onDone: () => void;
}) {
  const [options, setOptions] = useState<BatchOptions>({
    action: initialAction,
    minutes: 15,
    date: p.days[0]?.date || "",
    venueId: "",
    status: "未開始",
    personId: "",
    roleId: "",
    clearPeople: false,
  });
  const result = useMemo(() => {
    try {
      return { value: batchPreview(p, selected, options), error: "" };
    } catch (e) {
      return {
        value: null,
        error: e instanceof Error ? e.message : "入力を確認してください",
      };
    }
  }, [p, selected, options]);
  const edit = useStore((s) => s.replace);
  const copy = options.action === "copy" || options.action === "copyDay";
  return (
    <Modal title="一括編集・時間調整のプレビュー" onClose={onClose} wide>
      <Field label="操作">
        <select
          value={options.action}
          onChange={(e) =>
            setOptions({
              ...options,
              action: e.target.value as BatchOptions["action"],
            })
          }
        >
          <option value="shift">選択した予定を時間シフト</option>
          <option value="ripple">選択した予定以降をまとめてシフト</option>
          <option value="copy">指定分後に複製</option>
          <option value="copyDay">別日にコピー</option>
          <option value="moveDay">別日に移動</option>
          <option value="venue">会場を一括変更</option>
          <option value="status">ステータスを一括変更</option>
          <option value="assign">人物とロールを一括で追加割り当て</option>
          <option value="delete">選択した予定を削除</option>
        </select>
      </Field>
      {["shift", "ripple", "copy"].includes(options.action) && (
        <Field label="移動する分数（前倒しは負数）">
          <input
            type="number"
            value={options.minutes}
            onChange={(e) =>
              setOptions({ ...options, minutes: Number(e.target.value) })
            }
          />
        </Field>
      )}
      {["copyDay", "moveDay"].includes(options.action) && (
        <Field label="移動先の日付">
          <input
            type="date"
            value={options.date}
            onChange={(e) => setOptions({ ...options, date: e.target.value })}
          />
        </Field>
      )}
      {options.action === "venue" && (
        <Field label="変更後の会場">
          <select
            value={options.venueId}
            onChange={(e) =>
              setOptions({ ...options, venueId: e.target.value })
            }
          >
            <option value="">会場未割り当て</option>
            {p.venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      {options.action === "status" && (
        <Field label="変更後のステータス">
          <select
            value={options.status}
            onChange={(e) =>
              setOptions({
                ...options,
                status: e.target.value as typeof options.status,
              })
            }
          >
            {statuses.map((st) => (
              <option key={st}>{st}</option>
            ))}
          </select>
        </Field>
      )}
      {options.action === "assign" && (
        <div className="form-grid">
          <Field label="割り当てる人物">
            <select
              value={options.personId}
              onChange={(e) =>
                setOptions({
                  ...options,
                  personId: e.target.value,
                  roleId:
                    p.people.find((person) => person.id === e.target.value)
                      ?.roleIds[0] || "",
                })
              }
            >
              <option value="">選択してください</option>
              {p.people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="担当ロール">
            <select
              value={options.roleId}
              onChange={(e) =>
                setOptions({ ...options, roleId: e.target.value })
              }
            >
              <option value="">指定なし</option>
              {p.roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}
      {copy && (
        <label className="check">
          <input
            type="checkbox"
            checked={options.clearPeople}
            onChange={(e) =>
              setOptions({ ...options, clearPeople: e.target.checked })
            }
          />
          担当の割り当てを解除して複製
        </label>
      )}
      {options.action === "ripple" && (
        <p className="note">
          最初に選択した予定の開始時刻以降に始まる全会場の予定を移動します。変更対象と時刻を確認してください。
        </p>
      )}
      {result.error && <p className="error">{result.error}</p>}
      {result.value && (
        <div className="import-preview">
          {result.value.ids.map((id, i) => {
            const original = p.sessions.find((s) => s.id === id)!;
            const next = result.value!.project.sessions.find(
              (s) => s.id === (copy ? result.value!.changed[i] : id),
            );
            return (
              <p key={id}>
                <b>
                  {p.programs.find((pr) => pr.id === original.programId)?.name}
                </b>
                <span className="block">
                  {stamp(original.start, p.project.timezone)}〜
                  {stamp(original.end, p.project.timezone)} →{" "}
                  {next
                    ? `${stamp(next.start, p.project.timezone)}〜${stamp(next.end, p.project.timezone)}`
                    : "削除"}
                </span>
                {next && (
                  <small>
                    {result.value!.project.venues.find(
                      (v) => v.id === next.venueId,
                    )?.name || "会場未割り当て"}{" "}
                    / {next.status}
                    {options.action === "assign"
                      ? ` / 追加担当：${p.people.find((person) => person.id === options.personId)?.name} ${p.roles.find((r) => r.id === options.roleId)?.name || ""}`
                      : ""}
                  </small>
                )}
              </p>
            );
          })}
        </div>
      )}
      <footer>
        <button onClick={onClose}>キャンセル</button>
        <button
          className="primary"
          disabled={!result.value}
          onClick={() => {
            if (result.value && edit(result.value.project)) onDone();
          }}
        >
          プレビューを確認して適用
        </button>
      </footer>
    </Modal>
  );
}
