async (page) => {
  if (page.url() !== 'about:blank' || await page.title() !== 'OverType isolated fixture') {
    throw new Error('Visibility tests only run in the isolated fixture.');
  }
  const checks = [];
  const check = (ok, name) => { if (!ok) throw new Error(name); checks.push(name); };
  await page.evaluate(() => document.documentElement.style.setProperty('--bgColor-default', '#212830'));
  await page.locator('.overtype-input').fill('## Heading\n**Always OverType**');
  const measure = async () => await page.evaluate(() => {
    const shell = document.querySelector('.gh-ot-shell'), n = document.querySelector('#fixture-comment');
    const i = shell.querySelector('.overtype-input'), p = shell.querySelector('.overtype-preview');
    return { mode: shell.dataset.mode,
      nativeTextHidden: getComputedStyle(n).color === 'rgba(0, 0, 0, 0)' &&
        getComputedStyle(n).webkitTextFillColor === 'rgba(0, 0, 0, 0)' &&
        getComputedStyle(n, '::placeholder').opacity === '0',
      inert: n.inert, hostDisplay: getComputedStyle(shell.querySelector('.gh-ot-host')).display,
      inputVisible: !!i.getClientRects().length, previewVisible: !!p.getClientRects().length,
      sameValue: n.value === i.value, heading: !!p.querySelector('h2'), bold: !!p.querySelector('strong') };
  });
  let state = await measure();
  check(state.mode === 'overtype' && state.hostDisplay !== 'none' && state.inputVisible && state.previewVisible,
    'OverType input and syntax preview remain visible');
  check(state.nativeTextHidden && state.inert, 'native bridge glyphs stay hidden and inert without hiding its background');
  check(state.sameValue && state.heading && state.bold, 'visible highlighted text matches the bridge value');
  for (const mode of ['dark', 'light']) {
    await page.evaluate(mode => document.documentElement.setAttribute('data-color-mode', mode), mode);
    await page.waitForFunction(() => document.querySelector('.overtype-container').dataset.theme === 'github');
    state = await measure();
    check(state.mode === 'overtype' && state.inputVisible && state.previewVisible && state.nativeTextHidden,
      'theme changes never reveal native editing: ' + mode);
  }
  await page.evaluate(() => document.querySelector('#fixture-comment').focus());
  state = await measure();
  check(state.mode === 'overtype' && state.previewVisible && state.nativeTextHidden,
    'autocomplete focus requests never replace the highlighted surface');
  check(await page.locator('.gh-ot-toggle').count() === 0, 'no GitHub/OverType switch button');
  return { passed: checks.length, checks };
}
