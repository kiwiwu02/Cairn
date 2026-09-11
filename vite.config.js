import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  optimizeDeps: {
    // 依赖升级后强制重新生成预构建缓存，避免 API 与 Worker 使用旧/新版本混合。
    force: true,
  },
});
