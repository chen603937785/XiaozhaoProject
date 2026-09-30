import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

const nativeStub = fileURLToPath(new URL('./src/native-stubs.js', import.meta.url));

export default defineConfig({
  // 网页部署在域名根路径；/api、/admin、/downloads 由服务器单独处理。
  base: '/',
  define: { 'import.meta.env.VITE_CAMPUS_WEB': JSON.stringify('true') },
  plugins: [vue()],
  resolve: {
    dedupe: ['vue'],
    alias: {
      '@tauri-apps/api/core': nativeStub,
      '@tauri-apps/api/app': nativeStub
    }
  },
  server: {
    port: 1421,
    proxy: {
      '/api': { target: 'https://my88ai.com', changeOrigin: true }
    }
  },
  build: { outDir: 'dist' }
});
