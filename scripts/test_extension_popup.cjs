const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const {JSDOM} = require('jsdom');
const root = path.resolve(__dirname, '../autofill-extension');
const html = fs.readFileSync(path.join(root, 'popup.html'), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture(loggedIn = true) {
  const dom = new JSDOM(html, {url:'https://example.test/popup.html', runScripts:'outside-only'});
  const w = dom.window, saved = {selectedResumeId:'2'}, commands = [], opened = [];
  const replies = {
    session: {loggedIn, phone:'13800000000'},
    '/api/user/info': {code:200,data:{nickname:'测试同学',isVip:true,vipExpire:'2099-12-31'}},
    '/api/resumes': {code:200,data:[{id:1,resumeName:'默认模板简历',isDefault:true},{id:2,resumeName:'银行求职简历'}]},
    '/api/job-status/list': {code:200,data:[{companyName:'测试企业',positions:'测试岗位',mainStatus:'APPLIED',applyUrl:'https://example.test/apply'}]},
    '/api/config': {code:200,data:{customerQrImage:'/uploads/qr.png'}}
  };
  let state={visible:false,busy:false};
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
  w.chrome = {
    runtime: {lastError:null,getManifest:()=>({version:'0.1.8'}),sendMessage:(message, callback)=>{
      if(message.type==='xiaomai-page-command') {commands.push(message.command);if(message.command==='show')state.visible=true;callback({ok:true,data:{...state}});return;}
      if(message.path==='logout')replies.session={loggedIn:false};
      if(message.path==='/api/auth/password-login')replies.session={loggedIn:true};
      callback({ok:true,data:replies[message.path]||{code:200,data:{loggedIn:false}}});
    }},
    storage:{local:{get:async()=>saved,set:async values=>Object.assign(saved,values),remove:async key=>{delete saved[key];}}},
    tabs:{query:async()=>[{id:123}],create:options=>opened.push(options.url)}
  };
  w.eval(fs.readFileSync(path.join(root,'popup.js'),'utf8'));
  return {w,dom,saved,commands,opened,replies,setState:v=>state=v,$:s=>w.document.querySelector(s)};
}
(async()=>{
  const p=fixture();
  try {
    await tick();await tick();
    assert.equal(p.$('#user-name').textContent,'测试同学');assert.equal(p.$('#vip-text').textContent,'续费会员');
    assert.match(p.$('#vip-tip').textContent,/2099-12-31/);
    assert.equal(p.$('#resume-label').textContent,'银行求职简历');
    assert.equal(p.$('#mode-label').textContent,'仅填新增内容');
    p.$('#mode-select').click();assert.equal(p.$('#mode-options').hidden,false);
    p.$('[data-mode="overwrite"]').click();await tick();assert.equal(p.saved.fillMode,'overwrite');
    assert.equal(p.$('#mode-label').textContent,'全部覆盖重填');assert.equal(p.$('#mode-options').hidden,true);
    p.$('#mode-select').click();p.w.document.body.click();assert.equal(p.$('#mode-options').hidden,true);
    p.$('#resume-select').click();await p.$('#resume-options button').onclick();
    assert.equal(p.saved.selectedResumeId,'1');assert.equal(p.$('#resume-label').textContent,'默认模板简历');
    await p.$('#open-floating').onclick();assert(p.commands.includes('show'));
    p.$('#jobs-tab').click();await tick();assert.equal(p.$('#jobs-page').hidden,false);
    assert.equal(p.$('#resume-page').hidden,true);assert.match(p.$('#jobs-list').textContent,/测试企业/);
    p.$('.job-card button').click();assert.equal(p.opened.pop(),'https://example.test/apply');
    await p.$('#support').onclick();assert.match(p.$('#info-content').textContent,/扫码/);
    assert.equal(p.$('#info-content img').src,'https://my88ai.com/uploads/qr.png');
    p.$('#info-close').click();p.$('#help').click();assert.match(p.$('#info-content').textContent,/不会|自行保存/);
    p.$('#info-close').click();p.$('#resume-tab').click();
    p.setState({visible:true,busy:true});p.$('#resume-select').click();
    await p.$('#resume-options button:nth-child(2)').onclick();assert.equal(p.saved.selectedResumeId,'1');
    assert.match(p.$('#message').textContent,/正在填写/);
    p.setState({visible:false,busy:false});await p.$('#logout').onclick();assert.equal(p.$('#user-name').textContent,'登录 / 注册');
    p.$('#user-name').click();assert(p.$('#login-dialog').open);
  } finally {p.dom.window.close();}
  const guest=fixture(false);
  try {
    await tick();assert.equal(guest.$('#resume-label').textContent,'登录后选择简历');
    guest.$('#refresh-resume').click();assert(guest.$('#login-dialog').open);
    guest.$('#phone').value='13800000000';guest.$('#password').value='test-only';
    await guest.$('#login-form').onsubmit({preventDefault(){}});await tick();
    assert.equal(guest.$('#password').value,'');assert(!guest.$('#login-dialog').open);
    assert.equal(guest.$('#user-name').textContent,'测试同学');assert.equal(guest.$('#resume-label').textContent,'默认模板简历');
  } finally {guest.dom.window.close();}
  console.log('PASS: popup account/login, resume selection, preserve/overwrite settings, dropdown dismissal, tabs/jobs, customer QR, floating command, busy protection');
})().catch(error=>{console.error(error);process.exitCode=1;});
