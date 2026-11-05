// Rectification tests. Runs with plain Node, no packages:
//   node tests/rectify.test.js
const assert = require("assert");
const { rectify } = require("../public/rectify.js");

function px(data, w, x, y) {
  const i = (y * w + x) * 4;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
}

const FULL = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];

// Full-image quad at native size reproduces every pixel exactly.
const src = [];
for (let i = 0; i < 16; i++) src.push(i * 16, 255 - i * 16, (i * 37) % 256, 255);
const same = rectify(src, 4, 4, FULL, 4, 4);
assert.strictEqual(same.width, 4);
assert.strictEqual(same.height, 4);
assert.deepStrictEqual(Array.from(same.data), src);

// A 2x2 corner set downsampled to 1x1 averages exactly.
const corners = [
  0, 0, 0, 255, 200, 0, 0, 255,
  0, 200, 0, 255, 0, 0, 200, 255
];
const avg = rectify(corners, 2, 2, FULL, 1, 1);
assert.deepStrictEqual(px(avg.data, 1, 0, 0), [50, 50, 50, 255]);

// A half-image quad crops: right blue half of a red/blue split.
const split = [];
for (let y = 0; y < 4; y++) {
  for (let x = 0; x < 4; x++) {
    split.push(...(x < 2 ? [255, 0, 0, 255] : [0, 0, 255, 255]));
  }
}
const rightHalf = [{ x: 0.5, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0.5, y: 1 }];
const crop = rectify(split, 4, 4, rightHalf, 2, 2);
for (let y = 0; y < 2; y++) {
  for (let x = 0; x < 2; x++) {
    assert.deepStrictEqual(px(crop.data, 2, x, y), [0, 0, 255, 255]);
  }
}

// Bad input fails loudly.
assert.throws(() => rectify(src, 4, 4, FULL.slice(0, 3), 4, 4), /quad of 4/);
assert.throws(() => rectify(src, 4, 4, FULL, 0, 4), /positive/);

console.log("rectify tests passed: identity, averaging, crop, guards.");
