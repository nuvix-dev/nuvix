/** Unit tests for the outbound URL SSRF guard (literal, hostname, and DNS checks). */
import { describe, expect, test } from 'bun:test'
import { inspectOutboundUrl, isBlockedAddress, validateOutboundUrl } from './url-safety'

describe('inspectOutboundUrl', () => {
  test('accepts ordinary http(s) URLs', () => {
    expect(inspectOutboundUrl('https://example.com/hooks/deploy')).toEqual({ ok: true })
    expect(inspectOutboundUrl('http://example.com:8080/hook')).toEqual({ ok: true })
  })

  test('accepts public IP literals', () => {
    expect(inspectOutboundUrl('https://93.184.216.34/hook')).toEqual({ ok: true })
    expect(inspectOutboundUrl('https://[2606:4700:4700::1111]/hook')).toEqual({ ok: true })
  })

  test('rejects non-http(s) schemes', () => {
    for (const url of [
      'ftp://example.com/hook',
      'file:///etc/passwd',
      'gopher://example.com/',
      'javascript:alert(1)',
    ]) {
      expect(inspectOutboundUrl(url).ok).toBe(false)
    }
  })

  test('rejects malformed and relative URLs', () => {
    for (const url of ['', 'not a url', '/relative/hook', 'example.com/hook']) {
      expect(inspectOutboundUrl(url).ok).toBe(false)
    }
  })

  test('rejects embedded credentials', () => {
    expect(inspectOutboundUrl('https://user:pass@example.com/hook').ok).toBe(false)
  })

  test('rejects internal IPv4 literals, including obfuscated forms', () => {
    for (const url of [
      'http://127.0.0.1/hook',
      'http://127.0.0.53/hook',
      'http://10.1.2.3/hook',
      'http://172.16.0.1/hook',
      'http://192.168.1.1/hook',
      'http://169.254.169.254/latest/meta-data',
      'http://100.64.0.1/hook',
      'http://0.0.0.0/hook',
      // WHATWG URL normalization collapses these to 127.0.0.1.
      'http://2130706433/hook',
      'http://0x7f.1/hook',
    ]) {
      expect(inspectOutboundUrl(url).ok).toBe(false)
    }
  })

  test('rejects internal IPv6 literals', () => {
    for (const url of [
      'http://[::1]/hook',
      'http://[::]/hook',
      'http://[fd00::1]/hook',
      'http://[fe80::1]/hook',
      'http://[::ffff:127.0.0.1]/hook',
    ]) {
      expect(inspectOutboundUrl(url).ok).toBe(false)
    }
  })

  test('rejects internal hostnames without DNS', () => {
    for (const url of [
      'http://localhost/hook',
      'http://api.localhost/hook',
      'http://metadata.google.internal/computeMetadata/v1',
      'http://metadata.goog/hook',
      'http://service.internal/hook',
      'http://printer.local/hook',
      'http://router.home.arpa/hook',
    ]) {
      expect(inspectOutboundUrl(url).ok).toBe(false)
    }
  })
})

describe('validateOutboundUrl', () => {
  const resolveTo = (addresses: string[]) => async () => addresses

  test('accepts a hostname that resolves only to public addresses', async () => {
    const check = await validateOutboundUrl('https://hooks.example.com/x', {
      resolve: resolveTo(['93.184.216.34', '2606:2800:220:1:248:1893:25c8:1946']),
    })
    expect(check).toEqual({ ok: true })
  })

  test('rejects a hostname that resolves to a private address', async () => {
    const check = await validateOutboundUrl('https://hooks.example.com/x', {
      resolve: resolveTo(['10.0.0.7']),
    })
    expect(check.ok).toBe(false)
  })

  test('rejects when any resolved address is internal', async () => {
    const check = await validateOutboundUrl('https://hooks.example.com/x', {
      resolve: resolveTo(['93.184.216.34', '127.0.0.1']),
    })
    expect(check.ok).toBe(false)
  })

  test('rejects an IPv6 unique-local resolution', async () => {
    const check = await validateOutboundUrl('https://hooks.example.com/x', {
      resolve: resolveTo(['fd12:3456::1']),
    })
    expect(check.ok).toBe(false)
  })

  test('fails closed on resolution errors and empty answers', async () => {
    const failure = await validateOutboundUrl('https://hooks.example.com/x', {
      resolve: async () => {
        throw new Error('ENOTFOUND')
      },
    })
    expect(failure.ok).toBe(false)

    const empty = await validateOutboundUrl('https://hooks.example.com/x', {
      resolve: resolveTo([]),
    })
    expect(empty.ok).toBe(false)
  })

  test('does not resolve literal addresses again', async () => {
    let called = false
    const check = await validateOutboundUrl('https://93.184.216.34/x', {
      resolve: async () => {
        called = true
        return []
      },
    })
    expect(check).toEqual({ ok: true })
    expect(called).toBe(false)
  })

  test('propagates the synchronous inspection result', async () => {
    const check = await validateOutboundUrl('http://169.254.169.254/x', {
      resolve: resolveTo(['93.184.216.34']),
    })
    expect(check.ok).toBe(false)
  })
})

describe('isBlockedAddress', () => {
  test('blocks non-IP input as a failure case', () => {
    expect(isBlockedAddress('example.com')).toBe(true)
  })

  test('classifies representative addresses', () => {
    expect(isBlockedAddress('127.0.0.1')).toBe(true)
    expect(isBlockedAddress('8.8.8.8')).toBe(false)
    expect(isBlockedAddress('::1')).toBe(true)
    expect(isBlockedAddress('::ffff:8.8.8.8')).toBe(true)
    expect(isBlockedAddress('2606:4700:4700::1111')).toBe(false)
  })
})
