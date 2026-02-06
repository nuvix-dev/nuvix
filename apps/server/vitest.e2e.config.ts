import { existsSync } from 'node:fs'
import path from 'node:path'
import { config } from 'dotenv'
import swc from 'unplugin-swc'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

const localEnvPath = path.resolve(process.cwd(), '../../.env.test')
if (existsSync(localEnvPath)) {
  config({ path: localEnvPath, override: true })
} else {
  throw new Error(`.env.test file is missing at ${localEnvPath}`)
}

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['**/*.e2e-spec.ts', '**/*.e2e.spec.ts'],
    setupFiles: ['./tests/setup/global.ts'],
    maxConcurrency: 1,
    isolate: true,
    maxWorkers: 1,
  },
  plugins: [
    tsconfigPaths(),
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
})
