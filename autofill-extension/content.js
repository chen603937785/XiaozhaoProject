(function () {
  'use strict';
  if (window.top !== window || document.getElementById('xiaomai-debug-panel')) return;
  const C = globalThis.XiaomaiControls, F = globalThis.XiaomaiFields;
  if (!C || !F) return;
  function api(path,options={}) {
    return new Promise((resolve,reject) => chrome.runtime.sendMessage({type:'xiaomai-api',path,method:options.method||'GET',body:options.body},reply => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (!reply?.ok) return reject(new Error(reply?.data?.message || reply?.error || '请求失败'));
      resolve(reply.data);
    }));
  }
  let fields=[],resumeData=null,loggedIn=false,tab='fields',logs=[],busy=false,cancelled=false,schemaSource='bundled',loadedResumeId='',loadingResume=null,missingReminder=true;
  const panel = document.createElement('div');
  panel.id = 'xiaomai-debug-panel';
  panel.innerHTML = `
    <div class="xd-shell" hidden>
      <div class="xd-head" id="xd-drag"><span>小麦填写助手</span><button id="xd-close" aria-label="关闭悬浮操作框" title="关闭">×</button></div>
      <div class="xd-quick">
        <div class="xd-fill-row"><button id="xd-fill-now" class="xd-fill-now">一键填入</button><button id="xd-fill-help" class="xd-help" aria-label="一键填入说明" title="使用当前简历填写已展开的模块，不会自动提交">?</button></div>
        <div class="xd-resume-caption" id="xd-resume-caption">在浏览器图标中登录并选择简历</div>
        <div class="xd-mode-caption" id="xd-mode-caption">仅填新增内容 · 保留网页已有值</div>
        <div class="xd-quick-actions"><button class="xd-btn xd-danger" id="xd-stop" disabled>停止填写</button><button class="xd-btn" id="xd-review">复核结果</button></div>
        <div class="xd-status" id="xd-status" role="status">点击浏览器右上角的小麦图标，登录与手机、电脑相同的账号。</div>
        <div class="xd-missing" id="xd-missing" hidden></div>
        <div class="xd-bottom-note">填写后请核对，不会自动保存或提交</div>
        <button id="xd-debug-toggle" class="xd-debug-toggle" aria-expanded="false">控件调试 <span>⌄</span></button>
      </div>
      <div class="xd-body" hidden>
        <div class="xd-row" hidden><input id="xd-phone" inputmode="numeric" autocomplete="username" placeholder="小麦账号手机号"><input id="xd-password" type="password" autocomplete="current-password" placeholder="密码"><button class="xd-btn xd-primary" id="xd-login">登录</button></div>
        <div class="xd-row" hidden><span class="xd-login-state" id="xd-login-state">未登录</span><button class="xd-btn" id="xd-logout">退出登录</button></div>
        <div class="xd-row" hidden><input id="xd-token" type="password" placeholder="高级：粘贴 token"><button class="xd-btn" id="xd-save">使用 token</button></div>
        <div class="xd-row"><button class="xd-btn xd-primary" id="xd-load">刷新当前简历</button><button class="xd-btn" id="xd-scan">扫描字段</button></div>
        <div class="xd-row"><button class="xd-btn xd-primary" id="xd-batch">填写可匹配项</button></div>
        <label class="xd-overwrite"><input type="checkbox" id="xd-overwrite">允许覆盖已有值</label>
        <div class="xd-tabs"><button class="on" data-tab="fields">字段 <b id="xd-count">0</b></button><button data-tab="logs">接口日志 <b id="xd-log-count">0</b></button></div><div id="xd-content"></div>
      </div>
    </div>`;
  (document.body || document.documentElement).appendChild(panel);
  const $ = selector => panel.querySelector(selector);
  const status = text => $('#xd-status').textContent = text;
  const loginState = text => $('#xd-login-state').textContent = text;
  const exportButton=document.createElement('button');
  exportButton.id='xd-export';exportButton.className='xd-btn';exportButton.textContent='导出排查报告';
  $('#xd-batch').parentElement.appendChild(exportButton);
  exportButton.onclick=()=>{
    if (busy) return;
    const report={version:'0.1.9',site:location.hostname,schemaSource,createdAt:new Date().toISOString(),
      fields:fields.map(item=>({title:item.title,module:item.moduleTitle,record:item.record+1,kind:C.type(item.el),
        match:item.match||null,state:item.state||'not_attempted',reason:item.failureCode||null,
        selectionMethod:item.selectionMethod||null,diagnostic:{...controlShape(item),...item.diagnostic},connected:item.el.isConnected}))};
    const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='xiaomai-autofill-report.json';
    link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    status('已导出字段名称、匹配路径和失败类型，不包含简历值、密码或登录凭证。');
  };
  api('session').then(session => {
    loggedIn = session.loggedIn;
    if (session.phone) $('#xd-phone').value = session.phone;
    if (loggedIn) loginState('已登录小麦账号');
  }).catch(error => status('账号状态读取失败：'+error.message));
  $('#xd-save').onclick = async () => {
    const token = $('#xd-token').value.trim();
    await chrome.storage.local.set({token});
    loggedIn=!!token; resumeData=null; $('#xd-token').value='';
    loginState(loggedIn?'已使用 token 登录':'未登录');
    status(loggedIn?'token 已保存，可以加载简历':'已清除 token');
  };
  $('#xd-login').onclick = async () => {
    const phone=$('#xd-phone').value.trim(),password=$('#xd-password').value,button=$('#xd-login');
    if (!/^1\d{10}$/.test(phone)) return status('请输入正确的 11 位手机号');
    if (!password) return status('请输入密码');
    button.disabled=true; status('正在登录小麦账号…');
    try {
      const reply=await api('/api/auth/password-login',{method:'POST',body:{phone,password}});
      if (reply.code !== 200) throw Error(reply.message||'登录失败');
      loggedIn=true; resumeData=null;
      loginState('已登录：'+phone); status('登录成功，可以加载我的简历。');
    } catch (error) { status('登录失败：'+error.message); }
    finally { $('#xd-password').value=''; button.disabled=false; }
  };
  $('#xd-logout').onclick = async () => {
    await api('logout'); loggedIn=false; resumeData=null;
    $('#xd-token').value=''; $('#xd-password').value='';
    loginState('未登录'); status('已退出小麦账号');
  };
  function show(opening) {
    $('.xd-shell').hidden=!opening;
    if (opening) {clampPosition();if (!busy) loadResume();}
  }
  $('#xd-close').onclick=()=>show(false);
  $('#xd-debug-toggle').onclick=()=>{
    const opening=$('.xd-body').hidden;
    $('.xd-body').hidden=!opening;panel.classList.toggle('xd-debug-open',opening);
    $('#xd-debug-toggle').setAttribute('aria-expanded',String(opening));clampPosition();
  };
  $('#xd-fill-help').onclick=()=>status('先在浏览器图标中选择简历与填写方式，展开网页简历模块后点击“一键填入”。默认只填空白项，完成后请核对。');
  function panelState() {
    return {visible:!$('.xd-shell').hidden,busy,missing:fields.filter(x=>x.state==='resume_empty'||x.state==='unmatched').map(x=>x.title)};
  }
  chrome.runtime.onMessage.addListener((message,sender,sendResponse) => {
    if (message?.type==='xiaomai-toggle-panel') show($('.xd-shell').hidden);
    if (message?.type!=='xiaomai-panel-command') return false;
    if (message.command==='show') show(true);
    if (message.command==='hide') show(false);
    if (message.command==='reload') {
      if (busy) {sendResponse({...panelState(),error:'正在填写，请停止后刷新'});return false;}
      loadResume().then(ok=>sendResponse({...panelState(),...(ok?{}:{error:'简历同步失败，请在浏览器图标中检查登录并刷新简历'})}));return true;
    }
    sendResponse(panelState());return false;
  });
  async function settings() {
    const stored=typeof chrome.storage.local.get==='function'?await chrome.storage.local.get(['selectedResumeId','fillMode','missingReminder']):{};
    missingReminder=stored.missingReminder!==false;
    if (!busy) $('#xd-overwrite').checked=stored.fillMode==='overwrite';
    $('#xd-mode-caption').textContent=$('#xd-overwrite').checked?'全部覆盖重填 · 请核对覆盖结果':'仅填新增内容 · 保留网页已有值';
    return stored;
  }
  async function loadResume() {
    if (loadingResume) return loadingResume;
    loadingResume=loadResumeImpl();
    try {return await loadingResume;} finally {loadingResume=null;}
  }
  async function loadResumeImpl() {
    if (busy) return false;
    const button=$('#xd-load'); button.disabled=true; status('正在加载简历…');
    try {
      const session=await api('session');loggedIn=!!session.loggedIn;
      if (!loggedIn) throw Error('请点击浏览器小麦图标登录账号');
      const stored=await settings();
      const reply=await api('/api/resumes');
      if (reply.code!==200) throw Error(reply.message||'请求失败');
      const list=reply.data||[];
      const current=list.find(x=>String(x.id)===String(stored.selectedResumeId))||list.find(x=>x.isDefault===true||x.isDefault===1)||list[0];
      if (!current) throw Error('暂无简历，请先在官网创建简历');
      const detail=await api('/api/resumes/'+current.id);
      if (detail.code!==200) throw Error(detail.message||'简历详情加载失败');
      resumeData={resumes:[detail.data]};loadedResumeId=String(current.id);
      $('#xd-resume-caption').textContent='当前简历：'+(current.resumeName||'默认模板简历');
      try {
        const schema=await api('/api/resume-schema');
        if (schema.code===200 && F.configure(schema.data)) schemaSource='server';
      } catch (_) { /* Older servers keep using the built-in field aliases. */ }
      // Loading after scanning used to leave the old, incomplete matches in place.
      for (const item of fields) {item.match=F.match(item);item.state='not_attempted';item.written=false;item.failed=false;item.failureCode=null;item.result='';item.diagnostic=null;}
      status('当前简历已刷新，字段定义来自'+(schemaSource==='server'?'服务端':'内置完整定义')+'。');render();return true;
    } catch (error) { resumeData=null;loadedResumeId='';$('#xd-resume-caption').textContent='请在浏览器图标中登录并选择简历';status('简历加载失败：'+error.message);return false; }
    finally { button.disabled=false; }
  }
  $('#xd-load').onclick=loadResume;
  $('#xd-fill-now').onclick=async()=>{
    if (busy || loadingResume) return;
    $('#xd-fill-now').disabled=true;
    try {
      const stored=await settings(),session=await api('session');
      if (!session.loggedIn) {resumeData=null;loggedIn=false;status('请点击浏览器右上角的小麦图标登录账号');return;}
      if (!resumeData || (stored.selectedResumeId && String(stored.selectedResumeId)!==loadedResumeId)) {
        if (!await loadResume()) return;
      }
      $('#xd-scan').onclick();await $('#xd-batch').onclick();
    } catch(error) {status('填写准备失败：'+error.message);}
    finally {$('#xd-fill-now').disabled=false;}
  };
  $('#xd-scan').onclick=()=>{
    if (busy) return status('正在填写控件，请等待后再扫描');
    fields=F.scan(); $('#xd-count').textContent=fields.length;
    status('已扫描 '+fields.length+' 个控件；展开后等待真实候选项，填写后核对选中值。'); render();
  };
  $('#xd-stop').onclick=()=>{cancelled=true;status('正在停止；已完成的字段会保留，并进行复核。');};
  function lock(active) {
    busy=active; $('#xd-stop').disabled=!active;
    for (const id of ['xd-fill-now','xd-batch','xd-review','xd-export','xd-load','xd-login','xd-logout','xd-save','xd-overwrite']) $('#'+id).disabled=active;
  }
  function review() {
    let passed=0,failed=0;
    for (const item of fields.filter(x=>x.written)) {
      const verdict=C.check(item.el);
      if (!verdict) continue;
      item.failed=!verdict.ok;
      item.state=verdict.ok?'confirmed':'failed';item.failureCode=verdict.ok?null:verdict.reason;
      item.result=verdict.ok?'复核通过：'+C.value(item.el):'复核未通过：'+verdict.message;
      if (verdict.ok) passed++; else failed++;
    }
    return {passed,failed};
  }
  $('#xd-review').onclick=()=>{
    if (busy) return;
    const result=review();status('填写复核：'+result.passed+' 项保持成功，'+result.failed+' 项未通过。');render();
  };
  $('#xd-batch').onclick=async()=>{
    if (busy) return;
    if (!resumeData) return status('请先登录并加载我的简历');
    if (!fields.length) return status('请先扫描字段');
    cancelled=false; lock(true); let skipped=0,attempted=0,unmatched=0,empty=0,preserved=0;
    const attemptedItems=[];
    const overwrite=$('#xd-overwrite').checked;
    try {
      for (const item of fields) {
        if (cancelled) break;
        item.failureCode=null;item.selectionMethod=null;item.written=false;
        if (!item.match) {item.state='unmatched';item.result='未找到唯一字段匹配';item.failed=false;skipped++;unmatched++;continue;}
        const wanted=item.match?F.resolveResume(resumeData,item):null;
        item.diagnostic=valueShape(wanted,C.type(item.el));
        if (wanted==null || String(wanted).trim()==='') {item.state='resume_empty';item.result='简历对应字段暂无值（第'+(item.record+1)+'条）';item.failed=false;skipped++;empty++;continue;}
        const initial=C.value(item.el);
        const entry=globalThis.XiaomaiEngine.entryFor(item.el);
        const hasValue=['custom-select','cascader'].includes(entry.controlKind)
          ? globalThis.ResumeProCustomControls.hasExistingValue(entry):!!initial;
        if (hasValue&&!overwrite) {item.state='preserved';item.result='已保留原有值';item.failed=false;skipped++;preserved++;continue;}
        attempted++;attemptedItems.push(item);status('正在填写 '+attempted+'：“'+item.title+'”…');
        try {
          item.written=false;
          const result=await C.fill(item.el,wanted,{hints:F.fillHints(item,wanted),isCurrent:()=>!cancelled});
          item.diagnostic={...item.diagnostic,...result.observed?.[0]};
          item.selectionMethod=result.observed?.[0]?.selectionMethod;
          item.state='confirmed';
          item.written=true;item.failed=false;item.result='已确认回显：'+C.value(item.el);
        } catch (error) {item.diagnostic={...item.diagnostic,...error.observed};item.state='failed';item.failureCode=error.code||'operation_failed';item.failed=true;item.result='填写未完成：'+error.message;}
        render();
      }
      const result=review();
      const failed=attemptedItems.filter(x=>x.failed).length;
      status((cancelled?'已停止。':'批量填写结束。')+'复核通过 '+result.passed+' 项，未完成 '+failed+' 项，跳过 '+skipped+' 项（未匹配 '+unmatched+'、简历空值 '+empty+'、保留已有值 '+preserved+'）。不会自动保存或提交。');
    } finally {lock(false);render();}
  };
  panel.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>{
    tab=button.dataset.tab;
    panel.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('on',x===button)); render();
  });
  const typeName = item => ({select:'下拉选项',cascader:'省市/级联',date:'日期',radio:'单选',checkbox:'多选','native-select':'原生下拉',contenteditable:'富文本',text:'文本'})[C.type(item.el)];
  function render() {
    const missing=fields.filter(x=>x.state==='resume_empty'||x.state==='unmatched');
    $('#xd-missing').hidden=!missingReminder||!missing.length;
    $('#xd-missing').textContent=missing.length?'待补齐 '+missing.length+' 项：'+missing.slice(0,4).map(x=>x.title).join('、')+(missing.length>4?'等。':'。'):'';
    const box=$('#xd-content');
    $('#xd-log-count').textContent=logs.length;
    if (tab==='logs') {
      box.innerHTML=logs.map(x=>'<div class="xd-log"><b>'+esc(x.method+' '+x.status)+'</b> '+esc(x.url)+'<small>'+esc(x.keys||'')+'</small></div>').join('')||'<div class="xd-mini">暂未捕获接口请求。刷新页面后可继续观察。</div>';
      return;
    }
    box.innerHTML=fields.map((item,index)=>'<div class="xd-field"><div class="xd-field-title"><span>#'+(index+1)+' '+esc(item.title)+'</span><span class="xd-mini">'+esc(typeName(item))+'</span></div><div class="xd-meta">'+esc(item.moduleTitle)+' · 第'+(item.record+1)+'条 · '+esc(C.container(item.el).id||item.el.id||'(无 ID)')+'<br>当前选中值：'+esc(C.value(item.el)||'(空)')+'</div><div class="xd-match">本地匹配：'+esc(item.match||'未匹配')+'</div>'+(item.options.length?'<div class="xd-options">候选项：\n'+esc(item.options.join(' · '))+'</div>':'')+'<div class="xd-row xd-test"><input data-value="'+index+'" placeholder="本次测试值（留空则使用简历）" value="'+esc(item.testValue||'')+'"></div>'+(item.result?'<div class="xd-result '+(item.failed?'xd-error':'')+'">'+esc(item.result)+'</div>':'')+'<div class="xd-actions"><button class="xd-btn" data-open="'+index+'" '+(busy?'disabled':'')+'>展开并记录</button><button class="xd-btn xd-primary" data-fill="'+index+'" '+(busy?'disabled':'')+'>测试填写</button></div></div>').join('')||'<div class="xd-mini">点击“扫描字段”开始。</div>';
    box.querySelectorAll('[data-value]').forEach(input=>input.oninput=()=>fields[Number(input.dataset.value)].testValue=input.value);
    box.querySelectorAll('[data-open]').forEach(button=>button.onclick=()=>perform(Number(button.dataset.open),false));
    box.querySelectorAll('[data-fill]').forEach(button=>button.onclick=()=>perform(Number(button.dataset.fill),true));
  }
  async function perform(index,filling) {
    if (busy) return;
    const item=fields[index]; if (!item) return;
    cancelled=false; lock(true); render();
    try {
      if (filling) {
        const manual=item.testValue?.trim();
        if (!manual && !resumeData) throw Error('请先加载简历，或输入本次测试值');
        if (!manual && !item.match) throw Error('没有唯一字段匹配，请输入本次测试值先调试控件');
        const wanted=manual || F.resolveResume(resumeData,item);
        item.diagnostic=valueShape(wanted,C.type(item.el));
        if (wanted==null || String(wanted).trim()==='') throw Error('简历对应字段没有值（第'+(item.record+1)+'条），可输入本次测试值');
        status('正在填写“'+item.title+'”，等待选项加载并核对回显…');
        item.written=false;
        const result=await C.fill(item.el,wanted,{hints:manual?{}:F.fillHints(item,wanted),isCurrent:()=>!cancelled});
        item.diagnostic={...item.diagnostic,...result.observed?.[0]};
        item.state='confirmed';item.failureCode=null;item.selectionMethod=result.observed?.[0]?.selectionMethod;
        item.written=true;
        item.result='已确认回显：'+C.value(item.el); item.failed=false; status(item.title+'：'+item.result);
      } else {
        status('正在展开“'+item.title+'”并等待候选项…');
        item.options=[...new Set(await C.open(item.el))].slice(0,100); item.expanded=true;
        item.result=item.options.length?'已读取 '+item.options.length+' 个候选项':'尚无候选项；搜索型控件可输入本次测试值后测试填写';
        item.failed=false; status(item.title+'：'+item.result);
      }
    } catch (error) {
      item.diagnostic={...item.diagnostic,...error.observed};
      if (filling) {item.state='failed';item.failureCode=error.code||'operation_failed';}
      item.result=(filling?'填写未完成：':'展开未完成：')+error.message; item.failed=true; status(item.title+'：'+item.result);
    } finally { lock(false); render(); }
  }
  function esc(text) {
    return String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function valueShape(value,kind) {
    // Only fixed classifications and counts leave this page in a report.
    if (value==null||String(value).trim()==='') return {valueShape:'empty'};
    const text=String(value).trim();
    if (kind==='date') return {valueShape:/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(text)?'full-date':/^\d{4}[-/.]\d{1,2}$/.test(text)?'year-month':/^\d{4}年\d{1,2}月\d{1,2}日/.test(text)?'chinese-date':'other-date'};
    if (kind==='cascader') return {valueShape:'cascade',pathDepth:Array.isArray(value)?value.length:text.split(/\s*(?:\/|>|→)\s*/).length};
    return {valueShape:Array.isArray(value)?'array':typeof value};
  }
  function controlShape(item) {
    const entry=globalThis.XiaomaiEngine.entryFor(item.el),input=entry.element||entry.elements?.[0]||item.control;
    const picker=['Wdate','laydate','datepicker','hasDatepicker'].find(token=>input?.classList.contains(token));
    return {readonly:!!input?.readOnly,disabled:!!input?.disabled,
      nativeType:['text','tel','email','number','date','month','radio','checkbox'].includes(input?.type)?input.type:'other',
      ...(picker?{pickerHint:picker}:{}),...(entry.kind==='radio'?{choiceCount:entry.elements.length}:{}),
      dateFormatHint: /yyyy.?mm.?dd/i.test(input?.getAttribute('placeholder')||'')?'date':/yyyy.?mm/i.test(input?.getAttribute('placeholder')||'')?'month':'unspecified'};
  }
  window.addEventListener('xiaomai-debug-network',event=>{
    if (!event.detail || typeof event.detail.url!=='string') return;
    logs.unshift(event.detail); logs=logs.slice(0,100); $('#xd-log-count').textContent=logs.length;
    if (tab==='logs') render();
  });
  let drag=null;
  function clampPosition() {
    const width=panel.offsetWidth||288,height=panel.offsetHeight||427;
    const rect=panel.getBoundingClientRect();
    const left=Math.min(Math.max(8,rect.left),Math.max(8,innerWidth-width-8));
    const top=Math.min(Math.max(8,rect.top),Math.max(8,innerHeight-height-8));
    if (panel.style.left || rect.right>innerWidth || rect.bottom>innerHeight) {
      panel.style.left=left+'px';panel.style.top=top+'px';panel.style.right='auto';panel.style.bottom='auto';
    }
  }
  $('#xd-drag').addEventListener('pointerdown',event=>{
    if (event.target.closest('button') || event.button!==0) return;
    const rect=panel.getBoundingClientRect();drag={x:event.clientX,y:event.clientY,left:rect.left,top:rect.top};
    event.preventDefault();$('#xd-drag').setPointerCapture?.(event.pointerId);
  });
  $('#xd-drag').addEventListener('pointermove',event=>{
    if (!drag) return;
    panel.style.left=(drag.left+event.clientX-drag.x)+'px';panel.style.top=(drag.top+event.clientY-drag.y)+'px';
    panel.style.right='auto';panel.style.bottom='auto';clampPosition();
  });
  $('#xd-drag').addEventListener('pointerup',()=>{drag=null;});
  $('#xd-drag').addEventListener('pointercancel',()=>{drag=null;});
  window.addEventListener('resize',clampPosition);
  chrome.storage.onChanged?.addListener((changes,area)=>{
    if (area!=='local') return;
    if (changes.token || changes.selectedResumeId) {
      resumeData=null;loadedResumeId='';
      if (busy) {cancelled=true;status('账号或简历已切换，正在停止本次填写。');}
    }
    if ((changes.fillMode||changes.missingReminder)&&!busy) settings().then(render).catch(()=>{});
  });
  render();
})();
