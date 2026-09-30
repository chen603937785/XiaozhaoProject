Component({
  properties: { section: { type: String, value: '' } },
  data: { statusHeight: 20, navHeight: 44, contentWidth: 200 },
  lifetimes: { attached() { this.measure(); } },
  pageLifetimes: { resize() { this.measure(); }, show() { this.measure(); } },
  methods: {
    measure() {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      const statusHeight = info.statusBarHeight || 20;
      let capsule;
      try { capsule = wx.getMenuButtonBoundingClientRect(); } catch (e) {}
      const valid = capsule && capsule.width > 0 && capsule.top >= statusHeight;
      const navHeight = valid ? (capsule.top - statusHeight) * 2 + capsule.height : 44;
      this.setData({ statusHeight, navHeight, contentWidth: Math.max(0, (valid ? capsule.left : info.windowWidth - 100) - 28) });
    }
  }
});
