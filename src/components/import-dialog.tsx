"use client";
import { useState } from "react";
import { Project, parseProject } from "@/lib/model";
import { parseIcs, applyIcs, IcsImport } from "@/lib/ics";
import { remap, mergeProjects } from "@/lib/project";
import { useStore } from "@/stores/project-store";
import { Modal, Field } from "./ui";
export function ImportDialog({
  p,
  onClose,
}: {
  p?: Project;
  onClose: () => void;
}) {
  const [parsed, setParsed] = useState<Project | null>(null);
  const [ics, setIcs] = useState<IcsImport | null>(null);
  const [mode, setMode] = useState("new");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState(p?.project.id || "");
  const store = useStore();
  async function read(file?: File) {
    if (!file) return;
    setError("");
    setParsed(null);
    setIcs(null);
    if (file.size > 10000000) {
      setError("ファイルは10MB以下にしてください");
      return;
    }
    try {
      const text = await file.text();
      if (file.name.toLowerCase().endsWith(".ics")) {
        const project =
          store.projects.find((x) => x.project.id === target) || p;
        if (!project)
          throw new Error(
            "ICSの登録先プロジェクトを選んでからファイルを開いてください",
          );
        setIcs(
          parseIcs(
            text,
            project.project.timezone,
            project.sessions.map((s) => s.icsUid),
          ),
        );
        setMode("merge");
      } else setParsed(parseProject(text));
    } catch (e) {
      setError(
        `読み込めませんでした: ${e instanceof Error ? e.message : "JSONまたはICS形式を確認してください"}`,
      );
    }
  }
  async function confirm() {
    setBusy(true);
    try {
      if (ics) {
        const destination =
          target === p?.project.id
            ? p
            : store.projects.find((x) => x.project.id === target);
        if (!destination) throw new Error("登録先プロジェクトを選んでください");
        if (p?.project.id === destination.project.id)
          store.edit((d) => applyIcs(d, ics));
        else {
          const d = structuredClone(destination);
          applyIcs(d, ics);
          await store.add(d);
        }
      }
      if (parsed) {
        if (mode === "new") {
          await store.add(remap(parsed));
        } else if (p) {
          if (mode === "replace") store.replace(parsed);
          else store.replace(mergeProjects(p, parsed));
        }
      }
      onClose();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "読み込みを確定できませんでした",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="JSON / ICSを読み込む" onClose={onClose}>
      <p className="muted">
        まず内容を検証します。確認後に「読み込みを確定」を押すまでデータは変更されません。
      </p>
      {!p && (
        <Field label="ICSの登録先">
          <select
            value={target}
            onChange={(e) => {
              setTarget(e.target.value);
              setIcs(null);
            }}
          >
            <option value="">プロジェクトを選択</option>
            {store.projects.map((pr) => (
              <option key={pr.project.id} value={pr.project.id}>
                {pr.project.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <label
        className="drop-zone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void read(e.dataTransfer.files[0]);
        }}
      >
        ファイルをここにドロップ、または選択
        <input
          type="file"
          accept=".json,.ics"
          onChange={(e) => void read(e.target.files?.[0])}
        />
      </label>
      {error && <p className="error">{error}</p>}
      {parsed && (
        <>
          <div className="note">
            <h3>{parsed.project.name}</h3>
            <p>
              {parsed.programs.length}プログラム · {parsed.sessions.length}
              実施枠 · {parsed.people.length}人物 · {parsed.venues.length}会場
            </p>
            <p>
              スキーマ v{parsed.schemaVersion} / {parsed.project.timezone}
            </p>
          </div>
          <Field label="読み込み方法">
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="new">新しいプロジェクトとして追加</option>
              {p && (
                <>
                  <option value="merge">
                    開いているプロジェクトに統合（IDを再生成）
                  </option>
                  <option value="replace">
                    開いているプロジェクトを置き換え
                  </option>
                </>
              )}
            </select>
          </Field>
          {mode === "replace" && (
            <p className="warning">
              現在の内容を置き換えます。必要な場合は先にJSONバックアップを保存してください。操作後はUndoできます。
            </p>
          )}
        </>
      )}
      {ics && (
        <>
          <h3>{ics.events.length}件を新規プログラムとして追加</h3>
          <div className="import-preview">
            {ics.events.map((e) => (
              <p key={e.uid}>
                <b>{e.name}</b>
                <small className="block">
                  {e.start} → {e.end} · {e.location}
                </small>
              </p>
            ))}
          </div>
          {ics.warnings.map((w, i) => (
            <p key={i} className="warning">
              {w}
            </p>
          ))}
          <p className="note">
            ICSでは人物・ロールなどを復元できません。完全バックアップにはJSONをご利用ください。
          </p>
        </>
      )}
      <footer>
        <button
          disabled={busy || (!parsed && !ics)}
          className="primary"
          onClick={() => void confirm()}
        >
          {busy ? "読み込み中…" : "読み込みを確定"}
        </button>
      </footer>
    </Modal>
  );
}
