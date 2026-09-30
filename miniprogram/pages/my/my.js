const { login, register, logout } = require('../../utils/auth');
const { get, post } = require('../../utils/request');
const { dateKey, requireLogin } = require('../../utils/career');
Page({
  data: { loggedIn: false, user: {}, avatarInitial: '我', phone: '', password: '', authMode: 'login', showAuth: false, showContact: false, contactQr: '', busy: false, message: '', code: '', prices: [], vipText: '', expiring: false },
  onShow() { this.load(); },
  async load() {
    this.setData({ loggedIn: !!wx.getStorageSync('token'), user: {}, avatarInitial: '我', vipText: '' });
    try {
      const cfg = await get('/api/config');
      const qr = cfg.customerQrImage ? (String(cfg.customerQrImage).indexOf('http') === 0 ? cfg.customerQrImage : require('../../utils/config').BASE_URL + cfg.customerQrImage) : '';
      this.setData({ prices: cfg.vipPrices || [], contactQr: qr });
      if (!wx.getStorageSync('token')) return;
      // 支付目录由后端按已发布道具价格返回，避免使用展示价下单。
      try { const paymentCatalog = await get('/api/pay/catalog'); this.setData({ prices: paymentCatalog || [] }); } catch (ignore) { /* payment remains unavailable */ }
      const user = await get('/api/user/info');
      const expires = String(user.vipExpire || '').slice(0, 10);
      const valid = user.isVip && (!expires || expires >= dateKey());
      const days = expires ? (new Date(expires + 'T00:00:00') - new Date()) / 86400000 : 100;
      const displayName = user.nickname || user.phone || '我';
      this.setData({ loggedIn: true, user, avatarInitial: String(displayName).slice(-1), vipText: valid ? '会员到期：' + (expires || '已开通') : '普通用户 · 开通会员解锁更多功能', expiring: valid && days < 7 });
    } catch (e) { this.setData({ loggedIn: !!wx.getStorageSync('token'), message: e.message }); }
  },
  input(e) { this.setData({ [e.currentTarget.dataset.field]: e.detail.value }); },
  openAuth() { if (this.data.loggedIn) return; this.setData({ showAuth: true, message: '' }); },
  closeAuth() { if (!this.data.busy) this.setData({ showAuth: false, message: '' }); },
  mode(e) { this.setData({ authMode: e.currentTarget.dataset.mode, message: '' }); },
  goPlans() { wx.switchTab({ url: '/pages/favorites/favorites' }); },
  goCalendar() { wx.switchTab({ url: '/pages/calendar/calendar' }); },
  goPreference() { wx.navigateTo({ url: '/pages/preference/preference' }); },
  contact() { this.setData({ showContact: true }); },
  closeContact() { this.setData({ showContact: false }); },
  buyMember() {
    if (!this.data.loggedIn) { this.openAuth(); return; }
    wx.navigateTo({ url: '/pages/member/member' });
  },
  async submit() {
    if (this.data.busy) return;
    const phone = this.data.phone.trim();
    if (!/^1\d{10}$/.test(phone) || this.data.password.length < 6) { this.setData({ message: '请输入正确手机号和至少6位密码' }); return; }
    this.setData({ busy: true, message: '' });
    try {
      await (this.data.authMode === 'login' ? login : register)(phone, this.data.password);
      this.setData({ password: '' });
      await this.load();
      this.setData({ showAuth: false });
      wx.showToast({ title: '登录成功' });
    } catch (e) { this.setData({ message: e.message }); }
    finally { this.setData({ busy: false }); }
  },
  logout() { wx.showModal({ title: '退出登录', content: '确定退出当前账号？', success: res => { if (res.confirm) { logout(); this.setData({ phone: '', password: '', code: '', message: '' }); this.load(); } } }); },
  async redeem() {
    if (!requireLogin() || this.data.busy) return;
    const code = this.data.code.trim();
    if (!code) { this.setData({ message: '请输入兑换码' }); return; }
    this.setData({ busy: true });
    try { await post('/api/redeem', { code }); this.setData({ code: '', message: '兑换成功' }); await this.load(); }
    catch (e) { this.setData({ message: e.message }); }
    finally { this.setData({ busy: false }); }
  },
  nickname() {
    wx.showModal({ title: '设置昵称', editable: true, placeholderText: '输入昵称', success: async res => {
      if (!res.confirm || !String(res.content || '').trim()) return;
      try { await post('/api/user/nickname', { nickname: res.content.trim() }); this.load(); }
      catch (e) { wx.showToast({ title: e.message, icon: 'none' }); }
    } });
  }
});
