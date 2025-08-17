import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main.ts'],
  format: ['cjs', 'esm'],
  dts: false,
  sourcemap: true,
  clean: true,
  outDir: '../../dist/platform',
  noExternal: [],
  splitting: false,
  minify: false,
  target: 'es2024',
  skipNodeModulesBundle: true,
  shims: true,
  tsconfig: './tsconfig.app.json',
});
