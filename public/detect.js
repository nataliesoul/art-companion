// Artwork quad detection for Artist Companion. Pure functions, no DOM.
// Finds one fully-visible rectangular artwork on a contrasting background:
// grayscale, blur, Sobel edges, iterative RANSAC lines, then the best
// edge-supported quad from line combinations. Fail-closed: returns null
// unless a convex, well-supported quad clears every guard. Returned
// points are unordered fractions; order them with ACGuide.orderCorners
// before rectifying.
//
// Shared between the browser app (public/app.js) and Node tests.
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    root.ACDetect = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var MAX_DIM = 160; // analysis resolution (long side, pixels)
  var MAX_POINTS = 4000; // RANSAC edge-point budget
  var EDGE_KEEP = 0.10; // strict pass keeps strongest 10% gradients
  var EDGE_FLOOR = 18; // below this the photo has no strong edges
  // Sensitive fallback keeps the strongest of 6% or 1200 points: borders
  // scale with perimeter, so small images need the higher density.
  var EDGE_DENSITY_SENSITIVE = 0.06;
  var EDGE_COUNT_MIN = 1200;
  var EDGE_FLOOR_SENSITIVE = 8;
  var RANSAC_ITERS = 150;
  var RANSAC_EPS = 1.0; // inlier distance; NMS ridges are 1px, so this rejects tilted bridges
  var SIDE_SUPPORT_MIN = 0.45; // every side needs this much edge backing (kills partial-line mixes)
  var MAX_LINES = 16; // rich interiors need room for all 4 border lines
  var MIN_INLIERS = 24;
  var MIN_INLIERS_RELAXED = 10; // fallback pass for short/foreshortened sides
  var PERP_STRONG = 4; // min gradient across a line to count for it
  var SUPPORT_MIN = 0.38; // min edge-supported perimeter fraction
  var MARGIN = 0.02; // corners must clear the frame by this fraction
  var AREA_MIN = 0.05;
  var AREA_MAX = 0.95;
  var MIN_SIDE = 0.08; // min side length, fraction of image diagonal

  function lineFromPoints(p, q) {
    var dx = q.x - p.x;
    var dy = q.y - p.y;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-9) return null;
    var a = -dy / len;
    var b = dx / len;
    return { a: a, b: b, c: -(a * p.x + b * p.y) };
  }

  function lineDist(line, p) {
    return Math.abs(line.a * p.x + line.b * p.y + line.c);
  }

  // Total-least-squares refit over inlier points.
  function fitLeastSquares(pts) {
    var mx = 0;
    var my = 0;
    var i;
    for (i = 0; i < pts.length; i++) {
      mx += pts[i].x;
      my += pts[i].y;
    }
    mx /= pts.length;
    my /= pts.length;
    var sxx = 0;
    var sxy = 0;
    var syy = 0;
    for (i = 0; i < pts.length; i++) {
      var dx = pts[i].x - mx;
      var dy = pts[i].y - my;
      sxx += dx * dx;
      sxy += dx * dy;
      syy += dy * dy;
    }
    var angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    var a = -Math.sin(angle);
    var b = Math.cos(angle);
    return { a: a, b: b, c: -(a * mx + b * my) };
  }

  function intersect(l1, l2) {
    var det = l1.a * l2.b - l2.a * l1.b;
    if (Math.abs(det) < 1e-9) return null;
    return {
      x: (l1.b * l2.c - l2.b * l1.c) / det,
      y: (l1.c * l2.a - l2.c * l1.a) / det
    };
  }

  // Independent deterministic sub-stream: each tier and scale draws
  // from its own stream, so tuning rounds in one place never reshuffles
  // the lotteries elsewhere. Deterministic for a fixed master rand.
  function subRand(rand, salt) {
    var s = Math.floor(rand() * 2147483647) ^ Math.imul(salt, 2654435761);
    var a = s >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Iterative RANSAC line extraction. Only strong inliers count: points
  // whose gradient clearly crosses the line in the seed direction.
  // Frame sides have uniform polarity along their whole length, while
  // collinear texture chains mix stroke top and bottom edges and split
  // their vote. Crossing points (weak perpendicular gradient) belong
  // to no line exclusively, so they stay in the pool instead of being
  // eaten by whichever orientation extracts first.
  function ransacLines(points, rand, minInliers, iters) {
    var remaining = points.slice();
    var lines = [];
    var n;
    var i;
    var k;
    function perp(p, ln) {
      return p.gx * ln.a + p.gy * ln.b;
    }
    var rounds = iters || RANSAC_ITERS;
    while (lines.length < MAX_LINES && remaining.length >= minInliers) {
      n = remaining.length;
      var bestLine = null;
      var bestRef = 0;
      var bestCount = 0;
      for (i = 0; i < rounds; i++) {
        var p = remaining[Math.floor(rand() * n)];
        var q = remaining[Math.floor(rand() * n)];
        var cand = lineFromPoints(p, q);
        if (!cand) continue;
        var ref = perp(p, cand);
        var qperp = perp(q, cand);
        if (Math.abs(ref) < PERP_STRONG || Math.abs(qperp) < PERP_STRONG ||
          qperp * ref < 0) continue;
        var count = 0;
        for (k = 0; k < n; k++) {
          if (lineDist(cand, remaining[k]) > RANSAC_EPS) continue;
          var ip = perp(remaining[k], cand);
          if (Math.abs(ip) < PERP_STRONG || ip * ref < 0) continue;
          count++;
        }
        if (count > bestCount) {
          bestCount = count;
          bestLine = cand;
          bestRef = ref;
        }
      }
      if (!bestLine || bestCount < minInliers) break;
      var inliers = [];
      var rest = [];
      for (k = 0; k < n; k++) {
        var bp = perp(remaining[k], bestLine);
        if (lineDist(bestLine, remaining[k]) <= RANSAC_EPS &&
          Math.abs(bp) >= PERP_STRONG && bp * bestRef >= 0) inliers.push(remaining[k]);
        else rest.push(remaining[k]);
      }
      lines.push(fitLeastSquares(inliers));
      remaining = rest;
    }
    return lines;
  }

  function cross(o, a, b) {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  }

  function isConvex(quad) {
    var sign = 0;
    var i;
    for (i = 0; i < 4; i++) {
      var c = cross(quad[i], quad[(i + 1) % 4], quad[(i + 2) % 4]);
      if (Math.abs(c) < 1e-9) return false;
      if (sign === 0) sign = c > 0 ? 1 : -1;
      else if ((c > 0 ? 1 : -1) !== sign) return false;
    }
    return true;
  }

  function quadArea(quad) {
    var s = 0;
    for (var i = 0; i < 4; i++) {
      var a = quad[i];
      var b = quad[(i + 1) % 4];
      s += a.x * b.y - b.x * a.y;
    }
    return Math.abs(s) / 2;
  }

  // Fraction of samples along one segment landing near an edge cell.
  function sideSupport1(a, b, edge, w, h) {
    var len = Math.sqrt((b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y));
    var steps = Math.max(1, Math.ceil(len));
    var hit = 0;
    for (var s = 0; s <= steps; s++) {
      var x = Math.round(a.x + (b.x - a.x) * (s / steps));
      var y = Math.round(a.y + (b.y - a.y) * (s / steps));
      var found = false;
      for (var dy = -1; dy <= 1 && !found; dy++) {
        for (var dx = -1; dx <= 1 && !found; dx++) {
          var xx = x + dx;
          var yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < w && yy < h && edge[yy * w + xx]) {
            found = true;
          }
        }
      }
      if (found) hit++;
    }
    return hit / (steps + 1);
  }

  // Per-side fraction of samples landing near an edge-grid cell.
  function sideSupports(quad, edge, w, h) {
    var out = [];
    for (var i = 0; i < 4; i++) {
      out.push(sideSupport1(quad[i], quad[(i + 1) % 4], edge, w, h));
    }
    return out;
  }

  // Guards return { support, area } or null. Ranking multiplies the
  // two: interior artwork structure always has strong edges, so the
  // largest well-supported quad — the outer frame — must win.
  function validQuad(quad, w, h, edge) {
    var i;
    for (i = 0; i < 4; i++) {
      var u = quad[i].x / w;
      var v = quad[i].y / h;
      if (u < MARGIN || u > 1 - MARGIN || v < MARGIN || v > 1 - MARGIN) return null;
    }
    if (!isConvex(quad)) return null;
    var area = quadArea(quad) / (w * h);
    if (area < AREA_MIN || area > AREA_MAX) return null;
    var diag = Math.sqrt(w * w + h * h);
    for (i = 0; i < 4; i++) {
      var a = quad[i];
      var b = quad[(i + 1) % 4];
      if (Math.sqrt((b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y)) / diag < MIN_SIDE) {
        return null;
      }
    }
    var sides = sideSupports(quad, edge, w, h);
    var min = Math.min(sides[0], sides[1], sides[2], sides[3]);
    if (min < SIDE_SUPPORT_MIN) return null;
    return { support: (sides[0] + sides[1] + sides[2] + sides[3]) / 4, area: area };
  }

  function rankQuad(measured) {
    return measured.support * measured.area;
  }

  // Opposite-line pairings for 4 line indices; corners are the cross pairs.
  var PAIRINGS = [
    [[0, 1], [2, 3]],
    [[0, 2], [1, 3]],
    [[0, 3], [1, 2]]
  ];

  function quadFromLines(ls, w, h, edge) {
    var best = null;
    PAIRINGS.forEach(function (pairing) {
      var g0 = pairing[0];
      var g1 = pairing[1];
      var idx = [g0[0], g1[0], g0[1], g1[1]];
      var corners = [
        intersect(ls[idx[0]], ls[idx[1]]),
        intersect(ls[idx[1]], ls[idx[2]]),
        intersect(ls[idx[2]], ls[idx[3]]),
        intersect(ls[idx[3]], ls[idx[0]])
      ];
      if (!corners[0] || !corners[1] || !corners[2] || !corners[3]) return;
      var measured = validQuad(corners, w, h, edge);
      if (!measured || measured.support < SUPPORT_MIN) return;
      var score = rankQuad(measured);
      if (!best || score > best.score) {
        // Side lines in corner order: sides[i] runs corners[i]->corners[i+1].
        best = {
          corners: corners,
          score: score,
          sides: [ls[idx[1]], ls[idx[2]], ls[idx[3]], ls[idx[0]]]
        };
      }
    });
    return best;
  }

  // Refit a winning side against the full edge set. Iterative RANSAC
  // removal can bias a side to one half of a blurred edge band; the
  // symmetric full-band refit restores subpixel centering. The first
  // pass collects within `wide` (coarse-mapped sides start pixels off
  // the ridge), the second within 2px to shed nearby texture.
  function refitSide(line, edge, w, h) {
    var orig = line;
    var iter;
    for (iter = 0; iter < 2; iter++) {
      var pts = [];
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          if (!edge[y * w + x]) continue;
          var p = { x: x, y: y };
          if (lineDist(line, p) <= 2.0) pts.push(p);
        }
      }
      if (pts.length < 8) return line;
      var fit = fitLeastSquares(pts);
      // Nearby texture can tilt the fit several degrees and drag its
      // corners off the ridge; true ridge corrections are sub-degree,
      // so keep the input past ~4 degrees from where it started.
      if (Math.abs(fit.a * orig.a + fit.b * orig.b) < 0.9976) return line;
      line = fit;
    }
    return line;
  }

  // Regional boundary score for one side at one normal offset: sample
  // blurred gray 4-6px to each side at stations along the segment. A
  // frame side has a steady brightness step with one uniform side
  // (the wall); texture lines sit inside paint on both sides. Used
  // only as a tiebreak nudge under edge support, so its failure modes
  // (strokes crossing the edge, tap windows straddling the ridge)
  // cannot override the support signal.
  function boundaryScore(p0, p1, nx, ny, off, gray, w, h) {
    var len = Math.sqrt((p1.x - p0.x) * (p1.x - p0.x) + (p1.y - p0.y) * (p1.y - p0.y));
    var n = Math.max(4, Math.floor(len / 2));
    var diffs = [];
    var sumA = 0;
    var sumB = 0;
    var sumA2 = 0;
    var sumB2 = 0;
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      var px = p0.x + (p1.x - p0.x) * t + nx * off;
      var py = p0.y + (p1.y - p0.y) * t + ny * off;
      var a = 0;
      var b = 0;
      for (var k = 4; k <= 6; k++) {
        var ax = Math.min(w - 1, Math.max(0, Math.round(px + nx * k)));
        var ay = Math.min(h - 1, Math.max(0, Math.round(py + ny * k)));
        var bx = Math.min(w - 1, Math.max(0, Math.round(px - nx * k)));
        var by = Math.min(h - 1, Math.max(0, Math.round(py - ny * k)));
        a += gray[ay * w + ax] / 3;
        b += gray[by * w + bx] / 3;
      }
      diffs.push(Math.abs(a - b));
      sumA += a;
      sumB += b;
      sumA2 += a * a;
      sumB2 += b * b;
    }
    diffs.sort(function (u, v) { return u - v; });
    var med = diffs[Math.floor(diffs.length / 2)];
    var m = diffs.length;
    var sdA = Math.sqrt(Math.max(0, sumA2 / m - (sumA / m) * (sumA / m)));
    var sdB = Math.sqrt(Math.max(0, sumB2 / m - (sumB / m) * (sumB / m)));
    return med / (1 + Math.min(sdA, sdB));
  }

  // Snap one mapped side onto the frame ridge: scan parallel offsets
  // for the best edge support, with the regional boundary character
  // as a capped tiebreak nudge, then polish on the edge grid.
  // Deterministic — no lottery. The move needs a clear support gain;
  // otherwise the mapped position (already edge-fit at its own scale)
  // stands and the narrow polish centers it. Returns { line, off }.
  function snapSide(p0, p1, line, gray, edge, w, h, range) {
    var nx = line.a;
    var ny = line.b;
    function shifted(off) {
      return [
        { x: p0.x + nx * off, y: p0.y + ny * off },
        { x: p1.x + nx * off, y: p1.y + ny * off }
      ];
    }
    function offsetScore(off) {
      var seg = shifted(off);
      var supp = sideSupport1(seg[0], seg[1], edge, w, h);
      var reg = Math.min(boundaryScore(p0, p1, nx, ny, off, gray, w, h), 12) / 60;
      return supp + reg;
    }
    var base = offsetScore(0);
    var bestOff = 0;
    var bestScore = base;
    for (var off = -range; off <= range; off++) {
      if (off === 0) continue;
      var s = offsetScore(off);
      if (s > bestScore + 0.02 ||
        (Math.abs(s - bestScore) <= 0.02 && Math.abs(off) < Math.abs(bestOff))) {
        bestScore = s;
        bestOff = off;
      }
    }
    if (!(bestScore > base + 0.08 && bestScore > 1.15 * base)) {
      bestOff = 0;
      bestScore = base;
    }
    var moved = { a: nx, b: ny, c: line.c - bestOff };
    return {
      line: refitSide(moved, edge, w, h),
      off: bestOff,
      score: Math.round(bestScore * 1000) / 1000
    };
  }

  // Snap a coarse-mapped quad onto fine-grid ridges before validation:
  // mapped corners land pixels off, which scores ~0 support unrefit.
  function refitMapped(corners, w, h, edge, scale, gray, debugLog) {
    var sides = corners.map(function (c, i) {
      return lineFromPoints(c, corners[(i + 1) % 4]);
    });
    if (sides.some(function (s) { return !s; })) return corners;
    sides = sides.map(function (ln, i) {
      var r = snapSide(corners[i], corners[(i + 1) % 4], ln, gray, edge, w, h, 2 * scale);
      if (debugLog) {
        debugLog.push({
          tier: "refit/x" + scale + "/" + i,
          line: [Math.round(r.line.a * 100) / 100, Math.round(r.line.b * 100) / 100,
            Math.round(r.line.c * 10) / 10],
          off: r.off,
          score: r.score
        });
      }
      return r.line;
    });
    var out = [
      intersect(sides[3], sides[0]),
      intersect(sides[0], sides[1]),
      intersect(sides[1], sides[2]),
      intersect(sides[2], sides[3])
    ];
    if (!out[0] || !out[1] || !out[2] || !out[3]) return corners;
    return out;
  }

  function refineQuad(best, w, h, edge) {
    // Coarse-scale winners carry no usable lines; refit from their sides.
    var sides = best.sides || best.corners.map(function (c, i) {
      return lineFromPoints(c, best.corners[(i + 1) % 4]);
    });
    if (sides.some(function (s) { return !s; })) return best.corners;
    sides = sides.map(function (ln) { return refitSide(ln, edge, w, h); });
    var corners = [
      intersect(sides[3], sides[0]),
      intersect(sides[0], sides[1]),
      intersect(sides[1], sides[2]),
      intersect(sides[2], sides[3])
    ];
    if (!corners[0] || !corners[1] || !corners[2] || !corners[3]) return best.corners;
    var recheck = validQuad(corners, w, h, edge);
    if (!recheck || recheck.support < SUPPORT_MIN) return best.corners;
    return corners;
  }

  function combinations(n, k) {
    var out = [];
    function rec(start, combo) {
      if (combo.length === k) {
        out.push(combo.slice());
        return;
      }
      for (var i = start; i < n; i++) {
        combo.push(i);
        rec(i + 1, combo);
        combo.pop();
      }
    }
    rec(0, []);
    return out;
  }

  function findBestQuad(lines, edge, w, h) {
    if (lines.length < 4) return null;
    var best = null;
    combinations(lines.length, 4).forEach(function (combo) {
      var ls = combo.map(function (k) { return lines[k]; });
      var q = quadFromLines(ls, w, h, edge);
      if (q && (!best || q.score > best.score)) best = q;
    });
    return best;
  }

  // Longest near-contiguous run of edge points along a line (gap <=
  // 2.5px). Frame sides are single long runs; collinear texture chains
  // are short fragments with gaps, so run length separates them where
  // raw inlier counts cannot.
  function lineRun(line, edge, w, h) {
    var ts = [];
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        if (!edge[y * w + x]) continue;
        if (Math.abs(line.a * x + line.b * y + line.c) > 1.5) continue;
        ts.push(x * (-line.b) + y * line.a);
      }
    }
    if (!ts.length) return 0;
    ts.sort(function (u, v) { return u - v; });
    var best = 1;
    var run = 1;
    for (var i = 1; i < ts.length; i++) {
      run = (ts[i] - ts[i - 1] <= 2.5) ? run + 1 : 1;
      if (run > best) best = run;
    }
    return best;
  }

  // Merge tier line sets so a quad split across lotteries (one tier
  // finds the horizontals, another the verticals) still assembles.
  // Round-robin gathers each tier's diversity, near-duplicates
  // collapse, and the survivors rank by run length so long frame
  // sides survive the cap while texture fragments sink.
  var UNION_LINES_MAX = 20;
  function unionLines(tierLines, edge, w, h) {
    var pool = [];
    var i = 0;
    var more = true;
    while (more) {
      more = false;
      tierLines.forEach(function (lines) {
        if (i < lines.length) {
          more = true;
          pool.push(lines[i]);
        }
      });
      i++;
    }
    function norm(l) {
      var s = (l.b < 0 || (l.b === 0 && l.a < 0)) ? -1 : 1;
      return { a: l.a * s, b: l.b * s, c: l.c * s };
    }
    var deduped = [];
    pool.forEach(function (l) {
      var n = norm(l);
      var dup = deduped.some(function (m) {
        var o = norm(m);
        return Math.abs(n.a * o.a + n.b * o.b) > 0.9994 && Math.abs(n.c - o.c) < 2;
      });
      if (!dup) deduped.push(l);
    });
    var ranked = deduped.map(function (l) {
      return { line: l, run: lineRun(l, edge, w, h) };
    });
    ranked.sort(function (p, q) { return q.run - p.run; });
    return ranked.slice(0, UNION_LINES_MAX).map(function (r) { return r.line; });
  }

  function downsampleGray(gray, w, h) {
    var cw = Math.max(8, Math.floor(w / 2));
    var ch = Math.max(8, Math.floor(h / 2));
    var out = new Array(cw * ch);
    for (var y = 0; y < ch; y++) {
      for (var x = 0; x < cw; x++) {
        var sx = Math.min(w - 1, x * 2);
        var sy = Math.min(h - 1, y * 2);
        out[y * cw + x] = (gray[sy * w + sx] +
          gray[sy * w + Math.min(w - 1, sx + 1)] +
          gray[Math.min(h - 1, sy + 1) * w + sx] +
          gray[Math.min(h - 1, sy + 1) * w + Math.min(w - 1, sx + 1)]) / 4;
      }
    }
    return { gray: out, w: cw, h: ch };
  }

  // Full candidate search on one grayscale image. Returns { candidates, edge }
  // with edge the densest grid built. Texture that drowns the fine scale
  // shrinks below the line floors at half scale, so the coarse pass sees
  // borders the fine pass misses; the fine grid still validates everything.
  function findCandidates(gray, gw, gh, rand, tag, debugLog, scaleId) {
    var x;
    var y;
    var mag = new Array(gw * gh);
    var dirX = new Array(gw * gh);
    var dirY = new Array(gw * gh);
    var gradX = new Array(gw * gh);
    var gradY = new Array(gw * gh);
    for (y = 0; y < gh; y++) {
      for (x = 0; x < gw; x++) {
        msgray(gray, gw, gh, x, y, mag, dirX, dirY, gradX, gradY);
      }
    }
    for (y = 0; y < gh; y++) {
      for (x = 0; x < gw; x++) {
        nmsThin(mag, dirX, dirY, gw, gh, x, y);
      }
    }
    var sorted = mag.slice().sort(function (a, b) { return b - a; });
    function buildEdgeSet(sensitive) {
      var count = sensitive ?
        Math.max(EDGE_COUNT_MIN, Math.round(gw * gh * EDGE_DENSITY_SENSITIVE)) : 0;
      var idx = sensitive ?
        Math.min(sorted.length - 1, count) :
        Math.floor(sorted.length * (1 - EDGE_KEEP));
      var floor = sensitive ? EDGE_FLOOR_SENSITIVE : EDGE_FLOOR;
      var thresh = Math.max(sorted[idx] || 0, floor);
      var edge = new Array(gw * gh);
      var pts = [];
      for (var k = 0; k < mag.length; k++) {
        var on = mag[k] >= thresh;
        edge[k] = on;
        if (on) pts.push({ x: k % gw, y: Math.floor(k / gw), gx: gradX[k], gy: gradY[k] });
      }
      if (pts.length < MIN_INLIERS_RELAXED) return null;
      var shuffle = subRand(rand, scaleId * 16 + (sensitive ? 2 : 1));
      for (var s = 0; s < pts.length && s < MAX_POINTS; s++) {
        var j = s + Math.floor(shuffle() * (pts.length - s));
        var tmp = pts[s];
        pts[s] = pts[j];
        pts[j] = tmp;
      }
      return { edge: edge, sampled: pts.slice(0, MAX_POINTS) };
    }
    var strictSet = buildEdgeSet(false);
    var sensitiveSet = buildEdgeSet(true);
    var candidates = [];
    var tierLines = [];
    var tierIdx = 0;
    function consider(set, minInliers, tier) {
      if (!set) {
        if (debugLog) debugLog.push({ tier: tag + "/" + tier, points: 0, nlines: 0, best: null });
        tierIdx++;
        return;
      }
      // Small point sets cost little per round, so spend rounds where
      // the sampling lottery is thinnest (coarse scales); never drop
      // below the fine-scale budget the fixtures were tuned on.
      var rounds = Math.max(RANSAC_ITERS,
        Math.round(RANSAC_ITERS * 1000 / Math.max(set.sampled.length, 100)));
      var stream = subRand(rand, scaleId * 16 + 3 + tierIdx);
      tierIdx++;
      var lines = ransacLines(set.sampled, stream, minInliers, rounds);
      tierLines.push(lines);
      var found = findBestQuad(lines, set.edge, gw, gh);
      if (found) candidates.push(found);
      if (debugLog) {
        debugLog.push({
          tier: tag + "/" + tier,
          points: set.sampled.length,
          nlines: lines.length,
          best: found ? {
            corners: found.corners.map(function (p) {
              return [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10];
            }),
            score: Math.round(found.score * 10000) / 10000
          } : null
        });
      }
    }
    consider(strictSet, MIN_INLIERS, "strict");
    consider(strictSet, MIN_INLIERS_RELAXED, "strict-relaxed");
    consider(sensitiveSet, MIN_INLIERS_RELAXED, "sensitive");
    var denseEdge = sensitiveSet ? sensitiveSet.edge : (strictSet ? strictSet.edge : null);
    if (denseEdge && tierLines.length) {
      var union = unionLines(tierLines, denseEdge, gw, gh);
      var ufound = findBestQuad(union, denseEdge, gw, gh);
      if (ufound) candidates.push(ufound);
      if (debugLog) {
        debugLog.push({
          tier: tag + "/union",
          points: union.length,
          nlines: union.length,
          best: ufound ? {
            corners: ufound.corners.map(function (p) {
              return [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10];
            }),
            score: Math.round(ufound.score * 10000) / 10000
          } : null
        });
      }
    }
    return {
      candidates: candidates,
      edge: denseEdge
    };
  }

  function msgray(gray, gw, gh, x, y, mag, dirX, dirY, gradX, gradY) {
    function g(xx, yy) {
      xx = Math.min(gw - 1, Math.max(0, xx));
      yy = Math.min(gh - 1, Math.max(0, yy));
      return gray[yy * gw + xx];
    }
    var gx = (g(x + 1, y - 1) + 2 * g(x + 1, y) + g(x + 1, y + 1) -
      g(x - 1, y - 1) - 2 * g(x - 1, y) - g(x - 1, y + 1)) / 4;
    var gy = (g(x - 1, y + 1) + 2 * g(x, y + 1) + g(x + 1, y + 1) -
      g(x - 1, y - 1) - 2 * g(x, y - 1) - g(x + 1, y - 1)) / 4;
    gradX[y * gw + x] = gx;
    gradY[y * gw + x] = gy;
    mag[y * gw + x] = Math.sqrt(gx * gx + gy * gy);
    if (Math.abs(gx) >= Math.abs(gy)) {
      dirX[y * gw + x] = 1;
      dirY[y * gw + x] = 0;
    } else {
      dirX[y * gw + x] = 0;
      dirY[y * gw + x] = 1;
    }
  }

  function nmsThin(mag, dirX, dirY, gw, gh, x, y) {
    var i0 = y * gw + x;
    var m0 = mag[i0];
    if (m0 <= 0) return;
    var ox = dirX[i0];
    var oy = dirY[i0];
    var n1 = (x - ox >= 0 && y - oy >= 0 && x - ox < gw && y - oy < gh) ?
      mag[(y - oy) * gw + (x - ox)] : -1;
    var n2 = (x + ox >= 0 && y + oy >= 0 && x + ox < gw && y + oy < gh) ?
      mag[(y + oy) * gw + (x + ox)] : -1;
    if (m0 < n1 || m0 < n2) mag[i0] = 0;
  }

  // pixels: source RGBA (array-like), w x h. opts.rand injects determinism.
  // Returns 4 unordered {x, y} fraction corners, or null.
  function detectQuad(pixels, w, h, opts) {
    if (!pixels || !(w >= 8 && h >= 8) || pixels.length < w * h * 4) return null;
    var rand = (opts && opts.rand) || Math.random;
    var debugLog = opts && opts.debugLog;
    var scale = Math.min(1, MAX_DIM / Math.max(w, h));
    var aw = Math.max(8, Math.round(w * scale));
    var ah = Math.max(8, Math.round(h * scale));
    var i;
    var x;
    var y;
    // Grayscale with bilinear sampling.
    var gray = new Array(aw * ah);
    for (y = 0; y < ah; y++) {
      for (x = 0; x < aw; x++) {
        var sx = ((x + 0.5) / aw) * w - 0.5;
        var sy = ((y + 0.5) / ah) * h - 0.5;
        sx = Math.min(w - 1, Math.max(0, sx));
        sy = Math.min(h - 1, Math.max(0, sy));
        var x0 = Math.floor(sx);
        var y0 = Math.floor(sy);
        var x1 = Math.min(w - 1, x0 + 1);
        var y1 = Math.min(h - 1, y0 + 1);
        var fx = sx - x0;
        var fy = sy - y0;
        function lum(px, py) {
          var o = (py * w + px) * 4;
          return 0.299 * pixels[o] + 0.587 * pixels[o + 1] + 0.114 * pixels[o + 2];
        }
        gray[y * aw + x] =
          lum(x0, y0) * (1 - fx) * (1 - fy) +
          lum(x1, y0) * fx * (1 - fy) +
          lum(x0, y1) * (1 - fx) * fy +
          lum(x1, y1) * fx * fy;
      }
    }
    // One box-blur pass. More would merge parallel edges a few pixels
    // apart (fingers over borders) into phantom ridges between them.
    var blurred = new Array(aw * ah);
    for (y = 0; y < ah; y++) {
      for (x = 0; x < aw; x++) {
        var s = 0;
        var c = 0;
        for (var dy = -1; dy <= 1; dy++) {
          for (var dx = -1; dx <= 1; dx++) {
            var xx = x + dx;
            var yy = y + dy;
            if (xx >= 0 && yy >= 0 && xx < aw && yy < ah) {
              s += gray[yy * aw + xx];
              c++;
            }
          }
        }
        blurred[y * aw + x] = s / c;
      }
    }
    gray = blurred;
    var fine = findCandidates(gray, aw, ah, rand, "fine", debugLog, 1);
    var candidates = fine.candidates.slice();
    function addScaled(scale, tag) {
      var q = downsampleGray(gray, aw, ah);
      var steps = scale === 4 ? [q, downsampleGray(q.gray, q.w, q.h)] : [q];
      var small = steps[steps.length - 1];
      if (small.w < 16 || small.h < 16) return;
      var res = findCandidates(small.gray, small.w, small.h, rand, tag, debugLog, scale);
      var sx = aw / small.w;
      var sy = ah / small.h;
      res.candidates.forEach(function (c) {
        candidates.push({
          corners: c.corners.map(function (p) { return { x: p.x * sx, y: p.y * sy }; }),
          score: c.score,
          scale: scale // refit from mapped geometry, never coarse lines
        });
      });
    }
    // Texture fragments shrink below the line floors at coarser scales
    // while frame sides survive; every proposal is refit and validated
    // on the fine grid, so coarse passes can only add candidates.
    if (aw >= 32 && ah >= 32) addScaled(2, "coarse");
    if (aw >= 64 && ah >= 48) addScaled(4, "quarter");
    var grid = fine.edge;
    if (!grid || !candidates.length) return null;
    var best = null;
    var bestScore = -1;
    var bestArea = 0;
    candidates.forEach(function (c) {
      var corners = c.scale > 1 ?
        refitMapped(c.corners, aw, ah, grid, c.scale, gray, debugLog) : c.corners;
      var measured = validQuad(corners, aw, ah, grid);
      if (debugLog) {
        debugLog.push({
          tier: "final/" + (c.scale > 1 ? "x" + c.scale : "fine"),
          corners: corners.map(function (p) {
            return [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10];
          }),
          support: measured ? Math.round(measured.support * 10000) / 10000 : null,
          area: measured ? Math.round(measured.area * 10000) / 10000 : null
        });
      }
      if (!measured || measured.support < SUPPORT_MIN) return;
      var score = rankQuad(measured);
      // Near-ties (within 1%) go to the larger quad: a tilted partial
      // and the true frame can rank within noise of each other, and
      // the outer frame must win those.
      if (score > bestScore * 1.01 ||
        (Math.abs(score - bestScore) <= bestScore * 0.01 && measured.area > bestArea)) {
        bestScore = score;
        bestArea = measured.area;
        // Coarse winners refit from snapped geometry; fine winners keep
        // their RANSAC sides for the final polish.
        best = { corners: corners, score: score, sides: c.scale > 1 ? null : c.sides };
      }
    });
    if (!best) return null;
    // Coarse winners arrive snapped and polished; a second refit only
    // invites texture drift along the side. Fine winners keep the
    // final polish that centers their RANSAC sides.
    var finalCorners = best.sides ? refineQuad(best, aw, ah, grid) : best.corners;
    return finalCorners.map(function (p) {
      return { x: p.x / aw, y: p.y / ah };
    });
  }

  return {
    detectQuad: detectQuad
  };
});
