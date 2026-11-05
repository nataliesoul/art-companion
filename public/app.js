// Artist Companion feasibility prototype: photo upload / camera capture,
// four-corner marking, and an adjustable rule-of-thirds overlay.
// The original image is never modified; guides render in an overlay only.
(function () {
  "use strict";

  // Stable storage key. Deliberately independent of the display name in
  // branding.js so renaming the app preserves saved guide state.
  var STORAGE_KEY = "ac.m1.guide.v1";

  var branding = window.BRANDING || {};
  if (branding.displayName) {
    document.title = branding.displayName;
    document.getElementById("app-name").textContent = branding.displayName;
  }
  if (branding.description) {
    document.getElementById("app-description").textContent = branding.description;
  }

  var fileInput = document.getElementById("file-input");
  var cameraButton = document.getElementById("camera-button");
  var photoStatus = document.getElementById("photo-status");
  var cameraWrap = document.getElementById("camera-wrap");
  var video = document.getElementById("camera-preview");
  var captureButton = document.getElementById("capture-button");
  var cameraCancel = document.getElementById("camera-cancel");
  var stage = document.getElementById("stage");
  var artwork = document.getElementById("artwork");
  var overlay = document.getElementById("overlay");
  var quad = document.getElementById("quad");
  var grid = document.getElementById("grid");
  var handles = document.getElementById("handles");
  var cornerHint = document.getElementById("corner-hint");
  var detectButton = document.getElementById("detect-button");
  var detectStatus = document.getElementById("detect-status");
  var undoButton = document.getElementById("undo-button");
  var resetButton = document.getElementById("reset-button");
  var opacitySlider = document.getElementById("opacity-slider");
  var opacityValue = document.getElementById("opacity-value");
  var guideSelect = document.getElementById("guide-select");
  var guideBlurb = document.getElementById("guide-blurb");
  var autoStatus = document.getElementById("auto-status");
  var sampleButton = document.getElementById("sample-button");
  var colorStatus = document.getElementById("color-status");
  var paletteBox = document.getElementById("palette");
  var harmoniesBox = document.getElementById("harmonies");
  var harmonyBase = document.getElementById("harmony-base");
  var harmonyTemp = document.getElementById("harmony-temp");
  var harmonyGroups = document.getElementById("harmony-groups");
  var albersStudies = document.getElementById("albers-studies");
  var albersNote = document.getElementById("albers-note");
  var groundDark = document.getElementById("ground-dark");
  var groundLight = document.getElementById("ground-light");
  var figureDark = document.getElementById("figure-dark");
  var figureLight = document.getElementById("figure-light");
  var albersLabels = document.getElementById("albers-labels");
  var afterimageStart = document.getElementById("afterimage-start");
  var afterimageStop = document.getElementById("afterimage-stop");
  var afterimageStatus = document.getElementById("afterimage-status");
  var afterimageField = document.getElementById("afterimage-field");
  var vibratePair = document.getElementById("vibrate-pair");
  var vibrateLabels = document.getElementById("vibrate-labels");
  var wbMethod = document.getElementById("wb-method");
  var pickNeutral = document.getElementById("pick-neutral");
  var pickCal = document.getElementById("pick-cal");
  var pickButtons = {
    black: document.getElementById("pick-black"),
    grey: document.getElementById("pick-grey"),
    white: document.getElementById("pick-white")
  };
  var wbStatus = document.getElementById("wb-status");
  var wbGains = document.getElementById("wb-gains");
  var wbChips = document.getElementById("wb-chips");
  var neutralLayer = document.getElementById("neutral-layer");
  var intentInput = document.getElementById("intent-input");
  var mediumSelect = document.getElementById("medium-select");
  var topicSelect = document.getElementById("topic-select");
  var analyzeButton = document.getElementById("analyze-button");
  var critiqueStatus = document.getElementById("critique-status");
  var critiquePreviews = document.getElementById("critique-previews");
  var rectPreview = document.getElementById("rect-preview");
  var overlayPreview = document.getElementById("overlay-preview");
  var critiqueContext = document.getElementById("critique-context");
  var critiqueResult = document.getElementById("critique-result");
  var critiqueStrengths = document.getElementById("critique-strengths");
  var critiqueObservations = document.getElementById("critique-observations");
  var critiqueNextWrap = document.getElementById("critique-next-wrap");
  var critiqueNext = document.getElementById("critique-next");
  var critiqueUncertainty = document.getElementById("critique-uncertainty");
  var critiqueSetup = document.getElementById("critique-setup");
  var critiqueSetupSteps = document.getElementById("critique-setup-steps");
  var suggestButton = document.getElementById("suggest-button");
  var suggestStatus = document.getElementById("suggest-status");
  var suggestionsBox = document.getElementById("suggestions");
  var directionButton = document.getElementById("direction-button");
  var directionStatus = document.getElementById("direction-status");
  var directionResult = document.getElementById("direction-result");
  var directionGuides = document.getElementById("direction-guides");
  var directionPaletteReason = document.getElementById("direction-palette-reason");
  var directionSwatches = document.getElementById("direction-swatches");
  var directionSummary = document.getElementById("direction-summary");
  var directionUncertainty = document.getElementById("direction-uncertainty");
  var directionCanvas = document.getElementById("direction-canvas");
  var directionCaption = document.getElementById("direction-caption");
  var directionStrength = document.getElementById("direction-strength");
  var directionStrengthLabel = document.getElementById("direction-strength-label");
  var directionStrengthValue = document.getElementById("direction-strength-value");
  var directionGuideToggle = document.getElementById("direction-guide-toggle");
  var directionDismiss = document.getElementById("direction-dismiss");
  var generateButton = document.getElementById("generate-button");
  var generateStatus = document.getElementById("generate-status");
  var generateResult = document.getElementById("generate-result");
  var generateImg = document.getElementById("generate-img");
  var generateWhy = document.getElementById("generate-why");
  var generateRevised = document.getElementById("generate-revised");
  var generatePrompt = document.getElementById("generate-prompt");
  var generateDismiss = document.getElementById("generate-dismiss");
  var chatTalk = document.getElementById("chat-talk");
  var chatStop = document.getElementById("chat-stop");
  var chatStatus = document.getElementById("chat-status");
  var chatLog = document.getElementById("chat-log");
  var chatSpeakToggle = document.getElementById("chat-speak-toggle");
  var chatInput = document.getElementById("chat-input");
  var chatSend = document.getElementById("chat-send");
  var chatClear = document.getElementById("chat-clear");
  var annotateButton = document.getElementById("annotate-button");
  var annotateStatus = document.getElementById("annotate-status");
  var annotateResult = document.getElementById("annotate-result");
  var annotateWrap = document.getElementById("annotate-sketch");
  var annotateFocus = document.getElementById("annotate-focus");
  var annotateOverlay = document.getElementById("annotate-overlay");
  var annotateList = document.getElementById("annotate-list");
  var annotateSummary = document.getElementById("annotate-summary");
  var annotateDismiss = document.getElementById("annotate-dismiss");
  var voiceToggle = document.getElementById("voice-toggle");
  var voiceHeard = document.getElementById("voice-heard");
  var dictateButton = document.getElementById("dictate-button");
  var dictateStatus = document.getElementById("dictate-status");
  var voiceCommands = document.getElementById("voice-commands");
  var readButton = document.getElementById("read-button");
  var formatSelect = document.getElementById("format-select");
  var orientationSelect = document.getElementById("orientation-select");
  var customDims = document.getElementById("custom-dims");
  var customW = document.getElementById("custom-w");
  var customH = document.getElementById("custom-h");
  var customUnit = document.getElementById("custom-unit");
  var useImageSize = document.getElementById("use-image-size");
  var aspectStatus = document.getElementById("aspect-status");

  var GROUP_LABELS = {
    geometry: "Proportion and geometry",
    perspective: "Perspective",
    aids: "Placement aids"
  };

  var corners = []; // tapped points as {x, y} fractions of the image box
  var cornersAuto = false; // true while corners were auto-placed from image size
  var stashedCorners = []; // manual corners held while auto corners apply
  var neutralPoint = null; // fraction coords of the manual white-balance reference
  var pickingNeutral = false;
  var calPoints = { black: null, grey: null, white: null };
  var pickingSlot = null;
  var dictateRec = null;
  var controlRec = null;
  var controlOn = false;
  var readingAloud = false;
  var lastFeedback = null;
  var directionPreview = null; // { img, colors, guideId, guideName, aspect, schemeLabel, shifted }
  var lastDirection = null; // latest art direction result, feeds the generated study
  var chatHistory = []; // [{ role: "user"|"assistant", content }], newest last, never persisted
  var chatRec = null;
  var chatBusy = false;
  var chatController = null;
  var currentGuide = "thirds";
  var autoGuide = true; // Auto picks the overlay from the artwork; any manual choice turns it off
  var selectedHex = null;
  var lastPalette = [];
  var afterimageTimer = null;
  var hasImage = false;
  var stream = null;
  var objectUrl = null;
  var dragIndex = -1;

  function setStatus(message) {
    photoStatus.textContent = message || "";
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        corners: corners,
        cornersAuto: cornersAuto,
        opacity: Number(opacitySlider.value),
        guide: autoGuide ? "auto" : currentGuide,
        format: {
          choice: formatSelect.value,
          orientation: orientationSelect.value,
          customW: customW.value,
          customH: customH.value,
          customUnit: customUnit.value,
          useImage: useImageSize.checked
        },
        wb: {
          method: wbMethod.value,
          neutral: neutralPoint,
          cal: calPoints
        },
        critiqueInputs: {
          intent: intentInput.value,
          medium: mediumSelect.value,
          topic: topicSelect.value
        }
      }));
    } catch (err) {
      // Private browsing or disabled storage: the guide still works in memory.
    }
  }

  var FORMAT_GROUPS = {
    iso: "ISO paper",
    us: "US paper",
    art: "Art sizes"
  };

  function buildFormatSelect() {
    var autoGroup = document.createElement("optgroup");
    autoGroup.label = "Automatic";
    var autoOpt = document.createElement("option");
    autoOpt.value = "auto";
    autoOpt.textContent = "Auto — measure from marked corners";
    autoGroup.appendChild(autoOpt);
    formatSelect.appendChild(autoGroup);
    var groups = {};
    window.ACFormats.FORMATS.forEach(function (f) {
      if (!groups[f.group]) {
        var optgroup = document.createElement("optgroup");
        optgroup.label = FORMAT_GROUPS[f.group] || f.group;
        groups[f.group] = optgroup;
        formatSelect.appendChild(optgroup);
      }
      var option = document.createElement("option");
      option.value = f.id;
      option.textContent = window.ACFormats.formatLabel(f);
      groups[f.group].appendChild(option);
    });
    var ratioGroup = document.createElement("optgroup");
    ratioGroup.label = "Ratio only";
    window.ACFormats.RATIOS.forEach(function (r) {
      var option = document.createElement("option");
      option.value = "ratio:" + r.id;
      option.textContent = r.name;
      ratioGroup.appendChild(option);
    });
    formatSelect.appendChild(ratioGroup);
    var customGroup = document.createElement("optgroup");
    customGroup.label = "Custom";
    var customOpt = document.createElement("option");
    customOpt.value = "custom";
    customOpt.textContent = "Custom dimensions…";
    customGroup.appendChild(customOpt);
    formatSelect.appendChild(customGroup);
  }

  function formatChoiceValid(choice) {
    if (choice === "auto" || choice === "custom") return true;
    if (choice.indexOf("ratio:") === 0) {
      return !!window.ACFormats.findRatio(choice.slice(6));
    }
    return !!window.ACFormats.findFormat(choice);
  }

  function updateFormatVisibility() {
    customDims.hidden = formatSelect.value !== "custom";
    orientationSelect.disabled = formatSelect.value === "auto";
  }

  // Effective artwork aspect plus a plain-language source label.
  // Precedence: image-size checkbox, chosen format/ratio/custom, corners.
  function resolveAspect(ordered) {
    var orientation = orientationSelect.value === "landscape" ? "landscape" : "portrait";
    if (useImageSize.checked) {
      if (hasImage && artwork.naturalWidth && artwork.naturalHeight) {
        var ia = artwork.naturalWidth / artwork.naturalHeight;
        return {
          aspect: ia,
          label: "Using photo pixels (" + ia.toFixed(3) + ")." +
            (cornersAuto ? " Corners set to the image edges." : "")
        };
      }
      return { aspect: null, label: "Use image size is on, but no photo is loaded yet." };
    }
    var choice = formatSelect.value;
    var customInvalid = false;
    if (choice === "custom") {
      try {
        var ca = window.ACFormats.customAspect(customW.value, customH.value, customUnit.value, orientation);
        return {
          aspect: ca,
          label: "Using custom " + customW.value + " x " + customH.value + " " +
            customUnit.value + " " + orientation + " (" + ca.toFixed(3) + ")."
        };
      } catch (err) {
        customInvalid = true;
      }
    } else if (choice.indexOf("ratio:") === 0) {
      var r = window.ACFormats.findRatio(choice.slice(6));
      if (r) {
        var ra = window.ACFormats.ratioAspect(r.id, orientation);
        return { aspect: ra, label: "Using " + r.name + " " + orientation + " (" + ra.toFixed(3) + ")." };
      }
    } else if (choice !== "auto") {
      var f = window.ACFormats.findFormat(choice);
      if (f) {
        var fa = window.ACFormats.formatAspect(f.id, orientation);
        return { aspect: fa, label: "Using " + f.name + " " + orientation + " (" + fa.toFixed(3) + ")." };
      }
    }
    if (ordered) {
      var ma = quadAspect(ordered);
      return {
        aspect: ma,
        label: customInvalid
          ? "Custom size incomplete; measuring from marked corners (" + ma.toFixed(3) + ")."
          : "Measuring from marked corners (" + ma.toFixed(3) + ")."
      };
    }
    return {
      aspect: null,
      label: customInvalid
        ? "Enter custom dimensions, mark the corners, or pick a format."
        : "Mark the corners, pick a format, or use image size."
    };
  }

  function onFormatChange() {
    updateFormatVisibility();
    saveState();
    render();
  }

  // Snap corners to the image edges; the previous manual corners are held
  // aside so unchecking restores them instead of destroying work.
  function applyAutoCorners() {
    if (!cornersAuto) {
      stashedCorners = corners.slice();
      cornersAuto = true;
    }
    corners = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
  }

  function releaseAutoCorners() {
    if (cornersAuto) {
      corners = stashedCorners;
      stashedCorners = [];
      cornersAuto = false;
    }
  }

  function markManualCornerEdit() {
    cornersAuto = false;
    stashedCorners = [];
  }

  function setSelectOption(select, value) {
    if (typeof value !== "string") return;
    for (var i = 0; i < select.options.length; i++) {
      if (select.options[i].text === value) {
        select.value = select.options[i].value;
        return;
      }
    }
  }

  function guideById(id) {
    var found = null;
    window.ACGuide.GUIDES.forEach(function (g) {
      if (g.id === id) found = g;
    });
    return found;
  }

  function buildGuideSelect() {
    var auto = document.createElement("option");
    auto.value = "auto";
    auto.textContent = "Auto (recommended)";
    guideSelect.appendChild(auto);
    var groups = {};
    window.ACGuide.GUIDES.forEach(function (g) {
      if (!groups[g.group]) {
        var optgroup = document.createElement("optgroup");
        optgroup.label = GROUP_LABELS[g.group] || g.group;
        groups[g.group] = optgroup;
        guideSelect.appendChild(optgroup);
      }
      var option = document.createElement("option");
      option.value = g.id;
      option.textContent = g.name;
      groups[g.group].appendChild(option);
    });
  }

  function updateBlurb() {
    var g = guideById(currentGuide);
    guideBlurb.textContent = g ? g.blurb : "";
  }

  // Visual-weight map of the rectified artwork for the Auto guide pick.
  // Weight is contrast from the mean lightness, boosted by saturation.
  // Returns { weights, gw, gh } or null when pixels are unreadable.
  function artworkWeights(ordered, aspect) {
    var scale = Math.min(1, 96 / Math.max(artwork.naturalWidth, artwork.naturalHeight));
    var sw = Math.max(1, Math.round(artwork.naturalWidth * scale));
    var sh = Math.max(1, Math.round(artwork.naturalHeight * scale));
    var src = document.createElement("canvas");
    src.width = sw;
    src.height = sh;
    src.getContext("2d").drawImage(artwork, 0, 0, sw, sh);
    var srcData;
    try {
      srcData = src.getContext("2d").getImageData(0, 0, sw, sh).data;
    } catch (err) {
      return null;
    }
    var outW = aspect >= 1 ? 48 : Math.max(1, Math.round(48 * aspect));
    var outH = aspect >= 1 ? Math.max(1, Math.round(48 / aspect)) : 48;
    var flat;
    try {
      flat = window.ACRectify.rectify(srcData, sw, sh, ordered, outW, outH);
    } catch (err) {
      return null;
    }
    var lights = [];
    var sats = [];
    var i;
    for (i = 0; i < flat.data.length; i += 4) {
      var hsl = window.ACColor.rgbToHsl(flat.data[i], flat.data[i + 1], flat.data[i + 2]);
      lights.push(hsl.l);
      sats.push(hsl.s);
    }
    var mean = 0;
    for (i = 0; i < lights.length; i++) mean += lights[i];
    mean = lights.length ? mean / lights.length : 0;
    var weights = [];
    for (i = 0; i < lights.length; i++) {
      weights.push(Math.abs(lights[i] - mean) * (0.5 + 0.5 * sats[i]));
    }
    return { weights: weights, gw: outW, gh: outH };
  }

  // Auto overlay: analyzes the marked artwork locally (no network) and
  // shows the best-fitting guide. Silent unless it actually picks.
  function runAutoGuide() {
    if (!autoGuide || !hasImage || !artwork.naturalWidth) return;
    var ordered = orderedCorners();
    if (!ordered) return;
    var resolved = resolveAspect(ordered);
    var aspect = resolved.aspect === null ? quadAspect(ordered) : resolved.aspect;
    var map = artworkWeights(ordered, aspect);
    if (!map) {
      autoStatus.textContent = "Auto could not read the photo pixels in this browser.";
      return;
    }
    var pick = window.ACGuide.autoPickGuide(map.weights, map.gw, map.gh, aspect);
    var g = guideById(pick.id);
    if (!g) return;
    currentGuide = g.id;
    updateBlurb();
    autoStatus.textContent = "Auto guide: " + g.name +
      " — its lines track the photo's strongest contrasts. Choosing a guide switches to manual.";
    saveState();
    render();
  }

  function loadState() {
    var opacity = 80;
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return opacity;
      var saved = JSON.parse(raw);
      if (Array.isArray(saved.corners) && saved.corners.length <= 4) {
        corners = saved.corners.filter(function (p) {
          return p && isFinite(p.x) && isFinite(p.y);
        });
      }
      cornersAuto = saved.cornersAuto === true;
      if (isFinite(saved.opacity)) {
        opacity = Math.min(100, Math.max(0, Number(saved.opacity)));
      }
      if (typeof saved.guide === "string" && guideById(saved.guide)) {
        currentGuide = saved.guide;
        autoGuide = false;
      }
      if (saved.format && typeof saved.format === "object") {
        var fmt = saved.format;
        if (typeof fmt.choice === "string" && formatChoiceValid(fmt.choice)) {
          formatSelect.value = fmt.choice;
        }
        if (fmt.orientation === "portrait" || fmt.orientation === "landscape") {
          orientationSelect.value = fmt.orientation;
        }
        if (typeof fmt.customW === "string") customW.value = fmt.customW;
        if (typeof fmt.customH === "string") customH.value = fmt.customH;
        if (fmt.customUnit === "cm" || fmt.customUnit === "in") {
          customUnit.value = fmt.customUnit;
        }
        useImageSize.checked = fmt.useImage === true;
      }
      if (saved.wb && typeof saved.wb === "object") {
        var method = saved.wb.method;
        if (method === "off" || method === "gray" || method === "white" ||
            method === "manual" || method === "manual3") {
          wbMethod.value = method;
        }
        var npt = saved.wb.neutral;
        if (npt && isFinite(npt.x) && isFinite(npt.y)) {
          neutralPoint = { x: npt.x, y: npt.y };
        }
        if (saved.wb.cal && typeof saved.wb.cal === "object") {
          ["black", "grey", "white"].forEach(function (slot) {
            var p = saved.wb.cal[slot];
            if (p && isFinite(p.x) && isFinite(p.y)) {
              calPoints[slot] = { x: p.x, y: p.y };
            }
          });
        }
      }
      if (saved.critiqueInputs && typeof saved.critiqueInputs === "object") {
        if (typeof saved.critiqueInputs.intent === "string") {
          intentInput.value = saved.critiqueInputs.intent.slice(0, 500);
        }
        setSelectOption(mediumSelect, saved.critiqueInputs.medium);
        setSelectOption(topicSelect, saved.critiqueInputs.topic);
      }
    } catch (err) {
      // Corrupt or unavailable storage: start fresh.
    }
    return opacity;
  }

  // Physical aspect ratio (width / height) of the marked artwork, measured
  // in displayed pixels so angle-true guides stay correct.
  function quadAspect(ordered) {
    var rect = artwork.getBoundingClientRect();
    function edge(a, b) {
      var dx = (a.x - b.x) * rect.width;
      var dy = (a.y - b.y) * rect.height;
      return Math.sqrt(dx * dx + dy * dy);
    }
    var width = (edge(ordered[0], ordered[1]) + edge(ordered[3], ordered[2])) / 2;
    var height = (edge(ordered[0], ordered[3]) + edge(ordered[1], ordered[2])) / 2;
    if (height < 1e-6) return 1;
    return width / height;
  }

  function applyOpacity() {
    var value = Number(opacitySlider.value);
    opacityValue.textContent = value + "%";
    document.documentElement.style.setProperty("--guide-opacity", String(value / 100));
  }

  function orderedCorners() {
    if (corners.length !== 4) return null;
    try {
      return window.ACGuide.orderCorners(corners);
    } catch (err) {
      return null;
    }
  }

  function render() {
    var i;
    var ordered = orderedCorners();

    quad.setAttribute("points", orderedCornersForOutline(ordered));
    while (grid.firstChild) grid.removeChild(grid.firstChild);
    // Keep controls alive during a drag and keyboard nudges. Replacing a
    // captured pointer target interrupts dragging and loses keyboard focus.
    while (handles.children.length > corners.length) handles.lastChild.remove();

    var resolved = resolveAspect(ordered);
    aspectStatus.textContent = resolved.label;
    if (ordered) {
      var polys = [];
      try {
        var aspect = resolved.aspect === null ? quadAspect(ordered) : resolved.aspect;
        polys = window.ACGuide.traceGuide(currentGuide, ordered, aspect);
      } catch (err) {
        polys = [];
      }
      polys.forEach(function (poly) {
        var el = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        el.setAttribute("points", poly.map(function (p) {
          return (p.x * 100) + "," + (p.y * 100);
        }).join(" "));
        grid.appendChild(el);
      });
    } else if (corners.length > 1) {
      // Connect partial taps so the artist can see progress.
      quad.setAttribute("points", corners.map(function (p) {
        return (p.x * 100) + "," + (p.y * 100);
      }).join(" "));
    }

    corners.forEach(function (p, index) {
      var existing = handles.children[index];
      if (existing) {
        existing.style.left = (p.x * 100) + "%";
        existing.style.top = (p.y * 100) + "%";
        return;
      }
      var handle = document.createElement("button");
      handle.type = "button";
      handle.className = "handle";
      handle.style.left = (p.x * 100) + "%";
      handle.style.top = (p.y * 100) + "%";
      handle.textContent = String(index + 1);
      handle.setAttribute("aria-label", "Corner " + (index + 1) + ". Drag to move, or use arrow keys.");
      handle.addEventListener("pointerdown", function (event) {
        dragIndex = index;
        handle.setPointerCapture(event.pointerId);
        event.preventDefault();
        event.stopPropagation();
      });
      handle.addEventListener("pointermove", function (event) {
        if (dragIndex !== index) return;
        moveCorner(index, eventToFraction(event));
        event.preventDefault();
      });
      handle.addEventListener("pointerup", function () {
        dragIndex = -1;
        saveState();
        runAutoGuide();
      });
      handle.addEventListener("pointercancel", function () {
        dragIndex = -1;
      });
      handle.addEventListener("keydown", function (event) {
        var step = event.shiftKey ? 0.01 : 0.002;
        var p = corners[index];
        var next = null;
        if (event.key === "ArrowLeft") next = { x: p.x - step, y: p.y };
        else if (event.key === "ArrowRight") next = { x: p.x + step, y: p.y };
        else if (event.key === "ArrowUp") next = { x: p.x, y: p.y - step };
        else if (event.key === "ArrowDown") next = { x: p.x, y: p.y + step };
        if (next) {
          moveCorner(index, clampPoint(next));
          saveState();
          event.preventDefault();
        }
      });
      handles.appendChild(handle);
    });

    undoButton.disabled = corners.length === 0;
    resetButton.disabled = corners.length === 0;
    renderNeutralMarker();
    updateHint(ordered);
    window.dispatchEvent(new CustomEvent("ac:artwork-state", {
      detail: { hasImage: hasImage, cornerCount: corners.length, ready: hasImage && !!ordered }
    }));
  }

  function orderedCornersForOutline(ordered) {
    if (!ordered) return "";
    return ordered.map(function (p) {
      return (p.x * 100) + "," + (p.y * 100);
    }).join(" ");
  }

  function updateHint(ordered) {
    if (!hasImage) {
      cornerHint.textContent = "Add a photo first, then tap its four corners in any order.";
    } else if (corners.length < 4) {
      cornerHint.textContent = "Tap corner " + (corners.length + 1) + " of 4 on the artwork.";
    } else if (ordered) {
      cornerHint.textContent = "Guide placed. Drag any corner to refine it.";
    } else {
      cornerHint.textContent = "Those four points do not form a rectangle. Reset and try again.";
    }
  }

  function clampPoint(p) {
    return {
      x: Math.min(1, Math.max(0, p.x)),
      y: Math.min(1, Math.max(0, p.y))
    };
  }

  function moveCorner(index, point) {
    corners[index] = clampPoint(point);
    markManualCornerEdit();
    render();
  }

  function eventToFraction(event) {
    var rect = artwork.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height
    };
  }

  stage.addEventListener("pointerdown", function (event) {
    if (pickingNeutral || pickingSlot) {
      if (!hasImage) return;
      if (pickingSlot) {
        calPoints[pickingSlot] = clampPoint(eventToFraction(event));
        setPickingSlot(null);
      } else {
        neutralPoint = clampPoint(eventToFraction(event));
        setPicking(false);
      }
      saveState();
      samplePalette();
      render();
      return;
    }
    if (!hasImage || corners.length >= 4) return;
    corners.push(clampPoint(eventToFraction(event)));
    markManualCornerEdit();
    detectStatus.textContent = "";
    saveState();
    render();
    if (corners.length === 4) runAutoGuide();
  });

  // Corner detection: looks for one fully-visible rectangular artwork on
  // a contrasting background. Auto runs stay quiet on failure (tapping
  // still works); the Detect button explains. Returns true when corners
  // were set.
  function tryDetectCorners(auto) {
    detectStatus.textContent = "";
    if (!hasImage || !artwork.naturalWidth) {
      if (!auto) detectStatus.textContent = "Add a photo first.";
      return false;
    }
    var scale = Math.min(1, 320 / Math.max(artwork.naturalWidth, artwork.naturalHeight));
    var w = Math.max(8, Math.round(artwork.naturalWidth * scale));
    var h = Math.max(8, Math.round(artwork.naturalHeight * scale));
    var canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(artwork, 0, 0, w, h);
    var data;
    try {
      data = canvas.getContext("2d").getImageData(0, 0, w, h).data;
    } catch (err) {
      if (!auto) detectStatus.textContent = "This browser blocked corner detection for that image.";
      return false;
    }
    var found = null;
    try {
      found = window.ACDetect.detectQuad(data, w, h);
    } catch (err) {
      found = null;
    }
    if (!found) {
      if (!auto) {
        detectStatus.textContent = "No clear rectangle found. Frame one artwork fully inside the photo and try again, or tap the corners.";
      }
      return false;
    }
    var ordered = window.ACGuide.orderCorners(found);
    corners = [ordered[0], ordered[1], ordered[2], ordered[3]];
    cornersAuto = false;
    stashedCorners = [];
    detectStatus.textContent = "Corners detected — drag any corner to refine.";
    saveState();
    render();
    runAutoGuide();
    return true;
  }

  detectButton.addEventListener("click", function () {
    tryDetectCorners(false);
  });

  undoButton.addEventListener("click", function () {
    corners.pop();
    markManualCornerEdit();
    autoStatus.textContent = "";
    detectStatus.textContent = "";
    saveState();
    render();
  });

  resetButton.addEventListener("click", function () {
    corners = [];
    markManualCornerEdit();
    autoStatus.textContent = "";
    detectStatus.textContent = "";
    saveState();
    render();
  });

  opacitySlider.addEventListener("input", function () {
    applyOpacity();
    saveState();
  });

  guideSelect.addEventListener("change", function () {
    if (guideSelect.value === "auto") {
      autoGuide = true;
      runAutoGuide();
      if (!orderedCorners()) {
        autoStatus.textContent = "Auto will pick a guide once four corners are marked.";
      }
      saveState();
      return;
    }
    if (guideById(guideSelect.value)) {
      autoGuide = false;
      autoStatus.textContent = "";
      currentGuide = guideSelect.value;
      updateBlurb();
      saveState();
      render();
    }
  });

  formatSelect.addEventListener("change", onFormatChange);
  orientationSelect.addEventListener("change", onFormatChange);
  customUnit.addEventListener("change", onFormatChange);
  customW.addEventListener("input", onFormatChange);
  customH.addEventListener("input", onFormatChange);
  useImageSize.addEventListener("change", function () {
    if (useImageSize.checked) {
      if (hasImage) applyAutoCorners();
    } else {
      releaseAutoCorners();
    }
    onFormatChange();
  });

  var WB_METHOD_LABELS = {
    gray: "gray world",
    white: "white patch",
    manual: "manual neutral point"
  };

  function updateWbVisibility() {
    pickNeutral.hidden = wbMethod.value !== "manual";
    pickCal.hidden = wbMethod.value !== "manual3";
  }

  var CAL_HINTS = {
    black: "Tap the darkest neutral area: deep shadow on card, or a black border.",
    grey: "Tap a mid neutral area: a gray card, or plain concrete in the same light.",
    white: "Tap the brightest neutral area: white paper in the same light."
  };

  function calPickedCount() {
    var n = 0;
    if (calPoints.black) n += 1;
    if (calPoints.grey) n += 1;
    if (calPoints.white) n += 1;
    return n;
  }

  function setPickingSlot(slot) {
    pickingSlot = slot;
    ["black", "grey", "white"].forEach(function (s) {
      pickButtons[s].setAttribute("aria-pressed", s === slot ? "true" : "false");
    });
    if (slot) {
      if (pickingNeutral) setPicking(false);
      stage.classList.add("picking");
      wbStatus.textContent = CAL_HINTS[slot];
    } else {
      stage.classList.remove("picking");
    }
  }

  function setPicking(on) {
    if (on && pickingSlot) setPickingSlot(null);
    pickingNeutral = on;
    if (on) stage.classList.add("picking");
    else stage.classList.remove("picking");
    pickNeutral.textContent = on ? "Cancel picking" : "Pick neutral point";
    if (on) {
      wbStatus.textContent = "Tap a neutral area in the photo: white paper, a gray card, or plain mat board.";
    } else if (wbMethod.value === "manual" && !neutralPoint) {
      wbStatus.textContent = "Pick a neutral point (white paper, gray card) to enable correction.";
    }
  }

  function renderNeutralMarker() {
    while (neutralLayer.firstChild) neutralLayer.removeChild(neutralLayer.firstChild);
    function addMarker(point, cls) {
      var marker = document.createElement("span");
      marker.className = "neutral-marker" + cls;
      marker.style.left = (point.x * 100) + "%";
      marker.style.top = (point.y * 100) + "%";
      neutralLayer.appendChild(marker);
    }
    if (neutralPoint && wbMethod.value === "manual") {
      addMarker(neutralPoint, "");
    }
    if (wbMethod.value === "manual3") {
      if (calPoints.black) addMarker(calPoints.black, " cal-black");
      if (calPoints.grey) addMarker(calPoints.grey, " cal-grey");
      if (calPoints.white) addMarker(calPoints.white, " cal-white");
    }
  }

  function renderWb(wb, cal) {
    while (wbChips.firstChild) wbChips.removeChild(wbChips.firstChild);
    if (cal) {
      wbStatus.textContent = "";
      var names = ["black", "grey", "white"];
      var mappedHex = {};
      names.forEach(function (slot) {
        var ref = cal.refs[slot];
        var out = window.ACColor.applyCalibrationToPixel(ref.r, ref.g, ref.b, cal);
        mappedHex[slot] = window.ACColor.rgbToHex(out.r, out.g, out.b);
      });
      wbGains.textContent = "Black " + window.ACColor.rgbToHex(cal.refs.black.r, cal.refs.black.g, cal.refs.black.b) +
        " → " + mappedHex.black + " · Grey " +
        window.ACColor.rgbToHex(cal.refs.grey.r, cal.refs.grey.g, cal.refs.grey.b) +
        " → " + mappedHex.grey + " · White " +
        window.ACColor.rgbToHex(cal.refs.white.r, cal.refs.white.g, cal.refs.white.b) +
        " → " + mappedHex.white + " (gamma R×" + cal.gamma.r.toFixed(2) +
        " G×" + cal.gamma.g.toFixed(2) + " B×" + cal.gamma.b.toFixed(2) +
        "). Sampling corrected pixels; the photo is unchanged.";
      wbGains.hidden = false;
      names.forEach(function (slot) {
        var ref = cal.refs[slot];
        [[slot, window.ACColor.rgbToHex(ref.r, ref.g, ref.b)],
         [slot + " mapped", mappedHex[slot]]].forEach(function (pair) {
          var item = document.createElement("span");
          item.className = "mini-swatch";
          var chip = document.createElement("span");
          chip.className = "mini-chip";
          chip.style.backgroundColor = pair[1];
          item.appendChild(chip);
          item.appendChild(document.createTextNode(pair[0] + " " + pair[1]));
          wbChips.appendChild(item);
        });
      });
      wbChips.hidden = false;
      return;
    }
    if (!wb) {
      wbGains.hidden = true;
      wbChips.hidden = true;
      if (pickingNeutral || pickingSlot) return;
      if (wbMethod.value === "manual3") {
        var have = calPickedCount();
        if (have < 3) {
          var missing = [];
          if (!calPoints.black) missing.push("black");
          if (!calPoints.grey) missing.push("grey");
          if (!calPoints.white) missing.push("white");
          wbStatus.textContent = "Picked " + have + " of 3 references. Next: " + missing.join(", ") + ".";
        } else {
          wbStatus.textContent = "Those three points are unusable (grey must fall between black and white in every channel); sampled as-is.";
        }
      } else if (wbMethod.value === "manual" && !neutralPoint) {
        wbStatus.textContent = "Pick a neutral point (white paper, gray card) to enable correction.";
      } else if (wbMethod.value !== "off") {
        wbStatus.textContent = "White balance found no usable pixels; sampled as-is.";
      }
      return;
    }
    wbStatus.textContent = "";
    wbGains.textContent = "Gains R×" + wb.gains.r.toFixed(2) + " G×" + wb.gains.g.toFixed(2) +
      " B×" + wb.gains.b.toFixed(2) + " (" + WB_METHOD_LABELS[wbMethod.value] +
      "). Sampling corrected pixels; the photo is unchanged.";
    wbGains.hidden = false;
    var refHex = window.ACColor.rgbToHex(wb.ref.r, wb.ref.g, wb.ref.b);
    var fixed = window.ACColor.applyGainsToPixel(wb.ref.r, wb.ref.g, wb.ref.b, wb.gains);
    var fixedHex = window.ACColor.rgbToHex(fixed.r, fixed.g, fixed.b);
    [["sampled", refHex], ["corrected", fixedHex]].forEach(function (pair) {
      var item = document.createElement("span");
      item.className = "mini-swatch";
      var chip = document.createElement("span");
      chip.className = "mini-chip";
      chip.style.backgroundColor = pair[1];
      item.appendChild(chip);
      item.appendChild(document.createTextNode(pair[0] + " " + pair[1]));
      wbChips.appendChild(item);
    });
    wbChips.hidden = false;
  }

  function stopAfterimage() {
    if (afterimageTimer) {
      clearInterval(afterimageTimer);
      afterimageTimer = null;
    }
    afterimageField.hidden = true;
    afterimageStart.disabled = false;
    afterimageStop.disabled = true;
  }

  function clearColor() {
    selectedHex = null;
    lastPalette = [];
    while (paletteBox.firstChild) paletteBox.removeChild(paletteBox.firstChild);
    while (harmonyGroups.firstChild) harmonyGroups.removeChild(harmonyGroups.firstChild);
    paletteBox.hidden = true;
    harmoniesBox.hidden = true;
    colorStatus.textContent = "";
    stopAfterimage();
    afterimageStatus.textContent = "";
    albersStudies.hidden = true;
    neutralPoint = null;
    setPicking(false);
    setPickingSlot(null);
    calPoints = { black: null, grey: null, white: null };
    wbStatus.textContent = "";
    wbGains.hidden = true;
    wbChips.hidden = true;
    while (wbChips.firstChild) wbChips.removeChild(wbChips.firstChild);
  }

  // Albers studies from the sampled palette. The figure is the selected
  // color; grounds are the palette's darkest and lightest colors.
  function renderAlbers() {
    if (!lastPalette.length) {
      albersStudies.hidden = true;
      return;
    }
    var hexes = lastPalette.map(function (c) { return c.hex; });
    var figure = selectedHex || hexes[0];
    var dark = window.ACColor.darkest(hexes);
    var light = window.ACColor.lightest(hexes);
    var fallback = false;
    if (!dark || !light || dark === light) {
      dark = "#202020";
      light = "#f2f2f2";
      fallback = true;
    }
    groundDark.style.backgroundColor = dark;
    groundLight.style.backgroundColor = light;
    figureDark.style.backgroundColor = figure;
    figureLight.style.backgroundColor = figure;
    albersNote.textContent = fallback
      ? "Palette has a single value, so neutral grounds stand in."
      : "Figure " + figure + " on your darkest (" + dark + ") and lightest (" + light + ") sampled colors.";
    albersLabels.textContent = "Both centers are " + figure + ". Compare how each reads against its ground.";
    while (vibratePair.firstChild) vibratePair.removeChild(vibratePair.firstChild);
    var complement = window.ACColor.harmonies(figure)[0].colors[0];
    [figure, complement, figure, complement].forEach(function (c) {
      var stripe = document.createElement("span");
      stripe.style.backgroundColor = c;
      vibratePair.appendChild(stripe);
    });
    vibrateLabels.textContent = figure + " against its complement " + complement + ".";
    albersStudies.hidden = false;
  }

  function startAfterimage() {
    if (!lastPalette.length) return;
    var figure = selectedHex || lastPalette[0].hex;
    stopAfterimage();
    afterimageField.style.backgroundColor = figure;
    afterimageField.hidden = false;
    afterimageStart.disabled = true;
    afterimageStop.disabled = false;
    var remaining = 20;
    afterimageStatus.textContent = "Stare at the dot. 20 seconds left.";
    afterimageTimer = setInterval(function () {
      remaining -= 1;
      if (remaining > 0) {
        if (remaining % 5 === 0) {
          afterimageStatus.textContent = "Stare at the dot. " + remaining + " seconds left.";
        }
        return;
      }
      clearInterval(afterimageTimer);
      afterimageTimer = null;
      afterimageField.style.backgroundColor = "#808080";
      afterimageStatus.textContent = "Keep looking at the dot on gray. A ghost of the complement may appear.";
    }, 1000);
  }

  afterimageStart.addEventListener("click", startAfterimage);
  afterimageStop.addEventListener("click", function () {
    stopAfterimage();
    afterimageStatus.textContent = "";
  });

  function showHarmonies(hex) {
    selectedHex = hex;
    var buttons = paletteBox.querySelectorAll(".swatch");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute("aria-pressed", buttons[i].dataset.hex === hex ? "true" : "false");
    }
    harmonyBase.textContent = hex;
    harmonyTemp.textContent = "Reads as " + window.ACColor.temperature(hex) + " by hue (rough convention).";
    while (harmonyGroups.firstChild) harmonyGroups.removeChild(harmonyGroups.firstChild);
    window.ACColor.harmonies(hex).forEach(function (group) {
      var wrap = document.createElement("div");
      wrap.className = "harmony-group";
      var heading = document.createElement("h4");
      heading.textContent = group.label;
      wrap.appendChild(heading);
      var row = document.createElement("div");
      row.className = "harmony-row";
      group.colors.forEach(function (c) {
        var item = document.createElement("span");
        item.className = "mini-swatch";
        var chip = document.createElement("span");
        chip.className = "mini-chip";
        chip.style.backgroundColor = c;
        item.appendChild(chip);
        item.appendChild(document.createTextNode(c));
        row.appendChild(item);
      });
      wrap.appendChild(row);
      harmonyGroups.appendChild(wrap);
    });
    harmoniesBox.hidden = false;
    renderAlbers();
  }

  // Downsampled pixels plus palette under the current white balance.
  // Returns { data, w, h, quad, palette, wb, cal } or { error }.
  function samplePixels() {
    if (!hasImage || !artwork.naturalWidth) {
      return { error: "Add a photo first, then sample its palette." };
    }
    var quad = orderedCorners();
    var scale = Math.min(1, 96 / Math.max(artwork.naturalWidth, artwork.naturalHeight));
    var w = Math.max(1, Math.round(artwork.naturalWidth * scale));
    var h = Math.max(1, Math.round(artwork.naturalHeight * scale));
    var canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(artwork, 0, 0, w, h);
    var data;
    try {
      data = canvas.getContext("2d").getImageData(0, 0, w, h).data;
    } catch (err) {
      return { error: "This browser blocked pixel sampling for that image." };
    }
    var wb = null;
    var cal = null;
    var correct = null;
    if (wbMethod.value === "manual3") {
      if (calPoints.black && calPoints.grey && calPoints.white) {
        cal = window.ACColor.computeCalibration(data, w, h, calPoints);
      }
      if (cal) {
        correct = function (r, g, b) {
          return window.ACColor.applyCalibrationToPixel(r, g, b, cal);
        };
      }
    } else if (wbMethod.value !== "off") {
      wb = window.ACColor.computeGains(data, w, h, quad, wbMethod.value, neutralPoint);
      if (wb) {
        correct = function (r, g, b) {
          return window.ACColor.applyGainsToPixel(r, g, b, wb.gains);
        };
      }
    }
    var palette = window.ACColor.extractPalette(data, w, h, quad, 6, correct);
    if (!palette.length) {
      return { error: "No usable pixels found. Mark the corners inside the photo and try again." };
    }
    return { data: data, w: w, h: h, quad: quad, palette: palette, wb: wb, cal: cal };
  }

  function samplePalette() {
    var s = samplePixels();
    if (s.error) {
      colorStatus.textContent = s.error;
      return;
    }
    var palette = s.palette;
    renderWb(s.wb, s.cal);
    lastPalette = palette;
    while (paletteBox.firstChild) paletteBox.removeChild(paletteBox.firstChild);
    palette.forEach(function (c) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "swatch";
      button.dataset.hex = c.hex;
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-label", "Show harmonies of " + c.hex);
      var chip = document.createElement("span");
      chip.className = "swatch-chip";
      chip.style.backgroundColor = c.hex;
      var label = document.createElement("span");
      label.className = "swatch-label";
      label.textContent = c.hex + " · " + Math.round(c.coverage * 100) + "%";
      button.appendChild(chip);
      button.appendChild(label);
      button.addEventListener("click", function () {
        showHarmonies(c.hex);
      });
      paletteBox.appendChild(button);
    });
    paletteBox.hidden = false;
    colorStatus.textContent = quad
      ? "Palette sampled inside your marked corners. Pick a color for its harmonies."
      : "Palette sampled from the whole photo (no corners marked yet). Pick a color for its harmonies.";
    showHarmonies(palette[0].hex);
  }

  sampleButton.addEventListener("click", samplePalette);

  wbMethod.addEventListener("change", function () {
    updateWbVisibility();
    if (wbMethod.value !== "manual" && pickingNeutral) setPicking(false);
    if (wbMethod.value !== "manual3" && pickingSlot) setPickingSlot(null);
    saveState();
    if (hasImage) samplePalette();
    else renderWb(null, null);
    render();
  });

  pickNeutral.addEventListener("click", function () {
    if (!hasImage) {
      wbStatus.textContent = "Add a photo first, then pick a neutral point in it.";
      return;
    }
    setPicking(!pickingNeutral);
  });

  ["black", "grey", "white"].forEach(function (slot) {
    pickButtons[slot].addEventListener("click", function () {
      if (!hasImage) {
        wbStatus.textContent = "Add a photo first, then pick " + slot + " reference points in it.";
        return;
      }
      setPickingSlot(pickingSlot === slot ? null : slot);
    });
  });

  // Rectified artwork plus a copy with the selected guide drawn on.
  // Guide polylines come from artwork space, which the rectified image is.
  function buildAnalysisImages(ordered, aspect) {
    var scale = Math.min(1, 1600 / Math.max(artwork.naturalWidth, artwork.naturalHeight));
    var sw = Math.max(1, Math.round(artwork.naturalWidth * scale));
    var sh = Math.max(1, Math.round(artwork.naturalHeight * scale));
    var src = document.createElement("canvas");
    src.width = sw;
    src.height = sh;
    src.getContext("2d").drawImage(artwork, 0, 0, sw, sh);
    var srcData = src.getContext("2d").getImageData(0, 0, sw, sh).data;
    var outW;
    var outH;
    if (aspect >= 1) {
      outW = 512;
      outH = Math.max(1, Math.round(512 / aspect));
    } else {
      outH = 512;
      outW = Math.max(1, Math.round(512 * aspect));
    }
    var flat = window.ACRectify.rectify(srcData, sw, sh, ordered, outW, outH);
    var art = document.createElement("canvas");
    art.width = outW;
    art.height = outH;
    art.getContext("2d").putImageData(new ImageData(flat.data, outW, outH), 0, 0);
    var over = document.createElement("canvas");
    over.width = outW;
    over.height = outH;
    var ctx = over.getContext("2d");
    ctx.drawImage(art, 0, 0);
    ctx.strokeStyle = "#ffb000";
    ctx.lineWidth = Math.max(1, Math.round(outW / 256));
    ctx.setLineDash([7, 5]);
    window.ACGuide.traceUv(currentGuide, aspect).forEach(function (poly) {
      ctx.beginPath();
      poly.forEach(function (p, i) {
        if (i === 0) ctx.moveTo(p.x * outW, p.y * outH);
        else ctx.lineTo(p.x * outW, p.y * outH);
      });
      ctx.stroke();
    });
    ctx.setLineDash([]);
    ctx.strokeRect(1, 1, outW - 2, outH - 2);
    return {
      art: art.toDataURL("image/jpeg", 0.85),
      overlay: over.toDataURL("image/jpeg", 0.85),
      width: outW,
      height: outH
    };
  }

  function fillList(el, items) {
    while (el.firstChild) el.removeChild(el.firstChild);
    items.forEach(function (text) {
      var li = document.createElement("li");
      li.textContent = text;
      el.appendChild(li);
    });
  }

  // Everything an AI request needs from the canvas: rectified images, the
  // sampled palette and the notes that describe them. Shared by critique
  // (app.js) and the automatic overview (overview.js).
  function prepareAnalysisInputs() {
    if (!hasImage) return { error: "Add a photo first." };
    var ordered = orderedCorners();
    if (!ordered) return { error: "Mark the four corners first; analysis runs on the rectified artwork." };
    var sampled = samplePixels();
    if (sampled.error) return { error: sampled.error };
    var resolved = resolveAspect(ordered);
    var aspect = resolved.aspect === null ? quadAspect(ordered) : resolved.aspect;
    var imgs;
    try {
      imgs = buildAnalysisImages(ordered, aspect);
    } catch (err) {
      return { error: "Could not rectify the artwork. Check the corners and try again." };
    }
    var guide = guideById(currentGuide);
    var wbNote = "";
    if (sampled.cal) wbNote = "3-point calibration applied";
    else if (sampled.wb) {
      wbNote = WB_METHOD_LABELS[wbMethod.value] + " gains R" +
        sampled.wb.gains.r.toFixed(2) + " G" + sampled.wb.gains.g.toFixed(2) +
        " B" + sampled.wb.gains.b.toFixed(2);
    }
    return {
      imgs: imgs,
      palette: sampled.palette.map(function (c) {
        return { hex: c.hex, coverage: Math.round(c.coverage * 1000) / 1000 };
      }),
      wbNote: wbNote,
      formatNote: resolved.label,
      guide: guide ? { id: guide.id, name: guide.name } : null,
      intent: intentInput.value,
      medium: mediumSelect.value,
      topic: topicSelect.value
    };
  }

  function analyzeArtwork() {
    critiqueResult.hidden = true;
    critiqueSetup.hidden = true;
    stopReading();
    lastFeedback = null;
    if (!hasImage) {
      critiqueStatus.textContent = "Add a photo first.";
      return;
    }
    if (!orderedCorners()) {
      critiqueStatus.textContent = "Mark the four corners first; analysis runs on the rectified artwork.";
      return;
    }
    analyzeButton.disabled = true;
    critiqueStatus.textContent = "Preparing artwork…";
    var prep = prepareAnalysisInputs();
    if (prep.error) {
      critiqueStatus.textContent = prep.error;
      analyzeButton.disabled = false;
      return;
    }
    var imgs = prep.imgs;
    rectPreview.src = imgs.art;
    overlayPreview.src = imgs.overlay;
    critiquePreviews.hidden = false;
    critiqueContext.textContent = "Sending " + imgs.width + "x" + imgs.height +
      " rectified artwork + " + (prep.guide ? prep.guide.name : "guide") + " overlay · " +
      prep.medium + " · " + prep.topic + " · " +
      prep.palette.length + " palette colors · " + prep.formatNote +
      (prep.wbNote ? " · WB " + prep.wbNote : "");
    critiqueContext.hidden = false;
    critiqueStatus.textContent = "Asking the model…";
    var controller = null;
    if (typeof AbortController !== "undefined") {
      controller = new AbortController();
      setTimeout(function () { controller.abort(); }, 120000);
    }
    fetch("/api/critique", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: imgs.art,
        overlay: imgs.overlay,
        intent: prep.intent,
        medium: prep.medium,
        topic: prep.topic,
        guide: prep.guide,
        palette: prep.palette,
        formatNote: prep.formatNote,
        wbNote: prep.wbNote
      }),
      signal: controller ? controller.signal : undefined
    }).then(function (res) {
      return res.json().then(function (data) {
        return { status: res.status, data: data };
      });
    }).then(function (out) {
      if (out.data && out.data.ok) {
        var fb = out.data.feedback;
        lastFeedback = fb;
        fillList(critiqueStrengths, fb.strengths && fb.strengths.length ? fb.strengths : ["None stated."]);
        fillList(critiqueObservations, fb.observations && fb.observations.length ? fb.observations : ["None stated."]);
        if (fb.nextSteps && fb.nextSteps.length) {
          fillList(critiqueNext, fb.nextSteps);
          critiqueNextWrap.hidden = false;
        } else {
          critiqueNextWrap.hidden = true;
        }
        critiqueUncertainty.textContent = fb.uncertainty || "Not stated.";
        critiqueResult.hidden = false;
        critiqueStatus.textContent = "";
      } else if (out.data && out.data.code === "not_configured") {
        while (critiqueSetupSteps.firstChild) critiqueSetupSteps.removeChild(critiqueSetupSteps.firstChild);
        (out.data.setup || []).forEach(function (step) {
          var li = document.createElement("li");
          li.textContent = step;
          critiqueSetupSteps.appendChild(li);
        });
        critiqueSetup.hidden = false;
        critiqueStatus.textContent = "";
      } else {
        critiqueStatus.textContent = (out.data && out.data.message) ?
          out.data.message : "Analysis failed (HTTP " + out.status + ").";
      }
    }).catch(function (err) {
      critiqueStatus.textContent = err && err.name === "AbortError" ?
        "Analysis timed out. Try again." :
        "Analysis request failed. Is the server still running?";
    }).finally(function () {
      analyzeButton.disabled = false;
    });
  }

  analyzeButton.addEventListener("click", analyzeArtwork);

  function applySuggestion(id) {
    if (!guideById(id)) return;
    autoGuide = false;
    autoStatus.textContent = "";
    currentGuide = id;
    guideSelect.value = id;
    updateBlurb();
    saveState();
    render();
  }

  function suggestGuide() {
    while (suggestionsBox.firstChild) suggestionsBox.removeChild(suggestionsBox.firstChild);
    if (!hasImage) {
      suggestStatus.textContent = "Add a photo first.";
      return;
    }
    var ordered = orderedCorners();
    if (!ordered) {
      suggestStatus.textContent = "Mark the four corners first; suggestions run on the rectified artwork.";
      return;
    }
    suggestButton.disabled = true;
    suggestStatus.textContent = "Asking the model…";
    var sampled = samplePixels();
    if (sampled.error) {
      suggestStatus.textContent = sampled.error;
      suggestButton.disabled = false;
      return;
    }
    var resolved = resolveAspect(ordered);
    var aspect = resolved.aspect === null ? quadAspect(ordered) : resolved.aspect;
    var imgs;
    try {
      imgs = buildAnalysisImages(ordered, aspect);
    } catch (err) {
      suggestStatus.textContent = "Could not rectify the artwork. Check the corners and try again.";
      suggestButton.disabled = false;
      return;
    }
    var controller = null;
    if (typeof AbortController !== "undefined") {
      controller = new AbortController();
      setTimeout(function () { controller.abort(); }, 120000);
    }
    fetch("/api/suggest-guide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: imgs.art,
        palette: sampled.palette.map(function (c) {
          return { hex: c.hex, coverage: Math.round(c.coverage * 1000) / 1000 };
        })
      }),
      signal: controller ? controller.signal : undefined
    }).then(function (res) {
      return res.json().then(function (data) {
        return { status: res.status, data: data };
      });
    }).then(function (out) {
      if (out.data && out.data.ok) {
        var picks = out.data.suggestions || [];
        if (!picks.length) {
          suggestStatus.textContent = "The model named no usable guide. Try again or pick one yourself.";
          return;
        }
        suggestStatus.textContent = "";
        picks.forEach(function (pick) {
          if (!guideById(pick.id)) return;
          var row = document.createElement("div");
          row.className = "suggestion";
          var name = document.createElement("strong");
          name.textContent = pick.name || guideById(pick.id).name;
          var reason = document.createElement("span");
          reason.textContent = pick.reason || "";
          var apply = document.createElement("button");
          apply.type = "button";
          apply.textContent = "Apply";
          apply.setAttribute("aria-label", "Apply guide " + name.textContent);
          apply.addEventListener("click", function () {
            applySuggestion(pick.id);
          });
          row.appendChild(name);
          row.appendChild(reason);
          row.appendChild(apply);
          suggestionsBox.appendChild(row);
        });
        if (!suggestionsBox.firstChild) {
          suggestStatus.textContent = "The model named no usable guide. Try again or pick one yourself.";
        }
      } else if (out.data && out.data.code === "not_configured") {
        suggestStatus.textContent = "AI not configured — see the setup steps in section 3.";
      } else {
        suggestStatus.textContent = (out.data && out.data.message) ?
          out.data.message : "Suggestion failed (HTTP " + out.status + ").";
      }
    }).catch(function (err) {
      suggestStatus.textContent = err && err.name === "AbortError" ?
        "Suggestion timed out. Try again." :
        "Suggestion request failed. Is the server still running?";
    }).finally(function () {
      suggestButton.disabled = false;
    });
  }

  suggestButton.addEventListener("click", suggestGuide);

  function suggestDirection() {
    directionResult.hidden = true;
    directionPreview = null;
    lastDirection = null;
    generateResult.hidden = true;
    generateStatus.textContent = "";
    generateImg.removeAttribute("src");
    while (directionGuides.firstChild) directionGuides.removeChild(directionGuides.firstChild);
    while (directionSwatches.firstChild) directionSwatches.removeChild(directionSwatches.firstChild);
    if (!hasImage) {
      directionStatus.textContent = "Add a photo first.";
      return;
    }
    var ordered = orderedCorners();
    if (!ordered) {
      directionStatus.textContent = "Mark the four corners first; suggestions run on the rectified artwork.";
      return;
    }
    directionButton.disabled = true;
    directionStatus.textContent = "Asking the model…";
    var sampled = samplePixels();
    if (sampled.error) {
      directionStatus.textContent = sampled.error;
      directionButton.disabled = false;
      return;
    }
    var resolved = resolveAspect(ordered);
    var aspect = resolved.aspect === null ? quadAspect(ordered) : resolved.aspect;
    var imgs;
    try {
      imgs = buildAnalysisImages(ordered, aspect);
    } catch (err) {
      directionStatus.textContent = "Could not rectify the artwork. Check the corners and try again.";
      directionButton.disabled = false;
      return;
    }
    var controller = null;
    if (typeof AbortController !== "undefined") {
      controller = new AbortController();
      setTimeout(function () { controller.abort(); }, 120000);
    }
    fetch("/api/art-direction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: imgs.art,
        palette: sampled.palette.map(function (c) {
          return { hex: c.hex, coverage: Math.round(c.coverage * 1000) / 1000 };
        }),
        intent: intentInput.value,
        medium: mediumSelect.value
      }),
      signal: controller ? controller.signal : undefined
    }).then(function (res) {
      return res.json().then(function (data) {
        return { status: res.status, data: data };
      });
    }).then(function (out) {
      if (out.data && out.data.ok) {
        renderDirection(out.data.direction, imgs, aspect);
      } else if (out.data && out.data.code === "not_configured") {
        directionStatus.textContent = "AI not configured — see the setup steps in section 3.";
      } else {
        directionStatus.textContent = (out.data && out.data.message) ?
          out.data.message : "Direction failed (HTTP " + out.status + ").";
      }
    }).catch(function (err) {
      directionStatus.textContent = err && err.name === "AbortError" ?
        "Direction timed out. Try again." :
        "Direction request failed. Is the server still running?";
    }).finally(function () {
      directionButton.disabled = false;
    });
  }

  function renderDirection(dir, imgs, aspect) {
    directionStatus.textContent = "";
    lastDirection = dir && typeof dir === "object" ? dir : null;
    var guides = (dir && dir.guides) || [];
    if (!guides.length) {
      var none = document.createElement("p");
      none.className = "hint";
      none.textContent = "The model named no usable guide. Try again or pick one yourself.";
      directionGuides.appendChild(none);
    }
    guides.forEach(function (pick) {
      if (!guideById(pick.id)) return;
      var row = document.createElement("div");
      row.className = "suggestion";
      var name = document.createElement("strong");
      name.textContent = pick.name || guideById(pick.id).name;
      var reason = document.createElement("span");
      reason.textContent = pick.reason || "";
      var apply = document.createElement("button");
      apply.type = "button";
      apply.textContent = "Apply";
      apply.setAttribute("aria-label", "Apply guide " + name.textContent);
      apply.addEventListener("click", function () {
        applySuggestion(pick.id);
      });
      row.appendChild(name);
      row.appendChild(reason);
      row.appendChild(apply);
      directionGuides.appendChild(row);
    });
    var pal = dir && dir.palette;
    if (!pal || !pal.colors || !pal.colors.length) {
      directionPaletteReason.textContent = "The model named no usable palette. The preview below keeps the photo's own colors.";
    } else {
      directionPaletteReason.textContent = (pal.schemeLabel || pal.scheme) + " on " + pal.anchorHex +
        (pal.reason ? " — " + pal.reason : "");
      pal.colors.forEach(function (hex) {
        var sw = document.createElement("div");
        sw.className = "swatch" + (hex === pal.anchorHex ? " anchor" : "");
        var chip = document.createElement("span");
        chip.className = "swatch-chip";
        chip.style.backgroundColor = hex;
        var label = document.createElement("span");
        label.className = "swatch-label";
        label.textContent = hex === pal.anchorHex ? hex + " · anchor" : hex;
        sw.appendChild(chip);
        sw.appendChild(label);
        directionSwatches.appendChild(sw);
      });
    }
    directionSummary.textContent = (dir && dir.summary) || "No summary stated.";
    directionUncertainty.textContent = (dir && dir.uncertainty) || "Not stated.";
    directionResult.hidden = false;
    var firstGuide = guides.length && guideById(guides[0].id) ? guides[0] : null;
    var colors = pal && pal.colors && pal.colors.length ? pal.colors : null;
    var hasStrength = !!colors;
    directionStrengthLabel.hidden = !hasStrength;
    directionStrength.hidden = !hasStrength;
    if (!firstGuide && !colors) {
      directionCaption.textContent = "Nothing to preview: no usable guide or palette.";
      directionCanvas.hidden = true;
      return;
    }
    directionCanvas.hidden = false;
    var img = new Image();
    img.onload = function () {
      directionPreview = {
        img: img,
        colors: colors,
        guideId: firstGuide ? firstGuide.id : null,
        guideName: firstGuide ? (firstGuide.name || guideById(firstGuide.id).name) : null,
        aspect: aspect,
        schemeLabel: pal ? (pal.schemeLabel || pal.scheme) : null,
        shifted: null
      };
      renderDirectionPreview();
    };
    img.onerror = function () {
      directionCaption.textContent = "Could not rebuild the preview image.";
    };
    img.src = imgs.art;
  }

  function hueOf(hex) {
    var rgb = window.ACColor.hexToRgb(hex);
    return window.ACColor.rgbToHsl(rgb.r, rgb.g, rgb.b).h;
  }

  function nearestHue(h, hues) {
    var best = hues[0];
    var bestD = 360;
    for (var i = 0; i < hues.length; i++) {
      var d = Math.abs(h - hues[i]) % 360;
      if (d > 180) d = 360 - d;
      if (d < bestD) {
        bestD = d;
        best = hues[i];
      }
    }
    return best;
  }

  // Local suggestion preview: each pixel keeps its saturation and lightness
  // but takes the nearest suggested hue; near-gray pixels stay untouched.
  // The photo itself is never modified.
  function renderDirectionPreview() {
    var pv = directionPreview;
    if (!pv || !pv.img) return;
    var w = pv.img.naturalWidth;
    var h = pv.img.naturalHeight;
    if (!w || !h) return;
    directionCanvas.width = w;
    directionCanvas.height = h;
    var ctx = directionCanvas.getContext("2d");
    ctx.drawImage(pv.img, 0, 0);
    var base;
    try {
      base = ctx.getImageData(0, 0, w, h);
    } catch (err) {
      directionCaption.textContent = "This browser blocked preview rendering for that image.";
      return;
    }
    var hues = [];
    if (pv.colors) {
      pv.colors.forEach(function (hex) {
        try {
          hues.push(hueOf(hex));
        } catch (ignored) {
          // Drop unusable entries; the server normally sends valid hexes.
        }
      });
    }
    var strength = Math.max(0, Math.min(1, Number(directionStrength.value) / 100));
    var out = ctx.createImageData(w, h);
    if (hues.length) {
      if (!pv.shifted || pv.shifted.width !== w || pv.shifted.height !== h) {
        var shifted = ctx.createImageData(w, h);
        var d = base.data;
        var s = shifted.data;
        for (var i = 0; i < d.length; i += 4) {
          var hsl = window.ACColor.rgbToHsl(d[i], d[i + 1], d[i + 2]);
          if (hsl.s < 0.12) {
            s[i] = d[i];
            s[i + 1] = d[i + 1];
            s[i + 2] = d[i + 2];
          } else {
            var rgb = window.ACColor.hslToRgb(nearestHue(hsl.h, hues), hsl.s, hsl.l);
            s[i] = rgb.r;
            s[i + 1] = rgb.g;
            s[i + 2] = rgb.b;
          }
          s[i + 3] = d[i + 3];
        }
        pv.shifted = shifted;
      }
      var o = out.data;
      var b = base.data;
      var f = pv.shifted.data;
      for (var j = 0; j < o.length; j += 4) {
        o[j] = Math.round(b[j] + (f[j] - b[j]) * strength);
        o[j + 1] = Math.round(b[j + 1] + (f[j + 1] - b[j + 1]) * strength);
        o[j + 2] = Math.round(b[j + 2] + (f[j + 2] - b[j + 2]) * strength);
        o[j + 3] = b[j + 3];
      }
    } else {
      out.data.set(base.data);
    }
    ctx.putImageData(out, 0, 0);
    if (pv.guideId && directionGuideToggle.checked) {
      ctx.strokeStyle = "#ffb000";
      ctx.lineWidth = Math.max(1, Math.round(w / 256));
      ctx.setLineDash([7, 5]);
      window.ACGuide.traceUv(pv.guideId, pv.aspect).forEach(function (poly) {
        ctx.beginPath();
        poly.forEach(function (p, k) {
          if (k === 0) ctx.moveTo(p.x * w, p.y * h);
          else ctx.lineTo(p.x * w, p.y * h);
        });
        ctx.stroke();
      });
      ctx.setLineDash([]);
      ctx.strokeRect(1, 1, w - 2, h - 2);
    }
    var parts = [];
    if (hues.length) parts.push(pv.schemeLabel + " hue study at " + Math.round(strength * 100) + "%");
    if (pv.guideName && directionGuideToggle.checked) parts.push("with " + pv.guideName);
    else if (pv.guideName) parts.push(pv.guideName + " hidden");
    directionCaption.textContent = parts.join(" · ") || "Preview";
  }

  directionButton.addEventListener("click", suggestDirection);

  directionStrength.addEventListener("input", function () {
    directionStrengthValue.textContent = directionStrength.value + "%";
    renderDirectionPreview();
  });

  directionGuideToggle.addEventListener("change", function () {
    renderDirectionPreview();
  });

  directionDismiss.addEventListener("click", function () {
    directionResult.hidden = true;
    directionPreview = null;
    lastDirection = null;
    directionStatus.textContent = "";
    generateResult.hidden = true;
    generateStatus.textContent = "";
    generateImg.removeAttribute("src");
  });

  function generateWhyText(dir) {
    var bits = [];
    if (dir && dir.summary) bits.push(dir.summary);
    var pal = dir && dir.palette;
    if (pal && pal.colors && pal.colors.length) {
      bits.push("Palette: " + (pal.schemeLabel || pal.scheme || "suggested") +
        " on " + pal.anchorHex + " (" + pal.colors.join(", ") + ").");
    }
    var guides = dir && dir.guides ? dir.guides : [];
    var names = guides.map(function (g) {
      return g.name || (guideById(g.id) ? guideById(g.id).name : g.id);
    }).filter(Boolean);
    if (names.length) bits.push("Guides honored: " + names.join(", ") + ".");
    if (!bits.length) return "Painted from your sampled palette and intent; no usable direction was named.";
    return bits.join(" ");
  }

  function generateVersion() {
    generateResult.hidden = true;
    generateImg.removeAttribute("src");
    generateRevised.hidden = true;
    if (!lastDirection) {
      directionStatus.textContent = "Run Suggest art direction first, then generate a version.";
      return;
    }
    if (!hasImage) {
      generateStatus.textContent = "Add a photo first.";
      return;
    }
    var ordered = orderedCorners();
    if (!ordered) {
      generateStatus.textContent = "Mark the four corners first; the study repaints the rectified artwork.";
      return;
    }
    generateButton.disabled = true;
    generateStatus.textContent = "Painting a study from your direction…";
    var sampled = samplePixels();
    if (sampled.error) {
      generateStatus.textContent = sampled.error;
      generateButton.disabled = false;
      return;
    }
    var resolved = resolveAspect(ordered);
    var aspect = resolved.aspect === null ? quadAspect(ordered) : resolved.aspect;
    var imgs;
    try {
      imgs = buildAnalysisImages(ordered, aspect);
    } catch (err) {
      generateStatus.textContent = "Could not rectify the artwork. Check the corners and try again.";
      generateButton.disabled = false;
      return;
    }
    var dims = aspect >= 1 ?
      { w: 1024, h: Math.max(64, Math.round(1024 / aspect)) } :
      { w: Math.max(64, Math.round(1024 * aspect)), h: 1024 };
    var controller = null;
    if (typeof AbortController !== "undefined") {
      controller = new AbortController();
      setTimeout(function () { controller.abort(); }, 200000);
    }
    fetch("/api/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: imgs.art,
        palette: sampled.palette.map(function (c) {
          return { hex: c.hex, coverage: Math.round(c.coverage * 1000) / 1000 };
        }),
        intent: intentInput.value,
        medium: mediumSelect.value,
        aspectW: dims.w,
        aspectH: dims.h,
        direction: lastDirection
      }),
      signal: controller ? controller.signal : undefined
    }).then(function (res) {
      return res.json().then(function (data) {
        return { status: res.status, data: data };
      });
    }).then(function (out) {
      if (out.data && out.data.ok) {
        generateStatus.textContent = "";
        generateImg.src = out.data.image;
        generateWhy.textContent = generateWhyText(lastDirection);
        if (out.data.revisedPrompt) {
          generateRevised.textContent = "The image model restated the brief as: " + out.data.revisedPrompt;
          generateRevised.hidden = false;
        }
        generatePrompt.textContent = out.data.prompt || "";
        generateResult.hidden = false;
      } else if (out.data && out.data.code === "not_configured") {
        generateStatus.textContent = "AI not configured — see the setup steps in section 3.";
      } else {
        generateStatus.textContent = (out.data && out.data.message) ?
          out.data.message : "Generation failed (HTTP " + out.status + ").";
      }
    }).catch(function (err) {
      generateStatus.textContent = err && err.name === "AbortError" ?
        "Generation timed out. Try again." :
        "Generation request failed. Is the server still running?";
    }).finally(function () {
      generateButton.disabled = false;
    });
  }

  generateButton.addEventListener("click", generateVersion);

  generateDismiss.addEventListener("click", function () {
    generateResult.hidden = true;
    generateStatus.textContent = "";
    generateImg.removeAttribute("src");
  });

  var CHAT_MAX_TURNS = 20; // transcript cap; the server keeps fewer per request

  function appendChat(role, text) {
    chatHistory.push({ role: role, content: text });
    while (chatHistory.length > CHAT_MAX_TURNS) chatHistory.shift();
    var li = document.createElement("li");
    li.className = role === "user" ? "chat-user" : "chat-ai";
    var who = document.createElement("strong");
    who.textContent = role === "user" ? "You: " : "AI: ";
    li.appendChild(who);
    li.appendChild(document.createTextNode(text));
    chatLog.appendChild(li);
    while (chatLog.children.length > CHAT_MAX_TURNS) chatLog.removeChild(chatLog.firstChild);
    chatLog.hidden = false;
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function stopChat() {
    if (chatRec) {
      chatRec.stop();
      chatRec = null;
    }
    chatTalk.textContent = "Talk";
    window.ACVoice.stopSpeaking();
    if (chatController) {
      chatController.abort();
      chatController = null;
    }
    chatBusy = false;
    chatTalk.disabled = false;
    chatSend.disabled = false;
  }

  // One conversation turn: the artwork stays current (corners may have
  // moved), history travels with it. Returns true when a request went out.
  function sendChatTurn(raw) {
    var text = String(raw || "").trim().slice(0, 500);
    if (!text || chatBusy) return false;
    var ordered = orderedCorners();
    if (!ordered) {
      chatStatus.textContent = "Mark the four corners first; conversation runs on the rectified artwork.";
      return false;
    }
    var sampled = samplePixels();
    if (sampled.error) {
      chatStatus.textContent = sampled.error;
      return false;
    }
    var resolved = resolveAspect(ordered);
    var aspect = resolved.aspect === null ? quadAspect(ordered) : resolved.aspect;
    var imgs;
    try {
      imgs = buildAnalysisImages(ordered, aspect);
    } catch (err) {
      chatStatus.textContent = "Could not rectify the artwork. Check the corners and try again.";
      return false;
    }
    appendChat("user", text);
    chatBusy = true;
    chatTalk.disabled = true;
    chatSend.disabled = true;
    chatStatus.textContent = "Asking the model…";
    if (typeof AbortController !== "undefined") {
      chatController = new AbortController();
      setTimeout(function () {
        if (chatController) chatController.abort();
      }, 120000);
    }
    fetch("/api/art-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: imgs.art,
        palette: sampled.palette.map(function (c) {
          return { hex: c.hex, coverage: Math.round(c.coverage * 1000) / 1000 };
        }),
        intent: intentInput.value,
        medium: mediumSelect.value,
        history: chatHistory
      }),
      signal: chatController ? chatController.signal : undefined
    }).then(function (res) {
      return res.json().then(function (data) {
        return { status: res.status, data: data };
      });
    }).then(function (out) {
      if (out.data && out.data.ok) {
        appendChat("assistant", out.data.reply);
        chatStatus.textContent = "";
        if (chatSpeakToggle.checked) {
          var ok = window.ACVoice.speak(out.data.reply, { onEnd: function () { /* transcript keeps the reply */ } });
          if (!ok) chatStatus.textContent = "Reply shown below; read-aloud is not available in this browser.";
        }
      } else if (out.data && out.data.code === "not_configured") {
        chatStatus.textContent = "AI not configured — see the setup steps in section 3.";
      } else {
        chatStatus.textContent = (out.data && out.data.message) ?
          out.data.message : "Chat failed (HTTP " + out.status + ").";
      }
    }).catch(function (err) {
      chatStatus.textContent = err && err.name === "AbortError" ?
        "Chat stopped." :
        "Chat request failed. Is the server still running?";
    }).finally(function () {
      chatBusy = false;
      chatController = null;
      chatTalk.disabled = false;
      chatSend.disabled = false;
    });
    return true;
  }

  chatTalk.addEventListener("click", function () {
    if (chatRec) {
      chatRec.stop();
      chatRec = null;
      chatTalk.textContent = "Talk";
      chatStatus.textContent = "";
      return;
    }
    if (chatBusy) return;
    if (!hasImage) {
      chatStatus.textContent = "Add a photo first.";
      return;
    }
    if (!orderedCorners()) {
      chatStatus.textContent = "Mark the four corners first; conversation runs on the rectified artwork.";
      return;
    }
    if (controlOn) setControl(false);
    if (dictateRec) setDictating(false);
    stopReading();
    window.ACVoice.stopSpeaking();
    chatRec = window.ACVoice.createRecognizer({ continuous: false, interim: true }, {
      onFinal: function (text) {
        sendChatTurn(text);
      },
      onInterim: function (text) {
        chatStatus.textContent = "Hearing: " + text;
      },
      onError: function (kind) {
        chatRec = null;
        chatTalk.textContent = "Talk";
        if (kind === "not-allowed" || kind === "service-not-allowed") {
          chatStatus.textContent = "Microphone blocked. Allow access, type instead, or check the HTTPS address on iPhone.";
        } else if (kind !== "no-speech") {
          chatStatus.textContent = "Listening failed (" + kind + "). Try again or type instead.";
        } else {
          chatStatus.textContent = "";
        }
      },
      onEnd: function () {
        chatRec = null;
        chatTalk.textContent = "Talk";
        if (chatStatus.textContent.indexOf("Hearing:") === 0) chatStatus.textContent = "";
      }
    });
    if (!chatRec) {
      chatStatus.textContent = "Voice input is not available in this browser. Type instead.";
      return;
    }
    chatTalk.textContent = "Stop";
    chatStatus.textContent = "Listening…";
    chatRec.start();
  });

  chatStop.addEventListener("click", function () {
    stopChat();
    chatStatus.textContent = "";
  });

  function sendTypedChat() {
    if (sendChatTurn(chatInput.value)) chatInput.value = "";
  }

  chatSend.addEventListener("click", sendTypedChat);

  chatInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") sendTypedChat();
  });

  chatClear.addEventListener("click", function () {
    stopChat();
    chatHistory = [];
    while (chatLog.firstChild) chatLog.removeChild(chatLog.firstChild);
    chatLog.hidden = true;
    chatStatus.textContent = "";
  });

  var annotateP5 = null; // p5 instance drawing the marks overlay

  var ANNOTATE_KIND_LABELS = {
    mass: "Center of mass",
    heavy: "Heavy area",
    light: "Light area",
    shift: "Suggested shift",
    focal: "Focal point",
    accent: "Accent spot"
  };

  function annotateKindLabel(kind) {
    return ANNOTATE_KIND_LABELS[kind] || kind;
  }

  function drawArrowHead(sk, px, py, qx, qy, color) {
    var angle = Math.atan2(qy - py, qx - px);
    var size = 10;
    sk.stroke(color);
    sk.strokeWeight(3);
    [angle + Math.PI - 0.45, angle + Math.PI + 0.45].forEach(function (a) {
      sk.line(qx, qy, qx + Math.cos(a) * size, qy + Math.sin(a) * size);
    });
  }

  function drawBadge(sk, px, py, n, maroon) {
    var bx = Math.min(sk.width - 12, Math.max(12, px + 14));
    var by = Math.min(sk.height - 12, Math.max(12, py - 16));
    sk.noStroke();
    sk.fill(maroon);
    sk.rectMode(sk.CENTER);
    sk.rect(bx, by, 20, 20, 6);
    sk.fill(255);
    sk.textAlign(sk.CENTER, sk.CENTER);
    sk.textSize(12);
    sk.text(String(n), bx, by + 1);
    sk.rectMode(sk.CORNER);
  }

  function drawMarkLabel(sk, px, py, label, maroon) {
    if (!label) return;
    label = label.length > 28 ? label.slice(0, 28) + "…" : label;
    sk.textSize(12);
    var bx = Math.min(sk.width - 12, Math.max(12, px + 14));
    var by = Math.min(sk.height - 12, Math.max(12, py - 16));
    sk.fill(255);
    sk.stroke(maroon);
    sk.strokeWeight(3);
    if (bx + 28 + sk.textWidth(label) <= sk.width) {
      sk.textAlign(sk.LEFT, sk.CENTER);
      sk.text(label, bx + 28, by);
    } else {
      sk.textAlign(sk.RIGHT, sk.CENTER);
      sk.text(label, bx - 28, by);
    }
    sk.noStroke();
  }

  // One mark glyph per kind, each with a white halo pass so it reads on
  // any artwork. Coordinates arrive as 0-1 artwork fractions.
  function drawAnnotateMarks(sk, annotations) {
    var maroon = sk.color(163, 19, 79);
    var lime = sk.color(215, 247, 91);
    annotations.forEach(function (a, i) {
      var px = a.x * sk.width;
      var py = a.y * sk.height;
      if (a.kind === "shift" && a.x2 !== null && a.y2 !== null) {
        var qx = a.x2 * sk.width;
        var qy = a.y2 * sk.height;
        sk.stroke(255);
        sk.strokeWeight(5);
        sk.line(px, py, qx, qy);
        sk.stroke(maroon);
        sk.strokeWeight(2);
        sk.line(px, py, qx, qy);
        drawArrowHead(sk, px, py, qx, qy, maroon);
      } else if (a.kind === "focal") {
        sk.noFill();
        sk.stroke(255);
        sk.strokeWeight(5);
        sk.drawingContext.setLineDash([7, 5]);
        sk.circle(px, py, 36);
        sk.stroke(maroon);
        sk.strokeWeight(2);
        sk.circle(px, py, 36);
        sk.drawingContext.setLineDash([]);
        sk.noStroke();
        sk.fill(maroon);
        sk.circle(px, py, 6);
      } else if (a.kind === "accent") {
        sk.stroke(255);
        sk.strokeWeight(7);
        sk.line(px - 11, py, px + 11, py);
        sk.line(px, py - 11, px, py + 11);
        sk.stroke(maroon);
        sk.strokeWeight(4);
        sk.line(px - 11, py, px + 11, py);
        sk.line(px, py - 11, px, py + 11);
        sk.noStroke();
        sk.fill(lime);
        sk.circle(px, py, 7);
      } else if (a.kind === "heavy" || a.kind === "light") {
        var s = 11;
        function tri(strokeColor, weight, fillColor) {
          sk.stroke(strokeColor);
          sk.strokeWeight(weight);
          if (fillColor === null) sk.noFill();
          else sk.fill(fillColor);
          if (a.kind === "heavy") sk.triangle(px - s, py - s, px + s, py - s, px, py + s);
          else sk.triangle(px - s, py + s, px + s, py + s, px, py - s);
        }
        tri(sk.color(255), 5, sk.color(255));
        tri(maroon, 2, a.kind === "heavy" ? maroon : null);
      } else {
        sk.noFill();
        sk.stroke(255);
        sk.strokeWeight(5);
        sk.circle(px, py, 26);
        sk.line(px - 16, py, px + 16, py);
        sk.line(px, py - 16, px, py + 16);
        sk.stroke(maroon);
        sk.strokeWeight(2);
        sk.circle(px, py, 26);
        sk.line(px - 16, py, px + 16, py);
        sk.line(px, py - 16, px, py + 16);
      }
      drawBadge(sk, px, py, i + 1, maroon);
      drawMarkLabel(sk, px, py, a.label, maroon);
    });
  }

  function hitAnnotation(annotations, fx, fy) {
    for (var i = annotations.length - 1; i >= 0; i--) {
      var a = annotations[i];
      var pts = [[a.x, a.y]];
      if (a.x2 !== null && a.y2 !== null) pts.push([a.x2, a.y2]);
      for (var k = 0; k < pts.length; k++) {
        var dx = pts[k][0] - fx;
        var dy = pts[k][1] - fy;
        if (Math.sqrt(dx * dx + dy * dy) < 0.045) return { i: i, a: a };
      }
    }
    return null;
  }

  function renderAnnotations(marks, imgs) {
    if (annotateP5) {
      annotateP5.remove();
      annotateP5 = null;
    }
    while (annotateList.firstChild) annotateList.removeChild(annotateList.firstChild);
    annotateFocus.textContent = "";
    var annotations = (marks && marks.annotations) || [];
    if (!annotations.length) {
      var none = document.createElement("li");
      none.textContent = "The model named no usable marks. Try again.";
      annotateList.appendChild(none);
    }
    annotations.forEach(function (a, i) {
      var li = document.createElement("li");
      var lead = document.createElement("strong");
      lead.textContent = "#" + (i + 1) + " " + annotateKindLabel(a.kind) +
        (a.label ? " — " + a.label : "") + ": ";
      li.appendChild(lead);
      li.appendChild(document.createTextNode(a.reason || ""));
      annotateList.appendChild(li);
    });
    annotateSummary.textContent = (marks && marks.summary) || "No summary stated.";
    annotateResult.hidden = false;
    if (!window.p5) {
      annotateStatus.textContent = "The drawing library did not load — the mark list above still applies.";
      return;
    }
    if (!annotations.length) return;
    annotateP5 = mountMarkSketch(annotateWrap, imgs.art, annotations, function () {
      return annotateOverlay.checked;
    }, function (hit) {
      annotateFocus.textContent = "#" + (hit.i + 1) + " " +
        (hit.a.label || annotateKindLabel(hit.a.kind)) + " — " + hit.a.reason;
    });
  }

  // Draws the rectified artwork with marks into host; tap/click reports the
  // nearest mark through onPick. Returns the p5 instance (call remove()).
  function mountMarkSketch(host, artSrc, annotations, showMarks, onPick) {
    if (!window.p5) return null;
    return new window.p5(function (sk) {
      var img = null;
      sk.preload = function () {
        img = sk.loadImage(artSrc);
      };
      sk.setup = function () {
        var w = Math.max(260, Math.min(host.clientWidth || 512, 560));
        sk.createCanvas(w, Math.round(w * img.height / img.width));
        sk.noLoop();
      };
      sk.draw = function () {
        sk.image(img, 0, 0, sk.width, sk.height);
        if (showMarks()) drawAnnotateMarks(sk, annotations);
      };
      sk.mousePressed = function () {
        if (sk.mouseX < 0 || sk.mouseY < 0 || sk.mouseX > sk.width || sk.mouseY > sk.height) return;
        var hit = hitAnnotation(annotations, sk.mouseX / sk.width, sk.mouseY / sk.height);
        if (hit && onPick) onPick(hit);
      };
    }, host);
  }

  function suggestAnnotations() {
    annotateResult.hidden = true;
    if (annotateP5) {
      annotateP5.remove();
      annotateP5 = null;
    }
    while (annotateList.firstChild) annotateList.removeChild(annotateList.firstChild);
    annotateFocus.textContent = "";
    if (!hasImage) {
      annotateStatus.textContent = "Add a photo first.";
      return;
    }
    var ordered = orderedCorners();
    if (!ordered) {
      annotateStatus.textContent = "Mark the four corners first; marks are placed on the rectified artwork.";
      return;
    }
    annotateButton.disabled = true;
    annotateStatus.textContent = "Asking the model…";
    var sampled = samplePixels();
    if (sampled.error) {
      annotateStatus.textContent = sampled.error;
      annotateButton.disabled = false;
      return;
    }
    var resolved = resolveAspect(ordered);
    var aspect = resolved.aspect === null ? quadAspect(ordered) : resolved.aspect;
    var imgs;
    try {
      imgs = buildAnalysisImages(ordered, aspect);
    } catch (err) {
      annotateStatus.textContent = "Could not rectify the artwork. Check the corners and try again.";
      annotateButton.disabled = false;
      return;
    }
    var controller = null;
    if (typeof AbortController !== "undefined") {
      controller = new AbortController();
      setTimeout(function () { controller.abort(); }, 120000);
    }
    fetch("/api/suggest-annotations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: imgs.art,
        palette: sampled.palette.map(function (c) {
          return { hex: c.hex, coverage: Math.round(c.coverage * 1000) / 1000 };
        }),
        intent: intentInput.value,
        medium: mediumSelect.value
      }),
      signal: controller ? controller.signal : undefined
    }).then(function (res) {
      return res.json().then(function (data) {
        return { status: res.status, data: data };
      });
    }).then(function (out) {
      if (out.data && out.data.ok) {
        annotateStatus.textContent = "";
        renderAnnotations(out.data.marks, imgs);
      } else if (out.data && out.data.code === "not_configured") {
        annotateStatus.textContent = "AI not configured — see the setup steps in section 3.";
      } else {
        annotateStatus.textContent = (out.data && out.data.message) ?
          out.data.message : "Annotation failed (HTTP " + out.status + ").";
      }
    }).catch(function (err) {
      annotateStatus.textContent = err && err.name === "AbortError" ?
        "Annotation timed out. Try again." :
        "Annotation request failed. Is the server still running?";
    }).finally(function () {
      annotateButton.disabled = false;
    });
  }

  annotateButton.addEventListener("click", suggestAnnotations);

  annotateOverlay.addEventListener("change", function () {
    if (annotateP5) annotateP5.redraw();
  });

  annotateDismiss.addEventListener("click", function () {
    if (annotateP5) {
      annotateP5.remove();
      annotateP5 = null;
    }
    annotateResult.hidden = true;
    annotateStatus.textContent = "";
    annotateFocus.textContent = "";
  });

  function setDictating(on) {
    dictateButton.textContent = on ? "Stop" : "Dictate";
    if (!on && dictateRec) {
      dictateRec.stop();
      dictateRec = null;
    }
  }

  dictateButton.addEventListener("click", function () {
    if (dictateRec) {
      setDictating(false);
      dictateStatus.textContent = "";
      return;
    }
    if (controlOn) setControl(false);
    dictateRec = window.ACVoice.createRecognizer({ continuous: false, interim: true }, {
      onFinal: function (text) {
        intentInput.value = (intentInput.value ?
          intentInput.value.replace(/\s+$/, "") + " " : "") + text.trim();
        saveState();
      },
      onInterim: function (text) {
        dictateStatus.textContent = "Hearing: " + text;
      },
      onError: function (kind) {
        dictateRec = null;
        dictateButton.textContent = "Dictate";
        if (kind === "not-allowed" || kind === "service-not-allowed") {
          dictateStatus.textContent = "Microphone blocked. Allow access, or type instead.";
        } else if (kind !== "no-speech") {
          dictateStatus.textContent = "Dictation failed (" + kind + "). Try again or type instead.";
        } else {
          dictateStatus.textContent = "";
        }
      },
      onEnd: function () {
        dictateRec = null;
        dictateButton.textContent = "Dictate";
        if (dictateStatus.textContent.indexOf("Hearing:") === 0) dictateStatus.textContent = "";
      }
    });
    if (!dictateRec) {
      dictateStatus.textContent = "Voice input is not available in this browser.";
      return;
    }
    dictateButton.textContent = "Stop";
    dictateStatus.textContent = "Listening…";
    dictateRec.start();
  });

  function setControl(on) {
    controlOn = on;
    voiceToggle.textContent = on ? "Voice control: on" : "Voice control: off";
    voiceToggle.setAttribute("aria-pressed", on ? "true" : "false");
    if (!on && controlRec) {
      controlRec.stop();
      controlRec = null;
    }
    if (!on) voiceHeard.textContent = "";
  }

  function stepGuide(dir) {
    var guides = window.ACGuide.GUIDES;
    var idx = 0;
    guides.forEach(function (g, i) {
      if (g.id === currentGuide) idx = i;
    });
    var next = guides[(idx + dir + guides.length) % guides.length];
    autoGuide = false;
    autoStatus.textContent = "";
    currentGuide = next.id;
    guideSelect.value = next.id;
    updateBlurb();
    saveState();
    render();
  }

  function stopAllVoice() {
    setControl(false);
    setDictating(false);
    stopReading();
    stopChat();
    voiceHeard.textContent = "";
  }

  function dispatchVoiceCommand(text) {
    var cmd = window.ACVoice.parseCommand(text);
    if (!cmd) {
      voiceHeard.textContent = "Heard \"" + text + "\" — no matching command.";
      return;
    }
    voiceHeard.textContent = "Heard \"" + text + "\".";
    if (cmd.action === "stop") stopAllVoice();
    else if (cmd.action === "suggest") suggestButton.click();
    else if (cmd.action === "analyze") analyzeButton.click();
    else if (cmd.action === "sample") sampleButton.click();
    else if (cmd.action === "nextGuide") stepGuide(1);
    else if (cmd.action === "prevGuide") stepGuide(-1);
    else if (cmd.action === "readAloud") readFeedbackAloud();
    else if (cmd.action === "chat") chatTalk.click();
    else if (cmd.action === "generate") generateButton.click();
    else if (cmd.action === "help") {
      voiceCommands.open = true;
      window.ACVoice.speak("You can say: suggest a guide, analyze, sample palette, next guide, previous guide, read feedback, chat, generate a version, or stop.");
    }
  }

  voiceToggle.addEventListener("click", function () {
    if (controlOn) {
      setControl(false);
      return;
    }
    if (dictateRec) setDictating(false);
    controlRec = window.ACVoice.createRecognizer({ continuous: true, interim: false }, {
      onFinal: dispatchVoiceCommand,
      onError: function (kind) {
        if (kind === "not-allowed" || kind === "service-not-allowed") {
          setControl(false);
          voiceHeard.textContent = "Microphone blocked. Allow access to use voice control.";
        }
      },
      onEnd: function () {
        if (!controlOn) return;
        var rec = controlRec;
        setTimeout(function () {
          if (controlOn && controlRec === rec) {
            try {
              rec.start();
            } catch (err) {
              setControl(false);
            }
          }
        }, 150);
      }
    });
    if (!controlRec) {
      voiceHeard.textContent = "Voice input is not available in this browser.";
      return;
    }
    setControl(true);
    controlRec.start();
  });

  function feedbackText(fb) {
    var parts = [];
    if (fb.strengths && fb.strengths.length) parts.push("Strengths. " + fb.strengths.join(" "));
    if (fb.observations && fb.observations.length) parts.push("Observations. " + fb.observations.join(" "));
    if (fb.nextSteps && fb.nextSteps.length) parts.push("Possible next steps. " + fb.nextSteps.join(" "));
    if (fb.uncertainty) parts.push("Uncertainty. " + fb.uncertainty);
    return parts.join(" ");
  }

  function stopReading() {
    window.ACVoice.stopSpeaking();
    readingAloud = false;
    readButton.textContent = "Read aloud";
  }

  function readFeedbackAloud() {
    if (readingAloud) {
      stopReading();
      return;
    }
    if (!lastFeedback) {
      if (window.ACOverview && window.ACOverview.hasReport()) {
        window.ACOverview.read();
        return;
      }
      critiqueStatus.textContent = "No feedback to read yet. Analyze first.";
      return;
    }
    readingAloud = true;
    readButton.textContent = "Stop reading";
    var ok = window.ACVoice.speak(feedbackText(lastFeedback), {
      onEnd: function () {
        readingAloud = false;
        readButton.textContent = "Read aloud";
      }
    });
    if (!ok) {
      readingAloud = false;
      readButton.textContent = "Read aloud";
      critiqueStatus.textContent = "Read-aloud is not available in this browser.";
    }
  }

  readButton.addEventListener("click", readFeedbackAloud);

  function useImageSource(url, label) {
    if (objectUrl && objectUrl !== url) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
    corners = [];
    cornersAuto = false;
    stashedCorners = [];
    autoStatus.textContent = "";
    detectStatus.textContent = "";
    clearColor();
    artwork.src = url;
    artwork.onload = function () {
      hasImage = true;
      stage.hidden = false;
      if (useImageSize.checked) applyAutoCorners();
      setStatus(label);
      saveState();
      render();
      if (!tryDetectCorners(true)) runAutoGuide();
    };
    artwork.onerror = function () {
      hasImage = false;
      stage.hidden = true;
      setStatus("That file could not be displayed as an image. Try a JPEG or PNG photo.");
      render();
    };
  }

  fileInput.addEventListener("change", function () {
    var file = fileInput.files && fileInput.files[0];
    if (!file) return;
    stopCamera();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);
    // Computer uploads default to the image's actual size: full-frame
    // corners with pixel-measured aspect. Detection still refines when
    // it finds a clear inset rectangle; Reset restores manual taps.
    useImageSize.checked = true;
    useImageSource(objectUrl, "Photo loaded at actual size — corners set to the image edges.");
    fileInput.value = "";
  });

  var sampleArtworkButton = document.getElementById("sample-artwork-button");
  if (sampleArtworkButton) sampleArtworkButton.addEventListener("click", function () {
    stopCamera();
    useImageSize.checked = false;
    useImageSource("sample-artwork.svg", "Sample artwork loaded. Check the corners, then try a guide.");
  });

  function cameraSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  cameraButton.addEventListener("click", function () {
    if (!window.isSecureContext) {
      setStatus("This browser blocks the camera on non-secure addresses. Use Upload photo here, or open this page over HTTPS for camera capture.");
      return;
    }
    if (!cameraSupported()) {
      setStatus("This browser has no camera API. Use Upload photo instead — on iPhone it offers the camera too.");
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then(function (mediaStream) {
        stream = mediaStream;
        video.srcObject = stream;
        return video.play();
      })
      .then(function () {
        cameraWrap.hidden = false;
        setStatus("Camera previewing. Frame the artwork, then Capture still.");
      })
      .catch(function (err) {
        if (err && err.name === "NotAllowedError") {
          setStatus("Camera permission was denied. Allow access in the browser prompt, or use Upload photo.");
        } else if (err && err.name === "NotFoundError") {
          setStatus("No camera was found. Use Upload photo instead.");
        } else if (err && (err.name === "NotReadableError" || err.name === "AbortError")) {
          setStatus("The camera is busy in another app or tab. Close it, or use Upload photo.");
        } else {
          setStatus("Camera unavailable (" + (err && err.name ? err.name : "unknown error") + "). Use Upload photo instead.");
        }
      });
  });

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(function (track) { track.stop(); });
      stream = null;
    }
    if (video.srcObject) {
      video.srcObject = null;
    }
    cameraWrap.hidden = true;
  }

  cameraCancel.addEventListener("click", function () {
    stopCamera();
    setStatus(hasImage ? "" : "Camera closed. Use Upload photo if you prefer.");
  });

  captureButton.addEventListener("click", function () {
    if (!stream || !video.videoWidth) {
      setStatus("Camera is not ready yet. Wait a moment and try again.");
      return;
    }
    var canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    stopCamera();
    if (canvas.toBlob) {
      canvas.toBlob(function (blob) {
        if (!blob) {
          setStatus("Capture failed. Try again or use Upload photo.");
          return;
        }
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = URL.createObjectURL(blob);
        // Camera frames rarely fill the shot: measure from corners.
        useImageSize.checked = false;
        useImageSource(objectUrl, "Still captured. Tap the artwork's four corners.");
      }, "image/jpeg", 0.92);
    } else {
      // Camera frames rarely fill the shot: measure from corners.
      useImageSize.checked = false;
      useImageSource(canvas.toDataURL("image/jpeg", 0.92), "Still captured. Tap the artwork's four corners.");
    }
  });

  // Restore the artist's last settings (guide, format, opacity, corners).
  // Corners apply to whatever photo is loaded next; reset them per artwork.
  buildGuideSelect();
  buildFormatSelect();
  opacitySlider.value = String(loadState());
  guideSelect.value = autoGuide ? "auto" : currentGuide;
  updateFormatVisibility();
  updateWbVisibility();
  updateBlurb();
  applyOpacity();
  intentInput.addEventListener("input", saveState);
  mediumSelect.addEventListener("change", saveState);
  topicSelect.addEventListener("change", saveState);
  if (!window.ACVoice.recognitionSupported()) {
    voiceToggle.hidden = true;
    dictateButton.hidden = true;
    voiceHeard.textContent = "Voice input is not available in this browser.";
  }
  if (!window.ACVoice.synthesisSupported()) {
    readButton.hidden = true;
  }
  // Hooks for overview.js (automatic analysis). Nothing here sends anything.
  window.ACApp = {
    isReady: function () { return hasImage && !!orderedCorners(); },
    prepareAnalysis: prepareAnalysisInputs,
    applyGuide: applySuggestion,
    mountMarks: mountMarkSketch,
    kindLabel: annotateKindLabel
  };
  render();
})();
