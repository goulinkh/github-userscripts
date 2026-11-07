async page => {
  if (page.url() !== 'about:blank' || await page.title() !== 'OverType isolated fixture') throw Error('Fixture only');
  const checks = [];
  const check = (ok, name) => { if (!ok) throw Error(name); checks.push(name); };
  await page.evaluate(() => {
    document.activeElement?.blur();
    const native = document.querySelector('#fixture-comment');
    const list = document.createElement('ul');
    list.id = 'lazy-suggestions';
    list.setAttribute('role', 'listbox');
    document.body.append(list);
    const state = window.__lazySuggestions = { loaded: false, focusNotifications: 0, nativeFocus: 0, inputs: 0, changes: 0 };
    const render = () => {
      if (!native.value.startsWith('@')) return;
      list.innerHTML = state.loaded ? '<li role="option">fixture-user</li>' : '<li data-loading="true">Loading</li>';
      native.setAttribute('aria-expanded', 'true');
      native.setAttribute('aria-controls', list.id);
    };
    const focusin = event => {
      if (event.target !== native) return;
      state.focusNotifications++;
      state.nativeFocus += Number(document.activeElement === native);
      Promise.resolve().then(() => { state.loaded = true; render(); });
    };
    const input = () => { state.inputs++; render(); };
    const change = () => { state.changes++; };
    document.addEventListener('focusin', focusin);
    native.addEventListener('input', input);
    native.addEventListener('change', change);
    state.cleanup = () => {
      document.removeEventListener('focusin', focusin);
      native.removeEventListener('input', input);
      native.removeEventListener('change', change);
      native.removeAttribute('aria-expanded');
      native.removeAttribute('aria-controls');
      list.remove();
      delete window.__lazySuggestions;
    };
  });
  try {
    const input = page.locator('.overtype-input');
    const before = await input.inputValue();
    await input.focus();
    let s = await page.evaluate(() => {
      const {loaded, focusNotifications, nativeFocus, inputs, changes} = window.__lazySuggestions;
      return {loaded, focusNotifications, nativeFocus, inputs, changes};
    });
    check(s.loaded && s.focusNotifications === 1, 'visible focus starts host lazy suggestion loading exactly once');
    check(s.nativeFocus === 0, 'notification never focuses the inert native field');
    check(s.inputs === 0 && s.changes === 0 && await input.inputValue() === before, 'focus notification preserves text without input/change events');
    await input.fill('@fixture');
    check(await page.locator('#lazy-suggestions [role=option]').count() === 1, 'mention popup resolves to options rather than staying in loading state');
    check(await input.evaluate(e => document.activeElement === e), 'visible editor retains focus while suggestions load');
    await page.evaluate(() => document.querySelector('.overtype-input').blur());
    await page.evaluate(() => document.querySelector('#fixture-comment').focus());
    check(await page.evaluate(() => window.__lazySuggestions.focusNotifications === 2 && document.activeElement.matches('.overtype-input')), 'toolbar focus forwarding also notifies the host without native focus');
    return {passed: checks.length, checks};
  } finally {
    await page.evaluate(() => window.__lazySuggestions.cleanup());
  }
}
