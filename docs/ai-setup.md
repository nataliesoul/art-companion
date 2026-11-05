# AI critique setup

Analysis calls the Meta Model API from the server. The browser never sees
the key: it stays in server memory, loaded from the environment or `.env`.

## One-time setup

1. Create a key in the Meta Model API dashboard. Start at the official docs:
   [Meta Model API docs](https://dev.meta.ai/docs).
2. Save it where only the server reads it — pick one:
   - a `MODEL_API_KEY` environment variable, or
   - a `.env` file next to `server.js` (copy `.env.example` first).
   Never paste a key into chat, email, or source files. `.env` is git-ignored.
3. Restart the server (`node server.js`) and press Analyze again.

This API is a paid/credentialed service: each Analyze press sends two small
images (rectified artwork + guide overlay, longest side 512 px) plus a short
text prompt, and each Suggest a guide or Suggest art direction press sends one
image with the palette (art direction also sends intent and medium). Each
conversation turn sends one image with up to 12 recent turns, and each
Suggest changes press sends one image with the palette, intent, and medium.
Each Generate a version press sends one image with the palette, intent,
medium, and the current art direction to the image model, which bills per
generated image. Nothing is sent until you press the button.

The AI overview is the one exception, and only with your consent: the first
time an artwork's corners are set, the page asks whether to analyze
automatically. If you accept, each time the corners settle it sends the same
two small images as Analyze plus palette, medium and intent in one request
(`/api/overview`) and shows a report. The toggle under the overview turns this
off again; "Analyze now" always works on request.

## Optional overrides

- `MODEL_API_BASE` (default `https://api.meta.ai/v1`)
- `MODEL_API_MODEL` (default `muse-spark-1.3`)
- `MODEL_IMAGE_MODEL` (default `muse-image-1.0`)

Set these the same way if the dashboard names a different model. HTTPS is
required for the base URL.

## Verify

- Without a key: Analyze shows rectified previews plus "AI not configured"
  steps. No feedback text is generated.
- With a key: Analyze returns strengths, up to three observations, optional
  next steps, and an uncertainty note.
- `bad_key`: the dashboard rejected the key. Recheck `MODEL_API_KEY` (no
  quotes, no trailing spaces) and restart.

## Privacy

Each request sends the rectified artwork images, your intent/medium/topic,
the sampled palette hexes, and the format/white-balance notes to the model
provider. Art direction additionally returns guide and palette picks with the
model's reasons; its suggestion preview is computed locally in your browser,
never by the model. Generate a version is the exception: it asks the image
model to repaint your artwork as a study, so that one call returns AI imagery
alongside the direction's own explanation. Conversation transcripts live only
in the page and are cleared with it; voice transcription itself runs on
Apple/Google servers.
Do not analyze work you are not willing to share with them.
