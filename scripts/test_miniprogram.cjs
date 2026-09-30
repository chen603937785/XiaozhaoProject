const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../miniprogram');
const storage = new Map();
const calls = [];
let handler;
global.wx = {
  getStorageSync: key => storage.get(key),
  setStorageSync: (key,value) => storage.set(key,value),
  removeStorageSync: key => storage.delete(key),
  request: options => { calls.push(options); handler(options); },
  showToast() {}, showModal() {}, switchTab() {},
  getWindowInfo: () => ({statusBarHeight:20,windowWidth:375})
};
const app = { globalData:{}, syncGlobal() { this.globalData.token=storage.get('token') || ''; this.globalData.phone=storage.get('phone') || ''; } };
global.getApp = () => app;
function page(rel) {
  let config;
  global.Page = value => {config=value;};
  require(path.join(root, rel));
  config.data=JSON.parse(JSON.stringify(config.data));
  config.setData=function(values) { Object.assign(this.data,values); };
  return config;
}
function success(data) { return options => options.success({statusCode:200,data:{code:200,data}}); }
(async () => {
  const auth=require(path.join(root,'utils/auth'));
  const req=require(path.join(root,'utils/request'));
  handler=success({token:'shared-token',userId:42,phone:'13800000000'});
  await auth.login('13800000000','test-password');
  assert(calls.at(-1).url.endsWith('/api/auth/password-login'));
  assert.equal(calls.at(-1).data.password,'test-password');
  assert.equal(storage.get('userId'),42);
  assert.equal(storage.get('login_provider'),'password');
  handler=success({}); await req.get('/api/plans');
  assert.equal(calls.at(-1).header.Authorization,'Bearer shared-token');
  handler=options=>options.success({statusCode:401,data:{code:401,message:'expired'}});
  const before=calls.length;
  await assert.rejects(req.get('/api/plans'), /请先/);
  assert.equal(calls.length,before+1,'401 must not auto-login or replay writes');
  assert(!storage.get('token'));
  handler=success({token:'next',userId:42,phone:'13800000000'}); await auth.register('13800000000','test-password');
  assert(calls.at(-1).url.endsWith('/api/auth/register'));
  const follow=page('pages/favorites/favorites.js');
  follow.setData({jobs:[{mainStatus:'APPLIED',planId:1},{mainStatus:'OFFER',planId:2}],plans:[{id:''},{id:1}],planIndex:1,stage:'APPLIED'});
  follow.filter(); assert.equal(follow.data.visible.length,1);
  const calendar=page('pages/calendar/calendar.js');
  calendar.year=2026; calendar.month=8; calendar.draw();
  assert.equal(calendar.data.cells.filter(c=>!c.blank).length,30);
  assert.equal(calendar.data.cells[0].blank,true); // Sep 1 2026 is Tuesday
  calendar.setData({todos:[{date:'2026-09-29'},{date:'2026-09-30'},{date:''}],selected:'2026-09-29'});
  calendar.filter(); assert.equal(calendar.data.visible.length,2);
  calendar.setData({plans:[{id:1}],planIndex:0,title:'面试',description:'备注',date:'2026-09-29',time:'09:30',priorityIndex:1});
  calendar.load=async()=>{}; handler=success(12); await calendar.save();
  assert.equal(calls.at(-1).method,'POST'); assert.equal(calls.at(-1).data.dueAt,'2026-09-29T09:30:00'); assert.equal(calls.at(-1).data.priority,'IMPORTANT');
  const index=page('pages/index/index.js'); index.setData({meta:{provinces:[{name:'青海省',cities:['青海','西宁','海北','黄南','果洛']}],specialCities:['全国']}});
  index.onFilterTap({currentTarget:{dataset:{type:'city'}}});
  index.onProvinceTap({currentTarget:{dataset:{name:'青海省'}}});
  assert(index.data.cityOptions.some(c=>c.value==='果洛'));
  const config=JSON.parse(fs.readFileSync(path.join(root,'app.json')));
  assert.deepEqual(config.tabBar.list.map(t=>t.text),['工作台','岗位库','关注岗位','待办日历','我的']);
  for(const t of config.tabBar.list) for(const f of [t.pagePath+'.js',t.pagePath+'.wxml',t.pagePath+'.json',t.pagePath+'.wxss',t.iconPath,t.selectedIconPath]) assert(fs.existsSync(path.join(root,f)),f);
  console.log('PASS: shared login/register, token/401, follow filters, calendar, todo creation, province-city, five tabs/assets');
})().catch(e=>{console.error(e);process.exitCode=1;});
