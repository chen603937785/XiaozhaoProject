const { BASE_URL } = require('./utils/config');

App({
  globalData: {
    token: '',
    userId: null,
    phone: '',
    needBindPhone: false,
    config: {}
  },

  onLaunch() {
    // 旧版本 token 来自微信独立账号，升级后需重新登录客户端账号，避免显示错用户的数据。
    if (wx.getStorageSync('login_provider') !== 'password') {
      ['token', 'userId', 'phone'].forEach(key => wx.removeStorageSync(key));
    }
    this.syncGlobal();
    this.loadConfig();
  },

  // 读取系统配置(激励广告开关/绑定手机号开关)
  loadConfig() {
    wx.request({
      url: BASE_URL + '/api/config',
      method: 'GET',
      success: (res) => {
        if (res.data && res.data.code === 200) {
          this.globalData.config = res.data.data || {};
        }
      },
      fail: () => {}
    });
  },

  // 同步全局登录状态
  syncGlobal() {
    this.globalData.token = wx.getStorageSync('token') || '';
    this.globalData.userId = wx.getStorageSync('userId') || null;
    this.globalData.phone = wx.getStorageSync('phone') || '';
    this.globalData.needBindPhone = !!this.globalData.token && !this.globalData.phone;
  }
});
