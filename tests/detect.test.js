// Quad detection tests. Runs with plain Node, no packages:
//   node tests/detect.test.js
const assert = require("assert");
const detect = require("../public/detect.js");

// Deterministic PRNG so RANSAC results are reproducible in tests.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Even-odd scanline fill of a quad [x0,y0,...] onto an RGBA buffer.
function paintQuad(buf, w, h, quad, color) {
  for (let y = 0; y < h; y++) {
    const xs = [];
    for (let i = 0; i < 4; i++) {
      const ax = quad[i * 2];
      const ay = quad[i * 2 + 1];
      const bx = quad[((i + 1) % 4) * 2];
      const by = quad[((i + 1) % 4) * 2 + 1];
      if ((ay > y + 0.5) !== (by > y + 0.5)) {
        xs.push(ax + ((y + 0.5 - ay) / (by - ay)) * (bx - ax));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.ceil(xs[k]); x < xs[k + 1]; x++) {
        if (x < 0 || x >= w) continue;
        const o = (y * w + x) * 4;
        buf[o] = color;
        buf[o + 1] = color;
        buf[o + 2] = color;
        buf[o + 3] = 255;
      }
    }
  }
}

function makeImage(w, h, bg) {
  const buf = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    buf[i * 4] = bg;
    buf[i * 4 + 1] = bg;
    buf[i * 4 + 2] = bg;
    buf[i * 4 + 3] = 255;
  }
  return buf;
}

// Matches found corners (fractions, any order) against expected pixels.
function expectCorners(found, w, h, expected, tolPx, label) {
  assert.ok(found && found.length === 4, `${label}: expected 4 corners`);
  const used = new Array(4).fill(false);
  expected.forEach(([ex, ey]) => {
    let best = -1;
    let bestD = Infinity;
    found.forEach((p, i) => {
      if (used[i]) return;
      const d = Math.hypot(p.x * w - ex, p.y * h - ey);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    assert.ok(best >= 0 && bestD <= tolPx, `${label}: corner near (${ex},${ey}) off by ${bestD}`);
    used[best] = true;
  });
}

const W = 100;
const H = 80;

// Axis-aligned white rect on black.
{
  const buf = makeImage(W, H, 0);
  paintQuad(buf, W, H, [20, 15, 80, 15, 80, 65, 20, 65], 255);
  const found = detect.detectQuad(buf, W, H, { rand: mulberry32(7) });
  expectCorners(found, W, H, [[20, 15], [80, 15], [80, 65], [20, 65]], 2, "axis rect");
}

// Skewed quad (mild perspective).
{
  const buf = makeImage(W, H, 0);
  const q = [15, 10, 85, 25, 75, 70, 10, 60];
  paintQuad(buf, W, H, q, 255);
  const found = detect.detectQuad(buf, W, H, { rand: mulberry32(7) });
  expectCorners(found, W, H, [[15, 10], [85, 25], [75, 70], [10, 60]], 2.5, "skewed quad");
}

// Rotated rect (~15 degrees) on mid-gray.
{
  const cx = 50;
  const cy = 40;
  const a = (15 * Math.PI) / 180;
  const hw = 30;
  const hh = 22;
  const corners = [];
  [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].forEach(([dx, dy]) => {
    corners.push(cx + dx * Math.cos(a) - dy * Math.sin(a));
    corners.push(cy + dx * Math.sin(a) + dy * Math.cos(a));
  });
  const buf = makeImage(W, H, 90);
  paintQuad(buf, W, H, corners, 230);
  const found = detect.detectQuad(buf, W, H, { rand: mulberry32(7) });
  expectCorners(
    found,
    W,
    H,
    [[corners[0], corners[1]], [corners[2], corners[3]], [corners[4], corners[5]], [corners[6], corners[7]]],
    2.5,
    "rotated rect"
  );
}

// Skewed quad under moderate noise still resolves.
{
  const rand = mulberry32(21);
  const buf = makeImage(W, H, 0);
  paintQuad(buf, W, H, [15, 10, 85, 25, 75, 70, 10, 60], 255);
  for (let i = 0; i < buf.length; i += 4) {
    const n = Math.floor((rand() - 0.5) * 36);
    buf[i] = Math.max(0, Math.min(255, buf[i] + n));
    buf[i + 1] = Math.max(0, Math.min(255, buf[i + 1] + n));
    buf[i + 2] = Math.max(0, Math.min(255, buf[i + 2] + n));
  }
  const found = detect.detectQuad(buf, W, H, { rand: mulberry32(7) });
  expectCorners(found, W, H, [[15, 10], [85, 25], [75, 70], [10, 60]], 3, "noisy quad");
}

// Strong perspective: steep trapezoid shot from the side.
{
  const buf = makeImage(W, H, 0);
  const q = [8, 35, 92, 15, 78, 72, 18, 76];
  paintQuad(buf, W, H, q, 255);
  const found = detect.detectQuad(buf, W, H, { rand: mulberry32(7) });
  expectCorners(found, W, H, [[8, 35], [92, 15], [78, 72], [18, 76]], 3, "steep trapezoid");
}

// Strong perspective from below: tall keystone.
{
  const buf = makeImage(W, H, 0);
  const q = [30, 5, 70, 5, 88, 74, 12, 74];
  paintQuad(buf, W, H, q, 255);
  const found = detect.detectQuad(buf, W, H, { rand: mulberry32(7) });
  expectCorners(found, W, H, [[30, 5], [70, 5], [88, 74], [12, 74]], 3, "keystone");
}

// Real artwork has content: interior bars must not steal the quad.
{
  const buf = makeImage(W, H, 0);
  const q = [15, 10, 85, 25, 75, 70, 10, 60];
  paintQuad(buf, W, H, q, 255);
  // Dark diagonal bar and a gray block inside the artwork.
  paintQuad(buf, W, H, [30, 30, 70, 38, 68, 46, 28, 38], 40);
  paintQuad(buf, W, H, [45, 45, 60, 47, 58, 60, 43, 58], 120);
  const found = detect.detectQuad(buf, W, H, { rand: mulberry32(7) });
  expectCorners(found, W, H, [[15, 10], [85, 25], [75, 70], [10, 60]], 3, "cluttered quad");
}

// Steep trapezoid under noise.
{
  const rand = mulberry32(33);
  const buf = makeImage(W, H, 0);
  paintQuad(buf, W, H, [8, 35, 92, 15, 78, 72, 18, 76], 255);
  for (let i = 0; i < buf.length; i += 4) {
    const n = Math.floor((rand() - 0.5) * 36);
    buf[i] = Math.max(0, Math.min(255, buf[i] + n));
    buf[i + 1] = Math.max(0, Math.min(255, buf[i + 1] + n));
    buf[i + 2] = Math.max(0, Math.min(255, buf[i + 2] + n));
  }
  const found = detect.detectQuad(buf, W, H, { rand: mulberry32(7) });
  expectCorners(found, W, H, [[8, 35], [92, 15], [78, 72], [18, 76]], 3, "noisy trapezoid");
}

// Tall narrow artwork: short sides need the relaxed fallback pass.
{
  const buf = makeImage(W, H, 0);
  paintQuad(buf, W, H, [38, 4, 62, 4, 58, 76, 34, 76], 255);
  const found = detect.detectQuad(buf, W, H, { rand: mulberry32(7) });
  expectCorners(found, W, H, [[38, 4], [62, 4], [58, 76], [34, 76]], 3, "tall narrow");
}

// Rotated 30 degrees plus skew.
{
  const buf = makeImage(W, H, 0);
  paintQuad(buf, W, H, [28, 6, 88, 30, 66, 74, 8, 52], 255);
  const found = detect.detectQuad(buf, W, H, { rand: mulberry32(7) });
  expectCorners(found, W, H, [[28, 6], [88, 30], [66, 74], [8, 52]], 3, "rotated skewed");
}

// Nested panel with gapped outer sides (fingers/weak spans): the large
// outer frame must beat the fully-supported interior panel.
{
  const buf = makeImage(W, H, 0);
  paintQuad(buf, W, H, [12, 8, 88, 8, 88, 72, 12, 72], 255);
  paintQuad(buf, W, H, [8, 30, 16, 30, 16, 55, 8, 55], 0);
  paintQuad(buf, W, H, [40, 4, 70, 4, 70, 12, 40, 12], 0);
  paintQuad(buf, W, H, [30, 25, 70, 25, 70, 55, 30, 55], 150);
  const found = detect.detectQuad(buf, W, H, { rand: mulberry32(7) });
  expectCorners(found, W, H, [[12, 8], [88, 8], [88, 72], [12, 72]], 3, "nested gapped");
}

// Weak pastel border with strong interior texture: the sensitive tier
// must recover the outer frame.
{
  const buf = makeImage(W, H, 235);
  paintQuad(buf, W, H, [12, 8, 88, 8, 88, 72, 12, 72], 200);
  paintQuad(buf, W, H, [18, 25, 82, 25, 82, 30, 18, 30], 120);
  paintQuad(buf, W, H, [18, 40, 82, 40, 82, 45, 18, 45], 120);
  paintQuad(buf, W, H, [18, 55, 82, 55, 82, 60, 18, 60], 120);
  const found = detect.detectQuad(buf, W, H, { rand: mulberry32(7) });
  expectCorners(found, W, H, [[12, 8], [88, 8], [88, 72], [12, 72]], 3.5, "pastel texture");
}

// Dark artwork with bright interior bars: weak outer, strong inner.
{
  const buf = makeImage(W, H, 20);
  paintQuad(buf, W, H, [12, 8, 88, 8, 88, 72, 12, 72], 70);
  paintQuad(buf, W, H, [20, 30, 80, 30, 80, 36, 20, 36], 230);
  paintQuad(buf, W, H, [20, 48, 80, 48, 80, 54, 20, 54], 230);
  const found = detect.detectQuad(buf, W, H, { rand: mulberry32(7) });
  expectCorners(found, W, H, [[12, 8], [88, 8], [88, 72], [12, 72]], 3, "dark bright-inner");
}

// Very weak outer border with a strong full-width interior bar: the full
// outer frame must win over the sub-quad the bar invites.
{
  const buf = makeImage(W, H, 235);
  paintQuad(buf, W, H, [12, 8, 88, 8, 88, 72, 12, 72], 210);
  paintQuad(buf, W, H, [12, 40, 88, 40, 88, 46, 12, 46], 100);
  const found = detect.detectQuad(buf, W, H, { rand: mulberry32(7) });
  expectCorners(found, W, H, [[12, 8], [88, 8], [88, 72], [12, 72]], 3.5, "weak outer strong bar");
}

// Harsh impasto model: faint outer border, dense random strokes inside,
// sensor noise. Models a pastel painting on a white wall.
{
  const rand = mulberry32(77);
  const buf = makeImage(W, H, 235);
  paintQuad(buf, W, H, [12, 8, 88, 8, 88, 72, 12, 72], 212);
  for (let s = 0; s < 45; s++) {
    const cx = 16 + rand() * 68;
    const cy = 12 + rand() * 56;
    const a = rand() * Math.PI;
    const len = 4 + rand() * 8;
    const th = 1 + rand() * 1.5;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const nx = -dy;
    const ny = dx;
    paintQuad(
      buf, W, H,
      [
        cx - dx * len - nx * th, cy - dy * len - ny * th,
        cx + dx * len - nx * th, cy + dy * len - ny * th,
        cx + dx * len + nx * th, cy + dy * len + ny * th,
        cx - dx * len + nx * th, cy - dy * len + ny * th
      ],
      100 + Math.floor(rand() * 70)
    );
  }
  for (let i = 0; i < buf.length; i += 4) {
    const n = Math.floor((rand() - 0.5) * 24);
    buf[i] = Math.max(0, Math.min(255, buf[i] + n));
    buf[i + 1] = Math.max(0, Math.min(255, buf[i + 1] + n));
    buf[i + 2] = Math.max(0, Math.min(255, buf[i + 2] + n));
  }
  // Several RANSAC seeds: the frame must win by structure, not luck.
  [7, 0, 5].forEach((seed) => {
    const found = detect.detectQuad(buf, W, H, { rand: mulberry32(seed) });
    expectCorners(found, W, H, [[12, 8], [88, 8], [88, 72], [12, 72]], 4, `impasto wall (seed ${seed})`);
  });
}

// Sensor noise on a blank wall must not hallucinate (sensitive tier guard).
{
  const rand = mulberry32(55);
  const buf = makeImage(W, H, 120);
  for (let i = 0; i < buf.length; i += 4) {
    const n = Math.floor((rand() - 0.5) * 20);
    buf[i] = Math.max(0, Math.min(255, buf[i] + n));
    buf[i + 1] = Math.max(0, Math.min(255, buf[i + 1] + n));
    buf[i + 2] = Math.max(0, Math.min(255, buf[i + 2] + n));
  }
  assert.strictEqual(detect.detectQuad(buf, W, H, { rand: mulberry32(7) }), null, "noise blank");
}

// Degenerate inputs fail closed: blank, tiny, cropped, garbage.
{
  const blank = makeImage(W, H, 120);
  assert.strictEqual(detect.detectQuad(blank, W, H, { rand: mulberry32(7) }), null, "blank");
}
{
  const buf = makeImage(W, H, 0);
  paintQuad(buf, W, H, [45, 35, 55, 35, 55, 45, 45, 45], 255);
  assert.strictEqual(detect.detectQuad(buf, W, H, { rand: mulberry32(7) }), null, "tiny");
}
{
  const buf = makeImage(W, H, 0);
  paintQuad(buf, W, H, [-8, -8, 60, -8, 60, 50, -8, 50], 255);
  assert.strictEqual(detect.detectQuad(buf, W, H, { rand: mulberry32(7) }), null, "cropped");
}
assert.strictEqual(detect.detectQuad(null, 0, 0), null, "null input");
assert.strictEqual(detect.detectQuad(new Uint8ClampedArray(10), W, H), null, "short buffer");

// Same seed reproduces the same corners exactly.
{
  const buf = makeImage(W, H, 0);
  paintQuad(buf, W, H, [15, 10, 85, 25, 75, 70, 10, 60], 255);
  const a = detect.detectQuad(buf, W, H, { rand: mulberry32(99) });
  const b = detect.detectQuad(buf, W, H, { rand: mulberry32(99) });
  assert.deepStrictEqual(a, b, "seeded determinism");
}

console.log("detect tests passed: axis, skewed, rotated, noisy, trapezoid, keystone, narrow, cluttered, nested, pastel, dark quads; fail-closed guards; determinism.");
