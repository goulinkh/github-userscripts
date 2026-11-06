async (page) => {
  if (page.url() !== 'about:blank' || await page.title() !== 'OverType isolated fixture') {
    throw new Error('Tests are restricted to the isolated fixture, never GitHub.');
  }
  const passed = [];
  const check = (condition, name) => { if (!condition) throw new Error(name); passed.push(name); };
  const original = page.locator('#fixture-comment');
  const input = page.locator('.gh-ot-host .overtype-input');
  check(await page.locator('.gh-ot-shell').count() === 1, 'only eligible comment enhanced');
  check(await page.locator('.gh-ot-toggle, .gh-ot-topbar').count() === 0, 'no editor-switch controls');
  check(await input.inputValue() === 'Existing **draft**', 'existing draft preserved');
  check(await original.evaluate(n => n.inert && !n.disabled), 'bridge is inert, not disabled');
  await input.fill('## Heading\nFixture **bold**\n- item\n`code`');
  await page.waitForFunction(() => document.querySelector('#fixture-comment').value === document.querySelector('.overtype-input').value);
  check(await original.inputValue() === await input.inputValue(), 'OverType input synchronizes to bridge');
  check(await page.locator('.overtype-preview h2').count() === 1 && await page.locator('.overtype-preview strong').count() === 1,
    'headings and bold remain rendered in OverType');
  const submitted = await original.evaluate(n => new FormData(n.closest('form')).get('comment[body]'));
  check(submitted === await input.inputValue(), 'inert bridge still contributes its value to FormData (no submission)');

  await page.evaluate(() => {
    const n = document.querySelector('#fixture-comment');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(n, 'External input event');
    n.dispatchEvent(new InputEvent('input', { bubbles: true }));
  });
  check(await input.inputValue() === 'External input event', 'external input updates OverType immediately');
  await page.evaluate(() => {
    const n = document.querySelector('#fixture-comment');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(n, 'External silent change');
  });
  await page.waitForFunction(() => document.querySelector('.overtype-input').value === 'External silent change');
  check(await input.inputValue() === 'External silent change', 'fallback polling handles silent external updates');

  await page.evaluate(() => {
    const holder = document.createElement('div'); holder.id = 'dynamic';
    holder.innerHTML = '<div data-component="TextInput"><textarea name="review[body]">Dynamic review</textarea></div>';
    document.body.append(holder);
  });
  await page.waitForFunction(() => window.__githubOverType.status().editors === 2);
  check(await page.locator('#dynamic .gh-ot-shell').count() === 1, 'dynamic comment enhanced');
  await page.evaluate(() => document.querySelector('#dynamic').remove());
  await page.waitForFunction(() => window.__githubOverType.status().editors === 1);
  check(await page.locator('.gh-ot-shell').count() === 1, 'removed editor cleaned up');
  await page.evaluate(() => document.documentElement.setAttribute('data-color-mode', 'dark'));
  await page.waitForFunction(() => document.querySelector('.overtype-container').dataset.theme === 'github');
  check(true, 'GitHub token theme remains active across appearance changes');

  const before = await original.inputValue();
  await page.evaluate(() => window.__githubOverType.destroy());
  check(await page.locator('.gh-ot-shell, [data-gh-ot-enhanced], [data-github-overtype-style]').count() === 0, 'cleanup removes integration DOM');
  check(await original.inputValue() === before, 'cleanup preserves value');
  check(await original.getAttribute('aria-hidden') === null && await original.getAttribute('tabindex') === null,
    'cleanup restores native accessibility and tab order');
  check(await original.evaluate(n => !n.inert && !Object.hasOwn(n, 'focus')), 'cleanup restores inert and focus method');
  check(await original.locator('..').getAttribute('style') === 'position: relative', 'cleanup restores wrapper style');
  await page.evaluate(() => {
    document.body.append(document.createElement('div'));
    document.dispatchEvent(new Event('turbo:load'));
    document.documentElement.setAttribute('data-color-mode', 'light');
  });
  await page.waitForTimeout(900);
  check(await page.locator('.gh-ot-shell').count() === 0 && !await page.evaluate(() => !!window.__githubOverType), 'cleanup remains stopped');
  return { passed: passed.length, checks: passed };
}
