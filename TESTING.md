# Testing the feasibility prototype

## Start the preview (Windows)

From `E:\Dev\MUSE`:

```cmd
node server.js
```

Then open [http://127.0.0.1:8080/](http://127.0.0.1:8080/) in a Windows browser.

No install step is needed: the server uses only the Node.js standard library.
`PORT` and `HOST` env vars override the address, e.g.
`HOST=0.0.0.0 PORT=8080 node server.js` to expose the LAN address.

## What to try on Windows

1. Upload a photo of one flat rectangular artwork (JPEG/PNG). If a photo moved
   from iPhone arrives as HEIC and does not display, re-export it as JPEG.
2. Corners: loading a photo with one fully-visible rectangular artwork on
   a contrasting background should detect corners automatically ("Corners
   detected"), including shots taken at an angle. Otherwise tap the four
   corners in any order, or press Detect corners to retry. An Auto-picked
   guide overlay appears.
3. Drag corners to refine; select a corner and use arrow keys for fine moves
   (Shift+arrow moves faster).
4. Move the Guide opacity slider from 0 to 100%.
5. Undo / Reset corners.
6. Camera button on Windows: works over `http://127.0.0.1:8080/` because
   loopback counts as a secure context. If permission is denied or no camera
   exists, the page shows the reason and upload keeps working.
7. Guide dropdown (now section 7): it starts on Auto (recommended).
   Mark four corners and an overlay must appear with an "Auto guide: …"
   note naming the pick. Choose any guide to switch to manual; choose
   Auto again to re-pick. Step through all 30 guides (grouped by geometry,
   perspective, aids). Perspective guides use fixed canonical vanishing
   points; aids (23-30) are placement helpers, not artwork analysis.
8. Color theory: mark corners, press Sample palette, and check the swatches
   match the artwork's dominant colors; pick a swatch and check its
   complementary / analogous / triadic / split-complementary groups. Then
   try white balance: gray-world and white-patch on a cast photo, and
   manual with a tap on white paper. Check the gains readout and the
   sampled/corrected chips; the photo itself must stay unchanged. Then
   try 3-point calibration: tap black, grey, and white references and
   check the mapped chips read near-black, neutral, and near-white.
9. Reload the page: guide choice, format choice, opacity, and corner
   fractions restore from browser storage. Corners apply to whatever photo
   loads next; reset them per artwork.
10. Format section: pick a known size (e.g. A4 portrait) and check the
    aspect line names it; try a ratio, a custom size in cm and in, and
    the Use image size checkbox. Angle-true guides (rings, diagonals,
    rabatment) should follow the declared proportions. Checking Use
    image size snaps corners to the image edges; unchecking restores
    your manual corners; dragging a corner keeps your edit.
11. Albers studies: after sampling, check the figure reads differently on
    the dark vs light grounds, run the 20-second afterimage timer, and
    check the vibration pair. Reference cards explain each effect.
12. AI critique without a key: mark corners, set medium/topic, press
    Analyze. Rectified + overlay previews and the context line must show,
    followed by the "AI not configured" steps and no invented feedback.
13. AI critique with a key (see docs/ai-setup.md): same flow must return
    strengths, up to three observations, optional next steps, and an
    uncertainty note. Check the feedback references the visible artwork.
14. Guide suggestions with a key: in section 7, press Suggest a guide.
    Up to two guide names with reasons must appear; Apply must switch
    the overlay (and leave Auto mode). Without a key, a pointer to
    section 3 setup shows.
15. Art direction with a key: in section 4, press Suggest art direction.
    Up to two guides with Apply buttons, a labeled scheme + anchor palette,
    a why-summary, and an uncertainty note must appear. The preview canvas
    must show the rectified artwork shifted toward the suggested hues with
    the first guide overlaid; the strength slider must blend it, the toggle
    must hide the overlay, and Dismiss must clear the result. Without a key,
    a pointer to section 3 setup shows and nothing is invented.
16. Voice (needs microphone + HTTPS outside loopback; on iPhone use the
    HTTPS address from the iPhone section): Dictate fills the intent box;
    the header toggle runs commands ("suggest a guide", "analyze",
    "sample palette", "next/previous guide", "read feedback", "chat", "stop");
    Read aloud speaks the critique. Note that transcription audio goes
    to Apple/Google servers while read-aloud stays on-device.
17. Conversation with a key: in section 5, type a question about the marked
    artwork and press Send — the reply must appear in the transcript and be
    spoken aloud (uncheck the toggle to silence it). Then tap Talk and ask a
    follow-up by voice; it must join the same transcript. Stop must halt
    listening/speech, and Clear must empty the transcript. Without a key,
    a pointer to section 3 setup shows and nothing is invented.
18. Suggested changes with a key: in section 10, press Suggest changes.
    Numbered balance/focal marks must draw over the rectified artwork with
    a matching list and direction summary. Tapping a mark must show its
    reason, the toggle must hide the marks, and Dismiss must clear the
    result. Without a key, a pointer to section 3 setup shows.
19. Generated study with a key: in section 4, after Suggest art direction,
    press Generate a version. One repainted study of the same subject and
    composition must appear with the direction's why-summary, the revised
    brief when supplied, and the full prompt under "What was asked".
    Dismiss must clear the study; the original photo must be unchanged.
    Without a key, a pointer to section 3 setup shows.

19. AI overview: load the sample. The Overview tab should ask "Analyze
    automatically?" once the corners are set. Without a key, choosing Yes
    must show the "AI not configured" steps and nothing else. With a key,
    a report must appear: headline, summary, the artwork with numbered marks
    (tap one for its reason), four aspect cards, strengths / observations /
    next steps, your sampled palette plus a suggested scheme, guides with
    Apply buttons, an uncertainty line, and a "Sent:" line. Drag a corner:
    the report must re-run about 1.5 s after you stop. Read aloud must speak
    the report; "Speak the summary when ready" must speak the headline and
    summary automatically after the next run. Reload: both toggles persist.
    Turn auto off: moving corners must not send anything.
20. Upload defaults to actual size: upload a photo file from the computer;
    Use image size must be checked with corners on the image edges and the
    aspect read from photo pixels. If detection finds a clear inset
    rectangle it refines the corners instead. Camera capture and the sample
    must leave the box unchecked. Reset must restore manual corner taps.

## iPhone testing (Safari)

Upload works over any address. **Live camera capture needs HTTPS**: iOS only
exposes the camera to secure contexts, and a phone's `localhost` is the phone
itself while a Windows LAN address over plain HTTP is not secure. Pick one:

- **Easiest — secure tunnel:** on the Windows PC, run the server above, then in
  a second terminal expose it with a trusted HTTPS URL (e.g. Cloudflare's free
  `cloudflared tunnel --url http://127.0.0.1:8080`). Open the printed
  `https://…` URL in iPhone Safari. Camera capture should then work; upload
  always works.
- **Alternative — same-network HTTPS:** serve with a LAN-trusted certificate
  (e.g. `mkcert`, plus installing its CA profile on the iPhone) and open
  `https://<windows-lan-ip>:8080`. More setup, but stays on your network.
- **Upload-only check (no HTTPS):** serve with `HOST=0.0.0.0`, open
  `http://<windows-lan-ip>:8080` on the iPhone, and use Upload photo — on
  iPhone the file picker itself offers the camera, which covers still capture
  without live preview.

Report back: (a) upload works, (b) live camera preview + capture works or the
exact message shown, (c) corner taps land where your finger lands, (d) grid and
opacity behave, (e) any layout problems at phone width.

## iPad

Same steps as iPhone. Note portrait vs landscape layout issues separately.

## Still outstanding (not in this step)

- Physical iPhone / iPad checks above (desktop-only checks prove nothing there).
- Quest browser test: immersive view, rectangle placement, drift measurement,
  and whether physical camera frames are exposed at all. Rendering passthrough
  must not be mistaken for camera access.
- Project save/reopen with export/import for device transfer.
- Later milestones: intention/medium workflow, critique, annotations, sync.
