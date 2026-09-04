import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background.ts')
      },
      output: {
        entryFileNames: 'background.js',
        codeSplitting: false
      }
    }
  }
});
