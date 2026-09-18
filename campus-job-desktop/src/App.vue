<script setup>
import { ref, reactive, computed, onMounted, nextTick } from 'vue';
import {
  fetchMeta, fetchJobs, getToken, setToken, clearToken,
  getPreference, savePreference, getUserInfo,
  followJob, unfollowJob, getJobStatusList, updateJobStatus, getPlans,
  getLatestVersion, getResumes, getResumeDetail
} from './api';
import FilterDropdown from './components/FilterDropdown.vue';
import CityCascader from './components/CityCascader.vue';
import RegisterModal from './components/RegisterModal.vue';
import AccountVipModal from './components/AccountVipModal.vue';
import Workbench from './components/Workbench.vue';
import FollowJobs from './components/FollowJobs.vue';
import PlanManage from './components/PlanManage.vue';
import TodoCalendar from './components/TodoCalendar.vue';
import ResumeManage from './components/ResumeManage.vue';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';

const menus = [
  { icon: '▦', label: '工作台', active: true },
  { icon: '▤', label: '岗位库' },
  { icon: '❤', label: '与我匹配' },
  { icon: '★', label: '关注岗位' },
  { icon: '⇗', label: '岗位跳转' },
  { icon: '▣', label: '求职计划' },
  { icon: '▢', label: '待办日历' },
  { icon: '▥', label: '简历管理' },
  { icon: '⚙', label: '系统设置' }
];

const stats = [
  { label: '收藏岗位', num: '—', sub: '待接入', icon: '★', color: '#4a86e8', bg: '#edf4ff' },
  { label: '投递中', num: '—', sub: '待接入', icon: '↗', color: '#8b7cf6', bg: '#f1eeff' },
  { label: '面试中', num: '—', sub: '待接入', icon: '◈', color: '#f5a623', bg: '#fff5e7' },
  { label: '岗位总数', num: '0', sub: '真实数据', icon: '✓', color: '#35b779', bg: '#ecf8f2', emphasis: true }
];

const shortcuts = [
  { label: '岗位库', bg: '#edf4ff', color: '#4a86e8' },
  { label: '投递记录', bg: '#fff9e6', color: '#e6a700' },
  { label: '面试日历', bg: '#e7f8f7', color: '#17a2a6' },
  { label: '关注岗位', bg: '#f1eeff', color: '#8b7cf6' },
  { label: '简历管理', bg: '#ecf8f2', color: '#35b779' },
  { label: '数据分析', bg: '#fdeef4', color: '#e56a9a' }
];

// ===== 多页签 =====
const tabs = ref([
  { id: '工作台', title: '工作台', closable: false }
]);
const activeTabId = ref('工作台');

function openTab(label) {
  const existing = tabs.value.find(t => t.id === label);
  if (existing) {
    activateTab(existing);
  } else {
    const tab = { id: label, title: label, closable: true };
    tabs.value.push(tab);
    activateTab(tab);
  }
}

const scrollPositions = {};

function activateTab(tab) {
  // 保存当前页签的滚动位置
  const scrollEl = document.querySelector('.scroll');
  if (scrollEl) {
    scrollPositions[activeTabId.value] = scrollEl.scrollTop;
  }
  // 显示当前网页，隐藏其他网页
  tabs.value.forEach(t => {
    if (t.label) {
      invoke('show_webview', { label: t.label, show: t.id === tab.id }).catch(() => {});
    }
  });
  activeTabId.value = tab.id;
  if (tab.id === '与我匹配') loadMatchJobs();
  if (tab.id === '关注岗位') { loadFollowedIds(); followJobsKey.value++; }
  if (tab.id === '待办日历') calendarKey.value++;
  if (tab.id === '工作台') workbenchKey.value++;
  // 恢复目标页签的滚动位置
  nextTick(() => {
    if (scrollEl && scrollPositions[tab.id] !== undefined) {
      scrollEl.scrollTop = scrollPositions[tab.id];
    }
  });
}

function closeTab(id) {
  const idx = tabs.value.findIndex(t => t.id === id);
  if (idx === -1 || !tabs.value[idx].closable) return;
  const tab = tabs.value[idx];
  if (tab.label) {
    invoke('close_webview', { label: tab.label }).catch(() => {});
  }
  tabs.value.splice(idx, 1);
  if (activeTabId.value === id) {
    const next = tabs.value[Math.max(0, idx - 1)];
    activeTabId.value = next ? next.id : '';
    if (next && next.label) {
      invoke('show_webview', { label: next.label, show: true }).catch(() => {});
    }
  }
}

// 当前激活的网页页签
const activeWebTab = computed(() => {
  return tabs.value.find(t => t.id === activeTabId.value && t.url);
});

function openInBrowser() {
  const tab = activeWebTab.value;
  if (tab) invoke('open_in_browser', { url: tab.url }).catch(() => {});
}

function copyLink() {
  const tab = activeWebTab.value;
  if (tab && navigator.clipboard) navigator.clipboard.writeText(tab.url);
}

function reloadWeb() {
  const tab = activeWebTab.value;
  if (tab) invoke('reload_webview', { label: tab.label }).catch(() => {});
}

const zoomLevel = ref(1);

function goBack() {
  const tab = activeWebTab.value;
  if (tab) invoke('webview_go_back', { label: tab.label }).catch(() => {});
}

function goForward() {
  const tab = activeWebTab.value;
  if (tab) invoke('webview_go_forward', { label: tab.label }).catch(() => {});
}

function zoomIn() {
  zoomLevel.value = Math.min(2, zoomLevel.value + 0.1);
  applyZoom();
}

function zoomOut() {
  zoomLevel.value = Math.max(0.5, zoomLevel.value - 0.1);
  applyZoom();
}

function applyZoom() {
  const tab = activeWebTab.value;
  if (tab) invoke('webview_zoom', { label: tab.label, zoom: zoomLevel.value }).catch(() => {});
}

// ===== 真实数据 =====
const meta = ref({});
const jobs = ref([]);
const loading = ref(false);
const total = ref(0);
const pages = ref(0);
const page = ref(1);
const size = 20;

const filters = reactive({
  keyword: '',
  recruitType: '',
  industry: '',
  nature: '',
  grade: '',
  education: '',
  province: '',
  city: ''
});

const sidebarCollapsed = ref(false);
function toggleSidebar() { sidebarCollapsed.value = !sidebarCollapsed.value; }

const showRegister = ref(true);
const loggedIn = ref(false);
const userInfo = ref(null);

const isVip = computed(() => {
  return userInfo.value && userInfo.value.isVip === true;
});

// 显示名称：昵称 > 用户+手机号后四位
const displayName = computed(() => {
  if (!loggedIn.value) return '登录账户';
  const nickname = userInfo.value?.nickname;
  if (nickname) return nickname;
  const phone = userInfo.value?.phone || '';
  return phone ? '用户' + phone.slice(-4) : '已登录';
});

// 会员到期时间（小于7天红色）
const vipExpireText = computed(() => {
  if (!userInfo.value?.vipExpire) return '';
  return '会员到期 ' + String(userInfo.value.vipExpire).slice(0, 10);
});
const vipExpiring = computed(() => {
  if (!userInfo.value?.vipExpire) return false;
  const expire = new Date(String(userInfo.value.vipExpire).replace(' ', 'T'));
  const now = new Date();
  return (expire - now) / 86400000 < 7;
});

function onLogin(data) {
  loggedIn.value = true;
  userInfo.value = data || {};
  showRegister.value = false;
  loadPreference();
  loadFollowedIds();
  loadPlans();
  getUserInfo().then(info => {
    if (info) userInfo.value = { ...userInfo.value, ...info };
  }).catch(() => {});
}

// 需要会员的操作：未登录弹登录，非会员弹「账号与会员」框
function requireVip() {
  if (!loggedIn.value) {
    showRegister.value = true;
    return false;
  }
  if (!isVip.value) {
    showVipModal.value = true;
    return false;
  }
  return true;
}

const showVipModal = ref(false);

function logout() {
  clearToken();
  loggedIn.value = false;
  userInfo.value = null;
  followedIds.value = new Set();
  plans.value = [];
  Object.keys(matchPref).forEach(k => matchPref[k] = '');
  showVipModal.value = false;
  showRegister.value = true;
}

function onAccountClick() {
  if (loggedIn.value) {
    showVipModal.value = true;
  } else {
    showRegister.value = true;
  }
}

function handleUpdateNickname(name) {
  userInfo.value = { ...(userInfo.value || {}), nickname: name };
}

function handleRedeemed(data) {
  // 立即用兑换返回的 vipExpire 同步会员状态，不等异步接口
  if (data && data.vipExpire) {
    userInfo.value = { ...(userInfo.value || {}), isVip: true, vipExpire: data.vipExpire };
  }
  getUserInfo().then(info => {
    if (info) userInfo.value = { ...(userInfo.value || {}), ...info };
  }).catch(() => {});
}

function handleRequireLogin() {
  showRegister.value = true;
}

// ===== 版本更新 =====
const currentVersion = ref('');
const currentPlatform = ref('');
const latestVersion = ref(null);
const hasUpdate = ref(false);
const checkingUpdate = ref(false);

async function initVersion() {
  try {
    currentVersion.value = await getVersion();
  } catch (e) {}
  const ua = navigator.userAgent.toLowerCase();
  currentPlatform.value = ua.includes('windows') ? 'win' : 'mac';
}

function compareVersion(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

async function checkUpdate() {
  checkingUpdate.value = true;
  try {
    const data = await getLatestVersion();
    const info = data[currentPlatform.value] || data.mac || null;
    latestVersion.value = info;
    if (info && info.version && currentVersion.value) {
      hasUpdate.value = compareVersion(info.version, currentVersion.value) > 0;
    } else {
      hasUpdate.value = false;
    }
  } catch (e) {
    hasUpdate.value = false;
  } finally {
    checkingUpdate.value = false;
  }
}

function openUpdate() {
  const info = latestVersion.value;
  if (!info || !info.url) return;
  const url = info.url.startsWith('http') ? info.url : ('https://my88ai.com/downloads/' + info.url);
  invoke('open_in_browser', { url }).catch(() => {});
}

function handleSelectStage(status) {
  // 点击进度阶段 → 切换到岗位库页签
  const tab = tabs.value.find(t => t.id === '岗位库');
  if (tab) activateTab(tab);
}

const planAutoCreate = ref(false);
function handleGotoPlan() {
  planAutoCreate.value = !plans.value.length;
  openTab('求职计划');
}

// 关注岗位状态变更 → 刷新工作台进度总览
const workbenchKey = ref(0);
function handleStatusChanged() {
  workbenchKey.value++;
  loadFollowedIds();
  loadPlans();
}

// 简历保存后，同步到已打开的 webview（无需重新打开）
async function handleResumeChanged() {
  await loadResumeForAutofill();
  invoke('update_webview_resume').catch(() => {});
}

// 待办日历 / 工作台 待办双向同步
const calendarKey = ref(0);
const followJobsKey = ref(0);
function handleCalendarChanged() {
  workbenchKey.value++;
}
function handleTodoChanged() {
  calendarKey.value++;
}

// 加载/保存偏好（与我匹配）
async function loadPreference() {
  if (!getToken()) return;
  try {
    const data = await getPreference();
    Object.assign(matchPref, data || {});
  } catch (e) {}
}
async function saveMatchPref() {
  if (!getToken()) return;
  try { await savePreference({ ...matchPref }); } catch (e) {}
}

// 关注岗位
const followedIds = ref(new Set());
const followedList = ref([]);

async function loadFollowedIds() {
  if (!getToken()) { followedIds.value = new Set(); followedList.value = []; return; }
  try {
    const list = await getJobStatusList();
    followedList.value = list;
    followedIds.value = new Set(list.map(j => j.jobId));
  } catch (e) { followedIds.value = new Set(); followedList.value = []; }
}

// 进行中计划下的关注岗位数
const activePlanFollowCount = computed(() => {
  const active = plans.value.find(p => p.status === 'IN_PROGRESS');
  if (!active) return followedIds.value.size;
  return followedList.value.filter(j => j.planId === active.id).length;
});

async function toggleFollow(job) {
  if (!requireVip()) return;
  const jobId = job.id;
  if (followedIds.value.has(jobId)) {
    try {
      await unfollowJob(jobId);
      const next = new Set(followedIds.value);
      next.delete(jobId);
      followedIds.value = next;
    } catch (e) {}
    return;
  }
  // 关注：先选择归属的求职计划
  await loadPlans();
  if (!plans.value.length) {
    openTab('求职计划');
    return;
  }
  pendingJob.value = job;
  const active = plans.value.find(p => p.status === 'IN_PROGRESS');
  selectedPlanId.value = active ? active.id : plans.value[0].id;
  showPlanSelect.value = true;
}

function isFollowed(jobId) {
  return followedIds.value.has(jobId);
}

// ===== 求职计划 =====
const plans = ref([]);
const showPlanSelect = ref(false);
const pendingJob = ref(null);
const selectedPlanId = ref(null);

async function loadPlans() {
  if (!getToken()) { plans.value = []; return; }
  try {
    plans.value = await getPlans();
  } catch (e) { plans.value = []; }
}

const availablePlans = computed(() =>
  plans.value.filter(p => p.status === 'IN_PROGRESS' || p.status === 'DRAFT' || p.status === 'PAUSED')
);

async function confirmFollow() {
  const job = pendingJob.value;
  if (!job || selectedPlanId.value == null) { showPlanSelect.value = false; return; }
  try {
    await followJob(job.id, selectedPlanId.value);
    const next = new Set(followedIds.value);
    next.add(job.id);
    followedIds.value = next;
  } catch (e) {}
  showPlanSelect.value = false;
  pendingJob.value = null;
}

const quickTab = ref('all');
function switchQuickTab(t) {
  quickTab.value = t;
  if (t === 'central') filters.nature = '央国企';
  else if (t === 'institution') filters.nature = '事业单位';
  else filters.nature = '';
  search();
}

// 与我匹配条件
const matchPref = reactive({
  recruitType: '', industry: '', nature: '', grade: '', education: '', city: ''
});
const matchJobs = ref([]);
const matchTotal = ref(0);
const matchPage = ref(1);
const matchPages = ref(0);

function loadMatchJobs() {
  saveMatchPref();
  fetchJobs({
    page: matchPage.value, size: 20,
    recruitType: matchPref.recruitType,
    industry: matchPref.industry,
    nature: matchPref.nature,
    grade: matchPref.grade ? String(matchPref.grade).replace('届', '') : '',
    education: matchPref.education,
    city: matchPref.city,
    sort: 'publish'
  }).then(data => {
    matchJobs.value = data.records || [];
    matchTotal.value = data.total || 0;
    matchPages.value = data.pages || 0;
  }).catch(() => {});
}

function matchSearch() {
  matchPage.value = 1;
  loadMatchJobs();
}

function matchChangePage(delta) {
  if (!requireVip()) return;
  const next = matchPage.value + delta;
  if (next < 1 || next > matchPages.value) return;
  matchPage.value = next;
  loadMatchJobs();
}

const hasMatchPref = computed(() => {
  return Object.values(matchPref).some(v => v);
});

// 简历字段结构（分组 + 字段）
const browserUrl = ref('');

function openBrowserUrl() {
  const url = browserUrl.value.trim();
  if (!url) return;
  const full = /^https?:\/\//i.test(url) ? url : 'https://' + url;
  openLink(full);
}

async function openLink(url) {
  if (!url) return;
  const label = 'web_' + Date.now();
  tabs.value.push({ id: label, title: '加载中...', closable: true, url, label });
  activateTab(tabs.value[tabs.value.length - 1]);
  // 注入当前默认简历数据，供半自动填写助手使用
  await loadResumeForAutofill();
  const x = sidebarCollapsed.value ? 64 : 220;
  const y = 118;
  const width = window.innerWidth - x;
  const height = window.innerHeight - 118;
  invoke('create_webview', { label, url, x, y, width, height }).catch(e => console.error(e));
  pollTitle(label);
}

// 读取默认简历，整理成扁平结构，同步到 Rust 端（供 webview 自动填写注入）
async function loadResumeForAutofill() {
  if (!getToken()) return;
  try {
    const resumes = await getResumes();
    if (!resumes.length) return;
    const def = resumes.find(r => r.isDefault) || resumes[0];
    const detail = await getResumeDetail(def.id);
    const flat = flattenResume(detail);
    await invoke('save_resume', { data: flat }).catch(() => {});
  } catch (e) {}
}

function flattenResume(detail) {
  const p = detail?.profile || {};
  const edu = detail?.education?.[0] || {};
  const exp = detail?.experience?.[0] || {};
  const proj = detail?.project?.[0] || {};
  const out = {};
  const map = {
    '姓名': p.chineseName, '英文姓名': p.englishName, '性别': p.gender,
    '出生日期': p.birthDate, '手机号': p.phone, '邮箱': p.email,
    '证件号码': p.idNumber, '所在城市': p.currentCity, '籍贯': p.nativePlace,
    '政治面貌': p.politicalStatus, '民族': p.ethnicity, '微信号': p.wechat,
    '紧急联系人': p.emergencyContact, '紧急联系人电话': p.emergencyPhone,
    '学校': edu.schoolName, '专业': edu.major, '学历': edu.educationLevel,
    '毕业时间': edu.endDate, 'GPA': edu.gpa,
    '公司': exp.companyName, '职位': exp.position,
    '项目名称': proj.projectName,
    '期望城市': detail?.targetCities, '期望薪资': detail?.expectedSalary,
    '自我评价': detail?.selfEvaluation
  };
  for (const [k, v] of Object.entries(map)) {
    if (v) out[k] = String(v);
  }
  return out;
}

// 网页打开方式：webview 内置 / 系统浏览器
const alwaysUseBrowser = ref(localStorage.getItem('always_use_browser') === '1');

function toggleAlwaysUseBrowser(val) {
  alwaysUseBrowser.value = val;
  localStorage.setItem('always_use_browser', val ? '1' : '0');
}

function openUrlInBrowser(url) {
  if (!url) return;
  invoke('open_in_browser', { url }).catch(() => {});
}

function openLinkVip(url) {
  if (!requireVip()) return;
  if (alwaysUseBrowser.value) {
    openUrlInBrowser(url);
  } else {
    openLink(url);
  }
}

function pollTitle(label) {
  setTimeout(async () => {
    if (!tabs.value.find(t => t.id === label)) return;
    try {
      const title = await invoke('webview_title', { label });
      const tab = tabs.value.find(t => t.id === label);
      if (tab && title && tab.title !== title) tab.title = title;
    } catch (e) {}
    pollTitle(label);
  }, 1500);
}

const provinces = computed(() => meta.value.provinces || []);
const specialCities = computed(() => meta.value.specialCities || []);

// 当前省的市列表（含省别名作为「全省」）
const currentCities = computed(() => {
  const p = provinces.value.find(p => p.name === filters.province);
  return p ? p.cities : [];
});

const gradeOptions = computed(() => (meta.value.grades || []).map(g => g + '届'));

const provinceOptions = computed(() => [
  ...specialCities.value,
  ...provinces.value.map(p => p.name)
]);

const typeTone = { '秋招提前批': 'purple', '秋招': 'blue', '春招': 'green', '春招补招': 'green', '暑期实习': 'orange', '寒假实习': 'orange', '日常实习': 'cyan', '实习': 'cyan', '转正实习': 'cyan', '校园大使': 'pink', '商赛/训练营': 'pink', '社招': 'purple' };
const natureTone = { '央国企': 'blue', '民企': 'cyan', '外企/合资': 'purple', '事业单位': 'orange', '社会机构/公益组织': 'green', '其他': 'gray' };

function firstOf(str, n = 1) {
  if (!str) return '';
  const arr = str.split(',').map(s => s.trim()).filter(Boolean);
  return arr.slice(0, n).join(' ');
}

function positionArr(str) {
  if (!str) return [];
  return str.split(',').map(s => s.trim()).filter(Boolean);
}

function positionDisplay(str) {
  const arr = positionArr(str);
  const n = arr.length;
  if (n === 0) return { chips: [], showCount: false, count: 0 };
  if (n <= 3) return { chips: arr, showCount: false, count: n };
  // 前 3 个标签总长度过长时，减少展示数量，避免切半截标签
  const len = arr.slice(0, 3).join('').length;
  let show = 3;
  if (len > 24) show = 1;
  else if (len > 16) show = 2;
  return { chips: arr.slice(0, show), showCount: true, count: n };
}

function typeToneClass(t) { return typeTone[t] || 'cyan'; }
function natureToneClass(t) { return natureTone[t] || 'gray'; }

function gradeLabel(r) {
  if (r.gradeMin == null || r.gradeMax == null) return '—';
  if (r.gradeMin === 0 && r.gradeMax === 99) return '不限';
  if (r.gradeMin === r.gradeMax) return r.gradeMin + '届';
  return r.gradeMin + '-' + r.gradeMax + '届';
}

function deadlineLabel(r) {
  if (r.deadlineDate) return String(r.deadlineDate).slice(5).replace('-', '/');
  if (r.deadline) return r.deadline;
  return '—';
}

async function loadJobs() {
  loading.value = true;
  try {
    const data = await fetchJobs({
      page: page.value,
      size,
      keyword: filters.keyword,
      recruitType: filters.recruitType,
      industry: filters.industry,
      nature: filters.nature,
      grade: filters.grade ? String(filters.grade).replace('届', '') : '',
      education: filters.education,
      city: filters.city,
      sort: 'publish'
    });
    jobs.value = data.records || [];
    total.value = data.total || 0;
    pages.value = data.pages || 0;
    stats[3].num = String(total.value);
  } catch (e) {
    console.error('加载岗位失败', e);
  } finally {
    loading.value = false;
  }
}

function search() {
  page.value = 1;
  loadJobs();
}

function reset() {
  Object.assign(filters, { keyword: '', recruitType: '', industry: '', nature: '', grade: '', education: '', province: '', city: '' });
  search();
}

function changePage(delta) {
  if (!requireVip()) return;
  const next = page.value + delta;
  if (next < 1 || next > pages.value) return;
  page.value = next;
  loadJobs();
}

// 省变化时清空市
function onProvinceChange() {
  filters.city = '';
  search();
}

onMounted(async () => {
  try {
    meta.value = await fetchMeta();
  } catch (e) {
    console.error('加载筛选项失败', e);
  }
  loadJobs();
  await initVersion();
  checkUpdate();
  if (getToken()) {
    loggedIn.value = true;
    showRegister.value = false;
    loadPreference();
    loadFollowedIds();
    loadPlans();
    getUserInfo().then(info => {
      if (info) userInfo.value = { ...(userInfo.value || {}), ...info };
    }).catch(() => {});
  }
});
</script>

<template>
  <div class="app">
    <div class="body">
      <!-- 左侧导航栏 -->
      <aside class="sidebar" :class="{ collapsed: sidebarCollapsed }">
        <div class="collapse-btn" @click="toggleSidebar">{{ sidebarCollapsed ? '»' : '«' }}</div>
        <div class="brand">
          <div class="brand-avatar"><div class="avatar-ring"><svg viewBox="0 0 48 48" width="38" height="38"><rect x="11" y="19" width="26" height="21" rx="7" fill="#4a86e8"/><circle cx="20" cy="28" r="3.2" fill="#fff"/><circle cx="28" cy="28" r="3.2" fill="#fff"/><rect x="18" y="34" width="12" height="3" rx="1.5" fill="#fff"/><line x1="24" y1="11" x2="24" y2="17" stroke="#4a86e8" stroke-width="2.5"/><circle cx="24" cy="9" r="2.5" fill="#4a86e8"/></svg></div></div>
          <div class="brand-info" v-show="!sidebarCollapsed">
            <div class="brand-name">求职助手</div>
            <div class="brand-desc">校招求职管理</div>
            <div class="brand-desc">一站式效率工具</div>
          </div>
        </div>
        <div class="brand-divider"></div>

        <nav class="menu">
          <div v-for="m in menus" :key="m.label" class="menu-item" :class="{ active: activeTabId === m.label }" :title="m.label" @click="openTab(m.label)">
            <span class="menu-icon">{{ m.icon }}</span>
            <span class="menu-label" v-show="!sidebarCollapsed">{{ m.label }}</span>
            <span v-if="m.label === '关注岗位' && activePlanFollowCount" class="menu-badge" :class="{ collapsed: sidebarCollapsed }">{{ activePlanFollowCount }}</span>
            <span v-if="m.label === '岗位库' && meta.recentCount" class="menu-badge" :class="{ collapsed: sidebarCollapsed }">+{{ meta.recentCount }}</span>
            <span v-if="m.label === '系统设置' && hasUpdate" class="menu-update-badge" :class="{ collapsed: sidebarCollapsed }">有新版本</span>
          </div>
        </nav>

        <div class="sidebar-footer">
          <div class="account-card" :class="{ 'vip-gold': isVip }" @click="onAccountClick">
            <div class="account-avatar">👤</div>
            <div class="account-info" v-show="!sidebarCollapsed">
              <div class="account-title">{{ displayName }}</div>
              <div class="account-desc" :class="{ 'vip-expiring': vipExpiring }">{{ loggedIn ? (isVip ? (vipExpireText || '会员用户') : '非会员功能受限') : '同步你的求职数据' }}</div>
            </div>
          </div>
        </div>
      </aside>

      <!-- 右侧主内容区 -->
      <main class="content">
        <div class="tabs">
          <div
            v-for="tab in tabs"
            :key="tab.id"
            class="tab"
            :class="{ active: activeTabId === tab.id }"
            @click="activateTab(tab)"
          >
            <span class="tab-title">{{ tab.title }}</span>
            <span v-if="tab.closable" class="tab-close" @click.stop="closeTab(tab.id)">×</span>
          </div>
          <div class="tab-actions" title="新开页签" @click="openTab('工作台')"><span class="tab-icon">＋</span></div>
        </div>

        <div v-if="activeWebTab" class="web-toolbar-row">
          <span class="web-btn" title="后退" @click.stop="goBack">←</span>
          <span class="web-btn" title="前进" @click.stop="goForward">→</span>
          <span class="web-btn" title="刷新" @click.stop="reloadWeb">🔄</span>
          <span class="web-btn" title="缩小" @click.stop="zoomOut">－</span>
          <span class="web-zoom">{{ Math.round(zoomLevel * 100) }}%</span>
          <span class="web-btn" title="放大" @click.stop="zoomIn">＋</span>
          <span class="web-btn" title="复制链接" @click.stop="copyLink">🔗</span>
          <span class="web-btn" title="浏览器打开" @click.stop="openInBrowser">🌐</span>
          <span class="web-toolbar-tip">如遇网页无法加载，可到【系统设置】勾选「用电脑浏览器打开」</span>
        </div>

        <div class="scroll">
          <div v-show="activeTabId === '工作台'">
            <Workbench :key="workbenchKey" @select-stage="handleSelectStage" @goto-plan="handleGotoPlan" @todo-changed="handleTodoChanged" @require-login="handleRequireLogin" />
          </div>
          <div v-show="activeTabId === '岗位库'">
          <!-- 欢迎横幅 -->
          <div class="banner">
            <div class="banner-left">
              <div class="banner-label-row">
                <div class="banner-dot"></div>
                <div class="banner-label">岗位库</div>
              </div>
              <div class="banner-title">校招岗位总览</div>
              <div class="banner-desc">共 {{ total }} 个在招岗位，支持按行业、城市、类型、性质、届别、学历筛选</div>
            </div>
            <div class="banner-right">
              <button class="banner-btn" @click="search"><span class="btn-icon">↻</span>刷新数据</button>
              <div class="banner-tip">数据来源：服务器实时岗位</div>
            </div>
            <div class="banner-glow"></div>
          </div>

          <!-- 筛选工具栏 -->
          <div class="card toolbar-card">
            <div class="search-box">
              <span class="search-icon">🔍</span>
              <input class="search-input" v-model="filters.keyword" placeholder="搜索公司、岗位..." @keyup.enter="search" />
            </div>
            <button class="search-btn" @click.stop="search">搜索</button>
          </div>

          <!-- 快捷切换 -->
          <div class="quick-tabs">
            <div class="quick-tab" :class="{ active: quickTab === 'all' }" @click="switchQuickTab('all')">全部岗位</div>
            <div class="quick-tab" :class="{ active: quickTab === 'central' }" @click="switchQuickTab('central')">央国企</div>
            <div class="quick-tab" :class="{ active: quickTab === 'institution' }" @click="switchQuickTab('institution')">事业单位</div>
          </div>

          <!-- 筛选条件行 -->
          <div class="filter-row">
            <FilterDropdown v-model="filters.recruitType" label="招聘类型" :options="meta.recruitTypes || []" multi @change="search" />
            <FilterDropdown v-model="filters.industry" label="行业" :options="meta.industries || []" multi @change="search" />
            <FilterDropdown v-model="filters.nature" label="企业性质" :options="meta.natures || []" multi @change="search" />
            <FilterDropdown v-model="filters.grade" label="届别" :options="gradeOptions" @change="search" />
            <FilterDropdown v-model="filters.education" label="学历" :options="meta.educations || []" @change="search" />
            <CityCascader v-model="filters.city" :provinces="provinces" :special-cities="specialCities" @change="search" />
            <button class="toolbar-btn reset-btn" @click.stop="reset">重置</button>
          </div>

          <!-- 数据表格 -->
          <div class="table-meta">
            <div class="meta-left">
              <span>共 {{ total }} 条岗位</span>
              <span v-if="meta.latestUpdate" class="update-highlight">近7天新增 {{ meta.recentCount || 0 }} 条</span>
            </div>
            <span>第 {{ page }} / {{ pages || 1 }} 页</span>
          </div>
          <div class="card table-card">
            <table>
              <colgroup>
                <col style="width:90px"><col style="width:170px"><col style="width:80px"><col style="width:90px"><col style="width:70px"><col style="width:110px"><col style="width:210px"><col style="width:265px"><col style="width:90px"><col style="width:110px">
              </colgroup>
              <thead>
                <tr>
                  <th>更新时间</th>
                  <th>公司</th>
                  <th>性质</th>
                  <th>截止</th>
                  <th>届别</th>
                  <th>地点</th>
                  <th>岗位</th>
                  <th>操作</th>
                  <th>类型</th>
                  <th>行业</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in jobs" :key="r.id">
                  <td class="col-date">{{ r.publishDate || '—' }}</td>
                  <td class="col-company">{{ r.companyName }}</td>
                  <td><span class="tag" :class="'tag-' + natureToneClass(r.companyNature)">{{ r.companyNature }}</span></td>
                  <td class="col-deadline">{{ deadlineLabel(r) }}</td>
                  <td class="col-grade">{{ gradeLabel(r) }}</td>
                  <td class="col-city"><span class="loc-icon">📍</span>{{ firstOf(r.cities, 2) }}</td>
                  <td class="col-post" :title="r.positions">
                    <span class="pos-tags">
                    <span v-for="p in positionDisplay(r.positions).chips" :key="p" class="pos-chip" :title="r.positions">{{ p }}</span>
                    </span>
                    <span v-if="positionDisplay(r.positions).showCount" class="pos-count" :title="r.positions">共 {{ positionDisplay(r.positions).count }} 个岗位</span>
                  </td>
                  <td class="col-actions">
                    <button class="row-btn" :disabled="!r.noticeUrl" @click.stop="openLinkVip(r.noticeUrl)">网申公告</button>
                    <button class="row-btn primary" :disabled="!r.applyUrl" @click.stop="openLinkVip(r.applyUrl)">投递地址</button>
                    <button class="row-btn fav-btn" :class="{ faved: isFollowed(r.id) }" @click.stop="toggleFollow(r)">{{ isFollowed(r.id) ? '已关注' : '关注' }}</button>
                  </td>
                  <td><span class="tag" :class="'tag-' + typeToneClass(firstOf(r.recruitTypes))">{{ firstOf(r.recruitTypes) }}</span></td>
                  <td class="col-industry"><span class="industry-icon">✦</span>{{ firstOf(r.industry) }}</td>
                </tr>
                <tr v-if="!loading && !jobs.length">
                  <td colspan="10" class="empty">暂无匹配的岗位</td>
                </tr>
                <tr v-if="loading">
                  <td colspan="10" class="empty">加载中...</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- 分页 -->
          <div class="pagination">
            <button class="page-btn" :disabled="page <= 1" @click="changePage(-1)">上一页</button>
            <span class="page-info">{{ page }} / {{ pages || 1 }}</span>
            <button class="page-btn" :disabled="page >= pages" @click="changePage(1)">下一页</button>
          </div>
          </div>

          <!-- 与我匹配页签 -->
          <div v-show="activeTabId === '与我匹配'">
            <div class="card match-card">
              <div class="match-head">设置我的条件</div>
              <div class="match-desc" v-if="!hasMatchPref">请设置你的求职偏好条件，系统会为你匹配适合的岗位</div>
              <div class="filter-row">
                <FilterDropdown v-model="matchPref.recruitType" label="招聘类型" :options="meta.recruitTypes || []" multi @change="matchSearch" />
                <FilterDropdown v-model="matchPref.industry" label="行业" :options="meta.industries || []" multi @change="matchSearch" />
                <FilterDropdown v-model="matchPref.nature" label="企业性质" :options="meta.natures || []" multi @change="matchSearch" />
                <FilterDropdown v-model="matchPref.grade" label="届别" :options="gradeOptions" @change="matchSearch" />
                <FilterDropdown v-model="matchPref.education" label="学历" :options="meta.educations || []" @change="matchSearch" />
                <CityCascader v-model="matchPref.city" :provinces="provinces" :special-cities="specialCities" @change="matchSearch" />
              </div>
            </div>
            <div class="table-meta"><span>匹配到 {{ matchTotal }} 条岗位</span></div>
            <div class="card table-card">
              <table>
                <colgroup>
                  <col style="width:90px"><col style="width:170px"><col style="width:80px"><col style="width:90px"><col style="width:70px"><col style="width:110px"><col style="width:210px"><col style="width:265px"><col style="width:90px"><col style="width:110px">
                </colgroup>
                <thead>
                  <tr>
                    <th>更新时间</th><th>公司</th><th>性质</th><th>截止</th><th>届别</th><th>地点</th><th>岗位</th><th>操作</th><th>类型</th><th>行业</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="r in matchJobs" :key="r.id">
                    <td class="col-date">{{ r.publishDate || '—' }}</td>
                    <td class="col-company">{{ r.companyName }}</td>
                    <td><span class="tag" :class="'tag-' + natureToneClass(r.companyNature)">{{ r.companyNature }}</span></td>
                    <td class="col-deadline">{{ deadlineLabel(r) }}</td>
                    <td class="col-grade">{{ gradeLabel(r) }}</td>
                    <td class="col-city"><span class="loc-icon">📍</span>{{ firstOf(r.cities, 2) }}</td>
                    <td class="col-post" :title="r.positions">
                    <span class="pos-tags">
                    <span v-for="p in positionDisplay(r.positions).chips" :key="p" class="pos-chip" :title="r.positions">{{ p }}</span>
                    </span>
                    <span v-if="positionDisplay(r.positions).showCount" class="pos-count" :title="r.positions">共 {{ positionDisplay(r.positions).count }} 个岗位</span>
                  </td>
                    <td class="col-actions">
                      <button class="row-btn" :disabled="!r.noticeUrl" @click.stop="openLinkVip(r.noticeUrl)">网申公告</button>
                      <button class="row-btn primary" :disabled="!r.applyUrl" @click.stop="openLinkVip(r.applyUrl)">投递地址</button>
                    <button class="row-btn fav-btn" :class="{ faved: isFollowed(r.id) }" @click.stop="toggleFollow(r)">{{ isFollowed(r.id) ? '已关注' : '关注' }}</button>
                    </td>
                    <td><span class="tag" :class="'tag-' + typeToneClass(firstOf(r.recruitTypes))">{{ firstOf(r.recruitTypes) }}</span></td>
                    <td class="col-industry"><span class="industry-icon">✦</span>{{ firstOf(r.industry) }}</td>
                  </tr>
                  <tr v-if="!hasMatchPref"><td colspan="10" class="empty">请先设置匹配条件</td></tr>
                  <tr v-else-if="!matchJobs.length"><td colspan="10" class="empty">没有匹配的岗位</td></tr>
                </tbody>
              </table>
            </div>
            <div class="pagination" v-if="matchJobs.length">
              <button class="page-btn" :disabled="matchPage <= 1" @click="matchChangePage(-1)">上一页</button>
              <span class="page-info">{{ matchPage }} / {{ matchPages || 1 }}</span>
              <button class="page-btn" :disabled="matchPage >= matchPages" @click="matchChangePage(1)">下一页</button>
            </div>
          </div>

          <!-- 简历管理页签 -->
          <div v-show="activeTabId === '简历管理'">
            <ResumeManage @require-login="handleRequireLogin" @changed="handleResumeChanged" />
          </div>

          <!-- 岗位跳转页签 -->
          <div v-show="activeTabId === '岗位跳转'">
            <div class="card">
              <div class="match-head">岗位跳转</div>
              <div class="match-desc">输入网址打开，可在页签栏控制缩放、前进、后退、刷新，支持自动填写简历</div>
              <div class="toolbar-card" style="margin-bottom:0; padding:0; box-shadow:none;">
                <div class="search-box">
                  <span class="search-icon">🔍</span>
                  <input class="search-input" v-model="browserUrl" placeholder="输入网址，如 www.example.com" @keyup.enter="openBrowserUrl" />
                </div>
                <button class="search-btn" @click="openBrowserUrl">打开</button>
              </div>
            </div>
          </div>

          <!-- 关注岗位页签 -->
          <div v-show="activeTabId === '关注岗位'">
            <FollowJobs :key="followJobsKey" @status-changed="handleStatusChanged" @open-link="openLinkVip" />
          </div>

          <!-- 求职计划页签 -->
          <div v-show="activeTabId === '求职计划'">
            <PlanManage :auto-create="planAutoCreate" @changed="handleStatusChanged" @require-login="handleRequireLogin" />
          </div>

          <!-- 待办日历页签 -->
          <div v-show="activeTabId === '待办日历'">
            <TodoCalendar :key="calendarKey" @changed="handleCalendarChanged" @require-login="handleRequireLogin" />
          </div>

          <!-- 系统设置页签 -->
          <div v-show="activeTabId === '系统设置'">
            <div class="settings-page">
              <div class="settings-title">系统设置</div>
              <div class="card settings-card">
                <div class="settings-section">
                  <div class="settings-section-title">版本更新</div>
                  <div class="settings-row">
                    <span class="settings-label">当前版本</span>
                    <span class="settings-value">{{ currentVersion || '—' }}</span>
                  </div>
                  <div class="settings-row" v-if="latestVersion">
                    <span class="settings-label">最新版本</span>
                    <span class="settings-value">{{ latestVersion.version || '—' }}</span>
                  </div>
                  <div class="settings-note" v-if="latestVersion && latestVersion.note">
                    <div class="settings-label">更新说明</div>
                    <pre class="settings-note-text">{{ latestVersion.note }}</pre>
                  </div>
                  <div class="settings-actions">
                    <button v-if="hasUpdate" class="search-btn" @click="openUpdate">立即更新</button>
                    <button class="row-btn" @click="checkUpdate">{{ checkingUpdate ? '检查中...' : '检查更新' }}</button>
                  </div>
                  <div v-if="!hasUpdate && latestVersion" class="settings-tip">已是最新版本</div>
                </div>
              </div>

              <div class="card settings-card">
                <div class="settings-section">
                  <div class="settings-section-title">网页打开方式</div>
                  <div class="settings-switch-row">
                    <span class="settings-switch-label">始终使用电脑浏览器打开网页</span>
                    <label class="settings-switch">
                      <input type="checkbox" :checked="alwaysUseBrowser" @change="toggleAlwaysUseBrowser($event.target.checked)" />
                      <span class="settings-slider"></span>
                    </label>
                  </div>
                  <div class="settings-switch-desc">智能填写插件将无法使用</div>
                </div>
              </div>
            </div>
          </div>

          <!-- 其他页签占位 -->
          <div v-for="tab in tabs" :key="'ph_' + tab.id" v-show="activeTabId === tab.id && !tab.url && tab.id !== '岗位库' && tab.id !== '工作台' && tab.id !== '与我匹配' && tab.id !== '简历管理' && tab.id !== '岗位跳转' && tab.id !== '关注岗位' && tab.id !== '求职计划' && tab.id !== '待办日历' && tab.id !== '系统设置'" class="placeholder">
            <div class="placeholder-icon">📄</div>
            <div class="placeholder-title">{{ tab.title }}</div>
            <div class="placeholder-desc">功能开发中，敬请期待</div>
          </div>
        </div>
      </main>
    </div>

    <RegisterModal v-if="showRegister" @close="showRegister = false" @login="onLogin" />
    <AccountVipModal
      v-if="showVipModal"
      :phone="userInfo?.phone"
      :nickname="userInfo?.nickname"
      :is-vip="isVip"
      :vip-expire="userInfo?.vipExpire ? String(userInfo.vipExpire).slice(0, 10) : ''"
      @close="showVipModal = false"
      @logout="logout"
      @update-nickname="handleUpdateNickname"
      @redeemed="handleRedeemed"
    />

    <!-- 关注岗位 → 选择求职计划弹窗 -->
    <div v-if="showPlanSelect" class="plan-select-mask">
      <div class="plan-select-dialog">
        <div class="ps-title">选择求职计划</div>
        <div class="ps-sub">该岗位将归入所选计划，并计入该计划的进度统计</div>
        <div class="ps-list">
          <div
            v-for="p in availablePlans"
            :key="p.id"
            class="ps-item"
            :class="{ checked: selectedPlanId === p.id }"
            @click="selectedPlanId = p.id"
          >
            <span class="ps-radio" :class="{ on: selectedPlanId === p.id }"></span>
            <div class="ps-body">
              <div class="ps-name">
                {{ p.planName }}
                <span v-if="p.status === 'IN_PROGRESS'" class="ps-tag">进行中</span>
                <span v-else-if="p.status === 'DRAFT'" class="ps-tag gray">草稿</span>
                <span v-else class="ps-tag gray">已暂停</span>
              </div>
              <div class="ps-desc">{{ p.recruitmentStage || '未设置阶段' }}</div>
            </div>
            <span class="ps-count">{{ p.jobCount || 0 }} 岗位</span>
          </div>
        </div>
        <div class="ps-actions">
          <button class="row-btn" @click="showPlanSelect = false">取消</button>
          <button class="search-btn" @click="confirmFollow">确认关注</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.app { height: 100vh; display: flex; flex-direction: column; background: var(--bg); overflow: hidden; }

.body { flex: 1; display: flex; min-height: 0; }

.sidebar { position: relative; width: 220px; flex-shrink: 0; background: var(--bg-side); display: flex; flex-direction: column; padding: 16px 12px; transition: width 0.2s; }
.sidebar.collapsed { width: 64px; padding: 16px 10px; }
.collapse-btn {
  position: absolute;
  right: -13px;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9aaac0;
  cursor: pointer;
  background: #ffffff;
  border: 1px solid var(--border);
  border-radius: 13px;
  font-size: 14px;
  user-select: none;
  z-index: 10;
}
.collapse-btn:hover { color: #60738f; background: #f5f8fd; }
.sidebar.collapsed .brand { padding: 12px 0; justify-content: center; }
.sidebar.collapsed .brand-divider { margin: 12px 0; }
.sidebar.collapsed .menu-item { justify-content: center; padding: 14px 0; }
.sidebar.collapsed .primary-btn { padding: 0 10px; }
.sidebar.collapsed .account-card { justify-content: center; padding: 14px 0; }
.brand { height: 140px; background: linear-gradient(180deg, #f4f8ff, #eef4fc); border-radius: 16px; padding: 20px 16px; display: flex; align-items: center; gap: 14px; }
.avatar-ring { width: 56px; height: 56px; border-radius: 50%; background: #e3eeff; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 4px #d5e7ff; }
.brand-info { overflow: hidden; }
.brand-name { font-size: 18px; font-weight: 700; color: var(--navy); margin-bottom: 6px; }
.brand-desc { font-size: 12px; color: var(--text-sub); line-height: 1.6; }
.brand-divider { height: 1px; background: var(--border); margin: 14px 4px; }

.menu { flex: 1; display: flex; flex-direction: column; gap: 4px; overflow-y: auto; }
.menu-item { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 10px; font-size: 14px; color: #7d90ab; cursor: pointer; transition: all 0.15s; }
.menu-icon { font-size: 16px; color: #b0c0d6; line-height: 1; }
.menu-item:hover { background: #f5f8fd; }
.menu-item.active { background: var(--blue-bg); color: var(--primary); font-weight: 600; }
.menu-item.active .menu-icon { color: var(--primary); }
.menu-badge {
  margin-left: auto;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--primary);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
  text-align: center;
}
.menu-badge.collapsed {
  position: absolute;
  margin: 0;
  transform: translate(14px, -14px);
}
.menu-update-badge {
  margin-left: auto;
  height: 18px;
  padding: 0 6px;
  border-radius: 9px;
  background: #e35d5d;
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  line-height: 18px;
  white-space: nowrap;
}
.menu-update-badge.collapsed {
  position: absolute;
  margin: 0;
  transform: translate(12px, -14px);
}

.sidebar-footer { margin-top: auto; display: flex; flex-direction: column; gap: 14px; }
.primary-btn { height: 54px; border: none; border-radius: 14px; background: linear-gradient(135deg, #5b97f2, #4a86e8); color: #fff; font-size: 15px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; box-shadow: 0 6px 16px rgba(74,134,232,0.3); }
.btn-icon { font-size: 16px; }
.account-card { border: 1px solid var(--border); border-radius: 14px; padding: 14px 16px; display: flex; align-items: center; gap: 12px; background: #fbfdff; cursor: pointer; }
.account-card.vip-gold { background: linear-gradient(135deg, #fdf6e3, #f8e9c0); border-color: #e8d5a0; }
.account-avatar { width: 36px; height: 36px; border-radius: 50%; background: var(--blue-bg); display: flex; align-items: center; justify-content: center; font-size: 18px; }
.account-title { font-size: 13px; font-weight: 600; color: var(--navy); }
.account-desc { font-size: 12px; color: var(--text-sub); margin-top: 2px; }
.account-desc.vip-expiring { color: #e35d5d; font-weight: 600; }

.content { flex: 1; display: flex; flex-direction: column; min-width: 0; }

.tabs { height: 48px; flex-shrink: 0; display: flex; align-items: flex-end; gap: 6px; padding: 0 20px; background: #e9f1fb; overflow-x: auto; overflow-y: hidden; white-space: nowrap; }
.tab { height: 40px; padding: 0 18px; display: flex; align-items: center; gap: 8px; background: #eef3fa; border-radius: 10px 10px 0 0; border: 1px solid transparent; font-size: 13px; color: #7d90ab; position: relative; cursor: pointer; flex-shrink: 0; }
.tab.active { background: #fff; color: var(--navy); font-weight: 700; border-color: #d6e7fa; }
.tab.active::after { content: ''; position: absolute; left: 12px; right: 12px; bottom: -1px; height: 3px; background: var(--primary); border-radius: 3px; }
.tab-title { max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tab-close { color: #b0c0d6; cursor: pointer; font-size: 14px; line-height: 1; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; border-radius: 50%; flex-shrink: 0; }
.tab-close:hover { background: #e3ecf6; color: #60738f; }
.tab-actions { margin-left: 4px; padding-bottom: 6px; flex-shrink: 0; }
.tab-icon { width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; color: var(--text-sub); cursor: pointer; }
.tab-icon:hover { background: #dfe9f6; }

/* 网页功能工具栏（独立一行，打开 webview 时显示） */
.web-toolbar-row { flex-shrink: 0; display: flex; align-items: center; gap: 4px; padding: 6px 20px; background: #f4f8fd; border-bottom: 1px solid #e3ecf6; }
.web-btn { width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; font-size: 15px; cursor: pointer; }
.web-btn:hover { background: #dfe9f6; }
.web-zoom { font-size: 12px; color: var(--text-sub); min-width: 40px; text-align: center; }
.web-toolbar-tip { margin-left: auto; font-size: 12px; color: #94a6ba; white-space: nowrap; }

/* 占位页签 */
.placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 400px; color: var(--text-sub); }
.placeholder-icon { font-size: 48px; margin-bottom: 16px; }
.placeholder-title { font-size: 18px; font-weight: 600; color: var(--navy); margin-bottom: 8px; }
.placeholder-desc { font-size: 13px; color: var(--text-sub); }

/* 与我匹配 */
.match-card { margin-bottom: 16px; }
.match-head { font-size: 16px; font-weight: 700; color: var(--navy); margin-bottom: 6px; }
.match-desc { font-size: 13px; color: var(--text-sub); margin-bottom: 14px; }

/* 简历管理表单 */
.resume-card { padding: 24px; }
.resume-group { margin-bottom: 20px; }
.resume-group-title { font-size: 14px; font-weight: 600; color: var(--navy); margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #eef2f8; }
.resume-fields { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px 18px; }
.resume-field { display: flex; flex-direction: column; gap: 6px; }
.resume-label { font-size: 13px; color: var(--text); }
.resume-input { height: 38px; padding: 0 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 13px; color: var(--text); outline: none; background: #fff; }
.resume-input:focus { border-color: var(--primary); }
.resume-save { margin-top: 12px; }

.scroll { flex: 1; overflow-y: auto; padding: 20px; }

.banner { position: relative; border-radius: var(--radius-lg); background: linear-gradient(120deg, #ffffff, #eef4ff); padding: 28px 36px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; overflow: hidden; }
.banner-left { display: flex; flex-direction: column; align-items: flex-start; }
.banner-label-row { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.banner-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--primary); }
.banner-label { font-size: 13px; color: var(--primary); }
.banner-title { font-size: 30px; font-weight: 700; color: var(--navy); margin-bottom: 8px; }
.banner-desc { font-size: 14px; color: var(--text); }
.banner-right { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
.banner-btn { height: 40px; padding: 0 20px; border: none; border-radius: 12px; background: var(--primary); color: #fff; font-size: 14px; display: flex; align-items: center; gap: 6px; cursor: pointer; }
.banner-tip { font-size: 12px; color: var(--text-sub); }
.banner-glow { position: absolute; right: -60px; top: -60px; width: 200px; height: 200px; border-radius: 50%; background: radial-gradient(circle, rgba(91,151,242,0.12), transparent 70%); }

.card { background: var(--card); border-radius: var(--radius-md); box-shadow: var(--shadow); padding: 16px 20px; margin-bottom: 16px; }

/* 搜索工具栏 */
.toolbar-card { display: flex; align-items: center; gap: 12px; }
.search-box { flex: 1; height: 42px; border: 1px solid var(--border); border-radius: 12px; background: #fff; display: flex; align-items: center; padding: 0 14px; gap: 10px; }
.search-icon { color: var(--text-sub); font-size: 15px; }
.search-input { flex: 1; border: none; outline: none; font-size: 14px; color: var(--text); }
.search-input::placeholder { color: var(--text-sub); }
.search-btn { height: 42px; padding: 0 22px; border: none; border-radius: 12px; background: var(--primary); color: #fff; font-size: 14px; cursor: pointer; }
.toolbar-btn { height: 42px; padding: 0 18px; border: 1px solid var(--border); border-radius: 12px; background: #fff; color: var(--text-sub); font-size: 14px; cursor: pointer; }
.reset-btn { height: 36px; font-size: 13px; border-radius: 10px; margin-left: auto; }

/* 快捷切换 */
.quick-tabs { display: flex; gap: 8px; margin-bottom: 16px; }
.quick-tab {
  height: 36px;
  padding: 0 18px;
  border-radius: 18px;
  border: 1px solid var(--border);
  background: #fff;
  color: var(--text);
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  white-space: nowrap;
  transition: all 0.15s;
}
.quick-tab:hover { border-color: #c2d6ef; }
.quick-tab.active { background: var(--primary); border-color: var(--primary); color: #fff; font-weight: 600; }

/* 筛选条件行 */
.filter-row { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; align-items: center; }

/* 表格 */
.table-meta { display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: #7186a0; padding: 0 4px 10px; }
.meta-left { display: flex; align-items: center; gap: 16px; }
.update-highlight { color: var(--primary); font-weight: 600; }
.table-card { padding: 0; overflow-x: auto; }
table { width: 100%; min-width: 1285px; border-collapse: collapse; table-layout: fixed; }
thead th { background: #f2f6fc; color: var(--navy); font-size: 12px; font-weight: 600; text-align: left; padding: 11px 16px; white-space: nowrap; }
tbody td { padding: 14px 16px; font-size: 13px; color: var(--text); border-bottom: 1px solid #eef2f8; }
tbody tr:last-child td { border-bottom: none; }
tbody tr:hover td { background: #f8fafd; }
.col-date { color: var(--text-sub); font-size: 13px; white-space: nowrap; }
.col-company { color: var(--navy); font-weight: 600; white-space: normal; word-break: break-all; line-height: 1.4; }
.col-deadline { white-space: nowrap; color: #b47a2e; }
.col-grade { white-space: nowrap; color: var(--text); }
.col-industry { white-space: nowrap; }
.industry-icon { color: #35b779; margin-right: 6px; }
.col-city { white-space: nowrap; }
.loc-icon { color: #f5a623; margin-right: 4px; }
.col-post { overflow: hidden; white-space: nowrap; }
.pos-tags { display: inline; overflow: hidden; white-space: nowrap; }
.pos-chip { display: inline-block; padding: 2px 8px; background: var(--blue-bg); color: var(--primary); border-radius: 5px; font-size: 12px; margin-right: 4px; white-space: nowrap; }
.pos-count { color: var(--text-sub); font-size: 12px; margin-left: 2px; }
.empty { text-align: center; color: var(--text-sub); padding: 30px 0; }

/* 表格操作按钮 */
.col-actions { white-space: nowrap; }
.row-btn {
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
  margin-right: 8px;
}
.row-btn:hover { border-color: var(--primary); color: var(--primary); }
.row-btn.primary { border-color: var(--primary); background: var(--blue-bg); color: var(--primary); }
.row-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.row-btn:disabled:hover { border-color: var(--border); color: var(--text); }
.row-btn.fav-btn { color: #e6a23c; border-color: #f0d9b0; }
.row-btn.fav-btn.faved { background: #fff7e6; border-color: #e6a23c; color: #e6a23c; }

/* 标签 */
.tag { display: inline-block; padding: 3px 10px; border-radius: 6px; font-size: 12px; font-weight: 500; white-space: nowrap; }
.tag-sm { font-size: 11px; padding: 2px 8px; margin-right: 8px; }
.tag-blue { background: var(--blue-bg); color: #4a86e8; }
.tag-purple { background: var(--purple-bg); color: #8b7cf6; }
.tag-green { background: var(--green-bg); color: #35b779; }
.tag-orange { background: var(--orange-bg); color: #f5a623; }
.tag-cyan { background: #e7f8f7; color: #17a2a6; }
.tag-pink { background: #fdeef4; color: #e56a9a; }
.tag-gray { background: #eef2f7; color: #8a9bb0; }

/* 分页 */
.pagination { display: flex; align-items: center; justify-content: center; gap: 16px; padding: 16px 0 8px; }
.page-btn { height: 36px; padding: 0 20px; border: 1px solid var(--border); border-radius: 10px; background: #fff; color: var(--text); font-size: 13px; cursor: pointer; }
.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.page-info { font-size: 13px; color: var(--text-sub); }

/* 选择求职计划弹窗 */
.plan-select-mask { position: fixed; inset: 0; background: rgba(20, 40, 70, 0.4); display: flex; align-items: center; justify-content: center; z-index: 9998; }
.plan-select-dialog { width: 440px; max-width: 92vw; background: #fff; border-radius: 16px; padding: 24px; }
.ps-title { font-size: 18px; font-weight: 700; color: var(--navy); }
.ps-sub { font-size: 13px; color: var(--text-sub); margin-top: 4px; margin-bottom: 16px; }
.ps-list { display: flex; flex-direction: column; gap: 8px; max-height: 320px; overflow-y: auto; }
.ps-item { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid var(--border); border-radius: 10px; cursor: pointer; }
.ps-item.checked { border-color: var(--primary); background: #f5f9ff; }
.ps-radio { width: 16px; height: 16px; border-radius: 50%; border: 1.5px solid #c8d5e3; flex-shrink: 0; }
.ps-radio.on { border-color: var(--primary); background: var(--primary); box-shadow: inset 0 0 0 3px #fff; }
.ps-body { flex: 1; }
.ps-name { font-size: 14px; font-weight: 600; color: var(--navy); display: flex; align-items: center; gap: 8px; }
.ps-tag { font-size: 11px; padding: 1px 8px; border-radius: 8px; background: var(--blue-bg); color: var(--primary); }
.ps-tag.gray { background: #eef2f7; color: #8a9bb0; }
.ps-desc { font-size: 12px; color: var(--text-sub); margin-top: 2px; }
.ps-count { font-size: 12px; color: var(--text-sub); white-space: nowrap; }
.ps-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }

/* 系统设置页 */
.settings-page { display: flex; flex-direction: column; gap: 16px; }
.settings-title { font-size: 20px; font-weight: 700; color: var(--navy); }
.settings-card { padding: 24px; }
.settings-section { display: flex; flex-direction: column; gap: 12px; }
.settings-section-title { font-size: 16px; font-weight: 600; color: var(--navy); margin-bottom: 4px; }
.settings-row { display: flex; align-items: center; gap: 16px; font-size: 14px; }
.settings-label { width: 80px; flex-shrink: 0; color: var(--text-sub); }
.settings-value { color: var(--text); }
.settings-note { display: flex; flex-direction: column; gap: 6px; }
.settings-note-text { margin: 0; padding: 12px 16px; background: #f7fafd; border-radius: 10px; font-size: 13px; color: var(--text); white-space: pre-wrap; line-height: 1.6; font-family: inherit; }
.settings-actions { display: flex; gap: 10px; margin-top: 8px; }
.settings-tip { font-size: 13px; color: var(--text-sub); }

.settings-switch-row { display: flex; align-items: center; justify-content: space-between; }
.settings-switch-label { font-size: 14px; color: var(--text); }
.settings-switch-desc { font-size: 12px; color: var(--text-sub); }
.settings-switch { position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; }
.settings-switch input {
  position: absolute;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  margin: 0;
  z-index: 1;
}
.settings-slider {
  position: absolute; inset: 0; cursor: pointer;
  background: #dce7f4; border-radius: 12px; transition: 0.2s;
}
.settings-slider::before {
  content: ''; position: absolute; left: 3px; top: 3px;
  width: 18px; height: 18px; background: #fff; border-radius: 50%; transition: 0.2s;
}
.settings-switch input:checked + .settings-slider { background: var(--primary); }
.settings-switch input:checked + .settings-slider::before { transform: translateX(20px); }
</style>
