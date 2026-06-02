import { defineConfig } from 'vite';
import path from 'node:path';
import checker from 'vite-plugin-checker';
import pkg from './package.json';

const dependencies = Object.keys(pkg.dependencies);
const ignoredDependencies = new Set(['chalk', 'ora']);

const externals = ['node:fs', 'node:path', 'node:process', 'node:util'];
for (let i = 0; i < dependencies.length; i += 1) {
  if (ignoredDependencies.has(dependencies[i])) {
    continue;
  }
  externals.push(dependencies[i]);
}

export default defineConfig({
  build: {
    lib: {
      entry: ['./src/index.ts', './src/bin.ts'],
      name: 'ExtractTypings',
    },
    rolldownOptions: {
      external: externals,
    },
    minify: false,
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
      oxlint: true,
    }),
  ],
});
