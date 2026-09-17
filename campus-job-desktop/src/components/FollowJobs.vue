<script setup>
import { ref, computed, onMounted } from 'vue';
import { getJobStatusList, updateJobStatus, unfollowJob, getPlans, updateExpectedStart } from '../api';
import DatePicker from './DatePicker.vue';

const emit = defineEmits(['statusChanged', 'openLink']);

const statusTabs = [
  { key: '', label: '全部' },
  { key: 'TO_EVALUATE', label: '意向岗位' },
  { key: 'PREPARING', label: '准备投递' },
  { key: 'APPLIED', label: '已投递' },
  { key: 'ASSESSMENT', label: '笔试' },
  { key: 'INTERVIEW', label: '面试' },
  { key: 'OFFER', label: 'Offer' },
  { key: 'CLOSED', label: '已结束' }
];

const statusLabel = {
  'TO_EVALUATE': '意向岗位', 'PREPARING': '准备投递', 'APPLIED': '已投递',
  'ASSESSMENT': '笔试', 'INTERVIEW': '面试', 'OFFER': 'Offer', 'CLOSED': '已结束'
};

const statusColor = {
  'TO_EVALUATE': 'gray', 'PREPARING': 'purple', 'APPLIED': 'blue',
  'ASSESSMENT': 'orange', 'INTERVIEW': 'cyan', 'OFFER': 'green', 'CLOSED': 'gray'
};

const SUB_STATUS = {
  'ASSESSMENT': ['待笔试', '笔试进行中', '已完成笔试', '等待笔试结果', '笔试通过', '笔试未通过'],
  'INTERVIEW': ['待一面', '一面进行中', '等待一面结果', '待二面', '二面进行中', '等待二面结果', '待终面', '终面进行中', 'HR面', '等待最终结果', '面试通过', '面试未通过'],
  'OFFER': ['待确认', '已接受', '已拒绝', '签约中', '已签约'],
  'CLOSED': ['简历未通过', '笔试未通过', '面试未通过', '主动放弃', '岗位停止招聘', '岗位已过期', '长期无反馈', '已接受其他 Offer', '重复岗位', '其他原因']
};

const currentStatus = ref('');
const currentPlanId = ref(null);
const allJobs = ref([]);
const plans = ref([]);
const loading = ref(false);
const openMenuId = ref(null);
const menuPos = ref({ x: 0, y: 0 });
const subMenuStatus = ref('');

const planJobs = computed(() => {
  if (currentPlanId.value == null) return allJobs.value;
  return allJobs.value.filter(j => j.planId === currentPlanId.value);
});

const countByStatus = computed(() => {
  const c = {};
  for (const j of planJobs.value) {
    c[j.mainStatus] = (c[j.mainStatus] || 0) + 1;
  }
  return c;
});

const jobs = computed(() => {
  if (!currentStatus.value) return planJobs.value;
  return planJobs.value.filter(j => j.mainStatus === currentStatus.value);
});

async function loadPlans() {
  try {
    plans.value = await getPlans();
    if (currentPlanId.value == null || !plans.value.find(p => p.id === currentPlanId.value)) {
      const active = plans.value.find(p => p.status === 'IN_PROGRESS');
      currentPlanId.value = active ? active.id : null;
    }
  } catch (e) { plans.value = []; }
}

function switchPlan(id) {
  currentPlanId.value = id;
}

const showPlanMenu = ref(false);
const currentPlanLabel = computed(() => {
  const p = plans.value.find(p => p.id === currentPlanId.value);
  return p ? p.planName : '请选择计划';
});

async function loadList() {
  loading.value = true;
  try {
    allJobs.value = await getJobStatusList('');
  } catch (e) {
    allJobs.value = [];
  } finally {
    loading.value = false;
  }
}

function switchStatus(status) {
  currentStatus.value = status;
}

function toggleMenu(job, event) {
  if (openMenuId.value === job.jobId) {
    openMenuId.value = null;
    subMenuStatus.value = '';
    return;
  }
  const rect = event.currentTarget.getBoundingClientRect();
  const estHeight = 360;
  let y = rect.bottom + 4;
  if (y + estHeight > window.innerHeight) {
    y = rect.top - 4 - estHeight;
  }
  if (y < 4) y = 4;
  menuPos.value = { x: rect.right - 150, y };
  openMenuId.value = job.jobId;
  subMenuStatus.value = '';
}

function onMainStatusClick(mainStatus) {
  if (SUB_STATUS[mainStatus]) {
    subMenuStatus.value = mainStatus;
  } else {
    confirmStatus(mainStatus, '');
  }
}

function onSubStatusClick(subStatus) {
  confirmStatus(subMenuStatus.value, subStatus);
}

async function confirmStatus(mainStatus, subStatus) {
  const job = allJobs.value.find(j => j.jobId === openMenuId.value);
  openMenuId.value = null;
  subMenuStatus.value = '';
  if (!job) return;
  if (mainStatus === 'CLOSED') {
    // CLOSED 的子状态就是结束原因，作为 reason 传入
    await updateJobStatus(job.jobId, mainStatus, '', subStatus);
  } else {
    await updateJobStatus(job.jobId, mainStatus, subStatus, '');
  }
  await loadList();
  emit('statusChanged');
}

async function unfollow(job) {
  await unfollowJob(job.jobId);
  await loadList();
  emit('statusChanged');
}

function firstOf(str, n = 1) {
  if (!str) return '';
  const arr = str.split(',').map(s => s.trim()).filter(Boolean);
  return arr.slice(0, n).join(' ');
}

function deadlineLabel(r) {
  if (r.deadlineDate) return String(r.deadlineDate).slice(5).replace('-', '/');
  if (r.deadline) return r.deadline;
  return '—';
}

function gradeLabel(r) {
  if (r.gradeMin == null || r.gradeMax == null) return '—';
  if (r.gradeMin === 0 && r.gradeMax === 99) return '不限';
  if (r.gradeMin === r.gradeMax) return r.gradeMin + '届';
  return r.gradeMin + '-' + r.gradeMax + '届';
}

function fmtExpected(v) {
  if (!v) return '';
  return String(v).slice(0, 10);
}

async function saveExpected(job, val) {
  try {
    await updateExpectedStart(job.jobId, val ? val + 'T00:00:00' : '');
    await loadList();
  } catch (e) {}
}

onMounted(async () => {
  await loadPlans();
  loadList();
});
</script>

<template>
  <div class="follow-jobs">
    <!-- 求职计划切换 -->
    <div class="plan-filter">
      <span class="plan-filter-label">求职计划</span>
      <div class="plan-select">
        <div class="plan-select-current" @click="showPlanMenu = !showPlanMenu">
          <span>{{ currentPlanLabel }}</span>
          <span class="plan-select-arrow">▾</span>
        </div>
        <div v-if="showPlanMenu" class="plan-select-menu" @click.stop>
          <div
            v-for="p in plans"
            :key="p.id"
            class="plan-select-item"
            :class="{ on: currentPlanId === p.id }"
            @click="switchPlan(p.id); showPlanMenu = false"
          >
            <span>{{ p.planName }}</span>
            <span v-if="p.status === 'IN_PROGRESS'" class="plan-active-tag">进行中</span>
            <span v-else class="plan-count-tag">{{ p.jobCount || 0 }} 岗位</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 状态 tab（带个数） -->
    <div class="status-tabs">
      <div
        v-for="t in statusTabs"
        :key="t.key"
        class="status-tab"
        :class="{ active: currentStatus === t.key }"
        @click="switchStatus(t.key)"
      >
        {{ t.label }}
        <span class="tab-count">{{ t.key === '' ? planJobs.length : (countByStatus[t.key] || 0) }}</span>
      </div>
    </div>

    <div class="table-meta"><span>共 {{ jobs.length }} 个岗位</span></div>

    <div class="card table-card">
      <table>
        <thead>
          <tr>
            <th class="c-company">公司</th>
            <th class="c-post">岗位</th>
            <th class="c-deadline">截止</th>
            <th class="c-city">地点</th>
            <th class="c-status">当前状态</th>
            <th class="c-expect">预计开始时间</th>
            <th class="c-actions">操作</th>
            <th class="c-grade">届别</th>
            <th class="c-type">类型</th>
            <th class="c-industry">行业</th>
            <th class="c-date">状态变更时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in jobs" :key="r.jobId">
            <td class="c-company fj-company">{{ r.companyName }}</td>
            <td class="c-post fj-post" :title="r.positions">{{ firstOf(r.positions, 2) }}</td>
            <td class="c-deadline fj-deadline" :title="r.deadline">{{ deadlineLabel(r) }}</td>
            <td class="c-city fj-city" :title="r.cities">{{ firstOf(r.cities, 2) }}</td>
            <td class="c-status">
              <span class="tag" :class="'tag-' + (statusColor[r.mainStatus] || 'gray')">{{ statusLabel[r.mainStatus] || r.mainStatus }}</span>
              <div v-if="r.subStatus && r.mainStatus !== 'CLOSED'" class="sub-status">{{ r.subStatus }}</div>
            </td>
            <td class="c-expect">
              <div class="expect-wrap">
                <DatePicker
                  :model-value="r.expectedStartAt ? String(r.expectedStartAt).slice(0, 10) : ''"
                  date-only
                  placeholder="设置"
                  @change="(val) => saveExpected(r, val)"
                />
                <span class="expect-tip" title="设置预计开始时间，会在待办日历中展示，到期自动提醒">ⓘ</span>
              </div>
            </td>
            <td class="c-actions">
              <div class="status-ops">
                <button class="row-btn" :disabled="!r.noticeUrl" @click.stop="emit('openLink', r.noticeUrl)">网申公告</button>
                <button class="row-btn" :disabled="!r.applyUrl" @click.stop="emit('openLink', r.applyUrl)">投递地址</button>
                <button class="row-btn" @click.stop="toggleMenu(r, $event)">流转</button>
                <button class="row-btn fav-btn" @click.stop="unfollow(r)">取消关注</button>
              </div>
            </td>
            <td class="c-grade fj-grade">{{ gradeLabel(r) }}</td>
            <td class="c-type fj-type" :title="r.recruitTypes">{{ firstOf(r.recruitTypes) }}</td>
            <td class="c-industry fj-industry" :title="r.industry">{{ firstOf(r.industry) }}</td>
            <td class="c-date fj-date">{{ r.statusChangedAt ? String(r.statusChangedAt).replace('T', ' ').slice(0, 16) : '—' }}</td>
          </tr>
          <tr v-if="!loading && !jobs.length"><td colspan="11" class="empty">暂无关注的岗位</td></tr>
          <tr v-if="loading"><td colspan="11" class="empty">加载中...</td></tr>
        </tbody>
      </table>
    </div>

    <!-- 流转菜单（fixed 定位） -->
    <div v-if="openMenuId" class="status-menu" :style="{ left: menuPos.x + 'px', top: menuPos.y + 'px' }" @click.stop>
      <template v-if="subMenuStatus">
        <div class="status-menu-item back" @click="subMenuStatus = ''">‹ 返回</div>
        <div
          v-for="s in SUB_STATUS[subMenuStatus]"
          :key="s"
          class="status-menu-item"
          @click="onSubStatusClick(s)"
        >
          {{ s }}
        </div>
      </template>
      <template v-else>
        <div
          v-for="t in statusTabs.slice(1)"
          :key="t.key"
          class="status-menu-item"
          @click="onMainStatusClick(t.key)"
        >
          {{ t.label }}<span v-if="SUB_STATUS[t.key]" class="menu-arrow">›</span>
        </div>
      </template>
    </div>

    <!-- 点击空白关闭流转菜单 -->
    <div v-if="openMenuId" class="status-menu-overlay" @click="openMenuId = null; subMenuStatus = ''"></div>
  </div>
</template>

<style scoped>
.follow-jobs { display: flex; flex-direction: column; gap: 14px; }
.plan-filter { display: flex; align-items: center; gap: 10px; }
.plan-filter-label { font-size: 13px; color: var(--text-sub); }
.plan-select { position: relative; }
.plan-select-current {
  display: inline-flex; align-items: center; gap: 8px;
  height: 34px; padding: 0 14px; border: 1px solid var(--border); border-radius: 10px;
  background: #fff; font-size: 13px; color: var(--text); cursor: pointer;
}
.plan-select-current:hover { border-color: var(--primary); }
.plan-select-arrow { font-size: 12px; color: #96a8bd; }
.plan-select-menu {
  position: absolute; left: 0; top: calc(100% + 6px); z-index: 50;
  background: #fff; border: 1px solid var(--border); border-radius: 10px;
  box-shadow: 0 8px 20px rgba(30, 53, 87, 0.14);
  min-width: 200px; max-height: 300px; overflow-y: auto; padding: 4px;
}
.plan-select-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 9px 12px; border-radius: 6px; font-size: 13px; color: var(--text); cursor: pointer; white-space: nowrap;
}
.plan-select-item:hover { background: #f0f5ff; }
.plan-select-item.on { background: var(--blue-bg); color: var(--primary); font-weight: 600; }
.plan-active-tag { font-size: 11px; padding: 1px 8px; border-radius: 8px; background: var(--blue-bg); color: var(--primary); }
.plan-count-tag { font-size: 11px; color: var(--text-sub); }
.status-tabs { display: flex; gap: 8px; flex-wrap: wrap; }
.status-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 16px;
  background: #fff;
  border: 1px solid var(--border);
  font-size: 13px;
  color: var(--text);
  cursor: pointer;
  white-space: nowrap;
}
.status-tab:hover { border-color: #c2d6ef; }
.status-tab.active { background: var(--primary); border-color: var(--primary); color: #fff; font-weight: 600; }
.tab-count {
  font-size: 11px;
  padding: 0 6px;
  border-radius: 8px;
  background: #eef2f7;
  color: #7186a0;
}
.status-tab.active .tab-count { background: rgba(255, 255, 255, 0.25); color: #fff; }

.table-meta { font-size: 13px; color: #7186a0; padding: 0 4px; }
.table-card { padding: 0; overflow-x: auto; }
table { width: 100%; min-width: 1425px; border-collapse: collapse; table-layout: fixed; }
thead th { background: #f2f6fc; color: var(--navy); font-size: 12px; font-weight: 600; text-align: left; padding: 11px 14px; white-space: nowrap; }
tbody td { padding: 13px 14px; font-size: 13px; color: var(--text); border-bottom: 1px solid #eef2f8; vertical-align: middle; }
tbody tr:last-child td { border-bottom: none; }
tbody tr:hover td { background: #f8fafd; }

.c-company { width: 130px; }
.c-post { width: 150px; }
.c-deadline { width: 90px; }
.c-city { width: 110px; }
.c-status { width: 110px; }
.c-expect { width: 135px; }
.expect-wrap { display: flex; align-items: center; gap: 4px; }
.expect-tip { font-size: 13px; color: #b0c0d6; cursor: help; flex-shrink: 0; }
.expect-tip:hover { color: var(--primary); }
.c-actions { width: 310px; }
.c-grade { width: 85px; }
.c-type { width: 80px; }
.c-industry { width: 100px; }
.c-date { width: 125px; }

.fj-company { color: var(--navy); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fj-post { color: var(--primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fj-deadline { color: #b47a2e; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fj-industry, .fj-city, .fj-type, .fj-grade { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fj-date { color: var(--text-sub); white-space: nowrap; }
.empty { text-align: center; color: var(--text-sub); padding: 30px 0; }
.status-ops { display: flex; gap: 6px; white-space: nowrap; }
.row-btn {
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}
.row-btn:hover { border-color: var(--primary); color: var(--primary); }
.row-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.fav-btn { color: #e6a23c; border-color: #f0d9b0; }
.sub-status { font-size: 11px; color: var(--text-sub); margin-top: 3px; }

.status-menu {
  position: fixed;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 8px 20px rgba(30, 53, 87, 0.14);
  z-index: 9999;
  min-width: 150px;
  max-height: 360px;
  overflow-y: auto;
  padding: 4px;
}
.status-menu-overlay { position: fixed; inset: 0; z-index: 9998; }
.status-menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  font-size: 13px;
  color: var(--text);
  cursor: pointer;
  border-radius: 6px;
  white-space: nowrap;
}
.status-menu-item:hover { background: #f0f5ff; color: var(--primary); }
.status-menu-item.back { color: #96a8bd; }
.menu-arrow { color: #b0c0d6; font-size: 12px; }

.tag { display: inline-block; padding: 3px 10px; border-radius: 6px; font-size: 12px; font-weight: 500; }
.tag-blue { background: var(--blue-bg); color: #4a86e8; }
.tag-purple { background: var(--purple-bg); color: #8b7cf6; }
.tag-green { background: var(--green-bg); color: #35b779; }
.tag-orange { background: var(--orange-bg); color: #f5a623; }
.tag-cyan { background: #e7f8f7; color: #17a2a6; }
.tag-gray { background: #eef2f7; color: #8a9bb0; }
</style>
