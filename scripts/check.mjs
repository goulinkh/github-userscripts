import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { transform } from 'esbuild';

const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const source = await readFile('src/github-overtype.js', 'utf8');
const release = await readFile('userscripts/github-overtype.user.js', 'utf8');
assert(release.startsWith('// ==UserScript==\n'));
assert(release.includes('// @version      ' + version + '\n'));
assert(source.includes('version: "' + version + '"'));
assert(release.includes('Copyright (c) 2025 pngwn'));
const sums = await readFile('vendor/SHA256SUMS', 'utf8');
const vendor = await readFile('vendor/overtype-2.4.0.min.js');
assert.equal(createHash('sha256').update(vendor).digest('hex'), sums.split(/\s+/)[0]);
for (const file of ['src/github-overtype.js', 'src/highlighter.js', 'userscripts/github-overtype.user.js', 'src/github-sticky-pr.js', 'userscripts/github-sticky-pr.user.js', 'src/google-docs-copy-md.js', 'userscripts/google-docs-copy-md.user.js', 'src/google-docs-md-clipboard.js', 'userscripts/google-docs-md-clipboard.user.js']) {
  await transform(await readFile(file, 'utf8'), { loader: 'js' });
}
const stickyRelease = await readFile('userscripts/github-sticky-pr.user.js', 'utf8');
assert(stickyRelease.startsWith('// ==UserScript==\n'));
const stickySource = await readFile('src/github-sticky-pr.js', 'utf8');
const stickyVersion = stickySource.match(/const VERSION = '([^']+)';/)[1];
assert(stickyRelease.includes('// @version      ' + stickyVersion + '\n'));
assert(stickyRelease.includes('// @name         GitHub Sticky PR Navigation\n'));
assert(stickyRelease.includes('// @updateURL    https://raw.githubusercontent.com/goulinkh/userscripts/main/userscripts/github-sticky-pr.user.js\n'));
assert(stickyRelease.includes('// @grant        none\n'));
const docsRelease = await readFile('userscripts/google-docs-copy-md.user.js', 'utf8');
const docsSource = await readFile('src/google-docs-copy-md.js', 'utf8');
const docsVersion = docsSource.match(/const VERSION = '([^']+)';/)[1];
assert(docsRelease.startsWith('// ==UserScript==\n'));
assert(docsRelease.includes('// @version      ' + docsVersion + '\n'));
assert(docsRelease.includes('// @name         Google Docs Copy as Markdown\n'));
assert(docsRelease.includes('// @updateURL    https://raw.githubusercontent.com/goulinkh/userscripts/main/userscripts/google-docs-copy-md.user.js\n'));
assert(docsRelease.includes('// @grant        none\n'));
assert(!/innerHTML|outerHTML|insertAdjacentHTML/.test(docsSource), 'Google Docs requires Trusted Types; build DOM without HTML strings');
const clipboardRelease = await readFile('userscripts/google-docs-md-clipboard.user.js', 'utf8');
const clipboardSource = await readFile('src/google-docs-md-clipboard.js', 'utf8');
const clipboardVersion = clipboardSource.match(/const VERSION = '([^']+)';/)[1];
assert(clipboardRelease.startsWith('// ==UserScript==\n'));
assert(clipboardRelease.includes('// @version      ' + clipboardVersion + '\n'));
assert(clipboardRelease.includes('// @name         Google Docs Markdown Clipboard\n'));
assert(clipboardRelease.includes('// @updateURL    https://raw.githubusercontent.com/goulinkh/userscripts/main/userscripts/google-docs-md-clipboard.user.js\n'));
assert(clipboardRelease.includes('// @grant        none\n'));
assert(!/innerHTML|outerHTML|insertAdjacentHTML/.test(clipboardSource), 'Google Docs requires Trusted Types; build DOM without HTML strings');
for (const file of ['userscripts/github-overtype.user.js', 'userscripts/github-sticky-pr.user.js', 'userscripts/google-docs-copy-md.user.js', 'userscripts/google-docs-md-clipboard.user.js']) {
  const release = await readFile(file, 'utf8');
  assert(release.includes('// @namespace    https://github.com/goulinkh/github-userscripts\n'), file + ': keep the namespace; userscript managers identify scripts by name and namespace');
  assert(!/^\/\/ @(?:homepageURL|supportURL|downloadURL|updateURL) .*github-userscripts/m.test(release), file + ': links must use the renamed repository');
}
console.log('Metadata, version, license, vendor checksum and syntax checks passed');
