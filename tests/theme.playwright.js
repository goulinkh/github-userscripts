async (page) => {
  if (page.url() !== 'about:blank' || await page.title() !== 'OverType isolated fixture') throw new Error('Theme tests only run in the isolated fixture');
  const checks = [];
  const check = (ok, name, details) => { if (!ok) throw new Error(name + (details ? ': ' + JSON.stringify(details) : '')); checks.push(name); };
  const input = page.locator('.overtype-input');
  await input.fill('## Heading\n**bold** and *italic* ~~deleted~~ [link](https://example.invalid)\n- item\n`code`\n> quote');
  await page.evaluate(() => {
    window.__themeTestInstance = document.querySelector('.overtype-wrapper')._instance;
    const style = document.createElement('style');
    style.id = 'theme-regression-tokens';
    // Deliberately synthetic colors: verify references rather than copied theme values.
    document.querySelector('#fixture-comment').style.backgroundColor = 'var(--fixture-input-background)';
    style.textContent = ':root { --fixture-input-background: rgb(70, 80, 90); } [data-color-mode="dark"] { --fixture-input-background: rgb(20, 30, 40); --bgColor-default: rgb(10, 20, 30); --fgColor-default: rgb(220, 230, 240); --fgColor-accent: rgb(90, 170, 230); --color-prettylights-syntax-markup-heading: rgb(180, 160, 240); --color-prettylights-syntax-markup-bold: rgb(240, 210, 160); --selection-bgColor: rgb(50, 80, 150); }';
    document.head.append(style);
  });
  const measure = async () => await page.evaluate(() => {
    const n = document.querySelector('#fixture-comment'), i = document.querySelector('.overtype-input');
    const p = document.querySelector('.overtype-preview'), c = document.querySelector('.overtype-container');
    const w = document.querySelector('.overtype-wrapper'), shell = document.querySelector('.gh-ot-shell');
    const style = el => { const s = getComputedStyle(el); return {
      fontFamily: s.fontFamily, fontSize: s.fontSize, lineHeight: s.lineHeight, color: s.color,
      background: s.backgroundColor, caret: s.caretColor, padding: s.padding
    }; };
    const color = (token, property = 'color') => {
      const probe = document.createElement('span');
      probe.style.fontSize = 'var(--text-body-size-small)';
      probe.style.setProperty(property, 'var(' + token + ')');
      shell.append(probe);
      try { return getComputedStyle(probe).getPropertyValue(property); }
      finally { probe.remove(); }
    };
    return {
      native: style(n), input: style(i), preview: style(p), shell: style(shell),
      nativeOpacity: getComputedStyle(n).opacity,
      nativeBackgroundImage: getComputedStyle(n).backgroundImage,
      transparentLayers: [shell, shell.querySelector('.gh-ot-host'), c, w, i, p]
        .every(el => getComputedStyle(el).backgroundColor === 'rgba(0, 0, 0, 0)' && getComputedStyle(el).backgroundImage === 'none'),
      heading: style(p.querySelector('h2')).color, bold: style(p.querySelector('strong')).color,
      italic: style(p.querySelector('em')).color, deleted: style(p.querySelector('del')).color,
      quote: style(p.querySelector('.blockquote')).color, link: style(p.querySelector('a')).color,
      codeBackground: style(p.querySelector('code')).background,
      selection: getComputedStyle(i, '::selection').backgroundColor,
      expected: {
        foreground: color('--fgColor-default'), background: color('--fixture-input-background', 'background-color'),
        fontFamily: color('--fontStack-monospace', 'font-family'),
        fontSize: color('--text-body-size-small', 'font-size'), lineHeight: color('--text-body-lineHeight-medium', 'line-height'),
        heading: color('--fgColor-default'), bold: color('--fgColor-default'),
        italic: color('--fgColor-default'), deleted: color('--fgColor-default'),
        quote: color('--fgColor-muted'), link: color('--fgColor-link'),
        codeBackground: color('--bgColor-neutral-muted', 'background-color'), selection: color('--selection-bgColor', 'background-color')
      },
      references: { foreground: c.style.getPropertyValue('--text'), background: c.style.getPropertyValue('--bg-primary'),
        fontFamily: w.style.getPropertyValue('--instance-font-family'),
        fontSize: w.style.getPropertyValue('--instance-font-size'), lineHeight: w.style.getPropertyValue('--instance-line-height'),
        padding: i.style.getPropertyValue('padding') },
      sameInstance: w._instance === window.__themeTestInstance,
      sameValue: n.value === i.value,
      theme: c.dataset.theme
    };
  });
  const validate = async name => {
    const s = await measure();
    check(s.input.fontSize === s.expected.fontSize && s.preview.fontSize === s.expected.fontSize, name + ': size follows GitHub small text token');
    check(s.input.fontFamily === s.expected.fontFamily && s.preview.fontFamily === s.expected.fontFamily,
      name + ': both layers use GitHub monospace token');
    check(s.input.lineHeight === s.expected.lineHeight && s.preview.lineHeight === s.expected.lineHeight, name + ': line heights match the shared tokens');
    check(s.preview.color === s.expected.foreground && s.input.caret === s.expected.foreground,
      name + ': text/caret resolve GitHub tokens');
    check(s.transparentLayers && s.nativeOpacity === '1' && s.native.background === s.expected.background,
      name + ': original input background remains painted, with no overlay background', s);
    check(['heading', 'bold', 'italic', 'deleted', 'quote', 'link', 'codeBackground', 'selection'].every(k => s[k] === s.expected[k]),
      name + ': Markdown and selection use GitHub palette', s);
    check(s.sameInstance && s.sameValue && s.theme === 'github', name + ': no reinitialization or content change');
    return s;
  };
  try {
    await page.evaluate(() => document.documentElement.setAttribute('data-color-mode', 'light'));
    const light = await validate('light');
    check(parseFloat(light.input.fontSize) < parseFloat(light.native.fontSize), 'small text is smaller than the previous body-medium size');
    await page.evaluate(() => document.documentElement.setAttribute('data-color-mode', 'dark'));
    const dark = await validate('dark');
    check(light.preview.color !== dark.preview.color && light.native.background !== dark.native.background,
      'theme switching changes rendered foreground/background without reapplying');
    await page.evaluate(() => {
      const s = document.documentElement.style;
      s.setProperty('--text-body-size-small', '18px');
      s.setProperty('--text-body-lineHeight-medium', '1.75');
      s.setProperty('--fontStack-system', 'Georgia, serif');
      s.setProperty('--fontStack-monospace', '"Courier New", monospace');
      s.setProperty('--base-size-8', '10px');
      s.setProperty('--fgColor-default', 'rgb(140, 180, 220)');
      s.setProperty('--color-prettylights-syntax-markup-heading', 'rgb(120, 170, 210)');
      document.querySelector('#fixture-comment').style.backgroundImage = 'linear-gradient(to right, red, blue)';
    });
    const custom = await validate('custom tokens');
    check(custom.input.fontSize === '18px' && custom.input.lineHeight === '31.5px' && custom.input.padding === '10px',
      'live size, line-height and spacing customization applies to both layers');
    check(custom.nativeBackgroundImage.includes('linear-gradient'), 'native background images are preserved under transparent layers');
    check(custom.references.foreground === 'var(--fgColor-default)' && custom.references.background === 'transparent' &&
      custom.references.fontFamily === 'var(--fontStack-monospace)' &&
      custom.references.fontSize === 'var(--text-body-size-small)' && custom.references.lineHeight === 'var(--text-body-lineHeight-medium)' &&
      custom.references.padding === 'var(--base-size-8)', 'stored styles retain variable references, not computed snapshots');
    return { passed: checks.length, checks, typography: { input: custom.input, native: custom.native } };
  } finally {
    await page.evaluate(() => delete window.__themeTestInstance);
  }
}
