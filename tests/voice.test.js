// Voice tests. Runs with plain Node, no packages:
//   node tests/voice.test.js
const assert = require("assert");
const voice = require("../public/voice.js");

function action(text) {
  const cmd = voice.parseCommand(text);
  return cmd && cmd.action;
}

assert.strictEqual(action("suggest a guide"), "suggest");
assert.strictEqual(action("Suggest guide please!"), "suggest");
assert.strictEqual(action("analyze"), "analyze");
assert.strictEqual(action("analyse this artwork"), "analyze");
assert.strictEqual(action("run the critique"), "analyze");
assert.strictEqual(action("sample palette"), "sample");
assert.strictEqual(action("sample the colours"), "sample");
assert.strictEqual(action("next guide"), "nextGuide");
assert.strictEqual(action("previous guide"), "prevGuide");
assert.strictEqual(action("go back to the last guide"), "prevGuide");
assert.strictEqual(action("read feedback"), "readAloud");
assert.strictEqual(action("read aloud"), "readAloud");
assert.strictEqual(action("read my results"), "readAloud");
assert.strictEqual(action("chat"), "chat");
assert.strictEqual(action("talk to the AI"), "chat");
assert.strictEqual(action("talk about this artwork"), "chat");
assert.strictEqual(action("generate a version"), "generate");
assert.strictEqual(action("please generate a new version"), "generate");
assert.strictEqual(action("stop"), "stop");
assert.strictEqual(action("stop listening"), "stop");
assert.strictEqual(action("help"), "help");
assert.strictEqual(action("what can I say?"), "help");

assert.strictEqual(voice.parseCommand(""), null);
assert.strictEqual(voice.parseCommand("   "), null);
assert.strictEqual(voice.parseCommand("hello there"), null);
assert.strictEqual(voice.parseCommand("guide"), null);
assert.strictEqual(voice.parseCommand("talk"), null);

// Browser APIs are absent in Node; guards report that instead of throwing.
assert.strictEqual(voice.recognitionSupported(), false);
assert.strictEqual(voice.synthesisSupported(), false);
assert.strictEqual(voice.createRecognizer({}, {}), null);
let ended = null;
assert.strictEqual(voice.speak("hi", { onEnd: (ok) => { ended = ok; } }), false);
assert.strictEqual(ended, false);
voice.stopSpeaking();

console.log("voice tests passed: command parsing, API guards.");
