import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/query/index.ts',
    'src/database/index.js',
    'src/collections/index.ts',
    'src/auth/index.ts',
  ],
  format: ['cjs', 'esm'],
  dts: false,
  sourcemap: true,
  clean: true,
  outDir: '../../dist/utils',
  noExternal: [],
  splitting: false,
  minify: false,
  target: 'es2023',
  shims: true,
  bundle: false,
  skipNodeModulesBundle: true,
  tsconfig: './tsconfig.lib.json',
});
