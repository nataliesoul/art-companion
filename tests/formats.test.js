// Format tests. Runs with plain Node, no packages:
//   node tests/formats.test.js
const assert = require("assert");
const formats = require("../public/formats.js");

function approx(actual, expected, label) {
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `${label}: expected ${expected}, got ${actual}`
  );
}

// Registry coverage: 5 ISO, 3 US, 11 art sizes, 7 ratios.
assert.strictEqual(formats.FORMATS.filter(f => f.group === "iso").length, 5);
assert.strictEqual(formats.FORMATS.filter(f => f.group === "us").length, 3);
assert.strictEqual(formats.FORMATS.filter(f => f.group === "art").length, 11);
assert.strictEqual(formats.RATIOS.length, 7);
assert.strictEqual(new Set(formats.FORMATS.map(f => f.id)).size, formats.FORMATS.length);

// A-series uses true millimetre dimensions (210x297 rounds 1/sqrt(2)).
approx(formats.formatAspect("a4", "portrait"), 210 / 297, "A4 portrait");
approx(formats.formatAspect("a4", "landscape"), 297 / 210, "A4 landscape");
approx(formats.formatAspect("a2", "portrait"), 420 / 594, "A2 portrait");
assert.ok(
  Math.abs(formats.formatAspect("a4", "portrait") - 1 / Math.SQRT2) < 0.001,
  "A4 near root-two"
);

// US sizes keep their inch proportions.
approx(formats.formatAspect("letter", "portrait"), 8.5 / 11, "Letter portrait");
approx(formats.formatAspect("legal", "landscape"), 14 / 8.5, "Legal landscape");

// Art sizes, including the square (orientation-independent).
approx(formats.formatAspect("art-9x12", "portrait"), 9 / 12, "9x12 portrait");
approx(formats.formatAspect("art-9x12", "landscape"), 12 / 9, "9x12 landscape");
approx(formats.formatAspect("art-12x12", "portrait"), 1, "12x12 portrait");
approx(formats.formatAspect("art-12x12", "landscape"), 1, "12x12 landscape");

// Ratio-only options honor orientation: portrait <= 1, landscape >= 1.
approx(formats.ratioAspect("square", "portrait"), 1, "square");
approx(formats.ratioAspect("r45", "portrait"), 4 / 5, "4:5 portrait");
approx(formats.ratioAspect("r45", "landscape"), 5 / 4, "4:5 landscape");
approx(formats.ratioAspect("r169", "landscape"), 16 / 9, "16:9 landscape");
approx(formats.ratioAspect("r169", "portrait"), 9 / 16, "16:9 portrait");
approx(formats.ratioAspect("root2", "landscape"), Math.SQRT2, "root-two");
approx(formats.ratioAspect("golden", "landscape"), (1 + Math.sqrt(5)) / 2, "golden");
assert.throws(() => formats.formatAspect("nope", "portrait"), /unknown format/);
assert.throws(() => formats.ratioAspect("nope", "portrait"), /unknown ratio/);

// Custom dimensions parse in cm or inches; bad input fails loudly.
approx(formats.customAspect(20, 30, "cm", "portrait"), 2 / 3, "custom cm");
approx(formats.customAspect(8, 10, "in", "landscape"), 10 / 8, "custom in");
assert.deepStrictEqual(formats.parseCustom(1, 2, "in"), { wMm: 25.4, hMm: 50.8 });
assert.throws(() => formats.parseCustom(0, 5, "cm"), /positive/);
assert.throws(() => formats.parseCustom("x", 5, "cm"), /positive/);
assert.throws(() => formats.parseCustom(5, 5, "mm"), /cm or in/);

console.log("format tests passed: registry, orientation, ratios, custom parsing.");
