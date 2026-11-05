// Color theory tests. Runs with plain Node, no packages:
//   node tests/color.test.js
const assert = require("assert");
const color = require("../public/color.js");

function approx(actual, expected, label) {
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `${label}: expected ${expected}, got ${actual}`
  );
}

// Hex and HSL conversions round-trip.
assert.deepStrictEqual(color.hexToRgb("#ff0000"), { r: 255, g: 0, b: 0 });
assert.strictEqual(color.rgbToHex(255, 0, 0), "#ff0000");
assert.throws(() => color.hexToRgb("red"), /#rrggbb/);
const hsl = color.rgbToHsl(70, 130, 180);
const back = color.hslToRgb(hsl.h, hsl.s, hsl.l);
assert.ok(Math.abs(back.r - 70) <= 1, "hsl round-trip r");
assert.ok(Math.abs(back.g - 130) <= 1, "hsl round-trip g");
assert.ok(Math.abs(back.b - 180) <= 1, "hsl round-trip b");

// Known harmonies of pure red.
const groups = color.harmonies("#ff0000");
assert.deepStrictEqual(groups[0], { label: "Complementary", colors: ["#00ffff"] });
assert.deepStrictEqual(groups[2], { label: "Triadic", colors: ["#00ff00", "#0000ff"] });
assert.strictEqual(groups[1].colors.length, 2);
assert.strictEqual(groups[3].colors.length, 2);

// Temperature follows the rough warm/cool hue convention.
assert.strictEqual(color.temperature("#ff0000"), "warm");
assert.strictEqual(color.temperature("#0000ff"), "cool");
assert.strictEqual(color.temperature("#808080"), "neutral");

// Ground extremes follow HSL lightness.
assert.strictEqual(color.darkest(["#ffffff", "#000000", "#ff0000"]), "#000000");
assert.strictEqual(color.lightest(["#ffffff", "#000000", "#ff0000"]), "#ffffff");
assert.strictEqual(color.darkest([]), null);
assert.strictEqual(color.lightest([]), null);

// Synthetic 4x2 image: left half red, right half blue.
function solidRow(w, colorFn) {
  const px = [];
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < w; x++) {
      px.push(...colorFn(x, y), 255);
    }
  }
  return px;
}
const pixels = solidRow(4, x => (x < 2 ? [255, 0, 0] : [0, 0, 255]));
const palette = color.extractPalette(pixels, 4, 2, null, 6);
assert.strictEqual(palette.length, 2);
assert.deepStrictEqual(
  palette.map(c => c.hex).sort(),
  ["#0000ff", "#ff0000"]
);
approx(palette[0].coverage, 0.5, "first coverage");
approx(palette[1].coverage, 0.5, "second coverage");

// A quad over the left half samples red only.
const leftHalf = [
  { x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 0.5, y: 1 }, { x: 0, y: 1 }
];
const masked = color.extractPalette(pixels, 4, 2, leftHalf, 6);
assert.strictEqual(masked.length, 1);
assert.strictEqual(masked[0].hex, "#ff0000");
approx(masked[0].coverage, 1, "masked coverage");

// Transparent pixels are skipped.
const withAlpha = pixels.slice();
withAlpha[3] = 0;
const skipped = color.extractPalette(withAlpha, 4, 2, null, 6);
approx(skipped[0].coverage + skipped[1].coverage, 1, "opaque coverage sums to 1");

// White balance: warm-cast gray neutralizes under gray-world.
function flat(w, h, rgb) {
  const px = [];
  for (let i = 0; i < w * h; i++) px.push(rgb[0], rgb[1], rgb[2], 255);
  return px;
}
const cast = flat(4, 1, [200, 150, 100]);
const wb = color.computeGains(cast, 4, 1, null, "gray");
approx(wb.gains.r, 150 / 200, "gray-world red gain");
approx(wb.gains.g, 1, "gray-world green anchor");
approx(wb.gains.b, 150 / 100, "gray-world blue gain");
assert.deepStrictEqual(wb.ref, { r: 200, g: 150, b: 100 });
assert.deepStrictEqual(
  color.applyGainsToPixel(200, 150, 100, wb.gains),
  { r: 150, g: 150, b: 150 }
);

// Gains clamp to a conservative range; output clips to byte range.
const red = color.computeGains(flat(2, 2, [255, 0, 0]), 2, 2, null, "gray");
assert.strictEqual(red.gains.r, 0.5);
assert.strictEqual(red.gains.b, 0.5);
assert.deepStrictEqual(
  color.applyGainsToPixel(200, 200, 200, { r: 2, g: 1, b: 0.5 }),
  { r: 255, g: 200, b: 100 }
);
assert.deepStrictEqual(color.applyGainsToPixel(1, 2, 3, null), { r: 1, g: 2, b: 3 });

// White-patch keys off the near-maximum, not a lone hot pixel.
const patchy = flat(20, 10, [10, 10, 10]);
for (let i = 0; i < 10; i++) {
  patchy[i * 4] = 255;
  patchy[i * 4 + 1] = 240;
  patchy[i * 4 + 2] = 220;
}
const wp = color.computeGains(patchy, 20, 10, null, "white");
assert.deepStrictEqual(wp.ref, { r: 255, g: 240, b: 220 });
approx(wp.gains.r, 240 / 255, "white-patch red gain");

// Manual keys off a 5x5 patch around the tapped point.
const manual = color.computeGains(flat(5, 5, [180, 150, 120]), 5, 5, null, "manual", { x: 0.5, y: 0.5 });
approx(manual.gains.r, 150 / 180, "manual red gain");
approx(manual.gains.b, 150 / 120, "manual blue gain");

// Unusable setups return null instead of bogus gains.
assert.strictEqual(color.computeGains(cast, 4, 1, null, "off"), null);
assert.strictEqual(color.computeGains(cast, 4, 1, null, "manual", null), null);
const outside = [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 2, y: 3 }];
assert.strictEqual(color.computeGains(cast, 4, 1, outside, "gray"), null);

// Gains flow into palette sampling: cast gray samples as neutral gray.
const corrected = color.extractPalette(
  flat(4, 2, [200, 150, 100]), 4, 2, null, 6,
  (r, g, b) => color.applyGainsToPixel(r, g, b, wb.gains)
);
assert.strictEqual(corrected.length, 1);
assert.strictEqual(corrected[0].hex, "#969696");

// Three-point calibration: black/grey/white thirds.
function thirds(w, h, left, mid, right) {
  const px = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = x < w / 3 ? left : (x < (2 * w) / 3 ? mid : right);
      px.push(c[0], c[1], c[2], 255);
    }
  }
  return px;
}
const calImg = thirds(30, 10, [20, 10, 10], [140, 120, 100], [250, 240, 230]);
const cal = color.computeCalibration(calImg, 30, 10, {
  black: { x: 0.1, y: 0.5 },
  grey: { x: 0.5, y: 0.5 },
  white: { x: 0.9, y: 0.5 }
});
assert.deepStrictEqual(cal.refs.black, { r: 20, g: 10, b: 10 });
assert.deepStrictEqual(cal.refs.grey, { r: 140, g: 120, b: 100 });
assert.deepStrictEqual(cal.refs.white, { r: 250, g: 240, b: 230 });
approx(cal.gamma.r, Math.log(110 / 230) / Math.log(120 / 230), "cal gamma red");
approx(cal.gamma.g, 1, "cal gamma green anchor");
assert.deepStrictEqual(color.applyCalibrationToPixel(20, 10, 10, cal), { r: 0, g: 0, b: 0 });
assert.deepStrictEqual(color.applyCalibrationToPixel(250, 240, 230, cal), { r: 255, g: 255, b: 255 });
assert.deepStrictEqual(color.applyCalibrationToPixel(140, 120, 100, cal), { r: 122, g: 122, b: 122 });
assert.deepStrictEqual(color.applyCalibrationToPixel(1, 2, 3, null), { r: 1, g: 2, b: 3 });

// Identity calibration leaves pixels alone.
const ident = color.computeCalibration(
  thirds(30, 10, [0, 0, 0], [128, 128, 128], [255, 255, 255]), 30, 10,
  { black: { x: 0.1, y: 0.5 }, grey: { x: 0.5, y: 0.5 }, white: { x: 0.9, y: 0.5 } }
);
assert.deepStrictEqual(color.applyCalibrationToPixel(100, 150, 200, ident), { r: 100, g: 150, b: 200 });

// Bad reference sets fail loudly instead of warping colors.
assert.strictEqual(color.computeCalibration(calImg, 30, 10, null), null);
assert.strictEqual(color.computeCalibration(calImg, 30, 10, {
  black: { x: 0.1, y: 0.5 }, grey: null, white: { x: 0.9, y: 0.5 }
}), null);
const flipped = thirds(30, 10, [100, 100, 100], [50, 50, 50], [200, 200, 200]);
assert.strictEqual(color.computeCalibration(flipped, 30, 10, {
  black: { x: 0.1, y: 0.5 }, grey: { x: 0.5, y: 0.5 }, white: { x: 0.9, y: 0.5 }
}), null);
const flatRange = thirds(30, 10, [100, 100, 100], [102, 102, 102], [105, 105, 105]);
assert.strictEqual(color.computeCalibration(flatRange, 30, 10, {
  black: { x: 0.1, y: 0.5 }, grey: { x: 0.5, y: 0.5 }, white: { x: 0.9, y: 0.5 }
}), null);

// Calibration flows into sampling: the grey third samples neutral.
const midQuad = [{ x: 0.34, y: 0 }, { x: 0.66, y: 0 }, { x: 0.66, y: 1 }, { x: 0.34, y: 1 }];
const calPal = color.extractPalette(calImg, 30, 10, midQuad, 6,
  (r, g, b) => color.applyCalibrationToPixel(r, g, b, cal));
assert.strictEqual(calPal.length, 1);
assert.strictEqual(calPal[0].hex, "#7a7a7a");

console.log("color tests passed: conversions, harmonies, temperature, palette, white balance, calibration.");
