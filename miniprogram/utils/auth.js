const { BASE_URL } = require('./config');

// 与桌面客户端共用手机号账号和 /api/auth/password-login、/api/auth/register。
function accountRequest(path, phone, password) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: BASE_URL + path,
      method: 'POST',
      data: { phone, password },
      header: { 'Content-Type': 'application/json' },
      success(res) {
        if (res.statusCode === 200 && res.data && res.data.code === 200 && res.data.data) {
          const user = res.data.data;
          wx.setStorageSync('token', user.token);
          wx.setStorageSync('userId', user.userId);
          wx.setStorageSync('phone', user.phone || '');
          wx.setStorageSync('login_provider', 'password');
          getApp().syncGlobal();
          resolve(user);
        } else {
          reject(new Error((res.data && res.data.message) || '登录失败'));
        }
      },
      fail() { reject(new Error('网络请求失败，请稍后重试')); }
    });
  });
}

function logout() {
  ['token', 'userId', 'phone', 'login_provider'].forEach(key => wx.removeStorageSync(key));
  getApp().syncGlobal();
}

module.exports = {
  login: (phone, password) => accountRequest('/api/auth/password-login', phone, password),
  register: (phone, password) => accountRequest('/api/auth/register', phone, password),
  logout
};
