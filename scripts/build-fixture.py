#!/usr/bin/env python3
"""Bundle local source into MCP Playwright snippets; no server or npm install needed."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
source = (ROOT / 'src/github-overtype.js').read_text()
vendor_path = ROOT / 'vendor/overtype-2.4.0.min.js'
vendor_bytes = vendor_path.read_bytes()
expected = (ROOT / 'vendor/SHA256SUMS').read_text().split()[0]
if hashlib.sha256(vendor_bytes).hexdigest() != expected:
    raise SystemExit('OverType vendor checksum mismatch')
vendor = vendor_bytes.decode()
highlighter = (ROOT / 'build/highlighter.js').read_text()

# Inject via Playwright's execution context, not a DOM script tag: no localhost,
# browser file permissions, extension-editor access, or GitHub CSP changes needed.
apply = '''async (page) => {
  const target = new URL(page.url());
  const fixture = target.href === 'about:blank' && await page.title() === 'OverType isolated fixture';
  if (!fixture && !(target.protocol === 'https:' && ['github.com', 'gist.github.com'].includes(target.hostname))) {
    throw new Error('Apply only to GitHub, Gist, or our isolated fixture');
  }
  const legacy = await page.evaluate(() => !window.__githubOverType && !!document.querySelector('[data-gh-ot-enhanced], .gh-ot-shell'));
  if (legacy) throw new Error('Disable the old Tampermonkey script and reload first.');
  const originals = await page.locator('textarea:not(.overtype-input)').all();
  const before = await Promise.all(originals.map(el => el.inputValue()));
  // Mutation-free listeners record whether initialization touches GitHub's inputs.
  await page.evaluate(() => {
    window.__ghOtApplyEvents = 0;
    window.__ghOtApplyListener = event => {
      if (event.target.matches?.('textarea:not(.overtype-input)')) window.__ghOtApplyEvents++;
    };
    document.addEventListener('input', window.__ghOtApplyListener, true);
    document.addEventListener('change', window.__ghOtApplyListener, true);
  });
  try {
    if (!await page.evaluate(() => typeof (window.OverType?.default || window.OverType) === 'function')) {
      await page.evaluate(VENDOR);
    }
    await page.evaluate(HIGHLIGHTER);
    await page.evaluate(SOURCE);
    const preserved = (await Promise.all(originals.map(async (el, index) => await el.inputValue() === before[index]))).every(Boolean);
    const result = await page.evaluate(() => ({
      ...window.__githubOverType?.status(),
      shells: document.querySelectorAll('.gh-ot-shell').length,
      nativeInputEvents: window.__ghOtApplyEvents
    }));
    if (!preserved || result.nativeInputEvents !== 0) {
      await page.evaluate(() => window.__githubOverType?.destroy());
      throw new Error('Initialization modified a native textarea or dispatched input/change');
    }
    if (!result.version) throw new Error('Script failed to initialize');
    return { ...result, nativeValuesPreserved: preserved };
  } finally {
    await page.evaluate(() => {
      document.removeEventListener('input', window.__ghOtApplyListener, true);
      document.removeEventListener('change', window.__ghOtApplyListener, true);
      delete window.__ghOtApplyListener;
      delete window.__ghOtApplyEvents;
    });
  }
}'''
apply = apply.replace('page.evaluate(VENDOR)', 'page.evaluate(' + json.dumps(vendor) + ')')
apply = apply.replace('page.evaluate(HIGHLIGHTER)', 'page.evaluate(' + json.dumps(highlighter) + ')')
apply = apply.replace('page.evaluate(SOURCE)', 'page.evaluate(' + json.dumps(source) + ')')
(ROOT / 'build/apply.playwright.js').write_text(apply + '\n')

# A clean synthetic page: these form fields have no GitHub listeners or persistence.
fixture_html = '''<!doctype html><html data-color-mode="light"><head>
<title>OverType isolated fixture</title><style>
/* Synthetic test tokens, not a copied production GitHub theme. */
:root {
  --fontStack-system: system-ui, sans-serif;
  --fontStack-monospace: ui-monospace, monospace;
  --text-body-size-medium: .875rem;
  --text-body-size-small: .75rem;
  --text-body-lineHeight-medium: 1.5;
  --text-body-weight: 400;
  --base-size-8: 8px;
  --bgColor-default: white;
  --bgColor-muted: whitesmoke;
  --bgColor-neutral-muted: gainsboro;
  --fgColor-default: black;
  --fgColor-muted: dimgray;
  --fgColor-accent: blue;
  --fgColor-link: var(--fgColor-accent);
  --borderColor-default: gray;
  --borderColor-muted: silver;
  --control-fgColor-placeholder: var(--fgColor-muted);
  --selection-bgColor: lightblue;
  --color-prettylights-syntax-markup-heading: navy;
  --color-prettylights-syntax-markup-bold: darkred;
  --color-prettylights-syntax-markup-italic: darkgreen;
  --color-prettylights-syntax-markup-deleted-text: maroon;
  --color-prettylights-syntax-markup-list: darkgoldenrod;
  --focus-outlineColor: blue;
  --focus-outline: 2px solid var(--focus-outlineColor);
  --focus-outline-offset: -2px;
}
body { font: var(--text-body-weight) var(--text-body-size-medium) / var(--text-body-lineHeight-medium) var(--fontStack-system); margin: 32px; background: var(--bgColor-default); color: var(--fgColor-default); }
form { max-width: 700px; margin: 24px 0; }
[data-component="TextInput"] { position: relative; border: 1px solid var(--borderColor-default); border-radius: 6px; }
textarea { box-sizing: border-box; width: 100%; min-height: 180px; padding: var(--base-size-8); font: inherit; color: var(--fgColor-default); background: var(--bgColor-default); }
</style></head><body><h1>Isolated OverType test — not GitHub</h1>
<form class="js-comment-form" onsubmit="event.preventDefault()">
<div data-component="TextInput" style="position: relative"><textarea id="fixture-comment" name="comment[body]" aria-label="Comment body" placeholder="Leave a comment">Existing **draft**</textarea></div>
<button type="button" id="mention" aria-label="Mention a user">Mention</button>
</form>
<textarea id="unrelated" aria-label="Unrelated plain text">Unrelated</textarea>
<textarea id="disabled" name="comment[body]" disabled>Disabled</textarea>
<textarea id="readonly" name="comment[body]" readonly>Read only</textarea>
<div class="CodeMirror"><textarea id="code" name="body">Code editor</textarea></div>
</body></html>'''
fixture = '''async (page) => {
  if (page.url() !== 'about:blank') throw new Error('Create/select a new about:blank tab first; never replace a GitHub page.');
  // setContent alone removes document listeners but retains OverType's global
  // initialized flag. Navigate first so repeat fixture runs get a fresh library.
  await page.goto('about:blank');
  await page.setContent(HTML);
  return await (APPLY)(page);
}'''.replace('HTML', json.dumps(fixture_html)).replace('APPLY', apply)
(ROOT / 'build/fixture.playwright.js').write_text(fixture + '\n')
print('Built apply.playwright.js and fixture.playwright.js')
