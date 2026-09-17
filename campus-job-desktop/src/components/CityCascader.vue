<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps({
  provinces: { type: Array, default: () => [] },
  specialCities: { type: Array, default: () => [] },
  modelValue: [String, Number]
});
const emit = defineEmits(['update:modelValue', 'change']);

const open = ref(false);
const root = ref(null);
const hover = ref('');

const selectedArr = computed(() => {
  if (!props.modelValue) return [];
  return String(props.modelValue).split(',').filter(Boolean);
});

const display = computed(() => {
  const arr = selectedArr.value;
  if (!arr.length) return '城市';
  if (arr.length === 1) return arr[0];
  return arr[0] + ' 等 ' + arr.length + ' 项';
});

const hoverCities = computed(() => {
  const p = props.provinces.find(p => p.name === hover.value);
  return p ? p.cities : [];
});

const isSpecial = computed(() => props.specialCities.includes(hover.value));

function toggle() { open.value = !open.value; }

function isSelected(v) { return selectedArr.value.includes(v); }

function provinceChecked(p) {
  return p.cities.some(c => selectedArr.value.includes(c));
}

function toggleValue(v) {
  const arr = selectedArr.value.includes(v)
    ? selectedArr.value.filter(x => x !== v)
    : [...selectedArr.value, v];
  emit('update:modelValue', arr.join(','));
  emit('change');
}

function onSelectSpecial(v) {
  toggleValue(v);
}

function onSelectAllProvince() {
  const p = props.provinces.find(p => p.name === hover.value);
  if (p && p.cities.length) toggleValue(p.cities[0]);
}

function onSelectCity(v) {
  toggleValue(v);
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
  <div class="cascader" ref="root">
    <button class="cascader-btn" :class="{ active: selectedArr.length }" @click.stop="toggle">
      <span>{{ display }}</span>
      <span class="cascader-arrow">▾</span>
    </button>

    <div v-if="open" class="cascader-panel" @click.stop>
      <div class="cascader-col">
        <div
          v-for="s in specialCities"
          :key="s"
          class="cascader-item"
          :class="{ active: hover === s, checked: isSelected(s) }"
          @mouseenter="hover = s"
          @click="onSelectSpecial(s)"
        >
          <span class="check">{{ isSelected(s) ? '✓' : '' }}</span>
          <span>{{ s }}</span>
        </div>
        <div
          v-for="p in provinces"
          :key="p.name"
          class="cascader-item"
          :class="{ active: hover === p.name }"
          @mouseenter="hover = p.name"
        >
          <span class="check">{{ provinceChecked(p) ? '✓' : '' }}</span>
          <span>{{ p.name }}</span>
          <span class="cascader-item-arrow">›</span>
        </div>
      </div>

      <div class="cascader-col right">
        <template v-if="!isSpecial">
          <div
            v-if="hoverCities.length"
            class="cascader-item"
            :class="{ checked: isSelected(hoverCities[0]) }"
            @click="onSelectAllProvince"
          >
            <span class="check">{{ isSelected(hoverCities[0]) ? '✓' : '' }}</span>
            <span>全{{ hover }}</span>
          </div>
          <div
            v-for="c in hoverCities.slice(1)"
            :key="c"
            class="cascader-item"
            :class="{ checked: isSelected(c) }"
            @click="onSelectCity(c)"
          >
            <span class="check">{{ isSelected(c) ? '✓' : '' }}</span>
            <span>{{ c }}</span>
          </div>
        </template>
        <div v-else class="cascader-empty">请选择省份查看城市</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cascader { position: relative; }
.cascader-btn {
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
}
.cascader-btn:hover { border-color: #c2d6ef; }
.cascader-btn.active { border-color: var(--primary); background: var(--blue-bg); color: var(--primary); }
.cascader-arrow { font-size: 11px; color: var(--text-sub); }

.cascader-panel {
  position: absolute;
  top: 42px;
  left: 0;
  display: flex;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 10px 28px rgba(30, 53, 87, 0.14);
  z-index: 100;
  min-width: 380px;
  max-height: 360px;
}
.cascader-col {
  width: 50%;
  overflow-y: auto;
  padding: 6px;
}
.cascader-col.right {
  border-left: 1px solid #eef2f8;
}
.cascader-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  color: var(--text);
  cursor: pointer;
  white-space: nowrap;
}
.cascader-item:hover { background: #f5f8fd; }
.cascader-item.active { background: #f0f5ff; color: var(--primary); }
.cascader-item.checked { color: var(--primary); font-weight: 500; }
.cascader-item-arrow { margin-left: auto; color: #b0c0d6; font-size: 12px; }
.check { width: 16px; font-size: 12px; color: var(--primary); flex-shrink: 0; }
.cascader-empty { padding: 16px; color: var(--text-sub); font-size: 13px; }
</style>
