const { BASE_URL } = require('./config');
const { login } = require('./auth');

/**
 * 统一请求封装: 自动携带 token, 401 时自动重登并重试一次
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
        // 未登录或 token 过期 -> 重新登录后重试一次
        if ((res.statusCode === 401 || bizCode === 401) && !retry) {
          login().then(() => {
            request(url, method, data, true).then(resolve).catch(reject);
          }).catch(reject);
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
  del: (url) => request(url, 'DELETE')
};
