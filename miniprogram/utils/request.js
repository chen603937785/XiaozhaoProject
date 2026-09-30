const { BASE_URL } = require('./config');

/**
 * 统一请求封装：自动携带客户端同款 token。过期后提示重新登录，不切换成微信匿名账号。
 */
function request(url, method, data, retry) {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('token');
    wx.request({
      url: BASE_URL + url,
      method: method,
      data: data,
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? 'Bearer ' + token : ''
      },
      success(res) {
        const bizCode = res.data && res.data.code;
        if (res.statusCode === 401 || bizCode === 401) {
          if (token) {
            ['token', 'userId', 'phone'].forEach(key => wx.removeStorageSync(key));
            getApp().syncGlobal();
          }
          reject(new Error('请先在「我的」登录'));
          return;
        }
        if (res.statusCode >= 200 && res.statusCode < 300 && bizCode === 200) {
          resolve(res.data.data);
        } else {
          const msg = (res.data && res.data.message) || '请求失败';
          reject(new Error(msg));
        }
      },
      fail(err) {
        reject(new Error('网络请求失败: ' + (err.errMsg || '')));
      }
    });
  });
}

module.exports = {
  get: (url) => request(url, 'GET'),
  post: (url, data) => request(url, 'POST', data),
  put: (url, data) => request(url, 'PUT', data),
  del: (url) => request(url, 'DELETE')
};
