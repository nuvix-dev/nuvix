import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: '../../dist/core',
  noExternal: [],
  splitting: false,
  minify: false,
  target: 'es2024',
  shims: true,
  skipNodeModulesBundle: true,
  tsconfig: './tsconfig.lib.json',
});
