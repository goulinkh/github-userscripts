(() => {
  'use strict';
  const VERSION = '0.2.1';
  const KEY = '__googleDocsCopyMarkdown';
  window[KEY]?.destroy();
  const prefix = 'gdocs-copy-md';
  const SVG = 'http://www.w3.org/2000/svg';
  const labels = {idle: 'Copy as Markdown', busy: 'Copying…', done: 'Copied', fail: 'Copy failed', retry: 'Copy interrupted'};
  const settings = {
    click: {key: 'gdocs-copy-md:click', title: 'Click copies', announce: 'Click now copies', options: {comments: 'Markdown with comments', markdown: 'Markdown only'}},
    placement: {key: 'gdocs-copy-md:placement', title: 'Comments appear as', announce: 'Comments now appear as', options: {hidden: 'Hidden comments in place', visible: 'Visible quotes in place', end: 'List at the end'}}
  };
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
    .${prefix}-menu-group + .${prefix}-menu-group, .${prefix}-menu-note { margin-top: 6px; padding-top: 6px; border-top: 1px solid #e3e3e3; }
    .${prefix}-menu-note { padding: 10px 16px 4px; }
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
  menu.setAttribute('aria-label', 'Copy as Markdown options');
  menu.hidden = true;
  const items = [];
  for (const [setting, {title, options}] of Object.entries(settings)) {
    const group = document.createElement('div');
    group.className = `${prefix}-menu-group`;
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', title);
    const heading = document.createElement('div');
    heading.className = `${prefix}-menu-heading`;
    heading.setAttribute('aria-hidden', 'true');
    heading.textContent = title;
    group.append(heading);
    for (const [value, label] of Object.entries(options)) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = `${prefix}-menu-item`;
      item.setAttribute('role', 'menuitemradio');
      item.dataset.setting = setting;
      item.dataset.value = value;
      item.tabIndex = -1;
      item.textContent = label;
      group.append(item);
      items.push(item);
    }
    menu.append(group);
  }
  const menuNote = document.createElement('div');
  menuNote.className = `${prefix}-menu-note`;
  menuNote.setAttribute('aria-hidden', 'true');
  menuNote.textContent = 'Shift, ⌘ or Ctrl-click copies the other';
  menu.append(menuNote);
  const current = {};
  for (const setting of Object.keys(settings)) current[setting] = load(setting);
  let previousFocus = null, state = 'idle', detail = '', stopped = false, resetTimer = 0, copies = 0, policy = null, pending = null;
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

  function load(setting) {
    const {key: storageKey, options} = settings[setting];
    let value = null;
    try {
      value = localStorage.getItem(storageKey);
    } catch {}
    return Object.hasOwn(options, value) ? value : Object.keys(options)[0];
  }

  const includesComments = event => (current.click === 'comments') !== !!(event?.shiftKey || event?.metaKey || event?.ctrlKey);

  function hint() {
    const other = current.click === 'comments' ? 'without' : 'with';
    const copies = settings.click.options[current.click];
    const placement = settings.placement.options[current.placement].toLowerCase();
    return {
      title: `Copy as ${copies}\nShift, ⌘ or Ctrl-click: copy ${other} comments\nComments: ${placement}\nRight-click: options`,
      label: `Copy as ${copies}. Shift, Command or Control-click copies ${other} comments. Comments appear as ${placement}. Open the context menu for options.`
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
    if (response.status === 429) throw Error('Google is limiting exports (HTTP 429); try again in a minute');
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
      const title = /^#{1,6}\s/.test(line) ? line.replace(/^#{1,6}\s+/, '').replace(/\s+#+\s*$/, '').replace(/\\([\\`*_{}[\]()#+\-.!|<>~])/g, '$1').trim() : '';
      blocks.push({end: Math.min(i, lines.length), indent, heading: title, key: key(source)});
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
  const shorten = (value, limit = 100) => value.length > limit ? `${value.slice(0, limit).trimEnd()}…` : value;
  const who = (kind, comment) => `${kind}${comment.author ? ` from ${comment.author}` : ''}`;

  function where(item, detailed) {
    if (item.quote) return ` on “${item.quote}”`;
    if (!item.emptyLine) return '';
    return detailed && item.before ? ` on an empty line after “${item.before}”` : ' on an empty line';
  }

  function hiddenNote(item) {
    const [root, ...replies] = item.comments;
    const lines = [`${who('Comment', root)}${where(item)}: ${root.body}`, ...replies.map(reply => `${who('Reply', reply)}: ${reply.body}`)];
    const text = safe(lines.join('\n'));
    return text.includes('\n') ? ['<!--', ...text.split('\n'), '-->'] : [`<!-- ${text} -->`];
  }

  function visibleNote(item) {
    const lines = [];
    item.comments.forEach((comment, index) => {
      const [first, ...rest] = comment.body.split('\n');
      if (index) lines.push('>');
      lines.push(index ? `> **${who('Reply', comment)}:** ${first}` : `> **${who('Comment', comment)}**${where(item)}: ${first}`);
      for (const line of rest) if (line.trim()) lines.push('>', `> ${line}`);
    });
    return lines;
  }

  function listedNote(item) {
    const [root, ...replies] = item.comments;
    const section = item.section ? `, under “${item.section}”` : '';
    const context = item.context ? ` in “${item.context}”` : '';
    const lines = [`- **${who('Comment', root)}**${where(item, true)}${context}${section}`];
    root.body.split('\n').forEach((line, index) => lines.push(index && line.trim() ? '  >' : null, line.trim() ? `  > ${line}` : null));
    for (const reply of replies) {
      const [first, ...rest] = reply.body.split('\n');
      lines.push(`  - **${who('Reply', reply)}:** ${first}`, ...rest.map(line => `    ${line}`));
    }
    return lines.filter(line => line !== null);
  }

  function contextOf(paragraphs, {start, end}, quote) {
    if (!quote || !end || start.index !== end.index) return '';
    const text = paragraphs[start.index];
    if (flat(text) === quote) return '';
    if (flat(text).length <= 80) return flat(text);
    const from = Math.max(0, start.offset - 30), to = Math.min(text.length, end.offset + 30);
    return `${from ? '…' : ''}${flat(text.slice(from, to))}${to < text.length ? '…' : ''}`;
  }

  function previousText(paragraphs, index) {
    for (let i = index - 1; i >= 0; i--) {
      const text = flat(paragraphs[i]);
      if (key(text)) return text.length > 60 ? `…${text.slice(-60).trimStart()}` : text;
    }
    return '';
  }

  function sectionOf(blocks, owner) {
    for (let i = owner; i >= 0; i--) if (blocks[i].heading) return blocks[i].heading;
    return '';
  }

  async function withComments(markdown, docx, placement) {
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
    const items = [...threads.values()]
      .sort((a, b) => a.range.start.index - b.range.start.index || a.range.start.offset - b.range.start.offset)
      .map(({range, comments}) => {
        const owner = owners[range.start.index];
        const quote = shorten(flat(quoteOf(paragraphs, range)));
        const emptyLine = !quote && !key(paragraphs[range.start.index]);
        return {owner, comments, quote, emptyLine, context: contextOf(paragraphs, range, quote), before: emptyLine ? previousText(paragraphs, range.start.index) : '', section: sectionOf(blocks, owner)};
      });
    if (placement === 'end') {
      return {text: `${markdown.trimEnd()}\n\n---\n\n## Comments\n\n${items.map(item => listedNote(item).join('\n')).join('\n\n')}\n`, count: threads.size};
    }
    const inserts = new Map();
    for (const item of items) {
      if (!inserts.has(item.owner)) inserts.set(item.owner, []);
      inserts.get(item.owner).push(placement === 'visible' ? visibleNote(item) : hiddenNote(item));
    }
    for (const owner of [...inserts.keys()].sort((a, b) => b - a)) {
      const notes = inserts.get(owner);
      const block = (placement === 'visible' ? notes.flatMap((note, index) => index ? ['', ...note] : note) : notes.flat()).map(line => (blocks[owner]?.indent || '') + line);
      if (owner < 0) {
        lines.splice(0, 0, ...block, '');
        continue;
      }
      const at = blocks[owner].end;
      lines.splice(at, 0, '', ...block, ...(at < lines.length && lines[at] !== '' ? [''] : []));
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

  function render(comments, placement = current.placement) {
    if (!comments) return fetchExport('md').catch(tag('export')).then(text => ({text, count: null}));
    return Promise.all([fetchExport('md'), fetchExport('docx')]).catch(tag('export')).then(([markdown, docx]) => withComments(markdown, docx, placement).catch(tag('comments')));
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

  function choose(setting, value, announce = true) {
    if (!Object.hasOwn(settings[setting].options, value)) return;
    current[setting] = value;
    if (state === 'idle') show('idle');
    if (announce) live.textContent = `${settings[setting].announce} ${settings[setting].options[value].toLowerCase()}`;
  }

  function openMenu(event) {
    event.preventDefault();
    if (!menu.hidden) return closeMenu(true);
    previousFocus = document.activeElement;
    for (const item of items) item.setAttribute('aria-checked', String(current[item.dataset.setting] === item.dataset.value));
    document.body.append(menu);
    menu.hidden = false;
    const rect = button.getBoundingClientRect();
    menu.style.top = `${Math.round(rect.bottom + 4)}px`;
    menu.style.left = `${Math.round(Math.max(8, Math.min(rect.right - menu.offsetWidth, innerWidth - menu.offsetWidth - 8)))}px`;
    button.setAttribute('aria-expanded', 'true');
    items.find(item => item.getAttribute('aria-checked') === 'true').focus();
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
      localStorage.setItem(settings[item.dataset.setting].key, item.dataset.value);
    } catch {}
    closeMenu(true);
    choose(item.dataset.setting, item.dataset.value);
  }

  function storageChanged(event) {
    for (const [setting, {key: storageKey}] of Object.entries(settings)) if (event.key === storageKey) choose(setting, load(setting), false);
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
    status: () => ({version: VERSION, mounted: container.isConnected, click: current.click, placement: current.placement, state, detail, copies, stopped, failures: failures.map(entry => ({...entry}))}),
    copy,
    render: (comments = current.click === 'comments', placement = current.placement) => render(comments, placement),
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
