// Paper, canvas, and ratio formats for Artist Companion. Pure data and math,
// no DOM. When the artist knows the physical format, guides use its true
// proportions instead of measuring the tilted photo corners.
//
// Shared between the browser app (public/app.js) and Node tests.
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    root.ACFormats = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var MM_PER_IN = 25.4;

  // Stored portrait (short side first), except square. Units cancel out in
  // aspect math; labels show each format's conventional unit.
  var FORMATS = [
    { id: "a6", group: "iso", name: "A6", w: 105, h: 148, unit: "mm" },
    { id: "a5", group: "iso", name: "A5", w: 148, h: 210, unit: "mm" },
    { id: "a4", group: "iso", name: "A4", w: 210, h: 297, unit: "mm" },
    { id: "a3", group: "iso", name: "A3", w: 297, h: 420, unit: "mm" },
    { id: "a2", group: "iso", name: "A2", w: 420, h: 594, unit: "mm" },
    { id: "letter", group: "us", name: "US Letter", w: 8.5, h: 11, unit: "in" },
    { id: "legal", group: "us", name: "US Legal", w: 8.5, h: 14, unit: "in" },
    { id: "tabloid", group: "us", name: "US Tabloid", w: 11, h: 17, unit: "in" },
    { id: "art-5x7", group: "art", name: "5 x 7 in", w: 5, h: 7, unit: "in" },
    { id: "art-7x10", group: "art", name: "7 x 10 in", w: 7, h: 10, unit: "in" },
    { id: "art-8x10", group: "art", name: "8 x 10 in", w: 8, h: 10, unit: "in" },
    { id: "art-9x12", group: "art", name: "9 x 12 in", w: 9, h: 12, unit: "in" },
    { id: "art-10x14", group: "art", name: "10 x 14 in", w: 10, h: 14, unit: "in" },
    { id: "art-11x14", group: "art", name: "11 x 14 in", w: 11, h: 14, unit: "in" },
    { id: "art-12x12", group: "art", name: "12 x 12 in", w: 12, h: 12, unit: "in" },
    { id: "art-12x16", group: "art", name: "12 x 16 in", w: 12, h: 16, unit: "in" },
    { id: "art-16x20", group: "art", name: "16 x 20 in", w: 16, h: 20, unit: "in" },
    { id: "art-18x24", group: "art", name: "18 x 24 in", w: 18, h: 24, unit: "in" },
    { id: "art-24x36", group: "art", name: "24 x 36 in", w: 24, h: 36, unit: "in" }
  ];

  var RATIOS = [
    { id: "square", name: "Square", ratio: 1 },
    { id: "r45", name: "4:5", ratio: 4 / 5 },
    { id: "r34", name: "3:4", ratio: 3 / 4 },
    { id: "r23", name: "2:3", ratio: 2 / 3 },
    { id: "r169", name: "16:9", ratio: 16 / 9 },
    { id: "root2", name: "Root-two", ratio: Math.SQRT2 },
    { id: "golden", name: "Golden rectangle", ratio: (1 + Math.sqrt(5)) / 2 }
  ];

  function findById(list, id) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function findFormat(id) {
    return findById(FORMATS, id);
  }

  function findRatio(id) {
    return findById(RATIOS, id);
  }

  // Width-over-height for w,h under an orientation: portrait reads <= 1,
  // landscape reads >= 1, so the toggle is meaningful for every entry.
  function orientedAspect(w, h, orientation) {
    var a = w / h;
    if (orientation === "landscape") return a >= 1 ? a : 1 / a;
    return a <= 1 ? a : 1 / a;
  }

  function formatAspect(id, orientation) {
    var f = findFormat(id);
    if (!f) throw new Error("unknown format: " + id);
    return orientedAspect(f.w, f.h, orientation);
  }

  function ratioAspect(id, orientation) {
    var r = findRatio(id);
    if (!r) throw new Error("unknown ratio: " + id);
    return orientedAspect(r.ratio, 1, orientation);
  }

  function parseCustom(w, h, unit) {
    if (unit !== "cm" && unit !== "in") {
      throw new Error("custom unit must be cm or in");
    }
    w = Number(w);
    h = Number(h);
    if (!isFinite(w) || !isFinite(h) || w <= 0 || h <= 0) {
      throw new Error("custom dimensions must be positive numbers");
    }
    var mm = unit === "in" ? MM_PER_IN : 10;
    return { wMm: w * mm, hMm: h * mm };
  }

  function customAspect(w, h, unit, orientation) {
    var c = parseCustom(w, h, unit);
    return orientedAspect(c.wMm, c.hMm, orientation);
  }

  function formatLabel(f) {
    return f.name + " — " + f.w + " x " + f.h + " " + f.unit;
  }

  return {
    MM_PER_IN: MM_PER_IN,
    FORMATS: FORMATS,
    RATIOS: RATIOS,
    findFormat: findFormat,
    findRatio: findRatio,
    orientedAspect: orientedAspect,
    formatAspect: formatAspect,
    ratioAspect: ratioAspect,
    parseCustom: parseCustom,
    customAspect: customAspect,
    formatLabel: formatLabel
  };
});
