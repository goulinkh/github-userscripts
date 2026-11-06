async (page) => {
  if (page.url() !== 'about:blank' || await page.title() !== 'OverType isolated fixture') throw new Error('Fixture only');
  const input = page.locator('.overtype-input');
  const checks = [];
  const equal = (actual, expected, name) => {
    if (actual !== expected) throw new Error(name + ': expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
    checks.push(name);
  };
  // Model a host application that consumes bubbling Enter before OverType's
  // document-level listener. Do not install this stub on the actual PR.
  await page.evaluate(() => {
    window.__hostEnterHandler = e => { if (e.key === 'Enter') e.stopPropagation(); };
    document.querySelector('#fixture-comment').parentElement.addEventListener('keydown', window.__hostEnterHandler);
  });
  const enter = async value => { await input.fill(value); await input.press('Enter'); return await input.inputValue(); };
  try {
    await input.fill('- dasd'); await input.press('Enter'); await input.pressSequentially('dasda');
    equal(await input.inputValue(), '- dasd\n- dasda', 'bullet continuation survives host key handlers');
    const afterCode = '```js\nconsole.log(1);\n```\n\n- first';
    equal(await enter(afterCode), afterCode + '\n- ', 'bullet after a closed code block continues');
    const afterTildeCode = '~~~js\nconsole.log(1);\n~~~\n\n- first';
    equal(await enter(afterTildeCode), afterTildeCode + '\n- ', 'bullet after a closed tilde block continues');
    await input.fill('```js\nconsole.log(1);\n```');
    const block = await page.evaluate(() => {
      const p = document.querySelector('.overtype-preview');
      const rows = [...p.querySelectorAll('.code-block-line, pre.code-block')];
      const css = rows.map(e => ({radius: getComputedStyle(e).borderRadius, bg: getComputedStyle(e).backgroundColor,
        top: e.getBoundingClientRect().top, bottom: e.getBoundingClientRect().bottom,
        left: e.getBoundingClientRect().left, right: e.getBoundingClientRect().right}));
      return css.length === 3 && css.every(s => s.radius === '0px' && s.bg === css[0].bg && s.left === css[0].left && s.right === css[0].right) &&
        css.slice(1).every((s, index) => Math.abs(s.top - css[index].bottom) < 0.5);
    });
    equal(block, true, 'code body and fence rows have continuous square-edged backgrounds');
    equal(await enter('* first'), '* first\n* ', 'star bullets continue');
    equal(await enter('+ first'), '+ first\n+ ', 'plus bullets continue');
    equal(await enter('  - nested'), '  - nested\n  - ', 'nested indentation retained');
    equal(await enter('1. first'), '1. first\n2. ', 'numbered list increments');
    equal(await enter('- [x] done'), '- [x] done\n- [ ] ', 'checkbox continuation starts unchecked');
    equal(await enter('- '), '', 'empty bullet exits list');
    await input.fill('- first'); await input.press('Shift+Enter');
    equal(await input.inputValue(), '- first\n', 'Shift+Enter makes a plain newline');
    await input.fill('- abcd');
    await input.evaluate(i => i.setSelectionRange(4, 4));
    await input.press('Enter');
    equal(await input.inputValue(), '- ab\n- cd', 'Enter splits a list item at the caret');

    equal(await enter('```js'), '```js\n\n```', 'Enter after an opening fence adds the closing fence');
    equal(await input.evaluate(i => i.selectionStart), 6, 'caret placed inside new code block');
    await input.pressSequentially('const x = 1;');
    equal(await input.inputValue(), '```js\nconst x = 1;\n```', 'typing goes between paired fences');
    equal(await enter('~~~python'), '~~~python\n\n~~~', 'tilde fences auto-close');
    equal(await enter('````js'), '````js\n\n````', 'closing fence preserves opening length');
    equal(await enter('  ```js'), '  ```js\n  \n  ```', 'fence indentation preserved');
    await input.fill('```js\nexisting\n```'); await input.evaluate(i => i.setSelectionRange(5, 5));
    await input.press('Enter');
    equal(await input.inputValue(), '```js\n\nexisting\n```', 'existing closing fence is not duplicated');
    equal(await enter('```\n- literal'), '```\n- literal\n', 'list-like code is not continued as a Markdown list');
    equal(await enter('```js\n  const x = 1;'), '```js\n  const x = 1;\n  ', 'indentation continues within a code block');
    equal(await enter('```js\ncode\n```'), '```js\ncode\n```\n', 'Enter after a closing fence does not create another block');
    equal(await enter('ordinary text'), 'ordinary text\n', 'ordinary Enter stays a normal newline');
    await input.fill('```js'); await input.press('Shift+Enter');
    equal(await input.inputValue(), '```js\n', 'Shift+Enter bypasses fence completion');
    await input.fill('```js'); await input.press('Enter');
    // Exercise the browser undo command directly rather than depending on
    // operating-system shortcut routing through browser automation.
    equal(await page.evaluate(() => document.execCommand('undo')), true, 'native undo command succeeds');
    equal(await input.inputValue(), '```js', 'fence completion is undoable');
    const values = await page.evaluate(() => {
      const n = document.querySelector('#fixture-comment'), i = document.querySelector('.overtype-input');
      return { same: n.value === i.value, focused: document.activeElement === i };
    });
    equal(values.same, true, 'smart edits synchronize to the original');
    equal(values.focused, true, 'smart edits keep focus in OverType');
    return { passed: checks.length, checks };
  } finally {
    await page.evaluate(() => {
      document.querySelector('#fixture-comment').parentElement.removeEventListener('keydown', window.__hostEnterHandler);
      delete window.__hostEnterHandler;
    });
  }
}
