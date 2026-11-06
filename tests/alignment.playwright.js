async (page) => {
  if (page.url() !== 'about:blank' || await page.title() !== 'OverType isolated fixture') {
    throw new Error('Alignment tests may only run in the isolated fixture.');
  }
  if (!await page.evaluate(() => !!window.__githubOverType)) throw new Error('Apply the script to the fixture first.');
  await page.evaluate(() => {
    document.querySelector('#fixture-comment').closest('form').classList.add('github-repro');
    let style = document.querySelector('#github-padding-repro');
    if (!style) {
      style = document.createElement('style');
      style.id = 'github-padding-repro';
      // Reproduce the live GitHub rule's layered !important precedence.
      style.textContent = '@layer github-repro { .github-repro textarea { padding: 8px !important; } }';
      document.head.append(style);
    }
  });
  const samples = [
    { name: 'single character', value: '@', offset: 1 },
    { name: 'plain text', value: 'Cursor alignment test', offset: 7 },
    { name: 'third line', value: 'first line\nsecond line\nthird line', offset: 27 },
    { name: 'wrapped text', value: 'Wrap this sentence across several lines. '.repeat(8), offset: 175 }
  ];
  const results = [];
  for (const sample of samples) {
    await page.locator('.gh-ot-host .overtype-input').fill(sample.value);
    await page.waitForFunction(value => document.querySelector('#fixture-comment').value === value, sample.value);
    await page.evaluate(offset => {
      const input = document.querySelector('.gh-ot-host .overtype-input');
      input.focus();
      input.setSelectionRange(offset, offset);
    }, sample.offset);
    await page.waitForFunction(() => {
      const input = document.querySelector('.gh-ot-host .overtype-input');
      const preview = document.querySelector('.gh-ot-host .overtype-preview');
      return Math.abs(input.scrollTop - preview.scrollTop) <= 0.5;
    });
    const measurement = await page.evaluate(({name, offset}) => {
      const input = document.querySelector('.gh-ot-host .overtype-input');
      const preview = document.querySelector('.gh-ot-host .overtype-preview');
      const css = getComputedStyle(input);
      const box = input.getBoundingClientRect();
      // Textarea internals aren't DOM nodes. Mirror its *computed* typography,
      // dimensions and padding to measure the browser's actual text layout.
      const mirror = document.createElement('div');
      // Keep the same scrollbar rules/gutter: hiding overflow changes wrap width
      // once larger text needs a vertical scrollbar.
      mirror.className = input.className;
      for (const property of css) mirror.style.setProperty(property, css.getPropertyValue(property), 'important');
      for (const [key, value] of Object.entries({
        position:'fixed', left:`${box.left}px`, top:`${box.top}px`,
        width:`${box.width}px`, height:`${box.height}px`, margin:'0',
        visibility:'hidden', pointerEvents:'none', overflow:css.overflow
      })) mirror.style.setProperty(key.replace(/[A-Z]/g, c => '-' + c.toLowerCase()), value, 'important');
      const text = document.createTextNode(input.value);
      mirror.append(text);
      input.parentElement.append(mirror);
      try {
        const range = document.createRange();
        range.setStart(text, offset);
        range.collapse(true);
        const native = range.getBoundingClientRect();
        const preceding = input.value.slice(0, offset).split('\n');
        const line = preview.children[preceding.length - 1];
        if (!line) throw new Error('Missing preview line');
        const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
        let remaining = preceding.at(-1).length;
        let node;
        while ((node = walker.nextNode())) {
          if (remaining <= node.length) break;
          remaining -= node.length;
        }
        if (!node) throw new Error('Missing preview text');
        range.setStart(node, remaining);
        range.collapse(true);
        const visible = range.getBoundingClientRect();
        return {
          name,
          inputPadding: css.padding,
          previewPadding: getComputedStyle(preview).padding,
          deltaX: visible.x - (native.x - input.scrollLeft),
          deltaY: visible.y - (native.y - input.scrollTop)
        };
      } finally { mirror.remove(); }
    }, sample);
    results.push(measurement);
  }
  const passed = results.every(r => Math.abs(r.deltaX) <= 0.5 && Math.abs(r.deltaY) <= 0.5);
  if (!passed) throw new Error('Caret/preview alignment regression: ' + JSON.stringify(results));
  return { passed: true, toleranceCSSPixels: 0.5, measurements: results };
}
