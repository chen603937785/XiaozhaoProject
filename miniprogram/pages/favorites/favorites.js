const { get, del } = require('../../utils/request');
const { decorate } = require('../../utils/job');

Page({
  data: {
    jobs: [],
    loading: true
  },

  onShow() {
    this.loadFavorites();
  },

  onPullDownRefresh() {
    this.loadFavorites().finally(() => wx.stopPullDownRefresh());
  },

  loadFavorites() {
    this.setData({ loading: true });
    return get('/api/favorites').then(jobs => {
      this.setData({ jobs: (jobs || []).map(j => decorate(j)), loading: false });
    }).catch(err => {
      this.setData({ loading: false });
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
    });
  },

  removeFavorite(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '取消收藏',
      content: '确定取消收藏该岗位吗？',
      success: (res) => {
        if (!res.confirm) return;
        del('/api/favorites/' + id).then(() => {
          wx.showToast({ title: '已取消收藏', icon: 'none' });
          this.loadFavorites();
        }).catch(err => wx.showToast({ title: err.message, icon: 'none' }));
      }
    });
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/detail/detail?id=' + id });
  }
});
