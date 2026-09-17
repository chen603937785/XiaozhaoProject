<script setup>
import { ref, computed, onMounted } from 'vue';
import { getTodos, createTodo, updateTodo, deleteTodo, getPlans, getToken } from '../api';
import DatePicker from './DatePicker.vue';
import SelectPicker from './SelectPicker.vue';

const emit = defineEmits(['changed', 'requireLogin']);

const TYPE = {
  APPLICATION: { label: '投递', short: '投', color: '#4b87e5', bg: '#eaf2ff' },
  MATERIAL: { label: '材料', short: '材', color: '#8b7cf6', bg: '#f0edff' },
  ASSESSMENT: { label: '笔试', short: '笔', color: '#f5a623', bg: '#fff3e5' },
  INTERVIEW: { label: '面试', short: '面', color: '#17a2a6', bg: '#eaf8fa' },
  FOLLOW_UP: { label: '跟进', short: '跟', color: '#35b779', bg: '#ecf8f2' },
  CUSTOM: { label: '自定义', short: '自', color: '#7a90a8', bg: '#e7eef8' }
};

const PRIORITY = {
  URGENT: { label: '紧急', cls: 'urgent' },
  IMPORTANT: { label: '重要', cls: 'important' },
  NORMAL: { label: '普通', cls: 'normal' }
};

const typeOptions = Object.entries(TYPE).map(([v, o]) => ({ value: v, label: o.label }));
const priorityOptions = [
  { value: 'URGENT', label: '紧急' },
  { value: 'IMPORTANT', label: '重要' },
  { value: 'NORMAL', label: '普通' }
];

const WEEK_HEAD = ['一', '二', '三', '四', '五', '六', '日'];

const plans = ref([]);
const currentPlanId = ref(null);
const todos = ref([]);
const loading = ref(false);

const viewMode = ref('month');
const viewDate = ref(new Date());

const filterType = ref('');
const filterStatus = ref('');

const showAdd = ref(false);
const showDetail = ref(false);
const editingId = ref(null);
const detailTodo = ref(null);
const saving = ref(false);
const form = ref({});

const currentPlan = computed(() => plans.value.find(p => p.id === currentPlanId.value));

function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isOverdue(t) {
  if (t.status === 'COMPLETED') return false;
  if (!t.dueAt) return false;
  return new Date(String(t.dueAt).replace(' ', 'T')) < new Date();
}

const filteredTodos = computed(() => {
  return todos.value.filter(t => {
    if (filterType.value && t.todoType !== filterType.value) return false;
    if (filterStatus.value === 'COMPLETED' && t.status !== 'COMPLETED') return false;
    if (filterStatus.value === 'PENDING' && t.status === 'COMPLETED') return false;
    if (filterStatus.value === 'OVERDUE' && !isOverdue(t)) return false;
    return true;
  });
});

const todosByDate = computed(() => {
  const map = {};
  for (const t of filteredTodos.value) {
    if (!t.dueAt) continue;
    const key = String(t.dueAt).slice(0, 10);
    if (!map[key]) map[key] = [];
    map[key].push(t);
  }
  return map;
});

// ===== 月视图 42 格 =====
const calendarDays = computed(() => {
  const year = viewDate.value.getFullYear();
  const month = viewDate.value.getMonth();
  const firstDay = new Date(year, month, 1);
  const offset = (firstDay.getDay() + 6) % 7; // 周一=0
  const start = new Date(year, month, 1 - offset);
  const cells = [];
  for (let i = 0; i < 42; i++) {
    cells.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }
  return cells;
});

const weekDays = computed(() => {
  const d = viewDate.value;
  const offset = (d.getDay() + 6) % 7;
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset);
  const days = [];
  for (let i = 0; i < 7; i++) {
    days.push(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
  }
  return days;
});

const monthLabel = computed(() => {
  return viewDate.value.getFullYear() + ' 年 ' + (viewDate.value.getMonth() + 1) + ' 月';
});

const weekLabel = computed(() => {
  const start = weekDays.value[0];
  const end = weekDays.value[6];
  return `${start.getMonth() + 1} 月 ${start.getDate()} 日 – ${end.getMonth() + 1} 月 ${end.getDate()} 日`;
});

const dayLabel = computed(() => {
  const d = viewDate.value;
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
});

const monthStats = computed(() => {
  const total = todos.value.length;
  const done = todos.value.filter(t => t.status === 'COMPLETED').length;
  return { total, done, pending: total - done };
});

async function load() {
  loading.value = true;
  try {
    plans.value = await getPlans();
    if (currentPlanId.value == null || !plans.value.find(p => p.id === currentPlanId.value)) {
      const active = plans.value.find(p => p.status === 'IN_PROGRESS');
      currentPlanId.value = active ? active.id : null;
    }
    todos.value = await getTodos(currentPlanId.value || undefined);
  } catch (e) {
    todos.value = [];
  } finally {
    loading.value = false;
  }
}

function switchPlan(id) {
  currentPlanId.value = id;
  load();
}

function prev() {
  if (viewMode.value === 'month') viewDate.value = new Date(viewDate.value.getFullYear(), viewDate.value.getMonth() - 1, 1);
  else if (viewMode.value === 'week') viewDate.value = new Date(viewDate.value.getFullYear(), viewDate.value.getMonth(), viewDate.value.getDate() - 7);
  else viewDate.value = new Date(viewDate.value.getFullYear(), viewDate.value.getMonth(), viewDate.value.getDate() - 1);
}

function next() {
  if (viewMode.value === 'month') viewDate.value = new Date(viewDate.value.getFullYear(), viewDate.value.getMonth() + 1, 1);
  else if (viewMode.value === 'week') viewDate.value = new Date(viewDate.value.getFullYear(), viewDate.value.getMonth(), viewDate.value.getDate() + 7);
  else viewDate.value = new Date(viewDate.value.getFullYear(), viewDate.value.getMonth(), viewDate.value.getDate() + 1);
}

function today() {
  viewDate.value = new Date();
}

function isToday(d) {
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function isOtherMonth(d) {
  return d.getMonth() !== viewDate.value.getMonth();
}

function fmtTime(t) {
  if (!t.dueAt) return '';
  const d = new Date(String(t.dueAt).replace(' ', 'T'));
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function todosForDay(d) {
  return todosByDate.value[dateKey(d)] || [];
}

function shortTitle(t) {
  const title = t.title || '';
  const m = title.match(/「(.+?)」/);
  if (m) return m[1].slice(0, 4);
  return title.slice(0, 6);
}

// ===== 日期格 hover 弹窗 =====
const hoverDay = ref(null);
const hoverPos = ref({ x: 0, y: 0 });

const hoverTodos = computed(() => {
  if (!hoverDay.value) return [];
  const list = todosByDate.value[hoverDay.value] || [];
  return [...list].sort((a, b) => {
    const ta = a.dueAt ? String(a.dueAt) : '9999';
    const tb = b.dueAt ? String(b.dueAt) : '9999';
    return ta.localeCompare(tb);
  });
});

function showHover(d, event) {
  cancelHide();
  const rect = event.currentTarget.getBoundingClientRect();
  let x = rect.right + 8;
  let y = rect.top;
  if (x + 250 > window.innerWidth) x = rect.left - 258;
  if (y + 220 > window.innerHeight) y = window.innerHeight - 228;
  if (y < 4) y = 4;
  hoverDay.value = dateKey(d);
  hoverPos.value = { x, y };
}

let hoverTimer = null;
function scheduleHide() {
  hoverTimer = setTimeout(() => { hoverDay.value = null; }, 150);
}
function cancelHide() {
  if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
}

function emptyForm() {
  return { title: '', todoType: 'CUSTOM', priority: 'NORMAL', dueAt: '', description: '' };
}

function openAdd(dateStr) {
  editingId.value = null;
  form.value = emptyForm();
  const d = dateStr || dateKey(viewDate.value);
  form.value.dueAt = d + 'T09:00';
  showAdd.value = true;
}

function openDetail(t) {
  detailTodo.value = t;
  showDetail.value = true;
}

function openEdit(t) {
  showDetail.value = false;
  editingId.value = t.id;
  form.value = {
    title: t.title || '',
    todoType: t.todoType || 'CUSTOM',
    priority: t.priority || 'NORMAL',
    dueAt: t.dueAt ? String(t.dueAt).slice(0, 16) : '',
    description: t.description || ''
  };
  showAdd.value = true;
}

async function save() {
  if (!form.value.title.trim() || !form.value.dueAt) return;
  if (!getToken()) { emit('requireLogin'); return; }
  saving.value = true;
  const dueAt = form.value.dueAt + ':00';
  const payload = {
    title: form.value.title.trim(),
    todoType: form.value.todoType,
    priority: form.value.priority,
    dueAt,
    description: form.value.description,
    planId: currentPlanId.value
  };
  try {
    if (editingId.value) await updateTodo(editingId.value, payload);
    else await createTodo(payload);
    showAdd.value = false;
    await load();
    emit('changed');
  } catch (e) {} finally {
    saving.value = false;
  }
}

async function toggleDone(t) {
  const target = t.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
  try {
    await updateTodo(t.id, { status: target });
    await load();
    emit('changed');
  } catch (e) {}
}

async function remove(t) {
  try {
    await deleteTodo(t.id);
    showDetail.value = false;
    await load();
    emit('changed');
  } catch (e) {}
}

function relate(t) {
  const parts = [];
  if (t.companyName) parts.push(t.companyName);
  if (t.jobTitle) parts.push(t.jobTitle);
  return parts.join('｜');
}

onMounted(load);
</script>

<template>
  <div class="todo-calendar">
    <!-- 顶部工具栏 -->
    <div class="cal-header">
      <div class="cal-title-area">
        <div class="cal-title">待办日历</div>
        <div class="cal-sub">管理投递、笔试、面试和其他求职安排</div>
        <span v-if="currentPlan" class="cal-plan-tag">{{ currentPlan.planName }}</span>
      </div>
      <div class="cal-nav">
        <button class="cal-nav-btn" @click="prev">‹</button>
        <button class="cal-today" @click="today">今天</button>
        <span class="cal-range">{{ viewMode === 'month' ? monthLabel : viewMode === 'week' ? weekLabel : dayLabel }}</span>
        <button class="cal-nav-btn" @click="next">›</button>
      </div>
      <div class="cal-actions">
        <div class="cal-view-switch">
          <span :class="{ active: viewMode === 'month' }" @click="viewMode = 'month'">月</span>
          <span :class="{ active: viewMode === 'week' }" @click="viewMode = 'week'">周</span>
          <span :class="{ active: viewMode === 'day' }" @click="viewMode = 'day'">日</span>
        </div>
        <button class="cal-add-btn" @click="openAdd()">＋ 添加待办</button>
      </div>
    </div>

    <!-- 主体 -->
    <div class="cal-body">
      <!-- 左侧筛选栏 -->
      <div class="cal-filter">
        <div class="cf-section">
          <div class="cf-title">求职计划</div>
          <div v-for="p in plans" :key="p.id" class="cf-item" :class="{ on: currentPlanId === p.id }" @click="switchPlan(p.id)">
            <span>{{ p.planName }}</span>
            <span v-if="p.status === 'IN_PROGRESS'" class="cf-tag">进行中</span>
          </div>
        </div>
        <div class="cf-section">
          <div class="cf-title">任务类型</div>
          <div class="cf-item" :class="{ on: filterType === '' }" @click="filterType = ''">
            <span class="cf-dot" style="background:#96a8bd"></span>全部类型
          </div>
          <div v-for="(v, k) in TYPE" :key="k" class="cf-item" :class="{ on: filterType === k }" @click="filterType = k">
            <span class="cf-dot" :style="{ background: v.color }"></span>{{ v.label }}
          </div>
        </div>
        <div class="cf-section">
          <div class="cf-title">任务状态</div>
          <div class="cf-item" :class="{ on: filterStatus === '' }" @click="filterStatus = ''">全部</div>
          <div class="cf-item" :class="{ on: filterStatus === 'PENDING' }" @click="filterStatus = 'PENDING'">待完成</div>
          <div class="cf-item" :class="{ on: filterStatus === 'COMPLETED' }" @click="filterStatus = 'COMPLETED'">已完成</div>
          <div class="cf-item" :class="{ on: filterStatus === 'OVERDUE' }" @click="filterStatus = 'OVERDUE'">已逾期</div>
        </div>
        <div class="cf-stats">
          <div>本月共 {{ monthStats.total }} 项待办</div>
          <div>已完成 {{ monthStats.done }} 项</div>
          <div>待完成 {{ monthStats.pending }} 项</div>
        </div>
      </div>

      <!-- 日历主体 -->
      <div class="cal-main">
        <div v-if="loading" class="cal-empty">加载中...</div>

        <!-- 月视图 -->
        <div v-else-if="viewMode === 'month'" class="cal-month">
          <div class="cal-week-head">
            <span v-for="w in WEEK_HEAD" :key="w" class="cal-week-cell">{{ w }}</span>
          </div>
          <div class="cal-grid">
            <div
              v-for="d in calendarDays"
              :key="dateKey(d)"
              class="cal-day"
              :class="{ 'other-month': isOtherMonth(d), 'is-today': isToday(d) }"
              @click="openAdd(dateKey(d))"
              @mouseenter="showHover(d, $event)"
              @mouseleave="scheduleHide"
            >
              <div class="cal-day-num" :class="{ 'today-circle': isToday(d) }">{{ d.getDate() }}</div>
              <div class="cal-day-todos">
                <div
                  v-for="t in todosForDay(d).slice(0, 3)"
                  :key="t.id"
                  class="cal-todo"
                  :class="{ done: t.status === 'COMPLETED', overdue: isOverdue(t) }"
                  @click.stop="openDetail(t)"
                >
                  <span class="cal-todo-dot" :style="{ background: (TYPE[t.todoType]?.color || '#7a90a8') }">{{ TYPE[t.todoType]?.short || '待' }}</span>
                  <span class="cal-todo-title">{{ shortTitle(t) }}</span>
                </div>
                <div v-if="todosForDay(d).length > 3" class="cal-more" @click.stop="viewMode = 'day'; viewDate = d">+{{ todosForDay(d).length - 3 }} 更多</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 周视图 -->
        <div v-else-if="viewMode === 'week'" class="cal-week">
          <div v-for="d in weekDays" :key="dateKey(d)" class="cal-week-col" :class="{ 'is-today': isToday(d) }">
            <div class="cal-week-col-head">
              <span class="cal-week-col-week">周{{ WEEK_HEAD[(d.getDay() + 6) % 7] }}</span>
              <span class="cal-week-col-date" :class="{ 'today-circle': isToday(d) }">{{ d.getDate() }}</span>
            </div>
            <div class="cal-week-col-body">
              <div v-if="!todosForDay(d).length" class="cal-day-empty" @click="openAdd(dateKey(d))">＋</div>
              <div
                v-for="t in todosForDay(d)"
                :key="t.id"
                class="cal-todo"
                :class="{ done: t.status === 'COMPLETED', overdue: isOverdue(t) }"
                :title="t.title"
                @click="openDetail(t)"
              >
                <span class="cal-todo-dot" :style="{ background: (TYPE[t.todoType]?.color || '#7a90a8') }">{{ TYPE[t.todoType]?.short || '待' }}</span>
                <span class="cal-todo-title">{{ shortTitle(t) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 日视图 -->
        <div v-else class="cal-day-view">
          <div v-if="!todosForDay(viewDate).length" class="cal-empty">
            <div>今天暂时没有待办</div>
            <button class="cal-add-btn" @click="openAdd(dateKey(viewDate))">＋ 添加待办</button>
          </div>
          <div
            v-for="t in todosForDay(viewDate)"
            :key="t.id"
            class="cal-day-item"
            :class="{ done: t.status === 'COMPLETED', overdue: isOverdue(t) }"
            @click="openDetail(t)"
          >
            <div class="cal-day-item-time">{{ t.dueAt ? fmtTime(t) : '全天' }}</div>
            <div class="cal-day-item-dot" :style="{ background: (TYPE[t.todoType]?.color || '#7a90a8') }"></div>
            <div class="cal-day-item-body">
              <div class="cal-day-item-title">{{ t.title }}</div>
              <div class="cal-day-item-relate" v-if="relate(t)">{{ relate(t) }}</div>
            </div>
            <span class="cal-day-item-priority" :class="PRIORITY[t.priority]?.cls || 'normal'">{{ PRIORITY[t.priority]?.label || '普通' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加/编辑弹窗 -->
    <div v-if="showAdd" class="cal-mask">
      <div class="cal-dialog">
        <div class="cal-dialog-title">{{ editingId ? '编辑待办' : '添加待办' }}</div>
        <div class="cal-form">
          <label class="cal-field">
            <span class="cal-field-label">待办名称 <i>*</i></span>
            <input v-model="form.title" placeholder="如：准备某公司产品经理一面" />
          </label>
          <div class="cal-field-row">
            <label class="cal-field">
              <span class="cal-field-label">任务类型</span>
              <SelectPicker v-model="form.todoType" :options="typeOptions" placeholder="选择类型" />
            </label>
            <label class="cal-field">
              <span class="cal-field-label">优先级</span>
              <SelectPicker v-model="form.priority" :options="priorityOptions" placeholder="选择优先级" />
            </label>
          </div>
          <label class="cal-field">
            <span class="cal-field-label">日期时间 <i>*</i></span>
            <DatePicker v-model="form.dueAt" :date-only="false" placeholder="选择日期时间" />
          </label>
          <label class="cal-field">
            <span class="cal-field-label">备注</span>
            <input v-model="form.description" placeholder="可选，如：准备项目经历和数据分析案例" />
          </label>
        </div>
        <div class="cal-dialog-actions">
          <button class="cal-btn" @click="showAdd = false">取消</button>
          <button class="cal-btn primary" :disabled="saving || !form.title.trim() || !form.dueAt" @click="save">保存待办</button>
        </div>
      </div>
    </div>

    <!-- 详情弹窗 -->
    <div v-if="showDetail && detailTodo" class="cal-mask">
      <div class="cal-dialog">
        <div class="cal-dialog-title">待办详情</div>
        <div class="cal-detail">
          <div class="cd-row"><span class="cd-label">任务</span><span class="cd-value">{{ detailTodo.title }}</span></div>
          <div class="cd-row"><span class="cd-label">状态</span><span class="cd-value">{{ detailTodo.status === 'COMPLETED' ? '已完成' : (isOverdue(detailTodo) ? '已逾期' : '待完成') }}</span></div>
          <div class="cd-row"><span class="cd-label">类型</span><span class="cd-value">{{ TYPE[detailTodo.todoType]?.label || '自定义' }}</span></div>
          <div class="cd-row" v-if="detailTodo.planName"><span class="cd-label">计划</span><span class="cd-value">{{ detailTodo.planName }}</span></div>
          <div class="cd-row" v-if="relate(detailTodo)"><span class="cd-label">岗位</span><span class="cd-value">{{ relate(detailTodo) }}</span></div>
          <div class="cd-row" v-if="detailTodo.dueAt"><span class="cd-label">时间</span><span class="cd-value">{{ String(detailTodo.dueAt).slice(0, 16) }}</span></div>
          <div class="cd-row"><span class="cd-label">优先级</span><span class="cd-value">{{ PRIORITY[detailTodo.priority]?.label || '普通' }}</span></div>
          <div class="cd-row" v-if="detailTodo.description"><span class="cd-label">备注</span><span class="cd-value">{{ detailTodo.description }}</span></div>
          <div class="cd-row" v-if="detailTodo.source === 'SYSTEM'"><span class="cd-label">来源</span><span class="cd-value">系统提醒</span></div>
        </div>
        <div class="cal-dialog-actions">
          <button class="cal-btn danger" @click="remove(detailTodo)">删除</button>
          <button class="cal-btn" @click="toggleDone(detailTodo)">{{ detailTodo.status === 'COMPLETED' ? '标记未完成' : '标记完成' }}</button>
          <button class="cal-btn" @click="openEdit(detailTodo)">编辑</button>
          <button class="cal-btn primary" @click="showDetail = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- 日期格 hover 弹窗 -->
    <div
      v-if="hoverDay && hoverTodos.length"
      class="cal-hover"
      :style="{ left: hoverPos.x + 'px', top: hoverPos.y + 'px' }"
      @mouseenter="cancelHide"
      @mouseleave="scheduleHide"
    >
      <div class="cal-hover-head">{{ hoverDay.slice(5).replace('-', '/') }} · {{ hoverTodos.length }} 项</div>
      <div v-for="t in hoverTodos" :key="t.id" class="cal-hover-item" @click="openDetail(t)">
        <span class="cal-hover-dot" :style="{ background: (TYPE[t.todoType]?.color || '#7a90a8') }"></span>
        <span class="cal-hover-time">{{ t.dueAt ? fmtTime(t) : '全天' }}</span>
        <span class="cal-hover-title">{{ t.title }}</span>
        <span v-if="t.status === 'COMPLETED'" class="cal-hover-done">✓</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.todo-calendar { display: flex; flex-direction: column; gap: 16px; padding: 0 4px; }
.cal-header { display: flex; align-items: center; gap: 24px; background: linear-gradient(120deg, #fff, #eef5ff); border-radius: 16px; padding: 18px 24px; }
.cal-title-area { display: flex; flex-direction: column; gap: 2px; }
.cal-title { font-size: 22px; font-weight: 700; color: #17304f; }
.cal-sub { font-size: 12px; color: #96a8bd; }
.cal-plan-tag { align-self: flex-start; margin-top: 6px; font-size: 11px; padding: 2px 10px; border-radius: 10px; background: #eaf2ff; color: #4b87e5; }
.cal-nav { display: flex; align-items: center; gap: 8px; margin-left: auto; }
.cal-nav-btn { width: 32px; height: 32px; border: 1px solid #dce7f4; border-radius: 8px; background: #fff; color: #617895; font-size: 16px; cursor: pointer; }
.cal-nav-btn:hover { border-color: #4b87e5; color: #4b87e5; }
.cal-today { height: 32px; padding: 0 14px; border: 1px solid #dce7f4; border-radius: 8px; background: #fff; color: #617895; font-size: 13px; cursor: pointer; }
.cal-range { font-size: 14px; font-weight: 600; color: #17304f; min-width: 120px; text-align: center; }
.cal-actions { display: flex; align-items: center; gap: 12px; }
.cal-view-switch { display: flex; border: 1px solid #dce7f4; border-radius: 10px; overflow: hidden; }
.cal-view-switch span { padding: 6px 14px; font-size: 13px; color: #617895; cursor: pointer; background: #fff; }
.cal-view-switch span.active { background: #4b87e5; color: #fff; }
.cal-add-btn { height: 36px; padding: 0 18px; border: none; border-radius: 12px; background: linear-gradient(135deg, #3f82e8, #63aef3); color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; }

.cal-body { display: flex; gap: 16px; }
.cal-filter { width: 200px; flex-shrink: 0; background: #fff; border: 1px solid #eaf2ff; border-radius: 14px; padding: 16px; display: flex; flex-direction: column; gap: 16px; }
.cf-section { display: flex; flex-direction: column; gap: 4px; }
.cf-title { font-size: 13px; font-weight: 600; color: #17304f; margin-bottom: 6px; }
.cf-item { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 8px; font-size: 13px; color: #617895; cursor: pointer; }
.cf-item:hover { background: #f5f8fd; }
.cf-item.on { background: #eaf2ff; color: #4b87e5; font-weight: 600; }
.cf-tag { font-size: 10px; padding: 1px 6px; border-radius: 6px; background: #4b87e5; color: #fff; }
.cf-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.cf-stats { border-top: 1px solid #eef3f8; padding-top: 12px; font-size: 12px; color: #96a8bd; display: flex; flex-direction: column; gap: 4px; }

.cal-main { flex: 1; min-width: 0; background: #fff; border: 1px solid #eaf2ff; border-radius: 16px; padding: 16px; }
.cal-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 60px 0; color: #96a8bd; font-size: 14px; }

.cal-week-head { display: grid; grid-template-columns: repeat(7, 1fr); }
.cal-week-cell { text-align: center; font-size: 12px; color: #96a8bd; padding: 6px 0; }
.cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); border-top: 1px solid #eef3f8; border-left: 1px solid #eef3f8; }
.cal-day { min-height: 110px; border-right: 1px solid #eef3f8; border-bottom: 1px solid #eef3f8; padding: 6px; cursor: pointer; position: relative; }
.cal-day:hover { background: #f8fafd; }
.cal-day.other-month .cal-day-num { color: #d0dae6; }
.cal-day.is-today { background: #f5f9ff; }
.cal-day-num { font-size: 13px; color: #617895; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; margin-bottom: 4px; }
.cal-day-num.today-circle { background: #4b87e5; color: #fff; border-radius: 50%; }
.cal-day-todos { display: flex; flex-direction: column; gap: 3px; }
.cal-todo { display: flex; align-items: center; gap: 4px; padding: 2px 4px; border-radius: 5px; font-size: 11px; cursor: pointer; overflow: hidden; }
.cal-todo-dot { width: 16px; height: 16px; border-radius: 50%; color: #fff; font-size: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.cal-todo-time { font-size: 10px; opacity: 0.8; flex-shrink: 0; }
.cal-todo-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #617895; }
.cal-todo.done { opacity: 0.5; text-decoration: line-through; }
.cal-todo.overdue .cal-todo-title { color: #e35d5d; }
.cal-more { font-size: 11px; color: #4b87e5; padding: 2px 6px; cursor: pointer; }
.cal-more:hover { text-decoration: underline; }

.cal-week { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; }
.cal-week-col { border: 1px solid #eef3f8; border-radius: 10px; min-height: 200px; padding: 8px; }
.cal-week-col.is-today { border-color: #4b87e5; background: #f5f9ff; }
.cal-week-col-head { display: flex; flex-direction: column; align-items: center; gap: 4px; margin-bottom: 8px; }
.cal-week-col-week { font-size: 12px; color: #96a8bd; }
.cal-week-col-date { font-size: 16px; font-weight: 600; color: #17304f; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; }
.cal-week-col-date.today-circle { background: #4b87e5; color: #fff; border-radius: 50%; }
.cal-week-col-body { display: flex; flex-direction: column; gap: 4px; }
.cal-day-empty { text-align: center; color: #c8d5e3; padding: 10px 0; cursor: pointer; }
.cal-day-empty:hover { color: #4b87e5; }

.cal-day-view { display: flex; flex-direction: column; gap: 8px; }
.cal-day-item { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid #eef3f8; border-radius: 10px; cursor: pointer; }
.cal-day-item:hover { border-color: #4b87e5; }
.cal-day-item.done { opacity: 0.5; }
.cal-day-item.overdue { border-color: #f3c9c9; background: #fffafb; }
.cal-day-item-time { font-size: 13px; color: #617895; width: 44px; flex-shrink: 0; }
.cal-day-item-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.cal-day-item-body { flex: 1; min-width: 0; }
.cal-day-item-title { font-size: 14px; color: #17304f; }
.cal-day-item-relate { font-size: 12px; color: #96a8bd; margin-top: 2px; }
.cal-day-item-priority { font-size: 11px; padding: 1px 8px; border-radius: 10px; }
.cal-day-item-priority.urgent { background: #fdeaea; color: #e35d5d; }
.cal-day-item-priority.important { background: #fff3e5; color: #f5a623; }
.cal-day-item-priority.normal { background: #eaf2ff; color: #4b87e5; }

.cal-mask { position: fixed; inset: 0; background: rgba(20, 40, 70, 0.4); display: flex; align-items: center; justify-content: center; z-index: 9998; }

.cal-hover {
  position: fixed; z-index: 9997; min-width: 220px; max-width: 260px;
  background: #fff; border: 1px solid #dce7f4; border-radius: 12px;
  box-shadow: 0 8px 24px rgba(30, 53, 87, 0.16); padding: 8px;
}
.cal-hover-head { font-size: 12px; font-weight: 600; color: #17304f; padding: 4px 8px 8px; border-bottom: 1px solid #eef3f8; margin-bottom: 4px; }
.cal-hover-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; cursor: pointer; }
.cal-hover-item:hover { background: #f0f5ff; }
.cal-hover-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.cal-hover-time { font-size: 12px; color: #617895; width: 38px; flex-shrink: 0; white-space: nowrap; }
.cal-hover-title { font-size: 12px; color: #17304f; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cal-hover-done { font-size: 12px; color: #35b779; flex-shrink: 0; }

.cal-dialog { width: 480px; max-width: 92vw; background: #fff; border-radius: 16px; padding: 24px; }
.cal-dialog-title { font-size: 18px; font-weight: 700; color: #17304f; margin-bottom: 18px; }
.cal-form { display: flex; flex-direction: column; gap: 14px; }
.cal-field { display: flex; flex-direction: column; gap: 6px; }
.cal-field-row { display: flex; gap: 12px; }
.cal-field-row .cal-field { flex: 1; }
.cal-field-label { font-size: 13px; color: #617895; }
.cal-field-label i { color: #e35d5d; font-style: normal; }
.cal-field input, .cal-field select { height: 38px; border: 1px solid #dce7f4; border-radius: 10px; padding: 0 12px; font-size: 14px; color: #17304f; outline: none; background: #fff; }
.cal-field input:focus, .cal-field select:focus { border-color: #4b87e5; }
.cal-dialog-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
.cal-btn { height: 34px; padding: 0 16px; border: 1px solid #dce7f4; border-radius: 10px; background: #fff; color: #617895; font-size: 13px; cursor: pointer; }
.cal-btn.primary { background: #4b87e5; border-color: #4b87e5; color: #fff; }
.cal-btn.danger { color: #e35d5d; border-color: #f3c9c9; }
.cal-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.cal-detail { display: flex; flex-direction: column; gap: 12px; }
.cd-row { display: flex; gap: 12px; font-size: 13px; }
.cd-label { width: 60px; flex-shrink: 0; color: #96a8bd; }
.cd-value { flex: 1; color: #17304f; }
</style>
