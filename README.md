# Artist Companion (working title)

Composition guides and thoughtful feedback for physical art.

Artist Companion is a mobile-first web app that helps artists working in
physical media plan compositions, study color, and get constructive AI
feedback on request. Photograph a painting, mark or auto-detect its four
corners, and the app rectifies the artwork and offers guides, palette
studies, critique, art direction, voice conversation, positioned
suggestions, and an AI-painted study of the same piece. The original
photo is never altered, and every suggestion is optional and dismissible.

This is a feasibility prototype built for a Meta hackathon. The display
name lives in `public/branding.js` and can change without affecting data:
storage keys and project identifiers are independent of branding.

## Features

- **Artwork photo (1)** — Upload, live camera capture, or a built-in
  sample. Camera is requested only after a user action, with an upload
  fallback.
- **Corner marking (2)** — Tap four corners in any order, drag to refine,
  or press **Detect corners**: a dependency-free quad detector
  (grayscale, blur, Sobel, polarity-aware RANSAC lines, multi-scale
  search with a regional boundary snap) finds the artwork even in
  angled, skewed photos and fails closed to manual taps when unsure.
- **AI critique (3)** — Optional analysis grounded in the rectified
  artwork, the selected guide overlay, intent, medium, topic, measured
  palette, format, and white balance. Returns strengths, up to three
  observations, next steps, and an uncertainty note. Nothing leaves the
  device until Analyze is pressed.
- **AI art direction (4)** — One call returns recommended guides, a
  grounded palette pick (scheme + anchor from sampled pixels, computed
  locally so colors never drift), the model's reasons, a device-computed
  hue-shift preview, and **Generate a version**: a repainted study from
  the image model with the direction's explanation.
- **Voice conversation (5)** — Tap-to-talk dialogue about the artwork
  with spoken replies; typed questions join the same transcript, which
  is never saved.
- **Format, guide, color, Albers (6–9)** — True paper/canvas proportions,
  30 composition guides with automatic overlay selection, sampled
  palettes with white-balance options and computed harmonies, and
  interactive Josef Albers color studies.
- **Suggested changes (10)** — AI-placed balance/focal/accent marks
  drawn with the vendored offline p5.js overlay; tap any mark for its
  reason.
- **Automatic overview** — An optional first read that runs once corners
  settle: headline, summary, four aspects, strengths, marks, guides, and
  palette, readable aloud.
- **Studio view** — A presentation arrangement of the same tools for
  demoing a painting session.

## How it works

Everything geometric runs locally in the browser: corner detection,
perspective rectification, guide tracing, palette sampling, white
balance, and all previews and overlays. The zero-dependency Node server
(`server.js`) serves the static app and relays on-request AI calls to
the Meta Model API, keeping the API key server-side at all times. Each
AI call sends the small rectified artwork (longest side 512 px) plus
measured context — never the full photo, and never before the button
press. Model outputs are validated against real registries (guide ids,
harmony schemes, sampled hexes); unknown values are dropped rather than
invented, and truncated or unparseable replies surface as honest errors.

## Muse product use

- **Muse Code** is the development assistant used to build this project
  (see `PROJECT-PLAN.md`). Runtime model access is a
  separate setup step: installing or signing into Muse Code does not
  establish it; the server needs its own `MODEL_API_KEY`.
- **Meta Model API** powers every AI feature at runtime through one
  base URL and one key:
  - **Muse Spark / Muse Wonder** (`MODEL_API_MODEL`) for all
    text-and-vision understanding: critique, guide picks, art
    direction, conversation, annotations, and the automatic overview.
  - **Muse Image** (`MODEL_IMAGE_MODEL`, default `muse-image-1.0`) for
    the generated study, via the OpenAI-compatible `POST /images/edits`
    JSON endpoint with the rectified artwork as the reference image.

## Why Meta's models matter to this solution

- **They see the artwork.** Image understanding grounds every comment in
  the actual painting — composition, values, color relationships — not
  in generic art advice. The prompts attach the rectified piece plus
  measured data (palette coverage, format, white balance) so feedback
  stays specific and honest about uncertainty.
- **Structured outputs keep suggestions usable.** JSON schemas return
  guide ids, palette schemes, and positioned annotation coordinates the
  app validates and renders directly; the model reasons, the app
  measures, and neither invents what the other owns.
- **One provider paints the study too.** Because the same API serves an
  image model, the "generate a version" request reuses the exact art
  direction the critique models produced — scheme, anchor, guide
  reasons — as the edit brief, with the model's revised prompt returned
  for provenance. Text, vision, and image stay in one grounded loop.
- **Server-side keys, client-side pixels.** The credentialed API fits the
  privacy design: heavy pixels stay on the device, small prepared
  images go out only on request, and keys never touch the browser.

## Project layout

- `server.js` — Static server + Model API relay (`/api/critique`,
  `/api/overview`, `/api/suggest-guide`, `/api/art-direction`,
  `/api/art-chat`, `/api/suggest-annotations`, `/api/generate-image`).
- `lib/critique.js` — Server-side prompts, request builders, and
  response validators shared by all endpoints.
- `public/` — The app: `index.html`, `app.js` (photo, corners, AI
  panels), `grid.js` (guides), `detect.js` (corner detection),
  `color.js`, `rectify.js`, `formats.js`, `voice.js`, `overview.js`,
  `studio.js`, `branding.js`, `styles.css`, `studio.css`, and vendored
  `vendor/p5.min.js` (offline overlay rendering).
- `tests/` — Dependency-free Node suites, one per module.
- `docs/` — `ai-setup.md` (key setup), `color-theory.json` (model
  reference digest).
- `TESTING.md` — Manual checks incl. iPhone/iPad/Windows steps.
- Test photos of real artwork are kept out of the repository; use
  `public/sample-artwork.svg` or your own photos locally.

## Setup and run

Requirements: Node.js. No packages to install.

1. `cp .env.example .env` (Windows: copy it) and set `MODEL_API_KEY`
   from the Meta Model API dashboard (see `docs/ai-setup.md`). Without
   a key the app runs fully offline; AI buttons show setup steps and
   invent nothing.
2. `node server.js` (or `npm start`).
3. Open http://127.0.0.1:8080/ in a browser.
4. Press Suggest art direction in section 4, then Generate a version
   for the painted study. Each generation is billed per image.

Optional: `MODEL_API_BASE`, `MODEL_API_MODEL`, `MODEL_IMAGE_MODEL`,
`HOST`, `PORT` (e.g. `PORT=8099 node server.js`). Camera capture on
phones needs HTTPS outside loopback — see `TESTING.md`.

## Testing

- `npm test` — all Node suites (guides, color, formats, rectify, corner
  detection incl. angled/perspective/textured cases, critique builders,
  voice commands).
- `npm run check` — syntax-check every shipped JS file.
- `TESTING.md` — 19 manual steps plus iPhone Safari, iPad, and Windows
  layout checks.

## Privacy principles

- Photos stay on the device until an AI button is pressed; there is no
  account and no sync.
- API credentials live server-side only — never in source, logs, or
  client bundles.
- The artist's originals are never modified; feedback and studies are
  separate, optional, and dismissible.
- No invented success states: unconfigured AI, truncation, and parse
  failures are reported as such.

## Status and next steps

Working prototype: all ten sections, the automatic overview, studio
view, and the generated study run against the live API. Outstanding:
on-device photo checks on the owner's wall painting (iPhone first, then
iPad/Windows layouts), early Quest browser feasibility per the plan,
and a final product rename. See `PROJECT-PLAN.md` and `TESTING.md`.
