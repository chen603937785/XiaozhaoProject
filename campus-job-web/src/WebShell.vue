<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import DesktopApp from '../../campus-job-desktop/src/App.vue';
import MobileApp from './MobileApp.vue';

const mobileQuery = window.matchMedia('(max-width: 900px)');
const mobile = ref(mobileQuery.matches);
function sync() { mobile.value = mobileQuery.matches; }

onMounted(() => mobileQuery.addEventListener('change', sync));
onBeforeUnmount(() => mobileQuery.removeEventListener('change', sync));
</script>

<template>
  <MobileApp v-if="mobile" />
  <DesktopApp v-else />
</template>
