// Voice input and output for Artist Companion (Web Speech API).
// Recognition uses the standard or webkit-prefixed constructor; synthesis
// uses the default voice. All browser access is guarded so unsupported
// browsers get clear messaging instead of crashes. Command parsing is pure
// and shared with Node tests.
//
// Privacy: speech recognition sends audio to the browser vendor's
// transcription servers (Apple/Google). Speech synthesis uses on-device
// voices. The app says so next to the controls.
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    root.ACVoice = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function globalScope() {
    if (typeof window !== "undefined") return window;
    if (typeof self !== "undefined") return self;
    return null;
  }

  function recognitionClass() {
    var scope = globalScope();
    if (!scope) return null;
    return scope.SpeechRecognition || scope.webkitSpeechRecognition || null;
  }

  function recognitionSupported() {
    return !!recognitionClass();
  }

  function synthesisSupported() {
    var scope = globalScope();
    return !!(scope && scope.speechSynthesis && scope.SpeechSynthesisUtterance);
  }

  // handlers: { onFinal(text), onInterim(text), onError(kind), onEnd() }
  // Returns a controller { start(), stop() } or null when unsupported.
  function createRecognizer(options, handlers) {
    var Rec = recognitionClass();
    if (!Rec) return null;
    var scope = globalScope();
    var rec = new Rec();
    rec.lang = (scope.navigator && scope.navigator.language) || "en-US";
    rec.continuous = !!options.continuous;
    rec.interimResults = options.interim !== false;
    rec.onresult = function (event) {
      var finals = [];
      var interim = "";
      for (var i = event.resultIndex; i < event.results.length; i++) {
        var res = event.results[i];
        if (res.isFinal) finals.push(res[0].transcript);
        else interim += res[0].transcript;
      }
      if (finals.length && handlers.onFinal) handlers.onFinal(finals.join(" "));
      if (interim && handlers.onInterim) handlers.onInterim(interim);
    };
    rec.onerror = function (event) {
      if (handlers.onError) handlers.onError((event && event.error) || "unknown");
    };
    var running = false;
    rec.onend = function () {
      running = false;
      if (handlers.onEnd) handlers.onEnd();
    };
    return {
      start: function () {
        if (running) return;
        running = true;
        try {
          rec.start();
        } catch (err) {
          running = false;
          if (handlers.onError) handlers.onError("start-failed");
        }
      },
      stop: function () {
        running = false;
        try {
          rec.stop();
        } catch (err) {
          // Already stopped; nothing to do.
        }
      }
    };
  }

  function speak(text, handlers) {
    var scope = globalScope();
    var done = handlers || {};
    if (!synthesisSupported() || !text) {
      if (done.onEnd) done.onEnd(false);
      return false;
    }
    var synth = scope.speechSynthesis;
    synth.cancel();
    var utter = new scope.SpeechSynthesisUtterance(text);
    utter.onend = function () {
      if (done.onEnd) done.onEnd(true);
    };
    utter.onerror = function () {
      if (done.onEnd) done.onEnd(false);
    };
    synth.speak(utter);
    return true;
  }

  function stopSpeaking() {
    var scope = globalScope();
    if (scope && scope.speechSynthesis) {
      try {
        scope.speechSynthesis.cancel();
      } catch (err) {
        // Nothing to cancel.
      }
    }
  }

  // Maps a transcript to { action } or null. Tolerant of case,
  // punctuation, and small wording differences.
  function parseCommand(input) {
    var t = String(input || "").toLowerCase()
      .replace(/[?!.,;:]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!t) return null;
    function has() {
      for (var i = 0; i < arguments.length; i++) {
        if (t.indexOf(arguments[i]) < 0) return false;
      }
      return true;
    }
    if (/\bstop\b/.test(t)) return { action: "stop" };
    if (has("suggest", "guide")) return { action: "suggest" };
    if (/\banaly[sz]e\b/.test(t) || has("critique")) return { action: "analyze" };
    if (has("sample") && (has("palette") || has("color") || has("colour"))) {
      return { action: "sample" };
    }
    if (has("next", "guide")) return { action: "nextGuide" };
    if (has("previous", "guide") || has("last", "guide")) return { action: "prevGuide" };
    if (has("read") && (has("feedback") || has("aloud") || has("result") || has("critique"))) {
      return { action: "readAloud" };
    }
    if (has("chat") || (has("talk") && (has("ai") || has("about") || has("artwork")))) {
      return { action: "chat" };
    }
    if (/\bgenerat\w*\b/.test(t) && has("version")) return { action: "generate" };
    if (t === "help" || has("what", "can", "i", "say")) return { action: "help" };
    return null;
  }

  return {
    recognitionSupported: recognitionSupported,
    synthesisSupported: synthesisSupported,
    createRecognizer: createRecognizer,
    speak: speak,
    stopSpeaking: stopSpeaking,
    parseCommand: parseCommand
  };
});
