import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: '../../dist/glasses',
    emptyOutDir: true,
    rollupOptions: {
      onwarn(warning, warn) {
        // Toolkit framework directives are unnecessary in this client-only app.
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE' && warning.message.includes('use client')) return;
        warn(warning);
      },
    },
  },
});
