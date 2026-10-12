<script setup>
import { computed } from 'vue';
const props = defineProps({ field: Object, modelValue: [String, Boolean, Number], provinces: { type: Array, default: () => [] } });
const emit = defineEmits(['update:modelValue']);
const value = computed(() => props.modelValue ?? '');
const province = computed(() => props.provinces.find(p => String(value.value).startsWith(p.name)));
function pickProvince(e) { emit('update:modelValue', e.target.value); }
function pickCity(e) { emit('update:modelValue', [province.value?.name, e.target.value].filter(Boolean).join(' / ')); }
</script>
<template>
  <label class="resume-field" :class="{ wide: field.type === 'textarea' || field.type === 'address' }">
    <span>{{ field.label }} <small v-if="field.type === 'bool'">可不勾选</small></span>
    <textarea v-if="field.type === 'textarea'" :value="value" rows="4" :maxlength="field.maxLength" :placeholder="field.hint || '选填'" @input="emit('update:modelValue', $event.target.value)" />
    <select v-else-if="field.type === 'select'" :value="value" @change="emit('update:modelValue', $event.target.value)">
      <option value="">请选择（选填）</option>
      <option v-if="value && !field.options.includes(value)" :value="value">{{ value }}（已有值）</option>
      <option v-for="o in field.options" :key="o" :value="o">{{ o }}</option>
    </select>
    <input v-else-if="field.type === 'bool'" type="checkbox" :checked="value === true" @change="emit('update:modelValue', $event.target.checked)" />
    <div v-else-if="field.type === 'address'" class="address-input">
      <div class="address-selects">
        <select aria-label="省份" :value="province?.name || ''" @change="pickProvince"><option value="">选择省份</option><option v-for="p in provinces" :key="p.name">{{ p.name }}</option></select>
        <select aria-label="城市" :disabled="!province" :value="String(value).split(' / ')[1] || ''" @change="pickCity"><option value="">选择城市</option><option v-for="city in province?.cities || []" :key="city">{{ city }}</option></select>
      </div>
      <input :value="value" :maxlength="field.maxLength" placeholder="也可直接填写省、市、区及详细地址" @input="emit('update:modelValue', $event.target.value)" />
    </div>
    <input v-else :type="field.type === 'date' ? 'date' : 'text'" :value="value" :maxlength="field.maxLength" :placeholder="field.hint || '选填'" @input="emit('update:modelValue', $event.target.value)" />
    <small v-if="field.hint">{{ field.hint }}</small>
  </label>
</template>
<style scoped>
.resume-field{display:flex;flex-direction:column;gap:8px;font-size:13px;color:#334155;min-width:0}.resume-field.wide{grid-column:1/-1}.resume-field>span{font-weight:600}.resume-field input:not([type=checkbox]),.resume-field select,.resume-field textarea{width:100%;box-sizing:border-box;background:#f7f9fc;border:1px solid #e3e8ef;border-radius:10px;min-height:40px;padding:10px 12px;color:#182334;font:inherit;outline:none}.resume-field input:focus,.resume-field select:focus,.resume-field textarea:focus{border-color:#165dff;background:#fff;box-shadow:0 0 0 3px #165dff12}.resume-field textarea{resize:vertical;line-height:1.7}.resume-field small{font-size:11px;color:#8c98aa;font-weight:400}.resume-field input[type=checkbox]{align-self:flex-start;width:18px;height:18px;accent-color:#165dff}.address-selects{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:8px}
</style>
