/* Studio workflow and presentation. Camera, geometry and API calls stay in app.js;
   this script only arranges existing elements, adds navigation and reflects state. */
(function () {
  "use strict";
  function byId(id) { return document.getElementById(id); }
  function text(el, value) { if (el && el.textContent !== value) el.textContent = value; }
  function el(tag, className, content) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (content) node.textContent = content;
    return node;
  }
  var SVG_NS = "http://www.w3.org/2000/svg";
  var ICONS = {
    frame: "M3 5h18v14H3zM3 15l5-5 5 5 3-3 5 5M16 8h.01",
    sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM5 18l.6 1.4L7 20l-1.4.6L5 22l-.6-1.4L3 20l1.4-.6zM19 3l.6 1.4L21 5l-1.4.6L19 7l-.6-1.4L17 5l1.4-.6z",
    grid: "M4 4h16v16H4zM4 10.7h16M4 13.3h16M10.7 4v16M13.3 4v16",
    chat: "M4 5h16v11H9l-5 4z",
    palette: "M12 3a9 9 0 0 0 0 18c1.5 0 2-1 2-2s-1-2 0-3 3 0 4-1 1-3 1-3a9 9 0 0 0-7-9zM8 12a1 1 0 1 0 0-2 1 1 0 0 0 0 2M11 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2M15 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2"
  };
  function icon(name) {
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    var path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", ICONS[name]);
    svg.appendChild(path);
    return svg;
  }

  var state = { hasImage: false, cornerCount: 0, ready: false };
  var currentGroup = "compose";
  var header = document.querySelector(".site-header");
  var workspace = document.querySelector(".workspace");
  var sidebar = document.querySelector(".sidebar");
  var photoPanel = byId("photo-heading").closest("section");
  photoPanel.classList.add("photo-panel");
  var canvasPanel = byId("corners-heading").closest("section");
  var toolSections = [], links = {};
  workspace.id = "studio-canvas";
  sidebar.id = "studio-tools";

  /* Header: brand mark + name, navigation, voice toggle. */
  var brand = el("div", "brand");
  var mark = document.createElementNS(SVG_NS, "svg");
  mark.setAttribute("class", "brand-mark");
  mark.setAttribute("viewBox", "0 0 40 40");
  mark.setAttribute("aria-hidden", "true");
  mark.innerHTML = '<g fill="#f2a9c4" stroke="#b5174f" stroke-width="1.6" stroke-linejoin="round">' +
    '<path d="M20 5c3 0 5 3 5 7s-2 7-5 7-5-3-5-7 2-7 5-7z" transform="rotate(0 20 20)"/>' +
    '<path d="M20 5c3 0 5 3 5 7s-2 7-5 7-5-3-5-7 2-7 5-7z" transform="rotate(72 20 20)"/>' +
    '<path d="M20 5c3 0 5 3 5 7s-2 7-5 7-5-3-5-7 2-7 5-7z" transform="rotate(144 20 20)"/>' +
    '<path d="M20 5c3 0 5 3 5 7s-2 7-5 7-5-3-5-7 2-7 5-7z" transform="rotate(216 20 20)"/>' +
    '<path d="M20 5c3 0 5 3 5 7s-2 7-5 7-5-3-5-7 2-7 5-7z" transform="rotate(288 20 20)"/>' +
    '</g><circle cx="20" cy="20" r="4.5" fill="#d9f55e" stroke="#6f8a1c" stroke-width="1.6"/>';
  var brandText = el("div", "brand-text");
  brandText.append(byId("app-name"), byId("app-description"));
  brand.append(mark, brandText);
  header.prepend(brand);

  var nav = el("nav", "studio-nav");
  nav.setAttribute("aria-label", "Studio navigation");
  [["canvas", "Canvas", "frame"], ["overview", "Overview", "sparkle"], ["compose", "Compose", "grid"], ["feedback", "Feedback", "chat"], ["color", "Color", "palette"]].forEach(function (item) {
    var link = document.createElement("a");
    link.href = item[0] === "canvas" ? "#studio-canvas" : "#studio-tools";
    link.append(icon(item[2]), el("span", "nav-label", item[1]), el("span", "nav-dot"));
    link.addEventListener("click", function (event) { event.preventDefault(); navigate(item[0]); });
    nav.appendChild(link);
    links[item[0]] = link;
  });
  header.insertBefore(nav, byId("voice-toggle").closest(".voice-bar"));

  /* Setup progress above the canvas. */
  var workflow = el("div", "workflow");
  var steps = el("ol");
  steps.setAttribute("aria-label", "Artwork setup");
  [["photo", "Add photo"], ["corners", "Check corners"], ["explore", "Explore"]].forEach(function (step, i) {
    var li = el("li");
    li.dataset.step = step[0];
    li.append(el("span", "step-num", String(i + 1)), el("span", "step-label", step[1]));
    steps.appendChild(li);
  });
  var workflowMessage = el("p");
  workflowMessage.id = "workflow-message";
  workflowMessage.setAttribute("role", "status");
  workflowMessage.tabIndex = -1;
  workflow.append(steps, workflowMessage);
  workspace.prepend(workflow);

  text(byId("photo-heading"), "Add your artwork");
  text(photoPanel.querySelector(".hint"), "Photograph one sheet or canvas, or try the sample. Your original stays untouched; guides draw on top only.");
  text(byId("corners-heading"), "Your canvas");
  ["label.file-button", "#camera-button", "#sample-artwork-button", "#camera-cancel", "#detect-button", "#undo-button", "#reset-button",
    "#dictate-button", "#analyze-button", "#read-button", "#direction-button", "#direction-dismiss", "#annotate-dismiss", "#chat-talk",
    "#chat-stop", "#chat-send", "#chat-clear", "#suggest-button", "#sample-button", "#pick-neutral", "#annotate-button",
    "#afterimage-start", "#afterimage-stop", "#voice-toggle"].forEach(function (selector) {
    var button = document.querySelector(selector);
    if (button) button.classList.add("has-icon");
  });

  var empty = el("div", "studio-empty");
  empty.innerHTML = '<div class="studio-paper" aria-hidden="true"><span></span></div>' +
    '<h3>Your artwork goes here.</h3><p>Add a photo above to start exploring.</p>';
  document.querySelector(".stage-wrap").prepend(empty);

  var canvasActions = el("div", "canvas-actions row");
  var guideToggle = el("button", "secondary has-icon", "Hide guides");
  guideToggle.type = "button";
  guideToggle.id = "guide-visibility";
  guideToggle.setAttribute("aria-pressed", "false");
  guideToggle.addEventListener("click", function () {
    var hiding = guideToggle.getAttribute("aria-pressed") !== "true";
    guideToggle.setAttribute("aria-pressed", String(hiding));
    guideToggle.textContent = hiding ? "Show guides" : "Hide guides";
    byId("overlay").style.visibility = hiding ? "hidden" : "";
  });
  var explore = el("button", "has-icon", "Explore composition");
  explore.type = "button";
  explore.id = "explore-tools";
  explore.addEventListener("click", function () { navigate("compose"); });
  canvasActions.append(guideToggle, explore);
  canvasPanel.appendChild(canvasActions);

  /* Tools column: artwork context (narrow screens), group intro, tool cards. */
  var context = el("div", "artwork-context");
  context.hidden = true;
  var contextImg = el("img");
  contextImg.alt = "";
  var contextText = el("div", "context-text");
  var contextTitle = el("strong", null, "Your artwork");
  var contextMeta = el("span");
  contextText.append(contextTitle, contextMeta);
  var contextBack = el("button", "secondary has-icon context-back", "Canvas");
  contextBack.type = "button";
  contextBack.setAttribute("aria-label", "Back to the canvas");
  contextBack.addEventListener("click", function () { navigate("canvas"); });
  context.append(contextImg, contextText, contextBack);

  var intro = el("div", "tools-intro");
  intro.innerHTML = '<h2 id="tools-heading" tabindex="-1"></h2><p class="hint" id="tools-description"></p>' +
    '<p id="tool-readiness" class="tool-readiness"></p>';
  sidebar.prepend(context, intro);
  var readiness = byId("tool-readiness");
  var groupCopy = {
    overview: ["Your artwork at a glance", "One automatic read of the whole piece. Use the other groups to dig into guides, feedback and color."],
    compose: ["Compose your artwork", "Choose a guide and set your paper size. Nothing here changes your photo."],
    feedback: ["A second pair of eyes", "Set your intent, then ask for feedback, visual suggestions, or a conversation when you want them."],
    color: ["Explore your colors", "Sample a palette and study color relationships. These tools run on your device."]
  };
  /* heading id: [title, group, open by default, icon, one-line blurb] */
  var toolConfig = {
    "overview-heading": ["AI overview", "overview", true, "sparkle", "Composition, values, color, balance and marks"],
    "guide-heading": ["Composition guides", "compose", true, "grid", "Grids, spirals and perspective aids"],
    "format-heading": ["Paper & canvas size", "compose", false, "ruler", "True proportions for your sheet"],
    "critique-heading": ["AI critique", "feedback", true, "sparkle", "Strengths, observations, next steps"],
    "annotate-heading": ["Suggested changes", "feedback", false, "pin", "Balance and focal marks on your artwork"],
    "direction-heading": ["Art direction", "feedback", false, "compass", "Guides and a palette to try"],
    "chat-heading": ["Ask a question", "feedback", false, "chat", "Talk or type about your artwork"],
    "color-heading": ["Palette & harmonies", "color", true, "palette", "Sample colors and see their harmonies"],
    "albers-heading": ["Color studies", "color", false, "swatches", "How colors change each other"]
  };
  var shortHints = {
    "guide-heading": "Auto chooses a guide from your photo. Select a different guide any time.",
    "format-heading": "Choose the real paper size for more accurate guide proportions, or leave it on Auto.",
    "critique-heading": "Feedback based on your artwork, medium, and goals. Analyze sends the marked artwork to the AI service.",
    "direction-heading": "Explore suggested guides and colors. This sends your marked artwork to AI; the preview is a local color study, and Generate a version paints one optional AI study.",
    "annotate-heading": "Ask AI to mark possible changes on your artwork. Tap a mark to read its reason. Your image is sent only when you ask.",
    "chat-heading": "Ask about your marked artwork by voice or text. Each turn sends the image and recent conversation to AI. Voice transcription uses your browser's service. This conversation is not saved.",
    "color-heading": "Sample colors from your artwork, then choose a swatch to explore its harmonies."
  };
  var order = Object.keys(toolConfig);
  // Future tool sections get a default card rather than an unstyled, inaccessible block.
  Array.from(sidebar.querySelectorAll(":scope > section")).sort(function (a, b) {
    return order.indexOf(a.querySelector("h2").id) - order.indexOf(b.querySelector("h2").id);
  }).forEach(function (section) {
    var heading = section.querySelector("h2");
    var config = toolConfig[heading.id] || [heading.textContent, "feedback", false, "sparkle", ""];
    var details = el("details", "studio-tool");
    details.open = config[2];
    var summary = el("summary");
    text(heading, config[0]);
    var titles = el("div", "tool-titles");
    titles.appendChild(heading);
    if (config[4]) titles.appendChild(el("span", "tool-blurb", config[4]));
    summary.appendChild(titles);
    var content = el("div", "tool-content");
    while (section.firstChild) content.appendChild(section.firstChild);
    if (shortHints[heading.id] && content.querySelector(".hint")) text(content.querySelector(".hint"), shortHints[heading.id]);
    details.append(summary, content);
    section.appendChild(details);
    section.dataset.toolGroup = config[1];
    section.dataset.icon = config[3];
    sidebar.appendChild(section);
    toolSections.push(section);
    content.querySelectorAll('[role="status"]').forEach(function (status) {
      new MutationObserver(function () {
        if (!status.textContent.trim()) return;
        if (status.id === "aspect-status" || status.id === "auto-status") return;
        details.open = true;
        if (section.hidden && /^(overview|critique|direction|annotate|chat|color)-status$/.test(status.id)) {
          var link = links[config[1]];
          link.classList.add("has-update");
          link.setAttribute("aria-label", link.querySelector(".nav-label").textContent + ", new update");
        }
      }).observe(status, { childList: true, characterData: true, subtree: true });
    });
  });

  /* Status tone: app.js writes plain text; classify it so the chip reads at a glance. */
  var WARN = /could not|no clear|blocked|not configured|unusable|do not form|not supported|denied|unavailable|failed|error|no usable|try again|add a photo first|mark the four corners|pick a neutral|pick \w+ reference/i;
  var BUSY = /…$|\.\.\.$|seconds left|asking the model|preparing|listening|sampling/i;
  var OK = /detected|loaded|corners set|guide placed|^picked|ready|sampled|applied|captured/i;
  var THINKING = /asking the model|preparing artwork/i;
  var LISTENING = /^listening/i;
  var thinkingCount = 0;
  document.querySelectorAll(".status[role=\"status\"]").forEach(function (status) {
    var wasThinking = false;
    function classify() {
      var value = status.textContent.trim();
      var warn = !!value && WARN.test(value);
      var thinking = !!value && !warn && THINKING.test(value);
      status.classList.toggle("is-warn", warn);
      status.classList.toggle("is-busy", !!value && !warn && BUSY.test(value));
      status.classList.toggle("is-thinking", thinking);
      status.classList.toggle("is-listening", !!value && !warn && LISTENING.test(value));
      status.classList.toggle("is-ok", !!value && !warn && !BUSY.test(value) && OK.test(value));
      var card = status.closest("section");
      if (card) card.classList.toggle("is-thinking", thinking);
      if (thinking !== wasThinking) {
        wasThinking = thinking;
        thinkingCount += thinking ? 1 : -1;
        // The scan sweep over the photo shows while any AI request is in flight.
        document.body.classList.toggle("is-ai-thinking", thinkingCount > 0);
      }
    }
    new MutationObserver(classify).observe(status, { childList: true, characterData: true, subtree: true });
    classify();
  });

  function setGroup(group) {
    currentGroup = group;
    toolSections.forEach(function (section) { section.hidden = section.dataset.toolGroup !== group; });
    text(byId("tools-heading"), groupCopy[group][0]);
    text(byId("tools-description"), groupCopy[group][1]);
    links[group].classList.remove("has-update");
    links[group].removeAttribute("aria-label");
    updateReadiness();
  }
  function navigate(destination) {
    if (destination !== "canvas") setGroup(destination);
    Object.keys(links).forEach(function (key) {
      if (key === destination) links[key].setAttribute("aria-current", "location");
      else links[key].removeAttribute("aria-current");
    });
    var target = destination === "canvas" ? workflowMessage : byId("tools-heading");
    target.focus({ preventScroll: true });
    (destination === "canvas" ? workspace : sidebar).scrollIntoView({ block: "start" });
  }

  var needsCorners = ["overview-run", "analyze-button", "suggest-button", "direction-button", "annotate-button", "chat-talk", "chat-send"];
  needsCorners.forEach(function (id) {
    var button = byId(id);
    if (!button) return;
    button.setAttribute("aria-describedby", "tool-readiness");
    // Keep app-owned busy/disabled state. Intercept unmet setup before its handler.
    button.addEventListener("click", function (event) {
      if (state.ready) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      navigate("canvas");
      text(workflowMessage, state.hasImage ? "Mark four distinct corners before asking AI for feedback." : "Add a photo first. You can also try the sample.");
    }, true);
  });
  function updateReadiness() {
    var message = state.ready ? (currentGroup === "color" ? "Palette sampling stays on your device." : "Artwork aligned. AI actions send the marked image only when you ask.") :
      (!state.hasImage ? "Add a photo to use artwork tools. You can browse the options first." : "Check all four corners to enable AI tools.");
    text(readiness, message);
    readiness.classList.toggle("is-ready", state.ready);
    needsCorners.forEach(function (id) {
      var button = byId(id);
      if (button) button.setAttribute("aria-disabled", String(!state.ready));
    });
    byId("detect-button").disabled = !state.hasImage;
    if (!state.hasImage) {
      byId("undo-button").disabled = true;
      byId("reset-button").disabled = true;
    }
    byId("sample-button").disabled = !state.hasImage;
    guideToggle.disabled = !state.ready;
    explore.hidden = !state.ready;
    canvasActions.hidden = !state.hasImage;
  }
  function updateContext() {
    context.hidden = !state.hasImage;
    if (!state.hasImage) return;
    var artwork = byId("artwork");
    if (artwork && artwork.src && contextImg.src !== artwork.src) contextImg.src = artwork.src;
    text(contextMeta, state.ready ? "Corners set. Guides and AI tools are ready." :
      state.cornerCount === 4 ? "Corners need adjusting." : state.cornerCount + " of 4 corners marked.");
  }
  function updateWorkflow(next) {
    var wasImage = state.hasImage;
    state = next;
    document.body.classList.toggle("has-artwork", state.hasImage);
    var active = !state.hasImage ? "photo" : !state.ready ? "corners" : "explore";
    var done = { photo: state.hasImage, corners: state.ready, explore: false };
    steps.querySelectorAll("li").forEach(function (step) {
      if (step.dataset.step === active) step.setAttribute("aria-current", "step");
      else step.removeAttribute("aria-current");
      step.classList.toggle("is-done", !!done[step.dataset.step]);
    });
    var message = !state.hasImage ? "Start with a photo, your camera, or the sample below." :
      state.ready ? "Corners set. Check their position, then explore guides or ask for feedback." :
      state.cornerCount === 4 ? "Adjust the corners until they outline your artwork." :
      "Mark the artwork's corners: " + state.cornerCount + " of 4 placed. You can also try Detect corners.";
    text(workflowMessage, message);
    text(photoPanel.querySelector("label.file-button"), state.hasImage ? "Replace photo" : "Upload photo");
    text(byId("photo-heading"), state.hasImage ? "Your artwork photo" : "Add your artwork");
    updateReadiness();
    updateContext();
    if (state.hasImage && !wasImage) requestAnimationFrame(function () { canvasPanel.scrollIntoView({ block: "start" }); });
  }
  window.addEventListener("ac:artwork-state", function (event) { updateWorkflow(event.detail); });
  byId("artwork").addEventListener("load", updateContext);

  byId("intent-input").placeholder = "e.g. A quiet mood, with the vase as the focal point";
  var feedbackFields = byId("medium-select").closest(".row");
  feedbackFields.classList.add("feedback-fields");
  ["medium-select", "topic-select"].forEach(function (id) {
    var field = el("div");
    field.append(feedbackFields.querySelector('label[for="' + id + '"]'), byId(id));
    feedbackFields.appendChild(field);
  });
  byId("voice-commands").addEventListener("toggle", function () {
    if (this.open) {
      navigate("feedback");
      this.closest(".studio-tool").open = true;
    }
  });
  var camera = byId("camera-wrap");
  new MutationObserver(function () {
    if (!camera.hidden) camera.scrollIntoView({ block: "start" });
  }).observe(camera, { attributes: true, attributeFilter: ["hidden"] });
  window.addEventListener("ac:overview-ready", function () {
    var section = byId("overview-heading").closest("section");
    if (!section.hidden) return;
    links.overview.classList.add("has-update");
    links.overview.setAttribute("aria-label", "Overview, new update");
  });
  setGroup("overview");
  links.canvas.setAttribute("aria-current", "location");
  updateWorkflow(state);
})();
