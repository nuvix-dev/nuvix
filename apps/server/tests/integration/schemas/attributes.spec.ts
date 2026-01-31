import { describe, it, expect, beforeAll } from 'vitest'
import { getApp } from '../../setup/app'
import { getApiKeyJsonHeaders, getApiKeyHeaders } from '../../helpers/auth'
import { buildCreateDocumentSchemaDTO } from '../../factories/dto/schema.factory'
import { buildCreateCollectionDTO } from '../../factories/dto/collection.factory'
import {
  parseJson,
  assertStatusCode,
  assertDocumentShape,
  assertListResponse,
} from '../../setup/test-utils'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'

describe('schemas/collections/attributes (integration)', () => {
  let app: NestFastifyApplication
  let testSchemaId: string
  let testCollectionId: string

  beforeAll(async () => {
    app = await getApp()

    // Create a document schema
    const schemaDto = buildCreateDocumentSchemaDTO()
    testSchemaId = schemaDto.name

    await app.inject({
      method: 'POST',
      url: '/v1/database/schemas',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(schemaDto),
    })

    // Wait for schema creation
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Create a collection within the schema
    const collectionDto = buildCreateCollectionDTO()
    testCollectionId = collectionDto.collectionId

    await app.inject({
      method: 'POST',
      url: `/v1/schemas/${testSchemaId}/collections`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(collectionDto),
    })
  })

  const waitForAttribute = async (
    key: string,
    status: 'available' | 'stuck' = 'available',
  ) => {
    let attempts = 0
    while (attempts < 20) {
      const res = await app.inject({
        method: 'GET',
        url: `/v1/schemas/${testSchemaId}/collections/${testCollectionId}/attributes/${key}`,
        headers: getApiKeyHeaders(),
      })

      if (res.statusCode === 200) {
        const body = parseJson(res.payload)
        if (body.status === 'available') return true
        if (body.status === 'failed')
          throw new Error(`Attribute ${key} creation failed`)
      }

      await new Promise(resolve => setTimeout(resolve, 500))
      attempts++
    }
    if (status === 'available') {
      console.warn(`Timeout waiting for attribute ${key} to be available`)
    }
    return false
  }

  /**
   * ATTRIBUTE CREATION TESTS (High Effort)
   */

  it('POST .../attributes/string creates a string attribute', async () => {
    const key = 'attr_string'
    const res = await app.inject({
      method: 'POST',
      url: `/v1/schemas/${testSchemaId}/collections/${testCollectionId}/attributes/string`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify({
        key,
        size: 255,
        required: false,
        default: 'test',
      }),
    })

    assertStatusCode(res, 201)
    const body = parseJson(res.payload)
    assertDocumentShape(body)
    expect(body.key).toBe(key)
    expect(body.type).toBe('string')
    expect(body.size).toBe(255)
    expect(body.required).toBe(false)

    await waitForAttribute(key)
  })

  it('POST .../attributes/integer creates an integer attribute', async () => {
    const key = 'attr_int'
    const res = await app.inject({
      method: 'POST',
      url: `/v1/schemas/${testSchemaId}/collections/${testCollectionId}/attributes/integer`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify({
        key,
        required: false,
        min: 0,
        max: 100,
        default: 10,
      }),
    })

    assertStatusCode(res, 201)
    const body = parseJson(res.payload)
    expect(body.key).toBe(key)
    expect(body.type).toBe('integer')
    expect(body.min).toBe(0)
    expect(body.max).toBe(100)

    await waitForAttribute(key)
  })

  it('POST .../attributes/boolean creates a boolean attribute', async () => {
    const key = 'attr_bool'
    const res = await app.inject({
      method: 'POST',
      url: `/v1/schemas/${testSchemaId}/collections/${testCollectionId}/attributes/boolean`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify({
        key,
        required: true,
      }),
    })

    assertStatusCode(res, 201)
    const body = parseJson(res.payload)
    expect(body.key).toBe(key)
    expect(body.type).toBe('boolean')

    await waitForAttribute(key)
  })

  it('POST .../attributes/email creates an email attribute', async () => {
    const key = 'attr_email'
    const res = await app.inject({
      method: 'POST',
      url: `/v1/schemas/${testSchemaId}/collections/${testCollectionId}/attributes/email`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify({
        key,
        required: false,
      }),
    })

    assertStatusCode(res, 201)
    const body = parseJson(res.payload)
    expect(body.key).toBe(key)
    expect(body.format).toBe('email')

    await waitForAttribute(key)
  })

  it('POST .../attributes/url creates a url attribute', async () => {
    const key = 'attr_url'
    const res = await app.inject({
      method: 'POST',
      url: `/v1/schemas/${testSchemaId}/collections/${testCollectionId}/attributes/url`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify({
        key,
        required: false,
      }),
    })

    assertStatusCode(res, 201)
    const body = parseJson(res.payload)
    expect(body.key).toBe(key)
    expect(body.format).toBe('url')

    await waitForAttribute(key)
  })

  it('POST .../attributes/ip creates an ip attribute', async () => {
    const key = 'attr_ip'
    const res = await app.inject({
      method: 'POST',
      url: `/v1/schemas/${testSchemaId}/collections/${testCollectionId}/attributes/ip`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify({
        key,
        required: false,
      }),
    })

    assertStatusCode(res, 201)
    const body = parseJson(res.payload)
    expect(body.key).toBe(key)
    expect(body.format).toBe('ip')

    await waitForAttribute(key)
  })

  it('POST .../attributes/enum creates an enum attribute', async () => {
    const key = 'attr_enum'
    const res = await app.inject({
      method: 'POST',
      url: `/v1/schemas/${testSchemaId}/collections/${testCollectionId}/attributes/enum`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify({
        key,
        elements: ['one', 'two', 'three'],
      }),
    })

    assertStatusCode(res, 201)
    const body = parseJson(res.payload)
    expect(body.key).toBe(key)
    expect(body.format).toBe('enum')
    expect(body.elements).toEqual(['one', 'two', 'three'])

    await waitForAttribute(key)
  })

  /**
   * ATTRIBUTE VALIDATION TESTS
   */

  it('POST .../attributes/string returns 400 for missing size', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/schemas/${testSchemaId}/collections/${testCollectionId}/attributes/string`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify({
        key: 'invalid_string',
        required: false,
        // size missing
      }),
    })

    assertStatusCode(res, 400)
  })

  it('POST .../attributes/string returns 400 for invalid key', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/schemas/${testSchemaId}/collections/${testCollectionId}/attributes/string`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify({
        key: 'invalid key@!',
        size: 10,
        required: false,
      }),
    })

    assertStatusCode(res, 400)
  })

  /**
   * ATTRIBUTE LISTING & RETRIEVAL
   */

  it('GET .../attributes returns 200 and lists all attributes', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/schemas/${testSchemaId}/collections/${testCollectionId}/attributes`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 200)
    const body = parseJson(res.payload)
    assertListResponse(body)
    expect(body.total).toBeGreaterThanOrEqual(5)
    expect(body.data.find((a: any) => a.key === 'attr_string')).toBeDefined()
  })

  it('GET .../attributes/:key returns 200 for existing attribute', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/schemas/${testSchemaId}/collections/${testCollectionId}/attributes/attr_string`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 200)
    const body = parseJson(res.payload)
    expect(body.key).toBe('attr_string')
  })

  /**
   * ATTRIBUTE UPDATE
   */

  it('PATCH .../attributes/string/:key updates attribute properties', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/schemas/${testSchemaId}/collections/${testCollectionId}/attributes/string/attr_string`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify({
        required: false,
        default: 'updated_default',
        size: 255, // Required by validation apparently
      }),
    })

    assertStatusCode(res, 200)
    const body = parseJson(res.payload)
    expect(body.required).toBe(false)
    expect(body.default).toBe('updated_default')
  })

  /**
   * ATTRIBUTE DELETION
   */

  it('DELETE .../attributes/:key returns 204 and deletes attribute', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/schemas/${testSchemaId}/collections/${testCollectionId}/attributes/attr_string`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 204)

    // Verify gone
    const checkRes = await app.inject({
      method: 'GET',
      url: `/v1/schemas/${testSchemaId}/collections/${testCollectionId}/attributes/attr_string`,
      headers: getApiKeyHeaders(),
    })

    // Deletion is async, so it might return 200 with status 'deleting' or 404
    if (checkRes.statusCode === 200) {
      const body = parseJson(checkRes.payload)
      expect(body.status).toBe('deleting')
    } else {
      assertStatusCode(checkRes, 404)
    }
  })
})
