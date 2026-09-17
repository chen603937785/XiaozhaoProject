<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { getTodos, createTodo, updateTodo, deleteTodo, getToken } from '../api';
import DatePicker from './DatePicker.vue';
import SelectPicker from './SelectPicker.vue';

const props = defineProps({ planId: { type: Number, default: null } });
const emit = defineEmits(['changed', 'requireLogin']);

const todos = ref([]);
const loading = ref(false);
const showDialog = ref(false);
const editingId = ref(null);
const saving = ref(false);
const form = ref({});

const TYPE = {
  APPLICATION: { label: '投递', color: '#4b87e5', bg: '#eaf2ff' },
  MATERIAL: { label: '材料', color: '#8b7cf6', bg: '#f0edff' },
  ASSESSMENT: { label: '笔试', color: '#f5a623', bg: '#fff3e5' },
  INTERVIEW: { label: '面试', color: '#17a2a6', bg: '#eaf8fa' },
  FOLLOW_UP: { label: '跟进', color: '#35b779', bg: '#ecf8f2' },
  CUSTOM: { label: '自定义', color: '#7a90a8', bg: '#e7eef8' }
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

function emptyForm() {
  const now = new Date();
  const d = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  return {
    title: '',
    todoType: 'CUSTOM',
    priority: 'NORMAL',
    dueAt: d + 'T09:00',
    description: ''
  };
}

const doneCount = computed(() => todayTodos.value.filter(t => t.status === 'COMPLETED').length);
const progress = computed(() => todayTodos.value.length ? Math.round(doneCount.value / todayTodos.value.length * 100) : 0);

function dueDate(t) {
  if (!t.dueAt) return null;
  return new Date(String(t.dueAt).replace(' ', 'T'));
}

function isOverdue(t) {
  if (t.status === 'COMPLETED') return false;
  const d = dueDate(t);
  return d && d < new Date();
}

function sortKey(t) {
  if (t.status === 'COMPLETED') return 5;
  const d = dueDate(t);
  if (!d) return 4;
  const now = new Date();
  if (d < now) return 0; // 已逾期
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
  if (d <= todayEnd) return 1; // 今天截止
  const tomorrowEnd = new Date(); tomorrowEnd.setDate(tomorrowEnd.getDate() + 1); tomorrowEnd.setHours(23, 59, 59, 999);
  if (d <= tomorrowEnd) return 2; // 明天截止
  return 3; // 普通
}

// 今日待办：只显示当天的待办
const todayTodos = computed(() => {
  const now = new Date();
  const todayKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  return todos.value.filter(t => {
    if (!t.dueAt) return false;
    return String(t.dueAt).slice(0, 10) === todayKey;
  });
});

const sortedTodos = computed(() => {
  return [...todayTodos.value].sort((a, b) => sortKey(a) - sortKey(b) || (a.id - b.id));
});

function deadlineLabel(t) {
  if (t.status === 'COMPLETED') return '已完成';
  if (isOverdue(t)) return '已逾期';
  if (!t.dueAt) return '';
  const d = dueDate(t);
  const now = new Date();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const diff = Math.ceil((d - todayStart) / 86400000);
  if (diff === 0) return '今天 ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  if (diff === 1) return '明天 ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  return (d.getMonth() + 1) + '月' + d.getDate() + '日';
}

function pad(n) { return n < 10 ? '0' + n : '' + n; }

function relate(t) {
  const parts = [];
  if (t.companyName) parts.push(t.companyName);
  if (t.jobTitle) parts.push(t.jobTitle);
  if (t.planName) parts.push(t.planName);
  return parts.join('｜') || '未关联计划';
}

async function load() {
  loading.value = true;
  try {
    todos.value = await getTodos(props.planId || undefined);
  } catch (e) {
    todos.value = [];
  } finally {
    loading.value = false;
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

function openCreate() {
  editingId.value = null;
  form.value = emptyForm();
  showDialog.value = true;
}

function openEdit(t) {
  editingId.value = t.id;
  form.value = {
    title: t.title || '',
    todoType: t.todoType || 'CUSTOM',
    priority: t.priority || 'NORMAL',
    dueAt: t.dueAt ? String(t.dueAt).slice(0, 16) : '',
    description: t.description || ''
  };
  showDialog.value = true;
}

async function save() {
  if (!form.value.title.trim()) return;
  if (!getToken()) { emit('requireLogin'); return; }
  saving.value = true;
  const payload = {
    title: form.value.title.trim(),
    todoType: form.value.todoType,
    priority: form.value.priority,
    dueAt: form.value.dueAt ? form.value.dueAt + ':00' : null,
    description: form.value.description,
    planId: props.planId
  };
  try {
    if (editingId.value) {
      await updateTodo(editingId.value, payload);
    } else {
      await createTodo(payload);
    }
    showDialog.value = false;
    await load();
    emit('changed');
  } catch (e) {} finally {
    saving.value = false;
  }
}

async function remove(t) {
  try {
    await deleteTodo(t.id);
    await load();
    emit('changed');
  } catch (e) {}
}

watch(() => props.planId, load);
onMounted(load);
</script>

<template>
  <div class="todo-card">
    <div class="tc-head">
      <div class="tc-head-left">
        <span class="tc-title">今日待办</span>
        <span class="tc-count">{{ todayTodos.length }} 项</span>
      </div>
      <div class="tc-head-right">已完成 {{ doneCount }}/{{ todayTodos.length }}</div>
    </div>
    <div class="tc-progress"><div class="tc-progress-fill" :style="{ width: progress + '%' }"></div></div>

    <div v-if="loading" class="tc-empty">加载中...</div>
    <div v-else-if="!todayTodos.length" class="tc-empty">
      <div class="tc-empty-main">今天暂时没有待办</div>
      <div class="tc-empty-sub">可以添加一个求职任务，保持求职节奏</div>
    </div>
    <div v-else-if="progress === 100" class="tc-empty">
      <div class="tc-empty-main">今日待办已全部完成</div>
      <div class="tc-empty-sub">继续保持，你做得很好</div>
    </div>

    <div v-else class="tc-list">
      <div
        v-for="t in sortedTodos"
        :key="t.id"
        class="tc-item"
        :class="{ done: t.status === 'COMPLETED', overdue: isOverdue(t) }"
      >
        <div class="tc-checkbox" :class="{ checked: t.status === 'COMPLETED' }" @click="toggleDone(t)">
          <span v-if="t.status === 'COMPLETED'" class="tc-check">✓</span>
        </div>
        <div class="tc-body" @click="openEdit(t)">
          <div class="tc-row1">
            <span class="tc-dot" :style="{ background: (TYPE[t.todoType]?.color || '#7a90a8') }"></span>
            <span class="tc-name">{{ t.title }}</span>
            <span v-if="t.source === 'SYSTEM'" class="tc-source">系统</span>
          </div>
          <div class="tc-relate">{{ relate(t) }}</div>
        </div>
        <div class="tc-right">
          <span class="tc-deadline" :class="{ 'deadline-over': isOverdue(t) }">{{ deadlineLabel(t) }}</span>
          <span v-if="t.status !== 'COMPLETED'" class="tc-priority" :class="PRIORITY[t.priority]?.cls || 'normal'">
            {{ PRIORITY[t.priority]?.label || '普通' }}
          </span>
          <span class="tc-del" @click.stop="remove(t)" title="删除">×</span>
        </div>
      </div>
    </div>

    <div class="tc-add" @click="openCreate">＋ 添加待办</div>

    <!-- 添加/编辑弹窗 -->
    <div v-if="showDialog" class="tc-mask">
      <div class="tc-dialog">
        <div class="tc-dialog-title">{{ editingId ? '编辑待办' : '添加待办' }}</div>
        <div class="tc-form">
          <label class="tc-field">
            <span class="tc-field-label">待办名称 <i>*</i></span>
            <input v-model="form.title" placeholder="如：准备产品经理一面" />
          </label>
          <div class="tc-field-row">
            <label class="tc-field">
              <span class="tc-field-label">类型</span>
              <SelectPicker v-model="form.todoType" :options="typeOptions" placeholder="选择类型" />
            </label>
            <label class="tc-field">
              <span class="tc-field-label">优先级</span>
              <SelectPicker v-model="form.priority" :options="priorityOptions" placeholder="选择优先级" />
            </label>
          </div>
          <label class="tc-field">
            <span class="tc-field-label">截止时间</span>
            <DatePicker v-model="form.dueAt" :date-only="false" placeholder="选择截止时间" />
          </label>
          <label class="tc-field">
            <span class="tc-field-label">备注</span>
            <input v-model="form.description" placeholder="可选，如：准备项目经历和数据分析案例" />
          </label>
        </div>
        <div class="tc-dialog-actions">
          <button class="tc-btn" @click="showDialog = false">取消</button>
          <button class="tc-btn primary" :disabled="saving || !form.title.trim()" @click="save">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.todo-card { background: #fff; border: 1px solid #eaf2ff; border-radius: 20px; padding: 22px 24px; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 4px 16px rgba(30, 53, 87, 0.04); }
.tc-head { display: flex; align-items: center; justify-content: space-between; }
.tc-head-left { display: flex; align-items: center; gap: 10px; }
.tc-title { font-size: 20px; font-weight: 600; color: #17304f; }
.tc-count { font-size: 12px; padding: 2px 10px; border-radius: 12px; background: #eaf2ff; color: #4b87e5; }
.tc-head-right { font-size: 13px; color: #617895; }
.tc-progress { height: 6px; background: #e7eef8; border-radius: 3px; overflow: hidden; }
.tc-progress-fill { height: 100%; background: linear-gradient(90deg, #3f82e8, #63aef3); border-radius: 3px; }

.tc-list { display: flex; flex-direction: column; max-height: 280px; overflow-y: auto; }
.tc-list::-webkit-scrollbar { width: 6px; }
.tc-list::-webkit-scrollbar-thumb { background: #dce7f4; border-radius: 3px; }
.tc-item { display: flex; align-items: flex-start; gap: 12px; padding: 12px 4px; border-bottom: 1px solid #eef3f8; }
.tc-item:last-child { border-bottom: none; }
.tc-checkbox { width: 20px; height: 20px; border: 1.5px solid #dce7f4; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-top: 2px; flex-shrink: 0; cursor: pointer; }
.tc-checkbox.checked { background: #4b87e5; border-color: #4b87e5; }
.tc-check { color: #fff; font-size: 12px; }
.tc-body { flex: 1; cursor: pointer; min-width: 0; }
.tc-row1 { display: flex; align-items: center; gap: 8px; }
.tc-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.tc-name { flex: 1; min-width: 0; font-size: 14px; color: #17304f; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tc-relate { font-size: 12px; color: #96a8bd; margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tc-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.tc-deadline { font-size: 12px; color: #96a8bd; }
.tc-deadline.deadline-over { color: #e35d5d; }
.tc-priority { font-size: 11px; padding: 1px 8px; border-radius: 10px; }
.tc-priority.urgent { background: #fdeaea; color: #e35d5d; }
.tc-priority.important { background: #fff3e5; color: #f5a623; }
.tc-priority.normal { background: #eaf2ff; color: #4b87e5; }
.tc-source { font-size: 10px; padding: 0 6px; border-radius: 6px; background: #f0edff; color: #8b7cf6; flex-shrink: 0; }
.tc-del { font-size: 16px; color: #c8d5e3; cursor: pointer; line-height: 1; }
.tc-del:hover { color: #e35d5d; }
.tc-item.done .tc-name { color: #96a8bd; text-decoration: line-through; }

.tc-empty { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 30px 0; }
.tc-empty-main { font-size: 14px; color: #617895; }
.tc-empty-sub { font-size: 12px; color: #96a8bd; }

.tc-add { padding: 10px; border: 1px dashed #dce7f4; border-radius: 10px; text-align: center; font-size: 13px; color: #4b87e5; cursor: pointer; }
.tc-add:hover { border-color: #4b87e5; }

.tc-mask { position: fixed; inset: 0; background: rgba(20, 40, 70, 0.4); display: flex; align-items: center; justify-content: center; z-index: 9998; }
.tc-dialog { width: 460px; max-width: 92vw; background: #fff; border-radius: 16px; padding: 24px; }
.tc-dialog-title { font-size: 18px; font-weight: 700; color: #17304f; margin-bottom: 18px; }
.tc-form { display: flex; flex-direction: column; gap: 14px; }
.tc-field { display: flex; flex-direction: column; gap: 6px; }
.tc-field-row { display: flex; gap: 12px; }
.tc-field-row .tc-field { flex: 1; }
.tc-field-label { font-size: 13px; color: #617895; }
.tc-field-label i { color: #e35d5d; font-style: normal; }
.tc-field input, .tc-field select {
  height: 38px; border: 1px solid #dce7f4; border-radius: 10px; padding: 0 12px;
  font-size: 14px; color: #17304f; outline: none; background: #fff;
}
.tc-field input:focus, .tc-field select:focus { border-color: #4b87e5; }
.tc-dialog-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
.tc-btn { height: 34px; padding: 0 16px; border: 1px solid #dce7f4; border-radius: 10px; background: #fff; color: #617895; font-size: 13px; cursor: pointer; }
.tc-btn.primary { background: #4b87e5; border-color: #4b87e5; color: #fff; }
.tc-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
