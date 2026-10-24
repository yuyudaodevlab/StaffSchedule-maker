import ICAL from "ical.js";
import { ShareSnapshot } from "./sharing";
import { Project, Session } from "./model";
import { uid, instant } from "./time";
import { ensureDays } from "./project";
const escape = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
const utc = (s: string) =>
  new Date(s)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
export function foldLine(line: string) {
  let out = "",
    width = 0;
  for (const char of line) {
    const length = new TextEncoder().encode(char).length;
    if (width + length > 75) {
      out += "\r\n ";
      width = 1;
    }
    out += char;
    width += length;
  }
  return out;
}
export function exportIcs(data: ShareSnapshot) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Koyomi Kissa//Schedule Maker//JA",
    "CALSCALE:GREGORIAN",
  ];
  for (const e of data.entries) {
    if (!e.start || !e.end) continue;
    const description = [
      e.notes,
      ...(e.people || []).map(
        (p) =>
          `${p.name}${p.role ? ` (${p.role})` : ""}${p.start && p.end ? ` 担当: ${p.start} ～ ${p.end}` : ""}${p.gather ? ` 集合: ${p.gather}` : ""}`,
      ),
      e.groups?.join(" / "),
      e.roles?.join(" / "),
      e.gather ? `集合: ${e.gather}` : "",
      e.prepare ? `準備: ${e.prepare}` : "",
      e.rehearsal ? `リハーサル: ${e.rehearsal}` : "",
      e.cleanup ? `撤収: ${e.cleanup}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escape(e.id)}`,
      `DTSTAMP:${utc(data.createdAt)}`,
      `DTSTART:${utc(e.start)}`,
      `DTEND:${utc(e.end)}`,
      `SUMMARY:${escape(e.name || "予定")}`,
      `DESCRIPTION:${escape(description)}`,
      `LOCATION:${escape(e.venue || "")}`,
      ...(e.status === "中止" ? ["STATUS:CANCELLED"] : []),
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
export type IcsImport = {
  events: {
    uid: string;
    name: string;
    description: string;
    location: string;
    start: string;
    end: string;
  }[];
  warnings: string[];
};
export function parseIcs(
  text: string,
  zone: string,
  knownUids: string[] = [],
): IcsImport {
  if (text.length > 5000000) throw new Error("ICSは5MB以下にしてください");
  ICAL.TimezoneService.reset();
  const root = new ICAL.Component(ICAL.parse(text));
  if (root.name !== "vcalendar") throw new Error("iCalendar形式ではありません");
  for (const tz of root.getAllSubcomponents("vtimezone")) {
    const name = String(tz.getFirstPropertyValue("tzid"));
    ICAL.TimezoneService.register(new ICAL.Timezone(tz), name);
  }
  const result: IcsImport = { events: [], warnings: [] };
  const seen = new Set(knownUids);
  const events = root.getAllSubcomponents("vevent");
  if (events.length > 10000)
    throw new Error("予定は10,000件以下にしてください");
  for (const comp of events) {
    const name = String(comp.getFirstPropertyValue("summary") || "名称なし");
    try {
      if(comp.getAllSubcomponents().length) result.warnings.push(`${name}: アラームなどの付属情報は取り込みません`);
      if (
        comp.hasProperty("rrule") ||
        comp.hasProperty("rdate") ||
        comp.hasProperty("recurrence-id")
      ) {
        result.warnings.push(
          `${name}: 繰り返し予定・例外は未対応のため取り込まれません`,
        );
        continue;
      }
      const id = String(comp.getFirstPropertyValue("uid") || uid());
      if (seen.has(id)) {
        result.warnings.push(`${name}: 同一UIDの予定があるため取り込みません`);
        continue;
      }
      const ev = new ICAL.Event(comp);
      const convert = (time: ICAL.Time, property: string) => {
        const tzid = comp.getFirstProperty(property)?.getParameter("tzid");
        if (time.isDate) return instant(`${time.toString()}T00:00`, zone);
        if (tzid && time.zone.tzid === "floating") {
          return instant(time.toString(), String(tzid));
        }
        if (time.zone.tzid === "floating")
          return instant(time.toString(), zone);
        return time.toJSDate().toISOString();
      };
      const start = convert(ev.startDate, "dtstart"),
        end = convert(ev.endDate, "dtend");
      if (Date.parse(start) >= Date.parse(end))
        throw new Error("終了時刻が開始以前です");
      result.events.push({
        uid: id,
        name,
        description: ev.description || "",
        location: ev.location || "",
        start,
        end,
      });
      seen.add(id);
    } catch (e) {
      result.warnings.push(
        `${name}: ${e instanceof Error ? e.message : "日時を解析できません"}`,
      );
    }
  }
  if (
    root
      .getAllSubcomponents()
      .some((c) => !["vevent", "vtimezone"].includes(c.name))
  )
    result.warnings.push("予定以外の要素（タスクなど）は取り込まれません");
  return result;
}
export function applyIcs(p: Project, data: IcsImport) {
  for (const e of data.events) {
    if (p.sessions.some((s) => s.icsUid === e.uid)) continue;
    let venue = p.venues.find((v) => v.name === e.location);
    if (e.location && !venue) {
      venue = {
        id: uid(),
        name: e.location,
        description: "",
        color: "#c7decf",
        order: p.venues.length,
        notes: "",
        capacity: 1,
        availableStart: "",
        availableEnd: "",
      };
      p.venues.push(venue);
    }
    const programId = uid();
    p.programs.push({
      id: programId,
      name: e.name,
      description: e.description,
      color: "#c7decf",
      tags: [],
      priority: "標準",
      publicNotes: "",
      internalNotes: "",
      url: "",
    });
    const s: Session = {
      id: uid(),
      programId,
      venueId: venue?.id || "",
      start: e.start,
      end: e.end,
      status: "未開始",
      gather: "",
      prepare: "",
      rehearsal: "",
      cleanup: "",
      venuePrepare: "",
      transition: 0,
      allowOverlap: false,
      icsUid: e.uid,
    };
    p.sessions.push(s);
    ensureDays(p, s);
  }
}
