import { defineConfig } from 'vite';
import checker from 'vite-plugin-checker';

export default defineConfig({
  build: {
    lib: {
      entry: './src/index.ts',
      name: 'ExtractTypings',
      fileName: 'extract-typings',
    },
    rolldownOptions: {
      external: [
        'typescript',
        'fs',
        'path',
      ]
    }
  },
  plugins: [
    checker({
      typescript: true,
      eslint: {
        lintCommand: 'eslint --ext .ts,.tsx ./src'
      }
    }),
  ],
});
