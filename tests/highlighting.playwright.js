async page => {
  if(page.url() !== 'about:blank' || await page.title() !== 'OverType isolated fixture') throw Error('Fixture only');
  const result = await page.evaluate(() => {
    const {highlight} = window.__githubOverTypeHighlighter;
    const w=document.querySelector('.overtype-wrapper'), editor=w._instance;
    const style=document.createElement('style');
    style.textContent=':root{--codeMirror-syntax-fgColor-keyword:red;--codeMirror-syntax-fgColor-string:green;--codeMirror-syntax-fgColor-constant:blue;--codeMirror-syntax-fgColor-entity:purple;}';
    document.head.append(style);
    const checks=[];
    const check=(ok,name)=>{if(!ok)throw Error(name);checks.push(name);};
    const samples=['const x: number = 42;\nconsole.log("hello");','const emoji = "😀"; // α','  const x = "<img src=x onerror=alert(1)>";\n\n\t// end\n','/* unclosed','const x = `template ${value}`;'];
    for(const code of samples){
      const el=document.createElement('code');el.innerHTML=highlight(code,'ts');
      check(el.textContent===code,'exact source preservation: '+checks.length);
      check(!el.querySelector('img,script'),'HTML escaped: '+checks.length);
    }
    check(highlight('<x>','unknown')==='&lt;x&gt;','unknown language stays plain');
    editor.setCodeHighlighter(highlight);
    editor.setValue('```js\nconst answer = 42;\nconsole.log("hello");\n```');
    const first=w.querySelector('pre.code-block code span');
    check(!!first,'OverType renders highlighted spans');
    const before=getComputedStyle(first).color;
    document.documentElement.style.setProperty('--codeMirror-syntax-fgColor-keyword','orange');
    check(getComputedStyle(first).color!==before,'colors follow live GitHub tokens');
    const timings=[];
    for(let n=0;n<100;n++){
      const start=performance.now();editor.setValue('```js\nconst answer = '+n+';\nconsole.log(answer);\n```');timings.push(performance.now()-start);
    }
    timings.sort((a,b)=>a-b);
    return {checks,renderMs:{median:timings[50],p95:timings[95],max:timings[99]}};
  });
  const i=page.locator('.overtype-input');
  await i.fill('```js\nconst x = 1;\n```');
  await i.evaluate(e=>e.setSelectionRange(18,18));
  await i.pressSequentially('2');
  const same=await page.evaluate(()=>document.querySelector('#fixture-comment').value===document.querySelector('.overtype-input').value);
  if(!same)throw Error('Bridge lost synchronization');
  return {...result,realTypingSynchronized:same};
}
