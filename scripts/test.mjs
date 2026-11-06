import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined });
const page = await browser.newPage();
async function run(file) {
  const code = await readFile(file, 'utf8');
  const fn = vm.runInNewContext('(' + code + ')', { URL });
  const result = await fn(page);
  console.log(file, JSON.stringify(result));
}
try {
  await page.goto('about:blank');
  await run('build/fixture.playwright.js');
  await run('tests/theme.playwright.js');
  await run('tests/alignment.playwright.js');
  await run('build/fixture.playwright.js');
  for (const name of ['editing', 'focus-handoff', 'native-visibility', 'autocomplete', 'highlighting']) {
    await run('tests/' + name + '.playwright.js');
  }
  await run('build/fixture.playwright.js');
  const original = await page.locator('#fixture-comment').inputValue();
  await page.evaluate(await readFile('userscripts/github-overtype.user.js', 'utf8'));
  if (await page.locator('#fixture-comment').inputValue() !== original) throw Error('Standalone installation changed text');
  if (await page.evaluate(() => window.__githubOverType.status().version) !== version) throw Error('Standalone version mismatch');
  await run('tests/test.playwright.js');
} finally {
  await browser.close();
}
