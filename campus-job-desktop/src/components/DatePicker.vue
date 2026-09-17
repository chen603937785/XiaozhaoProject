<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  modelValue: { type: String, default: '' },
  // dateOnly=true 只选日期(YYYY-MM-DD)；false 选日期+时间(YYYY-MM-DDTHH:mm)
  dateOnly: { type: Boolean, default: true },
  placeholder: { type: String, default: '选择日期' }
});
const emit = defineEmits(['update:modelValue', 'change']);

const show = ref(false);
const viewDate = ref(new Date());
const time = ref('09:00');
const panelPos = ref({ x: 0, y: 0 });

function toggleShow(event) {
  if (!show.value) {
    const rect = event.currentTarget.getBoundingClientRect();
    let x = rect.left;
    let y = rect.bottom + 4;
    // 防止面板超出右边界
    if (x + 280 > window.innerWidth) x = window.innerWidth - 284;
    // 防止面板超出底部
    if (y + 380 > window.innerHeight) y = rect.top - 4 - 380;
    if (y < 4) y = 4;
    panelPos.value = { x, y };
  }
  show.value = !show.value;
}

function parseVal(v) {
  if (!v) return { date: '', time: '09:00' };
  const s = String(v);
  return {
    date: s.slice(0, 10),
    time: s.length >= 16 ? s.slice(11, 16) : '09:00'
  };
}

watch(() => props.modelValue, (v) => {
  const p = parseVal(v);
  if (p.date) {
    const [y, m, d] = p.date.split('-').map(Number);
    viewDate.value = new Date(y, m - 1, d);
  }
  time.value = p.time;
}, { immediate: true });

const displayText = computed(() => {
  const p = parseVal(props.modelValue);
  if (!p.date) return props.placeholder;
  if (props.dateOnly) return p.date;
  return p.date + ' ' + p.time;
});

const calendarDays = computed(() => {
  const y = viewDate.value.getFullYear();
  const m = viewDate.value.getMonth();
  const first = new Date(y, m, 1);
  const offset = (first.getDay() + 6) % 7; // 周一=0
  const start = new Date(y, m, 1 - offset);
  const cells = [];
  for (let i = 0; i < 42; i++) {
    cells.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }
  return cells;
});

const viewLabel = computed(() => viewDate.value.getFullYear() + ' 年 ' + (viewDate.value.getMonth() + 1) + ' 月');

function prevMonth() {
  viewDate.value = new Date(viewDate.value.getFullYear(), viewDate.value.getMonth() - 1, 1);
}
function nextMonth() {
  viewDate.value = new Date(viewDate.value.getFullYear(), viewDate.value.getMonth() + 1, 1);
}

function isSelected(d) {
  return dateKey(d) === parseVal(props.modelValue).date;
}
function isOtherMonth(d) {
  return d.getMonth() !== viewDate.value.getMonth();
}
function isToday(d) {
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}
function dateKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function selectDay(d) {
  const key = dateKey(d);
  if (props.dateOnly) {
    emit('update:modelValue', key);
    emit('change', key);
    show.value = false;
  } else {
    emit('update:modelValue', key + 'T' + time.value);
  }
}

function confirm() {
  if (props.dateOnly) {
    show.value = false;
    return;
  }
  const p = parseVal(props.modelValue);
  if (!p.date) { show.value = false; return; }
  const val = p.date + 'T' + time.value;
  emit('update:modelValue', val);
  emit('change', val);
  show.value = false;
}

function clear() {
  emit('update:modelValue', '');
  emit('change', '');
  show.value = false;
}
</script>

<template>
  <div class="date-picker">
    <div class="dp-trigger" :class="{ empty: !modelValue }" @click="toggleShow">
      <span class="dp-text">{{ displayText }}</span>
      <span class="dp-clear" v-if="modelValue" @click.stop="clear">×</span>
    </div>
    <div v-if="show" class="dp-overlay" @click="show = false"></div>
    <div v-if="show" class="dp-panel" :style="{ left: panelPos.x + 'px', top: panelPos.y + 'px' }" @click.stop>
      <div class="dp-head">
        <button class="dp-nav" @click="prevMonth">‹</button>
        <span class="dp-label">{{ viewLabel }}</span>
        <button class="dp-nav" @click="nextMonth">›</button>
      </div>
      <div class="dp-week">
        <span v-for="w in ['一','二','三','四','五','六','日']" :key="w" class="dp-week-cell">{{ w }}</span>
      </div>
      <div class="dp-grid">
        <div
          v-for="d in calendarDays"
          :key="dateKey(d)"
          class="dp-day"
          :class="{ 'other': isOtherMonth(d), 'today': isToday(d), 'selected': isSelected(d) }"
          @click="selectDay(d)"
        >
          {{ d.getDate() }}
        </div>
      </div>
      <div v-if="!dateOnly" class="dp-time-row">
        <span class="dp-time-label">时间</span>
        <input type="time" v-model="time" class="dp-time-input" />
      </div>
      <div class="dp-actions">
        <button class="dp-btn" @click="show = false">取消</button>
        <button v-if="!dateOnly" class="dp-btn primary" @click="confirm">确定</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.date-picker { position: relative; }
.dp-trigger {
  display: inline-flex; align-items: center; gap: 6px;
  height: 34px; padding: 0 10px; border: 1px solid #dce7f4; border-radius: 8px;
  background: #fff; font-size: 12px; color: #17304f; cursor: pointer; min-width: 90px;
}
.dp-trigger:hover { border-color: #4b87e5; }
.dp-trigger.empty .dp-text { color: #96a8bd; }
.dp-text { flex: 1; white-space: nowrap; }
.dp-clear { color: #c8d5e3; font-size: 14px; line-height: 1; cursor: pointer; padding: 2px 4px; }
.dp-clear:hover { color: #e35d5d; }
.dp-overlay { position: fixed; inset: 0; z-index: 9997; }
.dp-panel {
  position: fixed; z-index: 9998;
  background: #fff; border: 1px solid #dce7f4; border-radius: 12px;
  box-shadow: 0 8px 20px rgba(30, 53, 87, 0.14); padding: 12px; width: 264px;
}
.dp-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.dp-nav { width: 28px; height: 28px; border: 1px solid #dce7f4; border-radius: 6px; background: #fff; color: #617895; cursor: pointer; font-size: 14px; }
.dp-nav:hover { border-color: #4b87e5; color: #4b87e5; }
.dp-label { font-size: 13px; font-weight: 600; color: #17304f; }
.dp-week { display: grid; grid-template-columns: repeat(7, 1fr); margin-bottom: 4px; }
.dp-week-cell { text-align: center; font-size: 11px; color: #96a8bd; padding: 4px 0; }
.dp-grid { display: grid; grid-template-columns: repeat(7, 1fr); }
.dp-day {
  height: 30px; display: flex; align-items: center; justify-content: center;
  font-size: 12px; color: #17304f; border-radius: 6px; cursor: pointer;
}
.dp-day:hover { background: #f0f5ff; }
.dp-day.other { color: #d0dae6; }
.dp-day.today { color: #4b87e5; font-weight: 600; }
.dp-day.selected { background: #4b87e5; color: #fff; }
.dp-time-row { display: flex; align-items: center; gap: 8px; margin-top: 10px; padding-top: 10px; border-top: 1px solid #eef3f8; }
.dp-time-label { font-size: 12px; color: #617895; }
.dp-time-input { flex: 1; height: 30px; border: 1px solid #dce7f4; border-radius: 6px; padding: 0 8px; font-size: 12px; color: #17304f; outline: none; }
.dp-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }
.dp-btn { height: 28px; padding: 0 14px; border: 1px solid #dce7f4; border-radius: 8px; background: #fff; color: #617895; font-size: 12px; cursor: pointer; }
.dp-btn.primary { background: #4b87e5; border-color: #4b87e5; color: #fff; }
</style>
