# Studio presentation

The visual update lives in `public/studio.css` and `public/studio.js`, loaded
after the existing CSS and app script in `public/index.html`.

- Keep these two includes when changing the page. Core feature logic remains
  in app.js; the presentation script preserves the existing elements and IDs.
- Branding still comes from branding.js. The design follows the owner's
  reference board: sakura-pink checker wash, cream cards with pink outlines,
  lime primary buttons, raspberry headings. The photo keeps a neutral grey mat
  so sampled colors read truthfully. System fonts only (ui-rounded where the
  platform has it); no external fonts, packages, or API requests.
- Icons are inline SVG data URIs in studio.css, drawn as CSS masks on buttons
  by element id (`--icon`). app.js can keep rewriting button text without
  losing them. Tool-card headers use raspberry-colored copies (`--ir-*`).
- Header is a sticky app bar: brand mark, name, navigation and the voice
  toggle. Below 1050px the navigation becomes a fixed bottom tab bar (safe-area
  aware) and an artwork context card with thumbnail, corner status and a Back
  to canvas button sits at the top of the tools column. The header must not
  use backdrop-filter or transform: that would trap the fixed tab bar.
- Tools are grouped into Compose, Feedback, and Color. Each tool is a card with
  an icon, title and one-line blurb; open state survives switching groups.
  Background feedback marks its tab with a dot instead of interrupting.
- A three-step setup indicator follows image/corner state and shows check marks
  for completed steps. AI actions with unmet setup explain the prerequisite and
  return to Canvas. Hide guides changes only overlay visibility.
- Status lines are classified by their text (studio.js): warning, busy,
  thinking, listening, ok. While a request reads "Asking the model…" or
  "Preparing artwork…" the status chip pulses with bouncing dots, the tool card
  border shimmers, the disabled button sheens, and a lime scan band sweeps the
  photo frame. All of it stops under prefers-reduced-motion.
- Corner handles are 36px visually with a 52px touch target.
- AI overview (`public/overview.js`, `/api/overview`, `buildOverviewPrompt` in
  lib/critique.js): one request returns headline, summary, four aspect
  readings, strengths, observations, next steps, marks, guide and palette
  picks, and uncertainty. It runs automatically ~1.5 s after the corners
  settle, only after the artist accepts the one-time consent card (stored as
  `ac.overview.auto.v1`); "Analyze now" always works. The report reuses the
  app.js mark sketch (`window.ACApp.mountMarks`) and reads aloud through
  voice.js; "read feedback" by voice reads the overview when no critique
  exists. Overview is the default tools group and the first tab after Canvas.

Verification: npm check and test pass. Browser checks at 375px and 1440px cover
the empty state, sample loading, auto-detected corners, tab navigation, the
artwork context card, palette sampling and the simulated thinking state. Real
iPhone, iPad and camera checks still need confirmation on device; responsive
emulation is not device QA. No paid AI calls were made.
