async page => {
  if(page.url() !== 'about:blank' || await page.title() !== 'OverType isolated fixture') throw Error('Fixture only');
  const checks=[];
  const check=(ok,name,detail)=>{if(!ok)throw Error(name+': '+JSON.stringify(detail));checks.push(name);};
  await page.evaluate(()=>{
    const n=document.querySelector('#fixture-comment');
    Object.assign(n.style,{fieldSizing:'content',boxSizing:'content-box',minHeight:'5lh',maxHeight:'35lh',height:'auto',resize:'vertical'});
  });
  const input=page.locator('.overtype-input');
  await input.fill(Array.from({length:14},(_,i)=>'line '+i).join('\n'));
  const measure=()=>page.evaluate(()=>{
    const n=document.querySelector('#fixture-comment'),i=document.querySelector('.overtype-input'),p=document.querySelector('.overtype-preview');
    return {native:n.getBoundingClientRect().height,editor:i.getBoundingClientRect().height,
      gap:p.getBoundingClientRect().bottom-p.lastElementChild.getBoundingClientRect().bottom,
      padding:parseFloat(getComputedStyle(p).paddingBottom),resize:getComputedStyle(i).resize,
      same:n.value===i.value,min:parseFloat(getComputedStyle(n).minHeight),boxSizing:getComputedStyle(n).boxSizing};
  });
  let s=await measure();
  check(Math.abs(s.gap-s.padding)<=2.1,'auto-sized editor has no extra trailing blank area',s);
  const large=s.native;
  await input.fill('one line');s=await measure();
  check(s.native<large-50 && s.native<160,'deleting content shrinks to GitHub minimum, not a locked 160px floor',s);
  check(s.resize==='vertical','visible editor has a vertical resize grip',s);
  const drag=async dy=>{
    const b=await input.boundingBox();
    await page.mouse.move(b.x+b.width-4,b.y+b.height-4);
    await page.mouse.down();await page.mouse.move(b.x+b.width-4,b.y+b.height-4+dy,{steps:10});await page.mouse.up();
    await page.waitForTimeout(100);
  };
  const before=s.native;
  await drag(80);s=await measure();
  check(s.native>before+40,'dragging grip grows the real field and its overlay',s);
  check(Math.abs(s.native-s.editor)<2,'resized overlay follows field height',s);
  const grown=s.native;
  await drag(-40);s=await measure();
  check(s.native<grown-15,'dragging grip can shrink the field again',s);
  check(s.same,'resizing preserves text and bridge synchronization',s);
  return {passed:checks.length,checks};
}
