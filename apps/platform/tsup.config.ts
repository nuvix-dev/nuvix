import { defineConfig } from 'tsup'

export default defineConfig(options => {
  return {
    entry: ['src/main.ts'],
    format: ['cjs', 'esm'],
    dts: false,
    sourcemap: true,
    clean: !!!options.watch,
    outDir: 'output/dist',
    noExternal: [],
    splitting: false,
    minify: false,
    target: 'es2024',
    skipNodeModulesBundle: true,
    shims: true,
    tsconfig: './tsconfig.app.json',
    plugins: [],
  }
})
