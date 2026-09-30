const { get, post, put, del } = require('../../utils/request');
const { requireLogin, dateKey } = require('../../utils/career');
Page({
  data: { loggedIn: false, todos: [], visible: [], cells: [], month: '', selected: dateKey(), weeks: ['一','二','三','四','五','六','日'], showForm: false, title: '', description: '', date: dateKey(), time: '18:00', priorities: ['普通','重要','紧急'], priorityIndex: 0, plans: [], planIndex: 0, saving: false, error: '' },
  onLoad() { const now = new Date(); this.year = now.getFullYear(); this.month = now.getMonth(); this.draw(); },
  onShow() { this.load(); },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },
  async load() {
    this.setData({ loggedIn: !!wx.getStorageSync('token'), todos: [], visible: [], error: '' });
    if (!wx.getStorageSync('token')) { this.draw(); return; }
    try { const results = await Promise.all([get('/api/todos'), get('/api/plans')]); this.setData({ todos: (results[0] || []).map(t => ({ ...t, date: String(t.dueAt || '').slice(0, 10), time: String(t.dueAt || '').replace('T', ' ').slice(0,16) })), plans: [{id: null, planName:'不关联计划'}].concat(results[1] || []), planIndex:0 }); }
    catch (e) { this.setData({ error: e.message, loggedIn: !!wx.getStorageSync('token') }); }
    this.draw(); this.filter();
  },
  draw() {
    const first = new Date(this.year, this.month, 1), offset = (first.getDay() + 6) % 7;
    const days = new Date(this.year, this.month + 1, 0).getDate(), cells = [];
    for (let i=0; i<offset; i++) cells.push({ key: 'blank-' + i, blank: true });
    for (let day=1; day<=days; day++) { const key = dateKey(new Date(this.year, this.month, day)); cells.push({ key, day, today: key === dateKey(), count: this.data.todos.filter(t => t.date === key && t.status !== 'COMPLETED').length }); }
    this.setData({ cells, month: this.year + '年' + (this.month+1) + '月' });
  },
  change(e) { const d = new Date(this.year, this.month + Number(e.currentTarget.dataset.delta),1); this.year=d.getFullYear(); this.month=d.getMonth(); this.draw(); },
  day(e) { if (!e.currentTarget.dataset.key || e.currentTarget.dataset.key.indexOf('blank')===0) return; this.setData({ selected:e.currentTarget.dataset.key }); this.filter(); },
  filter() { this.setData({ visible: this.data.todos.filter(t => t.date === this.data.selected || !t.date) }); },
  login() { wx.switchTab({ url:'/pages/my/my' }); },
  newTodo() { if (requireLogin()) this.setData({ showForm:true, title:'', description:'', date:this.data.selected, time:'18:00', priorityIndex:0, error:'' }); },
  close() { if (!this.data.saving) this.setData({ showForm:false }); },
  stopBubble() {},
  today() { const now = new Date(); this.year = now.getFullYear(); this.month = now.getMonth(); this.setData({ selected: dateKey() }); this.draw(); this.filter(); },
  choosePriority(e) { this.setData({ priorityIndex: Number(e.currentTarget.dataset.index) }); },
  input(e) { this.setData({ [e.currentTarget.dataset.field]:e.detail.value }); },
  async save() {
    if (this.data.saving) return;
    if (!this.data.title.trim()) { this.setData({ error:'请输入待办名称' }); return; }
    this.setData({ saving:true });
    try { const plan=this.data.plans[this.data.planIndex]; await post('/api/todos', { title:this.data.title.trim(), description:this.data.description, dueAt:this.data.date+'T'+this.data.time+':00', priority:['NORMAL','IMPORTANT','URGENT'][this.data.priorityIndex], todoType:'CUSTOM', planId:plan && plan.id }); this.setData({ showForm:false }); await this.load(); }
    catch(e) { this.setData({ error:e.message }); }
    finally { this.setData({ saving:false }); }
  },
  toggle(e) { put('/api/todos/'+e.currentTarget.dataset.id, {status:e.currentTarget.dataset.status==='COMPLETED'?'PENDING':'COMPLETED'}).then(()=>this.load()).catch(err=>wx.showToast({title:err.message,icon:'none'})); },
  remove(e) { wx.showModal({title:'删除待办',content:'确定删除此待办？',success:res=>{if(res.confirm) del('/api/todos/'+e.currentTarget.dataset.id).then(()=>this.load()).catch(err=>wx.showToast({title:err.message,icon:'none'}));}}); }
});
