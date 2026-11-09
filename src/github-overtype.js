(() => {
  "use strict";
  const LOG = "[GitHub OverType]", MARK = "data-gh-ot-enhanced", API = "__githubOverType", EDITOR_PADDING = "var(--base-size-8)", FONT_SIZE = "var(--text-body-size-small)", FONT_FAMILY = "var(--fontStack-monospace)", LINE_HEIGHT = "var(--text-body-lineHeight-medium)", GITHUB_THEME = {
    name: "github",
    colors: {
      bgPrimary: "transparent",
      bgSecondary: "transparent",
      text: "var(--fgColor-default)",
      textPrimary: "var(--fgColor-default)",
      textSecondary: "var(--fgColor-muted)",
      // Rendered Markdown uses the normal foreground, not source/diff colors.
      h1: "var(--fgColor-default)",
      h2: "var(--fgColor-default)",
      h3: "var(--fgColor-default)",
      strong: "var(--fgColor-default)",
      em: "var(--fgColor-default)",
      del: "var(--fgColor-default)",
      link: "var(--fgColor-link)",
      code: "var(--fgColor-default)",
      codeBg: "var(--bgColor-neutral-muted)",
      blockquote: "var(--fgColor-muted)",
      hr: "var(--borderColor-muted)",
      syntaxMarker: "var(--fgColor-muted)",
      syntax: "var(--fgColor-muted)",
      cursor: "var(--fgColor-default)",
      selection: "var(--selection-bgColor)",
      listMarker: "var(--fgColor-default)",
      rawLine: "var(--fgColor-default)",
      border: "var(--borderColor-default)",
      hoverBg: "var(--bgColor-muted)",
      primary: "var(--fgColor-accent)",
      toolbarBg: "transparent",
      toolbarIcon: "var(--fgColor-default)",
      toolbarHover: "var(--bgColor-muted)",
      toolbarActive: "var(--bgColor-neutral-muted)",
      placeholder: "var(--control-fgColor-placeholder, var(--fgColor-muted))"
    },
    previewColors: {
      text: "var(--fgColor-default)",
      h1: "var(--fgColor-default)",
      h2: "var(--fgColor-default)",
      h3: "var(--fgColor-default)",
      strong: "var(--fgColor-default)",
      em: "var(--fgColor-default)",
      link: "var(--fgColor-link)",
      code: "var(--fgColor-default)",
      codeBg: "var(--bgColor-neutral-muted)",
      blockquote: "var(--fgColor-muted)",
      hr: "var(--borderColor-muted)",
      bg: "transparent"
    }
  }, OT = window.OverType?.default || window.OverType;
  if (typeof OT != "function") {
    console.error(LOG, "OverType library unavailable");
    return;
  }
  if (!window[API] && document.querySelector(`[${MARK}], .gh-ot-shell`))
    throw new Error(`${LOG} Disable the old Tampermonkey script and reload before applying.`);
  const activeInput = document.activeElement, focusedBridge = activeInput?.matches?.(".gh-ot-shell .overtype-input") ? activeInput.closest(".gh-ot-shell").parentElement.querySelector(`[${MARK}]`) : null, focusedSelection = focusedBridge && [
    activeInput.selectionStart,
    activeInput.selectionEnd,
    activeInput.selectionDirection
  ];
  window[API]?.destroy();
  const records = /* @__PURE__ */ new Map();
  let stopped = !1, scheduled = !1, scanFrame = 0;
  const nativeSetter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value"
  ).set;
  function eligible(el) {
    if (!(el instanceof HTMLTextAreaElement) || el.hasAttribute(MARK) || el.disabled || el.readOnly || el.closest(
      '.gh-ot-shell, .monaco-editor, .CodeMirror, [data-testid="code-editor"], .blob-code'
    )) return !1;
    const name = (el.name || "").toLowerCase(), label = (el.getAttribute("aria-label") || "").toLowerCase(), placeholder = (el.placeholder || "").toLowerCase();
    return el.matches('textarea[data-component="Textarea"]') && (label === "markdown value" || /leave a comment|add a comment|reply/.test(placeholder)) && el.closest([
      '[class*="CommentBox"]',
      '[class*="AddCommentEditor"]',
      '[class*="commentBoxContainer"]',
      "[data-marker-navigation-new-thread]",
      '[data-testid*="comment"]'
    ].join(",")) ? !0 : /comment\[body\]|review\[body\]|issue\[body\]|discussion\[body\]|^body$/.test(name) || /markdown value|comment body/.test(label) || /leave a comment|write a comment|add a comment/.test(placeholder);
  }
  const style = document.createElement("style");
  style.dataset.githubOvertypeStyle = "", style.textContent = `
    .gh-ot-active { position: relative; }
    .gh-ot-active > textarea[${MARK}] {

      color: transparent !important;
      -webkit-text-fill-color: transparent !important;
      pointer-events: none !important;
      caret-color: transparent !important;
      display: block !important;
    }
    .gh-ot-active > textarea[${MARK}]::placeholder {
      color: transparent !important;
      -webkit-text-fill-color: transparent !important;
      opacity: 0 !important;
    }
    .gh-ot-shell {
      position: absolute;
      inset: 0;
      z-index: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      overflow: hidden;
      border-radius: 4px;
      background: transparent;
      color: var(--fgColor-default);
      box-sizing: border-box;
    }
    .gh-ot-host {
      position: relative;
      flex: 1 1 auto;
      width: 100%;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
      background: transparent;
    }
    .gh-ot-host .overtype-container,
    .gh-ot-host .overtype-wrapper {
      background: transparent !important;
      min-height: 0 !important;
    }

    .gh-ot-active > textarea[${MARK}],
    .gh-ot-host .overtype-container,
    .gh-ot-host .overtype-wrapper,
    .gh-ot-host .overtype-wrapper .overtype-input,
    .gh-ot-host .overtype-wrapper .overtype-preview,
    .gh-ot-host .overtype-wrapper .overtype-preview * {
      font-family: ${FONT_FAMILY} !important;
      font-size: ${FONT_SIZE} !important;
      line-height: ${LINE_HEIGHT} !important;
      letter-spacing: 0 !important;
      font-variant-ligatures: none !important;
      font-kerning: none !important;
      font-synthesis: none !important;
      tab-size: 4 !important;
      text-transform: none !important;
      text-indent: 0 !important;
      box-sizing: border-box;
    }
    .gh-ot-host .overtype-input,
    .gh-ot-host .overtype-preview {
      padding: ${EDITOR_PADDING} !important;
      margin: 0 !important;
      border: 0 !important;
      border-radius: 0 !important;
      outline: 0 !important;
      box-shadow: none !important;
      background: transparent !important;
      tab-size: 4 !important;
      white-space: pre-wrap !important;
      overflow-wrap: anywhere !important;
      word-break: normal !important;
    }
    .gh-ot-host .overtype-preview,
    .gh-ot-host .overtype-preview * {
      font-weight: var(--text-body-weight) !important;
      font-style: normal !important;
    }
    .gh-ot-host .overtype-input {
      color: transparent !important;
      -webkit-text-fill-color: transparent !important;
      caret-color: var(--fgColor-default) !important;
      resize: none !important;
    }
    .gh-ot-host .overtype-input::placeholder {
      color: transparent !important;
      -webkit-text-fill-color: transparent !important;
      opacity: 0 !important;
    }

    .gh-ot-host .overtype-preview pre.code-block,
    .gh-ot-host .overtype-preview pre.code-block > code,
    .gh-ot-host .overtype-preview .code-block-line {
      border-radius: 0 !important;
    }
    .gh-ot-host .overtype-input:focus {
      outline: 0 !important;
      box-shadow: none !important;
    }
    .gh-ot-active:focus-within {
      outline: 2px solid var(--focus-outlineColor) !important;
      outline-offset: -2px;
    }
  `, document.head.appendChild(style);
  function sendValue(original, value, selection) {
    original.value !== value && (nativeSetter.call(original, value), selection && original.setSelectionRange(...selection), original.dispatchEvent(new InputEvent("input", {
      bubbles: !0,
      inputType: "insertText"
    })), original.dispatchEvent(new Event("change", { bubbles: !0 })));
  }
  function getWrapper(original) {
    return original.closest('[data-component="TextInput"]') || original.parentElement;
  }
  function parseFence(line) {
    const match = /^( {0,3})(`{3,}|~{3,})(.*)$/.exec(line);
    return match && { indent: match[1], marker: match[2], info: match[3] };
  }
  function closesFence(candidate, opening) {
    return candidate && candidate.marker[0] === opening.marker[0] && candidate.marker.length >= opening.marker.length && /^[ \t]*$/.test(candidate.info);
  }
  function fenceBefore(text) {
    let opening = null;
    for (const line of text.split(`
`)) {
      const fence = parseFence(line);
      fence && (opening ? closesFence(fence, opening) && (opening = null) : (fence.marker[0] !== "`" || !fence.info.includes("`")) && (opening = fence));
    }
    return opening;
  }
  function enhance(original) {
    if (!eligible(original)) return;
    const wrapper = getWrapper(original);
    if (!wrapper || wrapper.classList.contains("gh-ot-active")) return;
    const oldStyle = wrapper.getAttribute("style"), oldAria = original.getAttribute("aria-hidden"), oldTabIndex = original.getAttribute("tabindex"), oldInert = original.getAttribute("inert"), oldOwnFocus = Object.getOwnPropertyDescriptor(original, "focus"), wasFocused = document.activeElement === original || original === focusedBridge, initialSelection = original === focusedBridge ? focusedSelection : [
      original.selectionStart,
      original.selectionEnd,
      original.selectionDirection
    ], resize = getComputedStyle(original).resize;
    original.setAttribute(MARK, "1");
    const shell = document.createElement("div");
    shell.className = "gh-ot-shell", shell.dataset.mode = "overtype";
    const host = document.createElement("div");
    host.className = "gh-ot-host", shell.append(host), wrapper.append(shell), wrapper.classList.add("gh-ot-active"), getComputedStyle(wrapper).position === "static" && (wrapper.style.position = "relative");
    let editor, editorInput, disposed = !1, writing = !1, lastValue = original.value;
    const restoreNative = () => {
      wrapper.classList.remove("gh-ot-active"), original.removeAttribute("aria-hidden"), oldAria !== null && original.setAttribute("aria-hidden", oldAria), oldTabIndex === null ? original.removeAttribute("tabindex") : original.setAttribute("tabindex", oldTabIndex), oldInert === null ? original.removeAttribute("inert") : original.setAttribute("inert", oldInert);
    }, hideNative = () => {
      wrapper.classList.add("gh-ot-active"), original.setAttribute("aria-hidden", "true"), original.setAttribute("tabindex", "-1"), original.inert = !0;
    }, updateGitHub = (value) => {
      if (!(disposed || writing || value === original.value)) {
        writing = !0;
        try {
          const selection = editorInput && [
            editorInput.selectionStart,
            editorInput.selectionEnd,
            editorInput.selectionDirection
          ];
          sendValue(original, value, selection), lastValue = original.value, editor && editor.getValue() !== lastValue && (editor.setValue(lastValue), editorInput?.setSelectionRange(
            original.selectionStart,
            original.selectionEnd,
            original.selectionDirection
          ));
        } finally {
          writing = !1;
        }
      }
    };
    try {
      const result = new OT(host, {
        value: original.value,
        placeholder: original.placeholder || "",
        toolbar: !1,
        showStats: !1,
        smartLists: !0,
        theme: GITHUB_THEME,
        fontFamily: FONT_FAMILY,
        codeHighlighter: window.__githubOverTypeHighlighter?.highlight || null,
        fontSize: FONT_SIZE,
        lineHeight: LINE_HEIGHT,
        padding: EDITOR_PADDING,
        mobile: { fontSize: FONT_SIZE, lineHeight: LINE_HEIGHT, padding: EDITOR_PADDING },
        autoResize: !1,
        minHeight: "0px",
        spellcheck: original.spellcheck,
        fileUpload: { enabled: !1 },
        onChange: updateGitHub
      });
      if (editor = Array.isArray(result) ? result[0] : result, !editor?.getValue || !editor?.setValue) throw new Error("Invalid OverType instance");
      if (editorInput = host.querySelector(".overtype-input"), !editorInput) throw new Error("OverType input unavailable");
      for (const layer of host.querySelectorAll(".overtype-input, .overtype-preview"))
        layer.style.setProperty("padding", EDITOR_PADDING, "important");
    } catch (error) {
      console.error(LOG, error);
      try {
        editor?.destroy();
      } catch {
      }
      shell.remove(), wrapper.classList.remove("gh-ot-active"), oldStyle === null ? wrapper.removeAttribute("style") : wrapper.setAttribute("style", oldStyle), original.removeAttribute(MARK);
      return;
    }
    function insertAtCaret(text, caretOffset = text.length) {
      const start = editorInput.selectionStart, end = editorInput.selectionEnd;
      document.execCommand("insertText", !1, text) || editorInput.setRangeText(text, start, end, "end");
      const caret = start + caretOffset;
      editorInput.setSelectionRange(caret, caret), editorInput.dispatchEvent(new InputEvent("input", {
        bubbles: !0,
        inputType: "insertText",
        data: text
      })), original.value === editorInput.value && original.setSelectionRange(caret, caret);
    }
    function handleFenceEnter(event) {
      if (event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return !1;
      const { value, selectionStart: start, selectionEnd: end } = editorInput, lineStart = value.slice(0, start).lastIndexOf(`
`) + 1;
      let lineEnd = value.indexOf(`
`, start);
      lineEnd < 0 && (lineEnd = value.length);
      const line = value.slice(lineStart, lineEnd), opening = fenceBefore(value.slice(0, lineStart)), fence = parseFence(line);
      if (opening) {
        if (closesFence(fence, opening)) return !1;
        const indent = value.slice(lineStart, start).match(/^[ \t]*/)[0];
        return event.preventDefault(), insertAtCaret(`
` + indent), !0;
      }
      if (start !== end || start !== lineEnd || !fence || fence.marker[0] === "`" && fence.info.includes("`")) return !1;
      const alreadyClosed = value.slice(lineEnd + 1).split(`
`).some((next) => closesFence(parseFence(next), fence)), newline = `
` + fence.indent;
      return event.preventDefault(), insertAtCaret(alreadyClosed ? newline : newline + `
` + fence.indent + fence.marker, newline.length), !0;
    }
    editorInput.style.setProperty("resize", resize === "none" ? "none" : "vertical", "important");
    const resizeObserver = new MutationObserver(() => {
      const requested = parseFloat(editorInput.style.height);
      if (!Number.isFinite(requested)) return;
      const css = getComputedStyle(original);
      const inset = css.boxSizing === "border-box" ? 0 :
        parseFloat(css.paddingTop) + parseFloat(css.paddingBottom) +
        parseFloat(css.borderTopWidth) + parseFloat(css.borderBottomWidth);
      original.style.height = `${Math.max(0, requested - inset)}px`;
      editorInput.style.removeProperty("height");
    });
    resizeObserver.observe(editorInput, { attributes: true, attributeFilter: ["style"] });
    const autocompleteAttributes = [
      "role",
      "aria-expanded",
      "aria-controls",
      "aria-activedescendant",
      "aria-autocomplete",
      "aria-haspopup"
    ], mirrorAutocomplete = () => {
      for (const name of autocompleteAttributes) {
        const value = original.getAttribute(name);
        value === null ? editorInput.removeAttribute(name) : editorInput.setAttribute(name, value);
      }
    }, autocompleteObserver = new MutationObserver(mirrorAutocomplete);
    autocompleteObserver.observe(original, { attributes: !0, attributeFilter: autocompleteAttributes }), mirrorAutocomplete();
    function forwardAutocompleteKey(event) {
      if (event.isComposing || event.keyCode === 229 || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || !["Enter", "Tab", "Escape", "ArrowUp", "ArrowDown"].includes(event.key) || original.getAttribute("aria-expanded") !== "true" || !(original.getAttribute("aria-controls") || "").split(/\s+/).map((id) => document.getElementById(id)).find((el) => el?.getAttribute("role") === "listbox" && el.getClientRects().length && getComputedStyle(el).visibility !== "hidden")) return !1;
      original.setSelectionRange(editorInput.selectionStart, editorInput.selectionEnd, editorInput.selectionDirection);
      const forwarded = new KeyboardEvent("keydown", {
        key: event.key,
        code: event.code,
        keyCode: event.keyCode,
        which: event.which,
        bubbles: !0,
        cancelable: !0,
        composed: !0,
        repeat: event.repeat
      }), before = original.value;
      return original.dispatchEvent(forwarded), syncFromNative(), mirrorAutocomplete(), !forwarded.defaultPrevented && original.value === before ? !1 : (event.preventDefault(), event.stopPropagation(), !0);
    }
    const onEditorKeyDown = (event) => {
      disposed || forwardAutocompleteKey(event) || (!event.isComposing && event.keyCode !== 229 && !handleFenceEnter(event) && editor.handleKeydown(event), event.stopPropagation());
    };
    editorInput.addEventListener("keydown", onEditorKeyDown);
    function syncFromNative() {
      if (disposed || writing) return;
      const current = original.value;
      current !== lastValue && (lastValue = current, editor.getValue() !== current && (editor.setValue(current), editorInput.setSelectionRange(
        original.selectionStart,
        original.selectionEnd,
        original.selectionDirection
      )));
    }
    const onNativeFocus = () => {
      disposed || (syncFromNative(), hideNative(), editor.focus());
    };
    original.addEventListener("focus", onNativeFocus), original.addEventListener("input", syncFromNative), original.addEventListener("change", syncFromNative);
    const notifyNativeFocus = (event) => {
      if (!disposed) original.dispatchEvent(new FocusEvent("focusin", {
        bubbles: !0,
        composed: !0,
        relatedTarget: event.relatedTarget
      }));
    };
    editorInput.addEventListener("focus", notifyNativeFocus);
    const forwardFocus = (options) => {
      disposed || (syncFromNative(), editorInput.focus(options));
    };
    (!oldOwnFocus || oldOwnFocus.configurable) && Object.defineProperty(original, "focus", {
      configurable: !0,
      writable: !0,
      value: forwardFocus
    }), hideNative();
    const record = {
      original,
      wrapper,
      shell,
      sync: syncFromNative,
      cleanup() {
        if (!disposed) {
          disposed = !0, editorInput.removeEventListener("focus", notifyNativeFocus), resizeObserver.disconnect(), autocompleteObserver.disconnect(), editorInput.removeEventListener("keydown", onEditorKeyDown), original.removeEventListener("focus", onNativeFocus), original.removeEventListener("input", syncFromNative), original.removeEventListener("change", syncFromNative), original.focus === forwardFocus && (oldOwnFocus ? Object.defineProperty(original, "focus", oldOwnFocus) : delete original.focus);
          try {
            editor.destroy();
          } catch {
          }
          restoreNative(), oldStyle === null ? wrapper.removeAttribute("style") : wrapper.setAttribute("style", oldStyle), original.removeAttribute(MARK), shell.remove(), records.delete(original);
        }
      }
    };
    records.set(original, record), wasFocused && (editor.focus(), editorInput.setSelectionRange(...initialSelection)), console.debug(LOG, "Enhanced:", original);
  }
  function scan() {
    if (scheduled = !1, !stopped) {
      for (const [el, record] of records)
        (!el.isConnected || !record.wrapper.isConnected || !record.shell.isConnected || record.shell.parentNode !== record.wrapper) && record.cleanup();
      document.querySelectorAll("textarea").forEach(enhance);
    }
  }
  function scheduleScan() {
    stopped || scheduled || (scheduled = !0, scanFrame = requestAnimationFrame(scan));
  }
  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.documentElement, { childList: !0, subtree: !0 }), document.addEventListener("turbo:load", scheduleScan), document.addEventListener("turbo:render", scheduleScan);
  const interval = setInterval(() => {
    records.forEach((r) => r.sync()), scheduleScan();
  }, 750), api = {
    version: "0.1.3",
    status: () => ({ version: api.version, editors: records.size, stopped }),
    destroy() {
      stopped || (stopped = !0, observer.disconnect(), cancelAnimationFrame(scanFrame), clearInterval(interval), document.removeEventListener("turbo:load", scheduleScan), document.removeEventListener("turbo:render", scheduleScan), records.forEach((r) => r.cleanup()), style.remove(), window[API] === api && delete window[API], console.info(LOG, "Stopped"));
    }
  };
  window[API] = api, scan(), console.info(LOG, "Initialized", api.version);
})();
