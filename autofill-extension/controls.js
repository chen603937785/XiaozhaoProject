/* DOM-only adapters shared by the debugger; no account or network credentials. */
(function () {
  'use strict';
  const CUSTOM = '.ant-cascader,.el-cascader,.arco-cascader,.ant-picker,.el-date-editor,.phoenix-date-picker,.phoenix-date-time-picker-wrap,.ant-select,.el-select,.arco-select,.phoenix-select,.ant-radio-group,.ant-checkbox-group,[role="combobox"]';
  const norm = value => String(value ?? '').toLowerCase().replace(/[\s:：*（）()]/g, '');
  const aliases = [['本科','大学本科'],['硕士','硕士研究生','研究生硕士'],['博士','博士研究生'],['专科','大专','大学专科'],['学士','学士学位'],['男','男性'],['女','女性'],['大学英语六级','英语六级','CET6','CET-6'],['大学英语四级','英语四级','CET4','CET-4']];
  function equivalent(a, b) {
    const x = norm(a), y = norm(b);
    return x === y || aliases.some(group => group.map(norm).includes(x) && group.map(norm).includes(y));
  }
  const visible = element => !!element?.isConnected && element.getClientRects().length > 0 && getComputedStyle(element).display !== 'none' && getComputedStyle(element).visibility !== 'hidden';
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  function choiceLabel(el) {
    const associated=Array.from(el.labels||[]).map(x=>x.textContent.trim()).filter(Boolean);
    const explicit=el.getAttribute('aria-label');
    if(explicit)return explicit.trim();
    if(associated.length===1)return associated[0];
    const wrap=el.closest('label');if(wrap)return wrap.textContent.trim();
    // Legacy forms often use <input type=radio>男 <input type=radio>女,
    // with no label element. Stop at the next choice instead of borrowing both.
    let text='';
    for(let node=el.nextSibling;node;node=node.nextSibling){
      if(node.nodeType===1&&(node.matches('input,select,textarea,button,label')||node.querySelector('input,select,textarea,button')))break;
      text+=node.textContent||'';
      if(text.trim().length>40)return el.value;
    }
    return text.trim()||el.value;
  }
  function container(element) {
    return element.closest('.resume-form-item,[id*="-item_"]') || element.closest('.el-form-item,.ant-form-item,.form-group,.form-item,fieldset') || element;
  }
  function widget(element) {
    // combobox 输入框常在 ant-select 内；必须先返回组件外壳，不能返回搜索 input。
    const wrapper = '.ant-cascader,.ant-cascader-picker,.el-cascader,.arco-cascader,.ant-picker,.el-date-editor,.phoenix-date-picker,.phoenix-date-time-picker-wrap,.ant-select,.el-select,.arco-select,.phoenix-select,.ant-radio-group,.ant-checkbox-group';
    return element.closest('.ant-cascader,.ant-cascader-picker,.el-cascader,.arco-cascader') || element.closest(wrapper) || element.querySelector(wrapper) || element.closest(CUSTOM) || element.querySelector(CUSTOM) || (element.matches('input,textarea,select,[contenteditable="true"]') ? element : element.querySelector('input:not([type="hidden"]),textarea,select,[contenteditable="true"]')) || element;
  }
  function input(element) {
    if (element.matches('input') && element.closest('.ant-picker,.el-date-editor')?.querySelectorAll('input:not([type="hidden"])').length>1) return element;
    const w = widget(element);
    return w.matches('input,textarea,select,[contenteditable="true"]') ? w : w.querySelector('input:not([type="hidden"]),textarea,select,[contenteditable="true"]');
  }
  function type(element) {
    const w = widget(element), i = input(w);
    if (globalThis.XiaomaiPhoenix?.isDate(w)) return 'date';
    if (w.matches('.ant-cascader,.ant-cascader-picker,.el-cascader,.arco-cascader')) return 'cascader';
    if (w.matches('.ant-picker,.el-date-editor,.phoenix-date-picker,.phoenix-date-time-picker-wrap') || i?.matches('input[choose-date].dayType') || ['date','month','datetime-local','time','week'].includes(i?.type)) return 'date';
    if (w.matches('.ant-radio-group') || i?.type === 'radio') return 'radio';
    if (w.matches('.ant-checkbox-group') || i?.type === 'checkbox') return 'checkbox';
    if (w.matches('.ant-select,.el-select,.arco-select,.phoenix-select,[role="combobox"]')) return 'select';
    return i?.tagName === 'SELECT' ? 'native-select' : i?.isContentEditable ? 'contenteditable' : 'text';
  }
  function value(element) {
    const w = widget(element), i = input(element), kind = type(w);
    if (kind === 'select' || kind === 'cascader') {
      const entry=globalThis.XiaomaiEngine?.entryFor(element);
      const selected=entry && globalThis.ResumeProCustomControls?.readSelection(entry);
      if (selected) return selected.texts.join(' / ');
      const labels = [...w.querySelectorAll('.ant-select-selection-item,.el-select__selected-item,.el-select__tags-text')].map(x => x.getAttribute('title') || x.textContent.trim());
      if (labels.length) return labels.join(' / ');
      if (kind === 'cascader') return i?.value || '';
      // A search query is not a selected value.
      return w.matches('.el-select') ? i?.value || '' : '';
    }
    if (kind === 'radio' || kind === 'checkbox') {
      const entry=globalThis.XiaomaiEngine?.entryFor(element);
      const nodes=entry?.kind==='radio'?entry.elements:Array.from((w.matches('input')?container(w):w).querySelectorAll('input'));
      return nodes.filter(x=>x.checked).map(choiceLabel).join(', ');
    }
    if (i?.tagName === 'SELECT') return i.selectedOptions?.[0]?.textContent.trim() || '';
    return i?.isContentEditable ? i.textContent : i?.value || '';
  }
  function setInput(element, desired) {
    if (!element || element.disabled || element.readOnly) throw new Error('输入控件不可编辑');
    element.focus();
    const proto = element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (!setter) throw new Error('没有找到真实输入控件');
    setter.call(element, String(desired));
    element.dispatchEvent(new Event('input', {bubbles:true}));
    element.dispatchEvent(new Event('change', {bubbles:true}));
  }
  function roots(element) {
    const w = widget(element), i = input(w);
    if(w.matches('.phoenix-select')){
      const popup=globalThis.XiaomaiPhoenix?.openPopup(w,'.phoenix-selectList,.phoenix-calendar,.area-selector-container');
      return popup?[popup]:[];
    }
    const ids = [w, i].filter(Boolean).flatMap(x => (x.getAttribute('aria-controls') || x.getAttribute('aria-owns') || '').split(/\s+/)).filter(Boolean);
    const shells='.ant-select-dropdown,.ant-cascader-dropdown,.ant-picker-dropdown,.el-select-dropdown,.el-cascader__dropdown,.el-picker-panel,.phoenix-selectList,.phoenix-calendar,.area-selector-container';
    const linked = ids.map(id => document.getElementById(id)).filter(Boolean).map(x => x.closest(shells) || x).filter(visible);
    const all = [...new Set([...document.querySelectorAll(shells+',[role="listbox"]')].map(x => x.closest(shells) || x).filter(visible))];
    // 只有一个弹层时才允许后备定位，避免选中别的字段的候选项。
    return [...new Set(linked.length ? linked : all.length === 1 && w.matches('.ant-select,.ant-cascader,.ant-picker,.el-select,.el-cascader,.el-date-editor,.phoenix-select,.phoenix-date-picker,.phoenix-date-time-picker-wrap') ? all : ids.length ? [] : all.length === 1 ? all : [])];
  }
  function options(element, column) {
    const selector = type(element) === 'cascader' ? '.ant-cascader-menu-item,.el-cascader-node' : '.ant-select-item-option,.el-select-dropdown__item,.phoenix-selectList__listItem,.area-data-container .area-item-container,[role="option"]';
    return [...new Set(roots(element).flatMap(root => {
      const columns = [...root.querySelectorAll('.ant-cascader-menu,.el-cascader-menu')];
      const scope = column == null ? root : columns[column];
      return scope ? [...scope.querySelectorAll(selector)] : [];
    }))].filter(x => visible(x) && x.getAttribute('aria-disabled') !== 'true' && !/disabled/.test(x.className));
  }
  function label(option) {
    const text = option.querySelector('.ant-select-item-option-content,.el-cascader-node__label,.phoenix-selectList__singleLabel,.area-text-label')?.textContent || option.textContent;
    return (text || option.getAttribute('title') || '').trim();
  }
  async function open(element) {
    const w = widget(element), i = input(w);
    if (w.getAttribute('aria-disabled') === 'true' || w.matches('.ant-select-disabled,.ant-picker-disabled,.is-disabled,.phoenix-select--disabled') || i?.disabled) throw new Error('控件当前不可编辑');
    w.scrollIntoView({block:'center'});
    if (type(w) === 'radio' || type(w) === 'checkbox') return [...container(w).querySelectorAll('label')].map(label);
    if (type(w) === 'native-select') return [...i.options].filter(x => !x.disabled).map(label);
    if (type(w) === 'text' || type(w) === 'contenteditable') { i?.focus(); return []; }
    if (i && !i.disabled) i.focus(); // 光大 onFocus 会触发字典接口。
    if (i?.getAttribute('aria-expanded') !== 'true' && !roots(w).length) {
      const trigger = w.matches('.phoenix-select') ? w : w.querySelector('.ant-select-selector,.el-input__wrapper') || i || w;
      trigger.dispatchEvent(new MouseEvent('mousedown', {bubbles:true,button:0}));
      trigger.click();
    }
    for (let n = 0; n < 30; n++) {
      if (options(w).length || type(w) === 'date' && roots(w).length) break;
      await delay(100);
    }
    return options(w).map(label);
  }
  async function findOption(w, wanted, column) {
    for (let n = 0; n < 45; n++) {
      const matches = options(w, column).filter(x => equivalent(label(x), wanted));
      if (matches.length === 1) return matches[0];
      if (matches.length > 1) throw new Error('存在多个同名选项，请手动确认');
      await delay(100);
    }
    throw new Error('候选项未返回或没有唯一匹配项：' + wanted);
  }
  const fill = (element, desired, options) => globalThis.XiaomaiEngine.fill(element, desired, options);
  const check = element => globalThis.XiaomaiEngine.check(element);
  globalThis.XiaomaiControls = {container,widget,input,type,value,open,fill,check,equivalent,visible,choiceLabel};
})();
