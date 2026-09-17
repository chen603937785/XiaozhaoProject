<script setup>
import { ref, computed, onMounted } from 'vue';
import { getJobStatusOverview, getPlans, getTodos, getUserInfo } from '../api';
import TodoCard from './TodoCard.vue';

const emit = defineEmits(['selectStage', 'gotoPlan', 'todoChanged', 'requireLogin']);

function getGreeting() {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 9) return '早上好';
  if (h < 12) return '上午好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}
const greeting = getGreeting();

// ===== 欢迎语真实数据 =====
const userName = ref('');
const todos = ref([]);
const todayKey = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');
const todayTodos = computed(() =>
  todos.value.filter(t => t.status !== 'COMPLETED' && t.dueAt && String(t.dueAt).slice(0, 10) === todayKey)
);
const priorityTodos = computed(() =>
  todayTodos.value.filter(t => t.priority === 'URGENT' || t.priority === 'IMPORTANT')
);

async function loadUserInfo() {
  try {
    const info = await getUserInfo();
    if (info) userName.value = info.nickname || (info.phone ? '用户' + String(info.phone).slice(-4) : '同学');
  } catch (e) {}
}

async function loadTodos() {
  try {
    todos.value = await getTodos();
  } catch (e) { todos.value = []; }
}

function onTodoChanged() {
  loadTodos();
  emit('todoChanged');
}

const planPercent = computed(() => currentPlan.value?.completion ?? 0);

const planGoals = computed(() => {
  const p = currentPlan.value;
  if (!p) return [];
  return [
    { name: '岗位投递', icon: '📤', done: p.appliedCount || 0, total: p.targetApplyCount || 0, color: '#8b7cf6', bg: '#f0edff' },
    { name: '面试', icon: '📝', done: p.interviewCount || 0, total: p.targetInterviewCount || 0, color: '#35b779', bg: '#ecf8f2' },
    { name: 'Offer', icon: '🎯', done: p.offerCount || 0, total: p.targetOfferCount || 0, color: '#4b87e5', bg: '#eaf2ff' }
  ];
});

const planRange = computed(() => {
  const p = currentPlan.value;
  if (!p) return '未设置周期';
  const s = p.startDate ? String(p.startDate).slice(0, 10) : '';
  const e = p.endDate ? String(p.endDate).slice(0, 10) : '';
  if (!s && !e) return '未设置周期';
  return (s || '—') + ' — ' + (e || '—');
});

function goalPercent(g) {
  if (!g.total) return 0;
  return Math.min(100, Math.round(g.done / g.total * 100));
}

// ===== 求职进度总览（真实数据） =====
const loading = ref(false);
const error = ref(false);
const overview = ref(null);

// ===== 求职计划切换 =====
const plans = ref([]);
const currentPlanId = ref(null);
const showPlanMenu = ref(false);
const currentPlan = computed(() => plans.value.find(p => p.id === currentPlanId.value));
const hasActivePlan = computed(() => plans.value.some(p => p.status === 'IN_PROGRESS'));

const targetText = computed(() => {
  const p = currentPlan.value;
  if (!p) return '';
  const parts = [];
  if (p.targetPositions) parts.push('目标方向：' + p.targetPositions);
  if (p.targetCities) parts.push('目标城市：' + p.targetCities);
  return parts.join('｜');
});

async function loadPlans() {
  try {
    plans.value = await getPlans();
    if (currentPlanId.value == null || !plans.value.find(p => p.id === currentPlanId.value)) {
      const active = plans.value.find(p => p.status === 'IN_PROGRESS');
      currentPlanId.value = active ? active.id : (plans.value[0]?.id ?? null);
    }
  } catch (e) { plans.value = []; }
}

function switchPlan(id) {
  currentPlanId.value = id;
  showPlanMenu.value = false;
  loadOverview();
}

const stageColors = {
  'TO_EVALUATE': { color: '#7a90a8', bg: '#e7eef8' },
  'PREPARING': { color: '#8b7cf6', bg: '#f0edff' },
  'APPLIED': { color: '#4b87e5', bg: '#eaf2ff' },
  'ASSESSMENT': { color: '#f5a623', bg: '#fff3e5' },
  'INTERVIEW': { color: '#17a2a6', bg: '#eaf8fa' },
  'OFFER': { color: '#35b779', bg: '#ecf8f2' }
};

const stages = computed(() => {
  if (!overview.value) return [];
  return overview.value.stages.map(s => ({
    status: s.status,
    name: s.label,
    count: s.count,
    change: s.this_week_added,
    color: stageColors[s.status]?.color || '#7a90a8',
    bg: stageColors[s.status]?.bg || '#e7eef8'
  }));
});

const conversions = computed(() => {
  if (!overview.value) return [];
  const c = overview.value.conversion;
  return [
    { label: '投递→笔试', value: c.applied_to_assessment == null ? '暂无' : c.applied_to_assessment + '%' },
    { label: '笔试→面试', value: c.assessment_to_interview == null ? '暂无' : c.assessment_to_interview + '%' },
    { label: '面试→Offer', value: c.interview_to_offer == null ? '暂无' : c.interview_to_offer + '%' }
  ];
});

const closed = computed(() => overview.value?.closed || {});

async function loadOverview() {
  loading.value = true;
  error.value = false;
  try {
    overview.value = await getJobStatusOverview(currentPlanId.value || undefined);
  } catch (e) {
    error.value = true;
  } finally {
    loading.value = false;
  }
}

function selectStage(status) {
  emit('selectStage', status);
}

onMounted(async () => {
  await loadPlans();
  loadOverview();
  loadUserInfo();
  loadTodos();
});
</script>

<template>
  <div class="workbench">
    <!-- 顶部欢迎横幅 -->
    <div class="wb-banner">
      <div class="wb-banner-left">
        <div class="wb-banner-label"><span class="wb-dot"></span>工作台</div>
        <div class="wb-greeting">{{ greeting }}，{{ userName || '同学' }}</div>
        <div class="wb-overview">今天有 {{ todayTodos.length }} 项待办，其中 {{ priorityTodos.length }} 项需要优先处理</div>
        <div class="wb-target">{{ targetText }}</div>
      </div>
      <div class="wb-banner-right">
        <div class="wb-illustration">
          <span class="ill">📄</span><span class="ill">📅</span><span class="ill">🎯</span>
        </div>
        <button class="wb-plan-btn" @click="emit('gotoPlan')">{{ hasActivePlan ? '查看求职计划' : '＋ 新建求职计划' }}</button>
      </div>
      <div class="wb-glow"></div>
    </div>

    <!-- 双栏：今日待办 + 求职进度总览 -->
    <div class="wb-two-col">
      <!-- 今日待办（真实数据） -->
      <div class="wb-todo">
        <TodoCard :plan-id="currentPlanId" @changed="onTodoChanged" @require-login="emit('requireLogin')" />
      </div>

      <!-- 求职进度总览（真实数据） -->
      <div class="wb-card wb-progress">
        <div class="wb-card-head">
          <div class="wb-head-left">
            <span class="wb-card-title">求职进度总览</span>
            <div class="wb-card-sub">展示当前求职周期内各阶段的岗位数量</div>
          </div>
          <div class="wb-period-wrap">
            <div class="wb-period" @click="showPlanMenu = !showPlanMenu">
              当前计划：{{ currentPlan?.planName || '未选择' }} ▾
            </div>
            <div v-if="showPlanMenu" class="plan-menu" @click.stop>
              <div
                v-for="p in plans"
                :key="p.id"
                class="plan-menu-item"
                :class="{ on: p.id === currentPlanId }"
                @click="switchPlan(p.id)"
              >
                <span>{{ p.planName }}</span>
                <span class="plan-menu-meta">{{ p.status === 'IN_PROGRESS' ? '进行中' : ((p.jobCount || 0) + ' 岗位') }}</span>
              </div>
              <div v-if="!plans.length" class="plan-menu-empty">暂无计划，请先创建</div>
            </div>
            <div v-if="showPlanMenu" class="plan-menu-overlay" @click="showPlanMenu = false"></div>
          </div>
        </div>

        <!-- 加载中 -->
        <div v-if="loading" class="overview-skeleton">
          <div class="skeleton-bar" v-for="i in 4" :key="i"></div>
        </div>

        <!-- 加载失败 -->
        <div v-else-if="error" class="overview-empty">
          <div>求职进度暂时无法加载</div>
          <div class="overview-retry" @click="loadOverview">重新加载</div>
        </div>

        <!-- 空状态 -->
        <div v-else-if="overview && overview.total === 0" class="overview-empty">
          <div>还没有正在跟进的岗位</div>
          <div>前往岗位库添加你的第一个岗位</div>
        </div>

        <!-- 正常数据 -->
        <template v-else-if="stages.length">
          <div class="stage-flow">
            <template v-for="(s, i) in stages" :key="s.status">
              <div class="stage-node" @click="selectStage(s.status)">
                <div class="stage-icon" :style="{ background: s.bg, color: s.color }">●</div>
                <div class="stage-count">{{ s.count }}</div>
                <div class="stage-name">{{ s.name }}</div>
                <div class="stage-change" v-if="s.change > 0">本周 +{{ s.change }}</div>
              </div>
              <div v-if="i < stages.length - 1" class="stage-arrow">›</div>
            </template>
          </div>

          <div class="conversion">
            <div v-for="c in conversions" :key="c.label" class="conv-item">
              <div class="conv-label">{{ c.label }}</div>
              <div class="conv-value">{{ c.value }}</div>
            </div>
          </div>

          <div class="closed-bar" v-if="closed.total > 0">
            已结束 {{ closed.total }} 个 · 未通过 {{ closed.rejected }} · 主动放弃 {{ closed.withdrawn }} · 岗位过期 {{ closed.expired }}
          </div>
        </template>
      </div>
    </div>

    <!-- 求职计划进度 -->
    <div class="wb-card wb-plan">
      <div class="wb-plan-head">
        <div class="wb-head-left">
          <span class="wb-card-title">求职计划进度</span>
          <div class="wb-card-sub">{{ currentPlan?.planName || '未选择计划' }}</div>
        </div>
        <div class="wb-plan-mid">{{ planRange }}</div>
        <div class="wb-plan-right">
          <span class="wb-view" @click="emit('gotoPlan')">查看计划 ›</span>
        </div>
      </div>

      <div class="wb-overall">
        <div class="wb-overall-label">总体完成度</div>
        <div class="wb-overall-percent">{{ planPercent }}%</div>
      </div>
      <div class="wb-big-bar"><div class="wb-big-fill" :style="{ width: planPercent + '%' }"></div></div>
      <div class="wb-plan-status">已投递 {{ currentPlan?.appliedCount || 0 }} / 目标 {{ currentPlan?.targetApplyCount || 0 }} 个</div>

      <div class="goal-grid">
        <div v-for="g in planGoals" :key="g.name" class="goal-card">
          <div class="goal-icon" :style="{ background: g.bg, color: g.color }">{{ g.icon }}</div>
          <div class="goal-body">
            <div class="goal-name">{{ g.name }}</div>
            <div class="goal-count">{{ g.done }}/{{ g.total }}</div>
            <div class="goal-bar"><div class="goal-fill" :style="{ width: goalPercent(g) + '%', background: g.color }"></div></div>
            <div class="goal-tip">{{ g.total ? (g.done >= g.total ? '已达成' : '继续加油') : '未设目标' }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.workbench { display: flex; flex-direction: column; gap: 20px; }

.wb-banner {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(120deg, #ffffff, #eef5ff);
  border-radius: 20px;
  padding: 32px 40px;
  min-height: 170px;
  overflow: hidden;
}
.wb-banner-left { display: flex; flex-direction: column; gap: 10px; }
.wb-banner-label { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #4b87e5; }
.wb-dot { width: 8px; height: 8px; border-radius: 50%; background: #4b87e5; }
.wb-greeting { font-size: 32px; font-weight: 700; color: #17304f; }
.wb-overview { font-size: 14px; color: #617895; }
.wb-target { font-size: 13px; color: #96a8bd; }
.wb-banner-right { display: flex; flex-direction: column; align-items: flex-end; gap: 16px; }
.wb-illustration { display: flex; gap: 12px; opacity: 0.5; }
.ill { font-size: 34px; }
.wb-plan-btn {
  padding: 10px 22px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #3f82e8, #63aef3);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.wb-glow { position: absolute; right: -40px; top: -40px; width: 180px; height: 180px; border-radius: 50%; background: radial-gradient(circle, rgba(99, 174, 243, 0.18), transparent 70%); }

.wb-card { background: #ffffff; border-radius: 16px; padding: 22px 24px; }
.wb-card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.wb-head-left { display: flex; align-items: baseline; gap: 10px; }
.wb-card-title { font-size: 18px; font-weight: 700; color: #17304f; }
.wb-card-sub { font-size: 12px; color: #96a8bd; }
.wb-count { font-size: 13px; color: #96a8bd; }

.wb-two-col { display: flex; gap: 20px; }
.wb-todo { flex: 5; min-width: 0; }
.wb-progress { flex: 7; min-width: 0; }

.wb-head-right { font-size: 13px; color: #617895; }
.wb-period { padding: 6px 14px; border: 1px solid #dce7f4; border-radius: 8px; background: #fbfdff; font-size: 13px; color: #617895; cursor: pointer; }
.wb-period-wrap { position: relative; }
.plan-menu {
  position: absolute; right: 0; top: calc(100% + 6px);
  background: #fff; border: 1px solid #dce7f4; border-radius: 10px;
  box-shadow: 0 8px 20px rgba(30, 53, 87, 0.14);
  min-width: 220px; max-height: 300px; overflow-y: auto; padding: 4px; z-index: 50;
}
.plan-menu-item { display: flex; justify-content: space-between; align-items: center; padding: 9px 12px; border-radius: 6px; cursor: pointer; font-size: 13px; color: #17304f; white-space: nowrap; }
.plan-menu-item:hover { background: #f0f5ff; }
.plan-menu-item.on { background: #eaf2ff; color: #4b87e5; font-weight: 600; }
.plan-menu-meta { font-size: 11px; color: #96a8bd; margin-left: 12px; }
.plan-menu-empty { padding: 12px; text-align: center; color: #96a8bd; font-size: 12px; }
.plan-menu-overlay { position: fixed; inset: 0; z-index: 40; }
.stage-flow { display: flex; align-items: flex-start; margin: 20px 0 24px; }
.stage-node { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; cursor: pointer; }
.stage-icon { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 16px; }
.stage-count { font-size: 22px; font-weight: 700; color: #17304f; }
.stage-name { font-size: 12px; color: #617895; white-space: nowrap; }
.stage-change { font-size: 11px; color: #96a8bd; }
.stage-arrow { font-size: 16px; color: #c8d5e3; margin-top: 14px; }
.conversion { display: flex; border-top: 1px solid #eef3f8; padding-top: 16px; }
.conv-item { flex: 1; text-align: center; }
.conv-label { font-size: 12px; color: #96a8bd; }
.conv-value { font-size: 18px; font-weight: 700; color: #4b87e5; margin-top: 4px; }
.closed-bar { margin-top: 14px; padding: 10px 14px; background: #f4f7fb; border-radius: 8px; font-size: 12px; color: #96a8bd; }

.overview-skeleton { display: flex; flex-direction: column; gap: 14px; padding: 30px 0; }
.skeleton-bar { height: 20px; background: #eef3f8; border-radius: 6px; }
.overview-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px 0; color: #96a8bd; font-size: 14px; }
.overview-retry { color: #4b87e5; cursor: pointer; margin-top: 8px; }

.wb-plan-head { display: flex; align-items: center; gap: 20px; margin-bottom: 16px; }
.wb-plan-mid { font-size: 13px; color: #617895; }
.wb-plan-right { margin-left: auto; display: flex; align-items: center; gap: 14px; }
.wb-remain { padding: 4px 12px; background: #fff3e5; color: #f5a623; border-radius: 12px; font-size: 12px; }
.wb-view { font-size: 13px; color: #4b87e5; cursor: pointer; }
.wb-overall { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 8px; }
.wb-overall-label { font-size: 13px; color: #617895; }
.wb-overall-percent { font-size: 24px; font-weight: 700; color: #4b87e5; }
.wb-big-bar { height: 10px; background: #eaf2ff; border-radius: 5px; margin-bottom: 8px; }
.wb-big-fill { height: 100%; background: linear-gradient(90deg, #3f82e8, #63aef3); border-radius: 5px; }
.wb-plan-status { font-size: 12px; color: #96a8bd; margin-bottom: 18px; }
.goal-grid { display: flex; gap: 16px; }
.goal-card { flex: 1; display: flex; gap: 12px; padding: 14px 16px; background: #fbfdff; border: 1px solid #eaf2ff; border-radius: 14px; }
.goal-icon { width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
.goal-body { flex: 1; }
.goal-name { font-size: 13px; color: #17304f; font-weight: 600; }
.goal-count { font-size: 12px; color: #96a8bd; margin-top: 3px; }
.goal-bar { height: 5px; background: #eaf2ff; border-radius: 3px; margin-top: 8px; }
.goal-fill { height: 100%; border-radius: 3px; }
.goal-tip { font-size: 11px; color: #96a8bd; margin-top: 6px; }
</style>
