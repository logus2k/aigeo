// chat-stream.js: SSE consumer for /api/chat.
// Exports an async generator that POSTs the conversation and yields parsed
// event objects in order. Handles partial SSE event reassembly across chunk
// boundaries (an event ends at "\n\n" but a chunk may end mid-event).

/**
 * Stream a chat completion from the backend.
 *
 * @param {Object} opts
 * @param {Array<{role: string, content: string}>} opts.messages
 * @param {string} [opts.model]
 * @param {AbortSignal} [opts.signal]
 * @yields {Object} parsed event: delta, tool_call_start, tool_call_result, done, error
 */
export async function* streamChat({ messages, model, signal }) {
  let resp;
  try {
    // Relative path so the call works whether the app is served at the root
    // (http://host:3388/) or under a reverse-proxy prefix (e.g.
    // https://logus2k.com/ania/). Mirrors cv-chat.js (`var API = 'api'`).
    resp = await fetch("api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
      },
      body: JSON.stringify({ messages, model, stream: true }),
      signal,
    });
  } catch (err) {
    if (err && err.name === "AbortError") return;
    yield { type: "error", message: String(err && err.message || err) };
    return;
  }

  if (!resp.ok || !resp.body) {
    let detail = "";
    try { detail = await resp.text(); } catch (_) { /* ignore */ }
    yield { type: "error", message: `HTTP ${resp.status}${detail ? ": " + detail.slice(0, 200) : ""}` };
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buf = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      // SSE events are separated by a blank line ("\n\n"). Split off whole
      // events and keep the trailing partial (if any) in the buffer.
      let sep;
      while ((sep = buf.indexOf("\n\n")) !== -1) {
        const raw = buf.slice(0, sep);
        buf = buf.slice(sep + 2);
        const event = parseSseEvent(raw);
        if (event) yield event;
      }
    }

    // Flush any tail (server should always end with "\n\n" but be defensive).
    const tail = buf.trim();
    if (tail) {
      const event = parseSseEvent(tail);
      if (event) yield event;
    }
  } catch (err) {
    if (err && err.name === "AbortError") return;
    yield { type: "error", message: String(err && err.message || err) };
  } finally {
    try { reader.releaseLock(); } catch (_) { /* ignore */ }
  }
}

// Parse one SSE event block (lines separated by single "\n"). We only consume
// the "data:" lines (ignoring event:, id:, retry: which the backend does not emit).
function parseSseEvent(raw) {
  const lines = raw.split("\n");
  let dataParts = [];
  for (const line of lines) {
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("data:")) {
      dataParts.push(line.slice(5).replace(/^ /, ""));
    }
  }
  if (dataParts.length === 0) return null;
  const payload = dataParts.join("\n").trim();
  if (!payload || payload === "[DONE]") return null;
  try {
    return JSON.parse(payload);
  } catch (_) {
    return { type: "error", message: "Malformed SSE payload" };
  }
}
