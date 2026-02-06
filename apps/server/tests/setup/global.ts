import { afterAll, beforeAll } from 'vitest'
import { closeApp, getApp } from './app'

beforeAll(async () => {
  await getApp() // boot once globally
})

afterAll(async () => {
  await closeApp() // teardown once after all suites
})
