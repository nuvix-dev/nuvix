import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'
import { config } from 'dotenv'
import path from 'path'
import { existsSync } from 'fs'

const localEnvPath = path.resolve(process.cwd(), '../../.env.test')
if (existsSync(localEnvPath)) {
  config({ path: localEnvPath, override: true })
} else {
  throw new Error('.env.test file is missing at ' + localEnvPath)
}

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['**/*.e2e-spec.ts'],
    setupFiles: ['./tests/setup/global.ts'],
  },
  plugins: [
    tsconfigPaths(),
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
})
