<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import campusPoster from './assets/campus-poster.png';
import taobaoShopQr from '../../campus-job-desktop/src/assets/taobao-shop-qr.jpg';
import {
  clearToken, createPlan, fetchJobs, fetchMeta, followJob,
  getJobStatusList, getPlans, getPublicConfig, getToken, getUserInfo,
  passwordLogin, redeemCode, register, setPlanActive,
  setToken, unfollowJob, updateJobStatus
} from '../../campus-job-desktop/src/api/index.js';

const NATURE_CLASS = {
  '央国企': 'central', '民企': 'private', '外企/合资': 'foreign',
  '事业单位': 'institution', '社会机构/公益组织': 'public', '其他': 'other'
};
const FILTERS = [
  { key: 'recruitType', label: '招聘类型', meta: 'recruitTypes', multi: true },
  { key: 'grade', label: '届别', meta: 'grades', multi: false, suffix: '届' },
  { key: 'industry', label: '行业', meta: 'industries', multi: true },
  { key: 'city', label: '城市', meta: 'cities', multi: true },
  { key: 'nature', label: '企业性质', meta: 'natures', multi: true },
  { key: 'education', label: '学历', meta: 'educations', multi: false }
];
const STATUS = [
  { key: '', label: '全部' },
  { key: 'TO_EVALUATE', label: '意向' },
  { key: 'PREPARING', label: '准备' },
  { key: 'APPLIED', label: '已投递' },
  { key: 'ASSESSMENT', label: '笔试' },
  { key: 'INTERVIEW', label: '面试' },
  { key: 'OFFER', label: 'Offer' },
  { key: 'CLOSED', label: '已结束' }
];
const STATUS_LABEL = {
  TO_EVALUATE: '意向岗位', PREPARING: '准备投递', APPLIED: '已投递',
  ASSESSMENT: '笔试', INTERVIEW: '面试', OFFER: 'Offer', CLOSED: '已结束'
};
const SUB_STATUS = {
  ASSESSMENT: ['待笔试', '笔试进行中', '已完成笔试', '等待笔试结果', '笔试通过', '笔试未通过'],
  INTERVIEW: ['待一面', '一面进行中', '等待一面结果', '待二面', '二面进行中', '等待二面结果', '待终面', '终面进行中', 'HR面', '等待最终结果', '面试通过', '面试未通过'],
  OFFER: ['待确认', '已接受', '已拒绝', '签约中', '已签约'],
  CLOSED: ['简历未通过', '笔试未通过', '面试未通过', '主动放弃', '岗位停止招聘', '岗位已过期', '长期无反馈', '已接受其他 Offer', '重复岗位', '其他原因']
};

const tab = ref('home');
const meta = ref({});
const listTab = ref('all');
const searchOpen = ref(false);
const keyword = ref('');
const filters = reactive({ recruitType: '', grade: '', industry: '', city: '', nature: '', education: '' });
const jobs = ref([]);
const total = ref(0);
const latestUpdate = ref('');
const latestCount = ref(0);
const page = ref(1);
const hasMore = ref(true);
const loading = ref(false);

const panel = ref(null);
const panelLevel = ref('root');
const panelProvince = ref('');
const panelSelected = ref([]);

const user = ref(null);
const loggedIn = ref(!!getToken());
const authMode = ref('login');
const phone = ref('');
const password = ref('');
const authMessage = ref('');
const redeemInput = ref('');
const redeemMessage = ref('');
const vipPrices = ref([
  { key: 'month', name: '月卡', days: 30, original: '19.9', sale: '9.9' },
  { key: 'quarter', name: '季卡', days: 90, original: '49.9', sale: '25.9' },
  { key: 'year', name: '年卡', days: 365, original: '168', sale: '88' }
]);
const tierClass = { month: 'tier-month', quarter: 'tier-quarter', year: 'tier-year' };
const plans = ref([]);
const planName = ref('');
const planMessage = ref('');
const followed = ref([]);
const followStatus = ref('');
const statusJob = ref(null);
const statusMain = ref('');
const pendingFollow = ref(null);
const newPlanName = ref('');
const savingFollow = ref(false);
const gateMessage = ref('');

const isVip = computed(() => user.value?.isVip === true);
const vipExpireText = computed(() => user.value?.vipExpire ? String(user.value.vipExpire).slice(0, 10) : '');
const vipExpiring = computed(() => {
  if (!isVip.value || !vipExpireText.value) return false;
  return (new Date(vipExpireText.value + 'T00:00:00') - new Date()) / 86400000 < 7;
});
const profileSubtitle = computed(() => {
  if (!loggedIn.value) return '登录后同步关注岗位';
  if (isVip.value) return vipExpireText.value ? '会员到期 ' + vipExpireText.value : '会员已开通';
  return '普通用户 · 开通会员解锁更多功能';
});
const showShop = ref(false);
const copyMessage = ref('');
const TAOBAO_CODE = '【淘宝】https://e.tb.cn/h.8wgjIq2YZ34lcLQ?tk=jbxiTlHwFYN MF278 ';
async function copyTaobaoCode() {
  try {
    await navigator.clipboard.writeText(TAOBAO_CODE);
    copyMessage.value = '口令已复制，打开淘宝即可跳转';
  } catch {
    copyMessage.value = '复制失败，请长按口令手动复制';
  }
}
const visibleFollowed = computed(() => followStatus.value
  ? followed.value.filter(item => item.mainStatus === followStatus.value)
  : followed.value);
const followedIds = computed(() => new Set(followed.value.map(item => String(item.jobId))));

function splitValues(value) {
  return String(value || '').split(/[,|]/).map(item => item.trim()).filter(Boolean);
}
function unique(values) { return [...new Set(values)]; }
function decorateJob(item) {
  const positions = unique(String(item.positions || '').replace(/[\r\n\t]+/g, ' ').split(/[|,]/).map(part => part.trim()).filter(Boolean));
  const date = value => {
    if (!value) return '';
    const raw = String(value).slice(0, 10);
    const today = new Date();
    const local = new Date(raw + 'T00:00:00');
    const start = dateOnly => new Date(dateOnly.getFullYear(), dateOnly.getMonth(), dateOnly.getDate());
    const diff = Math.round((start(today) - start(local)) / 86400000);
    if (diff === 0) return '今日';
    if (diff === 1) return '昨日';
    return raw.slice(5).replace('-', '/');
  };
  return {
    ...item,
    nature: item.companyNature,
    natureClass: NATURE_CLASS[item.companyNature] || 'other',
    recruitLabel: splitValues(item.recruitTypes)[0] || '',
    positionArr: positions.slice(0, 5),
    industryArr: unique(splitValues(item.industry)).slice(0, 2),
    cityArr: unique(splitValues(item.cities)).slice(0, 3),
    publishLabel: date(item.publishDate),
    deadlineLabel: item.deadlineDate ? date(item.deadlineDate) + ' 截止' : (item.deadline || '招满即止')
  };
}
function filterLabel(item) {
  const value = filters[item.key];
  if (!value) return item.label;
  const first = value.split(',')[0];
  const count = value.split(',').length;
  const text = item.suffix ? first + item.suffix : first;
  return count > 1 ? text + '等' : text;
}
async function loadJobs(reset) {
  if (loading.value || (!reset && !hasMore.value)) return;
  const nextPage = reset ? 1 : page.value;
  loading.value = true;
  try {
    const data = await fetchJobs({
      page: nextPage, size: 20, sort: 'publish', keyword: keyword.value.trim(),
      recruitType: filters.recruitType, grade: filters.grade, industry: filters.industry,
      city: filters.city, education: filters.education,
      nature: listTab.value === 'central' ? '央国企' : filters.nature
    });
    const records = (data.records || []).map(decorateJob);
    jobs.value = reset ? records : jobs.value.concat(records);
    total.value = data.total || 0;
    page.value = nextPage + 1;
    hasMore.value = nextPage < (data.pages || 0);
  } catch (error) {
    gateMessage.value = error.message || '加载失败';
  } finally {
    loading.value = false;
  }
}

async function switchList(next) {
  listTab.value = next;
  await loadJobs(true);
}

function openPanel(item) {
  const current = splitValues(filters[item.key]);
  panel.value = item;
  panelSelected.value = current;
  const selectedProvince = item.key === 'city'
    ? (meta.value.provinces || []).find(province => province.cities?.some(city => current.includes(city)))
    : null;
  panelLevel.value = selectedProvince ? 'city' : 'root';
  panelProvince.value = selectedProvince?.name || '';
}
const panelOptions = computed(() => {
  if (!panel.value) return [];
  if (panel.value.key !== 'city') {
    return (meta.value[panel.value.meta] || []).map(value => ({
      value: String(value),
      label: panel.value.suffix ? value + panel.value.suffix : value
    }));
  }
  if (panelLevel.value === 'root') {
    return [
      ...(meta.value.specialCities || []).map(value => ({ value, label: value, kind: 'city' })),
      ...(meta.value.provinces || []).map(item => ({ value: item.name, label: item.name, kind: 'province' }))
    ];
  }
  const province = (meta.value.provinces || []).find(item => item.name === panelProvince.value);
  const cities = province?.cities || [];
  return [
    ...(cities.length ? [{ value: cities[0], label: '全省（' + province.name + '）', kind: 'city' }] : []),
    ...cities.slice(1).map(value => ({ value, label: value, kind: 'city' }))
  ];
});
function chooseOption(option) {
  if (option.kind === 'province') {
    panelProvince.value = option.value;
    panelLevel.value = 'city';
    return;
  }
  const selected = panelSelected.value;
  if (panel.value.multi) {
    panelSelected.value = selected.includes(option.value)
      ? selected.filter(value => value !== option.value)
      : selected.concat(option.value);
  } else {
    panelSelected.value = selected.includes(option.value) ? [] : [option.value];
  }
}
function confirmPanel() {
  filters[panel.value.key] = panelSelected.value.join(',');
  panel.value = null;
  loadJobs(true);
}
function openExternal(url) {
  if (!loggedIn.value) { tab.value = 'mine'; authMessage.value = '请先登录'; return; }
  if (!isVip.value) { tab.value = 'mine'; gateMessage.value = '开通会员后可打开网申页面'; return; }
  window.open(url, '_blank', 'noopener,noreferrer');
}
async function startFollow(job) {
  if (followedIds.value.has(String(job.id))) return;
  if (!loggedIn.value) { tab.value = 'mine'; authMessage.value = '请先登录'; return; }
  await loadPlans();
  const usable = plans.value.filter(item => ['IN_PROGRESS', 'DRAFT', 'PAUSED'].includes(item.status));
  newPlanName.value = '';
  pendingFollow.value = { job, plans: usable, planId: usable.length ? (usable.find(item => item.status === 'IN_PROGRESS') || usable[0]).id : null };
}
async function confirmFollow() {
  const pending = pendingFollow.value;
  if (!pending || savingFollow.value) return;
  if (!pending.plans.length && !newPlanName.value.trim()) {
    gateMessage.value = '请给求职计划起个名字';
    return;
  }
  if (!pending.plans.length && !isVip.value) {
    gateMessage.value = '计划创建后，开通会员即可关注岗位';
  }
  savingFollow.value = true;
  try {
    let planId = pending.planId;
    if (!pending.plans.length) {
      const created = await createPlan({ planName: newPlanName.value.trim(), status: 'IN_PROGRESS' });
      planId = created;
      await loadPlans();
      pending.plans = plans.value.filter(item => ['IN_PROGRESS', 'DRAFT', 'PAUSED'].includes(item.status));
      pending.planId = planId;
    }
    if (!isVip.value) {
      pendingFollow.value = null;
      tab.value = 'mine';
      gateMessage.value = '求职计划已创建，开通会员后即可关注岗位';
      return;
    }
    await followJob(pending.job.id, planId);
    pendingFollow.value = null;
    await loadFollowed();
  } catch (error) { gateMessage.value = error.message || '关注失败'; }
  finally { savingFollow.value = false; }
}

async function loadFollowed() {
  if (!getToken()) { followed.value = []; return; }
  try { followed.value = await getJobStatusList(); } catch { followed.value = []; }
}
async function changeStatus(mainStatus, subStatus) {
  const job = statusJob.value;
  if (!job) return;
  try {
    if (mainStatus === 'CLOSED') await updateJobStatus(job.jobId, mainStatus, '', subStatus);
    else await updateJobStatus(job.jobId, mainStatus, subStatus || '', '');
    statusJob.value = null;
    statusMain.value = '';
    await loadFollowed();
  } catch (error) { gateMessage.value = error.message || '状态更新失败'; }
}
async function removeFollow(job) {
  try { await unfollowJob(job.jobId); await loadFollowed(); }
  catch (error) { gateMessage.value = error.message || '取消关注失败'; }
}

async function loadAccount() {
  if (!getToken()) return;
  try {
    user.value = await getUserInfo();
    loggedIn.value = true;
    await loadPlans();
    await loadFollowed();
  } catch {
    clearToken(); loggedIn.value = false; user.value = null;
  }
}
async function submitAuth() {
  authMessage.value = '';
  try {
    if (authMode.value === 'register') {
      await register(phone.value.trim(), password.value, '');
      authMode.value = 'login';
      authMessage.value = '注册成功，请登录';
      return;
    }
    const data = await passwordLogin(phone.value.trim(), password.value);
    setToken(data.token);
    password.value = '';
    await loadAccount();
  } catch (error) { authMessage.value = error.message || '操作失败'; }
}
function logout() {
  clearToken();
  loggedIn.value = false;
  user.value = null;
  followed.value = [];
  plans.value = [];
}
async function submitRedeem() {
  redeemMessage.value = '';
  try {
    const data = await redeemCode(redeemInput.value.trim());
    redeemInput.value = '';
    redeemMessage.value = '兑换成功';
    user.value = { ...(user.value || {}), isVip: true, vipExpire: data.vipExpire };
    await loadAccount();
  } catch (error) { redeemMessage.value = error.message || '兑换失败'; }
}
async function loadPlans() {
  try { plans.value = await getPlans(); } catch { plans.value = []; }
}
async function addPlan() {
  const name = planName.value.trim();
  if (!name) return;
  try {
    await createPlan({ planName: name, status: plans.value.length ? 'DRAFT' : 'IN_PROGRESS' });
    planName.value = '';
    planMessage.value = '计划已创建';
    await loadPlans();
  } catch (error) { planMessage.value = error.message || '创建失败'; }
}
async function activatePlan(plan) {
  try { await setPlanActive(plan.id); await loadPlans(); }
  catch (error) { planMessage.value = error.message || '切换失败'; }
}

function onScroll(event) {
  const element = event.target;
  if (tab.value === 'jobs' && element.scrollTop + element.clientHeight > element.scrollHeight - 240) {
    loadJobs(false);
  }
}

onMounted(async () => {
  try {
    meta.value = await fetchMeta();
    latestUpdate.value = meta.value.latestUpdate || '';
    latestCount.value = meta.value.recentCount || 0;
  } catch {}
  try {
    const cfg = await getPublicConfig();
    if (Array.isArray(cfg?.vipPrices) && cfg.vipPrices.length) vipPrices.value = cfg.vipPrices;
  } catch {}
  await loadAccount();
  loadJobs(true);
});
</script>

<template>
  <div class="m-app">
    <main class="m-main" @scroll.passive="onScroll">
      <section v-show="tab === 'jobs'" class="m-jobs">
        <header class="m-top">
          <div class="m-list-tabs">
            <button :class="{ on: listTab === 'all' }" @click="switchList('all')">全部</button>
            <button :class="{ on: listTab === 'central' }" @click="switchList('central')">央国企</button>
          </div>
          <button class="m-search-icon" :aria-label="searchOpen ? '收起搜索' : '打开搜索'" :title="searchOpen ? '收起搜索' : '搜索'" @click="searchOpen = !searchOpen">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg>
          </button>
        </header>
        <form v-if="searchOpen" class="m-search" @submit.prevent="loadJobs(true)">
          <input v-model="keyword" placeholder="搜索公司或岗位" />
          <button>搜索</button>
        </form>
        <div class="m-filters">
          <button v-for="item in FILTERS" :key="item.key" :class="{ on: filters[item.key] }" @click="openPanel(item)">
            {{ filterLabel(item) }} <span>▾</span>
          </button>
        </div>
        <div class="m-count">
          <span v-if="latestUpdate">更新于 {{ latestUpdate }} · 近7天新增 {{ latestCount }} 条</span>
          <strong>共 {{ total }} 个岗位</strong>
        </div>
        <article v-for="item in jobs" :key="item.id" class="m-card">
          <div class="m-card-head">
            <h2>{{ item.companyName }} <em v-if="item.nature" :class="item.natureClass">{{ item.nature }}</em></h2>
            <span v-if="item.recruitLabel" class="m-recruit-label">{{ item.recruitLabel }}</span>
          </div>
          <p v-if="item.positionArr.length"><label>岗位</label><span v-for="tag in item.positionArr" :key="tag">{{ tag }}</span></p>
          <p v-if="item.industryArr.length"><label>行业</label><span v-for="tag in item.industryArr" :key="tag">{{ tag }}</span></p>
          <p v-if="item.cityArr.length"><label>地点</label><span v-for="tag in item.cityArr" :key="tag">{{ tag }}</span></p>
          <footer class="m-job-time"><span v-if="item.publishLabel" :class="{ 'm-today-publish': item.publishLabel === '今日' }">{{ item.publishLabel }} 发布</span><span>{{ item.deadlineLabel }}</span></footer>
          <footer class="m-job-actions">
            <button class="m-action-notice" :disabled="!item.noticeUrl" @click="openExternal(item.noticeUrl)">公告</button>
            <button class="m-action-apply" :disabled="!item.applyUrl" @click="openExternal(item.applyUrl)">投递</button>
            <button class="m-action-follow" :disabled="followedIds.has(String(item.id))" :class="{ 'is-followed': followedIds.has(String(item.id)) }" @click="startFollow(item)">{{ followedIds.has(String(item.id)) ? '已关注' : '关注' }}</button>
          </footer>
        </article>
        <div class="m-empty">{{ loading ? '加载中...' : jobs.length ? (hasMore ? '' : '没有更多了') : '没有找到相关岗位' }}</div>
      </section>

      <section v-show="tab === 'follow'" class="m-follow">
        <h1>关注岗位</h1>
        <div class="m-status">
          <button v-for="item in STATUS" :key="item.key" :class="{ on: followStatus === item.key }" @click="followStatus = item.key">{{ item.label }}</button>
        </div>
        <article v-for="job in visibleFollowed" :key="job.jobId" class="m-card">
          <div class="m-card-head"><h2>{{ job.companyName }}</h2><em>{{ STATUS_LABEL[job.mainStatus] || job.mainStatus }}</em></div>
          <p>{{ splitValues(job.positions).slice(0, 2).join(' · ') }}</p>
          <small>{{ job.subStatus || '未设置细分状态' }} · {{ splitValues(job.cities).slice(0, 2).join(' ') }}</small>
          <footer>
            <button class="m-action-notice" :disabled="!job.noticeUrl" @click="openExternal(job.noticeUrl)">公告</button>
            <button class="m-action-apply" :disabled="!job.applyUrl" @click="openExternal(job.applyUrl)">投递</button>
            <button class="m-action-status" @click="statusJob = job; statusMain = ''">流转</button>
            <button class="m-action-cancel" @click="removeFollow(job)">取消</button>
          </footer>
        </article>
        <div v-if="!visibleFollowed.length" class="m-empty">{{ loggedIn ? '暂无关注岗位' : '登录后查看关注岗位' }}</div>
      </section>

      <section v-show="tab === 'home'" class="m-home">
        <img class="m-home-poster" :src="campusPoster" alt="橙子校招：校招求职，一个工具管起来！电脑端、手机网页、微信小程序多端互通；岗位库、投递插件、求职计划、网申直达" width="1296" height="1728" />
        <div class="m-home-shortcuts">
          <button @click="tab = 'jobs'"><div class="m-shortcut-title"><strong>岗位库</strong><em>（新增 {{ latestCount }} 条）</em></div><span>浏览最新岗位 →</span></button>
          <button @click="tab = 'follow'; loadFollowed()"><strong>关注岗位</strong><span>{{ followed.length }} 个已关注 →</span></button>
        </div>
      </section>

      <section v-show="tab === 'mine'" class="m-mine">
        <header class="m-profile-hero">
          <div class="m-profile-avatar">{{ loggedIn ? (user?.nickname || '橙').slice(0, 1) : '橙' }}</div>
          <div class="m-profile-info"><h1>{{ loggedIn ? (user?.nickname || ('用户' + String(user?.phone || '').slice(-4))) : '欢迎来到橙子校招' }}</h1><p :class="{ 'm-vip-expiring': vipExpiring }">{{ profileSubtitle }}</p></div>
          <button v-if="loggedIn" class="m-logout" @click="logout">退出</button>
        </header>
        <div v-if="!loggedIn" class="m-card m-profile-section">
          <h2>账号登录</h2>
          <div class="m-auth-tabs">
            <button :class="{ on: authMode === 'login' }" @click="authMode = 'login'">登录</button>
            <button :class="{ on: authMode === 'register' }" @click="authMode = 'register'">注册</button>
          </div>
          <input v-model="phone" placeholder="手机号" />
          <input v-model="password" type="password" placeholder="密码（至少 6 位）" />
          <button class="m-primary" @click="submitAuth">{{ authMode === 'login' ? '登录' : '注册' }}</button>
          <small>{{ authMessage }}</small>
        </div>
        <template v-else>
          <div class="m-profile-stats"><div><strong>{{ followed.length }}</strong><span>关注岗位</span></div><div><strong>{{ isVip ? '已开通' : '未开通' }}</strong><span>会员状态</span></div></div>
          <div class="m-card m-profile-section">
            <div class="m-section-head"><h2>会员兑换</h2><span>解锁网申直达与岗位关注</span></div>
            <div class="m-inline"><input v-model="redeemInput" placeholder="输入兑换码" /><button @click="submitRedeem">兑换</button></div>
            <small>{{ redeemMessage }}</small>
            <button class="m-get-code" @click="showShop = true; copyMessage = ''">获取兑换码</button>
            <div class="m-pricing">
              <article v-for="item in vipPrices" :key="item.key" :class="tierClass[item.key]">
                <strong>{{ item.name }}</strong>
                <del v-if="item.original && item.original !== item.sale">¥{{ item.original }}</del>
                <b>¥{{ item.sale }}</b>
                <small>限时 · {{ item.days }} 天</small>
              </article>
            </div>
            <div class="m-benefits">
              <h3>会员权益介绍</h3>
              <ol>
                <li>岗位每日更新（全网最全）</li>
                <li>手机、电脑、客户端多端互通共用</li>
                <li>支持关注岗位与进度管理</li>
                <li><em>赠送：</em>快速填写网申插件（别再手填了）</li>
              </ol>
            </div>
          </div>
        </template>
      </section>
    </main>

    <nav class="m-tabbar">
      <button :class="{ on: tab === 'home' }" @click="tab = 'home'" aria-label="首页">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" /></svg><span>首页</span>
      </button>
      <button :class="{ on: tab === 'jobs' }" @click="tab = 'jobs'" aria-label="岗位库">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18M10 13v2h4v-2"/></svg><span>岗位库</span>
      </button>
      <button :class="{ on: tab === 'follow' }" @click="tab = 'follow'; loadFollowed()" aria-label="关注岗位">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-9-5.8-9-12a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6.2-9 12-9 12z"/></svg><span>关注岗位</span>
      </button>
      <button :class="{ on: tab === 'mine' }" @click="tab = 'mine'" aria-label="我的">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2z"/></svg><span>我的</span>
      </button>
    </nav>

    <div v-if="panel" class="m-mask" @click="panel = null"></div>
    <section v-if="panel" class="m-sheet">
      <header><button v-if="panelLevel === 'city'" @click="panelLevel = 'root'">返回</button><h3>{{ panel.label }}</h3><button @click="panel = null">关闭</button></header>
      <div v-if="panel.key === 'city'" class="m-city-path">{{ panelLevel === 'root' ? '选择省份或直辖市' : panelProvince + ' · 选择城市（可多选）' }}</div>
      <div class="m-options" :class="{ 'm-city-options': panel.key === 'city' }">
        <button v-for="option in panelOptions" :key="option.value" :class="{ on: panelSelected.includes(option.value), province: option.kind === 'province' }" @click="chooseOption(option)">{{ option.label }}<span v-if="option.kind === 'province'">›</span><span v-else-if="panel.key === 'city' && panelSelected.includes(option.value)">✓</span></button>
      </div>
      <div v-if="panel.key === 'city' && panelSelected.length" class="m-city-selected">已选：{{ panelSelected.join('、') }}</div>
      <footer><button @click="panelSelected = []">重置</button><button class="m-primary" @click="confirmPanel">确定</button></footer>
    </section>

    <div v-if="pendingFollow" class="m-mask" @click="pendingFollow = null"></div>
    <section v-if="pendingFollow" class="m-sheet">
      <header><h3>{{ pendingFollow.plans.length ? '选择求职计划' : '创建求职计划' }}</h3><button @click="pendingFollow = null">关闭</button></header>
      <p class="m-follow-hint">{{ pendingFollow.plans.length ? '将这个岗位加入哪一个计划？' : '给求职计划起个名字，创建后即可关注这个岗位。' }}</p>
      <template v-if="pendingFollow.plans.length"><button v-for="plan in pendingFollow.plans" :key="plan.id" class="m-plan-choice" :class="{ on: pendingFollow.planId === plan.id }" @click="pendingFollow.planId = plan.id">{{ plan.planName }}<span>{{ pendingFollow.planId === plan.id ? '✓' : '' }}</span></button></template>
      <input v-else v-model="newPlanName" class="m-plan-name" maxlength="40" placeholder="例如：2027秋招计划" @keyup.enter="confirmFollow" />
      <footer><button class="m-primary" :disabled="savingFollow" @click="confirmFollow">{{ savingFollow ? '处理中...' : (pendingFollow.plans.length ? '确认关注' : '创建并关注') }}</button></footer>
    </section>

    <div v-if="statusJob" class="m-mask" @click="statusJob = null"></div>
    <section v-if="statusJob" class="m-sheet">
      <header><button v-if="statusMain" @click="statusMain = ''">返回</button><h3>更新状态</h3><button @click="statusJob = null">关闭</button></header>
      <div v-if="!statusMain" class="m-options">
        <button v-for="item in STATUS.filter(item => item.key)" :key="item.key" @click="SUB_STATUS[item.key] ? statusMain = item.key : changeStatus(item.key)">{{ STATUS_LABEL[item.key] }}</button>
      </div>
      <div v-else class="m-options">
        <button v-for="item in SUB_STATUS[statusMain]" :key="item" @click="changeStatus(statusMain, item)">{{ item }}</button>
      </div>
    </section>
    <div v-if="gateMessage" class="m-toast" @click="gateMessage = ''">{{ gateMessage }}</div>
    <div v-if="showShop" class="m-mask" @click="showShop = false"></div>
    <section v-if="showShop" class="m-shop">
      <header><h3>官方淘宝店获取</h3><button @click="showShop = false">关闭</button></header>
      <div><strong>获取方式 1</strong><p>淘宝 APP 扫描店铺二维码</p><img :src="taobaoShopQr" alt="官方淘宝店铺二维码" /></div>
      <div><strong>获取方式 2</strong><p>复制口令，打开淘宝自动跳转</p><code>{{ TAOBAO_CODE }}</code><button @click="copyTaobaoCode">复制口令</button><small>{{ copyMessage }}</small></div>
    </section>
  </div>
</template>

<style scoped>
.m-app { position: fixed; inset: 0; display: flex; flex-direction: column; background: #f5f6f8; color: #333; font-size: 14px; }
.m-main { flex: 1; overflow: auto; padding-bottom: calc(64px + env(safe-area-inset-bottom)); }
.m-top, .m-search, .m-filters, .m-count { background: #fff; }
.m-top, .m-search, .m-auth-tabs, .m-inline, .m-card-head, .m-card footer, .m-account, .m-plan, .m-sheet header, .m-sheet footer { display: flex; align-items: center; }
.m-top { justify-content: space-between; padding: 14px 16px 8px; position: sticky; top: 0; z-index: 2; }
.m-list-tabs button, .m-auth-tabs button { margin-right: 22px; border: 0; background: none; color: #999; font-size: 16px; }
.m-list-tabs button.on, .m-auth-tabs button.on { color: #324263; font-weight: 700; border-bottom: 3px solid #8ee7d8; }
.m-search-icon, .m-card footer button, .m-inline button, .m-account button, .m-plan button, .m-sheet header button { border: 0; background: #f2f3f5; color: #324263; border-radius: 8px; padding: 6px 10px; }
.m-search-icon { display: grid; place-items: center; width: 34px; height: 34px; padding: 0; color: #324263; }
.m-search-icon svg { width: 19px; height: 19px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }
.m-search { padding: 0 16px 12px; }
.m-search input, .m-card input, .m-inline input, .m-plan-name { flex: 1; height: 38px; border: 0; border-radius: 19px; background: #f2f3f5; padding: 0 14px; font-size: 16px; }
.m-app input, .m-app textarea, .m-app select { font-size: 16px; }
.m-search button, .m-primary { margin-left: 10px; border: 0; background: #324263; color: #fff; border-radius: 18px; padding: 8px 14px; }
.m-filters { display: flex; gap: 4px; overflow-x: auto; border-top: 1px solid #f0f0f0; padding: 0 8px; }
.m-filters button, .m-status button { flex: none; border: 0; background: none; color: #666; padding: 12px; }
.m-filters button.on, .m-status button.on, .m-options button.on, .m-sheet > button.on { color: #324263; font-weight: 700; }
.m-count { display: flex; justify-content: space-between; padding: 10px 16px; color: #999; font-size: 12px; }
.m-count span { color: #324263; }
.m-card { margin: 10px 12px; padding: 14px; background: #fff; border-radius: 14px; }
.m-card-head { justify-content: space-between; gap: 8px; }
.m-card h2, .m-card h3 { margin: 0; font-size: 16px; }
.m-card h2 em { margin-left: 8px; color: #fff; font-style: normal; font-size: 11px; padding: 2px 6px; border-radius: 4px; background: #8d8d8d; }
.m-card h2 em.central { background: #a8665c; } .m-card h2 em.private { background: #6b8796; }
.m-card h2 em.foreign { background: #8b7d9c; } .m-card h2 em.institution { background: #ad8a63; }
.m-card h2 em.public { background: #7a9a82; }
.m-card-head > span, .m-follow em { flex: none; color: #fff; background: linear-gradient(135deg, #324263, #b1ffec); border-radius: 12px; padding: 3px 8px; font-size: 12px; font-style: normal; }
.m-card-head > .m-recruit-label { color: #71808a; background: transparent; border-radius: 0; padding: 0; font-size: 12px; }
.m-card p { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
.m-card label { width: 36px; color: #999; font-size: 12px; line-height: 24px; }
.m-card p span { max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; background: #f2f3f5; color: #324263; border-radius: 4px; padding: 2px 7px; font-size: 12px; }
.m-card footer, .m-account, .m-plan { justify-content: space-between; gap: 8px; color: #999; font-size: 12px; }
.m-card footer { margin-top: 8px; }
.m-job-actions { justify-content: flex-end !important; }
.m-job-actions button:disabled { opacity: .45; }
.m-job-actions button:not(:disabled) { cursor: pointer; font-weight: 600; }
.m-job-actions .m-action-notice, .m-job-actions .m-action-apply, .m-job-actions .m-action-follow, .m-job-actions .m-action-status { color: #2f6f86; background: #e8f5f7; }
.m-job-actions .m-action-apply { color: #9a6634; background: #fff1df; }
.m-job-actions .m-action-follow { color: #426f68; background: #e5f6f0; }
.m-job-actions .m-action-status { color: #53648a; background: #edf0fb; }
.m-job-actions .m-action-cancel { color: #9a6670; background: #f9ecef; }
.m-job-actions button.is-followed { opacity: 1; color: #6f8290; background: #e8eef1; }
.m-home-poster { display: block; width: 100%; height: auto; }
.m-home-shortcuts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; padding: 12px; }
.m-home-shortcuts button { display: flex; flex-direction: column; gap: 8px; text-align: left; background: #fff; border: 0; border-radius: 14px; padding: 16px; color: #324263; }
.m-home-shortcuts strong { font-size: 16px; }
.m-shortcut-title { display: flex; align-items: baseline; gap: 3px; }
.m-shortcut-title em { color: #df5b45; font-size: 12px; font-style: normal; white-space: nowrap; }
.m-home-shortcuts span { font-size: 12px; color: #87939d; }
.m-home-title { margin: 12px 16px 8px; font-size: 16px; color: #324263; }
.m-profile-hero { display: flex; align-items: center; gap: 12px; padding: 30px 18px 28px; background: linear-gradient(125deg, #2e3f5e, #5a7480); color: white; }
.m-profile-avatar { flex: none; display: grid; place-items: center; width: 52px; height: 52px; border-radius: 18px; background: #ffdd69; color: #324263; font-size: 24px; font-weight: 800; }
.m-profile-info { min-width: 0; flex: 1; }
.m-profile-info h1 { margin: 0 0 5px; font-size: 18px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.m-profile-info p { margin: 0; color: #dce7e9; font-size: 12px; }
.m-profile-info p.m-vip-expiring { color: #ff8d86; font-weight: 800; }
.m-logout { flex: none; color: #fff; background: rgba(255,255,255,.15); border: 0; border-radius: 10px; padding: 8px 10px; }
.m-profile-stats { display: grid; grid-template-columns: repeat(2, 1fr); margin: -10px 12px 12px; position: relative; background: #fff; border-radius: 14px; box-shadow: 0 5px 18px rgba(39,55,78,.08); padding: 16px 4px; text-align: center; }
.m-profile-stats div { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.m-profile-stats div + div { border-left: 1px solid #e9edf0; }
.m-profile-stats strong { font-size: 16px; color: #324263; }
.m-profile-stats span { font-size: 11px; color: #8b97a1; }
.m-profile-section { padding: 18px; box-shadow: 0 4px 16px rgba(39,55,78,.035); }
.m-profile-section h2 { margin: 0 0 14px; color: #293d53; font-size: 17px; }
.m-section-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.m-section-head span { font-size: 11px; color: #96a1aa; white-space: nowrap; }
.m-profile-section .m-inline { gap: 8px; }
.m-pricing { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-bottom: 12px; }
.m-pricing article { display: flex; flex-direction: column; align-items: center; gap: 3px; min-width: 0; padding: 10px 4px; border: 1px solid #e6edf1; border-radius: 12px; background: #f8fafb; }
.m-pricing .tier-month { border-color: #d9e4ee; background: linear-gradient(180deg, #f8fbfd, #eef4f8); }
.m-pricing .tier-quarter { border-color: #efd089; background: linear-gradient(180deg, #fffaf0, #ffe8b8); }
.m-pricing .tier-year { border-color: #e2b15a; background: linear-gradient(180deg, #fff4d4, #f6c96a); }
.m-pricing strong { color: #324263; font-size: 13px; }
.m-pricing del { color: #9aa6b0; font-size: 11px; text-decoration: line-through; }
.m-pricing b { color: #df5b45; font-size: 20px; line-height: 1.1; }
.m-pricing small { color: #8b97a1; font-size: 11px; }
.m-benefits { padding: 12px; border: 1px solid #e8eef1; border-radius: 12px; background: #f8fafb; }
.m-benefits h3 { margin: 0 0 8px; color: #324263; font-size: 15px; }
.m-benefits ol { margin: 0; padding-left: 1.3em; color: #324263; line-height: 1.8; }
.m-benefits em { color: #e23d3d; font-style: normal; font-weight: 800; }
.m-profile-section .m-inline input { width: 0; min-width: 0; margin: 0; }
.m-profile-section .m-inline button { flex: none; padding: 10px 12px; background: #324263; color: #fff; }
.m-profile-section small { display: block; text-align: left; padding: 5px 0 0; }
.m-profile-section > small { display: block; min-height: 18px; margin: 8px 2px 0; color: #8b97a1; }
.m-get-code { width: 100%; height: 44px; margin: 10px 0 14px; border: 0; border-radius: 12px; background: linear-gradient(135deg, #f6c453, #e9a322); color: #5b3b08; font-size: 16px; font-weight: 800; box-shadow: 0 8px 16px rgba(214,154,32,.22); }
.m-shop { position: fixed; left: 16px; right: 16px; top: 50%; transform: translateY(-50%); z-index: 12; max-height: 82vh; overflow: auto; background: #fff; border-radius: 18px; padding: 16px; }
.m-shop header, .m-shop header { display: flex; justify-content: space-between; align-items: center; }
.m-shop h3 { margin: 0; color: #324263; }
.m-shop header button, .m-shop div > button { border: 0; border-radius: 8px; background: #324263; color: #fff; padding: 8px 12px; }
.m-shop header button { background: #f2f3f5; color: #324263; }
.m-shop p, .m-shop small { color: #7b8a95; }
.m-shop img { display: block; width: 178px; height: 178px; margin: 8px auto; border: 8px solid #fff7df; border-radius: 12px; box-shadow: 0 0 0 1px #f0d48a; }
.m-shop code { display: block; margin: 8px 0; padding: 10px; border-radius: 8px; background: #f7f8fa; overflow-wrap: anywhere; }
.m-today-publish { color: #d94c43; font-weight: 700; }
.m-plan { padding: 12px 0; border-top: 1px solid #edf0f3; }
.m-plan > div { gap: 4px; }
.m-plan-active { color: #3f8378; background: #e8f8f4; border-radius: 8px; padding: 6px 8px; }
.m-plan-empty { font-size: 12px; color: #9aa5ad; }
.m-follow h1 { display: flex; align-items: center; gap: 10px; margin: 0; padding: 14px 16px; background: #fff; font-size: 18px; }
.m-status { display: flex; overflow-x: auto; background: #fff; }
.m-account div, .m-plan div { display: flex; flex-direction: column; }
.m-account strong, .m-plan strong { color: #324263; }
.m-card input { width: 100%; margin: 8px 0; }
.m-options button, .m-sheet > button { border: 0; background: #f2f3f5; border-radius: 8px; padding: 7px 10px; }
.m-tabbar { position: fixed; left: 0; right: 0; bottom: 0; display: grid; grid-template-columns: repeat(4, 1fr); background: #fff; border-top: 1px solid #eee; padding-bottom: env(safe-area-inset-bottom); z-index: 5; }
.m-tabbar button { height: 54px; border: 0; background: none; color: #8d97a6; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; font-size: 11px; }
.m-tabbar svg { width: 21px; height: 21px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.m-tabbar button.on { color: #324263; font-weight: 700; }
.m-mask { position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 8; }
.m-sheet { position: fixed; left: 0; right: 0; bottom: 0; max-height: 75vh; overflow: auto; background: #fff; border-radius: 18px 18px 0 0; z-index: 9; padding: 8px 16px calc(16px + env(safe-area-inset-bottom)); }
.m-sheet header, .m-sheet footer { justify-content: space-between; }
.m-options { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
.m-city-path { margin-top: 12px; color: #84929c; font-size: 12px; }
.m-city-options { max-height: 48vh; overflow-y: auto; display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); }
.m-city-options button { display: flex; justify-content: space-between; gap: 3px; min-width: 0; white-space: nowrap; font-size: 12px; padding: 9px 6px; }
.m-city-options button.on { background: #e9f8f4; }
.m-city-options button.province { background: #f3f6f8; }
.m-city-selected { color: #57746e; font-size: 12px; padding: 4px 0 10px; overflow-wrap: anywhere; }
.m-follow-hint { color: #81909c; font-size: 13px; margin: 14px 0; }
.m-plan-choice { width: 100%; margin: 4px 0; display: flex; justify-content: space-between; padding: 12px; }
.m-plan-choice.on { background: #e9f8f4; color: #324263; }
.m-plan-name { width: 100%; box-sizing: border-box; height: auto; border: 1px solid #d9e1e5; border-radius: 10px; background: #fff; padding: 12px; font-size: 16px; }
.m-sheet footer { margin-top: 14px; }
.m-sheet footer .m-primary { flex: 1; margin: 0; }
.m-empty, .m-card small { color: #999; text-align: center; padding: 12px; }
.m-toast { position: fixed; left: 24px; right: 24px; top: 24px; z-index: 12; background: rgba(50,66,99,.94); color: #fff; text-align: center; border-radius: 10px; padding: 12px; }
</style>
