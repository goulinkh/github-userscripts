async page => {
  if(page.url() !== 'about:blank' || await page.title() !== 'OverType isolated fixture') throw Error('Fixture only');
  const input=page.locator('.overtype-input'), checks=[];
  const check=(ok,name)=>{if(!ok)throw Error(name);checks.push(name);};
  await page.evaluate(()=>{
    const n=document.querySelector('#fixture-comment');
    const list=document.createElement('ul');list.id='fixture-suggestions';list.setAttribute('role','listbox');
    list.innerHTML='<li id="fixture-option" role="option">fixture-user</li>';
    document.body.append(list);
    Object.entries({role:'combobox','aria-expanded':'true','aria-controls':list.id,'aria-activedescendant':'fixture-option','aria-autocomplete':'list'}).forEach(([k,v])=>n.setAttribute(k,v));
    window.__autocompleteKeys=[];
    window.__autocompleteHandler=e=>{
      if(n.getAttribute('aria-expanded')!=='true')return;
      window.__autocompleteKeys.push(e.key);
      if(['Enter','Tab'].includes(e.key)){
        e.preventDefault();
        n.setRangeText('fixture-user ',n.selectionStart,n.selectionEnd,'end');
        n.dispatchEvent(new InputEvent('input',{bubbles:true}));
        n.setAttribute('aria-expanded','false');n.focus();
      }else if(['ArrowDown','ArrowUp','Escape'].includes(e.key)){
        e.preventDefault();
        if(e.key==='Escape')n.setAttribute('aria-expanded','false');
      }
    };
    n.addEventListener('keydown',window.__autocompleteHandler);
  });
  try {
    await input.fill('@');await input.press('Enter');
    check(await input.inputValue()==='@fixture-user ','Enter accepts via native-target handler, without newline');
    check(await input.evaluate(e=>document.activeElement===e),'OverType retains focus');
    await page.evaluate(()=>document.querySelector('#fixture-comment').setAttribute('aria-expanded','true'));
    await input.fill('@');await input.press('ArrowDown');await input.press('ArrowUp');await input.press('Tab');
    check(await input.inputValue()==='@fixture-user ','Tab accepts and arrows reach popup');
    check(await page.evaluate(()=>['ArrowDown','ArrowUp','Tab'].every(k=>window.__autocompleteKeys.includes(k))),'navigation forwarded');
    await page.evaluate(()=>document.querySelector('#fixture-comment').setAttribute('aria-expanded','true'));
    await input.press('Escape');
    check(await page.locator('#fixture-comment').getAttribute('aria-expanded')==='false','Escape closes popup');
    await input.fill('- first');await input.press('Enter');
    check(await input.inputValue()==='- first\n- ','closed popup does not steal list Enter');
    await page.evaluate(()=>{
      document.querySelector('#fixture-comment').setAttribute('aria-expanded','true');
      document.querySelector('#fixture-suggestions').hidden=true;
    });
    await input.fill('- first');await input.press('Enter');
    check(await input.inputValue()==='- first\n- ','hidden popup is ignored');
    await page.evaluate(()=>{
      document.querySelector('#fixture-suggestions').hidden=false;
      document.querySelector('#fixture-comment').setAttribute('aria-controls','unrelated-popup');
    });
    await input.fill('- first');await input.press('Enter');
    check(await input.inputValue()==='- first\n- ','unassociated visible popup is ignored');
    await page.evaluate(()=>document.querySelector('#fixture-comment').setAttribute('aria-controls','fixture-suggestions'));
    await input.fill('- first');await input.press('Shift+Enter');
    check(await input.inputValue()==='- first\n','Shift+Enter remains a plain newline');
    check(await input.getAttribute('aria-controls')==='fixture-suggestions','visible editor mirrors combobox accessibility');
    return {passed:checks.length,checks};
  }finally{
    await page.evaluate(()=>{
      const n=document.querySelector('#fixture-comment');n.removeEventListener('keydown',window.__autocompleteHandler);
      for(const a of ['role','aria-expanded','aria-controls','aria-activedescendant','aria-autocomplete'])n.removeAttribute(a);
      document.querySelector('#fixture-suggestions').remove();delete window.__autocompleteHandler;delete window.__autocompleteKeys;
    });
  }
}
