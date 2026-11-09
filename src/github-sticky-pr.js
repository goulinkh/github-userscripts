(() => {
  'use strict';
  const VERSION = '0.1.1';
  const KEY = '__githubStickyPR';
  window[KEY]?.destroy();
  const prefix = 'gh-sticky-pr';
  const navSelector = 'nav[aria-label="Pull request"],nav[aria-label="Pull request navigation"],nav[aria-label="Pull request navigation tabs"],.tabnav > nav.tabnav-tabs';
  const toolbarSelector = 'section:has(#changes-selector-button),.pr-toolbar';
  const headerSelector = '[data-diff-header-wrapper],.js-file .file-header,[data-testid="diff-file-header"],[data-testid="file-diff-header"]';
  const treeSelector = '#pr-file-tree,.js-diff-file-tree,[data-testid="file-tree"]';
  const miniSelector = '[data-testid="diff-comparison-viewer-sticky-header-slot"]';
  const style = document.createElement('style');
  style.textContent = `
    .${prefix}-pinned {
      position: fixed !important;
      top: var(--gh-sticky-pr-top) !important;
      left: var(--gh-sticky-pr-left) !important;
      width: var(--gh-sticky-pr-width) !important;
      height: auto !important;
      min-height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
      background: var(--bgColor-default, var(--color-canvas-default, white)) !important;
      box-shadow: 0 1px 0 var(--borderColor-default, #d1d9e0);
      z-index: 11 !important;
    }
    .${prefix}-pinned a, .${prefix}-pinned button {
      height: 36px !important;
      box-sizing: border-box !important;
      min-height: 0 !important;
      padding-top: 0 !important;
      padding-bottom: 0 !important;
    }
    .${prefix}-pinned a::after, .${prefix}-pinned button::after {
      top: auto !important;
      bottom: 0 !important;
      margin-bottom: 0 !important;
    }
  `;
  document.head.append(style);
  let stopped = false, frame = 0, tabs = null, spacer = null, pinned = false, path = '', observer;
  const saved = new Map();
  const visible = el => el?.isConnected && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
  const first = selector => [...document.querySelectorAll(selector)].find(visible);
  function set(el, property, value) {
    let props = saved.get(el);
    if (!props) saved.set(el, props = new Map());
    if (!props.has(property)) props.set(property, [el.style.getPropertyValue(property), el.style.getPropertyPriority(property)]);
    if (el.style.getPropertyValue(property) !== value || el.style.getPropertyPriority(property) !== 'important') el.style.setProperty(property, value, 'important');
  }
  function restore(el) {
    const props = saved.get(el);
    if (!props) return;
    for (const [property, [value, priority]] of props) {
      if (value) el.style.setProperty(property, value, priority);
      else el.style.removeProperty(property);
    }
    saved.delete(el);
  }
  function unpin() {
    tabs?.classList.remove(`${prefix}-pinned`);
    for (const el of [...saved.keys()]) restore(el);
    if (spacer) observer.unobserve(spacer);
    spacer?.remove();
    spacer = null;
    pinned = false;
  }
  function schedule() {
    if (!stopped && !frame) frame = requestAnimationFrame(update);
  }
  function stickyBottom(el, top) {
    if (!visible(el)) return top;
    const css = getComputedStyle(el), r = el.getBoundingClientRect();
    if (Number(css.opacity) === 0 || !['sticky', 'fixed'].includes(css.position)) return top;
    return r.top <= top + 1 && r.bottom > top ? r.bottom : top;
  }
  function update() {
    frame = 0;
    const pr = /^\/[^/]+\/[^/]+\/pull\/\d+(?:\/|$)/.test(location.pathname);
    const nextNav = pr ? first(navSelector) : null;
    const next = nextNav?.closest('[data-component="PH_Navigation"]') || nextNav;
    if (path !== location.pathname || next !== tabs) {
      unpin();
      observer.disconnect();
      path = location.pathname;
      tabs = next;
      if (tabs) observer.observe(tabs);
      const mini = first(miniSelector);
      if (mini) observer.observe(mini);
    }
    if (!visible(tabs)) { unpin(); return; }
    let top = stickyBottom(first('header.AppHeader,header.GlobalNav,.AppHeader'), 0);
    top = stickyBottom(first(miniSelector), top);
    const origin = (spacer || tabs).getBoundingClientRect();
    if (origin.top >= top - 0.5) { if (pinned) unpin(); return; }
    if (!pinned) {
      const css = getComputedStyle(tabs);
      spacer = document.createElement('div');
      spacer.className = `${prefix}-spacer`;
      spacer.setAttribute('aria-hidden', 'true');
      Object.assign(spacer.style, {height: `${origin.height}px`, marginTop: css.marginTop, marginBottom: css.marginBottom, gridArea: css.gridArea, order: css.order, alignSelf: css.alignSelf, justifySelf: css.justifySelf, flex: css.flex, flexShrink: '0', pointerEvents: 'none'});
      tabs.before(spacer);
      observer.observe(spacer);
      pinned = true;
      tabs.classList.add(`${prefix}-pinned`);
    }
    const files = /\/pull\/\d+\/(?:files|changes)(?:\/|$)/.test(location.pathname);
    const layout = files ? tabs.closest('#diff-comparison-viewer-container') || tabs.closest('main') : null;
    const layoutRect = (layout || spacer).getBoundingClientRect();
    const layoutCSS = layout && getComputedStyle(layout);
    const left = Math.max(0, layoutRect.left + (parseFloat(layoutCSS?.paddingLeft) || 0));
    const viewportWidth = files ? innerWidth : document.documentElement.getBoundingClientRect().width;
    const right = Math.max(0, viewportWidth - layoutRect.right + (parseFloat(layoutCSS?.paddingRight) || 0));
    set(tabs, '--gh-sticky-pr-top', `${top}px`);
    set(tabs, '--gh-sticky-pr-left', '0px');
    set(tabs, '--gh-sticky-pr-width', '100%');
    set(tabs, 'padding-left', `${left}px`);
    set(tabs, 'padding-right', `${right}px`);
    const active = new Set([tabs]);
    const nav = tabs.matches('nav') ? tabs : tabs.querySelector('nav');
    if (nav) {
      for (const el of [nav, ...nav.querySelectorAll(':scope > ul, :scope > ul > li')]) {
        active.add(el);
        set(el, 'height', '36px');
        set(el, 'min-height', '0px');
        set(el, 'padding-top', '0px');
        set(el, 'padding-bottom', '0px');
        set(el, 'margin-top', '0px');
        set(el, 'margin-bottom', '0px');
        set(el, 'align-items', 'center');
      }
    }
    const tabsBottom = top + tabs.getBoundingClientRect().height;
    const shift = (el, y) => {
      if (!visible(el) || !['sticky', 'fixed'].includes(getComputedStyle(el).position)) return false;
      set(el, 'top', `${y}px`);
      active.add(el);
      return true;
    };
    let bottom = tabsBottom;
    if (files) {
      const toolbar = first(toolbarSelector);
      if (shift(toolbar, tabsBottom)) {
        observer.observe(toolbar);
        const r = toolbar.getBoundingClientRect();
        if (r.top <= tabsBottom + 1) bottom = r.bottom;
      }
      for (const header of document.querySelectorAll(headerSelector)) shift(header, bottom);
      const tree = first(treeSelector);
      for (let el = tree, depth = 0; el && depth < 8; el = el.parentElement, depth++) {
        if (el.contains(tabs) || (toolbar && el.contains(toolbar))) break;
        if (shift(el, tabsBottom)) {
          set(el, 'max-height', `calc(100dvh - ${tabsBottom}px)`);
          for (const scrollport of [tree, ...tree.querySelectorAll('*')]) {
            if (!/(auto|scroll)/.test(getComputedStyle(scrollport).overflowY)) continue;
            const r = scrollport.getBoundingClientRect();
            if (!r.height) continue;
            active.add(scrollport);
            set(scrollport, 'max-height', `calc(100dvh - ${Math.max(tabsBottom, r.top)}px)`);
            set(scrollport, 'min-height', '0px');
          }
          break;
        }
      }
    }
    set(document.documentElement, 'scroll-padding-top', `${bottom + 48}px`);
    active.add(document.documentElement);
    for (const el of [...saved.keys()]) if (!active.has(el)) restore(el);
  }
  observer = new ResizeObserver(schedule);
  const mutations = new MutationObserver(schedule);
  mutations.observe(document.documentElement, {subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'hidden', 'aria-expanded']});
  const events = [[window, 'scroll'], [window, 'resize'], [window, 'popstate'], [document, 'turbo:load'], [document, 'turbo:render']];
  for (const [target, name] of events) target.addEventListener(name, schedule, {passive: true, capture: true});
  window[KEY] = {
    version: VERSION,
    status: () => ({version: VERSION, pinned, stopped, adjusted: saved.size}),
    destroy() {
      stopped = true;
      cancelAnimationFrame(frame);
      mutations.disconnect();
      observer.disconnect();
      for (const [target, name] of events) target.removeEventListener(name, schedule, true);
      unpin();
      style.remove();
      if (window[KEY] === this) delete window[KEY];
    }
  };
  schedule();
})();
