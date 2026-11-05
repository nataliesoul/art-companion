/* AI overview: one automatic, comprehensive read of the marked artwork.
   Runs after the corners are set when the artist has allowed it, renders a
   visual report, and can read it aloud. Geometry, sampling and image
   preparation come from app.js through window.ACApp; the request goes to
   /api/overview on this server, which holds the key. */
(function () {
  "use strict";
  var AUTO_KEY = "ac.overview.auto.v1";
  var SPEAK_KEY = "ac.overview.speak.v1";
  var SETTLE_MS = 1500;
  function byId(id) { return document.getElementById(id); }
  function el(tag, className, content) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined && content !== null) node.textContent = content;
    return node;
  }
  var section = byId("overview-heading").closest("section");
  var status = byId("overview-status");
  var runButton = byId("overview-run");
  var readButton = byId("overview-read");
  var autoToggle = byId("overview-auto");
  var speakToggle = byId("overview-speak");
  var consent = byId("overview-consent");
  var report = byId("overview-report");
  var setup = byId("overview-setup");
  var setupSteps = byId("overview-setup-steps");
  var artwork = byId("artwork");
  var quad = byId("quad");

  var state = { hasImage: false, cornerCount: 0, ready: false };
  var lastSignature = null;
  var inFlight = false;
  var queued = false;
  var timer = null;
  var current = null;
  var sketch = null;
  var reading = false;

  function getPref(key) {
    try { return localStorage.getItem(key); } catch (err) { return null; }
  }
  function setPref(key, value) {
    try { localStorage.setItem(key, value); } catch (err) { /* private mode: session only */ }
  }
  autoToggle.checked = getPref(AUTO_KEY) === "on";
  speakToggle.checked = getPref(SPEAK_KEY) === "on";
  var speechOk = window.ACVoice && window.ACVoice.synthesisSupported();
  if (!speechOk) {
    readButton.hidden = true;
    speakToggle.closest("label").hidden = true;
  }

  function signature() {
    return (quad.getAttribute("points") || "") + "|" + (artwork.currentSrc || artwork.src || "").length;
  }
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(maybeAuto, SETTLE_MS);
  }
  function maybeAuto() {
    if (!state.ready || !window.ACApp) return;
    if (signature() === lastSignature) return;
    var pref = getPref(AUTO_KEY);
    if (pref === "on") run();
    else if (pref !== "off") consent.hidden = false;
  }
  window.addEventListener("ac:artwork-state", function (event) {
    state = event.detail;
    if (!state.ready) {
      clearTimeout(timer);
      return;
    }
    schedule();
  });

  byId("overview-consent-yes").addEventListener("click", function () {
    setPref(AUTO_KEY, "on");
    autoToggle.checked = true;
    consent.hidden = true;
    run();
  });
  byId("overview-consent-no").addEventListener("click", function () {
    setPref(AUTO_KEY, "off");
    autoToggle.checked = false;
    consent.hidden = true;
    status.textContent = "Press Analyze now whenever you want the overview.";
  });
  autoToggle.addEventListener("change", function () {
    setPref(AUTO_KEY, autoToggle.checked ? "on" : "off");
    consent.hidden = true;
    if (autoToggle.checked) schedule();
  });
  speakToggle.addEventListener("change", function () {
    setPref(SPEAK_KEY, speakToggle.checked ? "on" : "off");
  });
  runButton.addEventListener("click", function () { run(); });

  function finish() {
    inFlight = false;
    runButton.disabled = false;
    report.classList.remove("is-stale");
    if (queued) {
      queued = false;
      schedule();
    }
  }
  function run() {
    if (inFlight) {
      queued = true;
      return;
    }
    if (!window.ACApp || !window.ACApp.isReady()) {
      status.textContent = state.hasImage ?
        "Mark the four corners first; the overview reads the rectified artwork." :
        "Add a photo first.";
      return;
    }
    stopReading();
    consent.hidden = true;
    setup.hidden = true;
    inFlight = true;
    runButton.disabled = true;
    report.classList.add("is-stale");
    status.textContent = "Preparing artwork…";
    var prep = window.ACApp.prepareAnalysis();
    if (prep.error) {
      status.textContent = prep.error;
      finish();
      return;
    }
    lastSignature = signature();
    status.textContent = "Asking the model…";
    var controller = null;
    if (typeof AbortController !== "undefined") {
      controller = new AbortController();
      setTimeout(function () { controller.abort(); }, 150000);
    }
    fetch("/api/overview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: prep.imgs.art,
        overlay: prep.imgs.overlay,
        intent: prep.intent,
        medium: prep.medium,
        guide: prep.guide,
        palette: prep.palette,
        formatNote: prep.formatNote,
        wbNote: prep.wbNote
      }),
      signal: controller ? controller.signal : undefined
    }).then(function (res) {
      return res.json().then(function (data) { return { status: res.status, data: data }; });
    }).then(function (out) {
      if (out.data && out.data.ok) {
        render(out.data.overview, prep);
        status.textContent = "";
        window.dispatchEvent(new CustomEvent("ac:overview-ready"));
        if (speakToggle.checked && speechOk) speak(current.headline + " " + current.summary, null);
      } else if (out.data && out.data.code === "not_configured") {
        while (setupSteps.firstChild) setupSteps.removeChild(setupSteps.firstChild);
        (out.data.setup || []).forEach(function (step) { setupSteps.appendChild(el("li", null, step)); });
        setup.hidden = false;
        status.textContent = "";
      } else {
        status.textContent = (out.data && out.data.message) ? out.data.message : "Overview failed (HTTP " + out.status + ").";
      }
    }).catch(function (err) {
      status.textContent = err && err.name === "AbortError" ?
        "The overview timed out. Try again." :
        "Overview request failed. Is the server still running?";
    }).finally(finish);
  }

  /* Report rendering. Everything below is built from sanitized server data. */
  var ASPECT_ICON = { composition: "grid", values: "eye", color: "palette", balance: "compass" };
  function list(title, icon, items, className) {
    var wrap = el("div", "overview-list " + className);
    wrap.dataset.icon = icon;
    wrap.appendChild(el("h4", null, title));
    var ul = el("ul");
    if (!items.length) ul.appendChild(el("li", "overview-none", "None noted."));
    items.forEach(function (text) { ul.appendChild(el("li", null, text)); });
    wrap.appendChild(ul);
    return wrap;
  }
  function swatch(hex, label, isAnchor) {
    var item = el("span", "overview-swatch" + (isAnchor ? " is-anchor" : ""));
    var chip = el("span", "overview-chip");
    chip.style.backgroundColor = hex;
    item.append(chip, el("span", "overview-swatch-label", label || hex));
    item.title = hex;
    return item;
  }
  function render(ov, prep) {
    current = ov;
    if (sketch) {
      sketch.remove();
      sketch = null;
    }
    while (report.firstChild) report.removeChild(report.firstChild);

    var head = el("div", "overview-head");
    head.append(el("h3", "overview-headline", ov.headline), el("p", "overview-summary", ov.summary));
    report.appendChild(head);

    var figure = el("figure", "overview-figure");
    var host = el("div", "overview-sketch");
    host.id = "overview-sketch";
    figure.appendChild(host);
    var focus = el("p", "overview-focus");
    focus.setAttribute("role", "status");
    var caption = el("figcaption", null, ov.marks.length ?
      "Marks show where the model reads weight, focus and possible shifts. Tap a mark for its reason." :
      "The rectified artwork as analyzed. No marks were suggested.");
    figure.append(caption, focus);
    report.appendChild(figure);
    if (ov.marks.length && window.ACApp.mountMarks && window.p5) {
      sketch = window.ACApp.mountMarks(host, prep.imgs.art, ov.marks, function () { return true; }, function (hit) {
        focus.textContent = "#" + (hit.i + 1) + " " + (hit.a.label || window.ACApp.kindLabel(hit.a.kind)) + " — " + hit.a.reason;
      });
      var legend = el("ol", "overview-marks");
      ov.marks.forEach(function (m, i) {
        var li = el("li");
        li.append(el("strong", null, "#" + (i + 1) + " " + (m.label || window.ACApp.kindLabel(m.kind))), el("span", null, m.reason));
        li.addEventListener("click", function () { focus.textContent = "#" + (i + 1) + " " + (m.label || "") + " — " + m.reason; });
        legend.appendChild(li);
      });
      report.appendChild(legend);
    } else {
      var img = el("img");
      img.src = prep.imgs.art;
      img.alt = "Rectified artwork as analyzed";
      host.appendChild(img);
    }

    var aspects = el("div", "overview-aspects");
    ov.aspects.forEach(function (a) {
      var card = el("div", "overview-aspect");
      card.dataset.icon = ASPECT_ICON[a.id] || "sparkle";
      card.append(el("h4", null, a.title), el("p", null, a.reading));
      aspects.appendChild(card);
    });
    report.appendChild(aspects);

    var lists = el("div", "overview-lists");
    lists.append(
      list("Strengths", "sparkle", ov.strengths, "is-strength"),
      list("Observations", "eye", ov.observations, "is-observation"),
      list("Next steps to try", "bulb", ov.nextSteps, "is-next")
    );
    report.appendChild(lists);

    var colors = el("div", "overview-colors");
    var sampled = el("div", "overview-palette");
    sampled.appendChild(el("h4", null, "Your palette, as sampled"));
    var row = el("div", "overview-swatches");
    prep.palette.forEach(function (c) {
      row.appendChild(swatch(c.hex, c.hex + " · " + Math.round(c.coverage * 100) + "%", false));
    });
    sampled.appendChild(row);
    colors.appendChild(sampled);
    if (ov.palette) {
      var pick = el("div", "overview-palette is-pick");
      pick.appendChild(el("h4", null, "Try: " + ov.palette.schemeLabel + " around " + ov.palette.anchorHex));
      var pickRow = el("div", "overview-swatches");
      ov.palette.colors.forEach(function (hex) { pickRow.appendChild(swatch(hex, hex, hex === ov.palette.anchorHex)); });
      pick.appendChild(pickRow);
      if (ov.palette.reason) pick.appendChild(el("p", "hint", ov.palette.reason));
      colors.appendChild(pick);
    }
    report.appendChild(colors);

    if (ov.guides.length) {
      var guides = el("div", "overview-guides");
      guides.appendChild(el("h4", null, "Guides to try on the canvas"));
      ov.guides.forEach(function (g) {
        var chip = el("div", "overview-guide");
        var apply = el("button", "secondary", "Apply " + g.name);
        apply.type = "button";
        apply.addEventListener("click", function () {
          window.ACApp.applyGuide(g.id);
          status.textContent = g.name + " is now the guide on your canvas.";
        });
        chip.append(apply, el("span", null, g.reason));
        guides.appendChild(chip);
      });
      report.appendChild(guides);
    }

    report.appendChild(el("p", "overview-uncertainty", ov.uncertainty));
    report.appendChild(el("p", "overview-sent", "Sent: " + prep.imgs.width + "×" + prep.imgs.height +
      " rectified artwork + " + (prep.guide ? prep.guide.name : "guide") + " overlay · " + prep.medium +
      " · " + prep.palette.length + " palette colors · " + prep.formatNote.replace(/\.$/, "") +
      (prep.wbNote ? " · WB " + prep.wbNote : "") + ". Your photo itself is unchanged."));
    report.hidden = false;
  }

  /* Voice: read the report, or just the summary automatically. */
  function reportText(ov) {
    var parts = [ov.headline, ov.summary];
    ov.aspects.forEach(function (a) { parts.push(a.title + ". " + a.reading); });
    if (ov.strengths.length) parts.push("Strengths. " + ov.strengths.join(" "));
    if (ov.observations.length) parts.push("Observations. " + ov.observations.join(" "));
    if (ov.nextSteps.length) parts.push("Next steps to try. " + ov.nextSteps.join(" "));
    parts.push("Uncertainty. " + ov.uncertainty);
    return parts.join(" ");
  }
  function stopReading() {
    if (reading && window.ACVoice) window.ACVoice.stopSpeaking();
    reading = false;
    readButton.textContent = "Read aloud";
  }
  function speak(text, full) {
    reading = true;
    readButton.textContent = "Stop reading";
    var ok = window.ACVoice.speak(text, { onEnd: function () {
      reading = false;
      readButton.textContent = "Read aloud";
    } });
    if (!ok) {
      reading = false;
      readButton.textContent = "Read aloud";
      status.textContent = "Read-aloud is not available in this browser.";
    }
    return ok;
  }
  function readReport() {
    if (reading) {
      stopReading();
      return;
    }
    if (!current) {
      status.textContent = "No overview to read yet.";
      return;
    }
    speak(reportText(current), true);
  }
  readButton.addEventListener("click", readReport);

  window.ACOverview = {
    hasReport: function () { return !!current; },
    read: readReport,
    stop: stopReading,
    run: run
  };
})();
