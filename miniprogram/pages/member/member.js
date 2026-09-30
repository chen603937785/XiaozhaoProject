const { get } = require('../../utils/request');
const { buy } = require('../../utils/virtual-payment');

const FALLBACK_PLANS = [
  { planType: 'MONTH', name: '月卡', days: 30, priceFen: 990 },
  { planType: 'QUARTER', name: '季卡', days: 90, priceFen: 2590 },
  { planType: 'YEAR', name: '年卡', days: 365, priceFen: 8800 }
];

Page({
  data: {
    user: {}, avatarName: '我', loggedIn: false, selected: 'MONTH', plans: [], benefits: [
      { icon: '▤', title: '岗位每日更新', desc: '全网岗位持续更新' },
      { icon: '⌘', title: '多端互通共用', desc: '手机、电脑、客户端同步' },
      { icon: '☆', title: '关注与进度管理', desc: '不错过每一个机会' },
      { icon: '✦', title: '赠送：快速填写网申插件', desc: '别再手填了', gift: true }
    ], loading: true, paying: false, countdown: '01:29:57', agreed: true, error: '', selectedPriceText: '0.00'
  },
  onLoad() { this.load(); this.startCountdown(); },
  onUnload() { if (this.timer) clearInterval(this.timer); },
  async load() {
    try {
      const token = wx.getStorageSync('token');
      const tasks = [get('/api/pay/catalog')];
      if (token) tasks.push(get('/api/user/info'));
      const result = await Promise.all(tasks);
      const source = Array.isArray(result[0]) && result[0].length ? result[0] : FALLBACK_PLANS;
      const plans = this.decoratePlans(source);
      const first = plans.find(item => item.planType === this.data.selected) || plans[0] || {};
      const user = result[1] || {};
      this.setData({ plans, selectedPriceText: first.priceText || '0.00', user, avatarName: String(user.nickname || '我').slice(-1), loggedIn: !!token, loading: false });
    } catch (e) {
      const plans = this.decoratePlans(FALLBACK_PLANS);
      this.setData({ plans, selectedPriceText: plans[0].priceText, loggedIn: !!wx.getStorageSync('token'), loading: false, error: '会员套餐暂时加载失败，请稍后重试' });
    }
  },
  startCountdown() {
    let seconds = 5397;
    this.timer = setInterval(() => {
      if (seconds <= 0) { clearInterval(this.timer); return; }
      seconds -= 1;
      const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
      const m = String(Math.floor(seconds % 3600 / 60)).padStart(2, '0');
      const s = String(seconds % 60).padStart(2, '0');
      this.setData({ countdown: h + ':' + m + ':' + s });
    }, 1000);
  },
  decoratePlans(source) { return source.map(item => { const price = Number(item.priceFen || 0) / 100; return Object.assign({}, item, { priceText: price.toFixed(2), dailyText: item.days ? (price / item.days).toFixed(2) : '—' }); }); },
  selectPlan(e) { if (this.data.paying) return; const plan = this.data.plans.find(item => item.planType === e.currentTarget.dataset.type) || {}; this.setData({ selected: e.currentTarget.dataset.type, selectedPriceText: plan.priceText || '0.00' }); },
  toggleAgreement() { this.setData({ agreed: !this.data.agreed }); },
  async pay() {
    if (!this.data.loggedIn) { wx.showToast({ title: '请先登录', icon: 'none' }); return; }
    if (!this.data.agreed) { wx.showToast({ title: '请先同意支付协议', icon: 'none' }); return; }
    if (this.data.paying) return;
    const plan = this.data.plans.find(item => item.planType === this.data.selected);
    if (!plan || !plan.priceFen || !plan.productId) { wx.showToast({ title: '支付套餐暂未开放', icon: 'none' }); return; }
    this.setData({ paying: true, error: '' });
    try { await buy(plan.planType, plan.priceFen, () => { wx.showToast({ title: '会员已开通' }); this.load(); }); }
    finally { this.setData({ paying: false }); }
  },
});
