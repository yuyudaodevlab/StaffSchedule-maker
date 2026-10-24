import test from "node:test";
import assert from "node:assert/strict";
import { timelineRegions } from "../src/lib/timeline-image";

test("timeline image tiles cover the full content without gaps and repeat headers", () => {
  for (const [width, height, hw, hh] of [
    [10000, 9000, 360, 44],
    [8000, 12000, 80, 90],
  ]) {
    const tiles = timelineRegions(width, height, hw, hh);
    const columns = tiles.filter((t) => t.top === 0);
    const rows = tiles.filter((t) => t.left === 0);
    assert.equal(
      columns.reduce((sum, t) => sum + t.width - hw, 0),
      width - hw,
    );
    assert.equal(
      rows.reduce((sum, t) => sum + t.height - hh, 0),
      height - hh,
    );
    columns
      .slice(1)
      .forEach((t, i) =>
        assert.equal(t.left, columns[i].left + columns[i].width - hw),
      );
    rows
      .slice(1)
      .forEach((t, i) =>
        assert.equal(t.top, rows[i].top + rows[i].height - hh),
      );
    assert.ok(tiles.every((t) => t.width <= 3600 && t.height <= 2000));
  }
});
test("timeline image keeps a normal timetable in one image and bounds excessive output", () => {
  assert.deepEqual(timelineRegions(2880, 1160, 360, 44), [
    { left: 0, top: 0, width: 2880, height: 1160 },
  ]);
  assert.throws(() => timelineRegions(100000, 100000, 360, 44), /100枚/);
});
