import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import Dexie from "dexie";
import { useStore } from "../src/stores/project-store";
import { sampleProject } from "../src/lib/project";
test("IndexedDBの保存・再読込・原子的な編集・Undo/Redo", async () => {
  const store = useStore.getState();
  await store.load();
  const project = sampleProject();
  await store.add(project);
  store.open(project.project.id);
  assert.equal(
    store.edit((p) => {
      p.project.name = "保存テスト";
      p.people[0].name = "更新人物";
    }),
    true,
  );
  await store.save();
  assert.equal(useStore.getState().status, "保存済み");
  store.undo();
  assert.equal(useStore.getState().current?.project.name, project.project.name);
  store.redo();
  assert.equal(useStore.getState().current?.project.name, "保存テスト");
  assert.equal(
    store.edit((p) => {
      p.sessions[0].end = p.sessions[0].start;
    }),
    false,
  );
  assert.ok(
    useStore.getState().current!.sessions[0].end !==
      useStore.getState().current!.sessions[0].start,
  );
  await store.save();
  await store.close();
  await store.load();
  store.open(project.project.id);
  assert.equal(useStore.getState().current?.people[0].name, "更新人物");
  assert.equal(useStore.getState().current?.project.name, "保存テスト");
  await store.close();
  await store.remove(project.project.id);
  assert.ok(
    !useStore
      .getState()
      .projects.some((p) => p.project.id === project.project.id),
  );
});
