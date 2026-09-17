const { login } = require('../../utils/auth');
const { get } = require('../../utils/request');

Page({
  data: {
    loggedIn: false,
    phone: '',
    statusBarHeight: 20,
    favCount: 0,
    matchCount: 0,
    applyCount: 0,
    viewCount: 0,
    tab: 'fav',
    innerTitle: '最近收藏的岗位',
    innerCount: '0 条',
    innerTime: ''
  },

  onLoad() {
    const sys = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    this.setData({ statusBarHeight: sys.statusBarHeight || 20 });
  },

  onShow() {
    this.loadUserInfo();
  },

  loadUserInfo() {
    const app = getApp();
    const phone = app.globalData.phone || wx.getStorageSync('phone') || '';
    const loggedIn = !!app.globalData.token;
    this.setData({ phone, loggedIn });
    this.loadStats();
  },

  // 加载统计(收藏数真实, 其余占位)
  loadStats() {
    const now = new Date();
    const pad = n => (n < 10 ? '0' + n : n);
    this.setData({
      innerTime: (now.getMonth() + 1) + '月' + now.getDate() + '日 ' + pad(now.getHours()) + ':' + pad(now.getMinutes())
    });
    get('/api/favorites').then(jobs => {
      const favCount = (jobs || []).length;
      this.setData({
        favCount,
        innerCount: favCount + ' 条',
        innerTitle: favCount > 0 ? '最近收藏的岗位' : '暂无收藏内容'
      });
    }).catch(() => {});
  },

  // 登录校验: 未登录则先登录
  requireLogin() {
    const app = getApp();
    if (app.globalData.token) {
      return Promise.resolve(true);
    }
    wx.showLoading({ title: '登录中' });
    return login().then(() => {
      wx.hideLoading();
      app.syncGlobal();
      this.loadUserInfo();
      return true;
    }).catch(() => {
      wx.hideLoading();
      wx.showToast({ title: '登录失败，请重试', icon: 'none' });
      return false;
    });
  },

  onBindPhone() {
    this.requireLogin().then(ok => {
      if (!ok) return;
      const app = getApp();
      if (app.globalData.phone) {
        wx.showToast({ title: '已绑定 ' + app.globalData.phone, icon: 'none' });
      } else {
        wx.switchTab({ url: '/pages/index/index' });
      }
    });
  },

  onTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ tab });
  },

  goPreference() {
    this.requireLogin().then(ok => {
      if (ok) wx.navigateTo({ url: '/pages/preference/preference' });
    });
  },

  goFavorites() {
    this.requireLogin().then(ok => {
      if (ok) wx.navigateTo({ url: '/pages/favorites/favorites' });
    });
  }
});
