const { get, put, del, post } = require('../../utils/request');
const { STAGES, SUB_STATUS, requireLogin, select, dateKey } = require('../../utils/career');
Page({
  data: { jobs: [], visible: [], loading: false, loggedIn: false, error: '', stage: '', stages: [{ key: '', label: '全部' }].concat(STAGES), plans: [], planIndex: 0, showProgress: false, progressOptions: STAGES, progressJobId: '', progressStage: '', progressSubOptions: [], progressSubStatus: '', showReminder: false, reminderJobId: '', reminderDate: dateKey(), reminderTime: '09:00', today: dateKey() },
  onShow() { const stage = wx.getStorageSync('follow_stage'); if (stage) { this.setData({ stage }); wx.removeStorageSync('follow_stage'); } this.load(); },
  onPullDownRefresh() { this.load().finally(() => wx.stopPullDownRefresh()); },
  async load() {
    this.setData({ jobs: [], visible: [], loggedIn: !!wx.getStorageSync('token'), error: '' });
    if (!wx.getStorageSync('token')) return;
    this.setData({ loading: true });
    try {
      const results = await Promise.all([get('/api/job-status/list'), get('/api/plans')]);
      const jobs = (results[0] || []).map(j => ({ ...j, planName: ((results[1] || []).find(p => p.id === j.planId) || {}).planName || '未关联计划', label: (STAGES.find(s => s.key === j.mainStatus) || {}).label || j.mainStatus, position: (j.positions || '').split(',').slice(0, 2).join(' · '), time: String(j.expectedStartAt || '').replace('T', ' ').slice(0, 16) }));
      this.setData({ jobs, plans: [{ id: '', planName: '全部计划' }].concat(results[1] || []), planIndex: 0 });
      this.filter();
    } catch (e) { this.setData({ error: e.message, loggedIn: !!wx.getStorageSync('token') }); }
    finally { this.setData({ loading: false }); }
  },
  filter() { const plan = this.data.plans[this.data.planIndex]; this.setData({ visible: this.data.jobs.filter(j => (!this.data.stage || j.mainStatus === this.data.stage) && (!plan || !plan.id || j.planId === plan.id)) }); },
  stage(e) { this.setData({ stage: e.currentTarget.dataset.key }); this.filter(); },
  plan(e) { this.setData({ planIndex: Number(e.detail.value) }); this.filter(); },
  login() { wx.switchTab({ url: '/pages/my/my' }); },
  detail(e) { wx.navigateTo({ url: '/pages/detail/detail?id=' + e.currentTarget.dataset.id }); },
  update(e) { const job = this.data.jobs.find(j => String(j.jobId) === String(e.currentTarget.dataset.id)); const stage = job && STAGES.find(s => s.key === job.mainStatus); this.setData({ showProgress: true, progressJobId: e.currentTarget.dataset.id, progressStage: stage ? stage.key : 'TO_EVALUATE', progressSubOptions: SUB_STATUS[stage ? stage.key : 'TO_EVALUATE'] || [], progressSubStatus: job && job.subStatus || '' }); },
  closeSheet() { this.setData({ showProgress: false, showReminder: false }); },
  chooseProgress(e) { const key = e.currentTarget.dataset.key; this.setData({ progressStage: key, progressSubOptions: SUB_STATUS[key] || [], progressSubStatus: '' }); },
  chooseSubProgress(e) { this.setData({ progressSubStatus: e.currentTarget.dataset.value }); },
  async saveProgress() { const stage = this.data.progressStage; const subStatus = this.data.progressSubStatus; if ((SUB_STATUS[stage] || []).length && !subStatus) { wx.showToast({ title: '请选择细分状态', icon: 'none' }); return; } try { await put('/api/job-status/' + this.data.progressJobId + '/status', { mainStatus: stage, subStatus, reason: stage === 'CLOSED' ? subStatus : '' }); this.closeSheet(); this.load(); } catch (err) { wx.showToast({ title: err.message, icon: 'none' }); } },
  remove(e) { wx.showModal({ title: '取消关注', content: '确定取消关注该岗位？', success: res => { if (res.confirm) del('/api/job-status/follow/' + e.currentTarget.dataset.id).then(() => this.load()).catch(err => wx.showToast({ title: err.message, icon: 'none' })); } }); },
  expected(e) { const job = this.data.jobs.find(j => String(j.jobId) === String(e.currentTarget.dataset.id)); const value = String(job && job.expectedStartAt || ''); this.setData({ showReminder: true, reminderJobId: e.currentTarget.dataset.id, reminderDate: value.slice(0, 10) || dateKey(), reminderTime: value.slice(11, 16) || '09:00' }); },
  changeReminderDate(e) { this.setData({ reminderDate: e.detail.value }); },
  changeReminderTime(e) { this.setData({ reminderTime: e.detail.value }); },
  async saveReminder() { try { await put('/api/job-status/' + this.data.reminderJobId + '/expected-start', { expectedStartAt: this.data.reminderDate + 'T' + this.data.reminderTime + ':00' }); this.closeSheet(); this.load(); } catch (err) { wx.showToast({ title: err.message, icon: 'none' }); } },
  async clearReminder() { try { await put('/api/job-status/' + this.data.reminderJobId + '/expected-start', { expectedStartAt: '' }); this.closeSheet(); this.load(); } catch (err) { wx.showToast({ title: err.message, icon: 'none' }); } },
  async move(e) {
    const plans = this.data.plans.filter(p => p.id);
    if (!plans.length) return;
    const index = await select(plans.map(p => p.planName), '调整所属计划');
    if (index < 0) return;
    try { await post('/api/plans/move-job', { jobId: e.currentTarget.dataset.id, targetPlanId: plans[index].id, resetStatus: false }); this.load(); }
    catch (err) { wx.showToast({ title: err.message, icon: 'none' }); }
  }
});
