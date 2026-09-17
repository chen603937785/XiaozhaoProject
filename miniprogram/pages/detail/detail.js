const { get, post, del } = require('../../utils/request');
const { decorate } = require('../../utils/job');

let rewardedAd = null;

Page({
  data: {
    id: null,
    job: null,
    favorite: false,
    loading: true,
    showAdConfirm: false
  },

  onLoad(options) {
    const id = options.id;
    this.setData({ id });
    this.initRewardAd();
    this.loadDetail(id);
    this.loadFavoriteStatus(id);
  },

  onUnload() {
    rewardedAd = null;
  },

  // 初始化激励视频广告
  initRewardAd() {
    if (!wx.createRewardedVideoAd) return;
    rewardedAd = wx.createRewardedVideoAd({ adUnitId: 'adunit-859d90ea9eedb114' });
    rewardedAd.onError((err) => {
      console.error('激励视频广告加载失败', err);
    });
    rewardedAd.onClose((res) => {
      if (!this.pendingUrl) return;
      const url = this.pendingUrl;
      this.pendingUrl = null;
      if (res && res.isEnded) {
        wx.setStorageSync('reward_ad_date', new Date().toDateString());
        this.copyToClipboard(url);
      } else {
        wx.showToast({ title: '看完广告后才能复制', icon: 'none' });
      }
    });
  },

  loadDetail(id) {
    get('/api/jobs/' + id).then(job => {
      this.setData({ job: decorate(job), loading: false });
    }).catch(err => {
      this.setData({ loading: false });
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
    });
  },

  loadFavoriteStatus(id) {
    get('/api/favorites/status/' + id).then(data => {
      this.setData({ favorite: data.favorite });
    }).catch(() => {});
  },

  toggleFavorite() {
    const { id, favorite } = this.data;
    if (favorite) {
      del('/api/favorites/' + id).then(() => {
        this.setData({ favorite: false });
        wx.showToast({ title: '已取消收藏', icon: 'none' });
      }).catch(err => wx.showToast({ title: err.message, icon: 'none' }));
    } else {
      post('/api/favorites', { jobId: Number(id) }).then(() => {
        this.setData({ favorite: true });
        wx.showToast({ title: '已收藏', icon: 'none' });
      }).catch(err => wx.showToast({ title: err.message, icon: 'none' }));
    }
  },

  copyLink(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) {
      wx.showToast({ title: '暂无链接', icon: 'none' });
      return;
    }
    const config = getApp().globalData.config || {};
    // 配置已加载则直接用, 否则实时拉取(避免 app 启动缓存的旧值)
    if (config.rewardAdEnabled !== undefined) {
      this.tryCopy(url, config);
    } else {
      get('/api/config').then(cfg => {
        getApp().globalData.config = cfg || {};
        this.tryCopy(url, cfg || {});
      }).catch(() => this.tryCopy(url, {}));
    }
  },

  // 依据配置决定是否先看广告
  tryCopy(url, config) {
    if (config.rewardAdEnabled && !this.hasWatchedToday()) {
      this.pendingUrl = url;
      this.setData({ showAdConfirm: true });
      return;
    }
    this.copyToClipboard(url);
  },

  // 确认观看广告
  onAdConfirm() {
    const url = this.pendingUrl;
    this.pendingUrl = null;
    this.setData({ showAdConfirm: false });
    if (url) this.showRewardAd(url);
  },

  // 取消观看广告
  onAdCancel() {
    this.pendingUrl = null;
    this.setData({ showAdConfirm: false });
  },

  // 当日是否已观看过激励广告
  hasWatchedToday() {
    const date = wx.getStorageSync('reward_ad_date');
    return date === new Date().toDateString();
  },

  // 弹出激励视频广告
  showRewardAd(url) {
    if (!rewardedAd) {
      console.warn('激励广告实例不存在(基础库不支持或初始化失败), 直接复制');
      this.copyToClipboard(url);
      return;
    }
    this.pendingUrl = url;
    rewardedAd.show().catch(() => {
      rewardedAd.load()
        .then(() => rewardedAd.show())
        .catch((err) => {
          console.error('激励视频广告显示失败', err);
          const msg = err && (err.errMsg || err.message || '');
          const code = err && err.errCode ? ' code:' + err.errCode : '';
          console.error('激励广告错误详情: ' + msg + code);
          this.pendingUrl = null;
          wx.showToast({ title: '广告加载失败' + code, icon: 'none', duration: 3000 });
        });
    });
  },

  copyToClipboard(url) {
    wx.setClipboardData({
      data: url,
      success() {
        wx.showToast({ title: '链接已复制', icon: 'none' });
      }
    });
  }
});
