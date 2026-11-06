import { build, transform } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const { version } = JSON.parse(await readFile('package.json', 'utf8'));
await mkdir('build', { recursive: true });
await build({ entryPoints: ['src/highlighter.js'], bundle: true, format: 'iife', minify: true, legalComments: 'none', outfile: 'build/highlighter.js' });
const source = await readFile('src/github-overtype.js', 'utf8');
const clean = await transform(source, { minifySyntax: true, legalComments: 'none', charset: 'utf8', target: 'es2022' });
const base = 'https://raw.githubusercontent.com/goulinkh/github-userscripts/main/userscripts/github-overtype.user.js';
const metadata = `// ==UserScript==
// @name         GitHub OverType Comments
// @namespace    https://github.com/goulinkh/github-userscripts
// @version      ${version}
// @description  OverType Markdown editing and code highlighting for GitHub comments
// @author       goulinkh
// @license      MIT
// @homepageURL  https://github.com/goulinkh/github-userscripts
// @supportURL   https://github.com/goulinkh/github-userscripts/issues
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
