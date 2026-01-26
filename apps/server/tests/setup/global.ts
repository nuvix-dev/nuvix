import { beforeAll, afterAll } from 'vitest'
import { getApp, closeApp } from './app'

beforeAll(async () => {
  await getApp() // boot once globally
})

afterAll(async () => {
  await closeApp() // teardown once after all suites
})
