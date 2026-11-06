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
for (const file of ['src/github-overtype.js', 'src/highlighter.js', 'userscripts/github-overtype.user.js', 'src/github-sticky-pr.js', 'userscripts/github-sticky-pr.user.js']) {
  await transform(await readFile(file, 'utf8'), { loader: 'js' });
}
const stickyRelease = await readFile('userscripts/github-sticky-pr.user.js', 'utf8');
assert(stickyRelease.startsWith('// ==UserScript==\n'));
const stickySource = await readFile('src/github-sticky-pr.js', 'utf8');
const stickyVersion = stickySource.match(/const VERSION = '([^']+)';/)[1];
assert(stickyRelease.includes('// @version      ' + stickyVersion + '\n'));
assert(stickyRelease.includes('// @name         GitHub Sticky PR Navigation\n'));
assert(stickyRelease.includes('// @updateURL    https://raw.githubusercontent.com/goulinkh/github-userscripts/main/userscripts/github-sticky-pr.user.js\n'));
assert(stickyRelease.includes('// @grant        none\n'));
console.log('Metadata, version, license, vendor checksum and syntax checks passed');
