import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
const source = await readFile('userscripts/google-docs-md-clipboard.user.js', 'utf8');
const browser = await chromium.launch({headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined});
const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
const otherMod = mod === 'Meta' ? 'Control' : 'Meta';
const item = (id, icon, label) => `<div class="goog-menuitem goog-menuitem-disabled apps-menuitem" role="menuitem" aria-disabled="true" id="${id}" style="display:none"><div class="goog-menuitem-content"><div class="docs-icon goog-inline-block goog-menuitem-icon" aria-hidden="true"><div class="docs-icon-img-container docs-icon-img docs-icon-${icon}"></div></div><span class="goog-menuitem-label">${label}</span></div></div>`;
const html = `<!doctype html><title>Fixture - Google Docs</title>
<input id=comment aria-label="Comment">
<div class="kix-cursor"><div class="kix-cursor-name"></div></div><div class="kix-cursor"><div class="kix-cursor-name">Collaborator</div></div>
<div class="goog-menu goog-menu-vertical shell-menu" role="menu" style="visibility:hidden">
${item('copy', 'editors-ia-content-copy', 'Copy')}${item('copy-md', 'markdown-copy-18x18', 'Copy as Markdown')}${item('paste', 'editors-ia-paste', 'Paste')}${item('paste-md', 'markdown-paste-18x18', 'Paste from Markdown')}
</div>
<script>
window.__actions = [];
window.__events = [];
document.querySelectorAll('.goog-menuitem').forEach(item => {
  const enabled = () => item.getAttribute('aria-disabled') !== 'true';
  item.addEventListener('mousedown', event => { if (enabled() && event.button === 0) item.dataset.active = 'true'; });
  item.addEventListener('mouseout', () => { delete item.dataset.active; });
  item.addEventListener('mouseup', () => {
    if (!enabled() || !item.dataset.active) return;
    delete item.dataset.active;
    window.__actions.push(item.id);
    if (/^paste/.test(item.id) && window.__docsPaste) {
      const data = new DataTransfer();
      data.setData('text/plain', window.__clip.items[0]?.['text/plain'] ?? '');
      document.querySelector('.docs-texteventtarget-iframe').contentDocument.querySelector('[role=textbox]').dispatchEvent(new ClipboardEvent('paste', {clipboardData: data, bubbles: true, cancelable: true}));
    }
    if (item.id === 'copy-md') navigator.clipboard.writeText('# Copied as Markdown').catch(error => window.__actions.push('copy-failed:' + error.name));
  });
});
window.setMarkdown = (id, state) => {
  const item = document.getElementById(id);
  item.style.display = state === 'hidden' ? 'none' : '';
  item.setAttribute('aria-disabled', String(state !== 'enabled'));
  item.classList.toggle('goog-menuitem-disabled', state !== 'enabled');
};
window.makeEditor = () => {
  document.querySelector('.docs-texteventtarget-iframe')?.remove();
  const frame = document.createElement('iframe');
  frame.className = 'docs-texteventtarget-iframe docs-offscreen-z-index';
  document.body.append(frame);
  const doc = frame.contentDocument;
  const editor = doc.createElement('div');
  editor.contentEditable = 'true';
  editor.setAttribute('role', 'textbox');
  editor.textContent = 'Selected text';
  doc.body.append(editor);
  editor.addEventListener('keydown', event => { if (event.key.length === 1) window.__events.push({type: 'keydown', key: event.key, prevented: event.defaultPrevented}); });
  editor.addEventListener('keydown', event => {
    if (event.key !== 'v' || !(event.metaKey || event.ctrlKey)) return;
    event.preventDefault();
    window.__events.push({type: 'docs-key-paste'});
  });
  for (const type of ['copy', 'paste']) doc.addEventListener(type, () => window.__events.push({type}));
  editor.addEventListener('paste', event => {
    const text = event.clipboardData.getData('text/plain').trimEnd();
    setTimeout(() => {
      const model = window.__docsPaste;
      if (!model) return;
      model.text = model.text.slice(0, model.caret) + text + '\\n' + model.text.slice(model.caret);
      model.caret += text.length + 1;
      const cursor = [...document.querySelectorAll('.kix-cursor, .other-cursor')];
      cursor[1].style.transform = 'translate(' + model.caret + 'px, 1px)';
      cursor[0].style.transform = 'translate(' + model.caret + 'px, 0px)';
    }, window.__docsPaste?.delay ?? 20);
  });
  editor.addEventListener('keydown', event => {
    const model = window.__docsPaste;
    if (!model || event.key !== 'Backspace') return;
    model.keys.push((event.isTrusted ? 'trusted:' : 'synthetic:') + event.keyCode);
    if (event.keyCode !== 8 || !model.caret) return;
    event.preventDefault();
    model.text = model.text.slice(0, model.caret - 1) + model.text.slice(model.caret);
    model.caret--;
  });
  return frame;
};
makeEditor();
</script>`;
async function setup(contextOptions = {}) {
  const context = await browser.newContext({viewport: {width: 1000, height: 600}, ...contextOptions});
  await context.addInitScript(() => {
    if (window !== top) return;
    window.__clip = {text: null, items: [], readError: null, reads: 0};
    const fake = {
      async read() {
        window.__clip.reads++;
        if (window.__clip.readError) throw new DOMException('Read failed', window.__clip.readError);
        return window.__clip.items.map(data => ({types: Object.keys(data), getType: async type => new Blob([data[type]], {type})}));
      },
      async writeText(text) {
        if (!navigator.userActivation.isActive) throw new DOMException('Write requires a user gesture', 'NotAllowedError');
        window.__clip.text = text;
      }
    };
    Object.defineProperty(Navigator.prototype, 'clipboard', {get: () => fake, configurable: true});
    window.__permissions = {};
    const query = Permissions.prototype.query;
    Permissions.prototype.query = function (descriptor) {
      if (!/^clipboard-/.test(descriptor.name)) return query.call(this, descriptor);
      const status = window.__permissions[descriptor.name] ||= Object.assign(new EventTarget(), {state: 'granted'});
      return Promise.resolve(status);
    };
    window.setPermission = (name, state) => {
      const status = window.__permissions[name];
      status.state = state;
      status.dispatchEvent(new Event('change'));
    };
  });
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', error => page.errors.push(error.message));
  await page.route('https://docs.google.com/**', route => route.fulfill({contentType: 'text/html', body: html, headers: {'content-security-policy': "require-trusted-types-for 'script'"}}));
  await page.goto('https://docs.google.com/document/d/fixture/edit');
  await page.evaluate(source);
  await page.waitForFunction(() => window.__googleDocsMarkdownClipboard?.status().frames === 1);
  return {context, page};
}
let checks = 0;
function check(ok, name, detail) { if (!ok) throw Error(name + ': ' + JSON.stringify(detail)); checks++; }
const editor = page => page.frameLocator('.docs-texteventtarget-iframe').locator('[role=textbox]');
async function press(page, keys) {
  await page.evaluate(() => { window.__actions = []; window.__events = []; window.__clip.text = null; });
  await editor(page).focus();
  await page.keyboard.press(keys);
  await page.waitForTimeout(50);
  return page.evaluate(() => ({actions: window.__actions, events: window.__events, clip: window.__clip.text, status: window.__googleDocsMarkdownClipboard?.status()}));
}
const reachedEditor = (r, key) => r.events.some(e => e.type === 'keydown' && e.key === key && !e.prevented);
const nativePaste = r => reachedEditor(r, 'v') && r.events.some(e => e.type === 'docs-key-paste');
const pasteIntercepted = r => !r.events.some(e => e.type === 'keydown' && e.key === 'v') && !r.events.some(e => e.type === 'docs-key-paste' || e.type === 'paste');
async function clipboard(page, items, readError = null) { await page.evaluate(([items, readError]) => Object.assign(window.__clip, {items, readError}), [items, readError]); }
const intercepted = (r, key) => !r.events.some(e => e.type === 'keydown' && e.key === key) && !r.events.some(e => e.type === 'copy' || e.type === 'paste');
try {
  const {page} = await setup();
  let r = await press(page, mod + '+c');
  check(reachedEditor(r, 'c') && r.actions.length === 0, 'copy stays native while Markdown is not enabled in Docs', r);
  check(r.status.copy === 'native (Markdown command unavailable)' && r.status.last.reason === 'unavailable', 'status explains the native fallback', r.status);
  await page.evaluate(() => { setMarkdown('copy-md', 'disabled'); setMarkdown('paste-md', 'disabled'); });
  r = await press(page, mod + '+c');
  check(reachedEditor(r, 'c') && r.actions.length === 0, 'disabled Copy as Markdown (no selection) leaves native copy', r);
  await page.evaluate(() => { setMarkdown('copy-md', 'enabled'); setMarkdown('paste-md', 'enabled'); setMarkdown('paste', 'enabled'); });
  await clipboard(page, [{'text/plain': '# Title\n\n- item'}]);
  r = await press(page, mod + '+c');
  check(r.actions.join() === 'copy-md', 'shortcut runs Copy as Markdown exactly once', r);
  check(intercepted(r, 'c'), 'native copy and Docs key handling are suppressed', r);
  check(r.clip === '# Copied as Markdown', 'Docs command keeps the keystroke user activation for the clipboard', r);
  check(await page.evaluate(() => !document.querySelector('[data-active]')), 'menu item is not left active');
  r = await press(page, mod + '+v');
  check(r.actions.join() === 'paste-md' && pasteIntercepted(r), 'shortcut runs Paste from Markdown exactly once instead of Docs paste', r);
  check(r.status.counts.copy === 1 && r.status.counts.paste === 1 && r.status.copy === 'markdown' && r.status.paste === 'markdown', 'status counts handled shortcuts', r.status);
  for (const keys of [mod + '+Shift+v', mod + '+Shift+c', mod + '+Alt+c', otherMod + '+c', otherMod + '+v', mod + '+x', mod + '+a']) {
    r = await press(page, keys);
    check(r.actions.length === 0 && reachedEditor(r, keys.at(-1)), keys + ' remains native', r);
  }
  for (const [name, items] of [
    ['Docs rich copy', [{'text/plain': 'Title', 'text/html': '<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-1234"><h1>Title</h1></b>'}]],
    ['Sheets range', [{'text/plain': 'a\tb', 'text/html': '<google-sheets-html-origin><table><tr><td>a</td><td>b</td></tr></table>'}]],
    ['Docs custom web format', [{'text/plain': 'Title', 'web application/x-vnd.google-docs-document-slice-clip+wrapped': '{}'}]]
  ]) {
    await clipboard(page, items);
    r = await press(page, mod + '+v');
    check(r.actions.join() === 'paste' && pasteIntercepted(r) && r.status.last.reason === 'google-editor-content', name + ' runs Docs paste and keeps its formatting', r);
  }
  await clipboard(page, [{'text/plain': '# Title', 'text/html': '<pre># Title</pre>'}]);
  r = await press(page, mod + '+v');
  check(r.actions.join() === 'paste-md' && r.status.last.outcome === 'markdown', 'other HTML content still pastes from Markdown', r);
  const pasted = async (text, {delay = 20, between = null, cursor = true} = {}) => {
    await clipboard(page, [{'text/plain': text, 'text/html': '<p>x</p>'}]);
    await page.evaluate(([delay, cursor]) => {
      window.__docsPaste = {text: 'LEFTRIGHT', caret: 4, delay, keys: []};
      if (!cursor) document.querySelector('.kix-cursor').className = 'other-cursor';
    }, [delay, cursor]);
    const result = await press(page, mod + '+v');
    if (between) await page.keyboard.press(between);
    await page.waitForTimeout(delay + 100);
    const after = await page.evaluate(() => ({doc: window.__docsPaste.text, keys: window.__docsPaste.keys, last: window.__googleDocsMarkdownClipboard.status().last}));
    await page.evaluate(() => { window.__docsPaste = null; document.querySelector('.other-cursor')?.setAttribute('class', 'kix-cursor'); });
    return {...result, ...after};
  };
  r = await pasted('Pasted words\n\n');
  check(r.doc === 'LEFTPasted wordsRIGHT' && r.last.join === 'joined', 'the paragraph break Docs adds after Paste from Markdown is removed', r);
  check(r.keys.join() === 'synthetic:8', 'the break is removed with exactly one Backspace that Docs recognises by key code', r.keys);
  check(await page.evaluate(() => window.__clip.items[0]['text/plain']) === 'Pasted words\n\n', 'the system clipboard is not rewritten');
  r = await pasted('# Title\n\nPara\n\n- item');
  check(r.doc === 'LEFT# Title\n\nPara\n\n- itemRIGHT' && r.last.join === 'joined', 'multi-block Markdown joins the rest of the line to its last block', r);
  r = await pasted('Title\n---');
  check(r.last.join === 'joined', 'a setext heading underline is not mistaken for a horizontal rule', r.last);
  for (const [name, text] of [['code block', 'Intro\n\n```\ncode\n```\n'], ['tilde code block', '~~~\ncode\n~~~'], ['table', '| a | b |\n| --- | --- |\n| 1 | 2 |\n'], ['horizontal rule', 'Intro\n\n---\n'], ['starred rule', '* * *'], ['empty text', '\n\n']]) {
    r = await pasted(text);
    check(r.last.join === 'block-end' && r.keys.length === 0 && r.doc.endsWith('\nRIGHT'), 'Markdown ending with a ' + name + ' keeps the break Docs needs after it', r);
  }
  r = await pasted('Typed over', {delay: 300, between: 'ArrowLeft'});
  check(r.last.join === 'interrupted' && r.keys.length === 0 && r.doc === 'LEFTTyped over\nRIGHT', 'a key pressed before the paste lands cancels the Backspace', r);
  r = await pasted('No cursor', {cursor: false});
  check(r.last.join === 'no-cursor' && r.keys.length === 0, 'without the editor cursor nothing is deleted', r);
  await page.evaluate(() => { window.__docsPaste = {text: 'LEFTRIGHT', caret: 4, delay: 20, keys: []}; });
  await clipboard(page, [{'text/plain': 'Title', 'web application/x-vnd.google-docs-document-slice-clip+wrapped': '{}'}]);
  r = await press(page, mod + '+v');
  await page.waitForTimeout(150);
  r = await page.evaluate(() => ({keys: window.__docsPaste.keys, last: window.__googleDocsMarkdownClipboard.status().last}));
  check(r.keys.length === 0 && r.last.outcome === 'native' && !('join' in r.last), 'Docs plain Paste of Google editor content is left alone', r);
  await page.evaluate(() => { window.__docsPaste = null; });
  await clipboard(page, [], 'NotAllowedError');
  r = await press(page, mod + '+v');
  check(r.actions.join() === 'paste-md' && r.status.last.reason === 'clipboard-read-NotAllowedError', 'an unreadable clipboard leaves the decision to Paste from Markdown', r);
  await clipboard(page, [{'text/plain': '# Title'}]);
  await page.evaluate(() => setMarkdown('paste', 'disabled'));
  r = await press(page, mod + '+v');
  check(r.actions.length === 0 && nativePaste(r) && r.status.last.reason === 'unavailable', 'without Docs Paste to fall back on, the shortcut stays with Docs', r);
  await page.evaluate(() => setMarkdown('paste', 'enabled'));
  await page.evaluate(() => { window.__actions = []; });
  await page.locator('#comment').focus();
  await page.keyboard.press(mod + '+c');
  await page.keyboard.press(mod + '+v');
  check((await page.evaluate(() => window.__actions)).length === 0, 'inputs outside the document editor are unaffected');
  check(await page.evaluate(() => {
    window.__actions = [];
    const doc = document.querySelector('.docs-texteventtarget-iframe').contentDocument;
    const event = new KeyboardEvent('keydown', {key: 'c', code: 'KeyC', metaKey: true, ctrlKey: true, bubbles: true, cancelable: true});
    doc.querySelector('[role=textbox]').dispatchEvent(event);
    return !event.defaultPrevented && window.__actions.length === 0;
  }), 'synthetic key events are ignored');
  await page.evaluate(() => setPermission('clipboard-read', 'denied'));
  r = await press(page, mod + '+v');
  check(r.actions.length === 0 && nativePaste(r) && r.status.last.reason === 'permission' && /permission denied/.test(r.status.paste), 'denied clipboard permission keeps native paste instead of a Docs dialog', r);
  r = await press(page, mod + '+c');
  check(r.actions.join() === 'copy-md', 'copy is unaffected by the read permission', r);
  await page.evaluate(() => setPermission('clipboard-read', 'prompt'));
  r = await press(page, mod + '+v');
  check(r.actions.join() === 'paste-md', 'paste returns to Markdown when permission is no longer denied', r);
  check(await page.evaluate(() => { makeEditor(); return window.__googleDocsMarkdownClipboard.status().frames; }) === 0, 'removed editor frames are released');
  await page.waitForFunction(() => window.__googleDocsMarkdownClipboard.status().frames === 1, null, {timeout: 3000});
  r = await press(page, mod + '+c');
  check(r.actions.join() === 'copy-md', 'a replaced editor frame is attached once', r);
  await page.evaluate(source);
  r = await press(page, mod + '+c');
  check(r.actions.join() === 'copy-md' && r.status.counts.copy === 1, 'reapplication replaces the previous instance without double actions', r);
  await page.evaluate(() => window.__googleDocsMarkdownClipboard.destroy());
  r = await press(page, mod + '+c');
  check(r.actions.length === 0 && reachedEditor(r, 'c') && !r.status, 'destroy restores native shortcuts and removes the API', r);
  check(page.errors.length === 0, 'no uncaught browser errors', page.errors);
  const other = await setup({userAgent: `Mozilla/5.0 (${mod === 'Meta' ? 'Macintosh; Intel Mac OS X 10.15' : 'X11; Linux x86_64'}; rv:130.0) Gecko/20100101 Firefox/130.0`});
  await other.page.evaluate(() => { setMarkdown('copy-md', 'enabled'); setMarkdown('paste-md', 'enabled'); setMarkdown('paste', 'enabled'); });
  r = await press(other.page, mod + '+v');
  check(r.actions.length === 0 && nativePaste(r) && r.status.last.reason === 'browser', 'outside Chrome, paste stays native because Docs answers Paste from Markdown with a dialog', r);
  r = await press(other.page, mod + '+c');
  check(r.actions.join() === 'copy-md', 'outside Chrome, copy still uses Markdown', r);
  console.log('Google Docs Markdown Clipboard:', checks, 'checks passed');
} finally { await browser.close(); }
