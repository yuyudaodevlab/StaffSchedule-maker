import {
  uid,
  instant,
  dateIn,
  addDays,
  shift,
  normalize,
  overlaps,
  dayBounds,
  collator,
} from "./time";
import { Project, Session, Assignment, Filter, validateProject } from "./model";
export const palette = [
  "#c7decf",
  "#ead2d4",
  "#d9d3ed",
  "#f2dfb5",
  "#bddce5",
  "#e9cbb7",
];
export function newProject(name = "新しいイベント"): Project {
  const today = dateIn(new Date().toISOString(), "Asia/Tokyo");
  return validateProject({
    schemaVersion: 1,
    application: "event-schedule-maker",
    project: {
      id: uid(),
      name,
      description: "",
      timezone: "Asia/Tokyo",
      updatedAt: new Date().toISOString(),
    },
    days: [{ id: uid(), date: today }],
    venues: [],
    groups: [],
    people: [],
    roles: [],
    programs: [],
    sessions: [],
    assignments: [],
    settings: {},
    presets: [],
    templates: [
      "開会式",
      "閉会式",
      "リハーサル",
      "集合",
      "休憩",
      "転換",
      "撤収",
      "スタッフミーティング",
    ].map((name, i) => ({
      id: uid(),
      name,
      duration: 30,
      color: palette[i % 6],
    })),
  });
}
export function sampleProject() {
  const p = newProject("こもれびフェス 2026");
  const date = p.days[0].date;
  p.project.description =
    "音楽と、ことばと、コーヒーと。みんなでつくる、小さな文化祭。";
  p.days.push({ id: uid(), date: addDays(date, 1) });
  p.roles = [
    "登壇者",
    "出演者",
    "司会",
    "進行管理",
    "音響",
    "照明",
    "撮影",
    "配信",
    "受付",
    "案内",
    "会場管理",
    "裏方",
  ].map((name, i) => ({
    id: uid(),
    name,
    description: "",
    color: palette[i % 6],
    order: i,
    notes: "",
  }));
  p.venues = ["メインステージ", "ガーデンテラス"].map((name, i) => ({
    id: uid(),
    name,
    description: i ? "緑に囲まれた屋外スペース" : "大きな窓のあるメイン会場",
    color: palette[i],
    order: i,
    notes: "",
    capacity: 1,
    availableStart: "",
    availableEnd: "",
  }));
  p.people = [
    "田中 はるか",
    "佐藤 みのり",
    "鈴木 そら",
    "山田 ひなた",
    "高橋 あおい",
    "小林 なつき",
  ].map((name, i) => ({
    id: uid(),
    name,
    displayName: name,
    description: "",
    color: palette[i],
    order: i,
    notes: "",
    roleIds: [p.roles[i % 3].id],
    contact: "",
    public: true,
  }));
  p.groups = ["出演チーム", "運営チーム"].map((name, i) => ({
    id: uid(),
    name,
    description: "",
    color: palette[i],
    order: i,
    notes: "",
    personIds: p.people.slice(i * 3, i * 3 + 3).map((x) => x.id),
    representativeIds: [p.people[i * 3].id],
  }));
  const samples = [
    ["スタッフミーティング", "09:00", "09:30", 0, 1],
    ["オープニング", "10:00", "10:30", 0, 0],
    ["コーヒーと暮らしのトーク", "11:00", "12:00", 0, 0],
    ["アコースティックライブ", "13:00", "14:00", 0, 0],
    ["クロージング", "16:00", "16:30", 0, 1],
    ["朝のコーヒーワークショップ", "10:00", "11:00", 1, 1],
    ["小さなものづくり教室", "12:00", "13:30", 1, 1],
    ["ガーデン・セッション", "14:30", "15:30", 1, 0],
  ] as const;
  samples.forEach(([name, start, end, v, g], i) => {
    const id = uid();
    p.programs.push({
      id,
      name,
      description: "参加者のみなさんと楽しむ、こもれびフェスのプログラム。",
      color: palette[i % 6],
      tags: [i % 2 ? "ステージ" : "運営"],
      priority: "標準",
      publicNotes: "開始10分前を目安にお集まりください。",
      internalNotes: "スタッフ用の確認メモ",
      url: "",
    });
    const s: Session = {
      id: uid(),
      programId: id,
      venueId: p.venues[v].id,
      start: instant(`${date}T${start}`, p.project.timezone),
      end: instant(`${date}T${end}`, p.project.timezone),
      status: "未開始",
      gather: "",
      prepare: "",
      rehearsal: "",
      cleanup: "",
      venuePrepare: "",
      transition: 0,
      allowOverlap: false,
      icsUid: "",
    };
    p.sessions.push(s);
    p.assignments.push({
      id: uid(),
      sessionId: s.id,
      groupId: p.groups[g].id,
      personId: "",
      roleId: p.roles[g ? 3 : 1].id,
      groupMode: "all",
      start: "",
      end: "",
      gather: "",
      notes: "",
    });
  });
  return p;
}
export function assignedPeople(p: Project, a: Assignment) {
  if (a.personId) return [a.personId];
  const g = p.groups.find((g) => g.id === a.groupId);
  return g ? (a.groupMode === "all" ? g.personIds : g.representativeIds) : [];
}
export function sessionPeople(p: Project, s: Session) {
  return [
    ...new Set(
      p.assignments
        .filter((a) => a.sessionId === s.id)
        .flatMap((a) => assignedPeople(p, a)),
    ),
  ];
}
export function assignmentMatches(p: Project, a: Assignment, f: Filter) {
  return (
    (!f.person || assignedPeople(p, a).includes(f.person)) &&
    (!f.group ||
      a.groupId === f.group ||
      assignedPeople(p, a).some((id) =>
        p.groups.find((g) => g.id === f.group)?.personIds.includes(id),
      )) &&
    (!f.role || a.roleId === f.role)
  );
}
export function matches(p: Project, s: Session, f: Filter) {
  if(f.program && f.program!==s.programId) return false;
  const pr = p.programs.find((x) => x.id === s.programId)!;
  const aa = p.assignments.filter((a) => a.sessionId === s.id);
  if (
    (f.venue && s.venueId !== f.venue) ||
    (f.status && s.status !== f.status) ||
    (f.tag && !pr.tags.some((t) => normalize(t).includes(normalize(f.tag))))
  )
    return false;
  if (f.person || f.group || f.role) {
    if (!aa.some((a) => assignmentMatches(p, a, f))) return false;
  }
  let start = Date.parse(s.start),
    end = Date.parse(s.end);
  if (f.person) {
    const mine = aa.filter((a) => assignmentMatches(p, a, f));
    start = Math.min(
      ...mine.map((a) => Date.parse(a.gather || a.start || s.start)),
    );
    end = Math.max(...mine.map((a) => Date.parse(a.end || s.end)));
  }
  if (f.date) {
    const [a, b] = dayBounds(f.date, p.project.timezone);
    if (!overlaps(start, end, a, b)) return false;
  }
  if (
    (f.from && end <= Date.parse(instant(f.from, p.project.timezone))) ||
    (f.to && start >= Date.parse(instant(f.to, p.project.timezone)))
  )
    return false;
  const names = [
    pr.name,
    pr.description,
    pr.publicNotes,
    pr.internalNotes,
    ...pr.tags,
    p.venues.find((v) => v.id === s.venueId)?.name || "",
    ...aa.flatMap((a) => [
      a.notes,
      p.roles.find((r) => r.id === a.roleId)?.name || "",
      p.groups.find((g) => g.id === a.groupId)?.name || "",
      ...assignedPeople(p, a).map(
        (id) => p.people.find((x) => x.id === id)?.name || "",
      ),
    ]),
  ];
  return !f.query || normalize(names.join(" ")).includes(normalize(f.query));
}
export function filtered(p: Project, f: Filter) {
  return p.sessions
    .filter((s) => matches(p, s, f))
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}
export function deleteSession(p: Project, id: string) {
  const s = p.sessions.find((s) => s.id === id);
  p.sessions = p.sessions.filter((s) => s.id !== id);
  p.assignments = p.assignments.filter((a) => a.sessionId !== id);
  if (s && !p.sessions.some((x) => x.programId === s.programId))
    p.programs = p.programs.filter((x) => x.id !== s.programId);
}
export function shiftSession(p: Project, id: string, minutes: number) {
  const s = p.sessions.find((s) => s.id === id)!;
  for (const key of [
    "start",
    "end",
    "gather",
    "prepare",
    "rehearsal",
    "cleanup",
    "venuePrepare",
  ] as const)
    if (s[key]) s[key] = shift(s[key], minutes);
  for (const a of p.assignments.filter((a) => a.sessionId === id))
    for (const key of ["start", "end", "gather"] as const)
      if (a[key]) a[key] = shift(a[key], minutes);
  ensureDays(p, s);
}
export function ensureDays(p: Project, s: Session) {
  const zone = p.project.timezone;
  let d = dateIn(s.start, zone),
    last = dateIn(new Date(Date.parse(s.end) - 1).toISOString(), zone);
  let count = 0;
  while (d <= last && count++ < 366) {
    if (!p.days.some((day) => day.date === d))
      p.days.push({ id: uid(), date: d });
    d = addDays(d, 1);
  }
  p.days.sort((a, b) => a.date.localeCompare(b.date));
}
export function duplicateSession(
  p: Project,
  id: string,
  minutes: number,
  clear = false,
) {
  const old = p.sessions.find((s) => s.id === id)!;
  const pr = structuredClone(p.programs.find((x) => x.id === old.programId)!);
  pr.id = uid();
  pr.name += "（コピー）";
  p.programs.push(pr);
  const s = { ...old, id: uid(), programId: pr.id, icsUid: "" };
  p.sessions.push(s);
  if (!clear)
    p.assignments.push(
      ...p.assignments
        .filter((a) => a.sessionId === id)
        .map((a) => ({ ...a, id: uid(), sessionId: s.id })),
    );
  shiftSession(p, s.id, minutes);
  return s.id;
}
export function remap(p: Project): Project {
  const q = structuredClone(p);
  const map = new Map<string, string>();
  for (const k of [
    "days",
    "venues",
    "groups",
    "people",
    "roles",
    "programs",
    "sessions",
    "assignments",
    "presets",
    "templates",
  ] as const)
    q[k].forEach((x) => map.set(x.id, uid()));
  const ref = (s: string) => (s ? map.get(s) || s : "");
  q.project.id = uid();
  for (const k of [
    "days",
    "venues",
    "groups",
    "people",
    "roles",
    "programs",
    "sessions",
    "assignments",
    "presets",
    "templates",
  ] as const)
    q[k].forEach((x) => (x.id = ref(x.id)));
  q.people.forEach((x) => (x.roleIds = x.roleIds.map(ref)));
  q.groups.forEach((x) => {
    x.personIds = x.personIds.map(ref);
    x.representativeIds = x.representativeIds.map(ref);
  });
  q.sessions.forEach((x) => {
    x.programId = ref(x.programId);
    x.venueId = ref(x.venueId);
  });
  q.assignments.forEach((x) => {
    x.sessionId = ref(x.sessionId);
    x.personId = ref(x.personId);
    x.groupId = ref(x.groupId);
    x.roleId = ref(x.roleId);
  });
  q.settings.hiddenPeople = q.settings.hiddenPeople.map(ref);
  q.presets.forEach((x) => {
    for (const k of ["venue", "group", "person", "role", "program"] as const)
      x.filter[k] = ref(x.filter[k]);
  });
  return q;
}
export function mergeProjects(target: Project, source: Project) {
  const p = structuredClone(target),
    q = remap(source);
  for (const k of [
    "venues",
    "groups",
    "people",
    "roles",
    "programs",
    "sessions",
    "assignments",
    "templates",
  ] as const) {
    (p[k] as unknown[]).push(...q[k]);
  }
  q.days.forEach((d) => {
    if (!p.days.some((x) => x.date === d.date)) p.days.push(d);
  });
  return validateProject(p);
}
export function subset(p: Project, f: Filter) {
  const q = structuredClone(p);
  q.sessions = filtered(p, f);
  const sessionIds = new Set(q.sessions.map((s) => s.id));
  q.programs = q.programs.filter((pr) =>
    q.sessions.some((s) => s.programId === pr.id),
  );
  q.assignments = q.assignments.filter(
    (a) => sessionIds.has(a.sessionId) && assignmentMatches(p, a, f),
  );
  const ids = new Set(
    q.assignments
      .flatMap((a) => assignedPeople(p, a))
      .filter((id) => (!f.person || id === f.person) && (!f.group || !!p.groups.find(g=>g.id===f.group)?.personIds.includes(id))),
  );
  q.people = q.people.filter((x) => ids.has(x.id));
  q.groups = q.groups
    .filter(
      (g) =>
        q.assignments.some((a) => a.groupId === g.id) ||
        g.personIds.some((id) => ids.has(id)),
    )
    .map((g) => ({
      ...g,
      personIds: g.personIds.filter((id) => ids.has(id)),
      representativeIds: g.representativeIds.filter((id) => ids.has(id)),
    }));
  q.roles = q.roles.filter(
    (r) =>
      q.assignments.some((a) => a.roleId === r.id) ||
      q.people.some((x) => x.roleIds.includes(r.id)),
  );
  q.venues = q.venues.filter((v) => q.sessions.some((s) => s.venueId === v.id));
  q.presets = [];
  q.settings.hiddenPeople = [];
  if (f.date) q.days = q.days.filter((d) => d.date === f.date);
  return validateProject(q);
}
export function sorted<T extends { name: string; order: number }>(
  list: T[],
  p: Project,
) {
  return [...list].sort((a, b) =>
    p.settings.sort === "manual"
      ? a.order - b.order
      : collator.compare(a.name, b.name) *
        (p.settings.sort === "desc" ? -1 : 1),
  );
}
