"use client";
import { useState } from "react";
import { Project, Program, Session, Assignment, statuses } from "@/lib/model";
import { uid, instant, localInput } from "@/lib/time";
import {
  ensureDays,
  palette,
  deleteSession,
  duplicateSession,
} from "@/lib/project";
import { useStore } from "@/stores/project-store";
import { Modal, Field } from "./ui";
import { Plus, Trash2, Copy } from "lucide-react";
export type InitialSlot = {
  venueId?: string;
  personId?: string;
  groupId?: string;
  start?: string;
  end?: string;
};
export function ProgramEditor({
  p,
  sessionId,
  initial = {},
  onClose,
}: {
  p: Project;
  sessionId?: string;
  initial?: InitialSlot;
  onClose: () => void;
}) {
  const old = p.sessions.find((s) => s.id === sessionId);
  const zone = p.project.timezone;
  const start =
    initial.start ||
    instant(
      `${p.days[0]?.date || new Date().toISOString().slice(0, 10)}T10:00`,
      zone,
    );
  const [program, setProgram] = useState<Program>(() =>
    structuredClone(
      p.programs.find((x) => x.id === old?.programId) || {
        id: uid(),
        name: "",
        description: "",
        color: palette[0],
        tags: [],
        priority: "標準",
        publicNotes: "",
        internalNotes: "",
        url: "",
      },
    ),
  );
  const [session, setSession] = useState<Session>(() =>
    structuredClone(
      old || {
        id: uid(),
        programId: program.id,
        venueId: initial.venueId || p.venues[0]?.id || "",
        start,
        end: initial.end || new Date(Date.parse(start) + 1800000).toISOString(),
        status: "未開始",
        gather: "",
        prepare: "",
        rehearsal: "",
        cleanup: "",
        venuePrepare: "",
        transition: 0,
        allowOverlap: false,
        icsUid: "",
      },
    ),
  );
  const [assignments, setAssignments] = useState<Assignment[]>(() =>
    structuredClone(
      old
        ? p.assignments.filter((a) => a.sessionId === old.id)
        : initial.personId || initial.groupId
          ? [
              {
                id: uid(),
                sessionId: session.id,
                personId: initial.personId || "",
                groupId: initial.groupId || "",
                roleId: "",
                groupMode: "all",
                start: "",
                end: "",
                gather: "",
                notes: "",
              },
            ]
          : [],
    ),
  );
  const [error, setError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const edit = useStore((s) => s.edit);
  const setTime = (
    key:
      | "start"
      | "end"
      | "gather"
      | "prepare"
      | "rehearsal"
      | "cleanup"
      | "venuePrepare",
    value: string,
  ) => {
    try {
      setSession({ ...session, [key]: value ? instant(value, zone) : "" });
      setError("");
    } catch {
      setError(
        "日時が無効、または夏時間の切替で曖昧です。別の日時を選んでください。",
      );
    }
  };
  const save = () => {
    if (!program.name.trim()) {
      setError("プログラム名を入力してください");
      return;
    }
    if (Date.parse(session.start) >= Date.parse(session.end)) {
      setError("開始時刻は終了時刻より前に設定してください");
      return;
    }
    if (program.url && !/^https?:\/\//i.test(program.url)) {
      setError("関連URLはhttp/httpsで入力してください");
      return;
    }
    if (
      assignments.some(
        (a) =>
          Date.parse(a.start || session.start) >=
          Date.parse(a.end || session.end),
      )
    ) {
      setError("担当の終了時刻は開始時刻より後にしてください");
      return;
    }
    const saved = edit((d) => {
      const index = d.programs.findIndex((x) => x.id === program.id);
      if (index < 0) d.programs.push(program);
      else d.programs[index] = program;
      d.sessions = d.sessions.filter((s) => s.id !== session.id);
      d.sessions.push(session);
      d.assignments = d.assignments.filter((a) => a.sessionId !== session.id);
      d.assignments.push(
        ...assignments.filter((a) => a.personId || a.groupId || a.roleId),
      );
      ensureDays(d, session);
    });
    if (saved) onClose();
  };
  const updateAssignment = (id: string, patch: Partial<Assignment>) =>
    setAssignments(
      assignments.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    );
  return (
    <Modal
      title={old ? "プログラムを編集" : "プログラムを追加"}
      onClose={onClose}
      wide
      drawer
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="form-grid">
          <Field label="プログラム名 *">
            <input
              required
              autoFocus
              value={program.name}
              onChange={(e) => setProgram({ ...program, name: e.target.value })}
              placeholder="例：オープニングトーク"
            />
          </Field>
          <Field label="テンプレート">
            <select
              value=""
              onChange={(e) => {
                const t = p.templates.find((t) => t.id === e.target.value);
                if (t) {
                  setProgram({ ...program, name: t.name, color: t.color });
                  setSession({
                    ...session,
                    end: new Date(
                      Date.parse(session.start) + t.duration * 60000,
                    ).toISOString(),
                  });
                }
              }}
            >
              <option value="">テンプレートから入力</option>
              {p.templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={`開始日時 * (${zone})`}>
            <input
              type="datetime-local"
              required
              value={localInput(session.start, zone)}
              onChange={(e) => setTime("start", e.target.value)}
            />
          </Field>
          <Field label="終了日時 *">
            <input
              type="datetime-local"
              required
              value={localInput(session.end, zone)}
              onChange={(e) => setTime("end", e.target.value)}
            />
          </Field>
          <Field label="会場">
            <select
              value={session.venueId}
              onChange={(e) =>
                setSession({ ...session, venueId: e.target.value })
              }
            >
              <option value="">未割り当て</option>
              {p.venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="ステータス">
            <select
              value={session.status}
              onChange={(e) =>
                setSession({
                  ...session,
                  status: e.target.value as Session["status"],
                })
              }
            >
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
        </div>
        <h3>担当者・グループ</h3>
        <p className="muted small">
          担当時間が空欄の場合は、プログラムの時間を使用します。複数ロールは行を追加してください。
        </p>
        {assignments.map((a) => (
          <div className="assignment-card" key={a.id}>
            <div className="form-grid three">
              <Field label="人物">
                <select
                  value={a.personId}
                  onChange={(e) =>
                    updateAssignment(a.id, {
                      personId: e.target.value,
                      groupId: "",
                      roleId:
                        a.roleId ||
                        p.people.find((person) => person.id === e.target.value)
                          ?.roleIds[0] ||
                        "",
                    })
                  }
                >
                  <option value="">人物を選択</option>
                  {p.people.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="グループ">
                <select
                  value={a.groupId}
                  onChange={(e) =>
                    updateAssignment(a.id, {
                      groupId: e.target.value,
                      personId: "",
                    })
                  }
                >
                  <option value="">グループを選択</option>
                  {p.groups.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="担当ロール">
                <select
                  value={a.roleId}
                  onChange={(e) =>
                    updateAssignment(a.id, { roleId: e.target.value })
                  }
                >
                  <option value="">指定なし</option>
                  {p.roles.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </Field>
              {a.groupId && (
                <Field label="グループの参加対象">
                  <select
                    value={a.groupMode}
                    onChange={(e) =>
                      updateAssignment(a.id, {
                        groupMode: e.target.value as Assignment["groupMode"],
                      })
                    }
                  >
                    <option value="all">全員</option>
                    <option value="representatives">代表者のみ</option>
                  </select>
                </Field>
              )}
              {(["start", "end", "gather"] as const).map((k, i) => (
                <Field key={k} label={["担当開始", "担当終了", "集合"][i]}>
                  <input
                    type="datetime-local"
                    value={a[k] ? localInput(a[k], zone) : ""}
                    onChange={(e) => {
                      try {
                        updateAssignment(a.id, {
                          [k]: e.target.value
                            ? instant(e.target.value, zone)
                            : "",
                        });
                      } catch {
                        setError("担当日時が不正です");
                      }
                    }}
                  />
                </Field>
              ))}
            </div>
            <Field label="担当メモ（非公開）">
              <input
                value={a.notes}
                onChange={(e) =>
                  updateAssignment(a.id, { notes: e.target.value })
                }
              />
            </Field>
            <button
              type="button"
              className="text-button danger"
              onClick={() =>
                setAssignments(assignments.filter((x) => x.id !== a.id))
              }
            >
              <Trash2 size={14} />
              担当を外す
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setAssignments([
              ...assignments,
              {
                id: uid(),
                sessionId: session.id,
                personId: "",
                groupId: "",
                roleId: "",
                groupMode: "all",
                start: "",
                end: "",
                gather: "",
                notes: "",
              },
            ])
          }
        >
          <Plus size={16} />
          担当を追加
        </button>
        <details>
          <summary>運営情報・詳細設定</summary>
          <div className="form-grid">
            {(
              [
                "gather",
                "prepare",
                "rehearsal",
                "cleanup",
                "venuePrepare",
              ] as const
            ).map((k, i) => (
              <Field
                label={
                  [
                    "集合日時",
                    "準備開始",
                    "リハーサル",
                    "撤収終了",
                    "会場準備開始",
                  ][i]
                }
                key={k}
              >
                <input
                  type="datetime-local"
                  value={session[k] ? localInput(session[k], zone) : ""}
                  onChange={(e) => setTime(k, e.target.value)}
                />
              </Field>
            ))}
            <Field label="転換時間（分）">
              <input
                type="number"
                min="0"
                max="1440"
                value={session.transition}
                onChange={(e) =>
                  setSession({ ...session, transition: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="色">
              <input
                type="color"
                value={program.color}
                onChange={(e) =>
                  setProgram({ ...program, color: e.target.value })
                }
              />
            </Field>
            <Field label="優先度">
              <select
                value={program.priority}
                onChange={(e) =>
                  setProgram({
                    ...program,
                    priority: e.target.value as Program["priority"],
                  })
                }
              >
                {["低", "標準", "高"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field label="タグ（カンマ区切り）">
              <input
                value={program.tags.join(",")}
                onChange={(e) =>
                  setProgram({
                    ...program,
                    tags: e.target.value
                      .split(",")
                      .map((x) => x.trim())
                      .filter(Boolean),
                  })
                }
              />
            </Field>
            <Field label="関連URL">
              <input
                type="url"
                value={program.url}
                onChange={(e) =>
                  setProgram({ ...program, url: e.target.value })
                }
              />
            </Field>
          </div>
          <Field label="詳細説明">
            <textarea
              value={program.description}
              onChange={(e) =>
                setProgram({ ...program, description: e.target.value })
              }
            />
          </Field>
          <Field label="公開用メモ">
            <textarea
              value={program.publicNotes}
              onChange={(e) =>
                setProgram({ ...program, publicNotes: e.target.value })
              }
            />
          </Field>
          <Field label="内部用メモ（共有されません）">
            <textarea
              value={program.internalNotes}
              onChange={(e) =>
                setProgram({ ...program, internalNotes: e.target.value })
              }
            />
          </Field>
          <label className="check">
            <input
              type="checkbox"
              checked={session.allowOverlap}
              onChange={(e) =>
                setSession({ ...session, allowOverlap: e.target.checked })
              }
            />
            この実施枠の意図的な重複を許容する
          </label>
          {old && (
            <p className="note">
              同じ企画の別会場枠でも、名称・説明・メモ・色は共通です。時間と担当は各枠に保存されます。
            </p>
          )}
          <button
            type="button"
            disabled={
              !program.name.trim() ||
              Date.parse(session.end) <= Date.parse(session.start)
            }
            onClick={() => {
              edit((d) =>
                d.templates.push({
                  id: uid(),
                  name: program.name,
                  duration:
                    (Date.parse(session.end) - Date.parse(session.start)) /
                    60000,
                  color: program.color,
                }),
              );
              setError("テンプレートに保存しました");
            }}
          >
            この名前・時間・色をテンプレートに保存
          </button>
        </details>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <footer>
          {old && (
            <>
              <button
                type="button"
                className="danger"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 size={16} />
                削除
              </button>
              <button
                type="button"
                onClick={() => {
                  edit((d) => duplicateSession(d, old.id, 30));
                  onClose();
                }}
              >
                <Copy size={16} />
                複製
              </button>
              <button
                type="button"
                onClick={() => {
                  edit((d) => {
                    const s = { ...session, id: uid(), icsUid: "" };
                    d.sessions.push(s);
                    d.assignments.push(
                      ...assignments.map((a) => ({
                        ...a,
                        id: uid(),
                        sessionId: s.id,
                      })),
                    );
                  });
                  onClose();
                }}
              >
                別の実施枠を追加
              </button>
            </>
          )}
          <button type="submit" className="primary">
            {old ? "変更を保存" : "追加する"}
          </button>
        </footer>
        {deleteOpen && (
          <div className="confirm-inline">
            <p>この実施枠と担当情報を削除します。取り消しは可能です。</p>
            <button
              type="button"
              className="danger"
              onClick={() => {
                edit((d) => deleteSession(d, session.id));
                onClose();
              }}
            >
              削除を確定
            </button>
            <button type="button" onClick={() => setDeleteOpen(false)}>
              戻る
            </button>
          </div>
        )}
      </form>
    </Modal>
  );
}
