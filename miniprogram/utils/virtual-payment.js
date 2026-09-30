const { get, post } = require('./request');

function checkIosVersion() {
  const sys = wx.getSystemInfoSync();
  if (sys.platform !== 'ios') return true;
  const cur = String(sys.version || '').split('.').map(Number);
  const base = [8, 0, 68];
  for (let i = 0; i < 3; i++) { if ((cur[i] || 0) > base[i]) return true; if ((cur[i] || 0) < base[i]) break; }
  wx.showModal({ title: '提示', content: '请将微信更新至 8.0.68 及以上版本后再进行支付', showCancel: false });
  return false;
}

function wxLoginCode() {
  return new Promise((resolve, reject) => wx.login({ success: r => r.code ? resolve(r.code) : reject(new Error('微信登录失败')), fail: reject }));
}

async function buy(planType, priceFen, onDone) {
  if (!wx.getStorageSync('token')) { wx.showToast({ title: '请先登录', icon: 'none' }); return; }
  if (!checkIosVersion() || typeof wx.requestVirtualPayment !== 'function') { wx.showToast({ title: '当前微信版本不支持虚拟支付', icon: 'none' }); return; }
  try {
    const code = await wxLoginCode();
    const payData = await post('/api/pay/order', { planType, priceFen, wxLoginCode: code });
    wx.requestVirtualPayment({ ...payData, success: () => { wx.showToast({ title: '支付已提交' }); let tries = 0; const poll = () => query(payData.outTradeNo).then(r => { if (r.status === 'DELIVERED') { onDone && onDone(payData.outTradeNo); return; } if (++tries < 5) setTimeout(poll, 3000); }).catch(() => { if (++tries < 5) setTimeout(poll, 3000); }); poll(); }, fail: err => wx.showToast({ title: err.errMsg || '支付失败', icon: 'none' }) });
  } catch (e) { wx.showToast({ title: e.message, icon: 'none' }); }
}

function query(outTradeNo) { return post('/api/pay/query', { outTradeNo }); }
module.exports = { buy, query, checkIosVersion };
