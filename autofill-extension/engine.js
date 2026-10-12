/* Xiaomai bridge: resume values stay local; control execution is deterministic. */
(function () {
  'use strict';
  const C = globalThis.XiaomaiControls, H = globalThis.ResumeProAIHelpers;
  const bindings = new WeakMap(), completed = new WeakMap();
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const reasons = {
    no_option_match:'候选项没有唯一匹配，请检查名称或完整省市路径',
    ambiguous_option:'存在多个同名或近似选项，请手动确认',
    ambiguous_popup:'同时出现多个候选弹层，无法确认所属字段',
    options_not_rendered:'候选项未返回或控件未展开',
    options_timeout:'搜索后未返回稳定的候选项',
    options_scan_limit:'候选列表过长，已停止遍历，请展开控件后手动确认',
    cascade_timeout:'下一层地区选项未加载，请检查完整省市路径',
    incomplete_cascade:'简历路径停在分类或地区上级，请补齐下一层选项',
    selection_not_committed:'已点击候选项，但页面未确认选中值',
    value_not_committed:'页面未接受输入值',
    value_reverted:'输入值被页面重置，未保存成功',
    element_disconnected:'页面控件已更新，请重新扫描',
    cancelled:'填写已停止或字段已更新，请重新扫描',
    value_changed:'检测到手动修改，已停止覆盖',
    readonly_control:'这是只读选择控件，需要通过日期或候选面板选择；请展开后手动确认',
    control_disabled:'控件当前不可编辑',
    validation_not_cleared:'网页校验未通过，请检查字段要求',
    framework_state_unsynced:'网页仍显示校验错误，填写未确认',
    unsupported_control:'该控件暂不支持自动填写，请手动选择',
    invalid_date:'日期无效，请使用 YYYY-MM-DD 或 YYYY-MM',
    verification_timeout:'等待页面确认超时',
    operation_failed:'页面未完成控件操作，请展开后检查'
  };
  function message(code) { return reasons[code] || ('控件操作未完成：'+code); }
  function register(element, entry) { bindings.set(element,entry); }
  function entryFor(element) {
    const bound=bindings.get(element);
    if (bound) return {...bound,controlKind:bound.controlKind==='date-picker'?'date':bound.controlKind==='select'?'native-select':bound.controlKind};
    const root=C.widget(element), input=C.input(root), kind=C.type(root);
    if (kind==='radio') return {kind:'radio',controlKind:'radio',root,elements:[...C.container(root).querySelectorAll('input[type="radio"]')]};
    return {kind:'element',element:input||root,root,controlKind:({select:'custom-select','native-select':'native-select',date:'date',cascader:'cascader',contenteditable:'contenteditable',checkbox:'checkbox'})[kind]||'text',
      pickerType:root.matches('.ant-picker')?'antd':root.matches('.el-date-editor')?'element':globalThis.XiaomaiPhoenix?.isDate(root)?'phoenix':undefined};
  }
  function writeValue(el,value) {
    const proto=el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    const setter=Object.getOwnPropertyDescriptor(proto,'value')?.set;
    if (!setter || el.disabled) throw Error('不可编辑');
    setter.call(el,String(value));
  }
  function dispatchTextInput(el,value) {
    el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:String(value)}));
  }
  async function runTextLifecycle(el,value,sequential,guard,wrote) {
    if (el.readOnly) return false;
    el.focus(); await delay(0); if (!guard()) return false;
    if (sequential) {
      writeValue(el,''); wrote(); dispatchTextInput(el,'');
      let text='';
      for (const char of Array.from(value)) {if (!guard()) return false; text+=char;writeValue(el,text);dispatchTextInput(el,char);}
    } else {writeValue(el,value);wrote();dispatchTextInput(el,value);}
    el.dispatchEvent(new Event('change',{bubbles:true}));
    await delay(0); if (!guard()) return false;
    el.blur(); return true;
  }
  function inspectText(el,expected,accepted) {
    if (!el.isConnected) return {ok:false,reason:'element_disconnected'};
    if (String(el.value??'')!==expected) return {ok:false,reason:accepted?'value_reverted':'value_not_committed'};
    const group=C.container(el);
    const errors=[...group.querySelectorAll('.ant-form-item-explain-error,.el-form-item__error,[role="alert"],.error-message')];
    const described=(el.getAttribute('aria-describedby')||'').split(/\s+/).map(id=>document.getElementById(id)).filter(Boolean);
    if (el.getAttribute('aria-invalid')==='true' || errors.some(x=>C.visible(x)&&x.textContent.trim()) ||
      described.some(x=>C.visible(x)&&x.getAttribute('role')==='alert'&&x.textContent.trim())) return {ok:false,reason:'validation_not_cleared'};
    if (group.matches('.ant-form-item-has-error,.has-error,.is-error,.is-invalid')) return {ok:false,reason:'framework_state_unsynced'};
    return {ok:true,reason:''};
  }
  // Only add unique, explicit equivalents; do not confuse 学历/学位 or 全日制/非全日制.
  const helpers={...H,equivalentOption:C.equivalent,findSelectOptionIndex(options,wanted) {
    const matches=options.map((x,index)=>({x,index})).filter(({x})=>!x.disabled&&(C.equivalent(x.text,wanted)||C.equivalent(x.value,wanted)));
    if (matches.length===1) return matches[0].index;
    if (matches.length>1) return -1;
    return H.findSelectOptionIndex(options,wanted);
  }};
  const operator=globalThis.ResumeProControls.create({
    helpers,isVisible:C.visible,writeValue,
    focus:el=>el.focus?.(),blur:el=>el.blur?.(),
    radioLabel:C.choiceLabel,
    normalizeText(el,value) {
      const text=String(value??'');
      if (el instanceof HTMLTextAreaElement) return text.replace(/\r\n?/g,'\n');
      return ['email','url'].includes(el.type)?text.replace(/[\r\n]/g,'').trim():text.replace(/[\r\n]/g,'');
    },
    runTextLifecycle,inspectText,waitTextCommit:()=>delay(350),
    replayFocusBlur:async el=>{el.focus();await delay(0);el.blur();},
    prefersSequential:el=>['tel','email','number'].includes(el.type),
    dispatchTextInput,settleMs:350,timeoutMs:6000
  });
  async function fill(element,wanted,options={}) {
    const original=bindings.get(element),entry=entryFor(element);
    completed.delete(element);
    const bindingCurrent=()=> element.isConnected &&
      (!original || globalThis.ResumeProFieldScan.isBindingCurrent(original,document,{isVisible:C.visible,exclude:el=>!!el.closest('#xiaomai-debug-panel')}));
    const current=()=>bindingCurrent()&&(!options.isCurrent||options.isCurrent());
    element.scrollIntoView?.({block:'center'});
    const run=target=>{
      // CEB dictionaries expose showSearch on every Select, but only school
      // search loads remote results. Never filter dictionaries with resume text.
      const hostname=element.ownerDocument.location?.hostname;
      const title=C.container(element).querySelector('.resume-form-title')?.textContent.replace(/[\s*：:（）()]/g,'') || '';
      const ceb=hostname==='eoap.cebbank.com' && ['custom-select','cascader'].includes(target.controlKind);
      const school=/^(学校名称|学校|院校名称|院校|毕业院校|毕业学校|就读学校|就读院校)$/.test(title);
      const hints=ceb?{...options.hints,searchable:school}:options.hints;
      return operator.operate(target,wanted,{...options,hints,isCurrent:current});
    };
    let targets=[entry],results;
    if (C.type(element)==='checkbox' && !['true','false','1','0','是','否'].includes(String(wanted).toLowerCase())) {
      const group=C.widget(element).matches('.ant-checkbox-group')?C.widget(element):C.container(element);
      const nodes=[...group.querySelectorAll('input[type="checkbox"]')];
      const wants=Array.isArray(wanted)?wanted:[wanted];
      const chosen=wants.map(value=>nodes.filter(n=>!n.disabled&&C.equivalent(n.closest('label')?.textContent||n.value,value)));
      if (chosen.some(list=>list.length!==1)) throw Error(message('no_option_match'));
      targets=chosen.map(list=>({kind:'element',controlKind:'checkbox',element:list[0],root:group}));
      results=[];
      for (const target of targets) results.push(await operator.operate(target,true,{...options,isCurrent:current}));
    } else results=[await run(entry)];
    const bad=results.find(x=>!x.ok);
    if (bad) {const error=Error(message(bad.reason));error.code=bad.reason;error.observed=bad.observed;throw error;}
    completed.set(element,{targets,current:bindingCurrent});
    return {ok:true,kind:C.type(element),observed:results.map(x=>x.observed)};
  }
  function check(element) {
    const saved=completed.get(element); if (!saved) return null;
    if (!saved.current()) return {ok:false,reason:'element_disconnected',message:message('element_disconnected')};
    const results=saved.targets.map(target=>operator.check(target));
    const bad=results.find(x=>x&&!x.ok);
    return bad?{...bad,message:message(bad.reason)}:{ok:true};
  }
  globalThis.XiaomaiEngine={fill,check,register,entryFor,message};
})();
