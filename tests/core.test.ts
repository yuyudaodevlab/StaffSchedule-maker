import test from "node:test";
import assert from "node:assert/strict";
import {
  sampleProject,
  newProject,
  assignedPeople,
  shiftSession,
  subset,
  remap,
  mergeProjects,
  filtered,
  deleteSession,
} from "../src/lib/project";
import { validateProject, emptyFilter, parseProject } from "../src/lib/model";
import { instant, dayBounds, overlaps, uid, localInput } from "../src/lib/time";
import { conflicts, personStats } from "../src/lib/conflicts";
import { snapshot, encodeSnapshot, decodeSnapshot } from "../src/lib/sharing";
import { exportIcs, parseIcs, foldLine, applyIcs } from "../src/lib/ics";
function fixture() {
  const p = sampleProject();
  p.sessions = p.sessions.slice(0, 2);
  p.assignments = p.assignments.filter((a) =>
    p.sessions.some((s) => s.id === a.sessionId),
  );
  p.settings.travelMinutes = 0;
  return p;
}
test("深夜の絶対日時とDST日付境界", () => {
  const start = instant("2026-10-30T23:30", "Asia/Tokyo"),
    end = instant("2026-10-31T01:00", "Asia/Tokyo");
  assert.equal(Date.parse(end) - Date.parse(start), 90 * 60000);
  assert.equal(localInput(start, "Asia/Tokyo"), "2026-10-30T23:30");
  const [a, b] = dayBounds("2026-03-08", "America/New_York");
  assert.equal(b - a, 23 * 3600000);
  assert.throws(() => instant("2026-03-08T02:30", "America/New_York"));
});
test("終了境界は重複しない", () => {
  assert.equal(overlaps(0, 30, 30, 60), false);
  assert.equal(overlaps(0, 31, 30, 60), true);
});
test("共通実施枠の移動は全担当に反映する", () => {
  const p = fixture(),
    s = p.sessions[0],
    a = p.assignments[0];
  a.start = s.start;
  const people = assignedPeople(p, a);
  assert.equal(people.length, 3);
  const original = Date.parse(s.start);
  shiftSession(p, s.id, 15);
  assert.equal(Date.parse(s.start), original + 900000);
  assert.equal(a.start, s.start);
  assert.equal(p.sessions.filter((x) => x.id === s.id).length, 1);
});
test("同一人物の複数ロールを自己重複扱いしない", () => {
  const p = fixture();
  p.sessions = p.sessions.slice(0, 1);
  p.assignments = p.assignments.filter((a) => a.sessionId === p.sessions[0].id);
  p.assignments.push({ ...p.assignments[0], id: uid(), roleId: p.roles[0].id });
  assert.equal(conflicts(p).length, 0);
  assert.equal(
    personStats(p, assignedPeople(p, p.assignments[0])[0]).total,
    30,
  );
});
test("人物・会場重複と同時利用可能数", () => {
  const p = fixture();
  const a = p.sessions[0],
    b = p.sessions[1];
  b.start = a.start;
  b.end = a.end;
  p.assignments[1].groupId = p.assignments[0].groupId;
  assert.ok(conflicts(p).some((x) => x.id.startsWith("person-")));
  assert.ok(conflicts(p).some((x) => x.id.startsWith("venue-")));
  p.venues[0].capacity = 2;
  assert.ok(!conflicts(p).some((x) => x.id.startsWith("venue-")));
  b.allowOverlap = true;
  assert.equal(conflicts(p).length, 0);
});
test("集合、準備、撤収と会場間移動を検出", () => {
  const p = fixture();
  const a = p.sessions[0],
    b = p.sessions[1];
  p.assignments[1].groupId = p.assignments[0].groupId;
  b.start = a.end;
  b.end = new Date(Date.parse(a.end) + 1800000).toISOString();
  b.venueId = p.venues[1].id;
  p.settings.travelMinutes = 15;
  assert.ok(conflicts(p).some((x) => x.reason === "会場間の移動時間不足"));
  p.settings.travelMinutes = 0;
  a.cleanup = new Date(Date.parse(a.end) + 600000).toISOString();
  assert.ok(conflicts(p).some((x) => x.reason.includes("撤収")));
});
test("JSON往復と参照ID・将来スキーマ・不正URLの検証", () => {
  const p = sampleProject();
  assert.deepEqual(parseProject(JSON.stringify(p)), p);
  const invalid = structuredClone(p);
  invalid.assignments[0].sessionId = "missing";
  assert.throws(() => validateProject(invalid));
  assert.throws(() => validateProject({ ...p, schemaVersion: 9 }));
  p.programs[0].url = "javascript:alert(1)";
  assert.throws(() => validateProject(p));
});
test("統合時のID再生成と人物別JSONの参照閉包", () => {
  const p = sampleProject();
  const merged = mergeProjects(p, p);
  assert.equal(merged.sessions.length, p.sessions.length * 2);
  validateProject(merged);
  const q = subset(p, { ...emptyFilter(), person: p.people[3].id });
  assert.equal(q.people.length, 1);
  assert.ok(
    q.groups.every((g) => g.personIds.every((id) => id === p.people[3].id)),
  );
  assert.equal(validateProject(remap(p)).sessions.length, p.sessions.length);
});
test("実施枠削除は担当と孤立企画を除去する", () => {
  const p = sampleProject();
  const s = p.sessions[0];
  deleteSession(p, s.id);
  assert.ok(!p.assignments.some((a) => a.sessionId === s.id));
  assert.ok(!p.programs.some((pr) => pr.id === s.programId));
  validateProject(p);
});
test("共有対象の人物以外・内部メモ・連絡先を送出しない", async () => {
  const p = sampleProject();
  p.people[3].contact = "secret@example.com";
  p.programs[0].internalNotes = "INTERNAL-SECRET";
  const data = snapshot(p, { ...emptyFilter(), person: p.people[3].id });
  const json = JSON.stringify(data);
  assert.ok(!json.includes("INTERNAL-SECRET"));
  assert.ok(!json.includes("secret@example.com"));
  for (const person of p.people.filter((x) => x.id !== p.people[3].id))
    assert.ok(!json.includes(person.name));
  const restored = await decodeSnapshot(await encodeSnapshot(data));
  assert.deepEqual(restored, data);
  p.programs[0].name = "変更後";
  assert.notEqual(restored.entries[0].name, "変更後");
});
test("共有項目の除外と非公開人物", () => {
  const p = sampleProject();
  p.people.forEach((x) => (x.public = false));
  const data = snapshot(p, emptyFilter(), ["name", "time"]);
  assert.ok(
    data.entries.every(
      (e) =>
        e.people === undefined &&
        e.venue === undefined &&
        e.notes === undefined,
    ),
  );
  const all = snapshot(p, emptyFilter());
  assert.ok(all.entries.every((e) => e.people?.length === 0));
});
test("不正な圧縮データ・過大URLを拒否", async () => {
  await assert.rejects(() => decodeSnapshot("invalid!"));
  await assert.rejects(() => decodeSnapshot("a".repeat(150001)));
  await assert.rejects(() => decodeSnapshot("abcd"));
});
test("ICS日本語・改行・特殊文字・深夜の往復と75オクテット", () => {
  const p = fixture();
  p.sessions = p.sessions.slice(0, 1);
  const s = p.sessions[0];
  s.start = instant("2026-10-30T23:30", "Asia/Tokyo");
  s.end = instant("2026-10-31T01:00", "Asia/Tokyo");
  p.programs.find((pr) => pr.id === s.programId)!.name =
    "日本語イベント、コーヒー;カフェ\\改行\n" + "長い予定名".repeat(30);
  const data = snapshot(p, emptyFilter());
  const text = exportIcs(data);
  assert.ok(text.endsWith("\r\n"));
  for (const line of text.split("\r\n"))
    assert.ok(Buffer.byteLength(line) <= 75);
  const imported = parseIcs(text, p.project.timezone);
  assert.equal(imported.events.length, 1);
  assert.equal(imported.events[0].name, data.entries[0].name);
  assert.equal(Date.parse(imported.events[0].start), Date.parse(s.start));
  assert.equal(Date.parse(imported.events[0].end), Date.parse(s.end));
  const q = newProject();
  applyIcs(q, imported);
  applyIcs(q, imported);
  assert.equal(q.sessions.length, 1);
  assert.ok(
    parseIcs(
      text,
      p.project.timezone,
      q.sessions.map((s) => s.icsUid),
    ).warnings.length > 0,
  );
});
test("ICSのTZIDと繰り返しの警告", () => {
  const text = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    "UID:test",
    "DTSTART;TZID=Asia/Tokyo:20261030T233000",
    "DTEND;TZID=Asia/Tokyo:20261031T010000",
    "SUMMARY:深夜",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:recurring",
    "DTSTART:20261030T100000Z",
    "DTEND:20261030T110000Z",
    "RRULE:FREQ=DAILY",
    "SUMMARY:反復",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const r = parseIcs(text, "UTC");
  assert.equal(r.events.length, 1);
  assert.equal(r.events[0].start, instant("2026-10-30T23:30", "Asia/Tokyo"));
  assert.equal(r.warnings.length, 1);
});
test("検索は全半角・英語大小文字を正規化", () => {
  const p = sampleProject();
  p.programs[0].name = "Coffee Ａ１";
  assert.equal(
    filtered(p, { ...emptyFilter(), query: "ｃｏｆｆｅｅ a1" }).length,
    1,
  );
});
test('複数グループに所属する人物経由でも対象外の人物を共有しない',()=>{const p=sampleProject();p.groups[1].personIds.push(p.people[0].id);const f={...emptyFilter(),group:p.groups[1].id};const data=snapshot(p,f);assert.ok(!JSON.stringify(data).includes(p.people[1].name));assert.ok(!JSON.stringify(data).includes(p.people[2].name));assert.ok(data.entries.every(e=>e.groups?.every(name=>name===p.groups[1].name)));const q=subset(p,f);assert.ok(!q.people.some(person=>person.id===p.people[1].id));});
