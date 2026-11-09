import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { deflateRawSync, crc32 } from 'node:zlib';
const source = await readFile('userscripts/google-docs-copy-md.user.js', 'utf8');
const browser = await chromium.launch({headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined});
const context = await browser.newContext({viewport: {width: 1200, height: 700}});
await context.addInitScript(() => {
  window.__clip = {calls: [], text: null, deny: 0};
  const requireActivation = () => {
    if (window.__unfocused) throw new DOMException('Document is not focused.', 'NotAllowedError');
    if (window.__clip.deny > 0) {
      window.__clip.deny--;
      throw new DOMException('Document is not focused.', 'NotAllowedError');
    }
    if (!navigator.userActivation.isActive) throw new DOMException('Write requires a user gesture', 'NotAllowedError');
  };
  const fake = {
    async write(items) {
      window.__clip.calls.push({kind: 'write'});
      requireActivation();
      const blob = await items[0].getType('text/plain');
      window.__clip.text = await blob.text();
    },
    async writeText(text) {
      window.__clip.calls.push({kind: 'writeText'});
      requireActivation();
      window.__clip.text = text;
    }
  };
  Object.defineProperty(Navigator.prototype, 'clipboard', {get: () => fake, configurable: true});
});
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));
const markdown = '# Fixture title\r\n\r\nCafé — 日本語 🎉 <b>not html</b>\n\n```js\nconst a = 1;\t\n```\n\n- [ ] item\n';
const html = `<!doctype html><title>Fixture - Google Docs</title><style>body{margin:0;font-family:sans-serif} .docs-titlebar-buttons{display:flex;align-items:center;justify-content:flex-end;height:60px}</style>
<div id=docs-titlebar><div class=docs-titlebar-buttons><div id=docs-presence-container>presence</div><span id=docs-titlebar-share-client-button><div role=button aria-label=Share>Share</div></span></div></div>
<textarea id=editor aria-label="Document editor model"></textarea>
`;
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const run = text => `<w:r><w:t xml:space="preserve">${text}</w:t></w:r>`;
const start = id => `<w:commentRangeStart w:id="${id}"/>`;
const end = id => `<w:commentRangeEnd w:id="${id}"/><w:r><w:commentReference w:id="${id}"/></w:r>`;
const p = (...parts) => `<w:p><w:pPr><w:pStyle w:val="Normal"/></w:pPr>${parts.join('')}</w:p>`;
const cell = (...parts) => `<w:tc>${p(...parts)}</w:tc>`;
const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${W}"><w:body>
${p(run('Title'))}
${p(run('Intro with a '), '<w:hyperlink><w:r><w:t>link</w:t></w:r></w:hyperlink>', run(' and '), start(0), start(1), run('commented phrase'), end(0), end(1), run(' here.'))}
${p(start(2))}${p(end(2))}
${p(run('Details'))}
${p(run('first item'))}
${p(run('second '), start(3), run('item'), end(3))}
<w:tbl><w:tr>${cell(run('A'))}${cell(run('B'))}</w:tr><w:tr>${cell(run('cell one'))}${cell(start(4), run('cell two'), end(4))}</w:tr></w:tbl>
${p(run('\uEC03'), run('code '), start(5), run('line'), end(5))}
${p(run('Repeat paragraph.'))}
${p(start(6), run('Repeat'), end(6), run(' '), start(7), run('paragraph.'))}
${p('<w:r><w:delText>deleted </w:delText></w:r>', run('Final'), end(7), run(' words with '), start(8), run('snake_case'), end(8), run('.'))}
<w:sectPr/></w:body></w:document>`;
const comment = (id, author, ...lines) => `<w:comment w:id="${id}" w:author="${author}" w:date="2026-01-01T00:00:00Z">${lines.map(line => p(run(line))).join('')}</w:comment>`;
const commentsXml = `<?xml version="1.0" encoding="UTF-8"?><w:comments xmlns:w="${W}">${[
  comment(0, 'Ada', 'Please --&gt; rephrase'), comment(1, 'Bob', 'Done'), comment(2, 'Cy', 'Gap'), comment(3, 'Ada', 'Second item note'),
  comment(4, 'Ada', 'Cell note'), comment(5, 'Ada', 'Line one', 'Line two'), comment(6, 'Ada', 'Second repeat'), comment(7, 'Ada', 'Spans'), comment(8, 'Ada', 'Escapes')
].join('')}</w:comments>`;
function zip(files) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const {name, text, store} of files) {
    const data = Buffer.from(text), body = store ? data : deflateRawSync(data), encoded = Buffer.from(name), method = store ? 0 : 8;
    const local = Buffer.alloc(30), central = Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(method, 8); local.writeUInt32LE(crc32(data), 14);
    local.writeUInt32LE(body.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(encoded.length, 26); local.writeUInt16LE(4, 28);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(method, 10); central.writeUInt32LE(crc32(data), 16);
    central.writeUInt32LE(body.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(encoded.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, encoded, Buffer.alloc(4), body);
    centrals.push(central, encoded);
    offset += 34 + encoded.length + body.length;
  }
  const directory = Buffer.concat(centrals), tail = Buffer.alloc(22);
  tail.writeUInt32LE(0x06054b50, 0); tail.writeUInt16LE(files.length, 8); tail.writeUInt16LE(files.length, 10); tail.writeUInt32LE(directory.length, 12); tail.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, tail]);
}
const commentedDocx = zip([{name: '[Content_Types].xml', text: '<Types/>', store: true}, {name: 'word/fonts/big.ttf', text: 'x'.repeat(5000)}, {name: 'word/document.xml', text: documentXml}, {name: 'word/comments.xml', text: commentsXml, store: true}]);
const plainDocx = zip([{name: 'word/document.xml', text: `<w:document xmlns:w="${W}"><w:body>${p(run('Fixture title'))}</w:body></w:document>`}]);
const commentedMarkdown = '# Title\n\nIntro with a [link](https://example.com/a_(b)) and commented phrase here.\n\n## Details\n\n* first item  \n* second item\n\n| A | B |\n| :---- | :---- |\n| cell one | cell two |\n\n```\ncode line\n```\n\nRepeat paragraph.\n\nRepeat paragraph.\n\nFinal words with snake\\_case.\n\n';
const commentedResult = '# Title\n\nIntro with a [link](https://example.com/a_(b)) and commented phrase here.\n\n<!--\nComment from Ada on “commented phrase”: Please -- > rephrase\nReply from Bob: Done\n-->\n<!-- Comment from Cy on an empty line: Gap -->\n\n## Details\n\n* first item  \n* second item\n\n  <!-- Comment from Ada on “item”: Second item note -->\n\n| A | B |\n| :---- | :---- |\n| cell one | cell two |\n\n<!-- Comment from Ada on “cell two”: Cell note -->\n\n```\ncode line\n```\n\n<!--\nComment from Ada on “line”: Line one\nLine two\n-->\n\nRepeat paragraph.\n\nRepeat paragraph.\n\n<!-- Comment from Ada on “Repeat”: Second repeat -->\n<!-- Comment from Ada on “paragraph. Final”: Spans -->\n\nFinal words with snake\\_case.\n\n<!-- Comment from Ada on “snake_case”: Escapes -->\n\n';
const visibleResult = "# Title\n\nIntro with a [link](https://example.com/a_(b)) and commented phrase here.\n\n> **Comment from Ada** on “commented phrase”: Please --> rephrase\n>\n> **Reply from Bob:** Done\n\n> **Comment from Cy** on an empty line: Gap\n\n## Details\n\n* first item  \n* second item\n\n  > **Comment from Ada** on “item”: Second item note\n\n| A | B |\n| :---- | :---- |\n| cell one | cell two |\n\n> **Comment from Ada** on “cell two”: Cell note\n\n```\ncode line\n```\n\n> **Comment from Ada** on “line”: Line one\n>\n> Line two\n\nRepeat paragraph.\n\nRepeat paragraph.\n\n> **Comment from Ada** on “Repeat”: Second repeat\n\n> **Comment from Ada** on “paragraph. Final”: Spans\n\nFinal words with snake\\_case.\n\n> **Comment from Ada** on “snake_case”: Escapes\n\n";
const endResult = "# Title\n\nIntro with a [link](https://example.com/a_(b)) and commented phrase here.\n\n## Details\n\n* first item  \n* second item\n\n| A | B |\n| :---- | :---- |\n| cell one | cell two |\n\n```\ncode line\n```\n\nRepeat paragraph.\n\nRepeat paragraph.\n\nFinal words with snake\\_case.\n\n---\n\n## Comments\n\n- **Comment from Ada** on “commented phrase” in “Intro with a link and commented phrase here.”, under “Title”\n  > Please --> rephrase\n  - **Reply from Bob:** Done\n\n- **Comment from Cy** on an empty line after “Intro with a link and commented phrase here.”, under “Title”\n  > Gap\n\n- **Comment from Ada** on “item” in “second item”, under “Details”\n  > Second item note\n\n- **Comment from Ada** on “cell two”, under “Details”\n  > Cell note\n\n- **Comment from Ada** on “line” in “code line”, under “Details”\n  > Line one\n  >\n  > Line two\n\n- **Comment from Ada** on “Repeat” in “Repeat paragraph.”, under “Details”\n  > Second repeat\n\n- **Comment from Ada** on “paragraph. Final”, under “Details”\n  > Spans\n\n- **Comment from Ada** on “snake_case” in “Final words with snake_case.”, under “Details”\n  > Escapes\n";
const requests = [];
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://' + request.headers.host);
  requests.push({host: url.hostname, path: url.pathname, query: url.search, cookie: request.headers.cookie || ''});
  if (url.hostname === '127.0.0.1') {
    await new Promise(resolve => setTimeout(resolve, 300));
    const commented = url.searchParams.get('doc') === 'commented';
    if (url.searchParams.get('format') === 'docx') {
      response.writeHead(200, {'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'access-control-allow-origin': '*'});
      return response.end(url.searchParams.get('doc') === 'brokendocx' ? Buffer.from('not a zip') : commented ? commentedDocx : plainDocx);
    }
    response.writeHead(200, {'content-type': 'text/x-markdown; charset=utf-8', 'access-control-allow-origin': '*'});
    return response.end(commented ? commentedMarkdown : markdown);
  }
  if (!url.pathname.endsWith('/export')) {
    response.writeHead(200, {'content-type': 'text/html', 'content-security-policy': "require-trusted-types-for 'script'"});
    return response.end(html);
  }
  if (url.pathname.includes('/d/limited/')) { response.writeHead(429, {'content-type': 'text/html'}); return response.end('slow down'); }
  if (url.pathname.includes('/d/forbidden/')) { response.writeHead(403, {'content-type': 'text/html'}); return response.end('denied'); }
  if (url.pathname.includes('/d/login/')) { response.writeHead(200, {'content-type': 'text/html'}); return response.end('<p>Sign in</p>'); }
  response.writeHead(307, {location: `http://127.0.0.1:${port}/export/signed?format=${url.searchParams.get('format')}&doc=${url.pathname.split('/d/')[1].split('/')[0]}&dat=fixture`});
  response.end();
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const origin = `http://localhost:${port}`;
await context.addCookies([
  {name: 'SID', value: 'docs', domain: 'localhost', path: '/'},
  {name: 'SID', value: 'content', domain: '127.0.0.1', path: '/'}
]);
let checks = 0;
function check(ok, name, detail) { if (!ok) throw Error(name + ': ' + JSON.stringify(detail)); checks++; }
const status = () => page.evaluate(() => window.__googleDocsCopyMarkdown.status());
const clip = () => page.evaluate(() => window.__clip);
const resetClip = () => page.evaluate(() => { window.__clip.calls = []; window.__clip.text = null; });
async function open(path) {
  await page.goto(origin + path);
  await page.evaluate(source);
  await page.waitForSelector('.gdocs-copy-md-button');
}
async function waitState(next) {
  await page.waitForFunction(state => window.__googleDocsCopyMarkdown.status().state === state, next, {timeout: 5000});
}
try {
  await open('/document/d/doc123/edit?tab=t.0');
  let s = await status();
  check(s.mounted && s.state === 'idle', 'button mounts idle', s);
  check(await page.evaluate(() => document.querySelector('.gdocs-copy-md-container').nextElementSibling.id === 'docs-titlebar-share-client-button'), 'button sits before Share');
  check(await page.locator('.gdocs-copy-md-button').evaluate(b => {
    const r = b.getBoundingClientRect();
    return r.width === 42 && r.height === 42 && b.querySelector('svg') && b.textContent === '' && /^Copy as Markdown with comments\./.test(b.getAttribute('aria-label')) && /^Copy as Markdown with comments\nShift, ⌘ or Ctrl-click: copy without comments\nComments: hidden comments in place\nRight-click: options$/.test(b.title) && b.getAttribute('aria-haspopup') === 'menu';
  }), 'compact icon button with accessible name and modifier hint');
  check(await page.evaluate(() => window.__googleDocsCopyMarkdown.exportUrl()) === origin + '/document/d/doc123/export?format=md', 'export URL drops edit path and tab');
  check(await page.evaluate(async () => { try { await fetch('/document/d/doc123/export?format=md', {credentials: 'include'}); return false; } catch { return true; } }), 'fixture models Google rejecting credentialed redirect reads');
  requests.length = 0;
  await resetClip();
  await page.locator('#editor').focus();
  await page.click('.gdocs-copy-md-button');
  await waitState('done');
  let c = await clip();
  check(c.text === markdown, 'clipboard receives exact Markdown bytes', c);
  check(c.calls.length === 1 && c.calls[0].kind === 'write', 'single promise-backed clipboard write', c.calls);
  check(await page.evaluate(() => document.activeElement.id) === 'editor', 'clicking keeps editor focus');
  check(requests.some(r => r.host === 'localhost' && r.path.endsWith('/export') && r.cookie.includes('SID=docs')), 'export request carries Docs cookies', requests);
  check(requests.some(r => r.host === '127.0.0.1' && r.cookie === ''), 'redirect target receives no cookies', requests);
  s = await status();
  check(s.copies === 1 && /characters/.test(s.detail), 'status records copy', s);
  check(await page.locator('[role=status]').textContent() === 'Copied: ' + s.detail, 'live region announces result');
  await page.waitForFunction(() => window.__googleDocsCopyMarkdown.status().state === 'idle', null, {timeout: 4000});
  await resetClip();
  await page.evaluate(() => { delete window.ClipboardItem; });
  await page.locator('.gdocs-copy-md-button').focus();
  await page.keyboard.press('Enter');
  await waitState('done');
  c = await clip();
  check(c.text === markdown && c.calls.length === 1 && c.calls[0].kind === 'writeText', 'keyboard activation and writeText fallback', c);
  check(requests.some(r => r.query.includes('format=docx')), 'plain click includes comments by default', requests);
  check((await status()).click === 'comments' && / 0 comments$/.test((await status()).detail), 'default mode is with comments');
  await open('/document/d/commented/edit');
  const modifiers = process.platform === 'darwin' ? ['Shift', 'Meta'] : ['Shift', 'Meta', 'Control'];
  await page.hover('.gdocs-copy-md-button', {position: {x: 20, y: 20}});
  check(await page.locator('.gdocs-copy-md-button').getAttribute('data-comments') === 'true', 'plain hover shows the comment indicator by default');
  await resetClip();
  requests.length = 0;
  await page.click('.gdocs-copy-md-button');
  await waitState('done');
  check((await clip()).text === commentedResult && /, 8 comments$/.test((await status()).detail), 'plain click copies Markdown with comments', await clip());
  await page.waitForFunction(() => window.__googleDocsCopyMarkdown.status().state === 'idle', null, {timeout: 4000});
  for (const modifier of modifiers) {
    await resetClip();
    requests.length = 0;
    await page.keyboard.down(modifier);
    await page.hover('.gdocs-copy-md-button', {position: {x: 21, y: 21}});
    const indicated = await page.locator('.gdocs-copy-md-button').getAttribute('data-comments');
    await page.click('.gdocs-copy-md-button', {modifiers: [modifier]});
    await page.keyboard.up(modifier);
    await waitState('done');
    c = await clip();
    check(c.text === commentedMarkdown, `${modifier}-click copies Markdown without comments`, c.text);
    check(indicated === 'false', `${modifier} hover hides the comment indicator`, indicated);
    check(!requests.some(r => r.query.includes('format=docx')), `${modifier}-click skips the Word export`, requests);
    await page.mouse.move(0, 300);
    check(await page.locator('.gdocs-copy-md-button').getAttribute('data-comments') === 'false', 'indicator clears on leave');
    await page.waitForFunction(() => window.__googleDocsCopyMarkdown.status().state === 'idle', null, {timeout: 4000});
  }
  await page.locator('#editor').focus();
  await page.click('.gdocs-copy-md-button', {button: 'right'});
  check(await page.evaluate(() => {
    const menu = document.querySelector('.gdocs-copy-md-menu[role=menu]');
    const checked = [...menu.querySelectorAll('[role=menuitemradio]')].map(item => item.getAttribute('aria-checked'));
    const groups = [...menu.querySelectorAll('[role=group]')].map(group => group.getAttribute('aria-label') + ':' + [...group.querySelectorAll('[role=menuitemradio]')].map(item => item.textContent).join('|'));
    return !menu.hidden && checked.join() === 'true,false,true,false,false' && groups.join() === 'Click copies:Markdown with comments|Markdown only,Comments appear as:Hidden comments in place|Visible quotes in place|List at the end' && document.activeElement.dataset.value === 'comments' && document.querySelector('.gdocs-copy-md-button').getAttribute('aria-expanded') === 'true';
  }), 'right-click opens both option groups on the current choices');
  await page.keyboard.press('ArrowDown');
  check(await page.evaluate(() => document.activeElement.dataset.value) === 'markdown', 'arrow keys move within the menu');
  await page.keyboard.press('Enter');
  check(await page.evaluate(() => ({menu: !!document.querySelector('.gdocs-copy-md-menu'), stored: localStorage.getItem('gdocs-copy-md:click'), click: window.__googleDocsCopyMarkdown.status().click, focus: document.activeElement.id, expanded: document.querySelector('.gdocs-copy-md-button').getAttribute('aria-expanded'), title: document.querySelector('.gdocs-copy-md-button').title})).then(r => !r.menu && r.stored === 'markdown' && r.click === 'markdown' && r.focus === 'editor' && r.expanded === 'false' && /^Copy as Markdown only\nShift, ⌘ or Ctrl-click: copy with comments/.test(r.title)), 'choosing a default saves it, closes the menu and restores focus');
  await resetClip();
  await page.click('.gdocs-copy-md-button');
  await waitState('done');
  check((await clip()).text === commentedMarkdown, 'plain click follows the Markdown-only default');
  await page.waitForFunction(() => window.__googleDocsCopyMarkdown.status().state === 'idle', null, {timeout: 4000});
  await resetClip();
  await page.click('.gdocs-copy-md-button', {modifiers: ['Shift']});
  await waitState('done');
  check((await clip()).text === commentedResult, 'Shift-click includes comments when the default is Markdown only');
  await page.waitForFunction(() => window.__googleDocsCopyMarkdown.status().state === 'idle', null, {timeout: 4000});
  check(await page.evaluate(() => window.__googleDocsCopyMarkdown.render(true, 'visible').then(r => r.text)) === visibleResult, 'visible placement renders block quotes in place');
  check(await page.evaluate(() => window.__googleDocsCopyMarkdown.render(true, 'end').then(r => r.text)) === endResult, 'end placement lists comments with section and context');
  await page.locator('#editor').focus();
  await page.click('.gdocs-copy-md-button', {button: 'right'});
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
  check(await page.evaluate(() => document.activeElement.dataset.setting + ':' + document.activeElement.dataset.value) === 'placement:end', 'arrow keys cross option groups');
  await page.keyboard.press('Enter');
  check(await page.evaluate(() => ({stored: localStorage.getItem('gdocs-copy-md:placement'), click: localStorage.getItem('gdocs-copy-md:click'), status: window.__googleDocsCopyMarkdown.status(), focus: document.activeElement.id, title: document.querySelector('.gdocs-copy-md-button').title})).then(r => r.stored === 'end' && r.click === 'markdown' && r.status.placement === 'end' && r.status.click === 'markdown' && r.focus === 'editor' && /\nComments: list at the end\n/.test(r.title)), 'choosing a placement saves it without changing the click default');
  await resetClip();
  await page.click('.gdocs-copy-md-button', {modifiers: ['Shift']});
  await waitState('done');
  check((await clip()).text === endResult, 'copies with comments use the chosen placement');
  await page.waitForFunction(() => window.__googleDocsCopyMarkdown.status().state === 'idle', null, {timeout: 4000});
  await open('/document/d/commented/edit');
  check((await status()).click === 'markdown' && (await status()).placement === 'end', 'options persist across reloads');
  const other = await context.newPage();
  await other.goto(origin + '/document/d/commented/edit');
  await other.evaluate(() => { localStorage.setItem('gdocs-copy-md:click', 'comments'); localStorage.setItem('gdocs-copy-md:placement', 'bogus'); });
  await other.close();
  await page.waitForFunction(() => window.__googleDocsCopyMarkdown.status().click === 'comments' && window.__googleDocsCopyMarkdown.status().placement === 'hidden', null, {timeout: 3000});
  check(true, 'unknown stored placement falls back to hidden comments');
  check(true, 'default changes in another tab apply immediately');
  await page.click('.gdocs-copy-md-button', {button: 'right'});
  await page.keyboard.press('Escape');
  check(await page.locator('.gdocs-copy-md-menu').count() === 0, 'Escape closes the menu');
  await page.click('.gdocs-copy-md-button', {button: 'right'});
  await page.mouse.click(200, 400);
  check(await page.locator('.gdocs-copy-md-menu').count() === 0 && (await status()).click === 'comments', 'clicking outside closes the menu without changes');
  await open('/document/d/brokendocx/edit');
  await page.click('.gdocs-copy-md-button');
  await waitState('fail');
  s = await status();
  check(s.failures.at(-1).phase === 'comments' && /Word export/.test(s.failures.at(-1).message) && s.failures.at(-1).comments === true, 'unreadable Word export is reported as a comments failure', s.failures);
  await open('/document/d/commented/edit');
  await resetClip();
  await page.evaluate(() => { window.__clip.deny = 2; });
  await page.click('.gdocs-copy-md-button');
  await waitState('retry');
  s = await status();
  c = await clip();
  check(c.text === null && s.failures.at(-1).phase === 'clipboard' && s.failures.at(-1).name === 'NotAllowedError', 'clipboard refusal after export is recorded', {s, c});
  check(await page.locator('.gdocs-copy-md-button').evaluate(b => b.dataset.state === 'retry' && /Copy interrupted: .*Click to copy/.test(b.title)), 'interrupted copy offers retry');
  check(s.failures.at(-1).focusedAtClick === true, 'failure records focus at click time', s.failures);
  requests.length = 0;
  await page.evaluate(() => {
    window.__unfocused = true;
    document.hasFocus = () => !window.__unfocused;
  });
  await page.click('.gdocs-copy-md-button');
  await page.waitForTimeout(300);
  check(await page.evaluate(() => window.__googleDocsCopyMarkdown.status().state) === 'busy', 'retry click waits while the page has not regained focus');
  await page.evaluate(() => { window.__unfocused = false; });
  await waitState('done');
  c = await clip();
  check(c.text === commentedResult && c.calls.at(-1).kind === 'writeText' && requests.length === 0 && (await status()).failures.length === 1, 'retry copies the prepared text without exporting again', {c, requests});
  check((await status()).detail.endsWith('8 comments'), 'retry keeps comment count');
  await open('/document/d/doc123/edit');
  await resetClip();
  await page.click('.gdocs-copy-md-button');
  await waitState('done');
  check((await clip()).text === markdown && / 0 comments$/.test((await status()).detail), 'documents without comments copy unchanged Markdown');
  check(await page.evaluate(async () => (await window.__googleDocsCopyMarkdown.render(false)).text) === markdown, 'render previews without clipboard');
  await open('/document/u/1/d/doc123/edit?authuser=1');
  check(await page.evaluate(() => window.__googleDocsCopyMarkdown.exportUrl()) === origin + '/document/u/1/d/doc123/export?format=md&authuser=1', 'secondary account path and authuser retained');
  await open('/document/d/forbidden/edit');
  await resetClip();
  await page.click('.gdocs-copy-md-button');
  await waitState('fail');
  s = await status();
  c = await clip();
  check(/HTTP 403/.test(s.detail) && c.text === null, 'HTTP errors fail without clipboard content', {s, c});
  check(s.failures.length === 1 && s.failures[0].phase === 'export' && /HTTP 403/.test(s.failures[0].message) && s.failures[0].comments === true && typeof s.failures[0].ms === 'number', 'export failure is recorded with its phase', s.failures);
  check(await page.locator('.gdocs-copy-md-button').evaluate(b => b.dataset.state === 'fail' && /^Copy failed: Export failed with HTTP 403/.test(b.title)), 'failure state and tooltip');
  await open('/document/d/limited/edit');
  await page.click('.gdocs-copy-md-button');
  await waitState('fail');
  check(/^Google is limiting exports \(HTTP 429\); try again in a minute$/.test((await status()).detail), 'rate limiting gets an actionable message', await status());
  await open('/document/d/login/edit');
  await resetClip();
  await page.click('.gdocs-copy-md-button');
  await waitState('fail');
  check(/web page/.test((await status()).detail) && (await clip()).text === null, 'HTML responses are not copied');
  await open('/document/d/doc123/edit');
  await page.evaluate(source);
  check(await page.locator('.gdocs-copy-md-button').count() === 1, 'reapplication keeps one button');
  await page.evaluate(() => {
    const old = document.querySelector('.docs-titlebar-buttons');
    const fresh = document.createElement('div');
    fresh.className = 'docs-titlebar-buttons';
    const share = document.createElement('span');
    share.id = 'docs-titlebar-share-client-button';
    fresh.append(share);
    old.replaceWith(fresh);
  });
  await page.waitForFunction(() => document.querySelector('.docs-titlebar-buttons .gdocs-copy-md-button'), null, {timeout: 3000});
  check(await page.locator('.gdocs-copy-md-button').count() === 1, 'remounts once after title bar re-render');
  await page.evaluate(() => window.__googleDocsCopyMarkdown.destroy());
  check(await page.locator('.gdocs-copy-md-container').count() === 0, 'destroy removes button');
  check(await page.evaluate(() => !window.__googleDocsCopyMarkdown && ![...document.querySelectorAll('style')].some(s => s.textContent.includes('gdocs-copy-md'))), 'destroy removes API and styles');
  check(pageErrors.length === 0, 'no uncaught browser errors', pageErrors);
  console.log('Google Docs Copy as Markdown:', checks, 'checks passed');
} finally { await browser.close(); server.close(); }
