"use client";
import { ShareSnapshot } from "@/lib/sharing";
import { stamp, dateIn } from "@/lib/time";
export function PrintSchedule({
  data,
  group,
}: {
  data: ShareSnapshot;
  group: "none" | "date" | "venue";
}) {
  const groups = new Map<string, ShareSnapshot["entries"]>();
  for (const e of data.entries) {
    const key =
      group === "date"
        ? e.start
          ? dateIn(e.start, data.timezone)
          : "日時未共有"
        : group === "venue"
          ? e.venue || "会場未共有"
          : "全スケジュール";
    groups.set(key, [...(groups.get(key) || []), e]);
  }
  return (
    <div className="print-content">
      {[...groups].map(([name, entries]) => (
        <section className="print-section" key={name}>
          <table>
            <thead>
              <tr>
                <th colSpan={4}>
                  <h1>{data.name}</h1>
                  <p>
                    {name} / {data.timezone}
                  </p>
                </th>
              </tr>
              <tr>
                <th>実施時刻</th>
                <th>プログラム / 会場</th>
                <th>担当 / 担当時間</th>
                <th>運営情報 / 公開メモ</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td>
                    {e.start && stamp(e.start, data.timezone)}
                    <br />
                    {e.end && `〜 ${stamp(e.end, data.timezone)}`}
                  </td>
                  <td>
                    <b>{e.name || "予定"}</b>
                    <p>{e.venue}</p>
                    <p>{e.status}</p>
                  </td>
                  <td>
                    {e.people?.map((person, i) => (
                      <p key={i}>
                        {person.name}
                        {person.role && ` / ${person.role}`}
                        <br />
                        {person.start && stamp(person.start, data.timezone)}
                        {person.end && `〜${stamp(person.end, data.timezone)}`}
                        {person.gather &&
                          `（集合 ${stamp(person.gather, data.timezone)}）`}
                      </p>
                    ))}
                    {e.groups?.join("・")}
                    <br />
                    {e.roles?.join("・")}
                  </td>
                  <td>
                    {(
                      ["gather", "prepare", "rehearsal", "cleanup"] as const
                    ).map(
                      (key, i) =>
                        e[key] && (
                          <p key={key}>
                            {["集合", "準備", "リハーサル", "撤収"][i]}{" "}
                            {stamp(e[key]!, data.timezone)}
                          </p>
                        ),
                    )}
                    <p>{e.notes}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
