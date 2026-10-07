import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
test("voice interrupts output, deduplicates handoffs and ignores stale microphone starts", async () => {
  const saved = {
    fetch: globalThis.fetch,
    Audio: globalThis.Audio,
    RTCPeerConnection: globalThis.RTCPeerConnection,
    navigator: Object.getOwnPropertyDescriptor(globalThis, "navigator"),
  };
  let lines = [],
    tasks = [],
    peers = [],
    stopCount = 0;
  const mic = () => ({
    getTracks: () => [
      {
        enabled: true,
        stop() {
          stopCount++;
        },
      },
    ],
  });
  let getMedia = async () => mic();
  globalThis.__voiceTest = {
    saveVoiceLine: async (...a) => lines.push(a),
    sendVoiceTask: async (...a) => tasks.push(a),
    startVoiceCall: async () => ({ token: "test", model: "test" }),
    getState: () => ({ messages: [] }),
    onMessage: () => () => {},
  };
  const source = readFileSync("src/lib/voiceCall.ts", "utf8")
    .replace(
      /import \{ saveVoiceLine, sendVoiceTask, startVoiceCall \} from "@\/app\/actions";/,
      "const {saveVoiceLine,sendVoiceTask,startVoiceCall}=globalThis.__voiceTest;",
    )
    .replace(
      /import \{ getState, onMessage \} from "\.\/store";/,
      "const {getState,onMessage}=globalThis.__voiceTest;",
    );
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  globalThis.Audio = class {};
  globalThis.RTCPeerConnection = class {
    constructor() {
      this.channel = {
        readyState: "open",
        sent: [],
        send(s) {
          this.sent.push(JSON.parse(s));
        },
      };
      peers.push(this);
    }
    addTrack() {}
    getSenders() {
      return [];
    }
    close() {
      this.closed = true;
    }
    createDataChannel() {
      return this.channel;
    }
    async createOffer() {
      return { sdp: "test" };
    }
    async setLocalDescription() {}
    async setRemoteDescription() {}
  };
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { mediaDevices: { getUserMedia: () => getMedia() } },
  });
  globalThis.fetch = async () => new Response("answer");
  const v = await import(
    "data:text/javascript;base64," + Buffer.from(code).toString("base64")
  );
  try {
    await v.startCall("a", "c");
    const channel = peers[0].channel;
    channel.onopen();
    const event = async (x) => channel.onmessage({ data: JSON.stringify(x) });
    await event({ type: "response.created" });
    v.interruptCall();
    assert.ok(channel.sent.some((e) => e.type === "response.cancel"));
    assert.ok(channel.sent.some((e) => e.type === "output_audio_buffer.clear"));
    assert.equal(v.getCall().status, "listening");
    const transcript = {
      type: "response.output_audio_transcript.done",
      event_id: "event1",
      item_id: "item1",
      transcript: "Hello",
    };
    await event(transcript);
    await event(transcript);
    assert.equal(lines.length, 1);
    const handoff = {
      type: "response.function_call_arguments.done",
      event_id: "task1",
      call_id: "call1",
      name: "send_task",
      arguments: '{"request":"Research"}',
    };
    await event(handoff);
    await event({ ...handoff, event_id: "task2" });
    assert.equal(tasks.length, 1);
    let resolveMedia;
    getMedia = () => new Promise((r) => (resolveMedia = r));
    const start = v.startCall("b", "d");
    v.endCall();
    resolveMedia(mic());
    await start;
    assert.equal(v.getCall(), null);
    assert.ok(stopCount >= 2);
    assert.ok(peers.every((p) => p.closed));
  } finally {
    v.endCall();
    globalThis.fetch = saved.fetch;
    globalThis.Audio = saved.Audio;
    globalThis.RTCPeerConnection = saved.RTCPeerConnection;
    if (saved.navigator)
      Object.defineProperty(globalThis, "navigator", saved.navigator);
    delete globalThis.__voiceTest;
  }
});
