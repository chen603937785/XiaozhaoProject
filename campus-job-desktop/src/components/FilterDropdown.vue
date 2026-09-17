<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps({
  label: String,
  options: { type: Array, default: () => [] },
  modelValue: [String, Number],
  multi: { type: Boolean, default: false },
  placeholder: String
});
const emit = defineEmits(['update:modelValue', 'change']);

const open = ref(false);
const root = ref(null);

const selectedArr = computed(() => {
  if (props.modelValue === null || props.modelValue === undefined || props.modelValue === '') return [];
  return String(props.modelValue).split(',').filter(Boolean);
});

const display = computed(() => {
  const arr = selectedArr.value;
  if (!arr.length) return props.placeholder || props.label;
  if (arr.length === 1) return arr[0];
  return arr[0] + ' 等 ' + arr.length + ' 项';
});

function toggle() { open.value = !open.value; }

function isSelected(opt) {
  return selectedArr.value.includes(String(opt));
}

function onSelect(opt) {
  const v = String(opt);
  let arr = [...selectedArr.value];
  if (props.multi) {
    if (arr.includes(v)) arr = arr.filter(x => x !== v);
    else arr.push(v);
  } else {
    arr = arr.includes(v) ? [] : [v];
    open.value = false;
  }
  emit('update:modelValue', arr.join(','));
  emit('change');
}

function onDocClick(e) {
  if (root.value && !root.value.contains(e.target)) {
    open.value = false;
  }
}

onMounted(() => document.addEventListener('click', onDocClick));
onBeforeUnmount(() => document.removeEventListener('click', onDocClick));
</script>

<template>
  <div class="dropdown" ref="root">
    <button class="dropdown-btn" :class="{ active: selectedArr.length }" @click.stop="toggle">
      <span class="dropdown-label">{{ display }}</span>
      <span class="dropdown-arrow">▾</span>
    </button>
    <div v-if="open" class="dropdown-panel">
      <div
        v-for="opt in options"
        :key="opt"
        class="dropdown-opt"
        :class="{ selected: isSelected(opt) }"
        @click="onSelect(opt)"
      >
        <span class="opt-check">{{ isSelected(opt) ? '✓' : '' }}</span>
        <span>{{ opt }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dropdown { position: relative; }
.dropdown-btn {
  height: 36px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: #fff;
  font-size: 13px;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}
.dropdown-btn:hover { border-color: #c2d6ef; }
.dropdown-btn.active {
  border-color: var(--primary);
  background: var(--blue-bg);
  color: var(--primary);
}
.dropdown-arrow { font-size: 11px; color: var(--text-sub); }
.dropdown-panel {
  position: absolute;
  top: 42px;
  left: 0;
  min-width: 190px;
  max-height: 320px;
  overflow-y: auto;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 10px 28px rgba(30, 53, 87, 0.14);
  padding: 6px;
  z-index: 100;
}
.dropdown-opt {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 8px;
  font-size: 13px;
  color: var(--text);
  cursor: pointer;
  white-space: nowrap;
}
.dropdown-opt:hover { background: #f5f8fd; }
.dropdown-opt.selected { color: var(--primary); font-weight: 500; }
.opt-check { width: 16px; font-size: 12px; color: var(--primary); flex-shrink: 0; }
</style>
