// chat-voice.js — STT and TTS for the aigeo Assistant chat panel.
//
// Minimal port of cv-chat.js voice paths, simplified:
//   STT: microphone -> AudioWorklet -> 16 kHz PCM16 -> Socket.IO (logus2k.com/stt)
//        -> 'transcription' event -> drop into the input textarea.
//   TTS: speak(text) -> Socket.IO (logus2k.com/tts) emits 'tts_text_chunk',
//        receives 'tts_audio_chunk' frames, decodes and plays via Web Audio.
//
// No VAD, no barge-in, no avatar mode — those are cv-parity polish that can
// be added later without changing this module's surface.

const STT_URL = "https://logus2k.com";
const STT_PATH = "/stt/socket.io";
const TTS_URL = "https://logus2k.com";
const TTS_PATH = "/tts/socket.io";
const SOCKET_TIMEOUT = 8000;
const PACKET_SECONDS = 0.1;

// Kokoro voices: pick by detected language (subset of cv's map, same ids).
const TTS_LANGUAGE_VOICE_MAP = {
  a: "af_heart", b: "bf_emma", j: "jf_alpha", z: "zf_xiaoxiao",
  e: "ef_dora", f: "ff_siwis", h: "hf_alpha", i: "if_sara", p: "pf_dora",
};
const TTS_DEFAULT_VOICE = TTS_LANGUAGE_VOICE_MAP.a;
const TTS_SPEED = 1.1;

const clientId = "aigeo-" + ((window.crypto && crypto.randomUUID)
  ? crypto.randomUUID() : Math.random().toString(36).slice(2));

// ---- AudioResampler (Float32 -> Int16 PCM at outRate) ----------------------
// Same algorithm cv vendors from noted/frontend/js/AudioResampler.js.
class AudioResampler {
  constructor(inRate, outRate) {
    this._ratio = inRate / outRate;
    this._carry = new Float32Array(0);
  }
  pushFloat32(chunk) {
    const input = new Float32Array(this._carry.length + chunk.length);
    input.set(this._carry, 0);
    input.set(chunk, this._carry.length);
    const outLen = Math.floor(input.length / this._ratio);
    if (outLen === 0) { this._carry = input; return null; }
    const out = new Int16Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const idx = i * this._ratio;
      const i0 = Math.floor(idx);
      const i1 = Math.min(i0 + 1, input.length - 1);
      const frac = idx - i0;
      let s = input[i0] * (1 - frac) + input[i1] * frac;
      s = Math.max(-1, Math.min(1, s));
      out[i] = (s < 0 ? s * 0x8000 : s * 0x7FFF) | 0;
    }
    this._carry = input.subarray(Math.floor(outLen * this._ratio));
    return out;
  }
}

// Light Kokoro language picker (ported from cv); never throws, defaults to 'a'.
function detectKokoroLanguage(text) {
  if (!text || typeof text !== "string") return "a";
  const t = text.trim();
  if (t.length < 3) return "a";
  let cjk = 0, hira = 0, kata = 0, hangul = 0, deva = 0;
  for (let ci = 0; ci < t.length; ci++) {
    const cp = t.codePointAt(ci);
    if ((cp >= 0x4E00 && cp <= 0x9FFF) || (cp >= 0x3400 && cp <= 0x4DBF)) cjk++;
    else if (cp >= 0x3040 && cp <= 0x309F) hira++;
    else if (cp >= 0x30A0 && cp <= 0x30FF) kata++;
    else if (cp >= 0xAC00 && cp <= 0xD7AF) hangul++;
    else if (cp >= 0x0900 && cp <= 0x097F) deva++;
  }
  if (hira + kata > 0) return "j";
  if (hangul > 0) return "a";
  if (deva > 0) return "h";
  if (cjk > 0 && hira + kata === 0) return "z";
  if (/[ñ¿¡]/i.test(t)) return "e";
  if (/[ãõ]/i.test(t)) return "p";
  if (/ç/i.test(t) && /[éèê]/i.test(t)) return "f";
  return "a";
}

// Strip Markdown noise that Kokoro mis-pronounces.
function sanitizeForTTS(text) {
  if (!text) return "";
  let s = String(text);
  s = s.replace(/```[\s\S]*?```/g, " ");
  s = s.replace(/`([^`]+)`/g, "$1");
  s = s.replace(/!\[[^\]]*\]\([^)]+\)/g, "");
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  s = s.replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, "$1");
  s = s.replace(/^#{1,6}\s+/gm, "");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}


// ---- STT --------------------------------------------------------------------
const stt = {
  socket: null, ctx: null, source: null, node: null,
  resampler: null, stream: null,
  active: false,
  onTranscription: null, onPartial: null, onStatus: null,
};

export async function startSTT({ onTranscription, onPartial, onStatus } = {}) {
  if (stt.active) return true;
  if (typeof window.io === "undefined") {
    if (onStatus) onStatus("error", "Voice library not loaded");
    return false;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (onStatus) onStatus("error", "Microphone not supported");
    return false;
  }
  stt.onTranscription = onTranscription || null;
  stt.onPartial = onPartial || null;
  stt.onStatus = onStatus || null;
  try {
    stt.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    stt.ctx = new (window.AudioContext || window.webkitAudioContext)();
    await stt.ctx.audioWorklet.addModule("js/recorder-worklet.js");
    stt.source = stt.ctx.createMediaStreamSource(stt.stream);
    stt.node = new AudioWorkletNode(stt.ctx, "recorder-worklet");
    stt.resampler = new AudioResampler(stt.ctx.sampleRate, 16000);

    stt.socket = window.io(STT_URL, {
      path: STT_PATH, transports: ["websocket", "polling"],
      forceNew: true, timeout: SOCKET_TIMEOUT,
    });
    stt.socket.on("connect", () => { if (onStatus) onStatus("listening", null); });
    stt.socket.on("disconnect", () => { if (onStatus) onStatus("idle", null); });
    stt.socket.on("connect_error", (err) => {
      if (onStatus) onStatus("error", err && err.message);
    });
    stt.socket.on("transcription", (payload) => {
      const text = (payload && payload.text || "").trim();
      if (text && onTranscription) onTranscription(text);
    });
    stt.socket.on("transcription_partial", (payload) => {
      const text = (payload && payload.text || "").trim();
      if (text && onPartial) onPartial(text);
    });

    // Accumulate AudioWorklet frames into ~PACKET_SECONDS packets, resample,
    // then emit as 'audio_data' (matches the cv/noted contract).
    const perPacket = Math.round(stt.ctx.sampleRate * PACKET_SECONDS);
    let pending = [];
    let pendingLen = 0;
    stt.node.port.onmessage = (ev) => {
      const chunk = ev.data;
      if (!chunk || !chunk.length) return;
      pending.push(chunk);
      pendingLen += chunk.length;
      if (pendingLen < perPacket) return;
      const merged = new Float32Array(pendingLen);
      let o = 0;
      for (const c of pending) { merged.set(c, o); o += c.length; }
      pending = []; pendingLen = 0;
      const pcm = stt.resampler.pushFloat32(merged);
      if (!pcm || !pcm.length) return;
      if (!(stt.socket && stt.socket.connected)) return;
      stt.socket.emit("audio_data", { clientId, audioData: pcm.buffer });
    };
    stt.source.connect(stt.node);
    stt.node.connect(stt.ctx.destination); // worklet output is silent
    stt.active = true;
    return true;
  } catch (err) {
    cleanupSTT();
    if (onStatus) {
      onStatus("error",
        err && err.name === "NotAllowedError"
          ? "Microphone permission denied"
          : (err && err.message) || "Mic init failed");
    }
    return false;
  }
}

export function stopSTT() {
  cleanupSTT();
  if (stt.onStatus) stt.onStatus("idle", null);
}

function cleanupSTT() {
  try { if (stt.node) stt.node.port.onmessage = null; } catch (_) {}
  try { if (stt.node) stt.node.disconnect(); } catch (_) {}
  try { if (stt.source) stt.source.disconnect(); } catch (_) {}
  try { if (stt.ctx) stt.ctx.close(); } catch (_) {}
  try { if (stt.stream) stt.stream.getTracks().forEach((t) => t.stop()); } catch (_) {}
  try { if (stt.socket) { stt.socket.removeAllListeners(); stt.socket.disconnect(); } } catch (_) {}
  Object.assign(stt, {
    socket: null, ctx: null, source: null, node: null,
    resampler: null, stream: null, active: false,
  });
}


// ---- TTS --------------------------------------------------------------------
const tts = {
  socket: null, ctx: null, queue: Promise.resolve(),
  active: false, currentVoice: TTS_DEFAULT_VOICE,
  bargedIn: false, current: null,
  onStatus: null,
};

export async function startTTS({ onStatus } = {}) {
  if (tts.active) return true;
  if (typeof window.io === "undefined") {
    if (onStatus) onStatus("error", "Voice library not loaded");
    return false;
  }
  tts.onStatus = onStatus || null;
  tts.ctx = new (window.AudioContext || window.webkitAudioContext)();
  try { await tts.ctx.resume(); } catch (_) {}
  tts.socket = window.io(TTS_URL, {
    path: TTS_PATH, transports: ["websocket", "polling"],
    forceNew: true, timeout: SOCKET_TIMEOUT,
    query: { client_id: clientId, format: "binary" },
  });
  return new Promise((resolve) => {
    tts.socket.once("connect", () => {
      tts.socket.emit("register_audio_client", {
        main_client_id: clientId, connection_type: "browser",
        mode: "tts", format: "binary",
        voice: TTS_DEFAULT_VOICE, speed: TTS_SPEED,
      });
      tts.socket.emit("tts_configure_client", {
        client_id: clientId, voice: TTS_DEFAULT_VOICE, speed: TTS_SPEED,
      });
      tts.socket.emit("set_client_mode", { mode: "tts", client_id: clientId });
      tts.socket.on("tts_audio_chunk", onTtsChunk);
      tts.socket.on("tts_stop_immediate", () => stopTtsPlayback());
      tts.queue = Promise.resolve();
      tts.bargedIn = false;
      tts.currentVoice = TTS_DEFAULT_VOICE;
      tts.active = true;
      if (onStatus) onStatus("ready", null);
      resolve(true);
    });
    tts.socket.once("connect_error", (err) => {
      cleanupTTS();
      if (onStatus) onStatus("error", err && err.message);
      resolve(false);
    });
  });
}

export function stopTTS() {
  cleanupTTS();
  if (tts.onStatus) tts.onStatus("off", null);
}

export function speak(text) {
  if (!tts.active || !tts.socket || !tts.socket.connected) return false;
  const clean = sanitizeForTTS(text);
  if (!clean) return false;
  tts.bargedIn = false;
  const targetVoice = TTS_LANGUAGE_VOICE_MAP[detectKokoroLanguage(clean)] || TTS_DEFAULT_VOICE;
  if (targetVoice !== tts.currentVoice) {
    tts.socket.emit("tts_configure_client", { client_id: clientId, voice: targetVoice });
    tts.currentVoice = targetVoice;
  }
  tts.socket.emit("tts_text_chunk", {
    chunk: clean, target_client_id: clientId, final: true,
  });
  return true;
}

export function stopTtsPlayback() {
  tts.bargedIn = true;
  try { if (tts.current) tts.current.stop(); } catch (_) {}
  tts.current = null;
  tts.queue = Promise.resolve();
  if (tts.socket && tts.socket.connected) {
    try { tts.socket.emit("stop_generation", { client_id: clientId }); } catch (_) {}
  }
  if (tts.onStatus) tts.onStatus("ready", null);
}

function onTtsChunk(evt) {
  const buf = evt && evt.audio_buffer;
  if (!buf || tts.bargedIn || !tts.ctx) return;
  let ab;
  if (buf instanceof ArrayBuffer) ab = buf.slice(0);
  else if (buf && buf.buffer) ab = buf.buffer.slice(0);
  else return;
  tts.ctx.decodeAudioData(ab).then((audioBuf) => {
    if (tts.bargedIn || !tts.ctx) return;
    if (tts.onStatus) tts.onStatus("speaking", null);
    tts.queue = tts.queue.then(() => new Promise((res) => {
      if (tts.bargedIn || !tts.ctx) return res();
      try {
        const src = tts.ctx.createBufferSource();
        src.buffer = audioBuf;
        src.connect(tts.ctx.destination);
        tts.current = src;
        src.onended = () => {
          tts.current = null;
          if (tts.onStatus) tts.onStatus("ready", null);
          res();
        };
        src.start();
      } catch (_) { res(); }
    }));
  }).catch(() => { /* decode failure: skip chunk */ });
}

function cleanupTTS() {
  try { if (tts.current) tts.current.stop(); } catch (_) {}
  try { if (tts.ctx) tts.ctx.close(); } catch (_) {}
  try { if (tts.socket) { tts.socket.removeAllListeners(); tts.socket.disconnect(); } } catch (_) {}
  Object.assign(tts, {
    socket: null, ctx: null, queue: Promise.resolve(),
    active: false, currentVoice: TTS_DEFAULT_VOICE,
    bargedIn: false, current: null,
  });
}

export function getClientId() { return clientId; }
export function sttActive() { return stt.active; }
export function ttsActive() { return tts.active; }
