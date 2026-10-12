const assert=require('assert/strict'),fs=require('fs'),path=require('path');
const {JSDOM}=require('jsdom');
const bundle=fs.readFileSync(path.join(__dirname,'../campus-job-desktop/src-tauri/autofill.js'),'utf8');
const section=(title,children)=>`<div class="resume-tpl-wrap"><div class="title-txt">${title}</div>${children}</div>`;
const field=(title,html,record=0)=>`<div class="resume-form-item" id="set_11-record_${record}-item_${title}"><div class="resume-form-title">${title}</div>${html}</div>`;
function page(html,resumes,setup){
  const dom=new JSDOM(html,{url:'https://example.test/resume',runScripts:'outside-only'}),w=dom.window;
  w.HTMLElement.prototype.getClientRects=function(){for(let p=this;p;p=p.parentElement)if(p.hidden||p.style.display==='none')return [];return this.isConnected?[{width:100,height:30}]:[];};
  w.HTMLElement.prototype.scrollIntoView=function(){};
  w.__RESUME_DATA__={resumes};if(setup)setup(w);w.eval(bundle);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  return {dom,w,api:w.__XIAOMAI_FILL__,root:w.document.getElementById('xiaomai-autofill').shadowRoot};
}
async function run(){
  let p=page(section('基本信息',field('姓名','<input id="name" value="原姓名">')+field('邮箱','<input id="email">')+field('性别','<select id="gender"><option value="">请选择</option><option>男</option><option>女</option></select>')),[{id:1,resumeName:'默认简历',isDefault:true,profile:{chineseName:'模拟姓名',email:'demo@example.test',gender:'女'}}]);
  try{
    assert(p.root.querySelector('.shell').hidden);assert.equal(p.root.querySelector('#bubble').textContent,'小麦填表插件');
    assert.equal(p.api.scan().length,3,'shadow panel excluded');
    const pending=p.api.fill();assert.equal(p.root.querySelector('#progress').hidden,false);assert.equal(p.root.querySelector('#progressText').textContent,'填写进度 0/3');await pending;
    assert.equal(p.w.document.querySelector('#name').value,'原姓名');assert.equal(p.w.document.querySelector('#email').value,'demo@example.test');assert.equal(p.w.document.querySelector('#gender').value,'女');
    assert(p.root.querySelector('#progress').hidden);assert.equal(p.root.querySelector('#progressText').textContent,'填写进度 3/3');assert.match(p.root.querySelector('#message').textContent,/成功 2 项.*保留 1 项/);assert(!p.root.querySelector('#checkNote').hidden);
    p.root.querySelector('#overwrite').click();assert(!p.root.querySelector('#confirm').hidden);p.root.querySelector('#confirmNo').click();assert(p.root.querySelector('#confirm').hidden);
    await p.api.fill(true);assert.equal(p.w.document.querySelector('#name').value,'模拟姓名');
    console.log('PASS 空白填写/原生下拉/覆盖确认/逐字段进度/结果复核/面板隔离');
  }finally{p.dom.window.close();}
  p=page(section('教育经历',field('学校名称','<input id="school0">')+field('学校名称','<input id="school1">',1)),[{id:1,education:[{schoolName:'模拟大学'}]},{id:2,resumeName:'第二简历',education:[{schoolName:'第二大学'},{schoolName:'第二经历'}]}]);
  try{
    await p.api.fill();assert.equal(p.w.document.querySelector('#school0').value,'模拟大学');assert.equal(p.w.document.querySelector('#school1').value,'');assert.match(p.root.querySelector('#message').textContent,/资料缺失 1 项/);
    p.root.querySelector('#resume').click();const buttons=p.root.querySelector('#resume').parentElement.querySelectorAll('[role=option]');buttons[1].click();await p.api.fill(true);
    assert.equal(p.w.document.querySelector('#school0').value,'第二大学');assert.equal(p.w.document.querySelector('#school1').value,'第二经历');
    p.w.__RESUME_DATA__={resumes:[]};p.w.dispatchEvent(new p.w.Event('xiaomai-resume-updated'));await p.api.fill();assert.match(p.root.querySelector('#message').textContent,/登录/);
    console.log('PASS 重复经历不复用第一条/自定义选择简历/资料清空');
  }finally{p.dom.window.close();}
  p=page(section('基本信息',field('姓名','<input id="name">')+field('邮箱','<input id="email">')),[{id:1,profile:{chineseName:'模拟姓名',email:'demo@example.test'}}]);
  try{
    const pending=p.api.fill();p.root.querySelector('#stop').click();await pending;assert(p.root.querySelector('#progress').hidden);assert.match(p.root.querySelector('#message').textContent,/已停止/);
    console.log('PASS 停止填写恢复按钮与隐藏进度');
  }finally{p.dom.window.close();}
  const requests=[];
  p=page(section('基本信息',field('联络信件收取位置','<input id="unknown">')),[{id:1,profile:{email:'private-value@example.test'}}],w=>{
    w.__XIAOMAI_AUTH_TOKEN__='test-only';
    w.__TAURI_INTERNALS__={invoke:async(command,args)=>{
      requests.push({command,args});
      if(command==='autofill_ai_config')return {code:200,data:{enabled:true}};
      return {code:200,data:{matches:args.fields.map(f=>({id:f.id,field:'profile.email',confidence:.95}))}};
    }};
  });
  try{
    await p.api.fill();assert.equal(p.w.document.querySelector('#unknown').value,'private-value@example.test');
    const sent=requests.find(x=>x.command==='autofill_ai_analyze');assert(sent);assert(!JSON.stringify(sent.args.fields).includes('private-value'));
    assert.match(p.root.querySelector('#aiState').textContent,/已开启/);
    console.log('PASS 原生AI辅助识别/简历值留在本地/结果验证');
  }finally{p.dom.window.close();}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
