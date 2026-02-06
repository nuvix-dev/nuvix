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
    include: ['tests/integration/**/*.spec.ts'],
    setupFiles: ['./tests/setup/global.ts'],
    maxWorkers: 1,
    env: process.env,
  },
  plugins: [
    tsconfigPaths(),
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
})
