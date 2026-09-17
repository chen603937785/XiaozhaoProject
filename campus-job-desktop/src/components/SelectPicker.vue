<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  modelValue: { type: String, default: '' },
  options: { type: Array, default: () => [] }, // [{ value, label }]
  placeholder: { type: String, default: '请选择' }
});
const emit = defineEmits(['update:modelValue']);

const show = ref(false);
const pos = ref({ x: 0, y: 0 });

const displayLabel = computed(() => {
  const opt = props.options.find(o => o.value === props.modelValue);
  return opt ? opt.label : props.placeholder;
});

function toggle(event) {
  if (!show.value) {
    const rect = event.currentTarget.getBoundingClientRect();
    let x = rect.left;
    let y = rect.bottom + 4;
    if (y + props.options.length * 36 + 16 > window.innerHeight) {
      y = rect.top - 4 - (props.options.length * 36 + 16);
    }
    if (y < 4) y = 4;
    pos.value = { x, y };
  }
  show.value = !show.value;
}

function select(o) {
  emit('update:modelValue', o.value);
  show.value = false;
}
</script>

<template>
  <div class="select-picker">
    <div class="sp-trigger" :class="{ empty: !modelValue }" @click="toggle">
      <span class="sp-text">{{ displayLabel }}</span>
      <span class="sp-arrow">▾</span>
    </div>
    <div v-if="show" class="sp-overlay" @click="show = false"></div>
    <div v-if="show" class="sp-panel" :style="{ left: pos.x + 'px', top: pos.y + 'px' }" @click.stop>
      <div
        v-for="o in options"
        :key="o.value"
        class="sp-item"
        :class="{ on: o.value === modelValue }"
        @click="select(o)"
      >
        {{ o.label }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.select-picker { position: relative; }
.sp-trigger {
  display: inline-flex; align-items: center; justify-content: space-between; gap: 6px;
  height: 34px; padding: 0 10px; border: 1px solid #dce7f4; border-radius: 8px;
  background: #fff; font-size: 13px; color: #17304f; cursor: pointer; min-width: 90px; width: 100%;
}
.sp-trigger:hover { border-color: #4b87e5; }
.sp-trigger.empty .sp-text { color: #96a8bd; }
.sp-text { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sp-arrow { font-size: 12px; color: #96a8bd; }
.sp-overlay { position: fixed; inset: 0; z-index: 9997; }
.sp-panel {
  position: fixed; z-index: 9998;
  background: #fff; border: 1px solid #dce7f4; border-radius: 10px;
  box-shadow: 0 8px 20px rgba(30, 53, 87, 0.14); padding: 4px; min-width: 120px;
}
.sp-item { padding: 8px 12px; border-radius: 6px; font-size: 13px; color: #617895; cursor: pointer; white-space: nowrap; }
.sp-item:hover { background: #f0f5ff; color: #4b87e5; }
.sp-item.on { background: #eaf2ff; color: #4b87e5; font-weight: 600; }
</style>
