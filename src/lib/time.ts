import { Temporal } from "@js-temporal/polyfill";
export const uid = () => crypto.randomUUID();
export function localInput(iso: string, zone: string) {
  return Temporal.Instant.from(iso)
    .toZonedDateTimeISO(zone)
    .toPlainDateTime()
    .toString({ smallestUnit: "minute" });
}
export function instant(local: string, zone: string) {
  return Temporal.PlainDateTime.from(local)
    .toZonedDateTime(zone, { disambiguation: "reject" })
    .toInstant()
    .toString();
}
export function dateIn(iso: string, zone: string) {
  return Temporal.Instant.from(iso)
    .toZonedDateTimeISO(zone)
    .toPlainDate()
    .toString();
}
export function dayBounds(date: string, zone: string): [number, number] {
  const start = Temporal.PlainDate.from(date).toZonedDateTime(zone);
  return [
    Number(start.epochMilliseconds),
    Number(start.add({ days: 1 }).epochMilliseconds),
  ];
}
export function addDays(date: string, days: number) {
  return Temporal.PlainDate.from(date).add({ days }).toString();
}
export function moveDate(iso: string, date: string, zone: string) {
  const t = Temporal.Instant.from(iso).toZonedDateTimeISO(zone);
  return instant(`${date}T${t.toPlainTime().toString()}`, zone);
}
export function shift(iso: string, minutes: number) {
  return new Date(Date.parse(iso) + minutes * 60000).toISOString();
}
export function clock(iso: string | number, zone: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}
export function stamp(iso: string, zone: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: zone,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
export function dayLabel(date: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}
export const normalize = (s: string) =>
  s.normalize("NFKC").toLocaleLowerCase("ja-JP");
export const collator = new Intl.Collator("ja-JP", { numeric: true });
export const overlaps = (a: number, b: number, c: number, d: number) =>
  a < d && c < b;
export function mergeIntervals(intervals: [number, number][]) {
  const out: [number, number][] = [];
  for (const item of intervals.sort((a, b) => a[0] - b[0])) {
    const prev = out.at(-1);
    if (prev && item[0] <= prev[1]) prev[1] = Math.max(prev[1], item[1]);
    else out.push([...item]);
  }
  return out;
}
/** Wall-clock boundaries follow the event timezone, including 23/25-hour DST days. */
export function displayDayBounds(
  date: string,
  startHour: number,
  endHour: number,
  zone: string,
): [number, number] {
  const boundary = (hour: number) =>
    Temporal.PlainDate.from(date)
      .add({ days: hour === 24 ? 1 : 0 })
      .toPlainDateTime({ hour: hour === 24 ? 0 : hour })
      .toZonedDateTime(zone, { disambiguation: "compatible" })
      .epochMilliseconds;
  return [Number(boundary(startHour)), Number(boundary(endHour))];
}
