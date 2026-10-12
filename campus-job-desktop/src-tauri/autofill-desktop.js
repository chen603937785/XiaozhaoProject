/* Desktop presentation only. Matching, values and controls come from the extension. */
(function () {
  'use strict';
  const VERSION='1.3.1';
  const C=globalThis.XiaomaiControls,F=globalThis.XiaomaiFields,E=globalThis.XiaomaiEngine;
  let root,host,running=false,cancelled=false,selectedResume='',module='all',record='auto',results=[],generation=0,aiConfig=null;
  const api=window.__XIAOMAI_FILL__={version:VERSION,engine:E,fields:F,controls:C};
  const $=s=>root.querySelector(s);
  const resumes=()=>window.__RESUME_DATA__?.resumes||[];
  const resume=()=>resumes().find(r=>String(r.id)===selectedResume)||resumes().find(r=>r.isDefault)||resumes()[0]||{};
  const schema=()=>window.__RESUME_DATA__?.schema||globalThis.XiaomaiResumeSchema;
  function configure(){F.configure(schema());}
  configure();
  async function nativeInvoke(command,args){
    const invoke=window.__TAURI__?.core?.invoke||window.__TAURI_INTERNALS__?.invoke;
    if(typeof invoke!=='function')throw Error('原生通信不可用');
    return invoke(command,args);
  }
  async function checkAi(){
    if(!window.__XIAOMAI_AUTH_TOKEN__){$('#aiState').textContent='本地规则 · 登录后可使用 AI 辅助识别';return;}
    try{
      aiConfig=await nativeInvoke('autofill_ai_config',{authToken:window.__XIAOMAI_AUTH_TOKEN__});
      $('#aiState').textContent=aiConfig?.code===200&&aiConfig.data?.enabled?'AI 辅助识别已开启 · 优先使用本地规则':'本地规则识别 · AI 未开启';
    }catch(_){aiConfig=null;$('#aiState').textContent='AI 暂不可用，使用本地规则';}
  }
  async function recognize(items,current){
    if(!window.__XIAOMAI_AUTH_TOKEN__||!items.length)return;
    await checkAi();
    if(!current()||!aiConfig?.data?.enabled)return;
    const allowed=new Set((schema()?.modules||[]).flatMap(m=>(m.fields||[]).map(f=>(m.key==='evaluation'?'intention':m.key)+'.'+f.key)));
    for(let offset=0;offset<items.length&&current();offset+=80){
      const batch=items.slice(offset,offset+80);
      // Only control metadata leaves this page; resume values are resolved locally.
      const fields=batch.map(item=>({id:item.id,labels:item.labels.slice(0,10),type:C.type(item.el),module:item.module||module,options:(item.options||[]).slice(0,40)}));
      try{
        const reply=await nativeInvoke('autofill_ai_analyze',{authToken:window.__XIAOMAI_AUTH_TOKEN__,fields});
        if(!current())return;
        if(reply?.code!==200||!Array.isArray(reply.data?.matches)){ $('#aiState').textContent='AI 未返回有效匹配，继续使用本地规则';continue; }
        for(const m of reply.data.matches){
          const item=batch.find(x=>x.id===m.id),key=String(m.field||'');
          if(item&&allowed.has(key)&&Number(m.confidence)>=.72&&(!item.module||key.startsWith(item.module+'.')))item.match=key;
        }
      }catch(_){$('#aiState').textContent='AI 暂不可用，继续使用本地规则';}
    }
  }
  // Custom selectors stay in shadow DOM, so the page scanner cannot scan the panel.
  const selectors=new Map();
  function closeMenus(){for(const s of selectors.values()){s.list.hidden=true;s.button.setAttribute('aria-expanded','false');}}
  function selector(id,label,onChange){
    const box=document.createElement('div');box.className='selector';
    const caption=document.createElement('span');caption.className='caption';caption.textContent=label;
    const button=document.createElement('button');button.id=id;button.className='select-trigger';button.type='button';button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-expanded','false');button.setAttribute('aria-label',label);
    const name=document.createElement('span');const arrow=document.createElement('span');arrow.textContent='⌄';arrow.className='arrow';button.append(name,arrow);
    const list=document.createElement('div');list.className='select-menu';list.setAttribute('role','listbox');list.setAttribute('aria-label',label);list.hidden=true;box.append(caption,button,list);
    const state={box,button,list,name,value:'',rows:[],set(rows,value){
      this.rows=rows;this.value=String(value);name.textContent=rows.find(x=>String(x.value)===this.value)?.label||'暂无可选项';list.replaceChildren();
      for(const row of rows){const option=document.createElement('button');option.type='button';option.setAttribute('role','option');option.setAttribute('aria-selected',String(String(row.value)===this.value));option.textContent=row.label;option.onclick=()=>{closeMenus();onChange(String(row.value));};list.append(option);}
      button.disabled=running||!rows.length;
    }};
    button.onclick=()=>{const opening=list.hidden;closeMenus();if(opening){list.hidden=false;button.setAttribute('aria-expanded','true');list.querySelector('[aria-selected="true"]')?.focus();}clamp();};
    box.onkeydown=e=>{if(e.key==='Escape'){closeMenus();button.focus();}if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();if(list.hidden)button.click();else{const options=[...list.children],i=options.indexOf(root.activeElement);options[(i+(e.key==='ArrowDown'?1:-1)+options.length)%options.length]?.focus();}}};
    selectors.set(id,state);return box;
  }
  function options(){
    selectedResume=String(resume().id||'');
    selectors.get('resume').set(resumes().map(r=>({value:r.id,label:r.resumeName||'未命名简历'})),selectedResume);
    const modules=(schema()?.modules||[]).filter(m=>m.key!=='evaluation').map(m=>({value:m.key,label:m.title}));
    if(!modules.some(m=>m.value===module)&&module!=='all')module='all';
    selectors.get('module').set([{value:'all',label:'全部模块 · 按网页分组'},...modules],module);
    const rows=resume()[module];
    selectors.get('record').box.hidden=!Array.isArray(rows);
    if(!Array.isArray(rows)||Number(record)>=rows.length)record='auto';
    selectors.get('record').set([{value:'auto',label:'按网页经历顺序匹配'},...(Array.isArray(rows)?rows:[]).map((r,i)=>({value:i,label:'第'+(i+1)+'条 · '+(r.schoolName||r.companyName||r.projectName||r.organizationName||r.awardName||r.skillName||r.language||r.name||'经历')}))],record);
    if(!running)$('#message').textContent=resumes().length?'先展开网页简历模块，再填写；默认保留网页已有内容。':'暂无简历，请在客户端简历管理完善资料。';
  }
  function lock(active){
    running=active;closeMenus();for(const s of selectors.values())s.button.disabled=active||!s.rows.length;
    for(const id of ['start','overwrite','confirmYes','edit'])$('#'+id).disabled=active;
    $('#stop').hidden=!active;$('#progress').hidden=!active;clamp();
  }
  function progress(done,total){
    $('#progress').setAttribute('aria-valuenow',String(done));$('#progress').setAttribute('aria-valuemax',String(total));
    $('#progressText').textContent='填写进度 '+done+'/'+total;
    $('#progressBar').style.width=(total?done/total*100:0)+'%';
  }
  function hasValue(item){
    const entry=E.entryFor(item.el);
    if(['custom-select','cascader'].includes(entry.controlKind))return globalThis.ResumeProCustomControls.hasExistingValue(entry);
    const target=entry.element||item.el;
    if(target.tagName==='SELECT')return !!target.value&&!/^(请选择|please select|select an option)/i.test(target.selectedOptions[0]?.textContent.trim()||'');
    return !!C.value(item.el);
  }
  function report(){
    const passed=results.filter(x=>x.state==='confirmed').length,failed=results.filter(x=>x.state==='failed').length;
    const preserved=results.filter(x=>x.state==='preserved').length,empty=results.filter(x=>x.state==='resume_empty').length,unmatched=results.filter(x=>x.state==='unmatched').length;
    $('#message').textContent=(cancelled?'已停止':'填写完成')+'：成功 '+passed+' 项，未完成 '+failed+' 项，保留 '+preserved+' 项，资料缺失 '+empty+' 项，未匹配 '+unmatched+' 项。';
    $('#checkNote').hidden=false;$('#checkNote').textContent='请逐项核对填写结果，确认无误后再手动保存或提交。';
    $('#results').replaceChildren();
    for(const item of results.filter(x=>x.state!=='preserved')){
      const b=document.createElement('button');b.className='result '+(item.state==='confirmed'?'success':'');b.textContent=item.title+' · '+item.note;
      b.onclick=()=>{if(!item.el.isConnected){$('#message').textContent='网页字段已更新，请重新填写。';return;}item.el.scrollIntoView({behavior:'smooth',block:'center'});const old=item.el.style.outline;item.el.style.outline='2px solid #3286ee';setTimeout(()=>item.el.style.outline=old,1600);};$('#results').append(b);
    }
    clamp();
  }
  async function fill(overwrite=false){
    if(running)return;
    if(!resumes().length){$('#message').textContent='请先在客户端登录并完善简历资料。';return;}
    cancelled=false;const stamp=generation,current=()=>!cancelled&&stamp===generation;
    results=[];$('#confirm').hidden=true;$('#results').replaceChildren();$('#checkNote').hidden=true;lock(true);
    let done=0,total=0;
    try{
      configure();let items=F.scan();
      if(module!=='all')items=items.filter(item=>(item.match?.split('.')[0]||item.module)===module);
      total=items.length;progress(0,total);
      if(!total){$('#message').textContent='未发现可填写字段，请先展开网页简历模块。';return;}
      if(record!=='auto'&&new Set(items.map(x=>x.record)).size>1){$('#message').textContent='网页展示了多条经历，请选择“按网页经历顺序匹配”，或仅展开一条经历再指定资料。';return;}
      if(record!=='auto')for(const item of items)item.record=Number(record);
      const data={resumes:[resume()]};$('#message').textContent='已识别 '+total+' 个字段，正在准备填写…';
      await recognize(items.filter(item=>!item.match),current);
      for(const item of items){
        if(!current())break;
        results.push(item);
        try{
          if(!item.match){item.state='unmatched';item.note='未找到唯一字段匹配';continue;}
          const wanted=F.resolveResume(data,item);
          if(wanted==null||String(wanted).trim()===''){item.state='resume_empty';item.note='简历对应资料为空';continue;}
          if(!overwrite&&hasValue(item)){item.state='preserved';item.note='保留已有内容';continue;}
          $('#message').textContent='正在填写：'+item.title;
          await C.fill(item.el,wanted,{hints:F.fillHints(item,wanted),isCurrent:current});
          item.written=true;item.state='confirmed';item.note='已填写，待核对';
        }catch(error){item.state='failed';item.note=error.message||'控件未完成填写';item.failureCode=error.code||'operation_failed';}
        finally{progress(++done,total);}
      }
      // A later field may cause the page to rerender or reset an earlier value.
      for(const item of results.filter(x=>x.written)){
        const verdict=C.check(item.el);
        if(verdict&&!verdict.ok){item.state='failed';item.note='复核未通过：'+verdict.message;item.failureCode=verdict.reason;}
      }
      report();
    }catch(error){$('#message').textContent='填写未完成：'+(error.message||'请重新尝试');$('#checkNote').hidden=false;}
    finally{lock(false);if(stamp!==generation)options();}
  }
  function clamp(){
    const rect=host.getBoundingClientRect();host.style.left=Math.max(8,Math.min(innerWidth-rect.width-8,rect.left))+'px';host.style.top=Math.max(8,Math.min(innerHeight-rect.height-8,rect.top))+'px';host.style.right='auto';host.style.transform='none';
  }
  function drag(handle){
    let start,moved=false;
    handle.addEventListener('pointerdown',e=>{
      if(e.target.closest('button')&&e.target!==handle)return;
      if(e.button!==0)return;const rect=host.getBoundingClientRect();start={x:e.clientX,y:e.clientY,left:rect.left,top:rect.top};moved=false;handle.setPointerCapture?.(e.pointerId);
    });
    handle.addEventListener('pointermove',e=>{if(!start)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;if(Math.abs(dx)+Math.abs(dy)>4)moved=true;if(!moved)return;host.style.left=start.left+dx+'px';host.style.top=start.top+dy+'px';host.style.right='auto';host.style.transform='none';clamp();});
    handle.addEventListener('pointerup',()=>{start=null;});handle.addEventListener('pointercancel',()=>{start=null;});
    handle.addEventListener('click',e=>{if(moved){e.preventDefault();e.stopImmediatePropagation();moved=false;}},true);
  }
  function show(open){closeMenus();$('.shell').hidden=!open;$('#bubble').hidden=open;clamp();}
  function mount(){
    if(host||!document.body)return;
    host=document.createElement('div');host.id='xiaomai-autofill';host.style.cssText='position:fixed;right:20px;top:50%;transform:translateY(-50%);z-index:2147483646';document.body.append(host);root=host.attachShadow({mode:'open'});
    root.innerHTML=`<style>
      :host{all:initial}*{box-sizing:border-box}button{font:inherit;cursor:pointer;border:0}button:disabled{opacity:.5;cursor:default}[hidden]{display:none!important}
      .shell{font:13px/1.6 -apple-system,"Microsoft YaHei",sans-serif;color:#28435f;width:310px;background:white;border:1px solid #dce8fa;border-radius:18px;box-shadow:0 12px 40px #173b6330;overflow:hidden;max-width:calc(100vw - 16px)}
      header{padding:13px 16px;background:linear-gradient(135deg,#e4f0ff,#f8fbff);display:flex;align-items:center;justify-content:space-between;cursor:move;touch-action:none;font-weight:650}header button{background:none;color:#6c86a5;font-size:12px}
      .body{padding:14px 16px;max-height:calc(100vh - 76px);overflow:auto}.selector{margin-bottom:11px}.caption{display:block;font-size:12px;color:#70849d;margin-bottom:5px}
      .select-trigger{display:flex;width:100%;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;border:1px solid #dce7f7;border-radius:11px;background:linear-gradient(135deg,#f5f9ff,#fff);color:#304e70;text-align:left;min-height:41px}.select-trigger>span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.select-trigger[aria-expanded=true]{border-color:#77a8f6;box-shadow:0 0 0 3px #edf4ff}.arrow{color:#6d91c0}.select-menu{border:1px solid #deE8f8;border-radius:11px;box-shadow:0 6px 18px #25487815;margin-top:5px;max-height:168px;overflow:auto;padding:4px;background:white}.select-menu button{display:block;width:100%;text-align:left;padding:8px 10px;border-radius:7px;background:white;color:#3f5674;font-size:12px}.select-menu button:hover,.select-menu button:focus-visible{background:#f0f6ff;outline:2px solid #aecafa}.select-menu button[aria-selected=true]{background:#e9f2ff;color:#1764ff;font-weight:600}
      .primary{width:100%;padding:11px;border-radius:12px;background:linear-gradient(110deg,#1764ff,#4799f4);color:white;margin:6px 0;font-weight:600}.secondary{padding:7px 11px;background:#edf5ff;color:#2875d1;border-radius:9px;margin:4px 0;font-size:12px}.actions,.confirm-actions{display:flex;gap:8px;align-items:center}.confirm-actions button{flex:1}.confirm-actions .confirm-yes{background:#3286ee;color:white}
      #message{color:#6c819b;font-size:12px;margin:10px 0;line-height:1.7}#aiState{color:#3286ee;font-size:11px;margin:3px 0 8px}#results{max-height:170px;overflow:auto}.result{text-align:left;width:100%;padding:8px 10px;background:#fff7ee;border-radius:8px;margin-top:5px;color:#98754a;font-size:11px}.result.success{background:#f0f8f5;color:#448770}#confirm{padding:11px;background:#fff6ea;border:1px solid #ffe4bd;border-radius:11px;font-size:12px;margin:8px 0;color:#956b35}#checkNote{font-size:12px;padding:9px 11px;background:#eef6ff;color:#226bc0;border-radius:9px;font-weight:600}
      #progress{margin:10px 0 5px;width:100%}#progressText{display:block;font-size:12px;color:#3774bf;margin-bottom:6px;font-variant-numeric:tabular-nums}.track{height:8px;border-radius:8px;background:#e9f0fa;overflow:hidden}#progressBar{height:100%;width:0;background:linear-gradient(90deg,#1764ff,#56c6f9,#9274fa,#1764ff);background-size:220% 100%;animation:flow 1.8s linear infinite;border-radius:8px;transition:width .2s ease}@keyframes flow{to{background-position:220% 0}}@media(prefers-reduced-motion:reduce){#progressBar{animation:none;transition:none}}
      footer{display:flex;align-items:center;justify-content:space-between;color:#9badc1;font-size:10px;padding-top:8px}#bubble{background:linear-gradient(120deg,#1764ff,#4392ed);color:white;border-radius:25px;padding:11px 17px;box-shadow:0 5px 20px #3286ee40;font:13px/1.5 -apple-system,"Microsoft YaHei",sans-serif;touch-action:none;cursor:grab;white-space:nowrap}
      </style><button id="bubble" title="点击展开，可拖动">小麦填表插件</button><section class="shell" hidden><header><span>小麦填表插件</span><button id="collapse">收起</button></header><div class="body"><div id="selectors"></div><div id="aiState">正在检查 AI 配置…</div><button id="start" class="primary">一键填写空白项</button><div id="progress" role="progressbar" aria-label="字段填写进度" aria-valuemin="0" hidden><span id="progressText">填写进度 0/0</span><div class="track"><div id="progressBar"></div></div></div><div class="actions"><button id="overwrite" class="secondary">覆盖重填</button><button id="stop" class="secondary" hidden>停止填写</button></div><div id="confirm" hidden>将覆盖匹配字段的已有内容，请确认。<div class="confirm-actions"><button id="confirmYes" class="secondary confirm-yes">确认覆盖</button><button id="confirmNo" class="secondary">取消</button></div></div><div id="message" role="status"></div><div id="checkNote" hidden>请核对已填写内容后再手动保存或提交。</div><div id="results"></div><footer><button id="edit" class="secondary">完善简历资料</button><span>引擎 ${VERSION}</span></footer></div></section>`;
    $('#selectors').append(selector('resume','当前简历',value=>{selectedResume=value;record='auto';options();}),selector('module','填写模块',value=>{module=value;record='auto';options();}),selector('record','经历资料',value=>{record=value;options();}));
    root.addEventListener('click',e=>{if(!e.target.closest('.selector'))closeMenus();});
    $('#start').onclick=()=>fill();$('#overwrite').onclick=()=>{$('#confirm').hidden=false;clamp();};$('#confirmYes').onclick=()=>fill(true);$('#confirmNo').onclick=()=>{$('#confirm').hidden=true;clamp();};
    $('#stop').onclick=()=>{cancelled=true;$('#message').textContent='正在停止，已完成的字段将保留并复核。';};
    $('#edit').onclick=()=>{location.href='xiaomai://resume';};$('#collapse').onclick=()=>show(false);$('#bubble').onclick=()=>show(true);
    drag($('header'));drag($('#bubble'));window.addEventListener('resize',clamp);options();checkAi();
  }
  api.fill=fill;api.scan=()=>F.scan();api.getResults=()=>results;
  window.addEventListener('xiaomai-resume-updated',()=>{cancelled=true;generation++;configure();record='auto';if(root){if(!running)options();else $('#message').textContent='简历资料已更新，正在停止当前填写，请重新开始。';}});
  // Keep external navigation inside the current child webview as before.
  document.addEventListener('click',e=>{const a=e.target.closest?.('a[target="_blank"]');if(a&&/^https?:/.test(a.href)){e.preventDefault();location.href=a.href;}},true);
  window.open=url=>{if(url){try{const u=new URL(String(url),location.href);if(/^https?:$/.test(u.protocol))location.href=u.href;}catch(_){}}return null;};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
