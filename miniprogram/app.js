const { login } = require('./utils/auth');
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
    this.loginSilently();
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

  loginSilently() {
    const token = wx.getStorageSync('token');
    if (token) {
      this.syncGlobal();
      return;
    }
    login().then((d) => {
      this.syncGlobal();
    }).catch(() => {
      // 静默失败, 后续操作再触发
    });
  },

  // 同步全局登录状态
  syncGlobal() {
    this.globalData.token = wx.getStorageSync('token') || '';
    this.globalData.userId = wx.getStorageSync('userId') || null;
    this.globalData.phone = wx.getStorageSync('phone') || '';
    this.globalData.needBindPhone = !this.globalData.phone;
  }
});
