async (page) => {
  const url = new URL(page.url());
  const fixture = url.href === 'about:blank' && await page.title() === 'OverType isolated fixture';
  if (!fixture && !(url.protocol === 'https:' && ['github.com', 'gist.github.com'].includes(url.hostname))) {
    throw new Error('Diagnostics only support GitHub/Gist or the isolated fixture');
  }
  return await page.evaluate(() => {
    window.__ghOtDiagnostics?.stop();
    const start = performance.now();
    const events = [];
    const methods = {};
    const restorers = [];
    const delays = [];
    const mutations = { insideEditor: 0, outsideEditor: 0 };
    const longTasks = [];
    let running = true;
    let frame;
    let lastFrame;
    let timeout;
    const identify = el => el?.matches?.('.overtype-input') ? 'overtype' :
      el?.matches?.('[data-gh-ot-enhanced]') ? 'native-hidden-or-visible' :
      el?.getAttribute?.('role') || el?.tagName || 'none';
    const state = (target = document.activeElement) => {
      const shell = target?.closest?.('.gh-ot-shell') || document.querySelector('.gh-ot-shell');
      const n = shell?.parentElement.querySelector('[data-gh-ot-enhanced]');
      const i = shell?.querySelector('.overtype-input');
      return {
        mode: shell?.dataset.mode,
        editorIndex: [...document.querySelectorAll('.gh-ot-shell')].indexOf(shell),
        smartLists: shell?.querySelector('.overtype-wrapper')?._instance?.options.smartLists,
        active: identify(document.activeElement),
        nativeHidden: n?.getAttribute('aria-hidden'),
        sameValue: n?.value === i?.value,
        nativeLength: n?.value.length,
        overtypeLength: i?.value.length,
        nativeSelection: n && [n.selectionStart, n.selectionEnd],
        overtypeSelection: i && [i.selectionStart, i.selectionEnd]
      };
    };
    const record = event => {
      if (events.length >= 300) return;
      const key = event.type === 'keydown' ?
        (['#', '@', 'Escape', 'ArrowUp', 'ArrowDown', 'Enter', 'Tab'].includes(event.key) ? event.key : '[other]') : undefined;
      const item = { ms: +(performance.now() - start).toFixed(2), type: event.type,
        target: identify(event.target), key, inputType: event.inputType,
        shift: event.shiftKey, ctrl: event.ctrlKey, meta: event.metaKey, alt: event.altKey,
        composing: event.isComposing, keyCode: event.keyCode, ...state(event.target) };
      events.push(item);
      // Capture any focus or value change caused later in this same event dispatch.
      if (event.type === 'input' || event.type === 'keydown') queueMicrotask(() => {
        item.defaultPrevented = event.defaultPrevented;
        item.after = state(event.target);
      });
    };
    for (const type of ['keydown', 'input', 'change', 'focusin', 'focusout', 'compositionstart', 'compositionend']) {
      document.addEventListener(type, record, true);
      restorers.push(() => document.removeEventListener(type, record, true));
    }
    const proto = (window.OverType?.default || window.OverType)?.prototype;
    if (proto) for (const name of ['handleKeydown', 'handleSmartListContinuation', 'handleInput', 'updatePreview', 'setValue', '_notifyChange']) {
      const original = proto[name];
      if (typeof original !== 'function') continue;
      const metric = methods[name] = { count: 0, totalMs: 0, maxMs: 0 };
      const wrapped = function (...args) {
        const begin = performance.now();
        try {
          const result = original.apply(this, args);
          if (name === 'handleSmartListContinuation' && events.length < 300) {
            events.push({ ms: +(performance.now() - start).toFixed(2), type: 'smartListResult',
              handled: result, ...state(this.textarea) });
          }
          return result;
        }
        finally {
          const duration = performance.now() - begin;
          metric.count++;
          metric.totalMs += duration;
          metric.maxMs = Math.max(metric.maxMs, duration);
        }
      };
      proto[name] = wrapped;
      restorers.push(() => { if (proto[name] === wrapped) proto[name] = original; });
    }
    const observer = new MutationObserver(records => {
      for (const r of records) {
        const el = r.target.nodeType === Node.ELEMENT_NODE ? r.target : r.target.parentElement;
        mutations[el?.closest?.('.gh-ot-shell') ? 'insideEditor' : 'outsideEditor']++;
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    restorers.push(() => observer.disconnect());
    try {
      const perf = new PerformanceObserver(list => {
        for (const item of list.getEntries()) {
          if (longTasks.length < 100) longTasks.push({ ms: item.startTime - start, duration: item.duration });
        }
      });
      perf.observe({ type: 'longtask', buffered: false });
      restorers.push(() => perf.disconnect());
    } catch (_) {}
    const tick = now => {
      if (!running) return;
      if (lastFrame !== undefined && now - lastFrame > 40 && delays.length < 100) {
        delays.push({ ms: now - start, duration: now - lastFrame, documentHidden: document.hidden });
      }
      lastFrame = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const api = {
      snapshot() {
        return { running, elapsedMs: performance.now() - start, state: state(), methods,
          mutations, frameDelays: delays, longTasks, events };
      },
      stop() {
        if (!running) return;
        running = false;
        clearTimeout(timeout);
        cancelAnimationFrame(frame);
        restorers.reverse().forEach(restore => restore());
      }
    };
    window.__ghOtDiagnostics = api;
    timeout = setTimeout(() => api.stop(), 600000);
    return { recording: true, automaticStopSeconds: 600, state: state() };
  });
}
