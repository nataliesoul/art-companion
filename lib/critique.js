// Critique prompt builder and response normalizer (server-side only).
// Keeps provider keys and raw API traffic out of the browser. Model-facing
// text grounds every comment in the artwork the artist actually sent plus
// the app's measured data (palette, format, white balance, guides).
const fs = require("fs");
const path = require("path");
const { GUIDES } = require("../public/grid.js");
const ACColor = require("../public/color.js");

const GUIDE_CATALOG = GUIDES.map((g) => `${g.name}: ${g.blurb}`).join("\n");

function loadColorDigest() {
  try {
    const ref = JSON.parse(
      fs.readFileSync(path.join(__dirname, "..", "docs", "color-theory.json"), "utf8")
    );
    const schemes = (ref.harmonySchemes || [])
      .map((s) => `${s.name} (${s.geometry}): ${s.reading}`)
      .join("\n");
    const rules = (ref.critiqueGuidance || []).join("\n");
    return `Color harmony schemes:\n${schemes}\nColor critique rules:\n${rules}`;
  } catch (err) {
    return "Color critique rules: cite measured colors; state uncertainty; never invent palette entries.";
  }
}

const SYSTEM_PROMPT =
  "You are a constructive art coach helping an artist who works in physical media. " +
  "All feedback is optional guidance, never rules. " +
  "Ground every comment in the attached images and the measured data provided; " +
  "never invent details you cannot see, never name pigments, and never score or grade. " +
  "Prefer observations over prescriptions, keep language plain and kind, and say plainly " +
  "what you are unsure about (photo lighting, screen differences, unknown intent).";

function buildPrompt({ intent, medium, topic, guide, palette, formatNote, wbNote }) {
  const paletteLines = (palette || [])
    .map((c) => `${c.hex} (${Math.round((c.coverage || 0) * 100)}%)`)
    .join(", ");
  const userText = [
    `Artwork medium: ${medium || "not stated"}.`,
    `Artist intent: ${intent && intent.trim() ? intent.trim() : "not stated"}.`,
    `Feedback topic: ${topic || "Composition"}.`,
    `Artwork format: ${formatNote || "measured from photo corners"}.`,
    `Palette sampled from the artwork photo${wbNote ? ` (${wbNote})` : ""}: ${paletteLines || "none"}.`,
    `Attached image 1 is the rectified artwork. Attached image 2 shows it with the "${guide ? guide.name : "Rule of Thirds"}" overlay.`,
    "Reference it and any of these guides by name where relevant:",
    GUIDE_CATALOG,
    loadColorDigest(),
    "Respond with JSON only: strengths (1-3 short strings), observations (at most 3 strings, " +
    "most important first), nextSteps (0-3 optional strings), uncertainty (one string)."
  ].join("\n\n");
  return { system: SYSTEM_PROMPT, userText };
}

const CRITIQUE_SCHEMA = {
  name: "artwork_critique",
  schema: {
    type: "object",
    properties: {
      strengths: { type: "array", items: { type: "string" }, maxItems: 3 },
      observations: { type: "array", items: { type: "string" }, maxItems: 3 },
      nextSteps: { type: "array", items: { type: "string" }, maxItems: 3 },
      uncertainty: { type: "string" }
    },
    required: ["strengths", "observations", "uncertainty"],
    additionalProperties: false
  }
};

function buildRequest({ model, system, userText, images, schema, maxTokens, history }) {
  const messages = [
    { role: "system", content: system },
    {
      role: "user",
      content: [
        { type: "text", text: userText },
        ...images.map((url) => ({ type: "image_url", image_url: { url } }))
      ]
    }
  ];
  (history || []).forEach((m) => {
    messages.push({ role: m.role, content: m.content });
  });
  const body = {
    model,
    messages,
    temperature: 0.3,
    // Generous output cap: reasoning models can spend tokens thinking before
    // answering, and a tight cap returns content:null with finish_reason:length.
    max_tokens: maxTokens || 4000
  };
  // Free-text calls (voice conversation) pass schema: null and get no
  // response_format; structured calls keep their JSON schema.
  if (schema) {
    body.response_format = { type: "json_schema", json_schema: schema };
  }
  return body;
}

const SUGGEST_SYSTEM =
  "You help an artist pick composition guides for their own artwork. " +
  "Answer only with the requested JSON, using guide ids exactly as given.";

function buildSuggestPrompt({ palette }) {
  const paletteLines = (palette || [])
    .map((c) => `${c.hex} (${Math.round((c.coverage || 0) * 100)}%)`)
    .join(", ");
  const catalog = GUIDES.map((g) => `${g.id} (${g.name})`).join("\n");
  return {
    system: SUGGEST_SYSTEM,
    userText: [
      "Attached is the artist's rectified artwork" +
      (paletteLines ? ` with sampled palette ${paletteLines}` : "") + ".",
      "Which composition guides from this catalog would best reveal its structure?",
      catalog,
      "Respond with JSON only: suggestedGuides, an array of at most 2 objects " +
      "with id (exact catalog id) and reason (one short string)."
    ].join("\n\n")
  };
}

const GUIDE_SUGGEST_SCHEMA = {
  name: "guide_suggestion",
  schema: {
    type: "object",
    properties: {
      suggestedGuides: {
        type: "array",
        maxItems: 2,
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            reason: { type: "string" }
          },
          required: ["id", "reason"],
          additionalProperties: false
        }
      }
    },
    required: ["suggestedGuides"],
    additionalProperties: false
  }
};

// Lenient JSON extraction shared by all response parsers: fenced or
// embedded JSON is unwrapped; anything else throws like other responses.
function jsonFromText(text) {
  let jsonText = String(text || "").trim();
  const fenced = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced) jsonText = fenced[1];
  if (!jsonText.startsWith("{")) {
    const start = jsonText.indexOf("{");
    const end = jsonText.lastIndexOf("}");
    if (start >= 0 && end > start) jsonText = jsonText.slice(start, end + 1);
  }
  try {
    return JSON.parse(jsonText);
  } catch (err) {
    const error = new Error("Model response was not valid JSON.");
    error.code = "bad_response";
    throw error;
  }
}

function shortReason(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max || 160) : "";
}

// Guide picks with ids validated against the real registry.
// Unknown ids are dropped; unparseable output throws like other responses.
function validateGuides(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((s) => s && GUIDES.some((g) => g.id === s.id))
    .slice(0, 2)
    .map((s) => ({
      id: s.id,
      name: GUIDES.find((g) => g.id === s.id).name,
      reason: shortReason(s.reason)
    }));
}

// Suggested guides with ids validated against the real registry.
// Unknown ids are dropped; unparseable output throws like other responses.
function parseSuggestContent(text) {
  const parsed = jsonFromText(text);
  if (!parsed || !Array.isArray(parsed.suggestedGuides)) return [];
  return validateGuides(parsed.suggestedGuides);
}

function extractContent(providerJson) {
  const message = providerJson &&
    providerJson.choices &&
    providerJson.choices[0] &&
    providerJson.choices[0].message;
  const content = message && message.content;
  if (typeof content === "string" && content.trim()) return content;
  if (Array.isArray(content)) {
    const text = content
      .filter((p) => p && (p.type === "text" || typeof p.text === "string"))
      .map((p) => p.text || "")
      .join("");
    if (text.trim()) return text;
  }
  if (content && typeof content.text === "string" && content.text.trim()) {
    return content.text;
  }
  const err = new Error("Model response had no readable content.");
  err.code = "bad_response";
  throw err;
}

// First-choice finish reason, if any. "length" means the model hit the
// output cap and the content is truncated or missing.
function finishReason(providerJson) {
  const choice = providerJson && providerJson.choices && providerJson.choices[0];
  return (choice && choice.finish_reason) || null;
}

function parseContent(text) {
  const parsed = jsonFromText(text);
  function strings(value) {
    if (!Array.isArray(value)) return [];
    return value.filter((v) => typeof v === "string" && v.trim()).map((v) => v.trim());
  }
  return {
    strengths: strings(parsed.strengths).slice(0, 3),
    observations: strings(parsed.observations).slice(0, 3),
    nextSteps: strings(parsed.nextSteps).slice(0, 3),
    uncertainty: typeof parsed.uncertainty === "string" && parsed.uncertainty.trim()
      ? parsed.uncertainty.trim()
      : "Not stated by the model."
  };
}

// Harmony schemes the model may recommend. Labels match the app's
// measured harmony groups exactly; colors are always computed here,
// never trusted from model output.
const HARMONY_SCHEMES = [
  { id: "complementary", label: "Complementary", geometry: "opposite hue, 180 degrees" },
  { id: "analogous", label: "Analogous", geometry: "neighbors at -30 and +30 degrees" },
  { id: "triadic", label: "Triadic", geometry: "evenly spaced at 120 and 240 degrees" },
  { id: "split", label: "Split complementary", geometry: "neighbors of the opposite at 150 and 210 degrees" }
];

// Anchor plus exact harmony rotations, or null for unknown scheme/bad hex.
function directionPaletteColors(schemeId, anchorHex) {
  const scheme = HARMONY_SCHEMES.find((s) => s.id === schemeId);
  if (!scheme || typeof anchorHex !== "string") return null;
  let anchor;
  try {
    const rgb = ACColor.hexToRgb(anchorHex);
    anchor = ACColor.rgbToHex(rgb.r, rgb.g, rgb.b);
  } catch (err) {
    return null;
  }
  const group = ACColor.harmonies(anchor).find((g) => g.label === scheme.label);
  if (!group) return null;
  return [anchor].concat(group.colors);
}

const DIRECTION_SYSTEM =
  "You are a constructive art coach helping an artist who works in physical media. " +
  "All feedback is optional guidance, never rules. " +
  "Recommend composition guides and a color direction grounded in the attached artwork and the measured palette; " +
  "never invent colors, never name pigments, and never score or grade. " +
  "Answer only with the requested JSON.";

function buildDirectionPrompt({ palette, intent, medium }) {
  const paletteLines = (palette || [])
    .map((c) => `${c.hex} (${Math.round((c.coverage || 0) * 100)}%)`)
    .join(", ");
  const catalog = GUIDES.map((g) => `${g.id} (${g.name})`).join("\n");
  const schemes = HARMONY_SCHEMES
    .map((s) => `${s.id} (${s.label}): ${s.geometry}`)
    .join("\n");
  return {
    system: DIRECTION_SYSTEM,
    userText: [
      `Artwork medium: ${medium || "not stated"}.`,
      `Artist intent: ${intent && intent.trim() ? intent.trim() : "not stated"}.`,
      "Attached is the artist's rectified artwork" +
      (paletteLines ? ` with sampled palette ${paletteLines}` : "") + ".",
      "Which composition guides from this catalog would best reveal its structure?",
      catalog,
      "Which harmony scheme fits this artwork, anchored on one of the sampled hexes above?",
      schemes,
      "Respond with JSON only: guides (array of at most 2 objects with id, an exact catalog id, " +
      "and reason, one short string), palette (object with scheme, an exact scheme id, anchorHex, " +
      "one sampled hex exactly as written, and reason, one short string), summary (2-4 sentences " +
      "explaining why this direction suits the artwork), uncertainty (one string)."
    ].join("\n\n")
  };
}

const DIRECTION_SCHEMA = {
  name: "art_direction",
  schema: {
    type: "object",
    properties: {
      guides: {
        type: "array",
        maxItems: 2,
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            reason: { type: "string" }
          },
          required: ["id", "reason"],
          additionalProperties: false
        }
      },
      palette: {
        type: "object",
        properties: {
          scheme: { type: "string", enum: HARMONY_SCHEMES.map((s) => s.id) },
          anchorHex: { type: "string" },
          reason: { type: "string" }
        },
        required: ["scheme", "anchorHex", "reason"],
        additionalProperties: false
      },
      summary: { type: "string" },
      uncertainty: { type: "string" }
    },
    required: ["guides", "palette", "summary", "uncertainty"],
    additionalProperties: false
  }
};

// Full direction parse. Guide ids are validated; the scheme must be known
// and the anchor must be a sampled hex (case-insensitive), otherwise the
// dominant sampled color anchors it. Bad scheme or empty palette drops the
// pick instead of inventing colors.
// Resolves a model palette pick ({scheme, anchorHex, reason}) against the
// sampled palette: colors are always computed here, never trusted from output.
function resolvePalettePick(pick, palette, reasonMax) {
  const sampled = Array.isArray(palette) ? palette : [];
  let palettePick = null;
  if (pick && typeof pick === "object" && sampled.length) {
    const scheme = HARMONY_SCHEMES.find((s) => s.id === pick.scheme);
    if (scheme) {
      const wanted = typeof pick.anchorHex === "string" ? pick.anchorHex.toLowerCase() : "";
      const matched = sampled.find((c) => typeof c.hex === "string" && c.hex.toLowerCase() === wanted);
      const anchor = matched ||
        sampled.slice().sort((a, b) => (b.coverage || 0) - (a.coverage || 0))[0];
      const colors = anchor ? directionPaletteColors(scheme.id, anchor.hex) : null;
      if (colors) {
        palettePick = {
          scheme: scheme.id,
          schemeLabel: scheme.label,
          anchorHex: colors[0],
          colors,
          reason: shortReason(pick.reason, reasonMax)
        };
      }
    }
  }
  return palettePick;
}

function parseDirectionContent(text, palette) {
  const parsed = jsonFromText(text);
  return {
    guides: parsed ? validateGuides(parsed.guides) : [],
    palette: resolvePalettePick(parsed && parsed.palette, palette),
    summary: parsed && typeof parsed.summary === "string" && parsed.summary.trim()
      ? parsed.summary.trim().slice(0, 600)
      : "No summary stated.",
    uncertainty: parsed && typeof parsed.uncertainty === "string" && parsed.uncertainty.trim()
      ? parsed.uncertainty.trim()
      : "Not stated by the model."
  };
}

const CHAT_SYSTEM =
  "You are a constructive art coach talking with an artist about their own physical artwork. " +
  "All feedback is optional guidance, never rules. " +
  "Ground artwork comments in the attached rectified image and the measured data; " +
  "never invent details you cannot see, never name pigments, and never score or grade. " +
  "You may answer general art questions briefly. " +
  "Your reply will be read aloud, so answer in plain conversational prose: 2-4 short sentences, " +
  "no lists, no markdown, no JSON, no emoji.";

// Artwork context carried on every chat turn; the conversation history
// follows it as plain user/assistant messages.
function buildChatPrompt({ palette, intent, medium }) {
  const paletteLines = (palette || [])
    .map((c) => `${c.hex} (${Math.round((c.coverage || 0) * 100)}%)`)
    .join(", ");
  return [
    `Artwork medium: ${medium || "not stated"}.`,
    `Artist intent: ${intent && intent.trim() ? intent.trim() : "not stated"}.`,
    `Palette sampled from the artwork photo: ${paletteLines || "none"}.`,
    "Attached is the artist's rectified artwork. The conversation below is about it."
  ].join("\n\n");
}

const CHAT_HISTORY_MAX = 12;
const CHAT_MESSAGE_MAX = 2000;

// Client history is untrusted input: keep user/assistant turns only,
// trim each message, and cap the count to the most recent turns.
function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((m) => m && (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, CHAT_MESSAGE_MAX) }))
    .slice(-CHAT_HISTORY_MAX);
}

// Annotation kinds the model may place on the artwork. Coordinates are
// fractions of the rectified image (origin top-left); the client maps
// them onto its overlay. Only balance/weight and focal/accent marks.
const ANNOTATE_KINDS = ["mass", "heavy", "light", "shift", "focal", "accent"];

const ANNOTATE_SYSTEM =
  "You are a constructive art coach marking up an abstract artwork for its artist. " +
  "All marks are optional suggestions, never rules. " +
  "Ground every mark in the attached rectified image and the measured palette; " +
  "never invent details you cannot see, never name pigments, and never score or grade. " +
  "Answer only with the requested JSON.";

function buildAnnotatePrompt({ palette, intent, medium }) {
  const paletteLines = (palette || [])
    .map((c) => `${c.hex} (${Math.round((c.coverage || 0) * 100)}%)`)
    .join(", ");
  return {
    system: ANNOTATE_SYSTEM,
    userText: [
      `Artwork medium: ${medium || "not stated"}.`,
      `Artist intent: ${intent && intent.trim() ? intent.trim() : "not stated"}.`,
      `Palette sampled from the artwork photo: ${paletteLines || "none"}.`,
      "Attached is the artist's rectified abstract artwork. Coordinates are 0-1 " +
      "fractions of it, origin top-left.",
      "Mark up to 6 suggested changes, most important first, using only these kinds: " +
      "mass (at most 1: visual center of mass), heavy (0-2: areas pulling too much weight), " +
      "light (0-2: areas that could carry more), shift (0-2 arrows from x,y to x2,y2 " +
      "showing suggested movement of visual weight), focal (at most 1: where the eye " +
      "lands now), accent (0-2: spots where a new accent could help).",
      "Respond with JSON only: annotations (array of objects with kind, an exact kind " +
      "above, x, y, optional x2, y2 for shift arrows, label, a 2-5 word tag, and " +
      "reason, one short sentence), summary (2-3 sentences on the overall direction)."
    ].join("\n\n")
  };
}

const ANNOTATE_SCHEMA = {
  name: "art_annotations",
  schema: {
    type: "object",
    properties: {
      annotations: {
        type: "array",
        maxItems: 6,
        items: {
          type: "object",
          properties: {
            kind: { type: "string", enum: ANNOTATE_KINDS },
            x: { type: "number" },
            y: { type: "number" },
            x2: { type: "number" },
            y2: { type: "number" },
            label: { type: "string" },
            reason: { type: "string" }
          },
          required: ["kind", "x", "y", "label", "reason"],
          additionalProperties: false
        }
      },
      summary: { type: "string" }
    },
    required: ["annotations", "summary"],
    additionalProperties: false
  }
};

function clampUnit(value) {
  if (typeof value !== "number" || !isFinite(value)) return null;
  return Math.min(1, Math.max(0, value));
}

// Image model for the generated study. The text/vision model critiques;
// only the image model paints.
const IMAGE_MODEL = "muse-image-1.0";

function cleanHex(value) {
  if (typeof value !== "string") return null;
  const hex = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toLowerCase() : null;
}

// Client direction echoes are untrusted input: guide ids re-validate
// against the catalog, colors must be real hexes, text is trimmed.
// Returns normalized { guides, palette, summary } with nulls for junk.
function sanitizeDirection(direction) {
  if (!direction || typeof direction !== "object") {
    return { guides: [], palette: null, summary: "" };
  }
  const guides = validateGuides(direction.guides);
  let palette = null;
  const pick = direction.palette;
  if (pick && typeof pick === "object") {
    const colors = Array.isArray(pick.colors) ? pick.colors : [];
    const clean = colors.map(cleanHex).filter(Boolean).slice(0, 5);
    const anchor = cleanHex(pick.anchorHex);
    if (clean.length) {
      palette = {
        scheme: typeof pick.scheme === "string" ? pick.scheme.trim().slice(0, 40) : "",
        schemeLabel: typeof pick.schemeLabel === "string" && pick.schemeLabel.trim()
          ? pick.schemeLabel.trim().slice(0, 40)
          : (typeof pick.scheme === "string" && pick.scheme.trim() ? pick.scheme.trim().slice(0, 40) : "Suggested"),
        anchorHex: anchor && clean.indexOf(anchor) >= 0 ? anchor : clean[0],
        colors: clean,
        reason: shortReason(pick.reason)
      };
    }
  }
  return {
    guides,
    palette,
    summary: typeof direction.summary === "string" ? direction.summary.trim().slice(0, 600) : ""
  };
}

// Edit instruction for the image model, grounded in the artwork's own
// direction: sampled palette, scheme + anchor, guide reasons, intent.
// Without a direction it degrades to a faithful repaint instruction.
function buildGeneratePrompt({ intent, medium, palette, direction }) {
  const dir = sanitizeDirection(direction);
  const paletteLines = (palette || [])
    .filter((c) => c && cleanHex(c.hex))
    .map((c) => `${c.hex.toLowerCase()} (${Math.round((c.coverage || 0) * 100)}%)`)
    .join(", ");
  const parts = [
    "Repaint the attached rectified artwork as one suggested study."
  ];
  parts.push(`Medium feel to keep: ${medium || "as seen"}.`);
  if (intent && intent.trim()) parts.push(`Artist intent: ${intent.trim()}.`);
  if (paletteLines) parts.push(`Measured palette of the original: ${paletteLines}.`);
  if (dir.summary) parts.push(`Chosen direction: ${dir.summary}`);
  if (dir.guides.length) {
    parts.push("Honor these composition guides: " + dir.guides.map((g) => {
      const label = g.name || g.id;
      return g.reason ? `${label} (${g.reason})` : label;
    }).join("; ") + ".");
  }
  if (dir.palette) {
    parts.push(
      `Shift hues toward the ${dir.palette.schemeLabel} scheme anchored on ${dir.palette.anchorHex} ` +
      `(${dir.palette.colors.join(", ")})` +
      (dir.palette.reason ? `, because: ${dir.palette.reason}` : "") + "."
    );
  }
  parts.push(
    "Keep the same subject, composition, and orientation so the artist can compare directly. " +
    "Return only the repainted artwork rectangle, edge to edge: no border, no wall, " +
    "no device, no text, no watermark."
  );
  return parts.join("\n\n");
}

function clampImageSide(value) {
  if (value === null || value === undefined || value === "") return 1024;
  const n = Math.floor(Number(value));
  if (!isFinite(n)) return 1024;
  return Math.min(2048, Math.max(64, n));
}

// Single-shot JSON body for POST /images/edits: one study, aspect from
// the measured artwork, base64 PNG back.
function buildImageEditRequest({ model, prompt, image, width, height }) {
  return {
    model: model || IMAGE_MODEL,
    prompt,
    images: [{ image_url: image }],
    n: 1,
    size: `${clampImageSide(width)}x${clampImageSide(height)}`,
    response_format: "b64_json",
    output_format: "png"
  };
}

// First generated image as a data URL, plus the model's revised prompt
// when supplied. Anything else throws like other responses.
function parseImageResult(providerJson) {
  const fail = () => {
    const error = new Error("Model returned no image.");
    error.code = "bad_response";
    throw error;
  };
  const item = providerJson && providerJson.data && providerJson.data[0];
  if (!item || typeof item !== "object") fail();
  const revised = typeof item.revised_prompt === "string" && item.revised_prompt.trim()
    ? item.revised_prompt.trim().slice(0, 500)
    : null;
  if (typeof item.b64_json === "string") {
    const clean = item.b64_json.replace(/\s+/g, "");
    if (clean.length > 100 && /^[A-Za-z0-9+/=]+$/.test(clean)) {
      const fmt = providerJson.output_format;
      const mime = fmt === "jpeg" ? "image/jpeg" : fmt === "webp" ? "image/webp" : "image/png";
      return { image: `data:${mime};base64,${clean}`, revisedPrompt: revised };
    }
    fail();
  }
  if (typeof item.url === "string" && item.url.startsWith("https://")) {
    return { image: item.url.slice(0, 4000), revisedPrompt: revised };
  }
  fail();
}

// Placed marks with kinds validated and coordinates clamped to the
// frame. Malformed entries are dropped, never trusted.
// Marks with kinds and 0-1 coordinates validated; bad entries are dropped.
function sanitizeAnnotations(list) {
  if (!Array.isArray(list)) return [];
  const annotations = [];
  list.forEach((m) => {
    if (!m || ANNOTATE_KINDS.indexOf(m.kind) < 0) return;
    const x = clampUnit(m.x);
    const y = clampUnit(m.y);
    if (x === null || y === null) return;
    annotations.push({
      kind: m.kind,
      x,
      y,
      x2: clampUnit(m.x2),
      y2: clampUnit(m.y2),
      label: typeof m.label === "string" ? m.label.trim().slice(0, 80) : "",
      reason: typeof m.reason === "string" ? m.reason.trim().slice(0, 200) : ""
    });
  });
  return annotations.slice(0, 6);
}

function parseAnnotateContent(text) {
  const parsed = jsonFromText(text);
  const annotations = sanitizeAnnotations(parsed && parsed.annotations);
  return {
    annotations,
    summary: parsed && typeof parsed.summary === "string" && parsed.summary.trim()
      ? parsed.summary.trim().slice(0, 600)
      : "No summary stated."
  };
}

// One automatic, comprehensive read of the artwork: the report the studio
// shows (and can read aloud) without the artist pressing separate buttons.
const OVERVIEW_ASPECTS = [
  { id: "composition", title: "Composition", ask: "how the main shapes and the eye's path are arranged, naming a catalog guide only if it genuinely fits" },
  { id: "values", title: "Values", ask: "the light and dark structure: range, where the strongest contrast sits, and whether it supports the focal area" },
  { id: "color", title: "Color", ask: "temperature, saturation and the relationships among the sampled colors" },
  { id: "balance", title: "Balance & emphasis", ask: "where visual weight gathers, what reads as the focal area now, and what competes with it" }
];

const OVERVIEW_SYSTEM = SYSTEM_PROMPT +
  " Your reply becomes a visual report for the artist and may be read aloud, so every string " +
  "must be plain prose: no markdown, no lists inside strings, no emoji, no scores. " +
  "Never quote hex codes or coverage percentages in prose; the report shows the swatches itself, " +
  "so name colors in plain words such as the muted green pot or the cream ground. " +
  "Next steps must be concrete things to try on the artwork, never requests for more information. " +
  "Keep every sentence to about twenty words or fewer so each observation lands as one clear thought.";

function buildOverviewPrompt({ intent, medium, guide, palette, formatNote, wbNote }) {
  const paletteLines = (palette || [])
    .map((c) => `${c.hex} (${Math.round((c.coverage || 0) * 100)}%)`)
    .join(", ");
  const aspects = OVERVIEW_ASPECTS.map((a) => `${a.id} (${a.title}): ${a.ask}`).join("\n");
  const schemes = HARMONY_SCHEMES.map((s) => `${s.id} (${s.label}): ${s.geometry}`).join("\n");
  const userText = [
    `Artwork medium: ${medium || "not stated"}.`,
    `Artist intent: ${intent && intent.trim() ? intent.trim() : "not stated"}.`,
    `Artwork format: ${formatNote || "measured from photo corners"}.`,
    `Palette sampled from the artwork photo${wbNote ? ` (${wbNote})` : ""}: ${paletteLines || "none"}.`,
    "Do not report measured coverage in prose; the report shows the palette with its shares beside your words.",
    `Attached image 1 is the rectified artwork. Attached image 2 shows it with the "${guide ? guide.name : "Rule of Thirds"}" overlay. ` +
    "Mark coordinates are 0-1 fractions of image 1, origin top-left.",
    "Give one comprehensive first read of the whole artwork, with each aspect reading exactly one sentence of at most 25 words, covering these aspects:",
    aspects,
    "Allowed guides: reply only with zero, one, or two guide objects; each id must be 'thirds' or 'phi-grid'. Anything else is dropped.",
    "Harmony schemes you may recommend, anchored on one sampled hex exactly as written:",
    schemes,
    loadColorDigest(),
    "Respond with JSON only: headline (one plain sentence of at most 12 words naming what the work is doing), " +
    "summary (2-3 sentences), aspects (exactly four objects with id, an exact aspect id above, and reading, " +
    "1-2 sentences), strengths (1-3 short strings), observations (at most 3 strings, most important first), " +
    "nextSteps (0-3 optional strings, each one plain action under 15 words, never a question), marks (0-6 objects with kind, one of mass, heavy, light, shift, focal, accent; " +
    "x, y; optional x2, y2 for shift arrows; label, a 2-5 word tag; reason, one short sentence), " +
    "guides (0-2 objects with id, an exact catalog id, and reason), palette (object with scheme, anchorHex, reason, or null), " +
    "uncertainty (one string)."
  ].join("\n\n");
  return { system: OVERVIEW_SYSTEM, userText };
}

const OVERVIEW_SCHEMA = {
  name: "artwork_overview",
  schema: {
    type: "object",
    properties: {
      headline: { type: "string" },
      summary: { type: "string" },
      aspects: {
        type: "array",
        maxItems: 4,
        items: {
          type: "object",
          properties: {
            id: { type: "string", enum: OVERVIEW_ASPECTS.map((a) => a.id) },
            reading: { type: "string" }
          },
          required: ["id", "reading"],
          additionalProperties: false
        }
      },
      strengths: { type: "array", items: { type: "string" }, maxItems: 3 },
      observations: { type: "array", items: { type: "string" }, maxItems: 3 },
      nextSteps: { type: "array", items: { type: "string" }, maxItems: 3 },
      marks: ANNOTATE_SCHEMA.schema.properties.annotations,
      guides: {
        type: "array",
        maxItems: 2,
        items: {
          type: "object",
          properties: { id: { type: "string" }, reason: { type: "string" } },
          required: ["id", "reason"],
          additionalProperties: false
        }
      },
      palette: {
        type: ["object", "null"],
        properties: {
          scheme: { type: "string", enum: HARMONY_SCHEMES.map((s) => s.id) },
          anchorHex: { type: "string" },
          reason: { type: "string" }
        },
        required: ["scheme", "anchorHex", "reason"],
        additionalProperties: false
      },
      uncertainty: { type: "string" }
    },
    required: ["headline", "summary", "aspects", "strengths", "observations", "uncertainty"],
    additionalProperties: false
  }
};

// Safety net for overview prose: the prompt forbids hex codes,
// percentages, and question-shaped next steps, but a stray violation
// must never reach the spoken report. Parentheticals carrying codes
// drop whole ("cream (#f3e6ce, 56%)" -> "cream"); a bare hex becomes
// "that color"; a bare percentage drops (its number adds no meaning
// once the palette shows shares beside the words).
function cleanOverviewProse(text) {
  if (typeof text !== "string") return text;
  let out = text.replace(/\([^()]*(?:#[0-9a-fA-F]{3,6}|\d+(?:\.\d+)?\s*(?:%|percent))[^()]*\)/gi, "");
  out = out.replace(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g, "that color");
  out = out.replace(/\s*\b\d+(?:\.\d+)?\s*(?:%|percent\b)/gi, "");
  out = out.replace(/\s{2,}/g, " ").replace(/\s+([,.;:?!])/g, "$1").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")");
  return out.trim();
}

// "Tell me whether X" -> "Consider whether X."; "You might ..." drops
// the hedge, keeping the verb ("Share X."); a trailing question
// becomes a plain "Test: ..." action.
function plainNextStep(step) {
  let out = step.trim();
  let m = out.match(/^tell me\s+/i);
  if (m) out = "Consider " + out.slice(m[0].length).trim();
  m = out.match(/^you might\s+/i);
  if (m) {
    out = out.slice(m[0].length).trim();
    out = out.charAt(0).toUpperCase() + out.slice(1);
  }
  if (/\?\s*$/.test(out)) {
    out = out.replace(/\?\s*$/, "").trim();
    if (/^(what|which|how)\b/i.test(out)) out = "Test: " + out.charAt(0).toLowerCase() + out.slice(1);
    if (!/[.!]$/.test(out)) out += ".";
  }
  return out;
}

function cleanOverviewMark(mark) {
  const cleaned = Object.assign({}, mark);
  ["x", "x2", "y", "y2"].forEach((k) => {
    if (typeof cleaned[k] === "number") cleaned[k] = clampUnit(cleaned[k]);
  });
  if (typeof cleaned.label === "string") {
    cleaned.label = cleanOverviewProse(cleaned.label).split(/\s+/).filter(Boolean).slice(0, 5).join(" ");
  }
  if (typeof cleaned.reason === "string") cleaned.reason = cleanOverviewProse(cleaned.reason);
  return cleaned;
}

function parseOverviewContent(text, palette) {
  const parsed = jsonFromText(text);
  function strings(value, max) {
    if (!Array.isArray(value)) return [];
    return value.filter((v) => typeof v === "string" && v.trim()).map((v) => cleanOverviewProse(v.trim()).slice(0, 400)).slice(0, max);
  }
  function sentence(value, max, fallback) {
    if (typeof value !== "string" || !value.trim()) return fallback;
    const cleaned = cleanOverviewProse(value.trim());
    return cleaned ? cleaned.slice(0, max) : fallback;
  }
  const given = Array.isArray(parsed.aspects) ? parsed.aspects : [];
  const aspects = OVERVIEW_ASPECTS.map((a) => {
    const match = given.find((g) => g && g.id === a.id);
    return { id: a.id, title: a.title, reading: sentence(match && match.reading, 400, "Not stated by the model.") };
  });
  return {
    headline: sentence(parsed.headline, 120, "A first read of your artwork."),
    summary: sentence(parsed.summary, 700, "No summary stated."),
    aspects,
    strengths: strings(parsed.strengths, 3),
    observations: strings(parsed.observations, 3),
    nextSteps: strings(parsed.nextSteps, 3).map(plainNextStep),
    marks: sanitizeAnnotations(parsed.marks).map(cleanOverviewMark),
    guides: validateGuides(parsed.guides),
    palette: resolvePalettePick(parsed.palette, palette, 300),
    uncertainty: sentence(parsed.uncertainty, 400, "Not stated by the model.")
  };
}

module.exports = {
  OVERVIEW_ASPECTS,
  OVERVIEW_SYSTEM,
  OVERVIEW_SCHEMA,
  buildOverviewPrompt,
  parseOverviewContent,
  sanitizeAnnotations,
  resolvePalettePick,
  SYSTEM_PROMPT,
  CRITIQUE_SCHEMA,
  GUIDE_CATALOG,
  SUGGEST_SYSTEM,
  GUIDE_SUGGEST_SCHEMA,
  HARMONY_SCHEMES,
  DIRECTION_SYSTEM,
  DIRECTION_SCHEMA,
  CHAT_SYSTEM,
  CHAT_HISTORY_MAX,
  CHAT_MESSAGE_MAX,
  ANNOTATE_KINDS,
  ANNOTATE_SYSTEM,
  ANNOTATE_SCHEMA,
  IMAGE_MODEL,
  buildPrompt,
  buildRequest,
  buildSuggestPrompt,
  buildDirectionPrompt,
  buildChatPrompt,
  buildAnnotatePrompt,
  sanitizeHistory,
  sanitizeDirection,
  directionPaletteColors,
  extractContent,
  finishReason,
  parseContent,
  parseSuggestContent,
  parseDirectionContent,
  parseAnnotateContent,
  buildGeneratePrompt,
  buildImageEditRequest,
  parseImageResult
};
