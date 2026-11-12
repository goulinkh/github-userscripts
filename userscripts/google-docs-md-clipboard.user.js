// ==UserScript==
// @name         Google Docs Markdown Clipboard
// @namespace    https://github.com/goulinkh/github-userscripts
// @version      0.1.0
// @description  Makes ⌘C/Ctrl+C copy as Markdown and ⌘V/Ctrl+V paste from Markdown in Google Docs
// @author       goulinkh
// @license      MIT
// @homepageURL  https://github.com/goulinkh/userscripts
// @supportURL   https://github.com/goulinkh/userscripts/issues
// @downloadURL  https://raw.githubusercontent.com/goulinkh/userscripts/main/userscripts/google-docs-md-clipboard.user.js
// @updateURL    https://raw.githubusercontent.com/goulinkh/userscripts/main/userscripts/google-docs-md-clipboard.user.js
// @match        https://docs.google.com/document/d/*
// @match        https://docs.google.com/document/u/*/d/*
// @noframes
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  "use strict";
  const VERSION = "0.1.0", KEY = "__googleDocsMarkdownClipboard";
  window[KEY]?.destroy();
  const mac = /mac|iphone|ipad/i.test(navigator.userAgentData?.platform || navigator.platform), chrome = /(?:Chrome|CriOS)\//.test(navigator.userAgent), commands = {
    c: { name: "copy", icon: "markdown-copy-18x18" },
    v: { name: "paste", icon: "markdown-paste-18x18" }
  }, PLAIN_PASTE = "editors-ia-paste", counts = { copy: 0, paste: 0, native: 0 }, denied = {}, permissions = [], windows = /* @__PURE__ */ new Set();
  let last = null, destroyed = !1;
  const watchPermission = async (name) => {
    try {
      const status = await navigator.permissions.query({ name });
      if (destroyed) return;
      const update = () => {
        denied[name] = status.state === "denied";
      };
      update(), status.addEventListener("change", update), permissions.push(() => status.removeEventListener("change", update));
    } catch {
    }
  };
  watchPermission("clipboard-read"), watchPermission("clipboard-write");
  const pasteBlocker = () => chrome ? denied["clipboard-read"] || denied["clipboard-write"] ? "permission" : null : "browser", findItem = (icon) => {
    for (const node of document.querySelectorAll(`.docs-icon-${icon}`)) {
      const item = node.closest('[role="menuitem"]');
      if (item && item.getAttribute("aria-disabled") !== "true" && !item.classList.contains("goog-menuitem-disabled") && item.style.display !== "none") return item;
    }
    return null;
  }, activate = (item) => {
    const init = { bubbles: !0, cancelable: !0, view: window, button: 0 };
    for (const type of ["mouseover", "mousedown", "mouseup", "mouseout"]) item.dispatchEvent(new MouseEvent(type, init));
  }, shortcut = (event) => {
    if (!event.isTrusted || event.isComposing || event.altKey || event.shiftKey || (mac ? !event.metaKey || event.ctrlKey : !event.ctrlKey || event.metaKey)) return null;
    const key = /^[a-z]$/i.test(event.key) ? event.key.toLowerCase() : { KeyC: "c", KeyV: "v" }[event.code];
    return commands[key] || null;
  }, fromGoogleEditor = async () => {
    for (const item of await navigator.clipboard.read()) {
      if (item.types.some((type) => type.startsWith("web application/x-vnd.google-docs"))) return !0;
      if (!item.types.includes("text/html")) continue;
      const html = await (await item.getType("text/html")).text();
      if (html.includes('id="docs-internal-guid-') || html.includes("google-sheets-html-origin")) return !0;
    }
    return !1;
  }, native = (command, reason) => {
    counts.native++, last = { command: command.name, outcome: "native", reason, at: Date.now() };
  }, copy = (event) => {
    const item = findItem(commands.c.icon);
    if (!item) return native(commands.c, "unavailable");
    event.preventDefault(), event.stopImmediatePropagation(), counts.copy++, last = { command: "copy", outcome: "markdown", at: Date.now() }, activate(item);
  }, paste = (event) => {
    const blocked = pasteBlocker();
    if (blocked) return native(commands.v, blocked);
    if (!findItem(commands.v.icon) || !findItem(PLAIN_PASTE)) return native(commands.v, "unavailable");
    event.preventDefault(), event.stopImmediatePropagation();
    const started = Date.now();
    fromGoogleEditor().then((google) => ({ google }), (error) => ({ google: !1, error: error?.name || "Error" })).then(({ google, error }) => {
      if (destroyed) return;
      const item = findItem(google ? PLAIN_PASTE : commands.v.icon), outcome = item ? google ? "native" : "markdown" : "failed";
      outcome === "markdown" ? counts.paste++ : outcome === "native" && counts.native++, last = { command: "paste", outcome, reason: item ? google ? "google-editor-content" : error ? "clipboard-read-" + error : void 0 : "unavailable", ms: Date.now() - started, at: Date.now() }, item && activate(item);
    });
  }, onKeydown = (event) => {
    const command = shortcut(event);
    !command || event.defaultPrevented || (command === commands.c ? copy : paste)(event);
  }, prune = () => {
    for (const win of windows)
      win.closed && windows.delete(win);
  }, attach = () => {
    prune();
    for (const frame of document.querySelectorAll("iframe.docs-texteventtarget-iframe")) {
      let win;
      try {
        if (win = frame.contentWindow, !win || windows.has(win)) continue;
        win.addEventListener("keydown", onKeydown, !0);
      } catch {
        continue;
      }
      windows.add(win);
    }
  };
  attach();
  const timer = setInterval(attach, 1e3), availability = (command) => {
    const blocked = command.name === "paste" ? pasteBlocker() : null;
    return blocked ? "native (" + (blocked === "browser" ? "Docs supports Markdown paste only in Chrome" : "clipboard permission denied") + ")" : findItem(command.icon) ? "markdown" : "native (Markdown command unavailable)";
  };
  window[KEY] = {
    version: VERSION,
    status: () => (prune(), {
      version: VERSION,
      frames: windows.size,
      shortcut: mac ? "⌘" : "Ctrl",
      copy: availability(commands.c),
      paste: availability(commands.v),
      counts: { ...counts },
      last: last && { ...last }
    }),
    destroy() {
      destroyed = !0, clearInterval(timer);
      for (const win of windows)
        try {
          win.removeEventListener("keydown", onKeydown, !0);
        } catch {
        }
      windows.clear();
      for (const remove of permissions.splice(0)) remove();
      window[KEY] === this && delete window[KEY];
    }
  };
})();
