async (page) => {
  if (page.url() !== 'about:blank' || await page.title() !== 'OverType isolated fixture') {
    throw new Error('Focus tests only run in the isolated fixture.');
  }
  const checks = [];
  const check = (ok, name) => { if (!ok) throw new Error(name); checks.push(name); };
  const input = page.locator('.overtype-input');
  await input.fill('');
  await input.focus();
  await page.evaluate(() => {
    const n = document.querySelector('#fixture-comment');
    window.__focusRegression = () => { if (n.value === '##') n.focus(); };
    n.addEventListener('input', window.__focusRegression);
    window.__hiddenFocusCount = 0;
    window.__hiddenFocusListener = () => window.__hiddenFocusCount++;
    n.addEventListener('focus', window.__hiddenFocusListener);
  });
  try {
    await input.pressSequentially('## heading', { delay: 15 });
    const state = await page.evaluate(() => {
      const n = document.querySelector('#fixture-comment'), i = document.querySelector('.overtype-input');
      return { mode: document.querySelector('.gh-ot-shell').dataset.mode, hidden: n.getAttribute('aria-hidden'),
        overtypeFocused: document.activeElement === i, nativeFocusEvents: window.__hiddenFocusCount,
        value: n.value, editorValue: i.value, visible: !!i.getClientRects().length,
        heading: document.querySelector('.overtype-preview h2')?.textContent };
    });
    check(state.mode === 'overtype' && state.overtypeFocused && state.hidden === 'true' && state.visible,
      'typing ## cannot switch away from OverType: ' + JSON.stringify(state));
    check(state.nativeFocusEvents === 0, 'autocomplete focus requests never focus the hidden bridge');
    check(state.value === '## heading' && state.editorValue === state.value && state.heading === '## heading',
      'typing remains synchronized and syntax-highlighted without a switch button');
    check(await page.locator('.gh-ot-toggle, .gh-ot-topbar').count() === 0, 'no editor switch is exposed');

    const external = await page.evaluate(() => {
      const n = document.querySelector('#fixture-comment');
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(n, '#123 reference');
      n.setSelectionRange(4, 4);
      n.focus();
      const i = document.querySelector('.overtype-input');
      return { value: i.value, focused: document.activeElement === i, selection: i.selectionStart };
    });
    check(external.value === '#123 reference' && external.focused && external.selection === 4,
      'native insertion and caret are adopted by OverType, not displayed in a native editor');

    // Bypassing the own focus adapter must still be harmless: inert is enforced
    // by the browser rather than relying on a focus-event ping-pong loop.
    const bypass = await page.evaluate(() => {
      const n = document.querySelector('#fixture-comment');
      HTMLElement.prototype.focus.call(n);
      return { active: document.activeElement === document.querySelector('.overtype-input'), count: window.__hiddenFocusCount };
    });
    check(bypass.active && bypass.count === 0, 'prototype focus cannot steal focus from OverType');

    // Simulate a toolbar button taking focus before restoring editing focus.
    const toolbar = await page.evaluate(() => {
      document.querySelector('#mention').focus();
      document.querySelector('#fixture-comment').focus();
      return document.activeElement === document.querySelector('.overtype-input');
    });
    check(toolbar, 'toolbar focus restoration returns to OverType');

    const accepted = await page.evaluate(() => {
      const n = document.querySelector('#fixture-comment');
      const accept = () => {
        if (n.value === 'trigger') {
          Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(n, '#123 accepted');
          n.setSelectionRange(4, 4);
          n.focus();
        }
      };
      n.addEventListener('input', accept);
      const i = document.querySelector('.overtype-input');
      try {
        i.value = 'trigger';
        i.dispatchEvent(new InputEvent('input', { bubbles: true }));
        return { native: n.value, value: i.value, focus: document.activeElement === i, selection: i.selectionStart };
      } finally { n.removeEventListener('input', accept); }
    });
    check(accepted.value === '#123 accepted' && accepted.native === accepted.value && accepted.focus && accepted.selection === 4,
      'synchronous GitHub insertions during bridge dispatch are adopted without feedback or caret loss');
    return { passed: checks.length, checks };
  } finally {
    await page.evaluate(() => {
      const n = document.querySelector('#fixture-comment');
      n?.removeEventListener('input', window.__focusRegression);
      n?.removeEventListener('focus', window.__hiddenFocusListener);
      delete window.__focusRegression; delete window.__hiddenFocusCount; delete window.__hiddenFocusListener;
    });
  }
}
