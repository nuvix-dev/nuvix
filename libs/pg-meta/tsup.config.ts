import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false,
  sourcemap: true,
  clean: true,
  outDir: '../../dist/pg-meta',
  noExternal: [],
  splitting: false,
  minify: false,
  target: 'es2024',
  shims: true,
  skipNodeModulesBundle: true,
  tsconfig: './tsconfig.lib.json',
});
