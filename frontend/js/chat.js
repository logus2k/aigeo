// chat.js — aigeo Assistant chat panel.
// Self-contained ES module: opens a jsPanel docked at the right-bottom corner,
// streams responses from /api/chat, renders Markdown inline (zero deps), and
// dispatches `aigeo:chat-tool-call` CustomEvents on window for every tool_use
// the LLM emits. The chat-map-bridge (Phase 5) listens for those events.

import { streamChat } from "./chat-stream.js";

const LS_VISIBLE = "aigeo-chat-visible";
const MAX_USER_TURNS = 20;
const WARN_USER_TURNS = 18;

// ---- ThinkingParser (ported from cv-chat.js, simplified: only <think>) ----
// Stateful streaming parser that splits raw model output into a reasoning
// stream (between <think>...</think>) and an answer stream (everything else).
// Handles partial tags at chunk boundaries so '<t', '<th', '<thi', ...
// are not leaked into the answer.
class ThinkingParser {
  constructor() {
    this._inThinking = false;
    this._buffer = "";
    this.thinking = "";
  }
  // Returns an array of events: [{type:'thinking_token'|'answer_token'|
  //   'thinking_start'|'thinking_end', token?:string}]
  process(token) {
    this._buffer += token;
    const events = [];
    // Loop because a single chunk could contain BOTH open and close tags.
    while (true) {
      if (!this._inThinking) {
        const openIdx = this._buffer.indexOf("<think>");
        if (openIdx === -1) {
          // Defer partial '<think' or bare '<' at end so the next chunk completes it.
          const m = this._buffer.match(/<t(?:h(?:i(?:n(?:k)?)?)?)?$/);
          if (m) {
            const tail = m[0];
            const body = this._buffer.slice(0, m.index);
            this._buffer = tail;
            if (body) events.push({ type: "answer_token", token: body });
          } else if (this._buffer.endsWith("<")) {
            const body = this._buffer.slice(0, -1);
            this._buffer = "<";
            if (body) events.push({ type: "answer_token", token: body });
          } else {
            if (this._buffer) events.push({ type: "answer_token", token: this._buffer });
            this._buffer = "";
          }
          return events;
        }
        // Emit any pre-text as answer, then enter thinking mode.
        const pre = this._buffer.slice(0, openIdx);
        if (pre) events.push({ type: "answer_token", token: pre });
        this._buffer = this._buffer.slice(openIdx + "<think>".length);
        this._inThinking = true;
        events.push({ type: "thinking_start" });
        // Fall through to handle a possible close in the same chunk.
      }
      if (this._inThinking) {
        const closeIdx = this._buffer.indexOf("</think>");
        if (closeIdx === -1) {
          // Defer partial '</think' tail.
          const m = this._buffer.match(/<\/?t(?:h(?:i(?:n(?:k)?)?)?)?$/);
          if (m) {
            const tail = m[0];
            const body = this._buffer.slice(0, m.index);
            this._buffer = tail;
            if (body) {
              this.thinking += body;
              events.push({ type: "thinking_token", token: body });
            }
          } else if (this._buffer.endsWith("<")) {
            const body = this._buffer.slice(0, -1);
            this._buffer = "<";
            if (body) {
              this.thinking += body;
              events.push({ type: "thinking_token", token: body });
            }
          } else {
            if (this._buffer) {
              this.thinking += this._buffer;
              events.push({ type: "thinking_token", token: this._buffer });
            }
            this._buffer = "";
          }
          return events;
        }
        // Emit the in-think text, then close.
        const inside = this._buffer.slice(0, closeIdx);
        if (inside) {
          this.thinking += inside;
          events.push({ type: "thinking_token", token: inside });
        }
        this._buffer = this._buffer.slice(closeIdx + "</think>".length);
        this._inThinking = false;
        events.push({ type: "thinking_end" });
        // Loop: the buffer may still hold the answer body (and possibly
        // another <think> if the model derails).
      }
    }
  }
}

const state = {
  panel: null,
  visible: false,
  messages: [],            // [{role: "user"|"assistant", content: string}]
  streaming: false,
  abortCtrl: null,
  // DOM refs (re-bound every time the panel opens).
  els: { messages: null, input: null, form: null, send: null, status: null },
  // Live render state for the in-flight assistant turn.
  active: null,            // { bubble, body, text, tools: Map<call_id, {summary, pre}> }
};

/** Public entry point — called from app.js (or from this module's auto-init). */
export function initChat() {
  const btn = document.getElementById("chatBtn");
  if (btn) btn.addEventListener("click", toggleChat);
  // Restore visibility from localStorage. Wait one frame so jsPanel is ready.
  const saved = localStorage.getItem(LS_VISIBLE);
  if (saved === "1") requestAnimationFrame(openChat);
}

function toggleChat() {
  if (state.visible) closeChat();
  else openChat();
}

function openChat() {
  if (state.panel) return;
  const jp = window.jsPanel;
  if (!jp) return;
  state.panel = jp.create({
    headerTitle: "Assistant",
    theme: "#3182bd",
    borderRadius: "8px",
    panelSize: { width: 380, height: 560 },
    position: "right-bottom -16 -16",
    headerControls: "closeonly",
    content: panelHTML(),
    callback: (p) => bindPanel(p),
    onclosed: () => {
      state.panel = null;
      state.visible = false;
      localStorage.setItem(LS_VISIBLE, "0");
      // Cancel any in-flight stream.
      if (state.abortCtrl) { try { state.abortCtrl.abort(); } catch (_) { /* ignore */ } }
      state.abortCtrl = null;
      state.streaming = false;
      state.active = null;
    },
  });
  state.visible = true;
  localStorage.setItem(LS_VISIBLE, "1");
}

function closeChat() {
  if (!state.panel) return;
  state.panel.close();
}

function panelHTML() {
  return `<div class="chat-root">
    <div class="chat-messages" id="chat-messages">
      <div class="chat-empty">Ask about a country, indicator, or comparison.<br>Example: "Tell me about Brazil's AI agenda."</div>
    </div>
    <form class="chat-input-form" autocomplete="off">
      <textarea class="chat-input" rows="1" placeholder="Send a message" aria-label="Message"></textarea>
      <button class="chat-send" type="submit">Send</button>
    </form>
    <div class="chat-status" aria-live="polite"></div>
  </div>`;
}

function bindPanel(p) {
  const root = p.content;
  state.els.messages = root.querySelector(".chat-messages");
  state.els.form = root.querySelector(".chat-input-form");
  state.els.input = root.querySelector(".chat-input");
  state.els.send = root.querySelector(".chat-send");
  state.els.status = root.querySelector(".chat-status");

  // Re-render the prior conversation if the panel was reopened mid-session.
  if (state.messages.length) {
    state.els.messages.innerHTML = "";
    for (const m of state.messages) {
      appendMessage(m.role, m.content);
    }
  }

  state.els.form.addEventListener("submit", onSubmit);
  state.els.input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e);
    }
  });
  state.els.input.addEventListener("input", () => {
    const ta = state.els.input;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 110) + "px";
  });

  // Tool-call expansion: clicking the summary toggles details (native behavior),
  // but we also want clicks on the chip background to work uniformly.
  state.els.messages.addEventListener("click", (e) => {
    const a = e.target.closest("a[href]");
    if (a) { e.preventDefault(); window.open(a.getAttribute("href"), "_blank", "noopener"); }
  });
}

function onSubmit(e) {
  e.preventDefault();
  if (state.streaming) return;
  const ta = state.els.input;
  const text = (ta.value || "").trim();
  if (!text) return;

  // Cap conversation length.
  const userTurns = state.messages.filter((m) => m.role === "user").length;
  if (userTurns >= MAX_USER_TURNS) {
    setStatus("Conversation limit reached. Refresh the page to start over.", true);
    return;
  }

  // Clear the empty-state placeholder on first send.
  const empty = state.els.messages.querySelector(".chat-empty");
  if (empty) empty.remove();

  state.messages.push({ role: "user", content: text });
  appendMessage("user", text);
  ta.value = "";
  ta.style.height = "auto";

  if (userTurns + 1 >= WARN_USER_TURNS) {
    setStatus(`Warning: ${userTurns + 1} / ${MAX_USER_TURNS} turns used.`, true);
  } else {
    setStatus("");
  }

  runStream();
}

async function runStream() {
  state.streaming = true;
  state.els.send.disabled = true;
  state.abortCtrl = new AbortController();

  // Start an empty assistant bubble that we will fill in token by token.
  const { container, body, thinkingBox, thinkingBody } = appendAssistantStreamingBubble();
  state.active = {
    bubble: container, body, text: "",
    thinkingBox, thinkingBody, thinking: "",
    parser: new ThinkingParser(),
    tools: new Map(),
  };

  let inputTokens = null;
  let outputTokens = null;
  let stopReason = null;
  let assistantText = "";
  let errored = false;

  try {
    for await (const ev of streamChat({
      messages: state.messages,
      signal: state.abortCtrl.signal,
    })) {
      if (!ev || !ev.type) continue;
      if (ev.type === "delta") {
        const parsed = state.active.parser.process(ev.text || "");
        for (const p of parsed) {
          if (p.type === "thinking_start") {
            state.active.thinkingBox.classList.add("active");
            state.active.thinkingBox.open = true;
          } else if (p.type === "thinking_token") {
            state.active.thinking += p.token;
            state.active.thinkingBody.textContent = state.active.thinking;
          } else if (p.type === "thinking_end") {
            state.active.thinkingBox.open = false;
            state.active.thinkingBox.classList.add("done");
          } else if (p.type === "answer_token") {
            state.active.text += p.token;
            assistantText += p.token;
          }
        }
        renderActiveBody();
        scrollToBottom();
      } else if (ev.type === "tool_call_start") {
        renderToolCallStart(ev);
        // Dispatch to the rest of the app (Phase 5 listens here).
        try {
          window.dispatchEvent(new CustomEvent("aigeo:chat-tool-call", {
            detail: { tool: ev.tool, input: ev.input, call_id: ev.call_id },
          }));
        } catch (_) { /* ignore */ }
        scrollToBottom();
      } else if (ev.type === "tool_call_result") {
        renderToolCallResult(ev);
      } else if (ev.type === "done") {
        stopReason = ev.stop_reason || null;
        inputTokens = ev.input_tokens != null ? ev.input_tokens : null;
        outputTokens = ev.output_tokens != null ? ev.output_tokens : null;
      } else if (ev.type === "error") {
        errored = true;
        renderErrorBubble(ev.message || "Stream error.");
        break;
      }
    }
  } catch (err) {
    errored = true;
    renderErrorBubble(String(err && err.message || err));
  }

  if (!errored && assistantText.trim()) {
    state.messages.push({ role: "assistant", content: assistantText });
  } else if (errored) {
    // Pop the user turn that did not get a clean reply so retries do not double up.
    // Keep the message for context though: the user can still scroll back.
  }

  // Finalize: replace the streaming bubble's body with the final markdown
  // render so partial-render artifacts (incomplete tags) are cleaned up.
  if (state.active && !errored) {
    state.active.body.innerHTML = renderMarkdown(state.active.text);
  }

  const tokenParts = [];
  if (inputTokens != null) tokenParts.push(`in ${inputTokens}`);
  if (outputTokens != null) tokenParts.push(`out ${outputTokens}`);
  if (tokenParts.length) {
    setStatus(`Tokens: ${tokenParts.join(", ")}${stopReason ? " (" + stopReason + ")" : ""}`);
  }

  state.streaming = false;
  state.els.send.disabled = false;
  state.abortCtrl = null;
  state.active = null;
}

function setStatus(text, warning) {
  if (!state.els.status) return;
  state.els.status.textContent = text || "";
  state.els.status.classList.toggle("warning", !!warning);
}

function scrollToBottom() {
  const m = state.els.messages;
  if (!m) return;
  // Schedule the scroll after the next paint so the new content's height
  // has been measured. Otherwise scrollHeight may still be the pre-render
  // value and the last delta gets cut off behind the input form.
  requestAnimationFrame(() => { m.scrollTop = m.scrollHeight; });
}

// ---- message rendering ------------------------------------------------------

function appendMessage(role, content) {
  const div = document.createElement("div");
  div.className = `chat-message ${role}`;
  const bubble = document.createElement("div");
  bubble.className = "chat-bubble";
  if (role === "assistant") {
    bubble.innerHTML = renderMarkdown(content);
    // History-rendered assistant bubbles also get a copy button.
    bubble.appendChild(createCopyBtn(() => (bubble.innerText || bubble.textContent || "").trim()));
  } else {
    bubble.textContent = content;
  }
  div.appendChild(bubble);
  state.els.messages.appendChild(div);
  scrollToBottom();
  return { container: div, bubble };
}

// ---- Copy-to-clipboard button (ported from cv-chat.js) ----
const COPY_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#202020" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" fill="#a8d8a0"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const CHECK_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2a7a2a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 12 9 17 20 6"/></svg>';

function createCopyBtn(getText) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "chat-copy-btn";
  btn.title = "Copy";
  btn.setAttribute("aria-label", "Copy message");
  btn.innerHTML = COPY_ICON;
  btn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    const text = typeof getText === "function" ? getText() : String(getText || "");
    if (!text || !navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(() => {
      btn.innerHTML = CHECK_ICON;
      setTimeout(() => { btn.innerHTML = COPY_ICON; }, 1500);
    }).catch(() => { /* clipboard denied; silent */ });
  });
  return btn;
}

function appendAssistantStreamingBubble() {
  const div = document.createElement("div");
  div.className = "chat-message assistant";
  const bubble = document.createElement("div");
  bubble.className = "chat-bubble";

  // Collapsible Thinking section, hidden until the parser sees <think>.
  // Click/hover restricted to the inner .thinking-label (not the whole row):
  // CSS sets pointer/underline only on .thinking-label, and we cancel any
  // summary-toggle click that originated outside that label.
  const thinkingBox = document.createElement("details");
  thinkingBox.className = "chat-thinking";
  const tSummary = document.createElement("summary");
  tSummary.innerHTML = '<span class="thinking-label">Thinking</span>';
  tSummary.addEventListener("click", (e) => {
    if (!e.target.closest(".thinking-label")) e.preventDefault();
  });
  const thinkingBody = document.createElement("pre");
  thinkingBody.className = "chat-thinking-body";
  thinkingBox.appendChild(tSummary);
  thinkingBox.appendChild(thinkingBody);
  bubble.appendChild(thinkingBox);

  // Inner body for the streamed answer text.
  const body = document.createElement("span");
  body.className = "chat-body";
  bubble.appendChild(body);

  // Copy button (top-right, hover-revealed via CSS). Reads .chat-body's
  // innerText so the reasoning trace inside .chat-thinking is excluded.
  bubble.appendChild(createCopyBtn(() => (body.innerText || body.textContent || "").trim()));

  div.appendChild(bubble);
  state.els.messages.appendChild(div);
  scrollToBottom();
  return { container: div, body, thinkingBox, thinkingBody };
}

function renderActiveBody() {
  if (!state.active) return;
  state.active.body.innerHTML = renderMarkdown(state.active.text);
}

function renderToolCallStart(ev) {
  if (!state.active) return;
  const bubble = state.active.bubble.querySelector(".chat-bubble");
  if (!bubble) return;
  const details = document.createElement("details");
  details.className = "chat-tool-call";
  details.dataset.state = "pending";
  const argPreview = previewArg(ev.input);
  const summary = document.createElement("summary");
  summary.innerHTML = `<span class="tool-dot"></span>
    <span class="tool-name">${escapeHtml(ev.tool || "tool")}</span>
    <span class="tool-arg">${escapeHtml(argPreview)}</span>`;
  details.appendChild(summary);

  const inputLabel = document.createElement("div");
  inputLabel.className = "tool-section-label";
  inputLabel.textContent = "input";
  const inputPre = document.createElement("pre");
  inputPre.textContent = safeStringify(ev.input);
  details.appendChild(inputLabel);
  details.appendChild(inputPre);

  const resultLabel = document.createElement("div");
  resultLabel.className = "tool-section-label";
  resultLabel.textContent = "result";
  const resultPre = document.createElement("pre");
  resultPre.textContent = "(awaiting result)";
  details.appendChild(resultLabel);
  details.appendChild(resultPre);

  bubble.appendChild(details);
  state.active.tools.set(ev.call_id, { details, resultPre });
}

function renderToolCallResult(ev) {
  if (!state.active) return;
  const entry = state.active.tools.get(ev.call_id);
  if (!entry) return;
  entry.details.dataset.state = ev.ok ? "ok" : "error";
  entry.resultPre.textContent = ev.content_preview != null
    ? String(ev.content_preview)
    : (ev.ok ? "(no preview)" : "(tool error)");
}

function renderErrorBubble(message) {
  const div = document.createElement("div");
  div.className = "chat-message error";
  const bubble = document.createElement("div");
  bubble.className = "chat-bubble";
  bubble.textContent = "Error: " + message;
  div.appendChild(bubble);
  state.els.messages.appendChild(div);
  scrollToBottom();
}

// ---- helpers ----------------------------------------------------------------

function previewArg(input) {
  if (input == null) return "";
  if (typeof input === "string") return input.slice(0, 60);
  const keys = Object.keys(input);
  if (keys.length === 0) return "";
  const pairs = keys.slice(0, 3).map((k) => `${k}=${stringifyScalar(input[k])}`);
  let out = pairs.join(", ");
  if (out.length > 60) out = out.slice(0, 57) + "...";
  return out;
}

function stringifyScalar(v) {
  if (v == null) return "null";
  if (typeof v === "string") return v.length > 24 ? v.slice(0, 21) + "..." : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v).slice(0, 24);
}

function safeStringify(v) {
  try { return JSON.stringify(v, null, 2); } catch (_) { return String(v); }
}

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---- minimal Markdown renderer ---------------------------------------------
// Supports: headings (#, ##, ###), bold (**), italic (*), code (`),
// links [x](y), unordered (-, *) and ordered (1.) lists, GFM-style tables,
// fenced code (```), and line breaks. KaTeX-friendly: escapes "$" so the
// existing aigeo style.css and any host page do not trigger math-mode.

function renderMarkdown(src) {
  if (!src) return "";
  // Normalize line endings and escape "$" up front to prevent KaTeX math mode.
  let text = String(src).replace(/\r\n?/g, "\n").replace(/\$/g, "\\$");

  // Extract fenced code blocks first so their contents are not touched.
  const codeBlocks = [];
  text = text.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (m, lang, body) => {
    const idx = codeBlocks.push({ lang, body }) - 1;
    return ` CODEBLOCK_${idx} `;
  });

  // Split into block-level chunks separated by blank lines, then walk them.
  const lines = text.split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Code block placeholder.
    const cb = line.match(/^ CODEBLOCK_(\d+) $/);
    if (cb) {
      const { body } = codeBlocks[+cb[1]];
      out.push(`<pre><code>${escapeHtml(body)}</code></pre>`);
      i++;
      continue;
    }

    if (!line.trim()) { i++; continue; }

    // Heading.
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = Math.min(h[1].length, 3);
      out.push(`<h${level}>${renderInline(h[2])}</h${level}>`);
      i++;
      continue;
    }

    // Table (GFM): header line, separator line, body lines.
    if (line.includes("|") && i + 1 < lines.length && /^\s*\|?[-:\s|]+\|?\s*$/.test(lines[i + 1])) {
      const header = splitTableRow(line);
      const sep = lines[i + 1];
      const aligns = splitTableRow(sep).map(cellAlign);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes("|")) {
        rows.push(splitTableRow(lines[i]));
        i++;
      }
      out.push(renderTable(header, aligns, rows));
      continue;
    }

    // Unordered list.
    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ""));
        i++;
      }
      out.push("<ul>" + items.map((it) => `<li>${renderInline(it)}</li>`).join("") + "</ul>");
      continue;
    }

    // Ordered list.
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      out.push("<ol>" + items.map((it) => `<li>${renderInline(it)}</li>`).join("") + "</ol>");
      continue;
    }

    // Paragraph: collect consecutive non-blank, non-block lines.
    const para = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    out.push(`<p>${renderInline(para.join(" "))}</p>`);
  }

  return out.join("");
}

function isBlockStart(line) {
  if (/^ CODEBLOCK_/.test(line)) return true;
  if (/^#{1,6}\s/.test(line)) return true;
  if (/^\s*[-*+]\s+/.test(line)) return true;
  if (/^\s*\d+\.\s+/.test(line)) return true;
  return false;
}

function splitTableRow(line) {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}

function cellAlign(cell) {
  const c = cell.trim();
  const left = c.startsWith(":");
  const right = c.endsWith(":");
  if (left && right) return "center";
  if (right) return "right";
  if (left) return "left";
  return "";
}

function renderTable(header, aligns, rows) {
  const ths = header.map((h, k) => `<th${aligns[k] ? ` style="text-align:${aligns[k]}"` : ""}>${renderInline(h)}</th>`).join("");
  const trs = rows.map((r) => {
    const tds = r.map((c, k) => `<td${aligns[k] ? ` style="text-align:${aligns[k]}"` : ""}>${renderInline(c)}</td>`).join("");
    return `<tr>${tds}</tr>`;
  }).join("");
  return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
}

// Inline parser: bold, italic, inline code, links. Order matters (code first,
// since code spans are literal).
function renderInline(src) {
  // Tokenize inline code, then escape and apply other transforms outside it.
  const parts = [];
  let rest = String(src);
  const codeRe = /`([^`\n]+)`/;
  while (true) {
    const m = codeRe.exec(rest);
    if (!m) { parts.push({ kind: "text", value: rest }); break; }
    if (m.index > 0) parts.push({ kind: "text", value: rest.slice(0, m.index) });
    parts.push({ kind: "code", value: m[1] });
    rest = rest.slice(m.index + m[0].length);
  }

  return parts.map((p) => {
    if (p.kind === "code") return `<code>${escapeHtml(p.value)}</code>`;
    let s = escapeHtml(p.value);
    // Links: [text](url). URL is filtered to http/https/mailto for safety.
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
      const safe = /^(https?:|mailto:)/i.test(url) ? url : "#";
      return `<a href="${safe}" target="_blank" rel="noopener">${label}</a>`;
    });
    // Bold then italic. Use non-greedy.
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    return s;
  }).join("");
}

// Auto-init on module load. The map's app.js does not need to know about us:
// we hook the DOM directly and run when the topbar button exists.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initChat, { once: true });
} else {
  initChat();
}
