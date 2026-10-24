/**
 * Request client-IP extraction — proxy-aware (v1 parity): the
 * `x-forwarded-for` header wins (first hop), else the socket address.
 * Elysia beta.6 does not auto-populate a client IP (Phase 1 note).
 */
export function requestIp(
  request: Request,
  server?: { requestIP(request: Request): unknown } | null,
): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (forwarded) return forwarded
  const address = server?.requestIP(request)
  if (address && typeof address === 'object' && 'address' in address) {
    return String((address as { address: string }).address)
  }
  if (typeof address === 'string') return address
  return ''
}

/** Caller user-agent (legacy recorded 'UNKNOWN' when absent). */
export function requestUserAgent(request: Request): string {
  return request.headers.get('user-agent') || 'UNKNOWN'
}
