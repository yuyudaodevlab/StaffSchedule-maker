import { performance } from "node:perf_hooks";
import { uid, instant } from "../src/lib/time";
import { newProject, ensureDays } from "../src/lib/project";
import { conflicts } from "../src/lib/conflicts";
import { validateProject } from "../src/lib/model";
const p = newProject("大規模確認");
const day = p.days[0].date;
p.venues = Array.from({ length: 10 }, (_, i) => ({
  id: uid(),
  name: `会場${i}`,
  description: "",
  color: "#c7decf",
  order: i,
  notes: "",
  capacity: 1,
  availableStart: "",
  availableEnd: "",
}));
p.people = Array.from({ length: 300 }, (_, i) => ({
  id: uid(),
  name: `人物${i}`,
  displayName: `人物${i}`,
  description: "",
  color: "#c7decf",
  order: i,
  notes: "",
  roleIds: [],
  contact: "",
  public: true,
}));
p.groups = Array.from({ length: 50 }, (_, i) => ({
  id: uid(),
  name: `グループ${i}`,
  description: "",
  color: "#c7decf",
  order: i,
  notes: "",
  personIds: p.people.slice(i * 6, i * 6 + 6).map((p) => p.id),
  representativeIds: [],
}));
for (let i = 0; i < 1000; i++) {
  const id = uid(),
    sid = uid();
  const start = new Date(
    Date.parse(instant(`${day}T09:00`, "Asia/Tokyo")) +
      Math.floor(i / 10) * 1800000,
  ).toISOString();
  p.programs.push({
    id,
    name: `予定${i}`,
    description: "",
    color: "#c7decf",
    tags: [],
    priority: "標準",
    publicNotes: "",
    internalNotes: "",
    url: "",
  });
  const session = {
    id: sid,
    programId: id,
    venueId: p.venues[i % 10].id,
    start,
    end: new Date(Date.parse(start) + 1800000).toISOString(),
    status: "未開始" as const,
    gather: "",
    prepare: "",
    rehearsal: "",
    cleanup: "",
    venuePrepare: "",
    transition: 0,
    allowOverlap: false,
    icsUid: "",
  };
  p.sessions.push(session);
  ensureDays(p, session);
  p.assignments.push({
    id: uid(),
    sessionId: sid,
    personId: "",
    groupId: p.groups[i % 50].id,
    roleId: "",
    groupMode: "all",
    start: "",
    end: "",
    gather: "",
    notes: "",
  });
}
const start = performance.now();
validateProject(p);
const warnings = conflicts(p);
console.log(
  JSON.stringify({
    programs: p.programs.length,
    people: p.people.length,
    groups: p.groups.length,
    venues: p.venues.length,
    warnings: warnings.length,
    validationAndConflictsMs: Math.round(performance.now() - start),
  }),
);
