import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    open: false,
    host: true,
    watch: {
      ignored: ['**/public/assets/**', '**/.git/**', '**/scratch/**']
    }
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0
  }
});
