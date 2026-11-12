(() => {
  'use strict';
  const VERSION = '0.1.1';
  const KEY = '__googleDocsMarkdownClipboard';
  window[KEY]?.destroy();
  const mac = /mac|iphone|ipad/i.test(navigator.userAgentData?.platform || navigator.platform);
  const chrome = /(?:Chrome|CriOS)\//.test(navigator.userAgent);
  const commands = {
    c: {name: 'copy', icon: 'markdown-copy-18x18'},
    v: {name: 'paste', icon: 'markdown-paste-18x18'}
  };
  const PLAIN_PASTE = 'editors-ia-paste';
  const counts = {copy: 0, paste: 0, native: 0};
  const denied = {};
  const permissions = [];
  const windows = new Set();
  let last = null;
  let destroyed = false;

  const watchPermission = async name => {
    try {
      const status = await navigator.permissions.query({name});
      if (destroyed) return;
      const update = () => { denied[name] = status.state === 'denied'; };
      update();
      status.addEventListener('change', update);
      permissions.push(() => status.removeEventListener('change', update));
    } catch {}
  };
  watchPermission('clipboard-read');
  watchPermission('clipboard-write');

  const pasteBlocker = () => {
    if (!chrome) return 'browser';
    if (denied['clipboard-read'] || denied['clipboard-write']) return 'permission';
    return null;
  };

  const findItem = icon => {
    for (const node of document.querySelectorAll(`.docs-icon-${icon}`)) {
      const item = node.closest('[role="menuitem"]');
      if (item && item.getAttribute('aria-disabled') !== 'true' && !item.classList.contains('goog-menuitem-disabled') && item.style.display !== 'none') return item;
    }
    return null;
  };

  const activate = item => {
    const init = {bubbles: true, cancelable: true, view: window, button: 0};
    for (const type of ['mouseover', 'mousedown', 'mouseup', 'mouseout']) item.dispatchEvent(new MouseEvent(type, init));
  };

  const shortcut = event => {
    if (!event.isTrusted || event.isComposing || event.altKey || event.shiftKey) return null;
    if (mac ? !event.metaKey || event.ctrlKey : !event.ctrlKey || event.metaKey) return null;
    const key = /^[a-z]$/i.test(event.key) ? event.key.toLowerCase() : {KeyC: 'c', KeyV: 'v'}[event.code];
    return commands[key] || null;
  };

  const fromGoogleEditor = async () => {
    for (const item of await navigator.clipboard.read()) {
      if (item.types.some(type => type.startsWith('web application/x-vnd.google-docs'))) return true;
      if (!item.types.includes('text/html')) continue;
      const html = await (await item.getType('text/html')).text();
      if (html.includes('id="docs-internal-guid-') || html.includes('google-sheets-html-origin')) return true;
    }
    return false;
  };

  const ownCursors = () => [...document.querySelectorAll('.kix-cursor')].filter(cursor => !cursor.querySelector('.kix-cursor-name')?.textContent);
  const cursorState = cursors => cursors.map(cursor => cursor.style.transform + '|' + cursor.style.display).join();

  const backspace = target => {
    const win = target.ownerDocument.defaultView;
    for (const type of ['keydown', 'keyup']) {
      const event = new win.KeyboardEvent(type, {key: 'Backspace', code: 'Backspace', bubbles: true, cancelable: true});
      for (const name of ['keyCode', 'which']) Object.defineProperty(event, name, {get: () => 8});
      target.dispatchEvent(event);
    }
  };

  const endsWithBlock = text => {
    const lines = text.trimEnd().split(/\r?\n/);
    const lastLine = lines.at(-1);
    if (!lastLine.trim()) return true;
    if (/^ {0,3}(?:`{3,}|~{3,})/.test(lastLine) || /^\s*\|/.test(lastLine)) return true;
    return /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/.test(lastLine) && !(lastLine.trim()[0] === '-' && lines.at(-2)?.trim());
  };

  let disarm = null;
  const joinAfterPaste = entry => {
    const listening = [...windows, window];
    const cursors = ownCursors();
    let observer = null;
    let timer = 0;
    const finish = join => {
      entry.join = join;
      disarm?.();
    };
    const interrupt = event => {
      if (event.isTrusted) finish('interrupted');
    };
    const onPaste = event => {
      for (const win of listening) win.removeEventListener('paste', onPaste, true);
      if (!cursors.length) return finish('no-cursor');
      if (endsWithBlock(event.clipboardData?.getData('text/plain') ?? '')) return finish('block-end');
      const target = event.target.ownerDocument.activeElement || event.target;
      const before = cursorState(cursors);
      observer = new MutationObserver(() => {
        if (cursorState(cursors) === before) return;
        finish('joined');
        backspace(target);
      });
      for (const cursor of cursors) observer.observe(cursor, {attributes: true, attributeFilter: ['style']});
    };
    disarm = () => {
      clearTimeout(timer);
      observer?.disconnect();
      for (const win of listening) {
        try {
          win.removeEventListener('paste', onPaste, true);
          win.removeEventListener('keydown', interrupt, true);
          win.removeEventListener('mousedown', interrupt, true);
        } catch {}
      }
      disarm = null;
    };
    for (const win of listening) {
      win.addEventListener('paste', onPaste, true);
      win.addEventListener('keydown', interrupt, true);
      win.addEventListener('mousedown', interrupt, true);
    }
    timer = setTimeout(() => finish('timeout'), 3000);
  };

  const native = (command, reason) => {
    counts.native++;
    last = {command: command.name, outcome: 'native', reason, at: Date.now()};
  };

  const copy = event => {
    const item = findItem(commands.c.icon);
    if (!item) return native(commands.c, 'unavailable');
    event.preventDefault();
    event.stopImmediatePropagation();
    counts.copy++;
    last = {command: 'copy', outcome: 'markdown', at: Date.now()};
    activate(item);
  };

  const paste = event => {
    const blocked = pasteBlocker();
    if (blocked) return native(commands.v, blocked);
    if (!findItem(commands.v.icon) || !findItem(PLAIN_PASTE)) return native(commands.v, 'unavailable');
    event.preventDefault();
    event.stopImmediatePropagation();
    const started = Date.now();
    fromGoogleEditor().then(google => ({google}), error => ({google: false, error: error?.name || 'Error'})).then(({google, error}) => {
      if (destroyed) return;
      const item = findItem(google ? PLAIN_PASTE : commands.v.icon);
      const outcome = !item ? 'failed' : google ? 'native' : 'markdown';
      if (outcome === 'markdown') counts.paste++;
      else if (outcome === 'native') counts.native++;
      last = {command: 'paste', outcome, reason: !item ? 'unavailable' : google ? 'google-editor-content' : error ? 'clipboard-read-' + error : undefined, ms: Date.now() - started, at: Date.now()};
      if (outcome === 'markdown') {
        disarm?.();
        joinAfterPaste(last);
      }
      if (item) activate(item);
    });
  };

  const onKeydown = event => {
    const command = shortcut(event);
    if (!command || event.defaultPrevented) return;
    (command === commands.c ? copy : paste)(event);
  };

  const prune = () => {
    for (const win of windows) {
      if (win.closed) windows.delete(win);
    }
  };
  const attach = () => {
    prune();
    for (const frame of document.querySelectorAll('iframe.docs-texteventtarget-iframe')) {
      let win;
      try {
        win = frame.contentWindow;
        if (!win || windows.has(win)) continue;
        win.addEventListener('keydown', onKeydown, true);
      } catch {
        continue;
      }
      windows.add(win);
    }
  };
  attach();
  const timer = setInterval(attach, 1000);

  const availability = command => {
    const blocked = command.name === 'paste' ? pasteBlocker() : null;
    if (blocked) return 'native (' + (blocked === 'browser' ? 'Docs supports Markdown paste only in Chrome' : 'clipboard permission denied') + ')';
    return findItem(command.icon) ? 'markdown' : 'native (Markdown command unavailable)';
  };

  window[KEY] = {
    version: VERSION,
    status: () => (prune(), {
      version: VERSION,
      frames: windows.size,
      shortcut: mac ? '⌘' : 'Ctrl',
      copy: availability(commands.c),
      paste: availability(commands.v),
      counts: {...counts},
      last: last && {...last}
    }),
    destroy() {
      destroyed = true;
      clearInterval(timer);
      disarm?.();
      for (const win of windows) {
        try { win.removeEventListener('keydown', onKeydown, true); } catch {}
      }
      windows.clear();
      for (const remove of permissions.splice(0)) remove();
      if (window[KEY] === this) delete window[KEY];
    }
  };
})();
