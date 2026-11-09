(() => {
  'use strict';
  const VERSION = '0.1.0';
  const KEY = '__googleDocsCopyMarkdown';
  window[KEY]?.destroy();
  const prefix = 'gdocs-copy-md';
  const SVG = 'http://www.w3.org/2000/svg';
  const labels = {idle: 'Copy as Markdown', busy: 'Copying…', done: 'Copied', fail: 'Copy failed', retry: 'Copy interrupted'};
  const STORAGE = 'gdocs-copy-md:click';
  const choices = {comments: 'Markdown with comments', markdown: 'Markdown only'};
  const icons = {
    idle: ['M4 5h16a2.5 2.5 0 0 1 2.5 2.5v9A2.5 2.5 0 0 1 20 19H4a2.5 2.5 0 0 1-2.5-2.5v-9A2.5 2.5 0 0 1 4 5zm0 1.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1z', 'M5 15.5v-7h2l2 2.6 2-2.6h2v7h-2v-4.2l-2 2.5-2-2.5v4.2z', 'M16.5 8.5h2V12h2l-3 3.5-3-3.5h2z'],
    done: ['M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'],
    fail: ['M11 15h2v2h-2zm0-8h2v6h-2zm1-5a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16z']
  };
  icons.busy = icons.retry = icons.idle;
  const style = document.createElement('style');
  style.textContent = `
    .${prefix}-container {
      display: inline-flex;
      align-items: center;
      height: 42px;
      margin: 0 4px;
      vertical-align: middle;
    }
    .${prefix}-button {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      width: 42px;
      height: 42px;
      margin: 0;
      padding: 0;
      border: 0;
      border-radius: 9999px;
      background: transparent;
      color: #444746;
      cursor: pointer;
    }
    .${prefix}-button svg { width: 24px; height: 24px; fill: currentColor; pointer-events: none; }
    .${prefix}-button:hover { background: rgba(68, 71, 70, 0.08); }
    .${prefix}-button:active { background: rgba(68, 71, 70, 0.12); }
    .${prefix}-button:focus-visible { outline: 2px solid #0b57d0; outline-offset: -2px; }
    .${prefix}-button[data-state="busy"] { cursor: progress; }
    .${prefix}-button[data-state="busy"] svg { animation: ${prefix}-pulse 0.9s ease-in-out infinite alternate; }
    .${prefix}-button[data-state="done"] { color: #146c2e; }
    .${prefix}-button[data-state="fail"] { color: #b3261e; }
    .${prefix}-button[data-state="retry"] { color: #8c5000; background: rgba(140, 80, 0, 0.12); }
    .${prefix}-button[data-comments="true"][data-state="idle"]::after {
      content: "";
      position: absolute;
      top: 8px;
      right: 7px;
      width: 8px;
      height: 8px;
      border: 2px solid #fff;
      border-radius: 50%;
      background: #0b57d0;
    }
    @keyframes ${prefix}-pulse { from { opacity: 1; } to { opacity: 0.35; } }
    .${prefix}-menu {
      position: fixed;
      z-index: 2147483000;
      min-width: 230px;
      padding: 6px 0;
      border-radius: 8px;
      background: #fff;
      box-shadow: 0 2px 6px 2px rgba(60, 64, 67, 0.15), 0 1px 2px rgba(60, 64, 67, 0.3);
      color: #1f1f1f;
      font: 14px/20px "Google Sans", Roboto, RobotoDraft, Helvetica, Arial, sans-serif;
    }
    .${prefix}-menu[hidden] { display: none; }
    .${prefix}-menu-heading, .${prefix}-menu-note { padding: 4px 16px; color: #444746; font-size: 12px; line-height: 16px; }
    .${prefix}-menu-item {
      display: flex;
      align-items: center;
      gap: 8px;
      box-sizing: border-box;
      width: 100%;
      height: 36px;
      margin: 0;
      padding: 0 16px 0 12px;
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    .${prefix}-menu-item::before { content: ""; width: 20px; color: #0b57d0; text-align: center; }
    .${prefix}-menu-item[aria-checked="true"]::before { content: "✓"; }
    .${prefix}-menu-item:hover, .${prefix}-menu-item:focus { background: rgba(31, 31, 31, 0.08); outline: none; }
    .${prefix}-status {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  `;
  document.head.append(style);
  const container = document.createElement('div');
  container.className = `${prefix}-container`;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `${prefix}-button`;
  const live = document.createElement('span');
  live.className = `${prefix}-status`;
  live.setAttribute('role', 'status');
  container.append(button, live);
  button.setAttribute('aria-haspopup', 'menu');
  button.setAttribute('aria-expanded', 'false');
  const menu = document.createElement('div');
  menu.className = `${prefix}-menu`;
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', 'Copy as Markdown default');
  menu.hidden = true;
  const heading = document.createElement('div');
  heading.className = `${prefix}-menu-heading`;
  heading.setAttribute('aria-hidden', 'true');
  heading.textContent = 'Click copies';
  const items = Object.entries(choices).map(([value, label]) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `${prefix}-menu-item`;
    item.setAttribute('role', 'menuitemradio');
    item.dataset.value = value;
    item.tabIndex = -1;
    item.textContent = label;
    return item;
  });
  const menuNote = document.createElement('div');
  menuNote.className = `${prefix}-menu-note`;
  menuNote.setAttribute('aria-hidden', 'true');
  menuNote.textContent = 'Shift, ⌘ or Ctrl-click copies the other';
  menu.append(heading, ...items, menuNote);
  let primary = loadPrimary(), previousFocus = null, state = 'idle', detail = '', stopped = false, resetTimer = 0, copies = 0, policy = null, pending = null;
  const failures = [];

  function icon(paths) {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    for (const d of paths) {
      const path = document.createElementNS(SVG, 'path');
      path.setAttribute('d', d);
      path.setAttribute('fill-rule', 'evenodd');
      svg.append(path);
    }
    return svg;
  }

  function loadPrimary() {
    try {
      return localStorage.getItem(STORAGE) === 'markdown' ? 'markdown' : 'comments';
    } catch {
      return 'comments';
    }
  }

  const includesComments = event => (primary === 'comments') !== !!(event?.shiftKey || event?.metaKey || event?.ctrlKey);

  function hint() {
    const other = primary === 'comments' ? 'without' : 'with';
    return {
      title: `Copy as ${choices[primary]}\nShift, ⌘ or Ctrl-click: copy ${other} comments\nRight-click: change the default`,
      label: `Copy as ${choices[primary]}. Shift, Command or Control-click copies ${other} comments. Open the context menu to change the default.`
    };
  }

  function show(next, message = '') {
    clearTimeout(resetTimer);
    if (next !== 'retry') pending = null;
    state = next;
    detail = message;
    button.dataset.state = next;
    button.replaceChildren(icon(icons[next]));
    const summary = next === 'idle' ? hint().title : message ? `${labels[next]}: ${message}` : labels[next];
    button.title = summary;
    button.setAttribute('aria-label', next === 'idle' ? hint().label : summary);
    live.textContent = next === 'idle' ? '' : summary;
    const reset = {done: 2000, fail: 6000, retry: 30000}[next];
    if (reset) resetTimer = setTimeout(() => show('idle'), reset);
  }

  function exportUrl(format = 'md', loc = location) {
    const match = loc.pathname.match(/^(\/document(?:\/u\/\d+)?\/d\/[^/]+)/);
    if (!match) return null;
    const url = new URL(`${match[1]}/export`, loc.origin);
    url.searchParams.set('format', format);
    const authuser = new URLSearchParams(loc.search).get('authuser');
    if (authuser) url.searchParams.set('authuser', authuser);
    return url.href;
  }

  async function fetchExport(format) {
    const response = await fetch(exportUrl(format), {credentials: 'same-origin', cache: 'no-store'});
    if (!response.ok) throw Error(`Export failed with HTTP ${response.status}`);
    const type = response.headers.get('content-type') || '';
    if (/html/i.test(type)) throw Error('Export returned a web page instead of a document');
    if (format === 'md') return response.text();
    if (!/officedocument|zip|octet-stream/i.test(type)) throw Error('Export returned unexpected content instead of a Word document');
    return response.arrayBuffer();
  }

  async function unzip(buffer, names) {
    const bytes = new Uint8Array(buffer), view = new DataView(buffer), decoder = new TextDecoder();
    let end = bytes.length - 22;
    while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end--;
    if (end < 0) throw Error('Could not read the Word export');
    const files = {};
    for (let i = 0, p = view.getUint32(end + 16, true), count = view.getUint16(end + 10, true); i < count; i++) {
      if (view.getUint32(p, true) !== 0x02014b50) throw Error('Could not read the Word export');
      const nameLength = view.getUint16(p + 28, true);
      const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLength));
      if (names.includes(name)) files[name] = {method: view.getUint16(p + 10, true), size: view.getUint32(p + 20, true), offset: view.getUint32(p + 42, true)};
      p += 46 + nameLength + view.getUint16(p + 30, true) + view.getUint16(p + 32, true);
    }
    const read = async ({method, size, offset}) => {
      const start = offset + 30 + view.getUint16(offset + 26, true) + view.getUint16(offset + 28, true);
      const data = bytes.subarray(start, start + size);
      if (method === 0) return decoder.decode(data);
      if (method !== 8) throw Error('Unsupported compression in the Word export');
      return new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
    };
    return Object.fromEntries(await Promise.all(Object.entries(files).map(async ([name, file]) => [name, await read(file)])));
  }

  function parseXml(xml) {
    if (window.trustedTypes?.createPolicy) {
      policy ||= window.trustedTypes.createPolicy(`${prefix}-export`, {createHTML: value => value});
      xml = policy.createHTML(xml);
    }
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw Error('Could not read the Word export');
    return doc;
  }

  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const flat = value => (value || '').replace(/\s+/g, ' ').trim();
  const key = value => (value || '').toLowerCase().replace(/[\s!-/:-@[-`{-~\p{Co}\u200b-\u200d\ufeff]+/gu, '');

  function readParagraphs(doc) {
    const paragraphs = [], ranges = new Map();
    const mark = (id, side, index, offset) => {
      if (!ranges.has(id)) ranges.set(id, {});
      ranges.get(id)[side] = {index, offset};
    };
    for (const p of doc.getElementsByTagNameNS(W, 'p')) {
      const index = paragraphs.length;
      let text = '';
      const walk = node => {
        for (const child of node.children) {
          if (child.namespaceURI !== W) { walk(child); continue; }
          const name = child.localName;
          if (name === 'p' || name === 'delText') continue;
          if (name === 't') text += child.textContent;
          else if (name === 'tab') text += '\t';
          else if (name === 'br' || name === 'cr') text += '\n';
          else if (name === 'commentRangeStart') mark(child.getAttributeNS(W, 'id'), 'start', index, text.length);
          else if (name === 'commentRangeEnd') mark(child.getAttributeNS(W, 'id'), 'end', index, text.length);
          else walk(child);
        }
      };
      walk(p);
      paragraphs.push(text);
    }
    return {paragraphs, ranges};
  }

  function readComments(doc) {
    return [...doc.getElementsByTagNameNS(W, 'comment')].map(comment => ({
      id: comment.getAttributeNS(W, 'id'),
      author: flat(comment.getAttributeNS(W, 'author')),
      body: [...comment.getElementsByTagNameNS(W, 'p')].map(p => [...p.getElementsByTagNameNS(W, 't')].map(t => t.textContent).join('')).join('\n').trim()
    }));
  }

  function quoteOf(paragraphs, {start, end}) {
    if (!start || !end) return '';
    if (start.index === end.index) return paragraphs[start.index].slice(start.offset, end.offset);
    return [paragraphs[start.index].slice(start.offset), ...paragraphs.slice(start.index + 1, end.index), paragraphs[end.index].slice(0, end.offset)].join('\n');
  }

  function markdownBlocks(lines) {
    const blocks = [];
    const listItem = /^(\s*)([-*+]|\d+[.)])(\s+)/;
    const boundary = /^\s*(`{3,}|~{3,}|#{1,6}\s|\|)/;
    for (let i = 0; i < lines.length;) {
      const line = lines[i];
      if (!line.trim()) { i++; continue; }
      const start = i;
      let indent = '';
      const fence = line.match(/^(\s*)(`{3,}|~{3,})/);
      const item = line.match(listItem);
      if (fence) {
        indent = fence[1];
        for (i++; i < lines.length && !lines[i].trimStart().startsWith(fence[2]); i++);
        i++;
      } else if (/^\s*\|/.test(line)) {
        while (i < lines.length && /^\s*\|/.test(lines[i])) i++;
      } else if (/^#{1,6}\s/.test(line)) {
        i++;
      } else {
        if (item) indent = item[1] + ' '.repeat(item[2].length + item[3].length);
        for (i++; i < lines.length && lines[i].trim() && !listItem.test(lines[i]) && !boundary.test(lines[i]); i++);
      }
      const source = lines.slice(start, i).join('\n').replace(/^\[[^\]]+\]:\s*<data:[^>]*>$/gm, '').replace(/\]\((?:[^()\s]|\([^()]*\))*\)/g, ']');
      blocks.push({end: Math.min(i, lines.length), indent, key: key(source)});
    }
    return blocks;
  }

  function locate(paragraphs, blocks) {
    const starts = [];
    let all = '';
    for (const block of blocks) {
      starts.push(all.length);
      all += block.key;
    }
    let cursor = 0, current = -1;
    return paragraphs.map(text => {
      const wanted = key(text);
      const at = wanted ? all.indexOf(wanted, cursor) : -1;
      if (at >= 0) {
        cursor = at + wanted.length;
        current = 0;
        while (current + 1 < starts.length && starts[current + 1] <= at) current++;
      }
      return current;
    });
  }

  const safe = value => value.replace(/<!--/g, '<! --').replace(/--!?>/g, '-- >');

  function note(thread, quote, emptyLine) {
    const [root, ...replies] = thread;
    const short = quote.length > 100 ? `${quote.slice(0, 100).trimEnd()}…` : quote;
    const where = short ? ` on “${short}”` : emptyLine ? ' on an empty line' : '';
    const lines = [`Comment${root.author ? ` from ${root.author}` : ''}${where}: ${root.body}`, ...replies.map(reply => `Reply${reply.author ? ` from ${reply.author}` : ''}: ${reply.body}`)];
    const text = safe(lines.join('\n'));
    return text.includes('\n') ? ['<!--', ...text.split('\n'), '-->'] : [`<!-- ${text} -->`];
  }

  async function withComments(markdown, docx) {
    const files = await unzip(docx, ['word/document.xml', 'word/comments.xml']);
    if (!files['word/comments.xml'] || !files['word/document.xml']) return {text: markdown, count: 0};
    const {paragraphs, ranges} = readParagraphs(parseXml(files['word/document.xml']));
    const threads = new Map();
    for (const comment of readComments(parseXml(files['word/comments.xml']))) {
      const range = ranges.get(comment.id);
      if (!range?.start) continue;
      const position = `${range.start.index}:${range.start.offset}:${range.end?.index}:${range.end?.offset}`;
      if (!threads.has(position)) threads.set(position, {range, comments: []});
      threads.get(position).comments.push(comment);
    }
    if (!threads.size) return {text: markdown, count: 0};
    const lines = markdown.split('\n');
    const blocks = markdownBlocks(lines);
    const owners = locate(paragraphs, blocks);
    const inserts = new Map();
    const ordered = [...threads.values()].sort((a, b) => a.range.start.index - b.range.start.index || a.range.start.offset - b.range.start.offset);
    for (const {range, comments} of ordered) {
      const owner = owners[range.start.index];
      const quote = flat(quoteOf(paragraphs, range));
      const emptyLine = !quote && !key(paragraphs[range.start.index]);
      if (!inserts.has(owner)) inserts.set(owner, []);
      inserts.get(owner).push(...note(comments, quote, emptyLine).map(line => (blocks[owner]?.indent || '') + line));
    }
    for (const owner of [...inserts.keys()].sort((a, b) => b - a)) {
      if (owner < 0) {
        lines.splice(0, 0, ...inserts.get(owner), '');
        continue;
      }
      const at = blocks[owner].end;
      lines.splice(at, 0, '', ...inserts.get(owner), ...(at < lines.length && lines[at] !== '' ? [''] : []));
    }
    return {text: lines.join('\n'), count: threads.size};
  }

  async function writeClipboard(markdown) {
    if (typeof ClipboardItem === 'function' && navigator.clipboard?.write) {
      try {
        const blob = markdown.then(text => new Blob([text], {type: 'text/plain'}));
        await navigator.clipboard.write([new ClipboardItem({'text/plain': blob})]);
        return;
      } catch (error) {
        await markdown;
        if (!navigator.clipboard?.writeText) throw error;
        await whenFocused();
      }
    }
    await navigator.clipboard.writeText(await markdown);
  }

  const tag = phase => error => {
    throw Object.assign(error instanceof Error ? error : Error(String(error)), {phase: error?.phase || phase});
  };

  function render(comments) {
    if (!comments) return fetchExport('md').catch(tag('export')).then(text => ({text, count: null}));
    return Promise.all([fetchExport('md'), fetchExport('docx')]).catch(tag('export')).then(([markdown, docx]) => withComments(markdown, docx).catch(tag('comments')));
  }

  async function whenFocused(limit = 1500) {
    for (const until = performance.now() + limit; !document.hasFocus() && performance.now() < until;) await new Promise(resolve => setTimeout(resolve, 50));
  }

  function fail(phase, error, started, comments, value, focusedAtClick) {
    const entry = {
      at: new Date().toISOString(),
      phase,
      name: error?.name || 'Error',
      message: error?.message || String(error),
      ms: Math.round(performance.now() - started),
      comments,
      focusedAtClick,
      focused: document.hasFocus(),
      visibility: document.visibilityState
    };
    failures.push(entry);
    if (failures.length > 10) failures.shift();
    console.warn('[Google Docs Copy as Markdown] copy failed', entry);
    if (phase === 'clipboard' && value && entry.name === 'NotAllowedError') {
      show('retry', `${entry.focused ? 'the browser blocked clipboard access' : 'the tab lost focus before copying finished'}. Click to copy`);
      pending = value;
    } else show('fail', entry.message);
  }

  function succeed({text, count}) {
    copies++;
    const noun = count === 1 ? 'comment' : 'comments';
    show('done', `${text.length.toLocaleString()} characters${count === null ? '' : `, ${count} ${noun}`}`);
  }

  async function copy(event) {
    closeMenu(false);
    if (state === 'busy') return;
    if (!exportUrl()) return show('fail', 'This page is not a Google Doc');
    const started = performance.now(), focusedAtClick = document.hasFocus();
    if (state === 'retry' && pending) {
      const value = pending;
      show('busy');
      try {
        await whenFocused();
        await navigator.clipboard.writeText(value.text);
        if (!stopped) succeed(value);
      } catch (error) {
        if (!stopped) fail('clipboard', error, started, value.count !== null, value, focusedAtClick);
      }
      return;
    }
    const comments = includesComments(event);
    const result = render(comments);
    show('busy');
    result.catch(() => {});
    try {
      await writeClipboard(result.then(value => value.text));
    } catch (error) {
      if (stopped) return;
      const outcome = await result.then(value => ({value}), problem => ({problem}));
      return outcome.problem ? fail(outcome.problem.phase || 'export', outcome.problem, started, comments, null, focusedAtClick) : fail('clipboard', error, started, comments, outcome.value, focusedAtClick);
    }
    if (!stopped) succeed(await result);
  }

  function keepEditorFocus(event) {
    if (event.button === 0 || event.button === 2) event.preventDefault();
  }

  function trackModifiers(event) {
    const active = event.type !== 'pointerleave' && includesComments(event);
    if (button.dataset.comments !== String(active)) button.dataset.comments = String(active);
  }

  function choose(value, announce = true) {
    primary = value === 'markdown' ? 'markdown' : 'comments';
    if (state === 'idle') show('idle');
    if (announce) live.textContent = `Click now copies ${choices[primary]}`;
  }

  function openMenu(event) {
    event.preventDefault();
    if (!menu.hidden) return closeMenu(true);
    previousFocus = document.activeElement;
    for (const item of items) item.setAttribute('aria-checked', String(item.dataset.value === primary));
    document.body.append(menu);
    menu.hidden = false;
    const rect = button.getBoundingClientRect();
    menu.style.top = `${Math.round(rect.bottom + 4)}px`;
    menu.style.left = `${Math.round(Math.max(8, Math.min(rect.right - menu.offsetWidth, innerWidth - menu.offsetWidth - 8)))}px`;
    button.setAttribute('aria-expanded', 'true');
    items.find(item => item.dataset.value === primary).focus();
    document.addEventListener('pointerdown', dismissOutside, true);
    window.addEventListener('blur', dismiss);
  }

  function closeMenu(restoreFocus) {
    if (menu.hidden) return;
    menu.hidden = true;
    menu.remove();
    button.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', dismissOutside, true);
    window.removeEventListener('blur', dismiss);
    if (restoreFocus && previousFocus?.isConnected) previousFocus.focus();
    previousFocus = null;
  }

  const dismiss = () => closeMenu(false);

  function dismissOutside(event) {
    if (!menu.contains(event.target) && event.target !== button) closeMenu(false);
  }

  function menuKey(event) {
    const index = items.indexOf(document.activeElement);
    const move = {ArrowDown: 1, ArrowUp: -1}[event.key];
    if (move) items[(index + move + items.length) % items.length].focus();
    else if (event.key === 'Home') items[0].focus();
    else if (event.key === 'End') items.at(-1).focus();
    else if (event.key === 'Escape') closeMenu(true);
    else if (event.key === 'Tab') closeMenu(false);
    else return;
    event.preventDefault();
    event.stopPropagation();
  }

  function menuClick(event) {
    const item = event.target.closest(`.${prefix}-menu-item`);
    if (!item) return;
    try {
      localStorage.setItem(STORAGE, item.dataset.value);
    } catch {}
    closeMenu(true);
    choose(item.dataset.value);
  }

  function storageChanged(event) {
    if (event.key === STORAGE) choose(loadPrimary(), false);
  }

  function mount() {
    if (stopped) return;
    const share = document.getElementById('docs-titlebar-share-client-button');
    const host = share?.parentElement;
    if (!host || (container.parentElement === host && container.nextElementSibling === share)) return;
    host.insertBefore(container, share);
  }

  const listeners = [['mousedown', keepEditorFocus], ['click', copy], ['contextmenu', openMenu], ['pointerenter', trackModifiers], ['pointermove', trackModifiers], ['pointerleave', trackModifiers]];
  for (const [name, listener] of listeners) button.addEventListener(name, listener);
  menu.addEventListener('keydown', menuKey);
  menu.addEventListener('click', menuClick);
  window.addEventListener('storage', storageChanged);
  show('idle');
  mount();
  const interval = setInterval(mount, 1000);
  window[KEY] = {
    version: VERSION,
    exportUrl: format => exportUrl(format),
    status: () => ({version: VERSION, mounted: container.isConnected, click: primary, state, detail, copies, stopped, failures: failures.map(entry => ({...entry}))}),
    copy,
    render: (comments = primary === 'comments') => render(comments),
    destroy() {
      stopped = true;
      clearInterval(interval);
      clearTimeout(resetTimer);
      for (const [name, listener] of listeners) button.removeEventListener(name, listener);
      closeMenu(false);
      menu.removeEventListener('keydown', menuKey);
      menu.removeEventListener('click', menuClick);
      window.removeEventListener('storage', storageChanged);
      container.remove();
      style.remove();
      if (window[KEY] === this) delete window[KEY];
    }
  };
})();
