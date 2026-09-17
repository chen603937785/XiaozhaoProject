const { get } = require('../../utils/request');
const { decorate } = require('../../utils/job');

Page({
  data: {
    companyName: '',
    jobs: [],
    loading: true
  },

  onLoad(options) {
    const name = decodeURIComponent(options.name || '');
    this.setData({ companyName: name });
    wx.setNavigationBarTitle({ title: name });
    this.loadJobs();
  },

  onPullDownRefresh() {
    this.loadJobs().finally(() => wx.stopPullDownRefresh());
  },

  loadJobs() {
    this.setData({ loading: true });
    return get('/api/jobs?companyName=' + encodeURIComponent(this.data.companyName) + '&page=1&size=100').then(data => {
      this.setData({
        jobs: (data.records || []).map(j => decorate(j)),
        loading: false
      });
    }).catch(err => {
      this.setData({ loading: false });
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
    });
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/detail/detail?id=' + id });
  }
});
