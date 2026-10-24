import { z } from "zod";
import { Temporal } from "@js-temporal/polyfill";
const id = z.string().min(1).max(150);
const text = z.string().max(20000);
const datetime = z.string().datetime({ offset: true });
const optionalTime = z.union([datetime, z.literal("")]).default("");
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const entity = {
  id,
  name: z.string().min(1).max(200),
  description: text.default(""),
  color: color.default("#c5dcca"),
  order: z.number().int().default(0),
  notes: text.default(""),
};
export const statuses = [
  "未開始",
  "準備中",
  "進行中",
  "完了",
  "延期",
  "中止",
] as const;
const settingsSchema = z
  .object({
    snap: z.number().int().min(1).max(60).default(5),
    tick: z.number().int().min(1).max(60).default(30),
    zoom: z.number().min(1).max(16).default(3),
    startHour: z.number().int().min(0).max(23).default(8),
    endHour: z.number().int().min(1).max(24).default(22),
    travelMinutes: z.number().min(0).max(240).default(15),
    gapMinutes: z.number().min(0).max(240).default(0),
    sort: z.enum(["asc", "desc", "manual"]).default("asc"),
    vertical: z.boolean().default(false),
    showEmpty: z.boolean().default(false),
    showFree: z.boolean().default(false),
    density: z.enum(["normal", "compact"]).default("normal"),
    theme: z.enum(["light", "dark", "system"]).default("system"),
    hiddenPeople: z.array(id).default([]),
  })
  .refine((s) => s.startHour < s.endHour, "表示開始は終了より前にしてください");
export const filterSchema = z.object({
  program: z.string().default(""),
  date: z.string().default(""),
  venue: z.string().default(""),
  group: z.string().default(""),
  person: z.string().default(""),
  role: z.string().default(""),
  status: z.string().default(""),
  tag: z.string().default(""),
  query: z.string().default(""),
  from: z.string().default(""),
  to: z.string().default(""),
  highlight: z.boolean().default(false),
});
export const projectSchema = z
  .object({
    schemaVersion: z.literal(1),
    application: z.literal("event-schedule-maker"),
    project: z.object({
      id,
      name: z.string().min(1).max(200),
      description: text,
      timezone: z.string().refine((s) => {
        try {
          new Intl.DateTimeFormat("ja", { timeZone: s });
          return true;
        } catch {
          return false;
        }
      }, "タイムゾーンが不正です"),
      updatedAt: datetime,
    }),
    days: z
      .array(
        z.object({
          id,
          date: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .refine((s) =>
              (() => {
                try {
                  return Temporal.PlainDate.from(s).toString() === s;
                } catch {
                  return false;
                }
              })(),
            ),
        }),
      )
      .max(366),
    venues: z
      .array(
        z.object({
          ...entity,
          capacity: z.number().int().min(1).max(1000),
          availableStart: optionalTime,
          availableEnd: optionalTime,
        }),
      )
      .max(500),
    groups: z
      .array(
        z.object({
          ...entity,
          personIds: z.array(id),
          representativeIds: z.array(id),
        }),
      )
      .max(1000),
    people: z
      .array(
        z.object({
          ...entity,
          displayName: text,
          roleIds: z.array(id),
          contact: text,
          public: z.boolean(),
        }),
      )
      .max(5000),
    roles: z
      .array(
        z.object({
          ...entity,
          category: z.enum(["speaker", "staff"]).default("staff"),
        }),
      )
      .max(500),
    programs: z
      .array(
        z.object({
          id,
          name: z.string().min(1).max(200),
          description: text,
          color,
          tags: z.array(z.string().max(100)),
          priority: z.enum(["低", "標準", "高"]),
          publicNotes: text,
          internalNotes: text,
          url: z
            .string()
            .max(2000)
            .refine(
              (s) => !s || /^https?:\/\//i.test(s),
              "URLはhttp/httpsのみ使用できます",
            ),
        }),
      )
      .max(10000),
    sessions: z
      .array(
        z.object({
          id,
          programId: id,
          venueId: z.string(),
          start: datetime,
          end: datetime,
          status: z.enum(statuses),
          gather: optionalTime,
          prepare: optionalTime,
          rehearsal: optionalTime,
          cleanup: optionalTime,
          venuePrepare: optionalTime,
          transition: z.number().min(0).max(1440),
          allowOverlap: z.boolean(),
          icsUid: z.string().max(500).default(""),
        }),
      )
      .max(20000),
    assignments: z
      .array(
        z.object({
          id,
          sessionId: id,
          personId: z.string(),
          groupId: z.string(),
          roleId: z.string(),
          groupMode: z.enum(["all", "representatives"]),
          start: optionalTime,
          end: optionalTime,
          gather: optionalTime,
          notes: text,
        }),
      )
      .max(50000),
    settings: settingsSchema,
    presets: z
      .array(z.object({ id, name: z.string(), filter: filterSchema }))
      .default([]),
    templates: z
      .array(
        z.object({
          id,
          name: z.string(),
          duration: z.number().positive(),
          color,
        }),
      )
      .default([]),
  })
  .superRefine((p, ctx) => {
    const issue = (message: string) =>
      ctx.addIssue({ code: "custom", message });
    for (const key of [
      "days",
      "venues",
      "groups",
      "people",
      "roles",
      "programs",
      "sessions",
      "assignments",
    ] as const) {
      const ids = p[key].map((e) => e.id);
      if (new Set(ids).size !== ids.length) issue(`${key}: IDが重複しています`);
    }
    if (new Set(p.days.map((d) => d.date)).size !== p.days.length)
      issue("日付が重複しています");
    const has = (
      key: "venues" | "people" | "groups" | "roles" | "programs" | "sessions",
      value: string,
    ) => p[key].some((x) => x.id === value);
    const allIds = [
      p.project.id,
      ...p.days.map((x) => x.id),
      ...p.venues.map((x) => x.id),
      ...p.groups.map((x) => x.id),
      ...p.people.map((x) => x.id),
      ...p.roles.map((x) => x.id),
      ...p.programs.map((x) => x.id),
      ...p.sessions.map((x) => x.id),
      ...p.assignments.map((x) => x.id),
    ];
    if (new Set(allIds).size !== allIds.length)
      issue("エンティティ間でIDが重複しています");
    for (const v of p.venues)
      if (
        v.availableStart &&
        v.availableEnd &&
        Date.parse(v.availableStart) >= Date.parse(v.availableEnd)
      )
        issue("会場の利用終了は利用開始より後にしてください");
    for (const s of p.sessions) {
      if (
        !has("programs", s.programId) ||
        (s.venueId && !has("venues", s.venueId))
      )
        issue("実施枠の参照先がありません");
      if (Date.parse(s.end) - Date.parse(s.start) > 366 * 86400000)
        issue("1つの実施枠は366日以内にしてください");
      if (Date.parse(s.start) >= Date.parse(s.end))
        issue("開始時刻は終了時刻より前に設定してください");
    }
    for (const a of p.assignments) {
      if (
        !has("sessions", a.sessionId) ||
        (a.personId && !has("people", a.personId)) ||
        (a.groupId && !has("groups", a.groupId)) ||
        (a.roleId && !has("roles", a.roleId))
      )
        issue("担当情報の参照先がありません");
      const s = p.sessions.find((s) => s.id === a.sessionId);
      if (s && Date.parse(a.start || s.start) >= Date.parse(a.end || s.end))
        issue("担当時間の終了は開始より後にしてください");
    }
    for (const g of p.groups)
      if (
        [...g.personIds, ...g.representativeIds].some(
          (id) => !has("people", id),
        ) ||
        g.representativeIds.some((id) => !g.personIds.includes(id))
      )
        issue("グループの所属人物が不正です");
    for (const person of p.people)
      if (person.roleIds.some((id) => !has("roles", id)))
        issue("人物のロールが不正です");
  });
export type Project = z.infer<typeof projectSchema>;
export type Program = Project["programs"][number];
export type Session = Project["sessions"][number];
export type Assignment = Project["assignments"][number];
export type Person = Project["people"][number];
export type ScheduleSettings = Project["settings"];
export type DisplaySettings = Pick<
  ScheduleSettings,
  "theme" | "sort" | "vertical" | "density" | "showEmpty" | "hiddenPeople"
>;
export type EventDay = Project["days"][number];
export type Venue = Project["venues"][number];
export type Group = Project["groups"][number];
export type Role = Project["roles"][number];
export type Filter = z.infer<typeof filterSchema>;
export const emptyFilter = (): Filter => filterSchema.parse({});
export function validateProject(value: unknown): Project {
  const r = projectSchema.safeParse(value);
  if (!r.success)
    throw new Error(
      r.error.issues
        .slice(0, 5)
        .map((x) => x.message)
        .join(" / "),
    );
  return r.data;
}
export function parseProject(text: string) {
  if (text.length > 10000000) throw new Error("JSONは10MB以下にしてください");
  return validateProject(JSON.parse(text));
}
