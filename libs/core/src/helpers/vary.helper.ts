const validFieldnameRE = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/

function validateFieldname(fieldname: string) {
  if (!validFieldnameRE.test(fieldname)) {
    throw new TypeError('Fieldname contains invalid characters.')
  }
}

function parse(header: string): string[] {
  const trimmed = header.trim().toLowerCase()
  if (!trimmed) return []
  return trimmed.split(/\s*,\s*/).filter(Boolean)
}

export function createAddFieldnameToVary(fieldname: string) {
  validateFieldname(fieldname)
  const fieldLower = fieldname.toLowerCase()

  return (reply: NuvixRes) => {
    const existingRaw = reply.getHeader('Vary')
    const existing = Array.isArray(existingRaw)
      ? existingRaw.join(', ')
      : (existingRaw?.toString() ?? '')

    const values = new Set(parse(existing))

    if (values.has('*')) return

    if (fieldLower === '*') {
      reply.raw.setHeader('Vary', '*')
      return
    }

    values.add(fieldLower)

    reply.raw.setHeader('Vary', [...values].join(', '))
  }
}

export const addOriginToVaryHeader = createAddFieldnameToVary('Origin')
export const addAccessControlRequestHeadersToVaryHeader =
  createAddFieldnameToVary('Access-Control-Request-Headers')
