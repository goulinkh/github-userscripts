import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
const source = await readFile('userscripts/github-sticky-pr.user.js', 'utf8');
const browser = await chromium.launch({headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined});
const page = await browser.newPage({viewport: {width: 1000, height: 700}});
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));
const html = `<!doctype html><style>
body{margin:0} .site{height:100px} main{padding:0 20px} .mini{position:sticky;top:0;height:48px;background:white;z-index:12} .title{height:150px}
.page-header{margin-inline:40px;display:grid;grid-template-columns:1fr auto;grid-template-areas:'title title' 'navigation navigation'} .title{grid-area:title} [data-component=PH_Navigation]{grid-area:navigation;padding-top:16px} @layer host{nav{padding-top:8px!important}nav ul,nav li{height:40px!important}} nav{overflow:hidden;height:48px;display:flex;align-items:stretch;box-sizing:border-box} nav ul{display:flex;padding:0;margin:0;list-style:none} nav li{display:flex;align-items:center}  nav a{position:relative;display:flex;align-items:center;padding:8px} nav a::after{content:'';position:absolute;top:38px;bottom:0;margin-bottom:-8px;height:2px;left:0;right:0} nav a[aria-current=page]::after{background:rgb(236,119,92)}
section{position:sticky;top:48px;height:60px;background:white;z-index:10} .layout{display:flex;gap:20px} aside{width:160px;flex-shrink:0} #pr-file-tree{position:sticky;top:108px;max-height:500px;overflow:auto} article{flex:1} [data-diff-header-wrapper]{position:sticky;top:108px;height:42px;background:white} .diff{height:1500px}
</style><div class=site></div><main><div class=mini data-testid=diff-comparison-viewer-sticky-header-slot>PR</div><div class=page-header><div class=title></div><div data-component=PH_Navigation><nav aria-label="Pull request"><ul><li><a href="#">Conversation</a></li><li><a href="#" aria-current="page">Changes</a></li></ul></nav></div></div><section><button id=changes-selector-button>Changes</button></section><div class=layout><aside><div id=pr-file-tree>${'<div>file</div>'.repeat(80)}</div></aside><article><div class=diff><div data-diff-header-wrapper>File one</div></div><div class=diff><div data-diff-header-wrapper>File two</div></div></article></div></main>`;
await page.route('https://github.com/**', route => route.fulfill({contentType:'text/html',body:html}));
let checks = 0;
function check(ok, name, detail) { if (!ok) throw Error(name + ': ' + JSON.stringify(detail)); checks++; }
async function settle() { await page.waitForTimeout(100); }
async function geometry() {
  return page.evaluate(()=>{
    const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height,left:r.left,width:r.width};};
    return {state:window.__githubStickyPR.status(),mini:rect('.mini'),tabs:rect('[data-component=PH_Navigation]'),toolbar:rect('section'),file:rect('[data-diff-header-wrapper]'),tree:rect('#pr-file-tree'),height:document.documentElement.scrollHeight,spacers:document.querySelectorAll('.gh-sticky-pr-spacer').length};
  });
}
try {
  await page.goto('https://github.com/example/repo/pull/1/changes');
  await page.evaluate(source);await settle();
  const initial=await geometry();
  check(!initial.state.pinned,'top is not pinned',initial);
  await page.evaluate(()=>scrollTo(0,500));await settle();
  await page.waitForFunction(() => window.__githubStickyPR.status().pinned);
  let g=await geometry();
  check(g.state.pinned && g.spacers===1,'tabs pin with one spacer',g);
  check(g.height===initial.height,'pinning preserves document geometry',g);
  check(g.tabs.width===1000 && g.tabs.left===0,'pinned row spans the viewport, not the title grid',g);
  check(await page.locator('nav a').first().evaluate(e=>e.getBoundingClientRect().left===20),'tabs align with page content rather than the inset title');
  check(await page.locator('nav a[aria-current=page]').evaluate(e=>{
    const r=e.getBoundingClientRect(), n=e.closest('nav').getBoundingClientRect(), s=getComputedStyle(e,'::after');
    const bottom=r.top+parseFloat(s.top)+parseFloat(s.height);
    return s.backgroundColor==='rgb(236, 119, 92)' && bottom<=n.bottom && bottom-parseFloat(s.height)>=n.top;
  }),'selected tab underline remains inside the compact row');
  check(g.tabs.height===36,'pinned tabs compact to 36px',g);
  check(await page.locator('nav').evaluate(e=>{const r=e.getBoundingClientRect();return [...e.querySelectorAll('a')].every(a=>{const b=a.getBoundingClientRect();return b.top>=r.top && b.bottom<=r.bottom;});}),'compact links fit despite layered host padding');
  check(Math.abs(g.tabs.top-g.mini.bottom)<1,'tabs sit below native mini header',g);
  check(Math.abs(g.toolbar.top-g.tabs.bottom)<1,'toolbar sits below tabs',g);
  check(Math.abs(g.file.top-g.toolbar.bottom)<1,'diff header sits below toolbar',g);
  check(Math.abs(g.tree.top-g.tabs.bottom)<1,'sidebar sits below tabs',g);
  await page.setViewportSize({width:700,height:600});await settle();g=await geometry();
  check(g.tabs.width===700 && g.tabs.left===0,'pinned width follows responsive layout',g);
  await page.evaluate(source);await settle();g=await geometry();
  check(g.spacers===1 && g.state.pinned,'reapplication has one pinned row',g);
  await page.evaluate(()=>scrollTo(0,0));await settle();g=await geometry();
  check(!g.state.pinned && g.spacers===0 && g.tabs.height===64,'scrolling to top restores navigation',g);
  check(await page.locator('section').evaluate(e=>e.style.top)==='','unpin restores host toolbar styles');
  check(await page.locator('nav').evaluate(e=>e.style.paddingTop==='' && getComputedStyle(e).paddingTop==='8px'),'unpin restores native navigation spacing');
  await page.evaluate(()=>scrollTo(0,500));await settle();
  await page.evaluate(()=>{history.pushState({},'', '/example/repo/issues');dispatchEvent(new PopStateEvent('popstate'));});await settle();g=await geometry();
  check(!g.state.pinned && g.spacers===0,'SPA route exit cleans offsets',g);
  await page.evaluate(()=>{history.pushState({},'', '/example/repo/pull/1/changes');dispatchEvent(new PopStateEvent('popstate'));});await settle();
  await page.evaluate(()=>{
    history.pushState({},'', '/example/repo/pull/1');
    document.querySelector('.mini').remove();
    dispatchEvent(new PopStateEvent('popstate'));
  });await settle();
  check(await page.locator('[data-component=PH_Navigation]').evaluate(e=>e.getBoundingClientRect().top===0),'conversation tabs pin without a compact header');
  check(await page.locator('section').evaluate(e=>e.style.top===''),'conversation route does not adjust Changes toolbar');
  check(await page.locator('nav a').first().evaluate(e=>Math.abs(e.getBoundingClientRect().left-document.querySelector('.gh-sticky-pr-spacer').getBoundingClientRect().left)<1),'overview tabs keep their original centered content alignment');
  check(await page.locator('nav').evaluate(e=>Math.abs(e.getBoundingClientRect().right-document.querySelector('.gh-sticky-pr-spacer').getBoundingClientRect().right)<1),'overview tabs retain the original right gutter');
  check(await page.locator('[data-component=PH_Navigation]').evaluate(e=>e.getBoundingClientRect().left===0 && e.getBoundingClientRect().width===700),'overview background remains full width');
  await page.evaluate(()=>window.__githubStickyPR.destroy());
  check(await page.locator('.gh-sticky-pr-spacer,.gh-sticky-pr-pinned').count()===0,'destroy removes integration DOM');
  check(await page.locator('#pr-file-tree').evaluate(e=>e.style.maxHeight)==='','destroy restores sidebar styles');
  check(pageErrors.length === 0, 'no uncaught browser errors', pageErrors);
  console.log('Sticky PR:', checks, 'checks passed');
} finally {await browser.close();}
