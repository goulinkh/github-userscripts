import { build, transform } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const { version } = JSON.parse(await readFile('package.json', 'utf8'));
await mkdir('build', { recursive: true });
await build({ entryPoints: ['src/highlighter.js'], bundle: true, format: 'iife', minify: true, legalComments: 'none', outfile: 'build/highlighter.js' });
const source = await readFile('src/github-overtype.js', 'utf8');
const clean = await transform(source, { minifySyntax: true, legalComments: 'none', charset: 'utf8', target: 'es2022' });
const base = 'https://raw.githubusercontent.com/goulinkh/userscripts/main/userscripts/github-overtype.user.js';
const metadata = `// ==UserScript==
// @name         GitHub OverType Comments
// @namespace    https://github.com/goulinkh/github-userscripts
// @version      ${version}
// @description  OverType Markdown editing and code highlighting for GitHub comments
// @author       goulinkh
// @license      MIT
// @homepageURL  https://github.com/goulinkh/userscripts
// @supportURL   https://github.com/goulinkh/userscripts/issues
// @downloadURL  ${base}
// @updateURL    ${base}
// @match        https://github.com/*
// @match        https://gist.github.com/*
// @require      https://cdn.jsdelivr.net/npm/overtype@2.4.0/dist/overtype.min.js
// @run-at       document-idle
// @grant        none
// ==/UserScript==`;
const license = await readFile('vendor/TWINKLEPLOP-LICENSE', 'utf8');
const helper = await readFile('build/highlighter.js', 'utf8');
await writeFile('userscripts/github-overtype.user.js', `${metadata}\n\n/*! Bundled Twinkleplop TypeScript/JavaScript/core:\n${license}*/\n${helper}\n${clean.code}`);
execFileSync('python3', ['scripts/build-fixture.py'], { stdio: 'inherit' });
console.log(`Built GitHub OverType ${version}`);
const stickySource = await readFile('src/github-sticky-pr.js', 'utf8');
const stickyVersion = stickySource.match(/const VERSION = '([^']+)';/)[1];
const stickyClean = await transform(stickySource, { minifySyntax: true, legalComments: 'none', charset: 'utf8', target: 'es2022' });
const stickyBase = 'https://raw.githubusercontent.com/goulinkh/userscripts/main/userscripts/github-sticky-pr.user.js';
await writeFile('userscripts/github-sticky-pr.user.js', `// ==UserScript==
// @name         GitHub Sticky PR Navigation
// @namespace    https://github.com/goulinkh/github-userscripts
// @version      ${stickyVersion}
// @description  Compact pinned PR tabs with coordinated GitHub sticky headers
// @author       goulinkh
// @license      MIT
// @homepageURL  https://github.com/goulinkh/userscripts
// @supportURL   https://github.com/goulinkh/userscripts/issues
// @downloadURL  ${stickyBase}
// @updateURL    ${stickyBase}
// @match        https://github.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
\n${stickyClean.code}`);
await writeFile('build/apply-sticky.playwright.js', `async page => {
  if (new URL(page.url()).hostname !== 'github.com') throw Error('GitHub only');
  await page.evaluate(${JSON.stringify(stickySource)});
  await page.waitForTimeout(100);
  return page.evaluate(() => window.__githubStickyPR.status());
}`);
const docsSource = await readFile('src/google-docs-copy-md.js', 'utf8');
const docsVersion = docsSource.match(/const VERSION = '([^']+)';/)[1];
const docsClean = await transform(docsSource, { minifySyntax: true, legalComments: 'none', charset: 'utf8', target: 'es2022' });
const docsBase = 'https://raw.githubusercontent.com/goulinkh/userscripts/main/userscripts/google-docs-copy-md.user.js';
await writeFile('userscripts/google-docs-copy-md.user.js', `// ==UserScript==
// @name         Google Docs Copy as Markdown
// @namespace    https://github.com/goulinkh/github-userscripts
// @version      ${docsVersion}
// @description  Adds a Copy as MD button that copies Google Docs' Markdown export to the clipboard
// @author       goulinkh
// @license      MIT
// @homepageURL  https://github.com/goulinkh/userscripts
// @supportURL   https://github.com/goulinkh/userscripts/issues
// @downloadURL  ${docsBase}
// @updateURL    ${docsBase}
// @match        https://docs.google.com/document/d/*
// @match        https://docs.google.com/document/u/*/d/*
// @noframes
// @run-at       document-idle
// @grant        none
// ==/UserScript==
\n${docsClean.code}`);
await writeFile('build/apply-gdocs-copy-md.playwright.js', `async page => {
  if (new URL(page.url()).hostname !== 'docs.google.com') throw Error('Google Docs only');
  await page.evaluate(${JSON.stringify(docsSource)});
  await page.waitForTimeout(100);
  return page.evaluate(() => window.__googleDocsCopyMarkdown.status());
}`);
console.log(`Built Google Docs Copy as Markdown ${docsVersion}`);
