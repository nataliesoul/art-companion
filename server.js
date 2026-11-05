// Zero-dependency static server for the feasibility prototype.
// Serves public/ on 127.0.0.1:8080 by default.
// Override with HOST / PORT env vars, e.g. HOST=0.0.0.0 PORT=8080 node server.js
// Note: plain HTTP on a LAN address cannot enable the camera/XR secure-context
// APIs on a phone; see TESTING.md for the HTTPS options for iPhone testing.
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const critique = require("./lib/critique");

// Optional .env file (KEY=VALUE lines, # comments). Real environment
// variables always win. .env is git-ignored; never commit secrets.
function loadEnvFile() {
  let text;
  try {
    text = fs.readFileSync(path.join(__dirname, ".env"), "utf8");
  } catch (err) {
    return;
  }
  text.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eq = trimmed.indexOf("=");
    if (eq < 0) return;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !(key in process.env)) process.env[key] = value;
  });
}
loadEnvFile();

const ROOT = path.join(__dirname, "public");
const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 8080);
const MODEL_API_BASE = process.env.MODEL_API_BASE || "https://api.meta.ai/v1";
const MODEL_API_MODEL = process.env.MODEL_API_MODEL || "muse-spark-1.3";
const MODEL_IMAGE_MODEL = process.env.MODEL_IMAGE_MODEL || "muse-image-1.0";
const MAX_BODY_BYTES = 12 * 1024 * 1024;
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  // path.join(ROOT, "/") keeps a trailing separator on Windows, so compare
  // against both spellings of the root before mapping "/" to index.html.
  const resolved = path.normalize(path.join(ROOT, decoded));
  if (resolved !== ROOT && !resolved.startsWith(ROOT + path.sep)) {
    return null;
  }
  if (resolved === ROOT || resolved === ROOT + path.sep) {
    return path.join(ROOT, "index.html");
  }
  return resolved;
}

function sendJson(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("Request body too large."), { code: "too_large" }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (err) {
        reject(Object.assign(new Error("Request body was not valid JSON."), { code: "bad_json" }));
      }
    });
    req.on("error", reject);
  });
}

function isDataImage(value) {
  return typeof value === "string" &&
    value.length <= MAX_IMAGE_BYTES &&
    /^data:image\/(jpeg|png|webp);base64,/.test(value);
}

function shortText(value, max) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function postProviderJson(url, apiKey, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const endpoint = new URL(url);
    if (endpoint.protocol !== "https:") {
      reject(new Error("Model API base URL must use https."));
      return;
    }
    const req = https.request({
      hostname: endpoint.hostname,
      port: endpoint.port || 443,
      path: endpoint.pathname + endpoint.search,
      method: "POST",
      timeout: timeoutMs,
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey,
        "Content-Length": Buffer.byteLength(payload)
      }
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        let json = null;
        try {
          json = JSON.parse(text);
        } catch (err) {
          // Fall through to status handling with raw text.
        }
        resolve({ status: res.statusCode || 0, json, text: text.slice(0, 500) });
      });
    });
    req.on("timeout", () => req.destroy(new Error("Model API timed out.")));
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

// The API key lives only here, read from the environment; it is never
// sent to the browser, never logged, and never echoed in errors.
function requireKey(res) {
  if (!process.env.MODEL_API_KEY) {
    sendJson(res, 501, {
      ok: false,
      code: "not_configured",
      message: "AI features are not configured on this server.",
      setup: [
        "Create a key in the Meta Model API dashboard (see docs/ai-setup.md).",
        "Set it as the MODEL_API_KEY environment variable, or save it in a .env file next to server.js (never in chat or code).",
        "Restart the server and try again."
      ]
    });
    return null;
  }
  return process.env.MODEL_API_KEY;
}

// Maps a provider reply to an HTTP response, or null when usable.
// Provider error text goes to the server console only, never the browser.
function providerError(provider) {
  if (provider.status === 401 || provider.status === 403) {
    return {
      http: 502,
      code: "bad_key",
      message: "The model API rejected the server's key. Check MODEL_API_KEY and restart the server.",
      log: `rejected by provider (http ${provider.status})`
    };
  }
  if (provider.status === 429) {
    return {
      http: 429,
      code: "rate_limited",
      message: "The model API is rate limiting requests. Wait a bit and try again.",
      log: null
    };
  }
  if (provider.status < 200 || provider.status >= 300 || !provider.json) {
    return {
      http: 502,
      code: "provider_error",
      message: "The model API returned an error. Try again later.",
      log: `provider error (http ${provider.status}): ${provider.text || "(empty)"}`
    };
  }
  return null;
}

async function postToProvider(body, timeoutMs, endpointPath) {
  return postProviderJson(
    MODEL_API_BASE.replace(/\/$/, "") + (endpointPath || "/chat/completions"),
    process.env.MODEL_API_KEY,
    body,
    timeoutMs
  );
}

// POST /api/critique.
async function handleCritique(req, res) {
  const started = Date.now();
  let payload;
  try {
    payload = await readJsonBody(req);
  } catch (err) {
    sendJson(res, err.code === "too_large" ? 413 : 400, { ok: false, code: err.code, message: err.message });
    return;
  }
  if (!payload || !isDataImage(payload.image)) {
    sendJson(res, 400, { ok: false, code: "bad_image", message: "A rectified artwork image (data URL) is required." });
    return;
  }
  if (!requireKey(res)) return;
  const images = [payload.image];
  if (payload.overlay) {
    if (!isDataImage(payload.overlay)) {
      sendJson(res, 400, { ok: false, code: "bad_image", message: "The overlay image was not a valid data URL." });
      return;
    }
    images.push(payload.overlay);
  }
  const prompt = critique.buildPrompt({
    intent: shortText(payload.intent, 500),
    medium: shortText(payload.medium, 80),
    topic: shortText(payload.topic, 80),
    guide: payload.guide && typeof payload.guide.name === "string" ? payload.guide : null,
    palette: Array.isArray(payload.palette) ? payload.palette.slice(0, 8) : [],
    formatNote: shortText(payload.formatNote, 160),
    wbNote: shortText(payload.wbNote, 160)
  });
  const providerBody = critique.buildRequest({
    model: MODEL_API_MODEL,
    system: prompt.system,
    userText: prompt.userText,
    images,
    schema: critique.CRITIQUE_SCHEMA
  });
  let provider;
  try {
    provider = await postToProvider(providerBody, 90000);
  } catch (err) {
    console.log(`critique transport error after ${Date.now() - started}ms`);
    sendJson(res, 502, { ok: false, code: "provider_unreachable", message: "Could not reach the model API. Check your connection and try again." });
    return;
  }
  const mapped = providerError(provider);
  if (mapped) {
    if (mapped.log) console.log(`critique ${mapped.log}`);
    sendJson(res, mapped.http, { ok: false, code: mapped.code, message: mapped.message });
    return;
  }
  let feedback;
  try {
    feedback = critique.parseContent(critique.extractContent(provider.json));
  } catch (err) {
    console.log(`critique parse error after ${Date.now() - started}ms:${parseDetail(provider)}`);
    sendJson(res, 502, { ok: false, code: "bad_response", message: "The model response could not be understood. Try again." });
    return;
  }
  console.log(`critique ok topic="${shortText(payload.topic, 40)}" model="${MODEL_API_MODEL}" ms=${Date.now() - started}`);
  sendJson(res, 200, { ok: true, feedback });
}

// POST /api/overview. One request for the automatic first read: aspects,
// strengths, observations, marks, guide and palette picks. Same inputs as
// critique (rectified artwork + guide overlay), one model call.
async function handleOverview(req, res) {
  const started = Date.now();
  let payload;
  try {
    payload = await readJsonBody(req);
  } catch (err) {
    sendJson(res, err.code === "too_large" ? 413 : 400, { ok: false, code: err.code, message: err.message });
    return;
  }
  if (!payload || !isDataImage(payload.image)) {
    sendJson(res, 400, { ok: false, code: "bad_image", message: "A rectified artwork image (data URL) is required." });
    return;
  }
  if (!requireKey(res)) return;
  const images = [payload.image];
  if (payload.overlay) {
    if (!isDataImage(payload.overlay)) {
      sendJson(res, 400, { ok: false, code: "bad_image", message: "The overlay image was not a valid data URL." });
      return;
    }
    images.push(payload.overlay);
  }
  const palette = Array.isArray(payload.palette) ? payload.palette.slice(0, 8) : [];
  const prompt = critique.buildOverviewPrompt({
    intent: shortText(payload.intent, 500),
    medium: shortText(payload.medium, 80),
    guide: payload.guide && typeof payload.guide.name === "string" ? payload.guide : null,
    palette,
    formatNote: shortText(payload.formatNote, 160),
    wbNote: shortText(payload.wbNote, 160)
  });
  const providerBody = critique.buildRequest({
    model: MODEL_API_MODEL,
    system: prompt.system,
    userText: prompt.userText,
    images,
    schema: critique.OVERVIEW_SCHEMA,
    maxTokens: 6000
  });
  let provider;
  try {
    provider = await postToProvider(providerBody, 120000);
  } catch (err) {
    console.log(`overview transport error after ${Date.now() - started}ms`);
    sendJson(res, 502, { ok: false, code: "provider_unreachable", message: "Could not reach the model API. Check your connection and try again." });
    return;
  }
  const mapped = providerError(provider);
  if (mapped) {
    if (mapped.log) console.log(`overview ${mapped.log}`);
    sendJson(res, mapped.http, { ok: false, code: mapped.code, message: mapped.message });
    return;
  }
  let overview;
  try {
    overview = critique.parseOverviewContent(critique.extractContent(provider.json), palette);
  } catch (err) {
    console.log(`overview parse error after ${Date.now() - started}ms:${parseDetail(provider)}`);
    sendJson(res, 502, { ok: false, code: "bad_response", message: "The model response could not be understood. Try again." });
    return;
  }
  console.log(`overview ok model="${MODEL_API_MODEL}" ms=${Date.now() - started} marks=${overview.marks.length} guides=${overview.guides.length}`);
  sendJson(res, 200, { ok: true, overview });
}

// Metadata-only parse diagnostics: shape, never content or credentials.
function parseDetail(provider) {
  try {
    const ch = provider.json && provider.json.choices && provider.json.choices[0];
    const c = ch && ch.message && ch.message.content;
    return ` finish=${ch && ch.finish_reason} contentType=${Array.isArray(c) ? "array" : typeof c} contentLen=${typeof c === "string" ? c.length : 0}`;
  } catch (ignored) {
    return "";
  }
}

// POST /api/suggest-guide. Lightweight companion to critique: the model
// picks up to two guide ids from the real catalog for this artwork.
async function handleSuggest(req, res) {
  const started = Date.now();
  let payload;
  try {
    payload = await readJsonBody(req);
  } catch (err) {
    sendJson(res, err.code === "too_large" ? 413 : 400, { ok: false, code: err.code, message: err.message });
    return;
  }
  if (!payload || !isDataImage(payload.image)) {
    sendJson(res, 400, { ok: false, code: "bad_image", message: "A rectified artwork image (data URL) is required." });
    return;
  }
  if (!requireKey(res)) return;
  const prompt = critique.buildSuggestPrompt({
    palette: Array.isArray(payload.palette) ? payload.palette.slice(0, 8) : []
  });
  const providerBody = critique.buildRequest({
    model: MODEL_API_MODEL,
    system: prompt.system,
    userText: prompt.userText,
    images: [payload.image],
    schema: critique.GUIDE_SUGGEST_SCHEMA,
    maxTokens: 2000
  });
  let provider;
  try {
    provider = await postToProvider(providerBody, 90000);
  } catch (err) {
    console.log(`suggest transport error after ${Date.now() - started}ms`);
    sendJson(res, 502, { ok: false, code: "provider_unreachable", message: "Could not reach the model API. Check your connection and try again." });
    return;
  }
  const mapped = providerError(provider);
  if (mapped) {
    if (mapped.log) console.log(`suggest ${mapped.log}`);
    sendJson(res, mapped.http, { ok: false, code: mapped.code, message: mapped.message });
    return;
  }
  let suggestions;
  try {
    suggestions = critique.parseSuggestContent(critique.extractContent(provider.json));
  } catch (err) {
    console.log(`suggest parse error after ${Date.now() - started}ms:${parseDetail(provider)}`);
    sendJson(res, 502, { ok: false, code: "bad_response", message: "The model response could not be understood. Try again." });
    return;
  }
  console.log(`suggest ok model="${MODEL_API_MODEL}" ms=${Date.now() - started} picks=${suggestions.length}`);
  sendJson(res, 200, { ok: true, suggestions });
}

// POST /api/art-direction. One call returning guide picks, a grounded
// palette pick, and the model's reasons for both.
async function handleDirection(req, res) {
  const started = Date.now();
  let payload;
  try {
    payload = await readJsonBody(req);
  } catch (err) {
    sendJson(res, err.code === "too_large" ? 413 : 400, { ok: false, code: err.code, message: err.message });
    return;
  }
  if (!payload || !isDataImage(payload.image)) {
    sendJson(res, 400, { ok: false, code: "bad_image", message: "A rectified artwork image (data URL) is required." });
    return;
  }
  if (!requireKey(res)) return;
  const sampled = Array.isArray(payload.palette) ? payload.palette.slice(0, 8) : [];
  const prompt = critique.buildDirectionPrompt({
    intent: shortText(payload.intent, 500),
    medium: shortText(payload.medium, 80),
    palette: sampled
  });
  const providerBody = critique.buildRequest({
    model: MODEL_API_MODEL,
    system: prompt.system,
    userText: prompt.userText,
    images: [payload.image],
    schema: critique.DIRECTION_SCHEMA,
    // Guides plus palette plus summary; same truncation risk as annotations.
    maxTokens: 6000
  });
  let provider;
  try {
    provider = await postToProvider(providerBody, 90000);
  } catch (err) {
    console.log(`direction transport error after ${Date.now() - started}ms`);
    sendJson(res, 502, { ok: false, code: "provider_unreachable", message: "Could not reach the model API. Check your connection and try again." });
    return;
  }
  const mapped = providerError(provider);
  if (mapped) {
    if (mapped.log) console.log(`direction ${mapped.log}`);
    sendJson(res, mapped.http, { ok: false, code: mapped.code, message: mapped.message });
    return;
  }
  let direction;
  try {
    direction = critique.parseDirectionContent(critique.extractContent(provider.json), sampled);
  } catch (err) {
    console.log(`direction parse error after ${Date.now() - started}ms:${parseDetail(provider)}`);
    sendJson(res, 502, { ok: false, code: "bad_response", message: "The model response could not be understood. Try again." });
    return;
  }
  console.log(`direction ok model="${MODEL_API_MODEL}" ms=${Date.now() - started} guides=${direction.guides.length} palette=${direction.palette ? direction.palette.scheme : "none"}`);
  sendJson(res, 200, { ok: true, direction });
}

// POST /api/art-chat. One free-text conversation turn about the artwork:
// the rectified image plus recent history go out, a speakable reply comes
// back. History is capped and sanitized; nothing is stored server-side.
async function handleArtChat(req, res) {
  const started = Date.now();
  let payload;
  try {
    payload = await readJsonBody(req);
  } catch (err) {
    sendJson(res, err.code === "too_large" ? 413 : 400, { ok: false, code: err.code, message: err.message });
    return;
  }
  if (!payload || !isDataImage(payload.image)) {
    sendJson(res, 400, { ok: false, code: "bad_image", message: "A rectified artwork image (data URL) is required." });
    return;
  }
  if (!requireKey(res)) return;
  const history = critique.sanitizeHistory(payload.history);
  if (!history.length || history[history.length - 1].role !== "user") {
    sendJson(res, 400, { ok: false, code: "bad_history", message: "A conversation turn needs your latest message." });
    return;
  }
  const sampled = Array.isArray(payload.palette) ? payload.palette.slice(0, 8) : [];
  const providerBody = critique.buildRequest({
    model: MODEL_API_MODEL,
    system: critique.CHAT_SYSTEM,
    userText: critique.buildChatPrompt({
      intent: shortText(payload.intent, 500),
      medium: shortText(payload.medium, 80),
      palette: sampled
    }),
    images: [payload.image],
    schema: null,
    maxTokens: 2000,
    history
  });
  let provider;
  try {
    provider = await postToProvider(providerBody, 90000);
  } catch (err) {
    console.log(`chat transport error after ${Date.now() - started}ms`);
    sendJson(res, 502, { ok: false, code: "provider_unreachable", message: "Could not reach the model API. Check your connection and try again." });
    return;
  }
  const mapped = providerError(provider);
  if (mapped) {
    if (mapped.log) console.log(`chat ${mapped.log}`);
    sendJson(res, mapped.http, { ok: false, code: mapped.code, message: mapped.message });
    return;
  }
  let reply;
  try {
    reply = critique.extractContent(provider.json).trim().slice(0, 2000);
  } catch (err) {
    console.log(`chat parse error after ${Date.now() - started}ms:${parseDetail(provider)}`);
    sendJson(res, 502, { ok: false, code: "bad_response", message: "The model response could not be understood. Try again." });
    return;
  }
  if (!reply) {
    sendJson(res, 502, { ok: false, code: "bad_response", message: "The model returned an empty reply. Try again." });
    return;
  }
  console.log(`chat ok model="${MODEL_API_MODEL}" ms=${Date.now() - started} turns=${history.length}`);
  sendJson(res, 200, { ok: true, reply });
}

// POST /api/suggest-annotations. Positioned suggestion marks (balance,
// focal, accent) for the rectified artwork, drawn by the p5 overlay.
async function handleAnnotate(req, res) {
  const started = Date.now();
  let payload;
  try {
    payload = await readJsonBody(req);
  } catch (err) {
    sendJson(res, err.code === "too_large" ? 413 : 400, { ok: false, code: err.code, message: err.message });
    return;
  }
  if (!payload || !isDataImage(payload.image)) {
    sendJson(res, 400, { ok: false, code: "bad_image", message: "A rectified artwork image (data URL) is required." });
    return;
  }
  if (!requireKey(res)) return;
  const prompt = critique.buildAnnotatePrompt({
    intent: shortText(payload.intent, 500),
    medium: shortText(payload.medium, 80),
    palette: Array.isArray(payload.palette) ? payload.palette.slice(0, 8) : []
  });
  const providerBody = critique.buildRequest({
    model: MODEL_API_MODEL,
    system: prompt.system,
    userText: prompt.userText,
    images: [payload.image],
    schema: critique.ANNOTATE_SCHEMA,
    // Six placed marks plus reasons need headroom; reasoning models spend
    // tokens thinking first, and a tight cap truncates to content:null.
    // Generous ceiling (hackathon budget); typical use stays far below it.
    maxTokens: 8000
  });
  let provider;
  try {
    provider = await postToProvider(providerBody, 90000);
  } catch (err) {
    console.log(`annotate transport error after ${Date.now() - started}ms`);
    sendJson(res, 502, { ok: false, code: "provider_unreachable", message: "Could not reach the model API. Check your connection and try again." });
    return;
  }
  const mapped = providerError(provider);
  if (mapped) {
    if (mapped.log) console.log(`annotate ${mapped.log}`);
    sendJson(res, mapped.http, { ok: false, code: mapped.code, message: mapped.message });
    return;
  }
  let marks;
  try {
    marks = critique.parseAnnotateContent(critique.extractContent(provider.json));
  } catch (err) {
    console.log(`annotate parse error after ${Date.now() - started}ms:${parseDetail(provider)}`);
    if (critique.finishReason(provider.json) === "length") {
      sendJson(res, 502, { ok: false, code: "truncated", message: "The model ran out of room mid-answer. Try again." });
      return;
    }
    sendJson(res, 502, { ok: false, code: "bad_response", message: "The model response could not be understood. Try again." });
    return;
  }
  console.log(`annotate ok model="${MODEL_API_MODEL}" ms=${Date.now() - started} marks=${marks.annotations.length}`);
  sendJson(res, 200, { ok: true, marks });
}

// POST /api/generate-image. Repaints the rectified artwork as one study
// via the image model, instructed by the artwork's own art direction.
// Returns the study plus the model's revised prompt for provenance.
async function handleGenerate(req, res) {
  const started = Date.now();
  let payload;
  try {
    payload = await readJsonBody(req);
  } catch (err) {
    sendJson(res, err.code === "too_large" ? 413 : 400, { ok: false, code: err.code, message: err.message });
    return;
  }
  if (!payload || !isDataImage(payload.image)) {
    sendJson(res, 400, { ok: false, code: "bad_image", message: "A rectified artwork image (data URL) is required." });
    return;
  }
  if (!requireKey(res)) return;
  const prompt = critique.buildGeneratePrompt({
    intent: shortText(payload.intent, 500),
    medium: shortText(payload.medium, 80),
    palette: Array.isArray(payload.palette) ? payload.palette.slice(0, 8) : [],
    direction: payload.direction && typeof payload.direction === "object" ? payload.direction : null
  });
  const providerBody = critique.buildImageEditRequest({
    model: MODEL_IMAGE_MODEL,
    prompt,
    image: payload.image,
    width: payload.aspectW,
    height: payload.aspectH
  });
  let provider;
  try {
    provider = await postToProvider(providerBody, 180000, "/images/edits");
  } catch (err) {
    console.log(`generate transport error after ${Date.now() - started}ms`);
    sendJson(res, 502, { ok: false, code: "provider_unreachable", message: "Could not reach the model API. Check your connection and try again." });
    return;
  }
  const mapped = providerError(provider);
  if (mapped) {
    if (mapped.log) console.log(`generate ${mapped.log}`);
    sendJson(res, mapped.http, { ok: false, code: mapped.code, message: mapped.message });
    return;
  }
  let study;
  try {
    study = critique.parseImageResult(provider.json);
  } catch (err) {
    console.log(`generate parse error after ${Date.now() - started}ms`);
    sendJson(res, 502, { ok: false, code: "bad_response", message: "The model returned no usable image. Try again." });
    return;
  }
  console.log(`generate ok model="${MODEL_IMAGE_MODEL}" ms=${Date.now() - started} bytes=${study.image.length} revised=${study.revisedPrompt ? "yes" : "no"}`);
  sendJson(res, 200, { ok: true, image: study.image, revisedPrompt: study.revisedPrompt, prompt });
}

const server = http.createServer((req, res) => {
  const route = (req.url || "").split("?")[0];
  if (req.method === "POST" && (route === "/api/critique" || route === "/api/overview" || route === "/api/suggest-guide" || route === "/api/art-direction" || route === "/api/art-chat" || route === "/api/suggest-annotations" || route === "/api/generate-image")) {
    const handler = route === "/api/critique" ? handleCritique :
      route === "/api/overview" ? handleOverview :
      route === "/api/suggest-guide" ? handleSuggest :
      route === "/api/art-direction" ? handleDirection :
      route === "/api/art-chat" ? handleArtChat :
      route === "/api/suggest-annotations" ? handleAnnotate : handleGenerate;
    handler(req, res).catch(() => {
      if (!res.headersSent) {
        sendJson(res, 500, { ok: false, code: "server_error", message: "The server failed to handle the request." });
      }
    });
    return;
  }
  if (req.method !== "GET") {
    res.writeHead(405, { "Content-Type": "text/plain" });
    res.end("Method not allowed");
    return;
  }
  const file = safePath(req.url || "/");
  if (!file) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Bad request");
    return;
  }
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    fs.createReadStream(file).pipe(res);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Artist Companion prototype at http://${HOST}:${PORT}/`);
});
