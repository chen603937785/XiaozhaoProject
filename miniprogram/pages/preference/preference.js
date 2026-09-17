const { get, post } = require('../../utils/request');

const DIMENSIONS = [
  { key: 'recruitType', label: '招聘类型', field: 'recruitTypes', multi: true },
  { key: 'grade', label: '届别', field: 'grades', multi: false, format: v => v + '届' },
  { key: 'industry', label: '行业', field: 'industries', multi: true },
  { key: 'city', label: '城市', field: 'cities', multi: true },
  { key: 'nature', label: '企业性质', field: 'natures', multi: true },
  { key: 'education', label: '学历', field: 'educations', multi: false }
];

Page({
  data: {
    dimensions: [],
    preference: {}
  },

  onLoad() {
    this.loadData();
  },

  loadData() {
    get('/api/meta/filters').then(meta => {
      return get('/api/user/preference').then(pref => {
        this.buildDimensions(meta, pref || {});
      });
    }).catch(() => {
      // 兜底: 单独加载 meta
      get('/api/meta/filters').then(meta => this.buildDimensions(meta, {}));
    });
  },

  buildDimensions(meta, pref) {
    const dimensions = DIMENSIONS.map(d => {
      const selected = String(pref[d.key] || '').split(',').filter(Boolean);
      return {
        key: d.key,
        label: d.label,
        multi: d.multi,
        options: (meta[d.field] || []).map(o => {
          const v = String(o);
          return {
            value: v,
            label: d.format ? d.format(o) : o,
            selected: selected.includes(v)
          };
        })
      };
    });
    this.setData({ dimensions, preference: pref || {} });
  },

  onOptionTap(e) {
    const dim = e.currentTarget.dataset.dim;
    const value = String(e.currentTarget.dataset.value);
    const d = this.data.dimensions.find(x => x.key === dim);
    const selected = String(this.data.preference[dim] || '').split(',').filter(Boolean);
    let next;
    if (d.multi) {
      next = selected.includes(value) ? selected.filter(v => v !== value) : selected.concat(value);
    } else {
      next = selected.includes(value) ? [] : [value];
    }
    const dimensions = this.data.dimensions.map(x => {
      if (x.key !== dim) return x;
      return { ...x, options: x.options.map(o => ({ ...o, selected: next.includes(o.value) })) };
    });
    this.setData({
      dimensions,
      ['preference.' + dim]: next.join(',')
    });
  },

  save() {
    post('/api/user/preference', this.data.preference).then(() => {
      wx.showToast({ title: '已保存', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 800);
    }).catch(err => wx.showToast({ title: err.message || '保存失败', icon: 'none' }));
  }
});
