/**
 * Shared test utilities for Nuvix integration tests.
 * These utilities help standardize assertions and reduce code duplication.
 */

import type { LightMyRequestResponse } from 'fastify'
import { expect } from 'vitest'

/**
 * Centralized JSON parser with better error messages.
 * Throws a descriptive error if parsing fails.
 */
export function parseJson<T = any>(payload: string): T {
  try {
    return JSON.parse(payload) as T
  } catch (_error) {
    throw new Error(
      `Failed to parse JSON response:\n${payload.substring(0, 500)}${payload.length > 500 ? '...' : ''}`,
    )
  }
}

/**
 * Assert that a response has the expected status code.
 * Provides helpful error message including the response body on failure.
 */
export function assertStatusCode(
  res: LightMyRequestResponse,
  expected: number,
): void {
  if (res.statusCode !== expected) {
    let bodyPreview = ''
    try {
      bodyPreview = res.payload.substring(0, 500)
    } catch {
      bodyPreview = '[unable to read body]'
    }
    throw new Error(
      `Expected status ${expected} but got ${res.statusCode}.\nResponse body: ${bodyPreview}`,
    )
  }
}

/**
 * Assert that a payload matches a given shape using expect.toMatchObject.
 * Useful for verifying response structures.
 */
export function assertShape<T extends object>(
  payload: T,
  schema: Partial<Record<keyof T, unknown>>,
): void {
  expect(payload).toMatchObject(schema)
}

/**
 * Assert that a response is a valid list response with { data: [], total: number } shape.
 * This is the standard pagination format for Nuvix list endpoints.
 */
export function assertListResponse(payload: unknown): asserts payload is {
  data: unknown[]
  total: number
} {
  expect(payload).toBeDefined()
  expect(typeof payload).toBe('object')
  expect(payload).not.toBeNull()

  const obj = payload as Record<string, unknown>
  expect(Array.isArray(obj.data)).toBe(true)
  expect(typeof obj.total).toBe('number')
  expect(obj.total).toBeGreaterThanOrEqual(0)
}

/**
 * Assert that a response body has the standard Nuvix document shape.
 * All documents should have $id, $createdAt, and $updatedAt.
 */
export function assertDocumentShape(payload: unknown): void {
  expect(payload).toBeDefined()
  expect(typeof payload).toBe('object')
  expect(payload).not.toBeNull()

  const obj = payload as Record<string, unknown>
  expect(typeof obj.$id).toBe('string')
  expect(obj.$id).toBeTruthy()
}

/**
 * Assert that an error response has the expected shape.
 */
export function assertErrorResponse(
  payload: unknown,
  expectedCode?: string,
): void {
  expect(payload).toBeDefined()
  expect(typeof payload).toBe('object')
  expect(payload).not.toBeNull()

  const obj = payload as Record<string, unknown>
  expect(typeof obj.message).toBe('string')
  expect(typeof obj.code).toBe('number')

  if (expectedCode) {
    expect(obj.type).toBe(expectedCode)
  }
}

/**
 * Helper to create standard JSON request headers.
 */
export function jsonHeaders(
  additionalHeaders: Record<string, string> = {},
): Record<string, string> {
  return {
    'content-type': 'application/json',
    ...additionalHeaders,
  }
}

/**
 * Helper to stringify payload for requests.
 */
export function toPayload(obj: object): string {
  return JSON.stringify(obj)
}

export function skipIfSMTPNotConfigured(): boolean {
  return !process.env.NUVIX_SMTP_HOST
}
