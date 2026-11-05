// Color theory helpers for Artist Companion. Pure functions, no DOM.
// Palette sampling counts real photo pixels (inside the marked quad when
// present); harmonies are exact hue rotations. Nothing here judges the
// artwork; temperature labels follow the rough warm/cool hue convention.
//
// Shared between the browser app (public/app.js) and Node tests.
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    root.ACColor = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function clampByte(n) {
    return Math.min(255, Math.max(0, Math.round(n)));
  }

  function rgbToHex(r, g, b) {
    function h(n) {
      var s = clampByte(n).toString(16);
      return s.length === 1 ? "0" + s : s;
    }
    return "#" + h(r) + h(g) + h(b);
  }

  function hexToRgb(hex) {
    var m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
    if (!m) throw new Error("hexToRgb expects #rrggbb");
    var v = parseInt(m[1], 16);
    return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
  }

  // h in degrees 0..360, s and l in 0..1.
  function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    var max = Math.max(r, g, b);
    var min = Math.min(r, g, b);
    var h = 0;
    var s = 0;
    var l = (max + min) / 2;
    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
      else if (max === g) h = ((b - r) / d + 2) * 60;
      else h = ((r - g) / d + 4) * 60;
    }
    return { h: h, s: s, l: l };
  }

  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    var m = l - c / 2;
    var r = 0;
    var g = 0;
    var b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    return {
      r: clampByte((r + m) * 255),
      g: clampByte((g + m) * 255),
      b: clampByte((b + m) * 255)
    };
  }

  function rotateHex(hex, degrees) {
    var rgb = hexToRgb(hex);
    var hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    var out = hslToRgb(hsl.h + degrees, hsl.s, hsl.l);
    return rgbToHex(out.r, out.g, out.b);
  }

  // Harmony groups for a base hex color: exact hue rotations at the
  // same saturation and lightness.
  function harmonies(hex) {
    return [
      { label: "Complementary", colors: [rotateHex(hex, 180)] },
      { label: "Analogous", colors: [rotateHex(hex, -30), rotateHex(hex, 30)] },
      { label: "Triadic", colors: [rotateHex(hex, 120), rotateHex(hex, 240)] },
      { label: "Split complementary", colors: [rotateHex(hex, 150), rotateHex(hex, 210)] }
    ];
  }

  // Rough warm/cool convention by hue; near-gray reads as neutral.
  function temperature(hex) {
    var rgb = hexToRgb(hex);
    var hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    if (hsl.s < 0.12) return "neutral";
    if (hsl.h < 80 || hsl.h >= 320) return "warm";
    return "cool";
  }

  function lightnessOf(hex) {
    var rgb = hexToRgb(hex);
    return rgbToHsl(rgb.r, rgb.g, rgb.b).l;
  }

  // Darkest / lightest hex in a list by HSL lightness, for study grounds.
  // Returns null for an empty list.
  function darkest(hexes) {
    if (!hexes.length) return null;
    var best = hexes[0];
    var bestL = lightnessOf(best);
    hexes.forEach(function (h) {
      var l = lightnessOf(h);
      if (l < bestL) {
        best = h;
        bestL = l;
      }
    });
    return best;
  }

  function lightest(hexes) {
    if (!hexes.length) return null;
    var best = hexes[0];
    var bestL = lightnessOf(best);
    hexes.forEach(function (h) {
      var l = lightnessOf(h);
      if (l > bestL) {
        best = h;
        bestL = l;
      }
    });
    return best;
  }

  function pointInPolygon(x, y, poly) {
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i].x;
      var yi = poly[i].y;
      var xj = poly[j].x;
      var yj = poly[j].y;
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  }

  function colorDistance(a, b) {
    var dr = a.r - b.r;
    var dg = a.g - b.g;
    var db = a.b - b.b;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }

  // Dominant colors of raw RGBA pixels (width x height, row-major).
  // quad is [{x, y} x4] in fractions, or null to sample the whole image.
  // Returns up to `count` entries {hex, r, g, b, coverage}.
  // correct: optional pixel mapper (r, g, b) -> {r, g, b}, e.g. a white
  // balance or calibration transform. Null samples the pixels as-is.
  function extractPalette(pixels, width, height, quad, count, correct) {
    var bins = {};
    var total = 0;
    for (var y = 0; y < height; y++) {
      for (var x = 0; x < width; x++) {
        var u = (x + 0.5) / width;
        var v = (y + 0.5) / height;
        if (quad && !pointInPolygon(u, v, quad)) continue;
        var i = (y * width + x) * 4;
        if (pixels[i + 3] < 128) continue;
        var pr = pixels[i];
        var pg = pixels[i + 1];
        var pb = pixels[i + 2];
        if (correct) {
          var mapped = correct(pr, pg, pb);
          pr = mapped.r;
          pg = mapped.g;
          pb = mapped.b;
        }
        var key = ((pr >> 3) << 10) | ((pg >> 3) << 5) | (pb >> 3);
        var bin = bins[key];
        if (!bin) {
          bin = bins[key] = { r: 0, g: 0, b: 0, n: 0 };
        }
        bin.r += pr;
        bin.g += pg;
        bin.b += pb;
        bin.n += 1;
        total += 1;
      }
    }
    var ranked = Object.keys(bins).map(function (key) {
      var bin = bins[key];
      return {
        r: Math.round(bin.r / bin.n),
        g: Math.round(bin.g / bin.n),
        b: Math.round(bin.b / bin.n),
        n: bin.n
      };
    }).sort(function (a, b) { return b.n - a.n; });

    var picked = [];
    ranked.forEach(function (c) {
      if (picked.length >= count) return;
      var dup = picked.some(function (p) { return colorDistance(p, c) < 40; });
      if (!dup) picked.push(c);
    });
    return picked.map(function (c) {
      return {
        hex: rgbToHex(c.r, c.g, c.b),
        r: c.r,
        g: c.g,
        b: c.b,
        coverage: total > 0 ? c.n / total : 0
      };
    });
  }

  // --- White balance ---
  // Gains neutralize a lighting cast before palette sampling. Green is the
  // anchor (gain 1); red/blue gains are clamped to a conservative range so
  // strongly colored artwork is never "corrected" into gray mush.
  var WB_MIN_GAIN = 0.5;
  var WB_MAX_GAIN = 2.0;

  function clampGain(g) {
    if (!isFinite(g)) return 1;
    return Math.min(WB_MAX_GAIN, Math.max(WB_MIN_GAIN, g));
  }

  function gainsFromAverages(avg) {
    if (avg.r < 1 && avg.g < 1 && avg.b < 1) return null;
    return {
      r: clampGain(avg.g / Math.max(avg.r, 1)),
      g: 1,
      b: clampGain(avg.g / Math.max(avg.b, 1))
    };
  }

  function collectRegion(pixels, width, height, quad) {
    var rs = [];
    var gs = [];
    var bs = [];
    for (var y = 0; y < height; y++) {
      for (var x = 0; x < width; x++) {
        var u = (x + 0.5) / width;
        var v = (y + 0.5) / height;
        if (quad && !pointInPolygon(u, v, quad)) continue;
        var i = (y * width + x) * 4;
        if (pixels[i + 3] < 128) continue;
        rs.push(pixels[i]);
        gs.push(pixels[i + 1]);
        bs.push(pixels[i + 2]);
      }
    }
    return { r: rs, g: gs, b: bs };
  }

  function average(arr) {
    if (!arr.length) return 0;
    var s = 0;
    for (var i = 0; i < arr.length; i++) s += arr[i];
    return s / arr.length;
  }

  function percentile(sortedAsc, p) {
    if (!sortedAsc.length) return 0;
    return sortedAsc[Math.min(sortedAsc.length - 1, Math.floor(p * (sortedAsc.length - 1)))];
  }

  function applyGainsToPixel(r, g, b, gains) {
    if (!gains) return { r: r, g: g, b: b };
    return {
      r: clampByte(r * gains.r),
      g: clampByte(g * gains.g),
      b: clampByte(b * gains.b)
    };
  }

  function patchAverage(pixels, width, height, point) {
    if (!point || !isFinite(point.x) || !isFinite(point.y)) return null;
    var cx = Math.floor(point.x * width);
    var cy = Math.floor(point.y * height);
    var rs = [];
    var gs = [];
    var bs = [];
    for (var y = cy - 2; y <= cy + 2; y++) {
      for (var x = cx - 2; x <= cx + 2; x++) {
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        var i = (y * width + x) * 4;
        if (pixels[i + 3] < 128) continue;
        rs.push(pixels[i]);
        gs.push(pixels[i + 1]);
        bs.push(pixels[i + 2]);
      }
    }
    if (!rs.length) return null;
    return { r: average(rs), g: average(gs), b: average(bs) };
  }

  var WB_MIN_GAMMA = 0.5;
  var WB_MAX_GAMMA = 2.0;
  var WB_MIN_RANGE = 8;

  function clampGamma(g) {
    if (!isFinite(g)) return 1;
    return Math.min(WB_MAX_GAMMA, Math.max(WB_MIN_GAMMA, g));
  }

  // Three-point calibration from tapped black/grey/white references
  // (fraction coords, sampled anywhere in the image, not just the quad).
  // Per channel: black maps to 0, white maps to 255, and a gamma anchored
  // on green makes the grey reference read neutral in the midtones.
  // Returns { refs, offset, denom, gamma } or null when unusable.
  function computeCalibration(pixels, width, height, points) {
    if (!points) return null;
    var black = patchAverage(pixels, width, height, points.black);
    var grey = patchAverage(pixels, width, height, points.grey);
    var white = patchAverage(pixels, width, height, points.white);
    if (!black || !grey || !white) return null;
    var chans = ["r", "g", "b"];
    for (var i = 0; i < 3; i++) {
      var c = chans[i];
      if (white[c] - black[c] < WB_MIN_RANGE) return null;
      if (!(grey[c] > black[c] && grey[c] < white[c])) return null;
    }
    var offset = {};
    var denom = {};
    var norm = {};
    chans.forEach(function (c) {
      offset[c] = black[c];
      denom[c] = white[c] - black[c];
      norm[c] = (grey[c] - black[c]) / denom[c];
    });
    var gamma = {};
    chans.forEach(function (c) {
      gamma[c] = clampGamma(Math.log(norm.g) / Math.log(norm[c]));
    });
    function round3(p) {
      return { r: Math.round(p.r), g: Math.round(p.g), b: Math.round(p.b) };
    }
    return {
      refs: { black: round3(black), grey: round3(grey), white: round3(white) },
      offset: offset,
      denom: denom,
      gamma: gamma
    };
  }

  function applyCalibrationToPixel(r, g, b, cal) {
    if (!cal) return { r: r, g: g, b: b };
    function map(v, c) {
      var t = (v - cal.offset[c]) / cal.denom[c];
      if (t < 0) t = 0;
      if (t > 1) t = 1;
      return clampByte(255 * Math.pow(t, cal.gamma[c]));
    }
    return { r: map(r, "r"), g: map(g, "g"), b: map(b, "b") };
  }

  // White-balance gains for raw RGBA pixels. method: "gray" (channel
  // averages equalize), "white" (99.5th percentile equalizes), or "manual"
  // (5x5 patch around point, in fractions). quad limits the region, or null
  // for the whole image. Returns { gains, ref } or null when unusable.
  function computeGains(pixels, width, height, quad, method, point) {
    var ref;
    if (method === "manual") {
      ref = patchAverage(pixels, width, height, point);
      if (!ref) return null;
    } else if (method === "gray" || method === "white") {
      var region = collectRegion(pixels, width, height, quad);
      if (!region.r.length) return null;
      if (method === "gray") {
        ref = { r: average(region.r), g: average(region.g), b: average(region.b) };
      } else {
        var sR = region.r.slice().sort(function (a, b) { return a - b; });
        var sG = region.g.slice().sort(function (a, b) { return a - b; });
        var sB = region.b.slice().sort(function (a, b) { return a - b; });
        ref = { r: percentile(sR, 0.995), g: percentile(sG, 0.995), b: percentile(sB, 0.995) };
      }
    } else {
      return null;
    }
    var gains = gainsFromAverages(ref);
    if (!gains) return null;
    return {
      gains: gains,
      ref: { r: Math.round(ref.r), g: Math.round(ref.g), b: Math.round(ref.b) }
    };
  }

  return {
    rgbToHex: rgbToHex,
    hexToRgb: hexToRgb,
    rgbToHsl: rgbToHsl,
    hslToRgb: hslToRgb,
    harmonies: harmonies,
    temperature: temperature,
    darkest: darkest,
    lightest: lightest,
    extractPalette: extractPalette,
    computeGains: computeGains,
    applyGainsToPixel: applyGainsToPixel,
    computeCalibration: computeCalibration,
    applyCalibrationToPixel: applyCalibrationToPixel
  };
});
