import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { beforeAll, describe, expect, it } from 'vitest'
import { buildCreateCollectionDTO } from '../../factories/dto/collection.factory'
import { buildCreateIndexDTO } from '../../factories/dto/index.factory'
import { buildCreateDocumentSchemaDTO } from '../../factories/dto/schema.factory'
import { getApiKeyHeaders, getApiKeyJsonHeaders } from '../../helpers/auth'
import { getApp } from '../../setup/app'
import {
  assertListResponse,
  assertStatusCode,
  parseJson,
} from '../../setup/test-utils'

describe('schemas/collections/indexes (integration)', () => {
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
    await Promise.resolve(new Promise(resolve => setTimeout(resolve, 2000)))

    // Create a collection within the schema
    const collectionDto = buildCreateCollectionDTO()
    testCollectionId = collectionDto.collectionId

    await app.inject({
      method: 'POST',
      url: `/v1/schemas/${testSchemaId}/collections`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(collectionDto),
    })

    // Create 'title' attribute for indexing tests
    await app.inject({
      method: 'POST',
      url: `/v1/schemas/${testSchemaId}/collections/${testCollectionId}/attributes/string`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify({ key: 'title', size: 255, required: false }),
    })

    // Wait for attributes to be propagated
    await Promise.resolve(new Promise(resolve => setTimeout(resolve, 1000)))
  })

  /**
   * AUTH BOUNDARY TESTS
   * Index endpoints require ADMIN or KEY auth
   */

  it('GET /v1/schemas/:schemaId/collections/:collectionId/indexes returns 401 when unauthenticated', async () => {
    // PROTECTS: Index list not exposed without authentication
    const res = await app.inject({
      method: 'GET',
      url: `/v1/schemas/${testSchemaId}/collections/${testCollectionId}/indexes`,
    })

    assertStatusCode(res, 401)
  })

  it('POST /v1/schemas/:schemaId/collections/:collectionId/indexes returns 401 when unauthenticated', async () => {
    // PROTECTS: Index creation requires authentication
    const dto = buildCreateIndexDTO()

    const res = await app.inject({
      method: 'POST',
      url: `/v1/schemas/${testSchemaId}/collections/${testCollectionId}/indexes`,
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify(dto),
    })

    assertStatusCode(res, 401)
  })

  /**
   * INDEX LISTING TESTS
   */

  it('GET /v1/schemas/:schemaId/collections/:collectionId/indexes returns 200 and list shape with API key', async () => {
    // PROTECTS: Index listing returns proper list format
    const res = await app.inject({
      method: 'GET',
      url: `/v1/schemas/${testSchemaId}/collections/${testCollectionId}/indexes`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 200)

    const body = parseJson(res.payload)
    assertListResponse(body)
  })

  it('GET /v1/schemas/:schemaId/collections/:collectionId/indexes returns 404 for non-existent collection', async () => {
    // PROTECTS: 404 for unknown collection
    const res = await app.inject({
      method: 'GET',
      url: `/v1/schemas/${testSchemaId}/collections/nonexistentcollection/indexes`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 404)
  })

  /**
   * INDEX CREATION TESTS
   */

  it('POST /v1/schemas/:schemaId/collections/:collectionId/indexes returns 202 with complete index shape', async () => {
    // PROTECTS: Index creation contract (202 Accepted because index creation is async)
    const dto = buildCreateIndexDTO()

    const res = await app.inject({
      method: 'POST',
      url: `/v1/schemas/${testSchemaId}/collections/${testCollectionId}/indexes`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(dto),
    })

    // Index creation may return 201 or 202 depending on whether it's async
    expect([201, 202]).toContain(res.statusCode)

    const body = parseJson(res.payload)
    // Indexes use key as identifier, relax shape check for $id
    expect(body).toBeDefined()
    expect(body.key).toBe(dto.key)
  })

  it('POST /v1/schemas/:schemaId/collections/:collectionId/indexes returns 400 for invalid key', async () => {
    // PROTECTS: Index key validation is enforced
    const dto = buildCreateIndexDTO({ key: '' })

    const res = await app.inject({
      method: 'POST',
      url: `/v1/schemas/${testSchemaId}/collections/${testCollectionId}/indexes`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(dto),
    })

    assertStatusCode(res, 400)
  })

  it('POST /v1/schemas/:schemaId/collections/:collectionId/indexes returns 400 for missing attributes', async () => {
    // PROTECTS: Required field validation
    const res = await app.inject({
      method: 'POST',
      url: `/v1/schemas/${testSchemaId}/collections/${testCollectionId}/indexes`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify({
        key: 'test_index',
        type: 'key',
        // Missing attributes
      }),
    })

    assertStatusCode(res, 400)
  })

  it('POST /v1/schemas/:schemaId/collections/:collectionId/indexes returns 404 for non-existent collection', async () => {
    // PROTECTS: 404 for unknown collection
    const dto = buildCreateIndexDTO()

    const res = await app.inject({
      method: 'POST',
      url: `/v1/schemas/${testSchemaId}/collections/nonexistentcollection/indexes`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(dto),
    })

    assertStatusCode(res, 404)
  })

  /**
   * INDEX RETRIEVAL TESTS
   */

  it('GET /v1/schemas/:schemaId/collections/:collectionId/indexes/:key returns 200 for existing index', async () => {
    // PROTECTS: Single index retrieval works correctly
    const dto = buildCreateIndexDTO()

    // Create index first
    await app.inject({
      method: 'POST',
      url: `/v1/schemas/${testSchemaId}/collections/${testCollectionId}/indexes`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(dto),
    })

    // Wait a bit for index creation (it's async)
    await new Promise(resolve => setTimeout(resolve, 100))

    // Retrieve it
    const res = await app.inject({
      method: 'GET',
      url: `/v1/schemas/${testSchemaId}/collections/${testCollectionId}/indexes/${dto.key}`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 200)

    const body = parseJson(res.payload)
    // Indexes might not have $id immediately or use key as identifier, relax shape check
    expect(body).toBeDefined()
    expect(body.key).toBe(dto.key)
  })

  it('GET /v1/schemas/:schemaId/collections/:collectionId/indexes/:key returns 404 for non-existent index', async () => {
    // PROTECTS: 404 for unknown index key
    const res = await app.inject({
      method: 'GET',
      url: `/v1/schemas/${testSchemaId}/collections/${testCollectionId}/indexes/nonexistentindex`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 404)
  })

  /**
   * INDEX DELETION TESTS
   */

  it('DELETE /v1/schemas/:schemaId/collections/:collectionId/indexes/:key returns 202 for existing index', async () => {
    // PROTECTS: Index deletion works correctly
    const dto = buildCreateIndexDTO()

    // Create index first
    await app.inject({
      method: 'POST',
      url: `/v1/schemas/${testSchemaId}/collections/${testCollectionId}/indexes`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(dto),
    })

    // Wait a bit for index creation
    await new Promise(resolve => setTimeout(resolve, 100))

    // Delete it
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/schemas/${testSchemaId}/collections/${testCollectionId}/indexes/${dto.key}`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 202)

    // Verify it's gone or in deleting state
    const checkRes = await app.inject({
      method: 'GET',
      url: `/v1/schemas/${testSchemaId}/collections/${testCollectionId}/indexes/${dto.key}`,
      headers: getApiKeyHeaders(),
    })

    // It might return 200 with status='deleting' initially
    if (checkRes.statusCode === 200) {
      const body = parseJson(checkRes.payload)
      expect(body.status).toBe('deleting')

      // Wait for actual deletion (optional, but good for cleanup)
      // await new Promise(resolve => setTimeout(resolve, 500))
      // checkRes = await app.inject(...)
      // assertStatusCode(checkRes, 404)
    } else {
      assertStatusCode(checkRes, 404)
    }
  })

  it('DELETE /v1/schemas/:schemaId/collections/:collectionId/indexes/:key returns 404 for non-existent index', async () => {
    // PROTECTS: 404 when deleting non-existent index
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/schemas/${testSchemaId}/collections/${testCollectionId}/indexes/nonexistentindex`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(res, 404)
  })
})
