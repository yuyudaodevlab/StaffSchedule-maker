import { z } from "zod";
import { Project, Filter } from "./model";
import { filtered, assignedPeople, assignmentMatches } from "./project";
export const shareFields = [
  "name",
  "time",
  "venue",
  "people",
  "groups",
  "roles",
  "notes",
  "status",
  "tags",
  "operations",
] as const;
export type ShareField = (typeof shareFields)[number];
export const shareLabels: Record<ShareField, string> = {
  name: "プログラム名",
  time: "開始・終了時刻",
  venue: "会場",
  people: "人物名（公開設定の人物のみ）",
  groups: "グループ名",
  roles: "ロール名",
  notes: "公開用メモ",
  status: "ステータス",
  tags: "タグ",
  operations: "集合・準備・担当時間",
};
const t = z.string().max(20000);
const dt = z.string().datetime({ offset: true });
export const snapshotSchema = z.object({
  kind: z.literal("schedule-snapshot"),
  version: z.literal(1),
  name: t,
  timezone: z.string().refine((s) => {
    try {
      new Intl.DateTimeFormat("ja", { timeZone: s });
      return true;
    } catch {
      return false;
    }
  }),
  createdAt: dt,
  entries: z
    .array(
      z.object({
        id: t,
        name: t.optional(),
        start: dt.optional(),
        end: dt.optional(),
        venue: t.optional(),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        people: z
          .array(
            z.object({
              name: t,
              role: t.optional(),
              start: dt.optional(),
              end: dt.optional(),
              gather: dt.optional(),
            }),
          )
          .optional(),
        groups: z.array(t).optional(),
        roles: z.array(t).optional(),
        notes: t.optional(),
        status: t.optional(),
        tags: z.array(t).optional(),
        gather: dt.optional(),
        prepare: dt.optional(),
        rehearsal: dt.optional(),
        cleanup: dt.optional(),
      }),
    )
    .max(10000),
}).superRefine((data,ctx)=>{if(new Set(data.entries.map(e=>e.id)).size!==data.entries.length)ctx.addIssue({code:"custom",message:"共有IDが重複しています"});for(const e of data.entries){if(Boolean(e.start)!==Boolean(e.end)||e.start&&e.end&&Date.parse(e.start)>=Date.parse(e.end))ctx.addIssue({code:"custom",message:"共有予定の時間範囲が不正です"});for(const p of e.people||[])if(Boolean(p.start)!==Boolean(p.end)||p.start&&p.end&&Date.parse(p.start)>=Date.parse(p.end))ctx.addIssue({code:"custom",message:"担当時間が不正です"});}});
export type ShareSnapshot = z.infer<typeof snapshotSchema>;
export type SnapshotEntry = ShareSnapshot["entries"][number];
export function snapshot(
  p: Project,
  f: Filter,
  fields: ShareField[] = [...shareFields],
): ShareSnapshot {
  const enabled = new Set(fields);
  return {
    kind: "schedule-snapshot",
    version: 1,
    name: p.project.name,
    timezone: p.project.timezone,
    createdAt: new Date().toISOString(),
    entries: filtered(p, f).map((s, index) => {
      const pr = p.programs.find((pr) => pr.id === s.programId)!;
      const aa = p.assignments.filter(
        (a) => a.sessionId === s.id && assignmentMatches(p, a, f),
      );
      const e: SnapshotEntry = { id: crypto.randomUUID(), color: pr.color };
      if (enabled.has("name")) e.name = pr.name;
      if (enabled.has("time")) {
        e.start = s.start;
        e.end = s.end;
      }
      if (enabled.has("venue"))
        e.venue = p.venues.find((v) => v.id === s.venueId)?.name;
      if (enabled.has("people"))
        e.people = aa
          .flatMap((a) =>
            assignedPeople(p, a)
              .filter((id) => (!f.person || id === f.person) && (!f.group || !!p.groups.find(g=>g.id===f.group)?.personIds.includes(id)))
              .map((id) => ({ person: p.people.find((x) => x.id === id)!, a })),
          )
          .filter(({ person }) => person.public)
          .map(({ person, a }) => ({
            name: person.displayName || person.name,
            ...(enabled.has("roles")
              ? { role: p.roles.find((r) => r.id === a.roleId)?.name }
              : {}),
            ...(enabled.has("operations")
              ? {
                  start: a.start || s.start,
                  end: a.end || s.end,
                  ...(a.gather ? { gather: a.gather } : {}),
                }
              : {}),
          }));
      if (enabled.has("groups"))
        e.groups = [
          ...new Set(
            aa
              .map((a) => p.groups.find((g) => g.id === (f.group||a.groupId))?.name)
              .filter((x): x is string => !!x),
          ),
        ];
      if (enabled.has("roles"))
        e.roles = [
          ...new Set(
            aa
              .map((a) => p.roles.find((r) => r.id === a.roleId)?.name)
              .filter((x): x is string => !!x),
          ),
        ];
      if (enabled.has("notes")) e.notes = pr.publicNotes;
      if (enabled.has("status")) e.status = s.status;
      if (enabled.has("tags")) e.tags = pr.tags;
      if (enabled.has("operations"))
        for (const key of [
          "gather",
          "prepare",
          "rehearsal",
          "cleanup",
        ] as const)
          if (s[key]) e[key] = s[key];
      return e;
    }),
  };
}
export function parseSnapshot(text: string) {
  if (text.length > 2000000)
    throw new Error("共有データが大きすぎます（上限2MB）");
  return snapshotSchema.parse(JSON.parse(text));
}
async function transform(bytes: Uint8Array, decode: boolean) {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(
      decode ? new DecompressionStream("gzip") : new CompressionStream("gzip"),
    );
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 2000000) {
        await reader.cancel();
        throw new Error("共有データが大きすぎます");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let pos = 0;
  for (const chunk of chunks) {
    result.set(chunk, pos);
    pos += chunk.length;
  }
  return result;
}
export async function encodeSnapshot(s: ShareSnapshot) {
  const validated = parseSnapshot(JSON.stringify(s));
  const bytes = await transform(
    new TextEncoder().encode(JSON.stringify(validated)),
    false,
  );
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const encoded = btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
  if(encoded.length>150000) throw new Error("共有URLが上限を超えます。共有用JSONをご利用ください");
  return encoded;
}
export async function decodeSnapshot(encoded: string) {
  if (encoded.length > 150000 || !/^[-_A-Za-z0-9]+$/.test(encoded))
    throw new Error("共有URLの形式またはサイズが不正です");
  try {
    const raw = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = await transform(
      Uint8Array.from(raw, (c) => c.charCodeAt(0)),
      true,
    );
    return parseSnapshot(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
  } catch {
    throw new Error(
      "共有URLのデータを読み込めませんでした。完全なリンクか、共有用JSONをご確認ください。",
    );
  }
}
