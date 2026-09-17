<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import {
  getPlans, createPlan, updatePlan, setPlanActive, pausePlan,
  completePlan, archivePlan, restorePlan, deletePlan, getToken
} from '../api';
import DatePicker from './DatePicker.vue';

const emit = defineEmits(['changed', 'requireLogin']);
const props = defineProps({ autoCreate: { type: Boolean, default: false } });

const plans = ref([]);
const loading = ref(false);
const showDialog = ref(false);
const editingId = ref(null);
const saving = ref(false);

const STATUS = {
  DRAFT: { label: '草稿', color: 'gray' },
  IN_PROGRESS: { label: '进行中', color: 'blue' },
  PAUSED: { label: '已暂停', color: 'orange' },
  COMPLETED: { label: '已完成', color: 'green' },
  ARCHIVED: { label: '已归档', color: 'gray' }
};

function emptyForm() {
  return {
    planName: '',
    recruitmentStage: '',
    startDate: '',
    endDate: '',
    targetPositions: '',
    targetCities: '',
    targetApplyCount: 30,
    targetInterviewCount: 5,
    targetOfferCount: 1
  };
}
const form = ref(emptyForm());

const activePlan = computed(() => plans.value.find(p => p.status === 'IN_PROGRESS'));

async function load() {
  loading.value = true;
  try {
    plans.value = await getPlans();
  } catch (e) {
    plans.value = [];
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editingId.value = null;
  form.value = emptyForm();
  showDialog.value = true;
}

function openEdit(p) {
  editingId.value = p.id;
  form.value = {
    planName: p.planName || '',
    recruitmentStage: p.recruitmentStage || '',
    startDate: p.startDate || '',
    endDate: p.endDate || '',
    targetPositions: p.targetPositions || '',
    targetCities: p.targetCities || '',
    targetApplyCount: p.targetApplyCount ?? 30,
    targetInterviewCount: p.targetInterviewCount ?? 5,
    targetOfferCount: p.targetOfferCount ?? 1
  };
  showDialog.value = true;
}

async function save(asActive) {
  if (!form.value.planName.trim()) return;
  if (!getToken()) { emit('requireLogin'); return; }
  saving.value = true;
  try {
    const payload = { ...form.value, planName: form.value.planName.trim() };
    if (asActive) payload.status = 'IN_PROGRESS';
    if (editingId.value) {
      await updatePlan(editingId.value, payload);
      if (asActive) await setPlanActive(editingId.value);
    } else {
      await createPlan(payload);
    }
    showDialog.value = false;
    await load();
    emit('changed');
  } catch (e) {} finally {
    saving.value = false;
  }
}

async function run(fn, p) {
  await fn(p.id);
  await load();
  emit('changed');
}

function firstOf(str) {
  if (!str) return '';
  return str.split(',').map(s => s.trim()).filter(Boolean).slice(0, 3).join(' · ');
}

function fmtDate(d) {
  if (!d) return '';
  return String(d).slice(0, 10);
}

function range(p) {
  if (!p.startDate && !p.endDate) return '未设置周期';
  return `${fmtDate(p.startDate) || '—'} 至 ${fmtDate(p.endDate) || '—'}`;
}

onMounted(load);

watch(() => props.autoCreate, (v) => {
  if (v && !plans.value.length) openCreate();
});
</script>

<template>
  <div class="plan-manage">
    <div class="pm-head">
      <div>
        <div class="pm-title">求职计划管理</div>
        <div class="pm-sub">同一时间只有一个计划处于「进行中」，关注的岗位会归入对应计划</div>
      </div>
      <button class="pm-add-btn" @click="openCreate">＋ 新建求职计划</button>
    </div>

    <div v-if="loading" class="pm-empty">加载中...</div>
    <div v-else-if="!plans.length" class="pm-empty">
      <div>还没有求职计划</div>
      <div class="pm-empty-sub">创建一个计划，开始规划你的求职目标</div>
      <button class="pm-add-btn" @click="openCreate">＋ 新建求职计划</button>
    </div>

    <div v-else class="plan-grid">
      <div v-for="p in plans" :key="p.id" class="plan-card" :class="{ active: p.status === 'IN_PROGRESS' }">
        <div class="pc-top">
          <span class="pc-name">{{ p.planName }}</span>
          <span class="pc-status" :class="'st-' + (STATUS[p.status]?.color || 'gray')">{{ STATUS[p.status]?.label || p.status }}</span>
        </div>
        <div class="pc-stage">{{ p.recruitmentStage || '未设置阶段' }}</div>
        <div class="pc-meta">
          <div class="pc-row"><span class="pc-label">周期</span><span>{{ range(p) }}</span></div>
          <div class="pc-row"><span class="pc-label">目标岗位</span><span :title="p.targetPositions">{{ firstOf(p.targetPositions) || '—' }}</span></div>
          <div class="pc-row"><span class="pc-label">目标城市</span><span :title="p.targetCities">{{ firstOf(p.targetCities) || '—' }}</span></div>
        </div>

        <div class="pc-stats">
          <div class="stat"><div class="stat-num">{{ p.jobCount || 0 }}</div><div class="stat-label">关注</div></div>
          <div class="stat"><div class="stat-num">{{ p.appliedCount || 0 }}/{{ p.targetApplyCount || 0 }}</div><div class="stat-label">投递</div></div>
          <div class="stat"><div class="stat-num">{{ p.interviewCount || 0 }}/{{ p.targetInterviewCount || 0 }}</div><div class="stat-label">面试</div></div>
          <div class="stat"><div class="stat-num">{{ p.offerCount || 0 }}/{{ p.targetOfferCount || 0 }}</div><div class="stat-label">Offer</div></div>
        </div>

        <div class="pc-progress">
          <div class="pc-progress-bar"><div class="pc-progress-fill" :style="{ width: (p.completion || 0) + '%' }"></div></div>
          <span class="pc-progress-txt">完成度 {{ p.completion || 0 }}%</span>
        </div>

        <div class="pc-actions">
          <template v-if="p.status === 'IN_PROGRESS'">
            <button class="pc-btn" @click="run(pausePlan, p)">暂停</button>
            <button class="pc-btn" @click="run(completePlan, p)">完成</button>
          </template>
          <template v-else-if="p.status === 'DRAFT'">
            <button class="pc-btn primary" @click="run(setPlanActive, p)">设为进行中</button>
            <button class="pc-btn" @click="openEdit(p)">编辑</button>
            <button class="pc-btn danger" @click="run(deletePlan, p)">删除</button>
          </template>
          <template v-else-if="p.status === 'PAUSED'">
            <button class="pc-btn primary" @click="run(setPlanActive, p)">设为进行中</button>
            <button class="pc-btn" @click="openEdit(p)">编辑</button>
            <button class="pc-btn" @click="run(completePlan, p)">完成</button>
            <button class="pc-btn" @click="run(archivePlan, p)">归档</button>
          </template>
          <template v-else-if="p.status === 'COMPLETED'">
            <button class="pc-btn" @click="run(restorePlan, p)">恢复</button>
            <button class="pc-btn" @click="run(archivePlan, p)">归档</button>
          </template>
          <template v-else-if="p.status === 'ARCHIVED'">
            <button class="pc-btn" @click="run(restorePlan, p)">恢复</button>
            <button class="pc-btn danger" @click="run(deletePlan, p)">删除</button>
          </template>
        </div>
      </div>
    </div>

    <!-- 新建/编辑弹窗 -->
    <div v-if="showDialog" class="pm-mask">
      <div class="pm-dialog">
        <div class="pm-dialog-title">{{ editingId ? '编辑求职计划' : '新建求职计划' }}</div>
        <div class="pm-form">
          <label class="pm-field">
            <span class="pm-field-label">计划名称 <i>*</i></span>
            <input v-model="form.planName" placeholder="如：2026 秋招求职计划" />
          </label>
          <label class="pm-field">
            <span class="pm-field-label">招聘阶段</span>
            <input v-model="form.recruitmentStage" placeholder="如：2026 秋招" />
          </label>
          <div class="pm-field-row">
            <label class="pm-field">
              <span class="pm-field-label">开始日期</span>
              <DatePicker v-model="form.startDate" date-only placeholder="选择开始日期" />
            </label>
            <label class="pm-field">
              <span class="pm-field-label">结束日期</span>
              <DatePicker v-model="form.endDate" date-only placeholder="选择结束日期" />
            </label>
          </div>
          <label class="pm-field">
            <span class="pm-field-label">目标岗位</span>
            <input v-model="form.targetPositions" placeholder="如：产品经理, 前端开发（逗号分隔）" />
          </label>
          <label class="pm-field">
            <span class="pm-field-label">目标城市</span>
            <input v-model="form.targetCities" placeholder="如：上海, 杭州（逗号分隔）" />
          </label>
          <div class="pm-field-row">
            <label class="pm-field">
              <span class="pm-field-label">目标投递数</span>
              <input type="number" v-model.number="form.targetApplyCount" />
            </label>
            <label class="pm-field">
              <span class="pm-field-label">目标面试数</span>
              <input type="number" v-model.number="form.targetInterviewCount" />
            </label>
            <label class="pm-field">
              <span class="pm-field-label">目标 Offer 数</span>
              <input type="number" v-model.number="form.targetOfferCount" />
            </label>
          </div>
        </div>
        <div class="pm-dialog-actions">
          <button class="pc-btn" @click="showDialog = false">取消</button>
          <button class="pc-btn" :disabled="saving || !form.planName.trim()" @click="save(false)">保存草稿</button>
          <button class="pc-btn primary" :disabled="saving || !form.planName.trim()" @click="save(true)">保存并设为进行中</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.plan-manage { display: flex; flex-direction: column; gap: 16px; }
.pm-head { display: flex; align-items: center; justify-content: space-between; }
.pm-title { font-size: 20px; font-weight: 700; color: var(--navy); }
.pm-sub { font-size: 13px; color: var(--text-sub); margin-top: 4px; }
.pm-add-btn {
  height: 38px; padding: 0 20px; border: none; border-radius: 12px;
  background: var(--primary); color: #fff; font-size: 14px; font-weight: 600; cursor: pointer;
}
.pm-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 60px 0; color: var(--text-sub); font-size: 14px; }
.pm-empty-sub { font-size: 13px; color: #96a8bd; }

.plan-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
.plan-card {
  background: #fff; border: 1px solid var(--border); border-radius: 14px; padding: 18px 20px;
  display: flex; flex-direction: column; gap: 12px;
}
.plan-card.active { border: 2px solid var(--primary); box-shadow: 0 4px 16px rgba(74, 134, 232, 0.14); }
.pc-top { display: flex; align-items: center; justify-content: space-between; }
.pc-name { font-size: 16px; font-weight: 700; color: var(--navy); }
.pc-stage { font-size: 12px; color: var(--text-sub); }
.pc-status { font-size: 11px; padding: 3px 10px; border-radius: 10px; font-weight: 600; }
.st-blue { background: var(--blue-bg); color: var(--primary); }
.st-green { background: var(--green-bg); color: #35b779; }
.st-orange { background: var(--orange-bg); color: #f5a623; }
.st-gray { background: #eef2f7; color: #8a9bb0; }

.pc-meta { display: flex; flex-direction: column; gap: 6px; }
.pc-row { display: flex; gap: 8px; font-size: 13px; color: var(--text); }
.pc-label { width: 56px; flex-shrink: 0; color: var(--text-sub); }

.pc-stats { display: flex; gap: 8px; }
.stat { flex: 1; text-align: center; padding: 8px 4px; background: #f7fafd; border-radius: 8px; }
.stat-num { font-size: 14px; font-weight: 700; color: var(--navy); }
.stat-label { font-size: 11px; color: var(--text-sub); margin-top: 2px; }

.pc-progress { display: flex; align-items: center; gap: 10px; }
.pc-progress-bar { flex: 1; height: 6px; background: #eaf2ff; border-radius: 3px; overflow: hidden; }
.pc-progress-fill { height: 100%; background: linear-gradient(90deg, #3f82e8, #63aef3); border-radius: 3px; }
.pc-progress-txt { font-size: 11px; color: var(--text-sub); white-space: nowrap; }

.pc-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.pc-btn {
  height: 28px; padding: 0 12px; border: 1px solid var(--border); border-radius: 8px;
  background: #fff; color: var(--text); font-size: 12px; cursor: pointer;
}
.pc-btn:hover { border-color: var(--primary); color: var(--primary); }
.pc-btn.primary { background: var(--primary); border-color: var(--primary); color: #fff; }
.pc-btn.danger { color: #e35d5d; border-color: #f3c9c9; }
.pc-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.pm-mask { position: fixed; inset: 0; background: rgba(20, 40, 70, 0.4); display: flex; align-items: center; justify-content: center; z-index: 9998; }
.pm-dialog { width: 520px; max-width: 92vw; background: #fff; border-radius: 16px; padding: 24px; }
.pm-dialog-title { font-size: 18px; font-weight: 700; color: var(--navy); margin-bottom: 18px; }
.pm-form { display: flex; flex-direction: column; gap: 14px; }
.pm-field { display: flex; flex-direction: column; gap: 6px; }
.pm-field-row { display: flex; gap: 12px; }
.pm-field-row .pm-field { flex: 1; min-width: 0; }
.pm-field-label { font-size: 13px; color: var(--text); }
.pm-field-label i { color: #e35d5d; font-style: normal; }
.pm-field input {
  width: 100%; box-sizing: border-box;
  height: 38px; border: 1px solid var(--border); border-radius: 10px; padding: 0 12px;
  font-size: 14px; color: var(--text); outline: none;
}
.pm-field input:focus { border-color: var(--primary); }
.pm-dialog-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
</style>
