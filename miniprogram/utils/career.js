const { get, post } = require('./request');

const STAGES = [
  { key: 'TO_EVALUATE', label: '意向', color: '#7a90a8' },
  { key: 'PREPARING', label: '准备投递', color: '#8b7cf6' },
  { key: 'APPLIED', label: '已投递', color: '#4b87e5' },
  { key: 'ASSESSMENT', label: '笔试', color: '#f5a623' },
  { key: 'INTERVIEW', label: '面试', color: '#17a2a6' },
  { key: 'OFFER', label: 'Offer', color: '#35b779' },
  { key: 'CLOSED', label: '已结束', color: '#9aa6b0' }
];
const SUB_STATUS = {
  ASSESSMENT: ['待笔试', '笔试进行中', '已完成笔试', '等待笔试结果', '笔试通过', '笔试未通过'],
  INTERVIEW: ['待一面', '一面进行中', '等待一面结果', '待二面', '二面进行中', '等待二面结果', '待终面', '终面进行中', 'HR面', '等待最终结果', '面试通过', '面试未通过'],
  OFFER: ['待确认', '已接受', '已拒绝', '签约中', '已签约'],
  CLOSED: ['简历未通过', '笔试未通过', '面试未通过', '主动放弃', '岗位停止招聘', '岗位已过期', '长期无反馈', '已接受其他 Offer', '重复岗位', '其他原因']
};
function requireLogin() {
  if (wx.getStorageSync('token')) return true;
  wx.showModal({ title: '登录账号', content: '使用电脑端相同的手机号和密码，求职数据多端互通。', confirmText: '去登录', success(res) {
    if (res.confirm) wx.switchTab({ url: '/pages/my/my' });
  } });
  return false;
}
function dateKey(date) {
  const d = date || new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function askPlanName() {
  return new Promise(resolve => wx.showModal({ title: '创建求职计划', editable: true, placeholderText: '例如：2027秋招计划', success(res) {
    resolve(res.confirm ? String(res.content || '').trim() : '');
  }, fail() { resolve(''); } }));
}
async function createPlan() {
  const planName = await askPlanName();
  if (!planName) return null;
  return post('/api/plans', { planName, status: 'IN_PROGRESS' });
}
function select(items, title) {
  // 微信 actionSheet 最多 6 个选项；细分状态/多个计划分页展示，不能直接传超长数组。
  return new Promise(resolve => {
    if (!items.length) { resolve(-1); return; }
    function show(start) {
      const current = items.slice(start, start + 4);
      const visible = current.slice();
      const previous = start > 0 ? visible.push('‹ 上一页') - 1 : -1;
      const next = start + 4 < items.length ? visible.push('下一页 ›') - 1 : -1;
      wx.showActionSheet({ itemList: visible, alertText: title, success(res) {
        if (res.tapIndex === previous) show(start - 4);
        else if (res.tapIndex === next) show(start + 4);
        else resolve(start + res.tapIndex);
      }, fail() { resolve(-1); } });
    }
    show(0);
  });
}
async function follow(jobId) {
  if (!requireLogin()) return false;
  const plans = (await get('/api/plans')).filter(p => p.status !== 'ARCHIVED' && p.status !== 'COMPLETED');
  let planId;
  if (!plans.length) planId = await createPlan();
  else {
    const index = await select(plans.map(p => p.planName).concat('创建新计划'), '加入求职计划');
    if (index < 0) return false;
    planId = index === plans.length ? await createPlan() : plans[index].id;
  }
  if (!planId) return false;
  const user = await get('/api/user/info');
  if (!user.isVip || (user.vipExpire && String(user.vipExpire).slice(0, 10) < dateKey())) {
    wx.showModal({ title: '会员权益', content: '关注岗位与进度管理需要会员，请在「我的」兑换会员。', confirmText: '去兑换', success(res) { if (res.confirm) wx.switchTab({ url: '/pages/my/my' }); } });
    return false;
  }
  await post('/api/job-status/follow', { jobId: Number(jobId), planId });
  wx.showToast({ title: '已关注', icon: 'success' });
  return true;
}
module.exports = { STAGES, SUB_STATUS, requireLogin, dateKey, createPlan, select, follow };
