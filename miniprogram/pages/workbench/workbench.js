const { get, post, put } = require('../../utils/request');
const { requireLogin, createPlan, dateKey, STAGES, select } = require('../../utils/career');
Page({
  data: { loggedIn: false, loading: false, error: '', name: '同学', greeting: '', todayLabel: '', plans: [], planIndex: 0, current: null, stages: [], todos: [], total: 0 },
  onShow() { this.load(); },
  async loadJobStats() {
    const format = n => {
      if (n === undefined || n === null) return '—';
      return Number(n) >= 10000 ? (Number(n) / 10000).toFixed(1).replace(/\.0$/, '') + 'w' : String(n);
    };
    try {
      const meta = await get('/api/meta/filters');
      this.setData({ newJobsText: format(meta.last7DaysCount), allJobsText: format(meta.totalJobs), companiesText: format(meta.companyCount), statsError: '' });
    } catch (e) { this.setData({ statsError: '岗位统计暂未加载，点击重试' }); }
  },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },
  async load() {
    const loggedIn = !!wx.getStorageSync('token');
    await this.loadJobStats();
    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 6 ? '夜深了' : hour < 9 ? '早上好' : hour < 12 ? '上午好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    this.setData({ loggedIn, greeting, todayLabel: (now.getMonth() + 1) + '月' + now.getDate() + '日 · ' + weekdays[now.getDay()], name: loggedIn ? this.data.name : '同学', error: '', plans: [], current: null, stages: [], todos: [], total: 0 });
    if (!loggedIn) return;
    this.setData({ loading: true });
    try {
      const results = await Promise.all([get('/api/user/info'), get('/api/plans')]);
      const user = results[0], plans = results[1] || [];
      const wanted = this.selectedPlanId;
      let index = plans.findIndex(p => p.id === wanted);
      if (index < 0) index = Math.max(0, plans.findIndex(p => p.status === 'IN_PROGRESS'));
      const current = plans[index] || null;
      this.selectedPlanId = current && current.id;
      this.setData({ name: user.nickname || (user.phone ? '用户' + user.phone.slice(-4) : '同学'), plans, planIndex: index, current });
      const query = current ? '?planId=' + current.id : '';
      const data = await Promise.all([get('/api/job-status/list' + query), get('/api/todos' + query)]);
      const jobs = data[0] || [];
      this.setData({ total: jobs.length, stages: STAGES.slice(0, 6).map(s => ({ ...s, count: jobs.filter(j => j.mainStatus === s.key).length })), todos: (data[1] || []).filter(t => t.status !== 'COMPLETED' && t.dueAt && String(t.dueAt).slice(0, 10) <= dateKey()).map(t => ({ ...t, time: String(t.dueAt).replace('T', ' ').slice(0, 16) })) });
    } catch (e) { this.setData({ error: e.message, loggedIn: !!wx.getStorageSync('token') }); }
    finally { this.setData({ loading: false }); }
  },
  login() { wx.switchTab({ url: '/pages/my/my' }); },
  choosePlan(e) { const plan = this.data.plans[Number(e.detail.value)]; this.selectedPlanId = plan.id; this.load(); },
  async newPlan() { if (!requireLogin()) return; try { const id = await createPlan(); if (id) { this.selectedPlanId = id; this.load(); } } catch (e) { wx.showToast({ title: e.message, icon: 'none' }); } },
  activate() { if (!this.data.current) return; post('/api/plans/' + this.data.current.id + '/active').then(() => this.load()).catch(e => wx.showToast({ title: e.message, icon: 'none' })); },
  async manage() {
    const plan=this.data.current;
    if (!plan) return;
    const options=['修改计划名称','设置投递目标','设置面试目标','设置 Offer 目标','暂停计划','完成计划','归档计划'];
    const index=await select(options,'管理求职计划');
    if(index<0) return;
    if(index>=4) {
      const action=['pause','complete','archive'][index-4];
      wx.showModal({title:options[index],content:'确认'+options[index]+'「'+plan.planName+'」？',success:res=>{
        if(res.confirm) post('/api/plans/'+plan.id+'/'+action).then(()=>this.load()).catch(e=>wx.showToast({title:e.message,icon:'none'}));
      }});
      return;
    }
    const field=['planName','targetApplyCount','targetInterviewCount','targetOfferCount'][index];
    wx.showModal({title:options[index],editable:true,placeholderText:index===0 ? '例如：2027秋招计划' : '填写目标数量，例如：100',success:async res=>{
      if(!res.confirm) return;
      const value=String(res.content || '').trim();
      if(!value || (index>0 && !/^\d{1,6}$/.test(value))) {wx.showToast({title:'请填写有效内容',icon:'none'});return;}
      try {await put('/api/plans/'+plan.id,{[field]:index===0 ? value : Number(value)});this.load();}
      catch(e) {wx.showToast({title:e.message,icon:'none'});}
    }});
  },
  stage(e) { wx.setStorageSync('follow_stage', e.currentTarget.dataset.key); wx.switchTab({ url: '/pages/favorites/favorites' }); },
  follow() { wx.switchTab({ url: '/pages/favorites/favorites' }); },
  jobs() { wx.switchTab({ url: '/pages/index/index' }); },
  calendar() { wx.switchTab({ url: '/pages/calendar/calendar' }); },
  complete(e) { put('/api/todos/' + e.currentTarget.dataset.id, { status: 'COMPLETED' }).then(() => this.load()).catch(err => wx.showToast({ title: err.message, icon: 'none' })); }
});
