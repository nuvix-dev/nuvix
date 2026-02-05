/**
 * E2E Test: Data Management Flow
 *
 * This test covers the complete data management journey:
 * 1. Authenticate with API key
 * 2. Create a database schema
 * 3. Create documents within the schema
 * 4. Query documents with filters
 * 5. Update documents
 * 6. Delete documents
 *
 * This flow represents how applications interact with the database service.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { getApp } from '../setup/app'
import { getApiKeyJsonHeaders, getApiKeyHeaders } from '../helpers/auth'
import {
  buildCreateSchemaDTO,
  buildCreateDocumentSchemaDTO,
} from '../factories/dto/schema.factory'
import {
  parseJson,
  assertStatusCode,
  assertDocumentShape,
  assertListResponse,
} from '../setup/test-utils'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { faker } from '@faker-js/faker'
import QueryString from 'qs'
import { Query } from '@nuvix/db'

describe('E2E: Data Management Flow', () => {
  let app: NestFastifyApplication

  beforeAll(async () => {
    app = await getApp()
  })

  const waitForAttribute = async (
    key: string,
    status: 'available' | 'stuck' = 'available',
    testSchemaId: string,
    testCollectionId: string,
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

  it('completes the full managed schema CRUD flow', async () => {
    // =========================================================================
    // STEP 1: Create a managed database schema
    // This represents creating a new table/collection in the database
    // =========================================================================
    const schemaDto = buildCreateSchemaDTO()

    const createSchemaRes = await app.inject({
      method: 'POST',
      url: '/v1/database/schemas',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(schemaDto),
    })

    assertStatusCode(createSchemaRes, 202)
    const createdSchema = parseJson(createSchemaRes.payload)

    // Verify schema was created with correct properties
    expect(createdSchema.name).toBe(schemaDto.name)
    expect(createdSchema.type).toBe('managed')
    expect(createdSchema.description).toBe(schemaDto.description)

    const schemaName = createdSchema.name

    // =========================================================================
    // STEP 2: Retrieve the schema to verify it exists
    // =========================================================================
    const getSchemaRes = await app.inject({
      method: 'GET',
      url: `/v1/database/schemas/${schemaName}`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(getSchemaRes, 200)
    const fetchedSchema = parseJson(getSchemaRes.payload)
    expect(fetchedSchema.name).toBe(schemaName)

    // =========================================================================
    // STEP 3: List all schemas and verify our schema appears
    // =========================================================================
    const listSchemasRes = await app.inject({
      method: 'GET',
      url: '/v1/database/schemas',
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(listSchemasRes, 200)
    const schemasList = parseJson(listSchemasRes.payload)
    assertListResponse(schemasList)

    const foundSchema = (schemasList.data as any[]).find(
      s => s.name === schemaName,
    )
    expect(foundSchema).toBeDefined()

    // =========================================================================
    // STEP 4: List schemas filtered by type
    // =========================================================================
    const filteredSchemasRes = await app.inject({
      method: 'GET',
      url: '/v1/database/schemas?type=managed',
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(filteredSchemasRes, 200)
    const filteredSchemas = parseJson(filteredSchemasRes.payload)
    assertListResponse(filteredSchemas)

    // All returned schemas should be managed type
    for (const schema of filteredSchemas.data as any[]) {
      expect(schema.type).toBe('managed')
    }
  })

  it('completes the full document schema CRUD flow', async () => {
    // =========================================================================
    // STEP 1: Create a document-type schema
    // Document schemas are for NoSQL-like document storage
    // =========================================================================
    const schemaDto = buildCreateDocumentSchemaDTO()

    const createSchemaRes = await app.inject({
      method: 'POST',
      url: '/v1/database/schemas',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(schemaDto),
    })

    assertStatusCode(createSchemaRes, 202)
    const createdSchema = parseJson(createSchemaRes.payload)

    expect(createdSchema.name).toBe(schemaDto.name)
    expect(createdSchema.type).toBe('document')

    const schemaName = createdSchema.name
    // Wait for schema to be fully provisioned
    await new Promise(resolve => setTimeout(resolve, 1500))

    // =========================================================================
    // STEP 2: Create a collection within the document schema
    // Collections organize documents within a schema
    // =========================================================================
    const collectionName = 'products_' + faker.string.alphanumeric(6)

    const createCollectionRes = await app.inject({
      method: 'POST',
      url: `/v1/schemas/${schemaName}/collections`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify({
        collectionId: collectionName,
        name: 'Products Collection',
        permissions: ['read("any")', 'create("any")'],
        documentSecurity: false,
      }),
    })

    assertStatusCode(createCollectionRes, 201)
    const createdCollection = parseJson(createCollectionRes.payload)
    assertDocumentShape(createdCollection)

    expect(createdCollection.$id).toBe(collectionName)
    expect(createdCollection.name).toBe('Products Collection')

    // =========================================================================
    // STEP 3: Add attributes to the collection
    // Define the structure of documents in this collection
    // =========================================================================
    const stringAttrRes = await app.inject({
      method: 'POST',
      url: `/v1/schemas/${schemaName}/collections/${collectionName}/attributes/string`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify({
        key: 'title',
        required: true,
        size: 255,
        array: false,
      }),
    })

    assertStatusCode(stringAttrRes, 202)
    const strAttr = await waitForAttribute(
      'title',
      'available',
      schemaName,
      collectionName,
    )
    if (!strAttr) {
      throw new Error('Attribute "title" failed to become available in time')
    }

    const integerAttrRes = await app.inject({
      method: 'POST',
      url: `/v1/schemas/${schemaName}/collections/${collectionName}/attributes/integer`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify({
        key: 'price',
        required: true,
        min: 0,
        max: 999999,
        array: false,
        default: null,
      }),
    })

    assertStatusCode(integerAttrRes, 202)
    const intAttr = await waitForAttribute(
      'price',
      'available',
      schemaName,
      collectionName,
    )
    if (!intAttr) {
      throw new Error('Attribute "price" failed to become available in time')
    }

    const boolAttrRes = await app.inject({
      method: 'POST',
      url: `/v1/schemas/${schemaName}/collections/${collectionName}/attributes/boolean`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify({
        key: 'available',
        required: false,
        default: true,
        array: false,
      }),
    })

    assertStatusCode(boolAttrRes, 202)
    const boolAttr = await waitForAttribute(
      'price',
      'available',
      schemaName,
      collectionName,
    )
    if (!boolAttr) {
      throw new Error(
        'Attribute "available" failed to become available in time',
      )
    }

    // =========================================================================
    // STEP 4: Create documents in the collection
    // =========================================================================
    const documents = [
      {
        title: 'Laptop Pro X1',
        price: 1299,
        available: true,
      },
      {
        title: 'Wireless Keyboard',
        price: 79,
        available: true,
      },
      {
        title: 'USB-C Hub',
        price: 45,
        available: false,
      },
    ]

    const createdDocuments: any[] = []

    for (const doc of documents) {
      const createDocRes = await app.inject({
        method: 'POST',
        url: `/v1/schemas/${schemaName}/collections/${collectionName}/documents`,
        headers: getApiKeyJsonHeaders(),
        payload: JSON.stringify({
          documentId: faker.string.alphanumeric(12),
          data: doc,
        }),
      })

      assertStatusCode(createDocRes, 201)
      const createdDoc = parseJson(createDocRes.payload)
      assertDocumentShape(createdDoc)
      createdDocuments.push(createdDoc)
    }

    expect(createdDocuments).toHaveLength(3)

    // =========================================================================
    // STEP 5: Query all documents
    // =========================================================================
    const listDocsRes = await app.inject({
      method: 'GET',
      url: `/v1/schemas/${schemaName}/collections/${collectionName}/documents`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(listDocsRes, 200)
    const docsList = parseJson(listDocsRes.payload)
    assertListResponse(docsList)
    expect(docsList.total).toBeGreaterThanOrEqual(3)

    // =========================================================================
    // STEP 6: Query with filter (documents with title = Wireless Keyboard)
    // =========================================================================
    const filteredDocsRes = await app.inject({
      method: 'GET',
      url: `/v1/schemas/${schemaName}/collections/${collectionName}/documents`,
      headers: getApiKeyHeaders(),
      query: QueryString.stringify({
        queries: [
          {
            method: 'equal',
            attribute: 'title',
            values: ['Wireless Keyboard'],
          },
        ],
      }),
    })

    assertStatusCode(filteredDocsRes, 200)
    const filteredDocs = parseJson(filteredDocsRes.payload)
    assertListResponse(filteredDocs)

    for (const doc of filteredDocs.data as any[]) {
      expect(doc.title).eq('Wireless Keyboard')
    }

    // =========================================================================
    // STEP 7: Get a specific document by ID
    // =========================================================================
    const targetDocId = createdDocuments[0].$id

    const getDocRes = await app.inject({
      method: 'GET',
      url: `/v1/schemas/${schemaName}/collections/${collectionName}/documents/${targetDocId}`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(getDocRes, 200)
    const fetchedDoc = parseJson(getDocRes.payload)
    assertDocumentShape(fetchedDoc)
    expect(fetchedDoc.$id).toBe(targetDocId)
    expect(fetchedDoc.title).toBe('Laptop Pro X1')

    // =========================================================================
    // STEP 8: Update a document
    // =========================================================================
    const updateDocRes = await app.inject({
      method: 'PATCH',
      url: `/v1/schemas/${schemaName}/collections/${collectionName}/documents/${targetDocId}`,
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify({
        data: {
          price: 1199, // On sale!
          available: true,
        },
      }),
    })

    assertStatusCode(updateDocRes, 200)
    const updatedDoc = parseJson(updateDocRes.payload)
    expect(updatedDoc.price).toBe(1199)
    expect(updatedDoc.available).toBe(true)

    // Verify update persisted
    const verifyUpdateRes = await app.inject({
      method: 'GET',
      url: `/v1/schemas/${schemaName}/collections/${collectionName}/documents/${targetDocId}`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(verifyUpdateRes, 200)
    const verifiedDoc = parseJson(verifyUpdateRes.payload)
    expect(verifiedDoc.price).toBe(1199)

    // =========================================================================
    // STEP 9: Delete a document
    // =========================================================================
    const deleteDocRes = await app.inject({
      method: 'DELETE',
      url: `/v1/schemas/${schemaName}/collections/${collectionName}/documents/${targetDocId}`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(deleteDocRes, 204)

    // Verify deletion
    const verifyDeleteRes = await app.inject({
      method: 'GET',
      url: `/v1/schemas/${schemaName}/collections/${collectionName}/documents/${targetDocId}`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(verifyDeleteRes, 404)

    // =========================================================================
    // STEP 10: Delete the collection
    // =========================================================================
    const deleteCollectionRes = await app.inject({
      method: 'DELETE',
      url: `/v1/schemas/${schemaName}/collections/${collectionName}`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(deleteCollectionRes, 204)

    // Verify collection is gone
    const verifyCollectionDeleteRes = await app.inject({
      method: 'GET',
      url: `/v1/schemas/${schemaName}/collections/${collectionName}`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(verifyCollectionDeleteRes, 404)
  }, 30000) // Extended timeout for this test

  it('handles validation errors for invalid schema creation', async () => {
    // =========================================================================
    // Test: Invalid schema name
    // =========================================================================
    const invalidNameDto = buildCreateSchemaDTO({ name: '123-Invalid!' })

    const invalidNameRes = await app.inject({
      method: 'POST',
      url: '/v1/database/schemas',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(invalidNameDto),
    })

    assertStatusCode(invalidNameRes, 400)
    const errorBody = parseJson(invalidNameRes.payload)
    expect(errorBody.message).toBeDefined()

    // =========================================================================
    // Test: Missing required fields
    // =========================================================================
    const missingFieldsRes = await app.inject({
      method: 'POST',
      url: '/v1/database/schemas',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify({
        description: 'Missing name and type',
      }),
    })

    assertStatusCode(missingFieldsRes, 400)
  })

  it('prevents duplicate schema creation', async () => {
    // =========================================================================
    // Create a schema
    // =========================================================================
    const schemaDto = buildCreateSchemaDTO()

    await app.inject({
      method: 'POST',
      url: '/v1/database/schemas',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(schemaDto),
    })

    // =========================================================================
    // Try to create another schema with the same name
    // =========================================================================
    const duplicateRes = await app.inject({
      method: 'POST',
      url: '/v1/database/schemas',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(schemaDto),
    })

    assertStatusCode(duplicateRes, 409)
  })

  it('returns 404 for non-existent resources', async () => {
    // =========================================================================
    // Non-existent schema
    // =========================================================================
    const nonExistentSchemaRes = await app.inject({
      method: 'GET',
      url: '/v1/database/schemas/nonexistent_schema',
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(nonExistentSchemaRes, 404)

    // =========================================================================
    // Non-existent collection
    // =========================================================================
    const schemaDto = buildCreateDocumentSchemaDTO()

    await app.inject({
      method: 'POST',
      url: '/v1/database/schemas',
      headers: getApiKeyJsonHeaders(),
      payload: JSON.stringify(schemaDto),
    })

    const nonExistentCollectionRes = await app.inject({
      method: 'GET',
      url: `/v1/database/${schemaDto.name}/collections/nonexistent_collection`,
      headers: getApiKeyHeaders(),
    })

    assertStatusCode(nonExistentCollectionRes, 404)
  })

  it('requires authentication for all database operations', async () => {
    // =========================================================================
    // List schemas without auth
    // =========================================================================
    const listSchemasRes = await app.inject({
      method: 'GET',
      url: '/v1/database/schemas',
    })

    assertStatusCode(listSchemasRes, 401)

    // =========================================================================
    // Create schema without auth
    // =========================================================================
    const createSchemaRes = await app.inject({
      method: 'POST',
      url: '/v1/database/schemas',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify(buildCreateSchemaDTO()),
    })

    assertStatusCode(createSchemaRes, 401)
  })
})
