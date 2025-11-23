import { defineConfig } from 'vite';
import path from 'node:path';
import checker from 'vite-plugin-checker';
import pkg from './package.json';

const dependencies = Object.keys(pkg.dependencies);
const globals: Record<string, string> = {};
for (let i = 0; i < dependencies.length; i += 1) {
  globals[dependencies[i]] = dependencies[i];
}

export default defineConfig({
  build: {
    lib: {
      entry: ['./src/index.ts', './src/bin.ts'],
      name: 'ExtractTypings',
    },
    rolldownOptions: {
      external: [
        'fs',
        'path',
        ...dependencies,
      ],
      output: {
        globals: {
          fs: 'fs',
          path: 'path',
          ...globals,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '~': __dirname,
    },
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
