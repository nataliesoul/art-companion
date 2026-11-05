// Artwork rectification for Artist Companion. Pure functions, no DOM.
// Inverse-maps each output pixel through the marked quad and bilinearly
// samples the source, producing a front-on view for analysis. Coordinates
// follow canvas conventions (pixel centers at integer + 0.5).
//
// Shared between the browser app (public/app.js) and Node tests.
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    root.ACRectify = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  // quad: [TL, TR, BR, BL] in fractions of the source image.
  function bilinearQuad(quad, u, v) {
    var topX = lerp(quad[0].x, quad[1].x, u);
    var topY = lerp(quad[0].y, quad[1].y, u);
    var botX = lerp(quad[3].x, quad[2].x, u);
    var botY = lerp(quad[3].y, quad[2].y, u);
    return { x: lerp(topX, botX, v), y: lerp(topY, botY, v) };
  }

  function sampleBilinear(pixels, w, h, x, y) {
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x > w - 1) x = w - 1;
    if (y > h - 1) y = h - 1;
    var x0 = Math.floor(x);
    var y0 = Math.floor(y);
    var x1 = Math.min(w - 1, x0 + 1);
    var y1 = Math.min(h - 1, y0 + 1);
    var fx = x - x0;
    var fy = y - y0;
    function tap(px, py) {
      var i = (py * w + px) * 4;
      return [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]];
    }
    var a = tap(x0, y0);
    var b = tap(x1, y0);
    var c = tap(x0, y1);
    var d = tap(x1, y1);
    var out = [0, 0, 0, 0];
    for (var k = 0; k < 4; k++) {
      out[k] = Math.round(lerp(lerp(a[k], b[k], fx), lerp(c[k], d[k], fx), fy));
    }
    return out;
  }

  // pixels: source RGBA (array-like), srcW/srcH its size. Returns
  // { data: Uint8ClampedArray, width, height } of size outW x outH.
  function rectify(pixels, srcW, srcH, quad, outW, outH) {
    if (!Array.isArray(quad) || quad.length !== 4) {
      throw new Error("rectify expects a quad of 4 corners");
    }
    if (!(outW > 0 && outH > 0)) {
      throw new Error("rectify expects positive output dimensions");
    }
    var out = new Uint8ClampedArray(outW * outH * 4);
    for (var oy = 0; oy < outH; oy++) {
      for (var ox = 0; ox < outW; ox++) {
        var u = (ox + 0.5) / outW;
        var v = (oy + 0.5) / outH;
        var p = bilinearQuad(quad, u, v);
        var s = sampleBilinear(pixels, srcW, srcH, p.x * srcW - 0.5, p.y * srcH - 0.5);
        var o = (oy * outW + ox) * 4;
        out[o] = s[0];
        out[o + 1] = s[1];
        out[o + 2] = s[2];
        out[o + 3] = s[3];
      }
    }
    return { data: out, width: outW, height: outH };
  }

  return {
    rectify: rectify
  };
});
