"use client";
import { useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Users,
  MapPin,
  BadgeCheck,
} from "lucide-react";
import { Project, Person, Group, Venue, Role } from "@/lib/model";
import { uid, instant, localInput } from "@/lib/time";
import { palette, sorted } from "@/lib/project";
import { useStore } from "@/stores/project-store";
import { Modal, Field, Empty, Confirm } from "./ui";
export type MasterKind = "people" | "groups" | "venues" | "roles";
const titles = {
  people: "人物",
  groups: "グループ",
  venues: "会場",
  roles: "ロール",
};
type Entity = Person | Group | Venue | Role;
export function Masters({ p, kind }: { p: Project; kind: MasterKind }) {
  const [entity, setEntity] = useState<Entity | null>(null);
  const [deletion, setDeletion] = useState<string | null>(null);
  const [bulk, setBulk] = useState<string | null>(null);
  const edit = useStore((s) => s.edit);
  const [rolePeople, setRolePeople] = useState<string[]>([]);
  const make = (): Entity => {
    const base = {
      id: uid(),
      name: "",
      description: "",
      color: palette[p[kind].length % 6],
      order: p[kind].length,
      notes: "",
    };
    return kind === "people"
      ? { ...base, displayName: "", contact: "", public: true, roleIds: [] }
      : kind === "groups"
        ? { ...base, personIds: [], representativeIds: [] }
        : kind === "venues"
          ? { ...base, capacity: 1, availableStart: "", availableEnd: "" }
          : { ...base, category: "staff" };
  };
  const remove = (id: string) =>
    edit((d) => {
      if (kind === "people") {
        d.people = d.people.filter((x) => x.id !== id);
        d.groups.forEach((g) => {
          g.personIds = g.personIds.filter((x) => x !== id);
          g.representativeIds = g.representativeIds.filter((x) => x !== id);
        });
        d.assignments = d.assignments.filter((a) => a.personId !== id);
        d.settings.hiddenPeople = d.settings.hiddenPeople.filter(
          (x) => x !== id,
        );
      }
      if (kind === "groups") {
        d.groups = d.groups.filter((x) => x.id !== id);
        d.assignments = d.assignments.filter((a) => a.groupId !== id);
      }
      if (kind === "roles") {
        d.roles = d.roles.filter((x) => x.id !== id);
        d.people.forEach(
          (x) => (x.roleIds = x.roleIds.filter((r) => r !== id)),
        );
        d.assignments.forEach((a) => {
          if (a.roleId === id) a.roleId = "";
        });
      }
      if (kind === "venues") {
        d.venues = d.venues.filter((x) => x.id !== id);
        d.sessions.forEach((s) => {
          if (s.venueId === id) s.venueId = "";
        });
      }
      d.presets = d.presets.filter(
        (x) => !Object.values(x.filter).includes(id),
      );
    });
  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">EVENT MEMBERS & PLACES</p>
          <h2>{titles[kind]}を管理</h2>
          <p className="muted">
            イベントを一緒につくる、大切なメンバーと場所。
          </p>
        </div>
        <div className="toolbar">
          {kind === "people" && (
            <button onClick={() => setBulk("")}>名前を一括登録</button>
          )}
          <button
            className="primary"
            onClick={() => {
              setRolePeople([]);
              setEntity(make());
            }}
          >
            <Plus size={17} />
            {titles[kind]}を追加
          </button>
        </div>
      </div>
      <div className="master-grid">
        {sorted(p[kind] as Entity[], p).map((item) => (
          <article className="master-card" key={item.id}>
            <div className="master-icon" style={{ background: item.color }}>
              {kind === "people" || kind === "groups" ? (
                <Users />
              ) : kind === "venues" ? (
                <MapPin />
              ) : (
                <BadgeCheck />
              )}
            </div>
            <h3>{item.name}</h3>
            <p className="muted">{item.description || "説明は未設定です"}</p>
            {"personIds" in item && (
              <p>
                {item.personIds.length}人のメンバー · 代表
                {item.representativeIds.length}人
              </p>
            )}
            {"capacity" in item && <p>同時利用可能数：{item.capacity}</p>}
            {"public" in item && (
              <p className="small">
                共有時の名前：{item.public ? "公開可能" : "非公開"}
              </p>
            )}
            <div className="toolbar">
              <button
                onClick={() => {
                  setRolePeople(
                    p.people
                      .filter((person) => person.roleIds.includes(item.id))
                      .map((person) => person.id),
                  );
                  setEntity(structuredClone(item));
                }}
              >
                <Pencil size={14} />
                編集
              </button>
              <button
                className="icon-button"
                aria-label={`${item.name}を上に移動`}
                onClick={() =>
                  edit((d) => {
                    const list = d[kind];
                    const sortedList = [...list].sort(
                      (a, b) => a.order - b.order,
                    );
                    const index = sortedList.findIndex((x) => x.id === item.id);
                    if (index > 0) {
                      [sortedList[index - 1], sortedList[index]] = [
                        sortedList[index],
                        sortedList[index - 1],
                      ];
                      sortedList.forEach((x, i) => (x.order = i));
                      d.settings.sort = "manual";
                    }
                  })
                }
              >
                <ArrowUp size={14} />
              </button>
              <button
                className="icon-button"
                aria-label={`${item.name}を下に移動`}
                onClick={() =>
                  edit((d) => {
                    const list = [...d[kind]].sort((a, b) => a.order - b.order);
                    const i = list.findIndex((x) => x.id === item.id);
                    if (i < list.length - 1) {
                      [list[i], list[i + 1]] = [list[i + 1], list[i]];
                      list.forEach((x, n) => (x.order = n));
                      d.settings.sort = "manual";
                    }
                  })
                }
              >
                <ArrowDown size={14} />
              </button>
              <button
                className="icon-button danger"
                aria-label={`${item.name}を削除`}
                onClick={() => setDeletion(item.id)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </article>
        ))}
      </div>
      {!p[kind].length && <Empty title={`${titles[kind]}を登録しましょう`} />}
      {entity && (
        <Modal title={`${titles[kind]}の編集`} onClose={() => setEntity(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              edit((d) => {
                const items = d[kind] as Entity[];
                const i = items.findIndex((x) => x.id === entity.id);
                if (i < 0) items.push(entity);
                else items[i] = entity;
                if (kind === "roles")
                  d.people.forEach((person) => {
                    person.roleIds = rolePeople.includes(person.id)
                      ? [...new Set([...person.roleIds, entity.id])]
                      : person.roleIds.filter((id) => id !== entity.id);
                  });
              });
              setEntity(null);
            }}
          >
            <div className="form-grid">
              <Field label="名前 *">
                <input
                  required
                  autoFocus
                  value={entity.name}
                  onChange={(e) =>
                    setEntity({ ...entity, name: e.target.value })
                  }
                />
              </Field>
              <Field label="色">
                <input
                  type="color"
                  value={entity.color}
                  onChange={(e) =>
                    setEntity({ ...entity, color: e.target.value })
                  }
                />
              </Field>
            </div>
            <Field label="説明">
              <textarea
                value={entity.description}
                onChange={(e) =>
                  setEntity({ ...entity, description: e.target.value })
                }
              />
            </Field>
            <Field label="備考（非公開）">
              <textarea
                value={entity.notes}
                onChange={(e) =>
                  setEntity({ ...entity, notes: e.target.value })
                }
              />
            </Field>
            {"public" in entity && (
              <>
                <Field label="表示名">
                  <input
                    value={entity.displayName}
                    onChange={(e) =>
                      setEntity({ ...entity, displayName: e.target.value })
                    }
                  />
                </Field>
                <Field label="連絡先（非公開）">
                  <input
                    value={entity.contact}
                    onChange={(e) =>
                      setEntity({ ...entity, contact: e.target.value })
                    }
                  />
                </Field>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={entity.public}
                    onChange={(e) =>
                      setEntity({ ...entity, public: e.target.checked })
                    }
                  />
                  共有データに名前を含めることを許可
                </label>
                <h4>デフォルトロール</h4>
                {p.roles.map((r) => (
                  <label key={r.id} className="check">
                    <input
                      type="checkbox"
                      checked={entity.roleIds.includes(r.id)}
                      onChange={(e) =>
                        setEntity({
                          ...entity,
                          roleIds: e.target.checked
                            ? [...entity.roleIds, r.id]
                            : entity.roleIds.filter((id) => id !== r.id),
                        })
                      }
                    />
                    {r.name}
                  </label>
                ))}
              </>
            )}
            {"category" in entity && (
              <>
                <Field label="共有時の人物分類">
                  <select
                    value={entity.category}
                    onChange={(e) =>
                      setEntity({
                        ...entity,
                        category: e.target.value as "speaker" | "staff",
                      })
                    }
                  >
                    <option value="speaker">登壇者・出演者</option>
                    <option value="staff">スタッフ・その他</option>
                  </select>
                </Field>
                <h4>デフォルトの担当人物</h4>
                <p className="muted small">
                  実際の担当はプログラムごとに設定できます。
                </p>
                {p.people.map((person) => (
                  <label className="check" key={person.id}>
                    <input
                      type="checkbox"
                      checked={rolePeople.includes(person.id)}
                      onChange={(e) =>
                        setRolePeople(
                          e.target.checked
                            ? [...rolePeople, person.id]
                            : rolePeople.filter((id) => id !== person.id),
                        )
                      }
                    />
                    {person.name}
                  </label>
                ))}
              </>
            )}
            {"personIds" in entity && (
              <>
                <h4>メンバー / 代表者</h4>
                {p.people.map((person) => (
                  <div className="toolbar" key={person.id}>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={entity.personIds.includes(person.id)}
                        onChange={(e) =>
                          setEntity({
                            ...entity,
                            personIds: e.target.checked
                              ? [...entity.personIds, person.id]
                              : entity.personIds.filter(
                                  (id) => id !== person.id,
                                ),
                            representativeIds: entity.representativeIds.filter(
                              (id) => id !== person.id,
                            ),
                          })
                        }
                      />
                      {person.name}
                    </label>
                    <label className="check">
                      <input
                        type="checkbox"
                        disabled={!entity.personIds.includes(person.id)}
                        checked={entity.representativeIds.includes(person.id)}
                        onChange={(e) =>
                          setEntity({
                            ...entity,
                            representativeIds: e.target.checked
                              ? [...entity.representativeIds, person.id]
                              : entity.representativeIds.filter(
                                  (id) => id !== person.id,
                                ),
                          })
                        }
                      />
                      代表者
                    </label>
                  </div>
                ))}
              </>
            )}
            {"capacity" in entity && (
              <>
                <Field label="同時利用可能数">
                  <input
                    type="number"
                    min="1"
                    required
                    value={entity.capacity}
                    onChange={(e) =>
                      setEntity({ ...entity, capacity: Number(e.target.value) })
                    }
                  />
                </Field>
                {(["availableStart", "availableEnd"] as const).map((key, i) => (
                  <Field label={i ? "利用可能終了" : "利用可能開始"} key={key}>
                    <input
                      type="datetime-local"
                      value={
                        entity[key]
                          ? localInput(entity[key], p.project.timezone)
                          : ""
                      }
                      onChange={(e) => {
                        try {
                          setEntity({
                            ...entity,
                            [key]: e.target.value
                              ? instant(e.target.value, p.project.timezone)
                              : "",
                          });
                        } catch {}
                      }}
                    />
                  </Field>
                ))}
              </>
            )}
            <footer>
              <button className="primary" type="submit">
                保存する
              </button>
            </footer>
          </form>
        </Modal>
      )}
      {deletion && (
        <Confirm
          title={`${titles[kind]}を削除しますか？`}
          onClose={() => setDeletion(null)}
          onConfirm={() => remove(deletion)}
        >
          参照している担当情報を解除します。プログラム本体は残ります。
        </Confirm>
      )}
      {bulk !== null && (
        <Modal title="人物を一括登録" onClose={() => setBulk(null)}>
          <Field label="1行に1人の名前を入力">
            <textarea
              rows={10}
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              placeholder={"田中 はるか\n佐藤 みのり"}
            />
          </Field>
          <footer>
            <button
              className="primary"
              onClick={() => {
                edit((d) => {
                  bulk
                    .split(/\r?\n/)
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .forEach((name) =>
                      d.people.push({
                        id: uid(),
                        name,
                        displayName: name,
                        description: "",
                        notes: "",
                        contact: "",
                        public: true,
                        roleIds: [],
                        color: palette[d.people.length % 6],
                        order: d.people.length,
                      }),
                    );
                });
                setBulk(null);
              }}
            >
              登録する
            </button>
          </footer>
        </Modal>
      )}
    </>
  );
}
