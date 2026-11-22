import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// 相对路径部署：GitHub Pages 子路径、任意静态托管、微信 H5 都能直接用
export default defineConfig({
  plugins: [react()],
  base: './',
});
