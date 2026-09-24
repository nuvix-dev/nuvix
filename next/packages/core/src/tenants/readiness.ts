import { SQL } from 'bun'
import type { TenantTarget, WaitUntilReadyOptions } from './types'

/**
 * Polls a tenant target with a real `Bun.sql` connection until it accepts
 * queries, or throws once `timeoutMs` elapses. This is the ONLY readiness
 * signal provisioners use — never the container's own `HEALTHCHECK` status,
 * which reflects the postgres process, not whether Nuvix can actually reach it.
 */
export async function waitUntilPostgresReady(
  target: TenantTarget,
  options: WaitUntilReadyOptions = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 30_000
  const pollIntervalMs = options.pollIntervalMs ?? 250
  const deadline = Date.now() + timeoutMs
  let lastError: unknown

  while (Date.now() < deadline) {
    let sql: SQL | undefined
    try {
      sql = new SQL({
        hostname: target.host,
        port: target.port,
        database: target.database,
        username: target.user,
        password: target.password,
        max: 1,
        connectionTimeout: 2,
      })
      await sql`select 1`
      return
    } catch (error) {
      lastError = error
      await Bun.sleep(pollIntervalMs)
    } finally {
      await sql?.close()
    }
  }

  throw new Error(
    `Tenant at ${target.host}:${target.port}/${target.database} did not become ready within ${timeoutMs}ms: ${String(lastError)}`,
  )
}
