// Composition-guide geometry for Artist Companion. Pure functions, no DOM.
// Guides are built in artwork space (the unit square) and mapped onto the
// marked quad with bilinear interpolation, so they follow the artwork even
// in a perspective-tilted photo. Constructions that need true angles or
// circles (45-degree diagonals, perpendiculars, rings) use the artwork's
// physical aspect ratio, which the app measures from the marked corners.
//
// Shared between the browser app (public/app.js) and Node tests.
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    root.ACGuide = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var PHI = (1 + Math.sqrt(5)) / 2;

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function lerpPoint(p, q, t) {
    return { x: lerp(p.x, q.x, t), y: lerp(p.y, q.y, t) };
  }

  function signedArea(quad) {
    var s = 0;
    for (var i = 0; i < 4; i++) {
      var p = quad[i];
      var q = quad[(i + 1) % 4];
      s += p.x * q.y - q.x * p.y;
    }
    return s / 2;
  }

  // Order 4 tapped points as [topLeft, topRight, bottomRight, bottomLeft]
  // so guides stay correct no matter which order the artist taps.
  function orderCorners(points) {
    if (!Array.isArray(points) || points.length !== 4) {
      throw new Error("orderCorners expects exactly 4 points");
    }
    var cx = (points[0].x + points[1].x + points[2].x + points[3].x) / 4;
    var cy = (points[0].y + points[1].y + points[2].y + points[3].y) / 4;
    var byAngle = points.slice().sort(function (p, q) {
      return Math.atan2(p.y - cy, p.x - cx) - Math.atan2(q.y - cy, q.x - cx);
    });
    var start = 0;
    for (var i = 1; i < 4; i++) {
      if (byAngle[i].x + byAngle[i].y < byAngle[start].x + byAngle[start].y) {
        start = i;
      }
    }
    var ordered = [0, 1, 2, 3].map(function (i) {
      return byAngle[(start + i) % 4];
    });
    // In screen coordinates (y grows downward), visual-clockwise order has
    // positive shoelace area. Mirror otherwise so index 0..3 stays TL,TR,BR,BL.
    if (signedArea(ordered) < 0) {
      return [ordered[0], ordered[3], ordered[2], ordered[1]];
    }
    return ordered;
  }

  // Thirds-grid segments inside quad [TL, TR, BR, BL] via bilinear
  // interpolation along the artwork edges. Returns 4 segments:
  // 2 running top-to-bottom, 2 running left-to-right.
  function thirdsLines(quad) {
    var TL = quad[0];
    var TR = quad[1];
    var BR = quad[2];
    var BL = quad[3];
    var lines = [];
    [1 / 3, 2 / 3].forEach(function (t) {
      var top = lerpPoint(TL, TR, t);
      var bottom = lerpPoint(BL, BR, t);
      lines.push({ x1: top.x, y1: top.y, x2: bottom.x, y2: bottom.y });
    });
    [1 / 3, 2 / 3].forEach(function (t) {
      var left = lerpPoint(TL, BL, t);
      var right = lerpPoint(TR, BR, t);
      lines.push({ x1: left.x, y1: left.y, x2: right.x, y2: right.y });
    });
    return lines;
  }

  // Map artwork-space (u, v) onto the ordered quad [TL, TR, BR, BL].
  function bilinear(quad, u, v) {
    var top = lerpPoint(quad[0], quad[1], u);
    var bottom = lerpPoint(quad[3], quad[2], u);
    return lerpPoint(top, bottom, v);
  }

  // Liang-Barsky clip of segment p->q to the unit square.
  // Returns the clipped [p, q] pair, or null when fully outside.
  function clipSegment(p, q) {
    var dx = q.x - p.x;
    var dy = q.y - p.y;
    var t0 = 0;
    var t1 = 1;
    var edges = [[-dx, p.x], [dx, 1 - p.x], [-dy, p.y], [dy, 1 - p.y]];
    for (var i = 0; i < 4; i++) {
      var a = edges[i][0];
      var b = edges[i][1];
      if (Math.abs(a) < 1e-12) {
        if (b < 0) return null;
      } else {
        var t = b / a;
        if (a < 0) {
          if (t > t1) return null;
          if (t > t0) t0 = t;
        } else {
          if (t < t0) return null;
          if (t < t1) t1 = t;
        }
      }
    }
    if (t0 > t1) return null;
    return [
      { x: p.x + dx * t0, y: p.y + dy * t0 },
      { x: p.x + dx * t1, y: p.y + dy * t1 }
    ];
  }

  // Aspect helpers: physical x spans aspect units while y spans 1, so angles
  // and circles computed here stay true on non-square artwork.
  function toAspect(p, aspect) {
    return { x: p.x * aspect, y: p.y };
  }

  function fromAspect(p, aspect) {
    return { x: p.x / aspect, y: p.y };
  }

  function perpFoot(p, a, b) {
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    var len2 = dx * dx + dy * dy;
    if (len2 < 1e-12) return { x: a.x, y: a.y };
    var t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  function aspectFoot(p, a, b, aspect) {
    return fromAspect(perpFoot(toAspect(p, aspect), toAspect(a, aspect), toAspect(b, aspect)), aspect);
  }

  function arcPoints(cx, cy, rx, ry, a0, a1, n) {
    var pts = [];
    for (var i = 0; i <= n; i++) {
      var a = a0 + (a1 - a0) * (i / n);
      pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
    }
    return pts;
  }

  function cubicPoints(p0, p1, p2, p3, n) {
    var pts = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      var s = 1 - t;
      pts.push({
        x: s * s * s * p0.x + 3 * s * s * t * p1.x + 3 * s * t * t * p2.x + t * t * t * p3.x,
        y: s * s * s * p0.y + 3 * s * s * t * p1.y + 3 * s * t * t * p2.y + t * t * t * p3.y
      });
    }
    return pts;
  }

  // Small artwork-space builders. Each returns polylines; two-point
  // polylines are straight segments (subdivided at map time so they bend
  // correctly under perspective), longer ones are sampled curves.
  function V(x) {
    return [{ x: x, y: 0 }, { x: x, y: 1 }];
  }

  function H(y) {
    return [{ x: 0, y: y }, { x: 1, y: y }];
  }

  function SEG(x1, y1, x2, y2) {
    return [{ x: x1, y: y1 }, { x: x2, y: y2 }];
  }

  function rectPolys(x0, y0, x1, y1) {
    return [
      SEG(x0, y0, x1, y0),
      SEG(x1, y0, x1, y1),
      SEG(x1, y1, x0, y1),
      SEG(x0, y1, x0, y0)
    ];
  }

  function plusPolys(cx, cy, arm) {
    return [SEG(cx - arm, cy, cx + arm, cy), SEG(cx, cy - arm, cx, cy + arm)];
  }

  function diamondPolys(cx, cy, r) {
    return [
      SEG(cx, cy - r, cx + r, cy),
      SEG(cx + r, cy, cx, cy + r),
      SEG(cx, cy + r, cx - r, cy),
      SEG(cx - r, cy, cx, cy - r)
    ];
  }

  function ringPoly(cx, cy, r, aspect, n) {
    return arcPoints(cx, cy, r, r * aspect, 0, Math.PI * 2, n || 64);
  }

  function pushClipped(out, p, q) {
    var c = clipSegment(p, q);
    if (c) out.push(c);
  }

  // Golden spiral: Fibonacci squares (1,1,2,3,5,8,13) tiled by turning
  // clockwise, filling a 13x21 box. Each square holds one quarter-circle
  // arc; consecutive arcs meet at the corner shared by their squares, and
  // each arc spans the square diagonally with its center at one of the
  // other two corners (the one farther from the inner tiling).
  function spiralSquares() {
    var sizes = [1, 1, 2, 3, 5, 8, 13];
    var squares = [{ x: 0, y: 0, s: 1 }];
    var bx0 = 0;
    var by0 = 0;
    var bx1 = 1;
    var by1 = 1;
    var dirs = ["R", "B", "L", "T"];
    for (var i = 1; i < sizes.length; i++) {
      var s = sizes[i];
      var d = dirs[(i - 1) % 4];
      var sq;
      if (d === "R") { sq = { x: bx1, y: by0, s: s }; bx1 += s; }
      else if (d === "B") { sq = { x: bx0, y: by1, s: s }; by1 += s; }
      else if (d === "L") { sq = { x: bx0 - s, y: by0, s: s }; bx0 -= s; }
      else { sq = { x: bx0, y: by0 - s, s: s }; by0 -= s; }
      squares.push(sq);
    }
    return { squares: squares, box: { x0: bx0, y0: by0, x1: bx1, y1: by1 } };
  }

  function cornersOf(sq) {
    return [
      { x: sq.x, y: sq.y },
      { x: sq.x + sq.s, y: sq.y },
      { x: sq.x + sq.s, y: sq.y + sq.s },
      { x: sq.x, y: sq.y + sq.s }
    ];
  }

  function samePoint(a, b) {
    return Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9;
  }

  function sharedCorners(a, b) {
    var cb = cornersOf(b);
    return cornersOf(a).filter(function (c) {
      return cb.some(function (o) { return samePoint(o, c); });
    });
  }

  function oppositeCorner(sq, p) {
    var corners = cornersOf(sq);
    for (var i = 0; i < 4; i++) {
      if (samePoint(corners[i], p)) return corners[(i + 2) % 4];
    }
    throw new Error("spiral tiling: point is not a square corner");
  }

  function centroid(sq) {
    return { x: sq.x + sq.s / 2, y: sq.y + sq.s / 2 };
  }

  function dist(a, b) {
    return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));
  }

  function goldenSpiralTiling() {
    var t = spiralSquares();
    var squares = t.squares;
    var n = squares.length;
    var J = new Array(n);
    var k;
    for (k = n - 1; k >= 2; k--) {
      var shared = sharedCorners(squares[k - 1], squares[k]);
      if (shared.length !== 1) {
        throw new Error("spiral tiling: expected exactly one shared corner");
      }
      J[k] = shared[0];
    }
    // Squares 0 and 1 share a full edge: use the shared corner diagonally
    // opposite J[2] within square 1.
    var edge = sharedCorners(squares[0], squares[1]);
    var want = oppositeCorner(squares[1], J[2]);
    J[1] = edge.filter(function (c) { return samePoint(c, want); })[0];
    if (!J[1]) throw new Error("spiral tiling: unit-square junction not found");

    var arcs = [];
    for (k = 0; k < n; k++) {
      var sq = squares[k];
      var ends;
      if (k === 0) ends = [J[1], oppositeCorner(sq, J[1])];
      else if (k === n - 1) ends = [J[k], oppositeCorner(sq, J[k])];
      else ends = [J[k], J[k + 1]];
      var cands = cornersOf(sq).filter(function (c) {
        return !samePoint(c, ends[0]) && !samePoint(c, ends[1]);
      });
      var center;
      if (k === 0) {
        var outer = cornersOf(squares[1]);
        center = cands.filter(function (c) {
          return !outer.some(function (o) { return samePoint(o, c); });
        })[0] || cands[0];
      } else {
        var inner = centroid(squares[k - 1]);
        center = cands[0];
        if (dist(cands[1], inner) > dist(cands[0], inner)) center = cands[1];
      }
      arcs.push({ square: sq, center: center, from: ends[0], to: ends[1] });
    }
    return { squares: squares, box: t.box, arcs: arcs };
  }

  function spiralUvPolys() {
    var tiling = goldenSpiralTiling();
    var box = tiling.box;
    var w = box.x1 - box.x0;
    var h = box.y1 - box.y0;
    var sc = 1 / h; // fit height, keep true proportions
    var xoff = (1 - w * sc) / 2;
    function norm(p) {
      return { x: xoff + (p.x - box.x0) * sc, y: (p.y - box.y0) * sc };
    }
    var polys = [];
    tiling.squares.forEach(function (sq) {
      var a = norm({ x: sq.x, y: sq.y });
      var b = norm({ x: sq.x + sq.s, y: sq.y + sq.s });
      polys.push.apply(polys, rectPolys(a.x, a.y, b.x, b.y));
    });
    tiling.arcs.forEach(function (arc) {
      var c = norm(arc.center);
      var r = arc.square.s * sc;
      var p0 = norm(arc.from);
      var p1 = norm(arc.to);
      var a0 = Math.atan2(p0.y - c.y, p0.x - c.x);
      var a1 = Math.atan2(p1.y - c.y, p1.x - c.x);
      var d = a1 - a0;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      polys.push(arcPoints(c.x, c.y, r, r, a0, a0 + d, 24));
    });
    return polys;
  }

  // Guide builders: id -> artwork-space polylines. Aspect (width / height
  // of the physical artwork) is used only where true angles matter.
  var BUILDERS = {
    "thirds": function () {
      return [V(1 / 3), V(2 / 3), H(1 / 3), H(2 / 3)];
    },
    "phi-grid": function () {
      var a = 1 / PHI;
      var b = 1 - a;
      return [V(a), V(b), H(a), H(b)];
    },
    "golden-spiral": function () {
      return spiralUvPolys();
    },
    "nested-halves": function () {
      var out = [];
      [1 / 2, 1 / 4, 3 / 4, 1 / 8, 3 / 8, 5 / 8, 7 / 8].forEach(function (t) {
        out.push(V(t), H(t));
      });
      return out;
    },
    "root-rect": function () {
      var a = 1 / Math.SQRT2;
      var b = 1 - a;
      return [V(a), V(b), H(a), H(b), SEG(0, 0, 1, 1), SEG(1, 0, 0, 1)];
    },
    "rabatment": function (aspect) {
      var out = [];
      function squareWithDiags(x0, y0, x1, y1) {
        out.push.apply(out, rectPolys(x0, y0, x1, y1));
        out.push(SEG(x0, y0, x1, y1), SEG(x1, y0, x0, y1));
      }
      if (aspect >= 1) {
        var s = 1 / aspect;
        if (s > 0.995) {
          squareWithDiags(0, 0, 1, 1);
        } else {
          squareWithDiags(0, 0, s, 1);
          squareWithDiags(1 - s, 0, 1, 1);
        }
      } else {
        var t = aspect;
        if (t > 0.995) {
          squareWithDiags(0, 0, 1, 1);
        } else {
          squareWithDiags(0, 0, 1, t);
          squareWithDiags(0, 1 - t, 1, 1);
        }
      }
      return out;
    },
    "radial-burst": function () {
      var out = [];
      var c = { x: 0.5, y: 0.5 };
      for (var k = 0; k < 16; k++) {
        var a = k * Math.PI / 8;
        pushClipped(out, c, { x: c.x + 2 * Math.cos(a), y: c.y + 2 * Math.sin(a) });
      }
      return out;
    },
    "steelyard": function (aspect) {
      var out = [SEG(0, 1, 1, 0)];
      var BL = { x: 0, y: 1 };
      var TR = { x: 1, y: 0 };
      var F = lerpPoint(BL, TR, 1 / PHI);
      var A = toAspect(BL, aspect);
      var B = toAspect(TR, aspect);
      var dx = B.x - A.x;
      var dy = B.y - A.y;
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var nx = -dy / len;
      var ny = dx / len;
      var Fp = toAspect(F, aspect);
      pushClipped(out,
        fromAspect({ x: Fp.x - nx * 3, y: Fp.y - ny * 3 }, aspect),
        fromAspect({ x: Fp.x + nx * 3, y: Fp.y + ny * 3 }, aspect));
      out.push.apply(out, plusPolys(F.x, F.y, 0.03));
      return out;
    },
    "diagonal-method": function (aspect) {
      var out = [];
      var rays = [
        { p: { x: 0, y: 0 }, d: { x: 1, y: aspect } },
        { p: { x: 1, y: 0 }, d: { x: -1, y: aspect } },
        { p: { x: 0, y: 1 }, d: { x: 1, y: -aspect } },
        { p: { x: 1, y: 1 }, d: { x: -1, y: -aspect } }
      ];
      rays.forEach(function (r) {
        pushClipped(out, r.p, { x: r.p.x + r.d.x * 3, y: r.p.y + r.d.y * 3 });
      });
      return out;
    },
    "dynamic-symmetry": function (aspect) {
      var TL = { x: 0, y: 0 };
      var TR = { x: 1, y: 0 };
      var BR = { x: 1, y: 1 };
      var BL = { x: 0, y: 1 };
      var out = [SEG(0, 0, 1, 1), SEG(1, 0, 0, 1)];
      [[TR, TL, BR], [BL, TL, BR], [TL, TR, BL], [BR, TR, BL]].forEach(function (t) {
        out.push([t[0], aspectFoot(t[0], t[1], t[2], aspect)]);
      });
      return out;
    },
    "golden-triangle": function (aspect) {
      var A = { x: 0, y: 1 };
      var B = { x: 1, y: 0 };
      var out = [SEG(0, 1, 1, 0)];
      [{ x: 0, y: 0 }, { x: 1, y: 1 }].forEach(function (p) {
        out.push([p, aspectFoot(p, A, B, aspect)]);
      });
      return out;
    },
    "s-curve": function () {
      return [cubicPoints(
        { x: 0.10, y: 0.95 },
        { x: 0.15, y: 0.55 },
        { x: 0.85, y: 0.45 },
        { x: 0.90, y: 0.05 },
        48
      )];
    },
    "rings": function (aspect) {
      var am = Math.min(0.5, 0.5 / aspect);
      var out = [
        ringPoly(0.5, 0.5, am / 3, aspect),
        ringPoly(0.5, 0.5, 2 * am / 3, aspect),
        ringPoly(0.5, 0.5, am, aspect)
      ];
      out.push.apply(out, plusPolys(0.5, 0.5, 0.025));
      return out;
    },
    "horizon-ratios": function () {
      var a = 1 / PHI;
      var b = 1 - a;
      return [H(0.25), H(b), H(0.5), H(a), H(0.75)];
    },
    "rule-of-odds": function () {
      return [V(1 / 3), V(2 / 3), V(0.2), V(0.4), V(0.6), V(0.8)];
    },
    "quadrants": function () {
      return [V(0.5), H(0.5)];
    },
    "scaling-grid": function () {
      var out = [];
      for (var k = 1; k < 10; k++) {
        out.push(V(k / 10), H(k / 10));
      }
      return out;
    },
    "room-1pt": function () {
      var m = 0.22;
      var out = [H(0.5)];
      out.push.apply(out, rectPolys(m, m, 1 - m, 1 - m));
      out.push(SEG(m, m, 0, 0), SEG(1 - m, m, 1, 0), SEG(1 - m, 1 - m, 1, 1), SEG(m, 1 - m, 0, 1));
      return out;
    },
    "depth-1pt": function () {
      var v0 = 0.35;
      var out = [H(v0), SEG(0.5, v0, 0, 1), SEG(0.5, v0, 1, 1)];
      for (var k = 1; k <= 6; k++) {
        var v = 1 - (1 - v0) * Math.pow(0.72, k);
        var uL = 0.5 * (1 - (v - v0) / (1 - v0));
        out.push(SEG(uL, v, 1 - uL, v));
      }
      return out;
    },
    "persp-2pt": function () {
      var out = [H(0.5), V(0.5)];
      var VP1 = { x: -0.35, y: 0.5 };
      var VP2 = { x: 1.35, y: 0.5 };
      [0, 0.25, 0.75, 1].forEach(function (v) {
        pushClipped(out, VP1, { x: 1, y: v });
        pushClipped(out, VP2, { x: 0, y: v });
      });
      return out;
    },
    "persp-3pt": function () {
      var out = [H(0.5)];
      var VP1 = { x: -0.35, y: 0.5 };
      var VP2 = { x: 1.35, y: 0.5 };
      var VP3 = { x: 0.5, y: -0.6 };
      [0, 0.25, 0.75, 1].forEach(function (v) {
        pushClipped(out, VP1, { x: 1, y: v });
        pushClipped(out, VP2, { x: 0, y: v });
      });
      [0.125, 0.375, 0.625, 0.875].forEach(function (u) {
        pushClipped(out, VP3, { x: u, y: 1 });
      });
      return out;
    },
    "persp-1pt": function () {
      var VP = { x: 0.5, y: 0.5 };
      return [H(0.5), V(0.5),
        [VP, { x: 0, y: 0 }], [VP, { x: 1, y: 0 }],
        [VP, { x: 1, y: 1 }], [VP, { x: 0, y: 1 }]];
    },
    "alignment": function () {
      var out = [V(0.5), H(0.5)];
      out.push.apply(out, rectPolys(0.06, 0.06, 0.94, 0.94));
      return out;
    },
    "balance": function () {
      return [V(0.5), H(0.5), SEG(0, 0, 1, 1), SEG(1, 0, 0, 1)];
    },
    "hierarchy": function () {
      var out = plusPolys(0.5, 0.5, 0.05);
      out.push.apply(out, diamondPolys(0.5, 0.44, 0.035));
      return out;
    },
    "whitespace": function () {
      var out = rectPolys(0.1, 0.1, 0.9, 0.9);
      out.push.apply(out, rectPolys(0.2, 0.2, 0.8, 0.8));
      return out;
    },
    "rhythm": function () {
      var out = [];
      for (var k = 1; k < 8; k++) out.push(V(k / 8));
      return out;
    },
    "movement": function () {
      var out = [];
      [0.7, 0.85, 1.0, 1.15, 1.3].forEach(function (c) {
        pushClipped(out, { x: 0, y: c }, { x: 1, y: c - 1 });
      });
      return out;
    },
    "emphasis": function (aspect) {
      var am = Math.min(0.5, 0.5 / aspect);
      var out = [ringPoly(0.5, 0.5, 0.35 * am, aspect, 48)];
      out.push.apply(out, plusPolys(0.5, 0.5, 0.07));
      return out;
    },
    "proximity": function () {
      var out = [];
      for (var i = 1; i < 8; i++) {
        for (var j = 1; j < 8; j++) {
          out.push.apply(out, plusPolys(i / 8, j / 8, 0.008));
        }
      }
      return out;
    }
  };

  // Guide registry: the single source of truth for the selector UI.
  // Groups: "geometry" (proportion constructions), "perspective"
  // (fixed canonical vanishing points), "aids" (placement helpers that
  // do not analyze the artwork).
  var GUIDES = [
    { id: "thirds", group: "geometry", name: "Rule of Thirds", blurb: "Classic thirds grid inside your marked corners." },
    { id: "phi-grid", group: "geometry", name: "Golden Ratio", blurb: "Golden-ratio grid: divisions at 0.382 and 0.618." },
    { id: "golden-spiral", group: "geometry", name: "Golden Spiral", blurb: "Fibonacci golden spiral with its squares, true proportions, centered." },
    { id: "nested-halves", group: "geometry", name: "Nested Halves", blurb: "Halves, quarters, and eighths for fine alignment." },
    { id: "root-rect", group: "geometry", name: "Root Rectangle", blurb: "Root-2 divisions with the frame diagonals." },
    { id: "rabatment", group: "geometry", name: "Rabatment", blurb: "Squares on the short side with their diagonals; follows the artwork orientation." },
    { id: "radial-burst", group: "geometry", name: "Radial Burst", blurb: "Sixteen rays from the center for radial compositions." },
    { id: "steelyard", group: "geometry", name: "Steelyard", blurb: "Diagonal beam with a golden-section fulcrum and counter-line." },
    { id: "diagonal-method", group: "geometry", name: "Diagonal Method", blurb: "True 45-degree diagonals from each corner." },
    { id: "dynamic-symmetry", group: "geometry", name: "Dynamic Symmetry", blurb: "Frame diagonals with corner perpendiculars; crossings mark dynamic nodes." },
    { id: "golden-triangle", group: "geometry", name: "Golden Triangle", blurb: "Main diagonal with perpendiculars from the other corners." },
    { id: "s-curve", group: "geometry", name: "S-Curve", blurb: "An S-curve path for winding compositions." },
    { id: "rings", group: "geometry", name: "Concentric Rings", blurb: "Concentric circles around the center." },
    { id: "horizon-ratios", group: "geometry", name: "Horizon Ratios", blurb: "Candidate horizon heights: quarters, thirds, half, phi." },
    { id: "rule-of-odds", group: "geometry", name: "Rule of Odds", blurb: "Thirds plus fifths columns for odd groupings." },
    { id: "quadrants", group: "geometry", name: "Quadrants", blurb: "Centerlines dividing the frame into four." },
    { id: "scaling-grid", group: "geometry", name: "Scaling Grid", blurb: "10 by 10 grid for scaling or transferring the composition." },
    { id: "room-1pt", group: "perspective", name: "One-Point Room", blurb: "One-point room: back wall, horizon, and corner orthogonals." },
    { id: "depth-1pt", group: "perspective", name: "One-Point Depth", blurb: "Receding floor grid in one-point perspective (approximate spacing)." },
    { id: "persp-2pt", group: "perspective", name: "Two-Point Perspective", blurb: "Two-point construction with horizon vanishing points." },
    { id: "persp-3pt", group: "perspective", name: "Three-Point Perspective", blurb: "Three-point construction with a high vanishing point." },
    { id: "persp-1pt", group: "perspective", name: "One-Point Perspective", blurb: "One-point construction: orthogonals, horizon, centerlines." },
    { id: "alignment", group: "aids", name: "Alignment", blurb: "Centerlines plus a 6% safe-area frame. Placement aid only." },
    { id: "balance", group: "aids", name: "Visual Balance", blurb: "Centerlines and diagonals as balance axes. Does not analyze your artwork." },
    { id: "hierarchy", group: "aids", name: "Visual Hierarchy", blurb: "Plus marks the geometric center; diamond marks the conventional optical center. Placement aid only." },
    { id: "whitespace", group: "aids", name: "White Space", blurb: "10% and 20% margin frames for checking breathing room. Placement aid only." },
    { id: "rhythm", group: "aids", name: "Rhythm", blurb: "Eight even columns for checking repeating intervals. Placement aid only." },
    { id: "movement", group: "aids", name: "Movement", blurb: "Diagonal flow lines for checking direction. Placement aid only." },
    { id: "emphasis", group: "aids", name: "Emphasis", blurb: "Center crosshair with a focal ring. Placement aid only." },
    { id: "proximity", group: "aids", name: "Proximity", blurb: "Dot grid for judging grouping and spacing. Placement aid only." }
  ];

  // Artwork-space polylines for a guide id. Aspect defaults to 1 (square).
  function traceUv(id, aspect) {
    var build = BUILDERS[id];
    if (!build) throw new Error("unknown guide: " + id);
    return build(aspect || 1);
  }

  // Map one artwork-space polyline onto the ordered quad. Straight
  // two-point segments are subdivided so they bend correctly under
  // perspective; sampled curves map point by point.
  function mapPolyline(quad, pts, subdiv) {
    var out = [];
    for (var i = 0; i < pts.length - 1; i++) {
      for (var k = 0; k < subdiv; k++) {
        var t = k / subdiv;
        out.push(bilinear(quad,
          lerp(pts[i].x, pts[i + 1].x, t),
          lerp(pts[i].y, pts[i + 1].y, t)));
      }
    }
    var last = pts[pts.length - 1];
    out.push(bilinear(quad, last.x, last.y));
    return out;
  }

  // Display-fraction polylines for guide id on the ordered quad.
  function traceGuide(id, quad, aspect) {
    if (!Array.isArray(quad) || quad.length !== 4) {
      throw new Error("traceGuide expects an ordered quad of 4 corners");
    }
    return traceUv(id, aspect).map(function (poly) {
      return mapPolyline(quad, poly, poly.length === 2 ? 10 : 1);
    });
  }

  // --- Automatic guide pick ---
  // Scores a guide against a visual-weight map of the rectified artwork:
  // the mean weight along its lines divided by the map's mean weight.
  // weights is array-like, row-major, uv-aligned, gw by gh. Out-of-frame
  // samples are skipped; a guide with no samples scores 1 (neutral).
  function scoreGuide(id, aspect, weights, gw, gh) {
    var polys = traceUv(id, aspect || 1);
    var n = Math.max(gw, gh);
    var sum = 0;
    var count = 0;
    function tap(u, v) {
      if (u < 0 || u > 1 || v < 0 || v > 1) return null;
      var x = Math.min(gw - 1, Math.max(0, Math.floor(u * gw)));
      var y = Math.min(gh - 1, Math.max(0, Math.floor(v * gh)));
      var w = weights[y * gw + x];
      return isFinite(w) ? w : null;
    }
    function tapPoly(poly) {
      if (poly.length === 1) {
        var w0 = tap(poly[0].x, poly[0].y);
        if (w0 !== null) {
          sum += w0;
          count++;
        }
        return;
      }
      for (var i = 0; i + 1 < poly.length; i++) {
        var a = poly[i];
        var b = poly[i + 1];
        var dx = b.x - a.x;
        var dy = b.y - a.y;
        var steps = Math.max(1, Math.ceil(Math.sqrt(dx * dx + dy * dy) * n * 2));
        for (var s = 0; s <= steps; s++) {
          var w = tap(a.x + dx * (s / steps), a.y + dy * (s / steps));
          if (w !== null) {
            sum += w;
            count++;
          }
        }
      }
    }
    polys.forEach(tapPoly);
    if (!count) return 1;
    var total = 0;
    var tn = 0;
    for (var k = 0; k < weights.length; k++) {
      if (isFinite(weights[k])) {
        total += weights[k];
        tn++;
      }
    }
    var overall = tn ? total / tn : 0;
    if (overall <= 0) return 1;
    return (sum / count) / overall;
  }

  // Picks the geometry/perspective guide whose lines best track the
  // weight map. Placement aids never analyze content, so they are
  // excluded. Returns { id, score }; ties keep catalog order.
  function autoPickGuide(weights, gw, gh, aspect) {
    var best = null;
    GUIDES.forEach(function (g) {
      if (g.group !== "geometry" && g.group !== "perspective") return;
      var s = scoreGuide(g.id, aspect || 1, weights, gw, gh);
      if (!best || s > best.score) best = { id: g.id, score: s };
    });
    return best || { id: "thirds", score: 1 };
  }

  return {
    PHI: PHI,
    lerpPoint: lerpPoint,
    orderCorners: orderCorners,
    signedArea: signedArea,
    thirdsLines: thirdsLines,
    bilinear: bilinear,
    clipSegment: clipSegment,
    traceUv: traceUv,
    traceGuide: traceGuide,
    goldenSpiralTiling: goldenSpiralTiling,
    scoreGuide: scoreGuide,
    autoPickGuide: autoPickGuide,
    GUIDES: GUIDES
  };
});
