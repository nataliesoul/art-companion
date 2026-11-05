// Geometry tests for the rule-of-thirds guide. Runs with plain Node, no packages:
//   node tests/grid.test.js
const assert = require("assert");
const guide = require("../public/grid.js");

function approx(actual, expected, label) {
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `${label}: expected ${expected}, got ${actual}`
  );
}

// Unit-square quad tapped in scrambled order still orders TL, TR, BR, BL.
const scrambled = [
  { x: 1, y: 1 },
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: 1 }
];
const ordered = guide.orderCorners(scrambled);
assert.deepStrictEqual(ordered, [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 }
]);

// Thirds of a unit square fall exactly on the 1/3 and 2/3 lines.
const lines = guide.thirdsLines(ordered);
assert.strictEqual(lines.length, 4);
approx(lines[0].x1, 1 / 3, "v1 top x");
approx(lines[0].y1, 0, "v1 top y");
approx(lines[0].x2, 1 / 3, "v1 bottom x");
approx(lines[0].y2, 1, "v1 bottom y");
approx(lines[1].x1, 2 / 3, "v2 top x");
approx(lines[1].x2, 2 / 3, "v2 bottom x");
approx(lines[2].y1, 1 / 3, "h1 left y");
approx(lines[2].x2, 1, "h1 right x");
approx(lines[3].y1, 2 / 3, "h2 left y");

// A perspective-tilted quad interpolates along its own edges, not the screen axes.
const tilted = guide.orderCorners([
  { x: 0.2, y: 0.1 },
  { x: 0.9, y: 0.2 },
  { x: 0.8, y: 0.9 },
  { x: 0.1, y: 0.8 }
]);
assert.deepStrictEqual(tilted, [
  { x: 0.2, y: 0.1 },
  { x: 0.9, y: 0.2 },
  { x: 0.8, y: 0.9 },
  { x: 0.1, y: 0.8 }
]);
const tiltedLines = guide.thirdsLines(tilted);
// Top edge runs (0.2,0.1)->(0.9,0.2): first vertical line starts 1/3 along it.
approx(tiltedLines[0].x1, 0.2 + (0.9 - 0.2) / 3, "tilted v1 top x");
approx(tiltedLines[0].y1, 0.1 + (0.2 - 0.1) / 3, "tilted v1 top y");

// Wrong input fails loudly instead of drawing a bogus grid.
assert.throws(() => guide.orderCorners([{ x: 0, y: 0 }]), /exactly 4/);

// Registry holds all 30 guides with unique ids.
assert.strictEqual(guide.GUIDES.length, 30);
assert.strictEqual(new Set(guide.GUIDES.map(g => g.id)).size, 30);
guide.GUIDES.forEach(g => {
  assert.ok(g.name && g.blurb && g.group, `${g.id} registry entry complete`);
});

// Every guide traces finite in-range polylines on a tilted quad.
const tiltedQuad = guide.orderCorners([
  { x: 0.9, y: 0.2 },
  { x: 0.15, y: 0.85 },
  { x: 0.2, y: 0.1 },
  { x: 0.8, y: 0.9 }
]);
for (const g of guide.GUIDES) {
  const polys = guide.traceGuide(g.id, tiltedQuad, 1.5);
  assert.ok(polys.length >= 1, `${g.id}: no polylines`);
  polys.forEach((poly, pi) => {
    assert.ok(poly.length >= 2, `${g.id} poly ${pi}: too short`);
    poly.forEach(p => {
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), `${g.id}: non-finite point`);
      assert.ok(p.x >= -1e-9 && p.x <= 1 + 1e-9, `${g.id}: x out of range (${p.x})`);
      assert.ok(p.y >= -1e-9 && p.y <= 1 + 1e-9, `${g.id}: y out of range (${p.y})`);
    });
  });
}
assert.throws(() => guide.traceGuide("no-such-guide", tiltedQuad, 1), /unknown guide/);
assert.throws(() => guide.traceGuide("thirds", [{ x: 0, y: 0 }], 1), /ordered quad/);

// The thirds overlay matches the original thirds construction end to end.
const legacy = guide.thirdsLines(tiltedQuad);
const traced = guide.traceGuide("thirds", tiltedQuad, 1.5);
assert.strictEqual(traced.length, 4);
traced.forEach((poly, i) => {
  approx(poly[0].x, legacy[i].x1, `thirds ${i} start x`);
  approx(poly[0].y, legacy[i].y1, `thirds ${i} start y`);
  approx(poly[poly.length - 1].x, legacy[i].x2, `thirds ${i} end x`);
  approx(poly[poly.length - 1].y, legacy[i].y2, `thirds ${i} end y`);
});

// Diagonal method: truly 45 degrees in physical space at aspect 2.
const rays = guide.traceUv("diagonal-method", 2);
assert.strictEqual(rays.length, 4);
approx(rays[0][1].x, 0.5, "diagonal-method TL end x");
approx(rays[0][1].y, 1, "diagonal-method TL end y");
approx((rays[0][1].x - rays[0][0].x) * 2, rays[0][1].y - rays[0][0].y, "diagonal-method 45deg");

// Rabatment on 2:1 landscape art puts the square edge at u = 0.5.
const rab = guide.traceUv("rabatment", 2);
assert.ok(rab.some(poly =>
  poly.length === 2 &&
  Math.abs(poly[0].x - 0.5) < 1e-9 && Math.abs(poly[1].x - 0.5) < 1e-9 &&
  Math.abs(poly[0].y - 0) < 1e-9 && Math.abs(poly[1].y - 1) < 1e-9
), "rabatment square edge");

// Golden triangle: feet land on the diagonal, perpendicular in aspect space.
const gt = guide.traceUv("golden-triangle", 1.5);
assert.strictEqual(gt.length, 3);
gt.slice(1).forEach((seg, i) => {
  const foot = seg[1];
  approx(foot.x + foot.y, 1, `golden-triangle foot ${i} on diagonal`);
  const px = seg[0].x * 1.5 - foot.x * 1.5;
  const py = seg[0].y - foot.y;
  const dot = px * 1.5 + py * -1; // diagonal direction in aspect space
  approx(dot, 0, `golden-triangle foot ${i} perpendicular`);
});

// Segment clipping: inside passes through, outside vanishes, crossing trims.
const through = guide.clipSegment({ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.8 });
approx(through[0].x, 0.2, "clip passthrough x1");
approx(through[0].y, 0.2, "clip passthrough y1");
approx(through[1].x, 0.8, "clip passthrough x2");
approx(through[1].y, 0.8, "clip passthrough y2");
assert.strictEqual(guide.clipSegment({ x: 2, y: 2 }, { x: 3, y: 3 }), null);
const clipped = guide.clipSegment({ x: -1, y: 0.5 }, { x: 2, y: 0.5 });
approx(clipped[0].x, 0, "clip left x");
approx(clipped[1].x, 1, "clip right x");

// Golden spiral tiling: 7 Fibonacci squares in a 13x21 box, arcs chained.
const tiling = guide.goldenSpiralTiling();
assert.strictEqual(tiling.squares.length, 7);
assert.strictEqual(tiling.box.x1 - tiling.box.x0, 13);
assert.strictEqual(tiling.box.y1 - tiling.box.y0, 21);
assert.strictEqual(tiling.arcs.length, 7);
function samePt(a, b) {
  return Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9;
}
tiling.arcs.forEach((arc, i) => {
  const { square: sq, center, from, to } = arc;
  // Endpoints span the square diagonally; center is a square corner.
  assert.ok(Math.abs(Math.abs(from.x - to.x) - sq.s) < 1e-9, `spiral arc ${i} diagonal x`);
  assert.ok(Math.abs(Math.abs(from.y - to.y) - sq.s) < 1e-9, `spiral arc ${i} diagonal y`);
  const dc = Math.hypot(center.x - from.x, center.y - from.y);
  const dc2 = Math.hypot(center.x - to.x, center.y - to.y);
  approx(dc, sq.s, `spiral arc ${i} radius from`);
  approx(dc2, sq.s, `spiral arc ${i} radius to`);
  // Quarter-circle sweep.
  const a0 = Math.atan2(from.y - center.y, from.x - center.x);
  const a1 = Math.atan2(to.y - center.y, to.x - center.x);
  let d = a1 - a0;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  approx(Math.abs(d), Math.PI / 2, `spiral arc ${i} quarter sweep`);
  // Consecutive arcs share exactly one endpoint.
  if (i < tiling.arcs.length - 1) {
    const next = tiling.arcs[i + 1];
    const ends = [from, to].filter(p => samePt(p, next.from) || samePt(p, next.to));
    assert.strictEqual(ends.length, 1, `spiral arcs ${i}/${i + 1} chained`);
  }
});

// Auto-pick: visual energy laid exactly on a guide's lines selects it.
// Energy maps derive from each guide's own traced lines, so float cell
// edges cannot skew the fixture.
function cellsUnder(id, aspect, n) {
  const cells = new Set();
  for (const poly of guide.traceUv(id, aspect)) {
    for (let i = 0; i + 1 < poly.length; i++) {
      const a = poly[i];
      const b = poly[i + 1];
      for (let s = 0; s <= 200; s++) {
        const u = a.x + (b.x - a.x) * (s / 200);
        const v = a.y + (b.y - a.y) * (s / 200);
        if (u < 0 || u > 1 || v < 0 || v > 1) continue;
        cells.add(Math.floor(v * n) * n + Math.floor(u * n));
      }
    }
    if (poly.length === 1) {
      cells.add(Math.floor(poly[0].y * n) * n + Math.floor(poly[0].x * n));
    }
  }
  const w = new Array(n * n).fill(0);
  for (const c of cells) w[c] = 1;
  return w;
}

const thirdsMap = cellsUnder("thirds", 1, 12);
assert.strictEqual(guide.autoPickGuide(thirdsMap, 12, 12, 1).id, "thirds");
assert.ok(
  guide.scoreGuide("thirds", 1, thirdsMap, 12, 12) >
  guide.scoreGuide("quadrants", 1, thirdsMap, 12, 12),
  "thirds outscores quadrants on thirds energy"
);

const quadMap = cellsUnder("quadrants", 1, 12);
assert.strictEqual(guide.autoPickGuide(quadMap, 12, 12, 1).id, "quadrants");

const spiralMap = cellsUnder("golden-spiral", 1, 24);
assert.strictEqual(guide.autoPickGuide(spiralMap, 24, 24, 1).id, "golden-spiral");

// Flat or empty maps tie everywhere: catalog order wins (thirds first).
assert.strictEqual(guide.autoPickGuide(new Array(144).fill(0.5), 12, 12, 1).id, "thirds");
assert.strictEqual(guide.autoPickGuide(new Array(144).fill(0), 12, 12, 1).id, "thirds");

// Placement aids never win, even when the energy matches their lines.
const aidPick = guide.autoPickGuide(cellsUnder("alignment", 1, 12), 12, 12, 1);
assert.notStrictEqual(aidPick.id, "alignment");
const aidGroup = guide.GUIDES.find(g => g.id === aidPick.id).group;
assert.ok(aidGroup === "geometry" || aidGroup === "perspective", "auto-pick avoids aids");

console.log("grid tests passed: ordering, thirds, 30-guide traces, clip, spiral, guards, auto-pick.");
