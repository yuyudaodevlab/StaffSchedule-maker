import { ShareSnapshot } from "./sharing";
import { clock, stamp } from "./time";
export function download(
  content: BlobPart,
  name: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export type ImageOptions = {
  scale: number;
  fontSize: number;
  background: string;
  title: boolean;
  notes: boolean;
  legend: boolean;
  padding: number;
  width: number;
  tick?: number;
  venue?: boolean;
  date?: boolean;
};
/** Separate renderer: never captures the scroll viewport. Text wraps and long rows continue on the next sheet. */
export async function renderImages(
  data: ShareSnapshot,
  options: ImageOptions,
): Promise<string[]> {
  await document.fonts.ready;
  const { scale, fontSize, padding, width } = options;
  if (
    !Number.isFinite(scale) ||
    scale < 1 ||
    scale > 3 ||
    fontSize < 10 ||
    fontSize > 24 ||
    padding < 10 ||
    padding > 80 ||
    width < 1000 ||
    width > 2000
  )
    throw new Error("画像の設定値を確認してください");
  const rgb = [1, 3, 5].map((i) =>
    parseInt(options.background.slice(i, i + 2), 16),
  );
  const dark = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000 < 130;
  const ink = dark ? "#f2e7d9" : "#493c34",
    muted = dark ? "#c4b6a5" : "#756658";
  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) throw new Error("画像を作成できません");
  measure.font = `${fontSize}px sans-serif`;
  const labelWidth = Math.round((width - padding * 2) * 0.36);
  const lineHeight = fontSize * 1.6;
  function wrap(text: string, maxWidth: number) {
    const lines: string[] = [];
    let line = "";
    for (const char of text) {
      if (char === "\n") {
        lines.push(line);
        line = "";
        continue;
      }
      if (measure!.measureText(line + char).width > maxWidth && line) {
        lines.push(line);
        line = char;
      } else line += char;
    }
    if (line) lines.push(line);
    return lines;
  }
  const titleLines = options.title ? wrap(data.name, width - padding * 2) : [];
  const header = padding + titleLines.length * lineHeight + 65;
  const maxHeight = 4000 / scale;
  const capacity = maxHeight - header - padding - 35;
  const maxLines = Math.max(1, Math.floor((capacity - 20) / lineHeight));
  const timed = data.entries.filter((e) => e.start && e.end);
  const globalStart = timed.length
    ? Math.floor(
        Math.min(...timed.map((e) => Date.parse(e.start!))) / 3600000,
      ) * 3600000
    : 0;
  const globalEnd = timed.length
    ? Math.ceil(Math.max(...timed.map((e) => Date.parse(e.end!))) / 3600000) *
      3600000
    : 3600000;
  type Row = {
    entry: ShareSnapshot["entries"][number];
    lines: string[];
    height: number;
    continued: boolean;
  };
  const rows: Row[] = [];
  for (const entry of data.entries) {
    const strings = [
      entry.name || "予定",
      options.venue !== false ? entry.venue || "" : "",
      ...(entry.people || []).map(
        (person) =>
          `${person.name}${person.role ? " / " + person.role : ""}${person.start && person.end ? " 担当 " + stamp(person.start, data.timezone) + "–" + stamp(person.end, data.timezone) : ""}${person.gather ? " 集合 " + stamp(person.gather, data.timezone) : ""}`,
      ),
      ...(entry.groups || []),
      ...(entry.roles || []),
      entry.status || "",
      ...(entry.tags || []),
      ...(options.notes && entry.notes ? [entry.notes] : []),
    ].filter(Boolean);
    const lines = strings.flatMap((s) => wrap(s, labelWidth - 25));
    for (let i = 0; i < Math.max(1, lines.length); i += maxLines) {
      const part = lines.slice(i, i + maxLines);
      rows.push({
        entry,
        lines: part,
        height: Math.max(85, part.length * lineHeight + 24),
        continued: i > 0,
      });
    }
  }
  const pages: Row[][] = [];
  let page: Row[] = [],
    used = 0;
  for (const row of rows) {
    if (used + row.height > capacity && page.length) {
      pages.push(page);
      page = [];
      used = 0;
    }
    page.push(row);
    used += row.height;
  }
  if (page.length || !pages.length) pages.push(page);
  if (pages.length > 100)
    throw new Error("出力が100枚を超えます。日付や人物で絞り込んでください");
  const urls: string[] = [];
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const entries = pages[pageIndex];
    const height =
      header + entries.reduce((sum, r) => sum + r.height, 0) + padding + 35;
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = Math.ceil(height * scale);
    const c = canvas.getContext("2d");
    if (!c) throw new Error("画像を作成できません");
    c.scale(scale, scale);
    c.fillStyle = options.background;
    c.fillRect(0, 0, width, height);
    c.fillStyle = ink;
    c.font = `bold ${fontSize}px sans-serif`;
    titleLines.forEach((line, i) =>
      c.fillText(line, padding, padding + lineHeight * (i + 1)),
    );
    c.font = `${Math.max(10, fontSize - 2)}px sans-serif`;
    c.fillText(
      `${data.timezone} · ${pageIndex + 1}/${pages.length}`,
      padding,
      header - 35,
    );
    const left = padding + labelWidth,
      span = width - padding - left;
    const duration = Math.max(60000, globalEnd - globalStart);
    const minimumTick = options.tick || 30;
    const tick = Math.max(
      minimumTick,
      Math.ceil(duration / 60000 / Math.max(1, span / 100) / minimumTick) *
        minimumTick,
    );
    let lastLabelEnd = -Infinity;
    for (let t = globalStart; t <= globalEnd; t += tick * 60000) {
      const x = left + ((t - globalStart) / duration) * span;
      c.strokeStyle = dark ? "#51463d" : "#e5ddd2";
      c.beginPath();
      c.moveTo(x, header);
      c.lineTo(x, height - padding - 30);
      c.stroke();
      c.fillStyle = muted;
      const label =
        options.date === false
          ? clock(t, data.timezone)
          : stamp(new Date(t).toISOString(), data.timezone);
      const labelWidth = c.measureText(label).width;
      const labelX = Math.min(x, width - padding - labelWidth);
      if (labelX > lastLabelEnd + 10) {
        c.fillText(label, labelX, header - 12);
        lastLabelEnd = labelX + labelWidth;
      }
    }
    let y = header;
    entries.forEach((row, index) => {
      const e = row.entry;
      c.fillStyle = dark
        ? index % 2
          ? "#41372f"
          : "#302924"
        : index % 2
          ? "#f2ece2"
          : "#fffcf6";
      c.fillRect(padding, y, labelWidth, row.height - 4);
      c.fillStyle = ink;
      c.font = `${fontSize}px sans-serif`;
      row.lines.forEach((line, i) =>
        c.fillText(line, padding + 10, y + 18 + i * lineHeight),
      );
      if (row.continued) {
        c.font = "10px sans-serif";
        c.fillText("（続き）", padding + labelWidth - 48, y + 12);
      }
      if (e.start && e.end) {
        const x =
            left + ((Date.parse(e.start) - globalStart) / duration) * span,
          w = Math.max(
            2,
            ((Date.parse(e.end) - Date.parse(e.start)) / duration) * span,
          );
        c.fillStyle = e.color;
        c.beginPath();
        c.roundRect(x, y + 12, w, 27, Math.min(w / 2, 6));
        c.fill();
        c.fillStyle = ink;
        c.font = `${Math.max(10, fontSize - 2)}px sans-serif`;
        const label =
          options.date === false
            ? `${clock(e.start, data.timezone)}–${clock(e.end, data.timezone)}`
            : `${stamp(e.start, data.timezone)}–${stamp(e.end, data.timezone)}`;
        wrap(label, span - 16).forEach((line, i) =>
          c.fillText(line, left + 8, y + 58 + i * lineHeight),
        );
      }
      y += row.height;
    });
    if (options.legend) {
      c.fillStyle = muted;
      c.font = "11px sans-serif";
      c.fillText(
        "帯：実施時間 / 左欄：担当者・担当時間 / 時間軸は全ページ共通です",
        padding,
        height - 15,
      );
    }
    const url = canvas.toDataURL("image/png");
    if (url === "data:,")
      throw new Error("画像サイズが上限を超えました。解像度を下げてください");
    urls.push(url);
    canvas.width = 1;
    canvas.height = 1;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  return urls;
}
