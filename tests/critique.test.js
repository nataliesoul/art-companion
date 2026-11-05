// Critique builder tests. Runs with plain Node, no packages:
//   node tests/critique.test.js
const assert = require("assert");
const critique = require("../lib/critique.js");

const prompt = critique.buildPrompt({
  intent: "A calm harbor at dusk",
  medium: "Oil",
  topic: "Color",
  guide: { id: "thirds", name: "Rule of Thirds" },
  palette: [{ hex: "#a34a24", coverage: 0.3 }, { hex: "#1f3a5f", coverage: 0.2 }],
  formatNote: "Using A4 portrait (0.707)",
  wbNote: "gray world gains R1.02 G1.00 B0.95"
});
assert.ok(prompt.system.length > 100, "system prompt present");
assert.ok(prompt.userText.includes("calm harbor"), "intent included");
assert.ok(prompt.userText.includes("Oil"), "medium included");
assert.ok(prompt.userText.includes("#a34a24 (30%)"), "palette included");
assert.ok(prompt.userText.includes("Golden Spiral"), "guide catalog included");
assert.ok(prompt.userText.includes("at most 3"), "observation cap instructed");

const body = critique.buildRequest({
  model: "muse-spark-1.3",
  system: prompt.system,
  userText: prompt.userText,
  images: ["data:image/jpeg;base64,AAA", "data:image/jpeg;base64,BBB"],
  schema: critique.CRITIQUE_SCHEMA
});
assert.strictEqual(body.model, "muse-spark-1.3");
assert.strictEqual(body.messages.length, 2);
assert.strictEqual(body.messages[1].content.length, 3);
assert.strictEqual(body.messages[1].content[1].type, "image_url");
assert.strictEqual(body.response_format.json_schema.name, "artwork_critique");

const parsed = critique.parseContent(JSON.stringify({
  strengths: ["Strong diagonal pull", "Restrained palette"],
  observations: ["One", "Two", "Three", "Four", "Five"],
  nextSteps: ["Try a thumbnail variant"],
  uncertainty: "Photo lighting unclear."
}));
assert.deepStrictEqual(parsed.strengths.length, 2);
assert.deepStrictEqual(parsed.observations, ["One", "Two", "Three"]);
assert.deepStrictEqual(parsed.nextSteps, ["Try a thumbnail variant"]);

const fenced = critique.parseContent("```json\n" + JSON.stringify({
  strengths: [], observations: ["Solo"], uncertainty: "Ok."
}) + "\n```");
assert.deepStrictEqual(fenced.observations, ["Solo"]);

const sparse = critique.parseContent("{}");
assert.deepStrictEqual(sparse.strengths, []);
assert.strictEqual(sparse.uncertainty, "Not stated by the model.");

assert.throws(() => critique.parseContent("not json at all"), /not valid JSON/);

const content = critique.extractContent({
  choices: [{ message: { content: "{\"a\":1}" } }]
});
assert.strictEqual(content, "{\"a\":1}");
assert.throws(() => critique.extractContent({ choices: [] }), /no readable content/);
// Providers may return content parts instead of a plain string.
assert.strictEqual(
  critique.extractContent({ choices: [{ message: { content: [{ type: "text", text: "a" }, { type: "text", text: "b" }] } }] }),
  "ab"
);
assert.strictEqual(
  critique.extractContent({ choices: [{ message: { content: { text: "z" } } }] }),
  "z"
);
assert.throws(
  () => critique.extractContent({ choices: [{ message: { content: [] } }] }),
  /no readable content/
);
assert.strictEqual(critique.finishReason({ choices: [{ finish_reason: "length" }] }), "length");
assert.strictEqual(critique.finishReason({}), null);

// Guide suggestion prompt names exact catalog ids.
const suggest = critique.buildSuggestPrompt({
  palette: [{ hex: "#a34a24", coverage: 0.3 }]
});
assert.ok(suggest.userText.includes("thirds (Rule of Thirds)"), "catalog ids present");
assert.ok(suggest.userText.includes("#a34a24 (30%)"), "palette present");

const suggestBody = critique.buildRequest({
  model: "muse-spark-1.3",
  system: suggest.system,
  userText: suggest.userText,
  images: ["data:image/jpeg;base64,AAA"],
  schema: critique.GUIDE_SUGGEST_SCHEMA,
  maxTokens: 2000
});
assert.strictEqual(suggestBody.response_format.json_schema.name, "guide_suggestion");
assert.strictEqual(suggestBody.max_tokens, 2000);
assert.strictEqual(suggestBody.messages[1].content.length, 2);

// Unknown guide ids are dropped, not trusted.
const picked = critique.parseSuggestContent(JSON.stringify({
  suggestedGuides: [
    { id: "dynamic-symmetry", reason: "Strong diagonals." },
    { id: "not-a-guide", reason: "Hallucinated." },
    { id: "rings", reason: "Third, over the limit." }
  ]
}));
assert.deepStrictEqual(picked, [
  { id: "dynamic-symmetry", name: "Dynamic Symmetry", reason: "Strong diagonals." },
  { id: "rings", name: "Concentric Rings", reason: "Third, over the limit." }
]);
assert.deepStrictEqual(critique.parseSuggestContent("{}"), []);
assert.throws(() => critique.parseSuggestContent("nope"), /not valid JSON/);

// Art direction prompt carries palette, intent, medium, and both catalogs.
const direction = critique.buildDirectionPrompt({
  palette: [{ hex: "#a34a24", coverage: 0.3 }, { hex: "#1f3a5f", coverage: 0.2 }],
  intent: "A calm harbor at dusk",
  medium: "Oil"
});
assert.ok(direction.system.length > 50, "direction system present");
assert.ok(direction.userText.includes("#a34a24 (30%)"), "direction palette included");
assert.ok(direction.userText.includes("calm harbor"), "direction intent included");
assert.ok(direction.userText.includes("thirds (Rule of Thirds)"), "direction guide catalog present");
assert.ok(direction.userText.includes("triadic"), "direction scheme catalog present");

const directionBody = critique.buildRequest({
  model: "muse-spark-1.3",
  system: direction.system,
  userText: direction.userText,
  images: ["data:image/jpeg;base64,AAA"],
  schema: critique.DIRECTION_SCHEMA,
  maxTokens: 3000
});
assert.strictEqual(directionBody.response_format.json_schema.name, "art_direction");
assert.strictEqual(directionBody.max_tokens, 3000);

// Scheme colors are the anchor plus exact harmony rotations.
const triadic = critique.directionPaletteColors("triadic", "#a34a24");
assert.strictEqual(triadic.length, 3, "anchor plus two rotations");
assert.strictEqual(triadic[0], "#a34a24");
assert.ok(triadic.every((h) => /^#[0-9a-f]{6}$/.test(h)), "valid hex colors");
assert.strictEqual(critique.directionPaletteColors("nope", "#a34a24"), null);
assert.strictEqual(critique.directionPaletteColors("triadic", "red"), null);

// Full direction parse: guides validated, anchor grounded, reasons kept.
const sampled = [
  { hex: "#a34a24", coverage: 0.3 },
  { hex: "#1f3a5f", coverage: 0.2 }
];
const dir = critique.parseDirectionContent(JSON.stringify({
  guides: [
    { id: "dynamic-symmetry", reason: "Strong diagonals." },
    { id: "not-a-guide", reason: "Hallucinated." }
  ],
  palette: { scheme: "triadic", anchorHex: "#1F3A5f", reason: "Try the triad." },
  summary: "Lean into the diagonal pull.",
  uncertainty: "Photo lighting unclear."
}), sampled);
assert.deepStrictEqual(dir.guides, [
  { id: "dynamic-symmetry", name: "Dynamic Symmetry", reason: "Strong diagonals." }
]);
assert.strictEqual(dir.palette.scheme, "triadic");
assert.strictEqual(dir.palette.anchorHex, "#1f3a5f", "anchor matched case-insensitively");
assert.strictEqual(dir.palette.colors.length, 3);
assert.strictEqual(dir.summary, "Lean into the diagonal pull.");
assert.strictEqual(dir.uncertainty, "Photo lighting unclear.");

// Anchor outside the sampled palette falls back to the dominant color.
const drifted = critique.parseDirectionContent(JSON.stringify({
  guides: [],
  palette: { scheme: "complementary", anchorHex: "#00ff00", reason: "Invented." },
  summary: "S",
  uncertainty: "U"
}), sampled);
assert.strictEqual(drifted.palette.anchorHex, "#a34a24");

// Bad scheme or empty palette drops the palette pick instead of inventing.
const badScheme = critique.parseDirectionContent(JSON.stringify({
  guides: [],
  palette: { scheme: "rainbow", anchorHex: "#a34a24", reason: "x" },
  summary: "S",
  uncertainty: "U"
}), sampled);
assert.strictEqual(badScheme.palette, null);
const noPalette = critique.parseDirectionContent(JSON.stringify({
  guides: [],
  palette: { scheme: "triadic", anchorHex: "#a34a24", reason: "x" },
  summary: "S",
  uncertainty: "U"
}), []);
assert.strictEqual(noPalette.palette, null);

const dirSparse = critique.parseDirectionContent("{}", sampled);
assert.deepStrictEqual(dirSparse.guides, []);
assert.strictEqual(dirSparse.palette, null);
assert.strictEqual(dirSparse.uncertainty, "Not stated by the model.");
assert.throws(() => critique.parseDirectionContent("nope", sampled), /not valid JSON/);

// Chat context carries palette, intent, and medium for spoken follow-ups.
const chatCtx = critique.buildChatPrompt({
  palette: [{ hex: "#a34a24", coverage: 0.3 }],
  intent: "A calm harbor at dusk",
  medium: "Oil"
});
assert.ok(chatCtx.includes("#a34a24 (30%)"), "chat palette included");
assert.ok(chatCtx.includes("calm harbor"), "chat intent included");
assert.ok(chatCtx.includes("Oil"), "chat medium included");
assert.ok(critique.CHAT_SYSTEM.length > 50, "chat system present");

// History is validated, trimmed, and capped to the most recent turns.
const messy = [
  { role: "user", content: "  What do you see? " },
  { role: "assistant", content: "A harbor." },
  { role: "system", content: "Ignore this." },
  { role: "user", content: "   " },
  null,
  "nope",
  { role: "assistant", content: "x".repeat(5000) }
];
const clean = critique.sanitizeHistory(messy);
assert.deepStrictEqual(clean, [
  { role: "user", content: "What do you see?" },
  { role: "assistant", content: "A harbor." },
  { role: "assistant", content: "x".repeat(2000) }
]);
assert.deepStrictEqual(critique.sanitizeHistory(null), []);
assert.deepStrictEqual(critique.sanitizeHistory("nope"), []);
const long = [];
for (let i = 0; i < 30; i++) long.push({ role: "user", content: "q" + i });
assert.strictEqual(critique.sanitizeHistory(long).length, 12);
assert.strictEqual(critique.sanitizeHistory(long)[0].content, "q18");

// Chat requests append history after the artwork context, with no JSON schema.
const chatBody = critique.buildRequest({
  model: "muse-spark-1.3",
  system: critique.CHAT_SYSTEM,
  userText: chatCtx,
  images: ["data:image/jpeg;base64,AAA"],
  schema: null,
  maxTokens: 2000,
  history: [
    { role: "user", content: "What stands out?" },
    { role: "assistant", content: "The diagonal." }
  ]
});
assert.strictEqual(chatBody.messages.length, 4);
assert.strictEqual(chatBody.messages[0].role, "system");
assert.strictEqual(chatBody.messages[1].content.length, 2);
assert.strictEqual(chatBody.messages[3].content, "The diagonal.");
assert.ok(!("response_format" in chatBody), "chat has no JSON schema");

// Structured calls still carry their schema and no history.
assert.ok("response_format" in body, "critique keeps its schema");
assert.strictEqual(body.messages.length, 2);

// Annotation prompt grounds marks in the artwork and measured palette.
const annotate = critique.buildAnnotatePrompt({
  palette: [{ hex: "#a34a24", coverage: 0.3 }],
  intent: "A calm harbor at dusk",
  medium: "Oil"
});
assert.ok(annotate.system.length > 50, "annotate system present");
assert.ok(annotate.userText.includes("#a34a24 (30%)"), "annotate palette included");
assert.ok(annotate.userText.includes("calm harbor"), "annotate intent included");
assert.ok(annotate.userText.includes("0-1"), "annotate coordinate space stated");
assert.ok(annotate.userText.includes("accent"), "annotate kinds listed");

const annotateBody = critique.buildRequest({
  model: "muse-spark-1.3",
  system: annotate.system,
  userText: annotate.userText,
  images: ["data:image/jpeg;base64,AAA"],
  schema: critique.ANNOTATE_SCHEMA,
  maxTokens: 2000
});
assert.strictEqual(annotateBody.response_format.json_schema.name, "art_annotations");

// Parse validates kinds, clamps coordinates, caps text, keeps order.
const marks = critique.parseAnnotateContent(JSON.stringify({
  annotations: [
    { kind: "focal", x: 0.6, y: 0.4, label: "Eye lands here", reason: "Brightest contrast." },
    { kind: "shift", x: 0.2, y: 0.8, x2: 0.4, y2: 0.6, label: "Pull weight", reason: "Left is heavy." },
    { kind: "crop", x: 0.1, y: 0.1, label: "Nope", reason: "Unknown kind." },
    { kind: "accent", x: 1.5, y: -0.2, label: "Accent?", reason: "Off-canvas anchor." },
    { kind: "mass", x: "left", y: 0.5, label: "Bad", reason: "Non-numeric." }
  ],
  summary: "Small moves, big balance."
}));
assert.strictEqual(marks.annotations.length, 3);
assert.deepStrictEqual(marks.annotations[0], {
  kind: "focal", x: 0.6, y: 0.4, x2: null, y2: null,
  label: "Eye lands here", reason: "Brightest contrast."
});
assert.strictEqual(marks.annotations[1].x2, 0.4);
assert.strictEqual(marks.annotations[2].x, 1, "x clamped");
assert.strictEqual(marks.annotations[2].y, 0, "y clamped");
assert.strictEqual(marks.summary, "Small moves, big balance.");

// Long text is capped; sparse and invalid payloads stay safe.
const capped = critique.parseAnnotateContent(JSON.stringify({
  annotations: [{ kind: "heavy", x: 0.5, y: 0.5, label: "L".repeat(200), reason: "R".repeat(500) }],
  summary: "S".repeat(900)
}));
assert.strictEqual(capped.annotations[0].label.length, 80);
assert.strictEqual(capped.annotations[0].reason.length, 200);
assert.strictEqual(capped.summary.length, 600);
const sparseMarks = critique.parseAnnotateContent("{}");
assert.deepStrictEqual(sparseMarks.annotations, []);
assert.strictEqual(sparseMarks.summary, "No summary stated.");
assert.throws(() => critique.parseAnnotateContent("nope"), /not valid JSON/);

// Direction echoes are untrusted: unknown guide ids drop, bad hexes drop,
// text trims. Anchor falls back to the first clean color.
const dirtyDirection = critique.sanitizeDirection({
  guides: [
    { id: "thirds", name: "Rule of Thirds", reason: "  Strong grid  " },
    { id: "nope", name: "Bogus", reason: "x" }
  ],
  palette: {
    scheme: "triadic",
    schemeLabel: "Triadic",
    anchorHex: "#ZZZZZZ",
    colors: ["#a34a24", "not-a-color", "#1f3a5f"],
    reason: "  Warm anchor  "
  },
  summary: "  Grounded summary.  "
});
assert.deepStrictEqual(dirtyDirection.guides.map((g) => g.id), ["thirds"]);
assert.strictEqual(dirtyDirection.guides[0].reason, "Strong grid");
assert.deepStrictEqual(dirtyDirection.palette.colors, ["#a34a24", "#1f3a5f"]);
assert.strictEqual(dirtyDirection.palette.anchorHex, "#a34a24");
assert.strictEqual(dirtyDirection.palette.schemeLabel, "Triadic");
assert.strictEqual(dirtyDirection.summary, "Grounded summary.");
const emptyDirection = critique.sanitizeDirection(null);
assert.deepStrictEqual(emptyDirection.guides, []);
assert.strictEqual(emptyDirection.palette, null);
const noColorDirection = critique.sanitizeDirection({ palette: { colors: ["junk"] } });
assert.strictEqual(noColorDirection.palette, null);

// Generation prompt grounds the repaint in the measured direction.
const genPrompt = critique.buildGeneratePrompt({
  intent: "A calm harbor at dusk",
  medium: "Oil",
  palette: [{ hex: "#a34a24", coverage: 0.3 }, { hex: "junk", coverage: 0.2 }],
  direction: {
    guides: [{ id: "thirds", name: "Rule of Thirds", reason: "Horizon placement" }],
    palette: {
      scheme: "triadic",
      schemeLabel: "Triadic",
      anchorHex: "#a34a24",
      colors: ["#a34a24", "#1f3a5f"],
      reason: "Warm anchor"
    },
    summary: "Lean into warm darks."
  }
});
assert.ok(genPrompt.includes("calm harbor"), "intent included");
assert.ok(genPrompt.includes("Oil"), "medium included");
assert.ok(genPrompt.includes("#a34a24 (30%)"), "sampled palette included");
assert.ok(!genPrompt.includes("junk"), "bad hex excluded");
assert.ok(genPrompt.includes("Rule of Thirds"), "guide name included");
assert.ok(genPrompt.includes("Triadic"), "scheme included");
assert.ok(genPrompt.includes("Lean into warm darks"), "direction summary included");
assert.ok(genPrompt.includes("edge to edge"), "full-bleed artwork instructed");
const barePrompt = critique.buildGeneratePrompt({ intent: "", medium: "", palette: [], direction: null });
assert.ok(barePrompt.includes("Repaint"), "degrades without direction");

// Image edit request shape: single study, clamped aspect, base64 PNG.
const editBody = critique.buildImageEditRequest({
  model: "muse-image-1.0",
  prompt: "repaint",
  image: "data:image/jpeg;base64,AAA",
  width: 1024,
  height: 768
});
assert.strictEqual(editBody.model, "muse-image-1.0");
assert.strictEqual(editBody.prompt, "repaint");
assert.deepStrictEqual(editBody.images, [{ image_url: "data:image/jpeg;base64,AAA" }]);
assert.strictEqual(editBody.n, 1);
assert.strictEqual(editBody.size, "1024x768");
assert.strictEqual(editBody.response_format, "b64_json");
assert.strictEqual(editBody.output_format, "png");
assert.strictEqual(
  critique.buildImageEditRequest({ prompt: "p", image: "i", width: 0, height: 99999 }).size,
  "64x2048"
);
assert.strictEqual(
  critique.buildImageEditRequest({ prompt: "p", image: "i", width: "w", height: null }).size,
  "1024x1024"
);

// Image result parsing: base64 wins, mime follows the echo, https URLs
// pass through, anything else throws.
const fakeB64 = "iVBORw0KGgo".repeat(20);
const parsedPng = critique.parseImageResult({
  created: 1,
  output_format: "png",
  data: [{ b64_json: fakeB64, revised_prompt: "  Repainted study.  " }]
});
assert.ok(parsedPng.image.startsWith("data:image/png;base64,iVBOR"), "png data URL");
assert.strictEqual(parsedPng.revisedPrompt, "Repainted study.");
const parsedWebp = critique.parseImageResult({
  created: 1,
  output_format: "webp",
  data: [{ b64_json: " " + fakeB64 + "\n" }]
});
assert.ok(parsedWebp.image.startsWith("data:image/webp;base64,"), "webp mime honored");
assert.strictEqual(parsedWebp.revisedPrompt, null);
const parsedUrl = critique.parseImageResult({
  created: 1,
  data: [{ url: "https://cdn.example/x.png" }]
});
assert.strictEqual(parsedUrl.image, "https://cdn.example/x.png");
assert.throws(() => critique.parseImageResult({ created: 1, data: [] }), /no image/);
assert.throws(() => critique.parseImageResult({ created: 1, data: [{ url: "http://x/y.png" }] }), /no image/);
assert.throws(() => critique.parseImageResult({ created: 1, data: [{ b64_json: "short" }] }), /no image/);
assert.throws(() => critique.parseImageResult({}), /no image/);

console.log("critique tests passed: prompt, request shape, response parsing, suggestions, art direction, chat, annotations, image generation.");

// Overview: one combined request whose output is sanitized like the parts.
const overviewPrompt = critique.buildOverviewPrompt({
  intent: "Quiet morning light",
  medium: "Gouache",
  guide: { id: "golden", name: "Golden Ratio" },
  palette: [{ hex: "#f3e6ce", coverage: 0.5 }, { hex: "#657d72", coverage: 0.2 }],
  formatNote: "Using A4 portrait (0.707)",
  wbNote: ""
});
assert.ok(overviewPrompt.system.includes("plain prose"), "overview system prompt asks for prose");
assert.ok(overviewPrompt.system.includes("Never quote hex codes"), "overview keeps hex codes out of prose");
const longReason = critique.parseOverviewContent(JSON.stringify({
  palette: { scheme: "triadic", anchorHex: "#f3e6ce", reason: "r".repeat(400) }
}), [{ hex: "#f3e6ce", coverage: 0.5 }]);
assert.strictEqual(longReason.palette.reason.length, 300, "overview palette reason keeps a whole sentence's worth");
assert.ok(overviewPrompt.userText.includes("Quiet morning light"), "overview intent included");
assert.ok(overviewPrompt.userText.includes("Golden Ratio"), "overview names the overlay guide");
assert.ok(overviewPrompt.userText.includes("balance (Balance & emphasis)"), "overview lists aspects");
assert.ok(overviewPrompt.userText.includes("split (Split complementary)"), "overview lists schemes");
assert.strictEqual(critique.OVERVIEW_SCHEMA.schema.properties.aspects.maxItems, 4);

const overview = critique.parseOverviewContent(JSON.stringify({
  headline: "A calm still life held by its warm ground.",
  summary: "The vase anchors the center. The fruit pulls the eye right.",
  aspects: [
    { id: "values", reading: "Mid-range values with the darkest note in the vase." },
    { id: "bogus", reading: "ignored" },
    { id: "composition", reading: "Centered mass with a quiet right-hand counterweight." }
  ],
  strengths: ["Restrained palette", "", "Clear focal object", "Extra one", "Too many"],
  observations: ["The fruit sits very close to the edge."],
  nextSteps: [],
  marks: [
    { kind: "focal", x: 0.45, y: 0.5, label: "Vase", reason: "Darkest shape, first stop." },
    { kind: "shift", x: 0.8, y: 0.7, x2: 0.7, y2: 0.65, label: "Pull fruit in", reason: "Eases the edge tension." },
    { kind: "nope", x: 0.1, y: 0.1, label: "bad", reason: "dropped" },
    { kind: "accent", x: 2, y: 0.1, label: "off canvas", reason: "dropped" }
  ],
  guides: [{ id: "phi-grid", reason: "Divisions land on the vase edge." }, { id: "unknown", reason: "x" }],
  palette: { scheme: "analogous", anchorHex: "#657D72", reason: "Keeps the quiet mood." },
  uncertainty: "Photo looks slightly warm."
}), [{ hex: "#f3e6ce", coverage: 0.5 }, { hex: "#657d72", coverage: 0.2 }]);
assert.strictEqual(overview.headline, "A calm still life held by its warm ground.");
assert.strictEqual(overview.aspects.length, 4, "always four aspects in catalog order");
assert.deepStrictEqual(overview.aspects.map((a) => a.id), ["composition", "values", "color", "balance"]);
assert.strictEqual(overview.aspects[0].reading, "Centered mass with a quiet right-hand counterweight.");
assert.strictEqual(overview.aspects[2].reading, "Not stated by the model.");
assert.deepStrictEqual(overview.strengths, ["Restrained palette", "Clear focal object", "Extra one"]);
assert.strictEqual(overview.marks.length, 3, "invalid kinds dropped, coordinates clamped");
assert.strictEqual(overview.marks[1].x2, 0.7);
assert.strictEqual(overview.marks[2].x, 1, "off-canvas coordinate clamped to the edge");
assert.deepStrictEqual(overview.guides.map((g) => g.id), ["phi-grid"]);
assert.strictEqual(overview.palette.schemeLabel, "Analogous");
assert.strictEqual(overview.palette.anchorHex, "#657d72");
assert.strictEqual(overview.palette.colors.length, 3);
assert.strictEqual(overview.uncertainty, "Photo looks slightly warm.");

const sparseOverview = critique.parseOverviewContent("{}", []);
assert.strictEqual(sparseOverview.headline, "A first read of your artwork.");
assert.strictEqual(sparseOverview.palette, null);
assert.deepStrictEqual(sparseOverview.marks, []);
assert.throws(() => critique.parseOverviewContent("nope", []), /not valid JSON/);

// Prompt carries the prose rules: no coverage in text, one short aspect
// sentence, a two-guide shortlist, plain-action next steps.
const overviewProsePrompt = critique.buildOverviewPrompt({
  guide: { id: "phi-grid", name: "Golden Ratio" },
  palette: [{ hex: "#f3e6ce", coverage: 0.56 }],
  intent: "", medium: "Oil", formatNote: "", wbNote: ""
});
assert.ok(critique.OVERVIEW_SYSTEM.includes("hex codes") && critique.OVERVIEW_SYSTEM.includes("percentages"), "system bans codes");
assert.ok(critique.OVERVIEW_SYSTEM.includes("twenty words"), "system caps sentences");
assert.ok(overviewProsePrompt.userText.includes("Do not report measured coverage"), "coverage rule");
assert.ok(overviewProsePrompt.userText.includes("exactly one sentence of at most 25 words"), "aspect rule");
assert.ok(overviewProsePrompt.userText.includes("'thirds' or 'phi-grid'"), "guide shortlist");
assert.ok(!overviewProsePrompt.userText.includes("GUIDE_CATALOG"), "no catalog dump");
assert.ok(overviewProsePrompt.userText.includes("each one plain action under 15 words, never a question"), "next-step rule");

// Safety net, mirroring the first live reply's problem shapes: hex codes
// and coverage in prose, question-shaped next steps, a dropped guide id,
// an out-of-range mark, an overlong label.
const messyOverview = critique.parseOverviewContent(JSON.stringify({
  headline: "A calm still life of pot sprout and fruit in cream (#f3e6ce, 56%).",
  summary: "The cream covers 56 percent of the surface and holds the pot.",
  aspects: [
    { id: "composition", reading: "Mass left, fruit right, calm and balanced overall here." },
    { id: "values", reading: "Cream ground lightest, pot the mid dark mass anchor." },
    { id: "color", reading: "Mix #b65c46 sparingly into the tan for the fruit." },
    { id: "balance", reading: "Left weight met by warm fruit cluster on right." }
  ],
  strengths: ["Quiet ground"],
  observations: ["The red covers about 12% of the lower right corner."],
  nextSteps: [
    "Tell me whether the shadow links the pot and fruit.",
    "You might share a closer photo of the red fruit edge.",
    "What would happen if you muted the red toward the tan?"
  ],
  marks: [{ kind: "focal", x: 1.4, y: -0.2, label: "red fruit brightest warmest competition here today", reason: "Warmest color at #b65c46 pulls the eye." }],
  guides: [{ id: "rule-of-thirds", reason: "Grid roughly fits." }],
  palette: null,
  uncertainty: "Lighting may shift the cream 5 percent warmer."
}), []);
assert.ok(!/#[0-9a-fA-F]{3,6}/.test(messyOverview.headline), "headline hex stripped");
assert.ok(!/%|percent/i.test(messyOverview.headline), "headline percent stripped");
assert.strictEqual(messyOverview.headline, "A calm still life of pot sprout and fruit in cream.");
assert.ok(!/%|percent/i.test(messyOverview.summary), "summary percent stripped");
assert.ok(messyOverview.aspects[2].reading.includes("that color"), "bare hex becomes words");
assert.ok(!/%|percent/i.test(messyOverview.observations[0]), "observation percent stripped");
assert.deepStrictEqual(messyOverview.nextSteps, [
  "Consider whether the shadow links the pot and fruit.",
  "Share a closer photo of the red fruit edge.",
  "Test: what would happen if you muted the red toward the tan."
]);
assert.strictEqual(messyOverview.marks[0].x, 1, "mark x clamped into the artwork");
assert.strictEqual(messyOverview.marks[0].y, 0, "mark y clamped into the artwork");
assert.strictEqual(messyOverview.marks[0].label.split(" ").length, 5, "label trimmed to five words");
assert.ok(!/#[0-9a-fA-F]{3,6}/.test(messyOverview.marks[0].reason), "mark reason hex stripped");
assert.deepStrictEqual(messyOverview.guides, [], "unknown guide id still dropped");

// Clean replies pass through untouched.
const cleanOverview = critique.parseOverviewContent(JSON.stringify({
  headline: "A quiet still life balances a green pot against warm fruit.",
  summary: "Calm shapes on a cream ground.",
  aspects: [
    { id: "composition", reading: "Pot left of center, fruit low right." },
    { id: "values", reading: "Cream lightest, pot the mid dark." },
    { id: "color", reading: "Warm ground, cool pot, red accent." },
    { id: "balance", reading: "Left mass met by warm cluster." }
  ],
  strengths: ["Quiet ground"],
  observations: ["Red leads the eye."],
  nextSteps: ["Try softening one short section of the shadow edge."],
  marks: [],
  guides: [{ id: "phi-grid", reason: "Divisions follow the placement." }],
  palette: null,
  uncertainty: "Light may shift colors."
}), []);
assert.strictEqual(cleanOverview.summary, "Calm shapes on a cream ground.");
assert.deepStrictEqual(cleanOverview.nextSteps, ["Try softening one short section of the shadow edge."]);
assert.deepStrictEqual(cleanOverview.guides.map((g) => g.id), ["phi-grid"]);

console.log("overview tests passed: prompt, schema, parsing, sanitizing.");
