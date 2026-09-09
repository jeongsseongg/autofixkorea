export function suggestions(id, values, catalog) {
 const makers = catalog?.manufacturers ?? [];
 const maker = makers.find(m => m.name === values.manufacturer?.trim());
 const group = maker?.groups.find(g => g.name === values.group?.trim());
 const fixed = {
  manufacturer:makers.map(m=>m.name), group:(maker?.groups??[]).map(g=>g.name), model:(group?.models??[]).map(m=>m.name),
  year:Array.from({length:80},(_,i)=>String(new Date().getFullYear()+1-i)),
  region:['서울특별시','경기도','인천광역시','부산광역시','대구광역시','광주광역시','대전광역시','울산광역시','세종특별자치시','강원특별자치도','충청북도','충청남도','전북특별자치도','전라남도','경상북도','경상남도','제주특별자치도'],
  fuel:['가솔린','디젤','LPG','가솔린+전기','디젤+전기','LPG+전기','전기','수소','확인 필요'],
  owner:['개인','법인','리스','렌트'],finance:['없음','할부','저당','압류','할부·저당','확인 필요'],priorHistory:['무사고','사고 이력 있음','확인 필요'],
  ignition:['가능','불가','확인 필요'],driving:['가능','불가','확인 필요'],airbag:['전개','미전개','확인 필요'],
 };
 return fixed[id] ?? [];
}
export function mountCombo(root, options) {
 const input=root.querySelector('input');
 const toggle=root.querySelector('[data-toggle]');
 const panel=root.querySelector('[data-menu]');
 const list=root.querySelector('[role="listbox"]');
 const status=root.querySelector('[data-empty]');
 let filtered=[], active=-1;
 function close() { panel.hidden=true; input.setAttribute('aria-expanded','false'); toggle.setAttribute('aria-expanded','false'); input.removeAttribute('aria-activedescendant'); }
 function select(value) { input.value=value; input.dispatchEvent(new Event('input',{bubbles:true})); close(); input.focus(); }
 function paint(filter=true) {
  filtered=options.filter(v=>!filter || v.toLocaleLowerCase().includes(input.value.trim().toLocaleLowerCase()));
  active=-1; input.removeAttribute('aria-activedescendant');
  list.replaceChildren(...filtered.map((value,i)=>{
   const row=document.createElement('button'); row.type='button'; row.role='option'; row.id=input.id+'-option-'+i;
   row.tabIndex=-1; row.textContent=value; row.setAttribute('aria-selected','false');
   row.addEventListener('click',()=>select(value)); return row;
  }));
  status.hidden=filtered.length>0; list.scrollTop=0;
 }
 function open(filter=true) { paint(filter); panel.hidden=false; input.setAttribute('aria-expanded','true'); toggle.setAttribute('aria-expanded','true'); }
 toggle.addEventListener('click',()=>{if(panel.hidden)open(false);else close();input.focus();});
 input.addEventListener('input',()=>open());
 input.addEventListener('keydown',e=>{
  if(e.isComposing)return;
  if(e.key==='Escape'){close();e.stopPropagation();return;}
  if(e.key==='Tab'){close();return;}
  if(['ArrowDown','ArrowUp'].includes(e.key)){
   e.preventDefault();if(panel.hidden)open(false);
   active=Math.max(0,Math.min(filtered.length-1,active+(e.key==='ArrowDown'?1:-1)));
   [...list.children].forEach((row,i)=>row.setAttribute('aria-selected',String(i===active)));
   const row=list.children[active];if(row){input.setAttribute('aria-activedescendant',row.id);row.scrollIntoView({block:'nearest'});}return;
  }
  if(e.key==='Enter'&&!panel.hidden&&active>=0){e.preventDefault();e.stopPropagation();select(filtered[active]);}
 });
 root.querySelectorAll('[data-scroll]').forEach(button=>button.addEventListener('click',()=>list.scrollBy({top:Number(button.dataset.scroll)*144,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})));

 return {close};
}
