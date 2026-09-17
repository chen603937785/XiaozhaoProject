const { get, post } = require('../../utils/request');

// 筛选维度配置
const PANEL_CONFIG = {
  recruitType: { label: '招聘类型', field: 'recruitType', key: 'recruitTypes', multi: true },
  grade: { label: '届别', field: 'grade', key: 'grades', multi: false, format: v => v + '届' },
  industry: { label: '行业', field: 'industry', key: 'industries', multi: true },
  city: { label: '城市', field: 'city', key: 'cities', multi: true },
  nature: { label: '企业性质', field: 'nature', key: 'natures', multi: true },
  education: { label: '学历', field: 'education', key: 'educations', multi: false }
};

// 顶部分栏
const TABS = [
  { key: 'all', label: '全部' },
  { key: 'central', label: '央国企' },
  { key: 'match', label: '与我匹配' }
];

// 企业性质 -> 颜色 class 映射
const NATURE_CLASS = {
  '央国企': 'central',
  '民企': 'private',
  '外企/合资': 'foreign',
  '事业单位': 'institution',
  '社会机构/公益组织': 'public',
  '其他': 'other'
};

Page({
  data: {
    // 状态栏高度(自定义导航)
    statusBarHeight: 20,
    // 胶囊按钮右侧留白(自定义导航)
    menuRight: 0,
    // 搜索
    searchOpen: false,
    keyword: '',
    // 分栏
    tabs: TABS,
    currentTab: 'all',
    // 与我匹配
    matchPref: {},
    matchSummary: '',
    hasMatchPref: false,
    // 公司列表
    companies: [],
    page: 1,
    hasMore: true,
    loading: false,
    total: 0,
    latestUpdate: '',
    latestCount: 0,

    meta: {},

    filters: {
      recruitType: '',
      grade: '',
      industry: '',
      city: '',
      nature: '',
      education: '',
      sort: 'publish'
    },

    // 筛选面板
    showPanel: false,
    panelConfig: null,
    panelOptions: [],
    panelSelected: [],

    // 城市二级筛选
    cityPanelLevel: 'province',
    cityCurrentProvince: '',
    cityProvinces: [],
    citySpecial: [],
    cityOptions: [],

    // 绑定手机号弹窗
    showBindPhone: false,
    bindPhoneInput: ''
  },

  onLoad() {
    const sys = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    let menuRight = 0;
    try {
      const menuBtn = wx.getMenuButtonBoundingClientRect();
      menuRight = sys.windowWidth - menuBtn.left + 8;
    } catch (e) {}
    this.setData({
      statusBarHeight: sys.statusBarHeight || 20,
      menuRight
    });
    this.loadMeta();
    this.loadCompanies(true);
  },

  onShow() {
    this.checkBindPhone();
  },

  onPullDownRefresh() {
    this.loadCompanies(true).finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    this.loadCompanies(false);
  },

  // 加载筛选项字典
  loadMeta() {
    get('/api/meta/filters').then(meta => {
      this.setData({ meta });
    }).catch(() => {});
  },

  // 分栏切换
  onTabTap(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.currentTab) return;
    if (tab === 'match') {
      this.loadMatch();
      return;
    }
    this.setData({ currentTab: tab });
    this.loadCompanies(true);
  },

  // 与我匹配: 读取偏好, 展示横条 + 用偏好筛选结果(不污染 filters)
  loadMatch() {
    get('/api/user/preference').then(pref => {
      const hasPref = pref && Object.keys(pref).some(k => pref[k]);
      this.setData({
        currentTab: 'match',
        matchPref: pref || {},
        matchSummary: this.buildPrefSummary(pref),
        hasMatchPref: hasPref
      });
      if (hasPref) {
        this.loadCompanies(true);
      } else {
        // 未设置偏好, 清空列表, 仅展示横条提示
        this.setData({ companies: [], total: 0, hasMore: false });
      }
    }).catch(() => {
      this.setData({
        currentTab: 'match',
        matchPref: {},
        matchSummary: '',
        hasMatchPref: false,
        companies: [],
        total: 0,
        hasMore: false
      });
    });
  },

  // 偏好 -> 展示文字
  buildPrefSummary(pref) {
    if (!pref) return '';
    const parts = [];
    if (pref.recruitType) parts.push(pref.recruitType);
    if (pref.industry) parts.push(pref.industry);
    if (pref.city) parts.push(pref.city);
    if (pref.nature) parts.push(pref.nature);
    if (pref.grade) parts.push(pref.grade + '届');
    if (pref.education) parts.push(pref.education);
    return parts.join(' · ');
  },

  // 跳转偏好设置
  goPreference() {
    wx.navigateTo({ url: '/pages/preference/preference' });
  },

  // 搜索 icon 展开/收起
  onSearchToggle() {
    this.setData({ searchOpen: !this.data.searchOpen });
  },
  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value });
  },
  onKeywordConfirm() {
    this.loadCompanies(true);
  },

  // 加载公司列表(按公司聚合)
  loadCompanies(reset) {
    if (this.data.loading) return Promise.resolve();
    if (reset) this.setData({ page: 1, hasMore: true });
    if (!this.data.hasMore) return Promise.resolve();

    const page = reset ? 1 : this.data.page;
    const { filters, keyword, currentTab, matchPref } = this.data;
    // match 模式用偏好筛选, 其他模式用筛选面板, 互不污染
    const activeFilters = currentTab === 'match' ? (matchPref || {}) : filters;
    const params = { page, size: 20, sort: activeFilters.sort || 'publish' };
    if (keyword) params.keyword = keyword;
    if (activeFilters.recruitType) params.recruitType = activeFilters.recruitType;
    if (activeFilters.grade) params.grade = activeFilters.grade;
    if (activeFilters.industry) params.industry = activeFilters.industry;
    if (activeFilters.city) params.city = activeFilters.city;
    if (activeFilters.education) params.education = activeFilters.education;
    // 分栏: 央国企覆盖性质; 全部分栏下用筛选面板选的性质
    if (currentTab === 'central') {
      params.nature = '央国企';
    } else if (activeFilters.nature) {
      params.nature = activeFilters.nature;
    }

    const qs = Object.keys(params).map(k => `${k}=${encodeURIComponent(params[k])}`).join('&');

    this.setData({ loading: true });
    return get('/api/companies?' + qs).then(data => {
      const records = (data.records || []).map(c => this.decorateCompany(c));
      const companies = reset ? records : this.data.companies.concat(records);
      this.setData({
        companies,
        total: data.total,
        latestUpdate: data.latestUpdate || '',
        latestCount: data.latestCount || 0,
        page: page + 1,
        hasMore: page < data.pages,
        loading: false
      });
    }).catch(err => {
      this.setData({ loading: false });
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
    });
  },

  // 公司数据后处理: 拆多值字段去重, 供标签展示
  decorateCompany(c) {
    const split = (s) => (s || '').split(',').map(x => x.trim()).filter(Boolean);
    const unique = (arr) => [...new Set(arr)];
    // 岗位: 后端用 | 分隔不同记录, 记录内用 , 分隔岗位; 换行/制表符转空格避免撑高标签
    const positions = unique(
      (c.positions || '')
        .replace(/[\r\n\t]+/g, ' ')
        .split('|').join(',')
        .split(',')
        .map(x => x.trim())
        .filter(Boolean)
    );
    const fmtDate = (d) => d ? String(d).slice(5).replace('-', '/') : '';
    return {
      ...c,
      jobCount: c.job_count,
      nature: c.company_nature,
      natureClass: NATURE_CLASS[c.company_nature] || 'other',
      industryArr: unique(split(c.industries)).slice(0, 2),
      cityArr: unique(split(c.cities)).slice(0, 3),
      positionArr: positions.slice(0, 5),
      publishLabel: fmtDate(c.latest_publish_date),
      deadlineLabel: c.latest_deadline_date ? fmtDate(c.latest_deadline_date) + ' 截止' : '招满即止'
    };
  },

  // 打开筛选面板
  onFilterTap(e) {
    const type = e.currentTarget.dataset.type;
    const config = PANEL_CONFIG[type];
    if (!config) return;
    const { meta, filters } = this.data;

    // 城市: 二级联动(省 -> 市)
    if (type === 'city') {
      const selected = filters.city ? String(filters.city).split(',').filter(Boolean) : [];
      this.setData({
        showPanel: true,
        panelConfig: { field: 'city', multi: true, label: '城市' },
        cityProvinces: (meta.provinces || []).map(p => ({
          name: p.name,
          cities: p.cities,
          selectedCount: p.cities.filter(c => selected.includes(c)).length
        })),
        citySpecial: (meta.specialCities || []).map(c => ({ value: c, selected: selected.includes(c) })),
        cityPanelLevel: 'province',
        cityCurrentProvince: '',
        cityOptions: [],
        panelSelected: selected
      });
      return;
    }

    let selected = [];
    const current = filters[config.field];
    if (current) {
      selected = String(current).split(',').filter(Boolean);
    }

    const options = (meta[config.key] || []).map(o => {
      const v = String(o);
      return {
        value: v,
        label: config.format ? config.format(o) : o,
        selected: selected.includes(v)
      };
    });

    this.setData({
      showPanel: true,
      panelConfig: { field: config.field, multi: config.multi, label: config.label },
      panelOptions: options,
      panelSelected: selected
    });
  },

  // 选省 -> 进入市列表
  onProvinceTap(e) {
    const name = e.currentTarget.dataset.name;
    const prov = (this.data.cityProvinces || []).find(p => p.name === name);
    if (!prov) return;
    const cities = prov.cities || [];
    const alias = cities[0] || '';
    const { panelSelected } = this.data;
    const options = [
      { value: alias, label: '全省（' + name + '）', selected: panelSelected.includes(alias) },
      ...cities.slice(1).map(c => ({ value: c, label: c, selected: panelSelected.includes(c) }))
    ];
    this.setData({
      cityPanelLevel: 'city',
      cityCurrentProvince: name,
      cityOptions: options
    });
  },

  // 返回省列表
  onCityBack() {
    this.setData({ cityPanelLevel: 'province', cityCurrentProvince: '' });
  },

  // 选市(含特殊分类, 直接切换选中)
  onCityOptionTap(e) {
    const value = String(e.currentTarget.dataset.value);
    const { panelSelected, citySpecial, cityOptions, cityProvinces } = this.data;
    const selected = panelSelected.includes(value)
      ? panelSelected.filter(v => v !== value)
      : panelSelected.concat(value);
    this.setData({
      panelSelected: selected,
      cityProvinces: cityProvinces.map(p => ({
        ...p,
        selectedCount: p.cities.filter(c => selected.includes(c)).length
      })),
      citySpecial: citySpecial.map(c => ({ ...c, selected: selected.includes(c.value) })),
      cityOptions: cityOptions.map(c => ({ ...c, selected: selected.includes(c.value) }))
    });
  },

  onOptionTap(e) {
    const value = String(e.currentTarget.dataset.value);
    const { panelConfig, panelSelected } = this.data;
    let selected;
    if (panelConfig.multi) {
      selected = panelSelected.includes(value)
        ? panelSelected.filter(v => v !== value)
        : panelSelected.concat(value);
    } else {
      selected = panelSelected.includes(value) ? [] : [value];
    }
    const panelOptions = this.data.panelOptions.map(o => ({
      ...o,
      selected: selected.includes(o.value)
    }));
    this.setData({ panelSelected: selected, panelOptions });
  },

  onPanelConfirm() {
    const { panelConfig, panelSelected } = this.data;
    const value = panelSelected.join(',');
    this.setData({
      [`filters.${panelConfig.field}`]: value,
      showPanel: false
    });
    this.loadCompanies(true);
  },

  onPanelReset() {
    const panelOptions = this.data.panelOptions.map(o => ({
      ...o,
      selected: false
    }));
    this.setData({ panelSelected: [], panelOptions });
  },

  onPanelClose() {
    this.setData({ showPanel: false });
  },

  // 跳转公司岗位页
  goCompany(e) {
    const name = e.currentTarget.dataset.name;
    wx.navigateTo({ url: `/pages/company/company?name=${encodeURIComponent(name)}` });
  },

  // 检查是否需要绑定手机号(受后台开关控制)
  checkBindPhone() {
    const app = getApp();
    const applyCheck = () => {
      const cfg = app.globalData.config || {};
      if (!cfg.bindPhoneEnabled) return;
      if (app.globalData.needBindPhone && !this.data.showBindPhone) {
        this.setData({ showBindPhone: true });
      }
    };
    if (app.globalData.config && app.globalData.config.bindPhoneEnabled !== undefined) {
      applyCheck();
    } else {
      get('/api/config').then(cfg => {
        app.globalData.config = cfg || {};
        applyCheck();
      }).catch(() => {});
    }
  },

  onBindPhoneInput(e) {
    this.setData({ bindPhoneInput: e.detail.value });
  },

  onBindPhoneConfirm() {
    const phone = this.data.bindPhoneInput.trim();
    if (!/^1\d{10}$/.test(phone)) {
      wx.showToast({ title: '手机号格式不正确', icon: 'none' });
      return;
    }
    post('/api/user/bind-phone', { phone }).then(() => {
      wx.setStorageSync('phone', phone);
      getApp().globalData.phone = phone;
      getApp().globalData.needBindPhone = false;
      this.setData({ showBindPhone: false, bindPhoneInput: '' });
      wx.showToast({ title: '绑定成功', icon: 'success' });
    }).catch(err => {
      wx.showToast({ title: err.message || '绑定失败', icon: 'none' });
    });
  },

  onBindPhoneCancel() {
    this.setData({ showBindPhone: false });
  }
});
