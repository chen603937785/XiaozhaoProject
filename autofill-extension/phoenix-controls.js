/* DOM-only adapter for Beisen Phoenix select/date controls. */
(function () {
  'use strict';
  const trim = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  const visible = node => {
    if (!node?.isConnected || !node.getClientRects?.().length) return false;
    for(let el=node;el;el=el.parentElement){const css=getComputedStyle(el);if(el.hidden||el.getAttribute('aria-hidden')==='true'||css.display==='none'||css.visibility==='hidden')return false;}
    return true;
  };
  const normalize = (value, mode) => globalThis.ResumeProAIHelpers?.normalizeDateValue?.(value, mode) || String(value ?? '');
  function isDate(root) {
    return !!root?.matches?.('.phoenix-date-picker, .phoenix-date-time-picker-wrap')
      || !!root?.matches?.('.phoenix-select') && Array.from(root.querySelectorAll('use')).some(node => (node.getAttribute('href') || node.getAttribute('xlink:href')) === '#prefix__a_field_date_time_picker');
  }
  // Phoenix portals have no aria-controls. Only reuse an already-open panel
  // when the DOM exposes exactly one active field and one visible panel.
  function openPopup(root, selector) {
    const doc=root?.ownerDocument;
    if(!doc||!root.matches('.phoenix-select--active'))return null;
    const active=[...doc.querySelectorAll('.phoenix-select--active')].filter(visible);
    const panels=[...doc.querySelectorAll('.phoenix-selectList,.phoenix-calendar,.area-selector-container')].filter(visible);
    return active.length===1&&active[0]===root&&panels.length===1&&panels[0].matches(selector)?panels[0]:null;
  }
  async function runArea(ctx,raw,h,popup){
    const path=(Array.isArray(raw)?raw:String(raw??'').split(/\s*(?:\/|>|→|,|，)\s*/)).map(trim).filter(Boolean);
    if(!path.length||path.length>5)return {reason:'incomplete_cascade'};
    const regionName=value=>trim(value).replace(/\s/g,'').replace(/(?:特别行政区|地区|省|市|区|县)$/,'');
    const sameRegion=(a,b)=>trim(a)===trim(b)||regionName(a)&&regionName(a)===regionName(b);
    let remaining=path.length===1?path[0].replace(/\s/g,''):null;
    const rows=()=>[...popup.querySelectorAll('.area-data-container .area-item-container')].filter(visible);
    if(popup.querySelector('[class*="area-icon-Checkbox"]'))return {reason:'unsupported_control'};
    ctx.observed={library:'phoenix',selectionMethod:'area-path',pathDepth:path.length,optionCount:0};
    const breadcrumbs=[...popup.querySelectorAll('.area-breadcrumb-list .phoenix-breadcrumb-link')].filter(visible);
    if(breadcrumbs.length>1){
      const why=h.click(breadcrumbs[0],ctx);if(why)return {reason:why};
      const reset=await h.waitUntil(ctx,popup,()=>[...popup.querySelectorAll('.area-breadcrumb-list .phoenix-breadcrumb-link')].filter(visible).length,count=>count===1);
      if(reset.reason)return {reason:reset.reason};
    }
    const chosen=[];
    for(let level=0;level<5;level++){
      const ready=await h.waitUntil(ctx,popup,rows,list=>list.length>0);
      if(ready.reason)return {reason:ready.reason==='verification_timeout'?'cascade_timeout':ready.reason};
      const options=ready.value.map(row=>({row,text:trim(row.querySelector('.area-text-label')?.textContent)})).filter(item=>item.text);
      // Match only the current branch. Concatenated Chinese paths are consumed
      // from real option labels, never inferred by picking a province's first city.
      let list=options.filter(item=>sameRegion(item.text,remaining===null?path[level]:remaining)).map(item=>({...item,rest:''}));
      if(!list.length&&remaining!==null){
        list=options.flatMap(item=>{
          const names=[item.text.replace(/\s/g,''),regionName(item.text)].filter(Boolean).sort((a,b)=>b.length-a.length);
          const prefix=names.find(name=>remaining.startsWith(name));
          return prefix?[{...item,rest:remaining.slice(prefix.length)}]:[];
        });
      }
      ctx.observed.optionCount+=ready.value.length;
      if(list.length!==1)return {reason:list.length>1?'ambiguous_option':'no_option_match'};
      const {row,rest}=list[0],label=row.querySelector('.area-text-label'),branch=row.querySelector('.area-icon-right');
      const more=remaining===null?level<path.length-1:!!rest;
      chosen.push(trim(label.textContent));
      if(more){
        if(!branch)return {reason:'no_option_match'};
        const old=rows().map(node=>trim(node.querySelector('.area-text-label')?.textContent)).join('\n');
        // Phoenix binds always-visible arrows; older variants bind the label.
        const trigger=branch.classList.contains('visible')&&visible(branch)?branch:label;
        const why=h.click(trigger,ctx);if(why)return {reason:why};
        const changed=await h.waitUntil(ctx,popup,rows,list=>list.length>0&&list.map(node=>trim(node.querySelector('.area-text-label')?.textContent)).join('\n')!==old);
        if(changed.reason)return {reason:changed.reason==='verification_timeout'?'cascade_timeout':changed.reason};
        if(remaining!==null)remaining=rest;
      }else{
        const radio=row.querySelector('.area-icon-RadioUnchecked,.area-icon-RadioChecked');
        if(row.querySelector('.area-icon-RadioUnchecked-disabled,.area-icon-RadioChecked-disabled'))return {reason:'control_disabled'};
        // A visible radio authorizes this level even when a child arrow exists.
        // Hidden radios mean the site's selectedLevel requires a deeper path.
        if(!radio||!visible(radio)||radio.closest('.icon-container.hidden'))return {reason:branch?'incomplete_cascade':'unsupported_control'};
        const why=h.click(radio,ctx,true);if(why)return {reason:why};
        break;
      }
      if(level===4)return {reason:'incomplete_cascade'};
    }
    ctx.observed.pathDepth=chosen.length;
    const selectionLeaf=value=>{
      const includesChildren=popup.querySelector('.area-footer-haschild input:checked,.area-footer-haschild .phoenix-checkbox__realInput--checked');
      const leaf=trim(value).split(/\s*\/\s*/).pop();
      return includesChildren?leaf.replace(/[（(](?:包含下级|含下级)[）)]$/,''):leaf;
    };
    const pending=await h.waitUntil(ctx,popup,()=>[...popup.querySelectorAll('.select-area-text-label')].map(node=>trim(node.textContent)),labels=>labels.length===1&&selectionLeaf(labels[0])===chosen[chosen.length-1]
      && rows().some(row=>trim(row.querySelector('.area-text-label')?.textContent)===chosen[chosen.length-1]&&row.querySelector('.area-icon-RadioChecked')));
    if(pending.reason)return {reason:pending.reason==='verification_timeout'?'selection_not_committed':pending.reason};
    const pendingLabel=pending.value[0];
    const buttons=[...popup.querySelectorAll('.area-footer-button .button-container button,.area-footer-button .button-container .phoenix-button__wraper')].filter(node=>visible(node)&&trim(node.textContent)==='确定');
    if(buttons.length!==1)return {reason:'unsupported_control'};
    // This confirms only the local region picker, never the application form.
    const why=h.click(buttons[0],ctx,true);if(why)return {reason:why};
    const root=ctx.entry.root;
    const accepted=()=>!visible(popup)&&trim(root.querySelector('.phoenix-select__tipEle')?.textContent)===pendingLabel;
    const committed=await h.waitUntil(ctx,root.ownerDocument.documentElement,accepted,Boolean);
    return committed.reason?{reason:committed.reason==='verification_timeout'?'selection_not_committed':committed.reason}:{accepted};
  }
  async function run(ctx, raw, h) {
    const root = ctx.entry.root || ctx.el.closest('.phoenix-date-picker, .phoenix-date-time-picker-wrap');
    if (!root) return { reason: 'unsupported_control' };
    const existing=openPopup(root,'.phoenix-calendar');
    const before = new Set([...ctx.el.ownerDocument.querySelectorAll('.phoenix-calendar')].filter(visible));
    const trigger = root.matches('.phoenix-select') ? root : root.querySelector('.phoenix-calendar-input, input') || root;
    if(!existing){const reason = h.click(trigger, ctx); if (reason) return { reason };}
    const opened = await h.waitUntil(ctx, ctx.el.ownerDocument.documentElement, () => {
      const all = [...ctx.el.ownerDocument.querySelectorAll('.phoenix-calendar')].filter(visible);
      const added = all.filter(node => !before.has(node));
      return existing?.isConnected&&visible(existing)?existing:added.length === 1 ? added[0] : null;
    }, Boolean);
    if (opened.reason) return { reason: opened.reason==='verification_timeout'?'options_not_rendered':opened.reason };
    const popup = opened.value, mode = popup.classList.contains('phoenix-calendar-month-calendar') ? 'month' : 'date', expected = normalize(raw, mode);
    if (!(mode === 'month' ? /^\d{4}-\d{2}$/.test(expected) : /^\d{4}-\d{2}-\d{2}$/.test(expected))) return { reason: 'invalid_date' };
    const year = Number(expected.slice(0, 4)), month = Number(expected.slice(5, 7)), day = Number(expected.slice(8, 10));
    if(year<1900||year>2100||month<1||month>12||mode==='date'&&(day<1||new Date(Date.UTC(year,month-1,day)).getUTCDate()!==day))return {reason:'invalid_date'};
    ctx.popup = popup; ctx.observed = { library: 'phoenix', optionCount: 0 };
    const click = async (node, commit = false) => { if (!node || !visible(node) || node.closest('.phoenix-calendar-disabled-cell, .phoenix-calendar-month-panel-cell-disabled, .phoenix-calendar-year-panel-cell-disabled') || node.getAttribute('aria-disabled')==='true') return 'no_option_match'; return h.click(node, ctx, commit); };
    const chooseYear = async () => {
      const button = [...popup.querySelectorAll('.phoenix-calendar-year-select, .phoenix-calendar-month-panel-year-select')].find(visible);
      if (!button) return 'unsupported_control';
      let why = await click(button); if (why) return why;
      for (let step = 0; step < 25; step++) {
        const cells = [...popup.querySelectorAll('.phoenix-calendar-year-panel-year')].filter(visible);
        const target = cells.find(node => Number(trim(node.textContent)) === year);
        if (target) return click(target, mode === 'year');
        const nums = cells.map(node => Number(trim(node.textContent))).filter(Number.isFinite);
        if (!nums.length) return 'options_not_rendered';
        const nav = [...popup.querySelectorAll(year < Math.min(...nums) ? '.phoenix-calendar-year-panel-prev-decade-btn' : '.phoenix-calendar-year-panel-next-decade-btn')].find(visible);
        why = await click(nav); if (why) return why;
      }
      return 'options_scan_limit';
    };
    let why = await chooseYear(); if (why) return { reason: why };
    if (mode === 'month') {
      const monthButton = [...popup.querySelectorAll('.phoenix-calendar-month-select')].find(visible);
      if (!monthButton) return { reason: 'unsupported_control' };
      why = await click(monthButton); if (why) return { reason: why };
      const cells = [...popup.querySelectorAll('.phoenix-calendar-month-panel-cell .phoenix-calendar-month-panel-month')].filter(visible);
      if (cells.length !== 12 || !cells[month - 1]) return { reason: 'no_option_match' };
      why = await click(cells[month - 1], true); if (why) return { reason: why };
    } else {
      const monthButton = popup.querySelector('.phoenix-calendar-month-select');
      if (!monthButton) return { reason: 'unsupported_control' };
      why = await click(monthButton); if (why) return { reason: why };
      const cells = [...popup.querySelectorAll('.phoenix-calendar-month-panel-cell .phoenix-calendar-month-panel-month')].filter(visible);
      if (cells.length !== 12 || !cells[month - 1]) return { reason: 'no_option_match' };
      why = await click(cells[month - 1]); if (why) return { reason: why };
      const days = [...popup.querySelectorAll('.phoenix-calendar-date')].filter(node => visible(node)
        && trim(node.textContent) === String(day)
        && !node.closest('.phoenix-calendar-last-month-cell, .phoenix-calendar-next-month-btn-day, .phoenix-calendar-disabled-cell'));
      if (days.length !== 1) return { reason: days.length > 1 ? 'ambiguous_option' : 'no_option_match' };
      why = await click(days[0], true); if (why) return { reason: why };
    }
    ctx.observed.selectionMethod = 'calendar'; ctx.observed.datePrecision = mode;
    const accepted = () => normalize(root.querySelector('.phoenix-select__tipEle')?.textContent || ctx.el.value || '', mode) === expected;
    const checked = await h.waitUntil(ctx, ctx.el.ownerDocument.documentElement, accepted, Boolean);
    return checked.reason ? { reason: 'selection_not_committed' } : { accepted };
  }
  globalThis.XiaomaiPhoenix = { run, isDate, openPopup, runArea };
})();
