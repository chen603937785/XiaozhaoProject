const { BASE_URL } = require('./config');

/**
 * 微信登录: wx.login 获取 code -> 后端换 token
 * 使用原生 wx.request 避免与 request.js 循环依赖
 */
function login() {
  return new Promise((resolve, reject) => {
    wx.login({
      success(res) {
        if (!res.code) {
          reject(new Error('获取登录凭证失败'));
          return;
        }
        wx.request({
          url: BASE_URL + '/api/auth/login',
          method: 'POST',
          data: { code: res.code },
          header: { 'Content-Type': 'application/json' },
          success(r) {
            if (r.data && r.data.code === 200 && r.data.data) {
              const d = r.data.data;
              wx.setStorageSync('token', d.token);
              wx.setStorageSync('userId', d.userId);
              wx.setStorageSync('phone', d.phone || '');
              resolve(d);
            } else {
              reject(new Error(r.data && r.data.message ? r.data.message : '登录失败'));
            }
          },
          fail: reject
        });
      },
      fail: reject
    });
  });
}

module.exports = { login };
