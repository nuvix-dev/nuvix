import { copy } from 'esbuild-plugin-copy'
import { defineConfig } from 'tsup'

export default defineConfig(options => {
  const isDev = !!options.watch

  return {
    entry: ['src/main.ts'],
    format: ['esm'],
    dts: false,
    sourcemap: isDev,
    clean: !isDev,
    outDir: isDev ? 'dist' : '../../dist/platform/build',
    noExternal: ['@nuvix/core', '@nuvix/utils', '@nuvix/pg-meta'],
    splitting: false,
    minify: !isDev,
    target: 'es2024',
    skipNodeModulesBundle: true,
    bundle: true,
    shims: false,
    tsconfig: './tsconfig.app.json',
    onSuccess: !isDev ? undefined : 'bun --watch dist/main.js',
    banner({ format }) {
      const envPaths: string[] = isDev
        ? ['../../.env', '../../.env.local']
        : ['.env', '.env.platform']
      return {
        js:
          format === 'esm'
            ? `import { config as __nxconfig } from 'dotenv';
import {default as __nxpath}  from 'path';
__nxconfig({
  path: [${envPaths.map(p => `__nxpath.resolve(process.cwd(), '${p}')`).join(',\n\t')}]
});`
            : `const __nxpath = require('path');
require('dotenv').config({
    path: [${envPaths.map(p => `__nxpath.resolve(process.cwd(), '${p}')`).join(',\n\t')}]
});`,
      }
    },
    esbuildPlugins: isDev
      ? []
      : [
          copy({
            assets: [
              {
                from: ['../../assets/**/*'],
                to: ['../assets'],
              },
              {
                from: ['../../docs/references/**/*'],
                to: ['../docs/references'],
              },
              {
                from: ['../../public/**/*'],
                to: ['../public'],
              },
              {
                from: ['../../LICENSE', '../../.env.example'],
                to: ['../'],
              },
              {
                from: ['../../README.md'],
                to: ['../README.md'],
              },
            ],
          }),
        ],
  }
})
