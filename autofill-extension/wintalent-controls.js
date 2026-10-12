/* WinTalent mode400 DOM adapter. No Angular scopes, jQuery internals or APIs. */
(function () {
  'use strict';
  const trim=v=>String(v??'').replace(/\s+/g,' ').trim();
  function supports(entry) {
    const el=entry?.element;
    return !!el?.matches?.('input[choose-date].dayType,input[school-or-subject="1"]');
  }
  async function run(ctx,raw,h) {
    const el=ctx.el,doc=el.ownerDocument;
    if(el.disabled||el.getAttribute('prohibitEditDate')==='true'||el.closest('[data-prohibit-edit="true"]')) return {reason:'control_disabled'};
    ctx.observed={library:'wintalent',optionCount:0};
    const before=new Set(Array.from(doc.querySelectorAll('.datetimepicker,.modal')).filter(h.visible));
    if(el.hasAttribute('choose-date')){el.focus();return date(ctx,raw,h,before);}
    let reason=h.click(el,ctx);if(reason)return {reason};
    return school(ctx,raw,h,before);
  }
  async function date(ctx,raw,h,before) {
    const el=ctx.el,doc=el.ownerDocument;
    const opened=await h.waitUntil(ctx,doc.documentElement,()=>Array.from(doc.querySelectorAll('.datetimepicker')).filter(h.visible).filter(p=>!before.has(p)),xs=>xs.length>0);
    if(opened.reason)return {reason:'options_not_rendered'};
    if(opened.value.length!==1)return {reason:'ambiguous_popup'};
    const popup=opened.value[0];ctx.popup=popup;
    const panel=selector=>Array.from(popup.querySelectorAll(selector)).find(h.visible);
    const monthOnly=!!panel('.datetimepicker-months');
    const expected=h.helpers.normalizeDateValue(raw,monthOnly?'month':'date');
    if(!(monthOnly?/^\d{4}-\d{2}$/:/^\d{4}-\d{2}-\d{2}$/).test(expected))return {reason:'invalid_date'};
    const year=Number(expected.slice(0,4)),month=Number(expected.slice(5,7)),day=Number(expected.slice(8,10));
    if(year<1900||year>2100||month<1||month>12||(!monthOnly&&new Date(Date.UTC(year,month-1,day)).getUTCDate()!==day))return {reason:'invalid_date'};
    const activate=async(node,commit=false)=>{
      if(!node||node.matches('.disabled,.old.disabled,.new.disabled'))return 'no_option_match';
      return h.click(node,ctx,commit);
    };
    for(let step=0;step<3&&!panel('.datetimepicker-years');step++){
      const current=panel('.datetimepicker-days,.datetimepicker-months');
      if(!current)return {reason:'unsupported_control'};
      const why=await activate(current.querySelector('th.switch'));if(why)return {reason:why};
    }
    let selected=false;
    for(let step=0;step<24;step++){
      const years=panel('.datetimepicker-years');if(!years)return {reason:'unsupported_control'};
      const cells=Array.from(years.querySelectorAll('span.year'));
      const target=cells.find(x=>Number(trim(x.textContent))===year);
      if(target){const why=await activate(target);if(why)return {reason:why};selected=true;break;}
      const numeric=cells.map(x=>Number(trim(x.textContent))).filter(Number.isFinite);
      if(!numeric.length)return {reason:'unsupported_control'};
      const old=years.textContent;
      const why=await activate(years.querySelector(year<Math.min(...numeric)?'th.prev':'th.next'));if(why)return {reason:why};
      const moved=await h.waitUntil(ctx,popup,()=>years.textContent,text=>text!==old);if(moved.reason)return {reason:moved.reason};
    }
    if(!selected)return {reason:'options_scan_limit'};
    const months=panel('.datetimepicker-months'),cells=months&&Array.from(months.querySelectorAll('span.month'));
    if(!cells||cells.length!==12)return {reason:'unsupported_control'};
    let why=await activate(cells[month-1],monthOnly);if(why)return {reason:why};
    if(!monthOnly){
      const days=panel('.datetimepicker-days');
      const target=days&&Array.from(days.querySelectorAll('td.day:not(.old):not(.new)')).filter(x=>Number(trim(x.textContent))===day);
      if(target?.length!==1)return {reason:'no_option_match'};
      why=await activate(target[0],true);if(why)return {reason:why};
    }
    ctx.observed.selectionMethod='calendar';ctx.observed.datePrecision=monthOnly?'month':'date';
    const accepted=()=>h.helpers.normalizeDateValue(el.value,monthOnly?'month':'date')===expected;
    const checked=await h.waitUntil(ctx,doc.documentElement,accepted,Boolean);
    return checked.reason?{reason:'selection_not_committed'}:{accepted};
  }
  async function school(ctx,raw,h,before) {
    const el=ctx.el,doc=el.ownerDocument,item=el.closest('.ipt-item');
    if(!item)return {reason:'unsupported_control'};
    const stored=item.querySelector('input[type="hidden"][name]');
    if(!stored)return {reason:'unsupported_control'};
    const startValue=stored.value;
    const opened=await h.waitUntil(ctx,doc.documentElement,()=>{
      const inline=item.querySelector('input.input-query');
      if(inline&&h.visible(inline))return {input:inline,root:item};
      const modals=Array.from(doc.querySelectorAll('.modal')).filter(h.visible).filter(p=>!before.has(p));
      if(modals.length>1)return {reason:'ambiguous_popup'};
      const modal=modals[0],input=modal?.querySelector('input.search-school,input.search-job');
      return input&&h.visible(input)?{input,root:modal}:null;
    },Boolean);
    if(opened.reason)return {reason:'options_not_rendered'};
    if(opened.value.reason)return opened.value;
    const {input,root}=opened.value;ctx.popup=root;
    const wanted=trim(raw);if(!wanted)return {reason:'no_option_match'};
    const stop=h.stop(ctx,true);if(stop)return {reason:stop};
    h.write(input,wanted);h.input(input);
    let signature='',stableSince=Date.now();const began=Date.now();
    const choices=await h.waitUntil(ctx,root,()=>{
      const nodes=Array.from(root.querySelectorAll('.schoolOrSubject li,.search-result-li li')).filter(h.visible);
      const next=nodes.map(x=>trim(x.textContent)).join('\n');
      if(next!==signature){signature=next;stableSince=Date.now();}
      return nodes;
    },nodes=>nodes.length>0&&Date.now()-began>=750&&Date.now()-stableSince>=180);
    if(choices.reason)return {reason:'options_not_rendered'};
    ctx.observed.optionCount=choices.value.length;
    let matches=choices.value.filter(x=>h.helpers.normalizeText(x.textContent)===h.helpers.normalizeText(wanted));
    if(!matches.length)matches=choices.value.filter(x=>trim(x.textContent).endsWith('-'+wanted));
    if(matches.length!==1)return {reason:matches.length?'ambiguous_option':'no_option_match'};
    const chosenText=trim(matches[0].textContent);
    const why=h.click(matches[0],ctx,true);if(why)return {reason:why};
    ctx.observed.selectionMethod='search-option';
    const accepted=()=>stored.isConnected&&el.isConnected&&trim(el.value)===chosenText&&!!stored.value
      &&(stored.value!==startValue||trim(el.value)===wanted);
    const checked=await h.waitUntil(ctx,doc.documentElement,accepted,Boolean);
    return checked.reason?{reason:'selection_not_committed'}:{accepted};
  }
  globalThis.XiaomaiWinTalent={supports,run};
})();
