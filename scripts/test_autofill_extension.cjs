/* Run with Node 16+ and jsdom 22: NODE_PATH=<jsdom node_modules> node scripts/test_autofill_extension.cjs */
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {JSDOM} = require('jsdom');
const extension = path.resolve(__dirname,'../autofill-extension');
const source = name => fs.readFileSync(path.join(extension,name),'utf8');
const tests = [];
const test = (name,run) => tests.push({name,run});
test('独立悬浮框一键准备、使用选中简历、记住覆盖方式，账号变化清除缓存',async()=>{
  const p=page(moduleHtml('基本信息',field('姓名','<input id="name" value="原姓名">')+field('邮箱','<input id="email">')));
  try {
    let onMessage,onStorage;const settings={selectedResumeId:'2',fillMode:'preserve',missingReminder:true},paths=[];
    p.w.chrome={runtime:{lastError:null,onMessage:{addListener:fn=>onMessage=fn},sendMessage:(m,cb)=>{
      paths.push(m.path);
      const replies={session:{loggedIn:true},'/api/resumes':{code:200,data:[{id:1,isDefault:true},{id:2,resumeName:'选中简历'}]},'/api/resumes/2':{code:200,data:{profile:{chineseName:'选中姓名',email:'selected@example.test'}}}};
      cb({ok:true,data:replies[m.path]||{code:404}});
    }},storage:{local:{get:async()=>settings,set:async()=>{}},onChanged:{addListener:fn=>onStorage=fn}}};
    p.w.eval(source('content.js'));await new Promise(r=>setImmediate(r));
    assert.equal(p.find('.xd-shell').hidden,true);
    await p.find('#xd-fill-now').onclick();
    assert.equal(p.find('#name').value,'原姓名');assert.equal(p.find('#email').value,'selected@example.test');
    assert(!paths.includes('/api/resumes/1'));assert.match(p.find('#xd-resume-caption').textContent,/选中简历/);
    settings.fillMode='overwrite';await p.find('#xd-fill-now').onclick();assert.equal(p.find('#name').value,'选中姓名');
    onMessage({type:'xiaomai-panel-command',command:'show'},{},()=>{});
    await new Promise(r=>setImmediate(r));
    p.find('#xd-close').onclick();assert.equal(p.find('.xd-shell').hidden,true);
    onStorage({token:{newValue:'new-account'}},'local');
    const before=paths.filter(x=>x==='/api/resumes/2').length;
    await p.find('#xd-fill-now').onclick();assert.equal(paths.filter(x=>x==='/api/resumes/2').length,before+1);
  } finally {p.dom.window.close();}
});
function page(html) {
  const dom = new JSDOM(html,{url:'https://example.test/resume',runScripts:'outside-only'});
  const w=dom.window;
  w.HTMLElement.prototype.getClientRects=function () {
    for (let e=this;e;e=e.parentElement) if (e.hidden || e.style.display==='none') return [];
    return this.isConnected ? [{width:100,height:30}] : [];
  };
  w.SVGElement.prototype.getClientRects=w.HTMLElement.prototype.getClientRects;
  w.HTMLElement.prototype.scrollIntoView=function () {};
  for (const name of JSON.parse(source('manifest.json')).content_scripts[1].js.filter(x=>x!=='content.js')) w.eval(source(name));
  return {w,dom,C:w.XiaomaiControls,F:w.XiaomaiFields,find:s=>w.document.querySelector(s)};
}
const field = (label,control,record=0) => `<div class="resume-form-item" id="set_11-record_${record}-item_11_36"><div class="resume-form-title">*${label}</div><div class="field-item-wrap">${control}</div></div>`;
const moduleHtml = (name,children) => `<div class="resume-tpl-wrap"><div class="resume-edit-title"><div class="title-txt">${name}</div></div>${children}</div>`;
const select = (id='school') => `<div class="ant-select ant-select-show-search"><div class="ant-select-selector"><span class="ant-select-selection-item"></span><input id="${id}" role="combobox" aria-controls="${id}-list" aria-expanded="false"></div></div>`;
function dropdown(p,id,labels,onSelect) {
  let root=p.w.document.getElementById(id+'-popup');
  if (!root) {root=p.w.document.createElement('div');root.id=id+'-popup';root.className='ant-select-dropdown';p.w.document.body.appendChild(root);}
  root.hidden=false;
  root.innerHTML=`<div id="${id}-list" role="listbox">${labels.map(text=>`<div class="ant-select-item-option" role="option"><span class="ant-select-item-option-content">${text}</span></div>`).join('')}</div>`;
  root.querySelectorAll('.ant-select-item-option').forEach(option=>option.onclick=()=>onSelect?.(option.textContent,root));
  return root;
}
test('外层字段、组件外壳、搜索输入框归一；不扫描自己的面板',()=>{
  const p=page(moduleHtml('教育经历',field('学校名称',select())+field('专业','<input id="major">',1))+'<div id="xiaomai-debug-panel"><input placeholder="手机号"></div>');
  try {
    const fields=p.F.scan(); assert.equal(fields.length,2);
    assert.equal(fields[0].el,p.find('.ant-select')); assert.equal(p.C.type(fields[0].el),'select');
    assert.equal(fields[0].match,'education.schoolName'); assert.equal(fields[1].match,'education.major');
    assert.equal(fields[1].record,1); assert.equal(p.C.widget(p.find('#school')),p.find('.ant-select'));
  } finally {p.dom.window.close();}
});
test('相同开始日期按教育、工作、项目模块匹配；无模块时不猜',()=>{
  const p=page(['教育经历','工作经历','项目经历'].map(name=>moduleHtml(name,field('开始日期','<input>'))).join('')+field('开始日期','<input>'));
  try {assert.deepEqual(Array.from(p.F.scan(),x=>x.match),['education.startDate','experience.startDate','project.startDate','']);}
  finally {p.dom.window.close();}
});
test('第二段经历缺失时不复制第一段简历',()=>{
  const p=page('');
  try {const data={resumes:[{isDefault:true,education:[{schoolName:'测试学校'}],targetPosition:'测试岗位'}]};
    assert.equal(p.F.readResume(data,'education.schoolName',0),'测试学校');
    assert.equal(p.F.readResume(data,'education.schoolName',1),null);
    assert.equal(p.F.readResume(data,'intention.targetPosition',0),'测试岗位');}
  finally {p.dom.window.close();}
});
test('学校搜索异步返回（650ms）后点击真实选项，页面保存选项编码',async()=>{
  const p=page(moduleHtml('教育经历',field('学校名称',select())));
  try {
    const input=p.find('#school'),label=p.find('.ant-select-selection-item');let chosenCode='';
    input.onfocus=()=>{input.setAttribute('aria-expanded','true');dropdown(p,'school',[]);};
    input.oninput=()=>p.w.setTimeout(()=>dropdown(p,'school',['测试大学'],(text,root)=>{
      label.textContent=text;label.title=text;chosenCode='school-1001';input.value='';root.hidden=true;
    }),650);
    const result=await p.C.fill(p.F.scan()[0].el,'测试大学');
    assert.equal(result.ok,true);assert.equal(chosenCode,'school-1001');assert.equal(p.C.value(p.find('.ant-select')),'测试大学');
  } finally {p.dom.window.close();}
});
test('字典聚焦加载（600ms）及本科/大学本科别名',async()=>{
  const p=page(field('学历',select('degree')));
  try {
    const input=p.find('#degree');input.readOnly=true;
    input.onfocus=()=>p.w.setTimeout(()=>dropdown(p,'degree',['大学本科'],(text,root)=>{
      p.find('.ant-select-selection-item').textContent=text;root.hidden=true;
    }),600);
    assert.equal((await p.C.fill(p.find('.ant-select'),'本科')).ok,true);
    assert.equal(p.C.value(p.find('.ant-select')),'大学本科');
  } finally {p.dom.window.close();}
});
test('先等待焦点字典加载并选择，不能用简历别名提前过滤掉真实选项',async()=>{
  const p=page(field('性别',select('gender')));
  try {
    const input=p.find('#gender');let searches=0;
    input.onfocus=()=>{input.setAttribute('aria-expanded','true');dropdown(p,'gender',[]);
      p.w.setTimeout(()=>dropdown(p,'gender',input.value?[]:['男'],(text,root)=>{
        p.find('.ant-select-selection-item').textContent=text;input.value='';root.hidden=true;
      }),700);
    };
    input.oninput=()=>{searches++;};
    assert.equal((await p.C.fill(p.F.scan()[0].el,'男性')).ok,true);
    assert.equal(searches,0);assert.equal(p.C.value(p.find('.ant-select')),'男');
  } finally {p.dom.window.close();}
});
test('AntD loading 标识未结束前，不搜索或读取旧候选项',async()=>{
  const p=page(field('性别',select('gender')));
  try {
    const input=p.find('#gender'),widget=p.find('.ant-select');let searches=0;
    input.onfocus=()=>{input.setAttribute('aria-expanded','true');widget.classList.add('ant-select-loading');dropdown(p,'gender',[]);
      p.w.setTimeout(()=>{widget.classList.remove('ant-select-loading');dropdown(p,'gender',['男'],(text,root)=>{
        p.find('.ant-select-selection-item').textContent=text;input.value='';root.hidden=true;
      });},1750);
    };
    input.oninput=()=>{searches++;};
    assert.equal((await p.C.fill(p.F.scan()[0].el,'男性')).ok,true);assert.equal(searches,0);
  } finally {p.dom.window.close();}
});
test('长下拉先滚动读取虚拟候选项，找到目标不输入搜索词',async()=>{
  const p=page(field('民族',select('ethnicity')));
  try {
    const input=p.find('#ethnicity');let searches=0,chosen='';
    input.onfocus=()=>{
      input.setAttribute('aria-expanded','true');const popup=dropdown(p,'ethnicity',[]);
      popup.innerHTML='<div id="ethnicity-list" class="rc-virtual-list-holder"></div>';const holder=popup.firstChild;
      Object.defineProperties(holder,{clientHeight:{value:120},scrollHeight:{value:600}});
      const render=()=>{
        const text=holder.scrollTop>=240?'汉族':'其他民族';
        holder.innerHTML=`<div class="ant-select-item-option"><span class="ant-select-item-option-content">${text}</span></div>`;
        holder.firstChild.onclick=()=>{chosen=text;p.find('.ant-select-selection-item').textContent=text;popup.hidden=true;};
      };
      holder.onscroll=render;render();
    };
    input.oninput=()=>{searches++;};
    assert.equal((await p.C.fill(p.F.scan()[0].el,'汉族')).ok,true);assert.equal(chosen,'汉族');assert.equal(searches,0);
  } finally {p.dom.window.close();}
});
test('树形专业先展开分类再选真实叶子，不将分类标题当选中值',async()=>{
  const p=page(moduleHtml('教育经历',field('专业',select('major').replace('ant-select ant-select-show-search','ant-select ant-tree-select ant-select-show-search'))));
  try {
    const input=p.find('#major');let chosen='';
    input.onfocus=()=>{
      input.setAttribute('aria-expanded','true');const popup=dropdown(p,'major',[]);
      popup.innerHTML='<div id="major-list" class="ant-select-tree"><div class="ant-select-tree-treenode"><span class="ant-select-tree-switcher ant-select-tree-switcher_close"></span><span class="ant-select-tree-node-content-wrapper"><span class="ant-select-tree-title">工学</span></span></div></div>';
      const parent=popup.querySelector('.ant-select-tree-treenode');
      parent.querySelector('.ant-select-tree-switcher').onclick=()=>{
        parent.querySelector('.ant-select-tree-switcher').className='ant-select-tree-switcher ant-select-tree-switcher_open';
        if(popup.querySelector('[data-leaf]'))return;
        const leaf=p.w.document.createElement('div');leaf.className='ant-select-tree-treenode';leaf.dataset.leaf='1';
        leaf.innerHTML='<span class="ant-select-tree-switcher ant-select-tree-switcher-noop"></span><span class="ant-select-tree-node-content-wrapper"><span class="ant-select-tree-title">软件工程</span></span>';
        leaf.querySelector('.ant-select-tree-node-content-wrapper').onclick=()=>{chosen='major-001';p.find('.ant-select-selection-item').textContent='软件工程';popup.hidden=true;};popup.firstChild.appendChild(leaf);
      };
    };
    assert.equal((await p.C.fill(p.F.scan()[0].el,'软件工程')).ok,true);assert.equal(chosen,'major-001');
  } finally {p.dom.window.close();}
});
test('重复同名候选项拒绝猜选',async()=>{
  const p=page(field('学校',select()));
  try {p.find('#school').onfocus=()=>dropdown(p,'school',['测试大学','测试大学']);
    await assert.rejects(p.C.fill(p.find('.ant-select'),'测试大学'),/多个同名/);}
  finally {p.dom.window.close();}
});
test('光大普通字典无匹配时不搜索；学校才允许远程搜索',async()=>{
  const p=page(field('性别',select('gender'))+moduleHtml('教育经历',field('学校名称',select('school'))));
  p.dom.reconfigure({url:'https://eoap.cebbank.com/uiap/wt/CEB/zpzh/resumeEdit'});
  try {
    let searches=0;
    p.find('#gender').onfocus=()=>dropdown(p,'gender',['男','女']);
    p.find('#gender').oninput=()=>{searches++;};
    await assert.rejects(p.C.fill(p.find('#gender'),'未知'),/匹配/);assert.equal(searches,0);
    p.find('#school').onfocus=()=>{p.find('#gender-popup').hidden=true;dropdown(p,'school',[]);};
    p.find('#school').oninput=()=>p.w.setTimeout(()=>dropdown(p,'school',['测试大学'],(text,root)=>{
      p.find('#school').closest('.ant-select').querySelector('.ant-select-selection-item').textContent=text;
      p.find('#school').value='';root.hidden=true;
    }),500);
    assert.equal((await p.C.fill(p.find('#school'),'测试大学')).ok,true);
  } finally {p.dom.window.close();}
});
test('点击候选项后若只有搜索词且无选中值，不能报成功',async()=>{
  const p=page(field('学校',select()));
  try {p.find('#school').onfocus=()=>dropdown(p,'school',['测试大学']);
    await assert.rejects(p.C.fill(p.find('.ant-select'),'测试大学'),/未确认选中值/);}
  finally {p.dom.window.close();}
});
test('省市级联逐列选择，等待下一列异步加载',async()=>{
  const p=page(field('籍贯','<div class="ant-cascader"><span class="ant-select-selection-item"></span><input readonly aria-controls="city-list"></div>'));
  try {
    const root=p.w.document.createElement('div');root.className='ant-cascader-dropdown';root.id='city-list';root.hidden=true;
    root.innerHTML='<ul class="ant-cascader-menu"><li class="ant-cascader-menu-item">测试省</li></ul>';p.w.document.body.appendChild(root);
    p.find('input').onfocus=()=>{root.hidden=false;};
    root.querySelector('li').onclick=()=>p.w.setTimeout(()=>{
      const column=p.w.document.createElement('ul');column.className='ant-cascader-menu';column.innerHTML='<li class="ant-cascader-menu-item">测试市</li>';root.appendChild(column);
      column.querySelector('li').onclick=()=>{p.find('input').value='测试省 / 测试市';p.find('.ant-select-selection-item').textContent='测试省 / 测试市';root.hidden=true;};
    },400);
    assert.equal((await p.C.fill(p.find('.ant-cascader'),'测试省/测试市')).ok,true);
  } finally {p.dom.window.close();}
});
test('日期禁止按同一天数选错月份',async()=>{
  const p=page(field('出生日期','<div class="ant-picker"><input readonly aria-controls="date-popup"></div>'));
  try {let clicked=false;const root=p.w.document.createElement('div');root.className='ant-picker-dropdown';root.id='date-popup';root.hidden=true;
    root.innerHTML='<div class="ant-picker-cell" title="2025-09-10">10</div>';p.w.document.body.appendChild(root);
    root.firstChild.onclick=()=>{clicked=true;};p.find('input').onfocus=()=>{root.hidden=false;};
    await assert.rejects(p.C.fill(p.find('.ant-picker'),'2000-01-10'),/不支持|未|超时|匹配/);assert.equal(clicked,false);
  } finally {p.dom.window.close();}
});
test('单选、多选按中文标签选择；没有匹配时保持原状',async()=>{
  const p=page(field('性别','<div class="ant-radio-group"><label><input name="gender" type="radio" value="1">男</label><label><input name="gender" type="radio" value="2">女</label></div>')+field('技能','<div class="ant-checkbox-group"><label><input type="checkbox" value="a">Java</label><label><input type="checkbox" value="b">SQL</label></div>'));
  try {assert.equal((await p.C.fill(p.find('.ant-radio-group'),'女')).ok,true);assert.equal(p.find('input[value="2"]').checked,true);
    assert.equal((await p.C.fill(p.find('.ant-checkbox-group'),['SQL'])).ok,true);assert.equal(p.find('input[value="a"]').checked,false);
    await assert.rejects(p.C.fill(p.find('.ant-checkbox-group'),'不存在'),/唯一匹配/);assert.equal(p.find('input[value="a"]').checked,false);}
  finally {p.dom.window.close();}
});
test('原生输入和下拉触发事件；页面重置输入时提示失败',async()=>{
  const p=page(field('姓名','<input id="name">')+field('学历','<select><option value="">请选择</option><option value="code1">大学本科</option></select>'));
  try {assert.equal((await p.C.fill(p.find('#name'),'测试姓名')).ok,true);
    assert.equal((await p.C.fill(p.find('select'),'本科')).ok,true);assert.equal(p.find('select').value,'code1');
    p.find('#name').onchange=()=>p.w.setTimeout(()=>{p.find('#name').value='';},100);
    await assert.rejects(p.C.fill(p.find('#name'),'测试姓名'),/重置/);}
  finally {p.dom.window.close();}
});
test('面板展示真实错误、手工测试、收起后恢复，并且不重复扫描面板',async()=>{
  const p=page(field('姓名','<input id="name">'));
  try {
    let onMessage;
    p.w.chrome={runtime:{lastError:null,sendMessage:(message,callback)=>callback({ok:true,data:{loggedIn:false}}),onMessage:{addListener:fn=>onMessage=fn}},storage:{local:{set:async()=>{}}}};
    p.w.eval(source('content.js'));
    p.find('#xd-scan').onclick();assert.equal(p.find('#xd-count').textContent,'1');
    await p.find('[data-fill]').onclick();assert.match(p.find('.xd-result').textContent,/先加载简历/);
    const input=p.find('[data-value]');input.value='测试姓名';input.oninput();
    await p.find('[data-fill]').onclick();assert.equal(p.find('#name').value,'测试姓名');assert.match(p.find('.xd-result').textContent,/已确认回显/);
    onMessage({type:'xiaomai-panel-command',command:'show'},{},()=>{});assert.equal(p.find('.xd-shell').hidden,false);
    p.find('#xd-close').onclick();assert.equal(p.find('.xd-shell').hidden,true);
    onMessage({type:'xiaomai-panel-command',command:'show'},{},()=>{});assert.equal(p.find('.xd-shell').hidden,false);
    assert.equal(p.F.scan().length,1);
  } finally {p.dom.window.close();}
});
test('登录凭证由后台保存，面板仅收到登录成功；工具栏补注入全部依赖',async()=>{
  let listener,result,stored={},injections=[],injected=false;
  const sandbox={chrome:{runtime:{id:'test',getURL:rel=>'chrome-extension://test/'+rel,onMessage:{addListener:fn=>listener=fn}},storage:{local:{get:async()=>stored,set:async x=>Object.assign(stored,x),remove:async keys=>keys.forEach(k=>delete stored[k])}},tabs:{sendMessage:async()=>{if(!injected)throw Error('not loaded');return {visible:true};}},scripting:{insertCSS:async()=>{},executeScript:async x=>{injections.push(x);injected=true;}}},AbortSignal:{timeout:()=>undefined},fetch:async()=>({ok:true,status:200,json:async()=>({code:200,data:{token:'test-token'}})})};
  vm.runInNewContext(source('background.js'),sandbox);
  listener({type:'xiaomai-api',path:'/api/auth/password-login',method:'POST',body:{phone:'13800000000',password:'test-only'}},{id:'test'},x=>{result=x;});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(stored.token,'test-token');assert.equal(result.data.data.token,undefined);assert.equal(result.data.data.loggedIn,true);
  listener({type:'xiaomai-page-command',tabId:1,command:'show'},{id:'test',url:'chrome-extension://test/popup.html'},x=>{result=x;});await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(Array.from(injections[1].files),JSON.parse(source('manifest.json')).content_scripts[1].js);assert.equal(injections[0].world,'MAIN');assert.equal(result.data.visible,true);
  listener({type:'xiaomai-page-command',tabId:1,command:'show'},{id:'test',url:'https://example.test'},x=>{result=x;});await new Promise(resolve=>setImmediate(resolve));assert.equal(result.ok,false);
  assert.equal(JSON.parse(source('manifest.json')).action.default_popup,'popup.html');
});
test('批量保留已有值、填空字段，并复核；显式允许覆盖后可替换',async()=>{
  const p=page(moduleHtml('基本信息',field('姓名','<input id="name" value="保留原名">')+field('邮箱','<input id="email">')));
  try {
    const data={resumes:[{isDefault:true,profile:{chineseName:'测试同学',email:'test@example.com'}}]};
    p.w.chrome={runtime:{sendMessage:(message,cb)=>{
      let response=message.path==='session'?{loggedIn:true}:message.path==='/api/resumes'?{code:200,data:[{id:1}]}:{code:200,data:data.resumes[0]};
      cb({ok:true,data:response});
    },onMessage:{addListener:()=>{}}},storage:{local:{set:async()=>{}}}};
    p.w.eval(source('content.js'));await new Promise(r=>setImmediate(r));
    await p.find('#xd-load').onclick();p.find('#xd-scan').onclick();
    await p.find('#xd-batch').onclick();assert.equal(p.find('#name').value,'保留原名');assert.equal(p.find('#email').value,'test@example.com');
    assert.match(p.find('#xd-status').textContent,/复核通过 1 项/);
    p.find('#xd-overwrite').checked=true;
    await p.find('#xd-batch').onclick();assert.equal(p.find('#name').value,'测试同学');
    assert.match(p.find('#xd-status').textContent,/复核通过 2 项/);
  }finally{p.dom.window.close();}
});
test('字段别名区分本人和紧急联系人，不把户籍当籍贯',()=>{
  const p=page(moduleHtml('基本信息',field('紧急联系人电话','<input>')+field('联系邮箱','<input>')+field('户口所在地','<input>')+field('配偶姓名','<input>')));
  try{assert.deepEqual(Array.from(p.F.scan(),x=>x.match),['profile.emergencyPhone','profile.email','profile.householdRegistrationLocation','']);}finally{p.dom.window.close();}
});
test('排查报告区分未匹配、空值与成功，且不导出简历值或网址参数',async()=>{
  const p=page(moduleHtml('基本信息',field('姓名','<input id="name">')+field('邮箱','<input>')+field('未知字段','<input>')));
  p.dom.reconfigure({url:'https://example.test/resume?private=do-not-export'});
  try {
    let blob;
    p.w.URL.createObjectURL=value=>{blob=value;return 'blob:test';};p.w.URL.revokeObjectURL=()=>{};
    p.w.HTMLAnchorElement.prototype.click=function(){};
    p.w.chrome={runtime:{sendMessage:(message,cb)=>cb({ok:true,data:message.path==='session'?{loggedIn:true}:
      message.path==='/api/resumes'?{code:200,data:[{id:1}]}:{code:200,data:{isDefault:true,profile:{chineseName:'PRIVATE-RESUME-VALUE'}}}}),onMessage:{addListener:()=>{}}},storage:{local:{set:async()=>{}}}};
    p.w.eval(source('content.js'));await new Promise(r=>setImmediate(r));
    await p.find('#xd-load').onclick();p.find('#xd-scan').onclick();await p.find('#xd-batch').onclick();
    p.find('#xd-export').onclick();
    const json=await new Promise(resolve=>{const reader=new p.w.FileReader();reader.onload=()=>resolve(reader.result);reader.readAsText(blob);});
    assert.ok(!json.includes('PRIVATE-RESUME-VALUE'));assert.ok(!json.includes('do-not-export'));
    assert.deepEqual(JSON.parse(json).fields.map(x=>x.state),['confirmed','resume_empty','unmatched']);
    await p.find('#xd-batch').onclick();assert.match(p.find('#xd-status').textContent,/复核通过 0 项/);
  } finally {p.dom.window.close();}
});
test('技能和语言模块各自识别熟练程度，避免共用字段误匹配',()=>{
  const p=page(moduleHtml('专业技能',field('熟练程度','<input>'))+moduleHtml('语言能力',field('熟练程度','<input>')));
  try{assert.deepEqual(Array.from(p.F.scan(),x=>x.match),['skill.level','language.level']);}finally{p.dom.window.close();}
});
test('日期范围保留两个输入绑定，分别匹配开始/结束日期',()=>{
  const p=page(moduleHtml('教育经历',field('就读时间','<div class="ant-picker ant-picker-range"><input placeholder="开始日期"><input placeholder="结束日期"></div>')));
  try{const fields=p.F.scan();assert.equal(fields.length,2);assert.deepEqual(Array.from(fields,x=>x.match),['education.startDate','education.endDate']);assert.notEqual(fields[0].el,fields[1].el);}finally{p.dom.window.close();}
});
test('复核检测下一字段聚焦后旧字段被重置',async()=>{
  const p=page(field('姓名','<input id="name">')+field('邮箱','<input id="email">'));
  try{
    const fields=p.F.scan();await p.C.fill(fields[0].el,'测试同学');assert.equal(p.C.check(fields[0].el).ok,true);
    p.find('#email').onfocus=()=>{p.find('#name').value='';};
    await p.C.fill(fields[1].el,'test@example.com');
    assert.equal(p.C.check(fields[0].el).reason,'value_reverted');
  }finally{p.dom.window.close();}
});
test('停止异步填写，已完成的字段仍可只读复核',async()=>{
  const p=page(field('姓名','<input id="name">')+field('学校',select()));
  try{
    const fields=p.F.scan();let cancelled=false;
    await p.C.fill(fields[0].el,'测试同学',{isCurrent:()=>!cancelled});
    p.find('#school').onfocus=()=>{dropdown(p,'school',[]);p.w.setTimeout(()=>{cancelled=true;},100);};
    await assert.rejects(p.C.fill(fields[1].el,'测试大学',{isCurrent:()=>!cancelled}),/停止/);
    assert.equal(p.C.check(fields[0].el).ok,true);
  }finally{p.dom.window.close();}
});
test('动态字段定义补齐学院、户籍、实习与证书路径，重复加载不改变匹配',()=>{
  const p=page(moduleHtml('教育经历',field('学院（院系）','<input>'))+moduleHtml('实习经历',field('公司','<input>'))+moduleHtml('证书',field('证书编号','<input>')));
  try{
    const schema=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../backend/src/main/resources/resume-schema.json'),'utf8'));
    p.F.configure(schema);p.F.configure(schema);
    assert.deepEqual(Array.from(p.F.scan(),x=>x.match),['education.institute','internship.companyName','certificate.certificationNumber']);
    assert.equal(p.F.readResume({resumes:[{isDefault:true,internship:[{companyName:'模拟实习'}]}]},'internship.companyName'),'模拟实习');
    assert.equal(p.F.readResume({resumes:[{isDefault:true,experience:[{companyName:'正式工作'}]}]},'internship.companyName'),null);
    assert.equal(p.F.match({labels:['户籍'],module:'profile'}),'profile.householdRegistrationLocation');
  }finally{p.dom.window.close();}
});
test('报告字段：长备注、布尔学历、实践经历、IT序号与父母身份不混淆',()=>{
  const p=page(moduleHtml('个人基本信息',field('生源地（注：国内院校毕业生户口所在地）','<input>')+field('紧急联系方式','<input>'))
    +moduleHtml('教育经历+ 添加',field('是否最高学历','<input>'))
    +moduleHtml('学生实践经验+ 添加',field('开始日期','<input>')+field('实习单位','<input>'))
    +moduleHtml('IT技能+ 添加',field('IT技能1',select('it1'))+field('IT技能2',select('it2')))
    +moduleHtml('家庭情况',field('母亲姓名','<input>')+field('父亲单位','<input>')+field('受雇于系统内单位亲属姓名（如没有填无）','<input>')+field('与本人关系（如没有填无）','<input>')));
  try{
    const fields=p.F.scan();assert.deepEqual(Array.from(fields,x=>x.match),['profile.examRegistrationAddress','profile.emergencyPhone','education.isHighest','internship.startDate','internship.companyName','skill.skillName','skill.skillName','family.name','family.company','','']);
    assert.equal(fields[6].record,1);
    const data={resumes:[{isDefault:true,education:[{educationLevel:'硕士研究生'},{educationLevel:'本科'}],family:[{relationship:'父亲',name:'测试父亲',company:'父亲公司'},{relationship:'母亲',name:'测试母亲'}],skill:[{skillName:'Java'},{skillName:'SQL'}]}]};
    assert.equal(p.F.resolveResume(data,fields[2]),'是');assert.equal(p.F.resolveResume(data,{...fields[2],record:1}),'否');
    assert.equal(p.F.resolveResume(data,fields[7]),'测试母亲');assert.equal(p.F.resolveResume(data,fields[8]),'父亲公司');
    assert.equal(p.F.resolveResume(data,fields[6]),'SQL');assert.equal(p.F.resolveResume(data,fields[9]),null);
    data.resumes[0].education.push({educationLevel:'硕士研究生'});assert.equal(p.F.resolveResume(data,fields[2]),null);
  }finally{p.dom.window.close();}
});
test('英语等级取证书，其他语言排除英语；不虚构缺失语种',()=>{
  const p=page(moduleHtml('语言能力',field('英语等级','<input>')+field('其他语言','<input>')+field('得分','<input>')));
  try{const fields=p.F.scan(),data={resumes:[{language:[{language:'英语',certificationName:'大学英语六级',level:'熟练',score:'560'}]}]};
    assert.equal(fields[0].match,'language.certificationName');assert.equal(fields[2].match,'language.score');
    assert.equal(p.F.resolveResume(data,fields[0]),'大学英语六级');assert.equal(p.F.resolveResume(data,fields[1]),null);
    data.resumes[0].language.unshift({language:'日语'});assert.equal(p.F.resolveResume(data,fields[0]),'大学英语六级');assert.equal(p.F.resolveResume(data,fields[1]),'日语');
  }finally{p.dom.window.close();}
});
function cascadeMock(p,branches,leafDisplay=false,reject=false) {
  const popup=p.w.document.createElement('div');popup.className='ant-cascader-dropdown';popup.id='mock-cascade';popup.hidden=true;p.w.document.body.appendChild(popup);
  let chosen=null;
  const render=(nodes,level,path)=>{
    for(const col of Array.from(popup.querySelectorAll('.ant-cascader-menu')).slice(level))col.remove();
    const col=p.w.document.createElement('ul');col.className='ant-cascader-menu';popup.appendChild(col);
    for(const branch of nodes){const li=p.w.document.createElement('li');li.className='ant-cascader-menu-item'+(branch.children?' ant-cascader-menu-item-expand':'');li.textContent=branch.label;col.appendChild(li);
      li.onclick=()=>{if(branch.children){for(const peer of col.children)peer.classList.remove('ant-cascader-menu-item-active');li.classList.add('ant-cascader-menu-item-active');render(branch.children,level+1,[...path,branch.label]);}
        else if(!reject){chosen=[...path,branch.label];p.find('.ant-select-selection-item').textContent=leafDisplay?branch.label:chosen.join(' / ');popup.hidden=true;}};
    }
  };
  p.find('input').onfocus=()=>{popup.hidden=false;render(branches,0,[]);};
  return ()=>chosen;
}
test('级联仅有技能叶子时遍历分类，提交真实完整路径；支持叶子回显',async()=>{
  const p=page(field('IT技能1','<div class="ant-cascader"><span class="ant-select-selection-item"></span><input readonly aria-controls="mock-cascade"></div>'));
  try{const chosen=cascadeMock(p,[{label:'办公',children:[{label:'Excel'}]},{label:'编程',children:[{label:'Java'}]}],true);
    assert.equal((await p.C.fill(p.find('.ant-cascader'),'Java')).ok,true);assert.deepEqual(chosen(),['编程','Java']);assert.equal(p.C.check(p.find('.ant-cascader')).ok,true);
  }finally{p.dom.window.close();}
});
test('级联叶子重名拒选，缺少区县拒绝只点击上级',async()=>{
  const markup=field('地区','<div class="ant-cascader"><span class="ant-select-selection-item"></span><input readonly aria-controls="mock-cascade"></div>');
  for(const [tree,value,code] of [[[{label:'A',children:[{label:'同名'}]},{label:'B',children:[{label:'同名'}]}],'同名','ambiguous_option'],[[{label:'省',children:[{label:'市',children:[{label:'区'}]}]}],'省 / 市','incomplete_cascade']]){
    const p=page(markup);try{const chosen=cascadeMock(p,tree);await assert.rejects(p.C.fill(p.find('.ant-cascader'),value),e=>e.code===code);assert.equal(chosen(),null);}finally{p.dom.window.close();}
  }
});
test('级联拒绝提交且保留旧叶子标签时，不误报成功',async()=>{
  const p=page(field('地区','<div class="ant-cascader"><span class="ant-select-selection-item">旧值</span><input readonly aria-controls="mock-cascade"></div>'));
  try{cascadeMock(p,[{label:'省',children:[{label:'市'}]}],true,true);await assert.rejects(p.C.fill(p.find('.ant-cascader'),'省 / 市'),e=>e.code==='selection_not_committed');}finally{p.dom.window.close();}
});
test('复合技能名称匹配真实单一选项，多项可选时交给用户确认',async()=>{
  for(const labels of [['JavaScript'],['JavaScript','Vue3']]){
    const p=page(moduleHtml('IT技能',field('IT技能1','<div class="ant-cascader"><span class="ant-select-selection-item"></span><input readonly aria-controls="mock-cascade"></div>')));
    try{const item=p.F.scan()[0],value='JavaScript / Vue3',chosen=cascadeMock(p,[{label:'编程',children:labels.map(label=>({label}))}]);
      const action=p.C.fill(item.el,value,{hints:p.F.fillHints(item,value)});
      if(labels.length===1){assert.equal((await action).ok,true);assert.deepEqual(chosen(),['编程','JavaScript']);}
      else{await assert.rejects(action,e=>e.code==='ambiguous_option');assert.equal(chosen(),null);}
    }finally{p.dom.window.close();}
  }
});
test('旧版级联label识别；不完整生日不能猜日期，完整ISO日期正确归一',()=>{
  const p=page(field('现居住地','<span class="ant-cascader-picker"><span class="ant-cascader-picker-label">省 / 市 / 区</span><input class="ant-cascader-input" readonly></span>'));
  try{const item=p.F.scan()[0];assert.equal(p.C.type(item.el),'cascader');assert.equal(p.C.value(item.el),'省 / 市 / 区');
    assert.equal(p.w.ResumeProAIHelpers.normalizeDateValue('2003-05-18T00:00:00','date'),'2003-05-18');
    assert.equal(p.w.ResumeProAIHelpers.normalizeDateValue('2003-05','date'),'2003-05');
  }finally{p.dom.window.close();}
});
test('分类遍历时Java不误选JavaScript，证书的四级六级保持区别',async()=>{
  const p=page(field('技能','<div class="ant-cascader"><span class="ant-select-selection-item"></span><input readonly aria-controls="mock-cascade"></div>'));
  try{const chosen=cascadeMock(p,[{label:'编程',children:[{label:'JavaScript'}]}]);
    await assert.rejects(p.C.fill(p.find('.ant-cascader'),'Java'),e=>e.code==='no_option_match');assert.equal(chosen(),null);
    assert.equal(p.C.equivalent('CET-6','大学英语六级'),true);assert.equal(p.C.equivalent('CET-6','大学英语四级'),false);
  }finally{p.dom.window.close();}
});
test('Phoenix下拉展开真实候选项并提交tipEle，搜索词不能冒充选中值',async()=>{
  const p=page(field('民族',`<div class="phoenix-select" id="ph-ethnicity">
    <div class="phoenix-select__inputWrapper"><span class="phoenix-select__tipEle"></span><input class="phoenix-select__input" aria-expanded="false"></div>
  </div>`));
  try {
    const widget=p.find('#ph-ethnicity'),input=widget.querySelector('input'),tip=widget.querySelector('.phoenix-select__tipEle');
    let chosen='', searched=0;
    widget.onclick=()=>{
      input.setAttribute('aria-expanded','true');
      const list=p.w.document.createElement('div'); list.className='phoenix-selectList'; list.id='ph-list';
      list.innerHTML='<div class="phoenix-selectList__list"><div class="phoenix-selectList__listItem"><span class="phoenix-selectList__singleLabel">汉族</span></div><div class="phoenix-selectList__listItem"><span class="phoenix-selectList__singleLabel">回族</span></div></div>';
      p.w.document.body.appendChild(list);
      list.querySelectorAll('.phoenix-selectList__listItem').forEach(row=>row.onclick=()=>{chosen=row.textContent.trim();tip.textContent=chosen;input.value='';list.remove();});
    };
    input.oninput=()=>{searched++;};
    const item=p.F.scan()[0];
    assert.equal(item.entry.controlKind,'custom-select');
    assert.equal(p.C.type(item.el),'select');
    const result=await p.C.fill(item.el,'汉族');
    assert.equal(result.ok,true); assert.equal(chosen,'汉族'); assert.equal(searched,0);
    assert.equal(p.C.value(widget),'汉族');
  } finally {p.dom.window.close();}
});
test('Phoenix下拉没有tipEle提交信号时返回selection_not_committed',async()=>{
  const p=page(field('民族',`<div class="phoenix-select" id="ph-ethnicity"><input class="phoenix-select__input" aria-expanded="false"></div>`));
  try {
    const widget=p.find('#ph-ethnicity');
    widget.onclick=()=>{
      const list=p.w.document.createElement('div'); list.className='phoenix-selectList';
      list.innerHTML='<div class="phoenix-selectList__listItem"><span class="phoenix-selectList__singleLabel">汉族</span></div>';
      p.w.document.body.appendChild(list);
      list.firstElementChild.onclick=()=>{widget.querySelector('input').value='汉族';list.remove();};
    };
    await assert.rejects(p.C.fill(p.F.scan()[0].el,'汉族'),/未确认选中值/);
  } finally {p.dom.window.close();}
});
test('Phoenix先展开并记录再填写，复用唯一活动字段的面板而不再次关闭',async()=>{
  const p=page(field('学历','<div class="phoenix-select"><span class="phoenix-select__tipEle"></span><input class="phoenix-select__input"></div>'));
  try{
    const root=p.find('.phoenix-select');let clicks=0;
    root.onclick=()=>{
      clicks++;const current=p.find('.phoenix-selectList');if(current){current.remove();root.classList.remove('phoenix-select--active');return;}
      root.classList.add('phoenix-select--active');
      const list=p.w.document.createElement('div');list.className='phoenix-selectList';
      list.innerHTML='<div class="phoenix-selectList__listItem"><span class="phoenix-selectList__singleLabel">大学本科</span></div>';
      p.w.document.body.appendChild(list);
      list.firstChild.onclick=()=>{root.querySelector('.phoenix-select__tipEle').textContent='大学本科';list.remove();root.classList.remove('phoenix-select--active');};
    };
    const item=p.F.scan()[0];assert.deepEqual(Array.from(await p.C.open(item.el)),['大学本科']);
    assert.equal((await p.C.fill(item.el,'本科')).ok,true);assert.equal(clicks,1);assert.equal(p.C.check(item.el).ok,true);
  }finally{p.dom.window.close();}
});
test('Phoenix同名候选拒选，placeholder不算已选，多选和禁用控件不自动操作',async()=>{
  const p=page(field('民族','<div class="phoenix-select"><span class="phoenix-select__tipEle">请选择</span><input class="phoenix-select__input"></div>'));
  try{
    const root=p.find('.phoenix-select');root.onclick=()=>{
      const list=p.w.document.createElement('div');list.className='phoenix-selectList';list.innerHTML=Array(2).fill('<li class="phoenix-selectList__listItem"><span class="phoenix-selectList__singleLabel">汉族</span></li>').join('');p.w.document.body.appendChild(list);
    };
    const item=p.F.scan()[0];assert.equal(p.w.ResumeProCustomControls.hasExistingValue(item.entry),false);
    await assert.rejects(p.C.fill(item.el,'汉族'),e=>e.code==='ambiguous_option');
    p.find('.phoenix-selectList').remove();root.classList.add('phoenix-select--multi');
    await assert.rejects(p.C.fill(item.el,'汉族'),e=>e.code==='unsupported_control');
    root.classList.remove('phoenix-select--multi');root.classList.add('phoenix-select--disabled');
    await assert.rejects(p.C.fill(item.el,'汉族'),e=>e.code==='control_disabled');
  }finally{p.dom.window.close();}
});
test('Phoenix日历图标识别日期，普通下拉不误判为日期，未扫描也识别适配器',()=>{
  const p=page(field('出生日期','<div class="phoenix-select" id="ph-birth"><input><svg><use href="#prefix__a_field_date_time_picker"></use></svg></div>')+field('民族','<div class="phoenix-select" id="ph-ethnicity"><input></div>'));
  try{
    const birth=p.find('#ph-birth'),ethnicity=p.find('#ph-ethnicity');
    assert.equal(p.C.type(birth),'date');assert.equal(p.C.type(ethnicity),'select');
    assert.equal(p.w.XiaomaiEngine.entryFor(birth).pickerType,'phoenix');
    const fields=p.F.scan();assert.equal(fields[0].entry.pickerType,'phoenix');assert.equal(fields[0].entry.controlKind,'date');assert.equal(fields[1].entry.controlKind,'custom-select');
  }finally{p.dom.window.close();}
});
test('Phoenix展开记录不能借用另一个活动字段的候选面板',async()=>{
  const p=page(field('民族','<div class="phoenix-select phoenix-select--active" id="ph-a"><input></div>')+field('学历','<div class="phoenix-select" id="ph-b"><input></div>')+'<div class="phoenix-selectList"><li class="phoenix-selectList__listItem"><span class="phoenix-selectList__singleLabel">汉族</span></li></div>');
  try{
    p.find('#ph-b').onclick=()=>{p.find('#ph-a').classList.remove('phoenix-select--active');p.find('#ph-b').classList.add('phoenix-select--active');p.find('.phoenix-selectList').innerHTML='<li class="phoenix-selectList__listItem"><span class="phoenix-selectList__singleLabel">大学本科</span></li>';};
    assert.deepEqual(Array.from(await p.C.open(p.find('#ph-b'))),['大学本科']);
  }finally{p.dom.window.close();}
});
test('信达字段语义：评价、院系、技能内证书、普通家庭关系；分类与声明不猜测',()=>{
  const p=page(moduleHtml('个人信息',field('个人评价','<textarea></textarea>')+field('国籍','<input>')+field('出生地','<input>')+field('家庭住址','<input>'))
    +moduleHtml('求职意向',field('意向单位','<input>')+field('意向岗位类别','<input>')+field('意向岗位','<input>'))
    +moduleHtml('教育经历',field('院系名称','<input>')+field('学习形式','<input>'))
    +moduleHtml('技能',field('职(执)业资格证书','<input>')+field('颁发机构','<input>')+field('获取时间','<input>'))
    +moduleHtml('家庭情况',field('与本人关系','<input>')+field('工作单位','<input>')+field('与本人关系（如没有填无）','<input>')));
  try{assert.deepEqual(Array.from(p.F.scan(),x=>x.match),['intention.selfEvaluation','','','','','','intention.targetPosition','education.institute','education.formOfStudy','certificate.certificationName','certificate.certificationAuthDepartment','certificate.certificationDate','family.relationship','family.company','']);}
  finally{p.dom.window.close();}
});
test('Phoenix地区面板逐层展开，点击SVG末级单选及局部确定；缺层不提交',async()=>{
  for(const complete of [true,false]){
    const p=page(field('籍贯','<div class="phoenix-select"><span class="phoenix-select__tipEle"></span><input class="phoenix-select__input"></div>'));
    try{
      let commits=0,searches=0;const root=p.find('.phoenix-select');
      root.onclick=()=>{
        root.classList.add('phoenix-select--active');const popup=p.w.document.createElement('div');popup.className='area-selector-container';
        popup.innerHTML='<div class="area-search-input"><input></div><div class="area-data-container"></div><div class="select-data-container"></div><div class="area-footer-button"><div class="button-container"><div class="phoenix-button__wraper">确定</div></div></div>';
        p.w.document.body.appendChild(popup);popup.querySelector('input').oninput=()=>searches++;
        const labels=['浙江省','杭州市','西湖区'];
        const render=level=>{
          const holder=popup.querySelector('.area-data-container');holder.innerHTML=`<div class="area-item-container"><span class="icon-container visible"><svg class="area-icon-RadioUnchecked"></svg></span><span class="area-text-label">${labels[level]}</span>${level<2?'<svg class="area-icon-right"></svg>':''}</div>`;
          holder.querySelector('.area-text-label').onclick=()=>{if(level<2)p.w.setTimeout(()=>render(level+1),60);};
          if(!complete&&level<2)holder.querySelector('.icon-container').className='icon-container hidden';
          holder.querySelector('.area-icon-RadioUnchecked').onclick=event=>{event.currentTarget.classList.replace('area-icon-RadioUnchecked','area-icon-RadioChecked');popup.querySelector('.select-data-container').innerHTML='<span class="select-area-text-label">浙江省/杭州市/西湖区</span>';};
        };
        popup.querySelector('.phoenix-button__wraper').onclick=()=>{commits++;root.querySelector('.phoenix-select__tipEle').textContent='浙江省/杭州市/西湖区';popup.remove();root.classList.remove('phoenix-select--active');};render(0);
      };
      const item=p.F.scan()[0],value=complete?'浙江省 / 杭州市 / 西湖区':'浙江省 / 杭州市';
      if(complete){assert.equal((await p.C.fill(item.el,value)).ok,true);assert.equal(p.C.check(item.el).ok,true);assert.equal(commits,1);}
      else{await assert.rejects(p.C.fill(item.el,value),e=>e.code==='incomplete_cascade');assert.equal(commits,0);assert.equal(p.C.value(item.el),'');}
      assert.equal(searches,0);
    }finally{p.dom.window.close();}
  }
});
test('Phoenix可选父级与箭头导航：省/市/区、无分隔中文路径、别名、禁用、缺层均按实际控件处理',async()=>{
  const cases=[['浙江省',0],['浙江 / 杭州',1],['浙江省杭州市西湖区',2],['浙江杭州西湖',2],['浙江省，杭州市',1],['浙江省 / 未知城市',-1],['杭州市',-1],['浙江省 / 杭州市',-1,'hidden'],['浙江省',-1,'disabled'],['浙江省',-1,'duplicate']];
  for(const [desired,depth,mode] of cases){
    const p=page(field('籍贯','<div class="phoenix-select"><span class="phoenix-select__tipEle"></span><input></div>'));
    try{
      const root=p.find('.phoenix-select'),labels=['浙江省','杭州市','西湖区'];let commits=0,arrows=0,selected=-1;
      root.onclick=()=>{
        root.classList.add('phoenix-select--active');const popup=p.w.document.createElement('div');popup.className='area-selector-container';
        popup.innerHTML='<div class="area-data-container"></div><div class="select-data-container"></div><div class="area-footer-button"><div class="button-container"><button type="button">确定</button></div></div>';p.w.document.body.appendChild(popup);
        const holder=popup.querySelector('.area-data-container');
        const render=level=>{
          // Reuse the same row node to expose stale-node comparison bugs.
          if(!holder.firstChild)holder.innerHTML='<div class="area-item-container"></div>';
          const row=holder.firstChild;
          row.innerHTML=`<span class="icon-container ${mode==='hidden'&&level<2?'hidden':'visible'}"><svg class="area-icon-RadioUnchecked${mode==='disabled'?'-disabled':''}"></svg></span><span class="area-text-label">${labels[level]}</span>${level<2?'<svg class="area-icon-right visible"></svg>':''}`;
          row.querySelector('.area-text-label').onclick=()=>{throw Error('应点击可交互箭头，不是文字');};
          const arrow=row.querySelector('.area-icon-right');if(arrow)arrow.onclick=()=>{arrows++;p.w.setTimeout(()=>render(level+1),80);};
          const radio=row.querySelector('svg');radio.onclick=()=>{selected=level;radio.className.baseVal='area-icon-RadioChecked';popup.querySelector('.select-data-container').innerHTML=`<span class="select-area-text-label">${labels.slice(0,level+1).join('/')}</span>`;};
          if(mode==='duplicate')holder.appendChild(row.cloneNode(true));
        };
        popup.querySelector('button').onclick=()=>{commits++;root.querySelector('.phoenix-select__tipEle').textContent=labels.slice(0,selected+1).join('/');popup.remove();root.classList.remove('phoenix-select--active');};render(0);
      };
      if(depth>=0){
        assert.equal((await p.C.fill(root,desired)).ok,true);assert.equal(commits,1);assert.equal(arrows,depth);assert.equal(selected,depth);assert.equal(p.C.check(root).ok,true);
      }else{
        await assert.rejects(p.C.fill(root,desired),error=>({hidden:'incomplete_cascade',disabled:'control_disabled',duplicate:'ambiguous_option'}[mode]||'no_option_match')===error.code);
        assert.equal(commits,0);assert.equal(selected,-1);
      }
    }finally{p.dom.window.close();}
  }
});
test('信达个人信息的语言与计算机水平只取唯一记录，多条不能猜第一项',()=>{
  const p=page(moduleHtml('个人信息',field('外语语种','<input>')+field('外语掌握水平','<input>')+field('计算机水平','<input>')));
  try{
    const fields=p.F.scan();assert.deepEqual(Array.from(fields,x=>x.match),['language.language','language.level','skill.level']);
    const single={resumes:[{language:[{language:'英语',level:'熟练'}],skill:[{skillName:'计算机',level:'熟练'}]}]};
    assert.deepEqual(Array.from(fields,x=>p.F.resolveResume(single,x)),['英语','熟练','熟练']);
    const multi={resumes:[{language:[{language:'英语',level:'熟练'},{language:'日语',level:'入门'}],skill:[{level:'熟练'},{level:'入门'}]}]};
    assert.deepEqual(Array.from(fields,x=>p.F.resolveResume(multi,x)),[null,null,null]);
  }finally{p.dom.window.close();}
});
test('电信报告：完整字段定义在扫描前可用，混合技能模块和社会实践不取正式工作',()=>{
  const p=page(moduleHtml('个人基本信息',field('健康状况','<select><option>健康</option></select>')+field('通信地址','<input>')+field('是否有亲属在中国电信集团（系统）从业','<input>'))
    +moduleHtml('教育经历',field('学制','<input>')+field('受教育类型','<input>')+field('院系','<input>')+field('年级排名','<input>'))
    +moduleHtml('社会实践/校内活动',field('开始时间','<input>')+field('活动名称','<input>')+field('活动描述','<input>')+field('职务','<input>'))
    +moduleHtml('技能/爱好',field('英语水平','<input>')+field('英语成绩得分','<input>')+field('个人爱好','<input>')+field('专业资格证书','<input>')+field('专业资格证书获得时间','<input>'))
    +moduleHtml('家庭关系',field('姓名','<input>')+field('关系','<input>')+field('工作单位','<input>')+field('亲属职务/岗位（含层级）','<input>')+field('是否在电信集团及下属单位工作','<input>')));
  try{assert.deepEqual(Array.from(p.F.scan(),x=>x.match),['profile.healthCondition','profile.currentResidence','','education.lengthOfSchooling','education.formOfStudy','education.institute','','campus.startDate','campus.organizationName','campus.jobDescription','campus.position','language.certificationName','language.score','profile.hobbies','certificate.certificationName','certificate.certificationDate','family.name','family.relationship','family.company','family.position','']);}
  finally{p.dom.window.close();}
});
test('电信报告：相邻文字的单选按钮使用标签选中真实编码',async()=>{
  const p=page(moduleHtml('个人基本信息',field('性别','<div><input type="radio" name="gender" value="1">男 <input type="radio" name="gender" value="2">女</div>'))
    +moduleHtml('教育经历',field('是否最高学历','<div><input type="radio" name="highest" value="Y"><span>是</span><input type="radio" name="highest" value="N"><span>否</span></div>')));
  try{const fields=p.F.scan();assert.equal(fields.length,2);
    assert.equal((await p.C.fill(fields[0].el,'女性')).ok,true);assert.equal(p.find('input[value="2"]').checked,true);assert.equal(p.C.value(fields[0].el),'女');
    assert.equal((await p.C.fill(fields[1].el,'是')).ok,true);assert.equal(p.find('input[value="Y"]').checked,true);
  }finally{p.dom.window.close();}
});
test('只读文本选择器给出准确原因，不误报手动修改且不强制写value',async()=>{
  const p=page(field('出生日期','<input readonly id="birth">'));
  try{const item=p.F.scan()[0];await assert.rejects(p.C.fill(item.el,'2003-05-18'),e=>e.code==='readonly_control');assert.equal(p.find('#birth').value,'');}finally{p.dom.window.close();}
});
test('先扫描后加载简历会刷新服务端字段别名，接口失败时完整内置定义仍可用',async()=>{
  const p=page(moduleHtml('个人基本信息',field('通信地址','<input>')+field('新增测试字段名','<input>')));
  try{p.w.chrome={runtime:{lastError:null,sendMessage:(m,cb)=>cb({ok:true,data:m.path==='session'?{loggedIn:true}:m.path==='/api/resumes'?{code:200,data:[{id:1}]}:m.path==='/api/resumes/1'?{code:200,data:{isDefault:true,profile:{currentResidence:'测试地址'}}}:{code:200,data:{modules:[{key:'profile',fields:[{key:'currentResidence',label:'新增测试字段名'}]}]}}}),onMessage:{addListener:()=>{}}},storage:{local:{set:async()=>{}}}};
    p.w.eval(source('content.js'));await new Promise(r=>setTimeout(r,10));p.find('#xd-scan').onclick();
    assert.match(p.find('#xd-content').textContent,/profile.currentResidence/);
    await p.find('#xd-load').onclick();const rows=p.w.document.querySelectorAll('.xd-match');assert.equal(rows[1].textContent,'本地匹配：profile.currentResidence');
  }finally{p.dom.window.close();}
});
(async()=>{
  let failures=0;
  for (const {name,run} of tests) {try {await run();console.log('PASS '+name);} catch(error){failures++;console.error('FAIL '+name+'\n'+error.stack);}}
  console.log(`${tests.length-failures}/${tests.length} passed`);process.exitCode=failures?1:0;
})();
