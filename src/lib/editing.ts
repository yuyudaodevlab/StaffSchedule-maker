import { Project, Session, validateProject } from "./model";
import { deleteSession, duplicateSession, shiftSession } from "./project";
import { moveDate, uid } from "./time";
export type BatchOptions = {
  action:
    | "shift"
    | "ripple"
    | "copy"
    | "copyDay"
    | "moveDay"
    | "venue"
    | "status"
    | "assign"
    | "delete";
  minutes: number;
  date: string;
  venueId: string;
  status: Session["status"];
  personId: string;
  roleId: string;
  clearPeople: boolean;
};
export function dateShiftMinutes(start: string, date: string, zone: string) {
  return (Date.parse(moveDate(start, date, zone)) - Date.parse(start)) / 60000;
}
export function batchPreview(
  source: Project,
  selected: string[],
  options: BatchOptions,
) {
  const p = structuredClone(source);
  if (!selected.length) throw new Error("予定を選択してください");
  const start = Math.min(
    ...p.sessions
      .filter((s) => selected.includes(s.id))
      .map((s) => Date.parse(s.start)),
  );
  const ids = p.sessions
    .filter((s) =>
      options.action === "ripple"
        ? Date.parse(s.start) >= start
        : selected.includes(s.id),
    )
    .map((s) => s.id);
  const changed: string[] = [];
  if (options.action === "assign" && !options.personId)
    throw new Error("割り当てる人物を選択してください");
  for (const id of ids) {
    const s = p.sessions.find((s) => s.id === id)!;
    const delta = ["copyDay", "moveDay"].includes(options.action)
      ? dateShiftMinutes(s.start, options.date, p.project.timezone)
      : options.minutes;
    if (options.action === "delete") deleteSession(p, id);
    else if (options.action === "venue") s.venueId = options.venueId;
    else if (options.action === "status") s.status = options.status;
    else if (options.action === "assign") {
      if (
        !p.assignments.some(
          (a) =>
            a.sessionId === id &&
            a.personId === options.personId &&
            a.roleId === options.roleId,
        )
      )
        p.assignments.push({
          id: uid(),
          sessionId: id,
          personId: options.personId,
          groupId: "",
          roleId: options.roleId,
          groupMode: "all",
          start: "",
          end: "",
          gather: "",
          notes: "",
        });
    } else if (options.action === "copy" || options.action === "copyDay") {
      changed.push(duplicateSession(p, id, delta, options.clearPeople));
    } else shiftSession(p, id, delta);
  }
  return { project: validateProject(p), ids, changed };
}
