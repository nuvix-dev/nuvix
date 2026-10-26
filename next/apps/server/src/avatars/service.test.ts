import { describe, expect, it } from 'bun:test'
import { createAvatarService } from './service'

const service = createAvatarService()

describe('favicon SSRF hardening (network-hardening pass)', () => {
  it('rejects private/loopback hosts before any request', async () => {
    for (const url of [
      'http://localhost/favicon.ico',
      'http://127.0.0.1/favicon.ico',
      'http://169.254.169.254/latest/meta-data',
      'http://192.168.1.10/favicon.ico',
      'ftp://example.com/favicon.ico',
    ]) {
      await expect(service.favicon(url)).rejects.toThrow()
    }
  })

  it('rejects hostnames that resolve to private addresses (DNS-rebinding guard)', async () => {
    // `localhost` always resolves to loopback; the DNS validation layer
    // must catch it even if a future refactor drops the hostname regex.
    await expect(service.favicon('http://localhost:3000/favicon.ico')).rejects.toThrow()
  })

  it('rejects unparseable URLs with favicon_unavailable', async () => {
    await expect(service.favicon('not a url')).rejects.toMatchObject({
      fields: { code: 'favicon_unavailable' },
    })
  })
})
