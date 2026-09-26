import { OnDelete, RelationType } from '@nuvix/db'
import { Elysia, t } from 'elysia'
import type { TenantContext } from '../../context/tenant'
import { ForbiddenError } from '../../shared/errors'
import { formatAttribute } from '../formatter'
import { AttributesService } from './service'

export interface AttributesRouteServices {
  attributes?: AttributesService
}

export const attributesRoutes = (services?: AttributesRouteServices) => {
  const defaultService = services?.attributes ?? new AttributesService()

  return (
    new Elysia()
      .derive('plugin', (ctx) => {
        const tenant = ctx as unknown as TenantContext
        const params = ctx.params as { schemaId: string }
        const schemaId = params?.schemaId ?? 'public'
        const tenantDb = tenant.tenantResource?.databaseForSchema(schemaId)
        return {
          tenant,
          tenantDb,
          attributesService: defaultService,
        }
      })

      // 1. List attributes
      .get(
        '/collections/:collectionId/attributes',
        {
          detail: {
            summary: 'List collection attributes',
            description:
              'Retrieve a list of all schema attributes/columns configured on the collection.',
            tags: ['Schemas Attributes'],
          },
          params: t.Object({
            schemaId: t.String({ description: 'Schema identifier' }),
            collectionId: t.String({ description: 'Collection identifier' }),
          }),
        },
        async ({ tenant, tenantDb, attributesService, params: { collectionId } }) => {
          if (!tenant.isAdmin && !tenant.isAPIUser) {
            throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
          }
          const res = await attributesService.getAttributes(tenantDb, collectionId)
          return {
            total: res.total,
            data: res.data.map(formatAttribute),
          }
        },
      )

      // 2. Create String attribute
      .post(
        '/collections/:collectionId/attributes/string',
        {
          detail: {
            summary: 'Create string attribute',
            description: 'Add a new text/string attribute to the collection schema.',
            tags: ['Schemas Attributes'],
          },
          params: t.Object({
            schemaId: t.String({ description: 'Schema identifier' }),
            collectionId: t.String({ description: 'Collection identifier' }),
          }),
          body: t.Object({
            key: t.String({ description: 'Attribute name/column key' }),
            size: t.Optional(t.Number({ description: 'Maximum character length limit' })),
            required: t.Optional(t.Boolean({ description: 'Whether this field is non-nullable' })),
            default: t.Optional(t.Nullable(t.String({ description: 'Default string value' }))),
            array: t.Optional(
              t.Boolean({ description: 'Whether this attribute stores an array of strings' }),
            ),
            encrypt: t.Optional(
              t.Boolean({ description: 'Whether this string is encrypted at rest' }),
            ),
          }),
        },
        async ({ tenant, tenantDb, attributesService, params: { collectionId }, body }) => {
          if (!tenant.isAdmin && !tenant.isAPIUser) {
            throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
          }
          const attr = await attributesService.createStringAttribute(tenantDb, collectionId, body)
          return formatAttribute(attr)
        },
      )

      // 3. Create Email attribute
      .post(
        '/collections/:collectionId/attributes/email',
        {
          detail: {
            summary: 'Create email attribute',
            description: 'Add a validated email address attribute to the collection.',
            tags: ['Schemas Attributes'],
          },
          params: t.Object({
            schemaId: t.String({ description: 'Schema identifier' }),
            collectionId: t.String({ description: 'Collection identifier' }),
          }),
          body: t.Object({
            key: t.String({ description: 'Attribute key' }),
            required: t.Optional(t.Boolean({ description: 'Required flag' })),
            default: t.Optional(
              t.Nullable(t.String({ description: 'Default email', format: 'email' })),
            ),
            array: t.Optional(t.Boolean({ description: 'Array flag' })),
          }),
        },
        async ({ tenant, tenantDb, attributesService, params: { collectionId }, body }) => {
          if (!tenant.isAdmin && !tenant.isAPIUser) {
            throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
          }
          const attr = await attributesService.createEmailAttribute(tenantDb, collectionId, body)
          return formatAttribute(attr)
        },
      )

      // 4. Create Enum attribute
      .post(
        '/collections/:collectionId/attributes/enum',
        {
          detail: {
            summary: 'Create enum attribute',
            description: 'Add an enumerated string choice attribute to the collection.',
            tags: ['Schemas Attributes'],
          },
          params: t.Object({
            schemaId: t.String({ description: 'Schema identifier' }),
            collectionId: t.String({ description: 'Collection identifier' }),
          }),
          body: t.Object({
            key: t.String({ description: 'Attribute key' }),
            elements: t.Array(t.String({ description: 'Allowed choice value' }), {
              description: 'List of permitted enum values',
            }),
            required: t.Optional(t.Boolean({ description: 'Required flag' })),
            default: t.Optional(t.Nullable(t.String({ description: 'Default choice value' }))),
            array: t.Optional(t.Boolean({ description: 'Array flag' })),
          }),
        },
        async ({ tenant, tenantDb, attributesService, params: { collectionId }, body }) => {
          if (!tenant.isAdmin && !tenant.isAPIUser) {
            throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
          }
          const attr = await attributesService.createEnumAttribute(tenantDb, collectionId, body)
          return formatAttribute(attr)
        },
      )

      // 5. Create IP attribute
      .post(
        '/collections/:collectionId/attributes/ip',
        {
          detail: {
            summary: 'Create IP address attribute',
            description: 'Add a validated IPv4 or IPv6 address attribute to the collection.',
            tags: ['Schemas Attributes'],
          },
          params: t.Object({
            schemaId: t.String({ description: 'Schema identifier' }),
            collectionId: t.String({ description: 'Collection identifier' }),
          }),
          body: t.Object({
            key: t.String({ description: 'Attribute key' }),
            required: t.Optional(t.Boolean({ description: 'Required flag' })),
            default: t.Optional(t.Nullable(t.String({ description: 'Default IP address' }))),
            array: t.Optional(t.Boolean({ description: 'Array flag' })),
          }),
        },
        async ({ tenant, tenantDb, attributesService, params: { collectionId }, body }) => {
          if (!tenant.isAdmin && !tenant.isAPIUser) {
            throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
          }
          const attr = await attributesService.createIPAttribute(tenantDb, collectionId, body)
          return formatAttribute(attr)
        },
      )

      // 6. Create URL attribute
      .post(
        '/collections/:collectionId/attributes/url',
        {
          detail: {
            summary: 'Create URL attribute',
            description: 'Add a validated web URL attribute to the collection.',
            tags: ['Schemas Attributes'],
          },
          params: t.Object({
            schemaId: t.String({ description: 'Schema identifier' }),
            collectionId: t.String({ description: 'Collection identifier' }),
          }),
          body: t.Object({
            key: t.String({ description: 'Attribute key' }),
            required: t.Optional(t.Boolean({ description: 'Required flag' })),
            default: t.Optional(t.Nullable(t.String({ description: 'Default URL' }))),
            array: t.Optional(t.Boolean({ description: 'Array flag' })),
          }),
        },
        async ({ tenant, tenantDb, attributesService, params: { collectionId }, body }) => {
          if (!tenant.isAdmin && !tenant.isAPIUser) {
            throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
          }
          const attr = await attributesService.createURLAttribute(tenantDb, collectionId, body)
          return formatAttribute(attr)
        },
      )

      // 7. Create Integer attribute
      .post(
        '/collections/:collectionId/attributes/integer',
        {
          detail: {
            summary: 'Create integer attribute',
            description: 'Add a 64-bit integer numeric attribute with optional min/max validation.',
            tags: ['Schemas Attributes'],
          },
          params: t.Object({
            schemaId: t.String({ description: 'Schema identifier' }),
            collectionId: t.String({ description: 'Collection identifier' }),
          }),
          body: t.Object({
            key: t.String({ description: 'Attribute key' }),
            min: t.Optional(t.Number({ description: 'Minimum allowed integer' })),
            max: t.Optional(t.Number({ description: 'Maximum allowed integer' })),
            required: t.Optional(t.Boolean({ description: 'Required flag' })),
            default: t.Optional(t.Nullable(t.Number({ description: 'Default integer value' }))),
            array: t.Optional(t.Boolean({ description: 'Array flag' })),
          }),
        },
        async ({ tenant, tenantDb, attributesService, params: { collectionId }, body }) => {
          if (!tenant.isAdmin && !tenant.isAPIUser) {
            throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
          }
          const attr = await attributesService.createIntegerAttribute(tenantDb, collectionId, body)
          return formatAttribute(attr)
        },
      )

      // 8. Create Float attribute
      .post(
        '/collections/:collectionId/attributes/float',
        {
          detail: {
            summary: 'Create float attribute',
            description: 'Add a floating-point numeric attribute with optional min/max bounds.',
            tags: ['Schemas Attributes'],
          },
          params: t.Object({
            schemaId: t.String({ description: 'Schema identifier' }),
            collectionId: t.String({ description: 'Collection identifier' }),
          }),
          body: t.Object({
            key: t.String({ description: 'Attribute key' }),
            min: t.Optional(t.Number({ description: 'Minimum float' })),
            max: t.Optional(t.Number({ description: 'Maximum float' })),
            required: t.Optional(t.Boolean({ description: 'Required flag' })),
            default: t.Optional(t.Nullable(t.Number({ description: 'Default float' }))),
            array: t.Optional(t.Boolean({ description: 'Array flag' })),
          }),
        },
        async ({ tenant, tenantDb, attributesService, params: { collectionId }, body }) => {
          if (!tenant.isAdmin && !tenant.isAPIUser) {
            throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
          }
          const attr = await attributesService.createFloatAttribute(tenantDb, collectionId, body)
          return formatAttribute(attr)
        },
      )

      // 9. Create Boolean attribute
      .post(
        '/collections/:collectionId/attributes/boolean',
        {
          detail: {
            summary: 'Create boolean attribute',
            description: 'Add a true/false boolean attribute to the collection.',
            tags: ['Schemas Attributes'],
          },
          params: t.Object({
            schemaId: t.String({ description: 'Schema identifier' }),
            collectionId: t.String({ description: 'Collection identifier' }),
          }),
          body: t.Object({
            key: t.String({ description: 'Attribute key' }),
            required: t.Optional(t.Boolean({ description: 'Required flag' })),
            default: t.Optional(t.Nullable(t.Boolean({ description: 'Default boolean' }))),
            array: t.Optional(t.Boolean({ description: 'Array flag' })),
          }),
        },
        async ({ tenant, tenantDb, attributesService, params: { collectionId }, body }) => {
          if (!tenant.isAdmin && !tenant.isAPIUser) {
            throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
          }
          const attr = await attributesService.createBooleanAttribute(tenantDb, collectionId, body)
          return formatAttribute(attr)
        },
      )

      // 10. Create Datetime attribute
      .post(
        '/collections/:collectionId/attributes/datetime',
        {
          detail: {
            summary: 'Create datetime attribute',
            description: 'Add an ISO 8601 date and time attribute to the collection.',
            tags: ['Schemas Attributes'],
          },
          params: t.Object({
            schemaId: t.String({ description: 'Schema identifier' }),
            collectionId: t.String({ description: 'Collection identifier' }),
          }),
          body: t.Object({
            key: t.String({ description: 'Attribute key' }),
            required: t.Optional(t.Boolean({ description: 'Required flag' })),
            default: t.Optional(t.Nullable(t.String({ description: 'Default ISO date string' }))),
            array: t.Optional(t.Boolean({ description: 'Array flag' })),
          }),
        },
        async ({ tenant, tenantDb, attributesService, params: { collectionId }, body }) => {
          if (!tenant.isAdmin && !tenant.isAPIUser) {
            throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
          }
          const attr = await attributesService.createDateAttribute(tenantDb, collectionId, body)
          return formatAttribute(attr)
        },
      )

      // 11. Create Relationship attribute
      .post(
        '/collections/:collectionId/attributes/relationship',
        {
          detail: {
            summary: 'Create relationship attribute',
            description:
              'Create a foreign-key or multi-relation relationship attribute referencing another collection.',
            tags: ['Schemas Attributes'],
          },
          params: t.Object({
            schemaId: t.String({ description: 'Schema identifier' }),
            collectionId: t.String({ description: 'Collection identifier' }),
          }),
          body: t.Object({
            key: t.String({ description: 'Attribute key' }),
            relatedCollection: t.String({ description: 'Target collection ID being referenced' }),
            relationType: t.Enum(RelationType, {
              description: 'oneToOne, oneToMany, manyToOne, or manyToMany',
            }),
            twoWay: t.Optional(
              t.Boolean({ description: 'Whether to create a bidirectional back-reference' }),
            ),
            twoWayKey: t.Optional(
              t.String({ description: 'Attribute key for the back-reference' }),
            ),
            onDelete: t.Optional(
              t.Enum(OnDelete, { description: 'Cascade action: cascade, restrict, or setNull' }),
            ),
          }),
        },
        async ({ tenant, tenantDb, attributesService, params: { collectionId }, body }) => {
          if (!tenant.isAdmin && !tenant.isAPIUser) {
            throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
          }
          const attr = await attributesService.createRelationshipAttribute(
            tenantDb,
            collectionId,
            body,
          )
          return formatAttribute(attr)
        },
      )

      // 12. Get attribute by key
      .get(
        '/collections/:collectionId/attributes/:key',
        {
          detail: {
            summary: 'Get attribute by key',
            description: 'Retrieve definition and options for a specific attribute.',
            tags: ['Schemas Attributes'],
          },
          params: t.Object({
            schemaId: t.String({ description: 'Schema identifier' }),
            collectionId: t.String({ description: 'Collection identifier' }),
            key: t.String({ description: 'Attribute name/key' }),
          }),
        },
        async ({ tenant, tenantDb, attributesService, params: { collectionId, key } }) => {
          if (!tenant.isAdmin && !tenant.isAPIUser) {
            throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
          }
          const attr = await attributesService.getAttribute(tenantDb, collectionId, key)
          return formatAttribute(attr)
        },
      )

      // 13. Update attribute by key
      .patch(
        '/collections/:collectionId/attributes/:key',
        {
          detail: {
            summary: 'Update attribute by key',
            description: 'Modify validation rules, size limits, or default value of an attribute.',
            tags: ['Schemas Attributes'],
          },
          params: t.Object({
            schemaId: t.String({ description: 'Schema identifier' }),
            collectionId: t.String({ description: 'Collection identifier' }),
            key: t.String({ description: 'Attribute name/key' }),
          }),
          body: t.Object({
            required: t.Optional(t.Boolean({ description: 'Required flag' })),
            default: t.Optional(t.Any({ description: 'Default value' })),
            size: t.Optional(t.Number({ description: 'Max size' })),
            min: t.Optional(t.Number({ description: 'Min bounds' })),
            max: t.Optional(t.Number({ description: 'Max bounds' })),
            elements: t.Optional(t.Array(t.String(), { description: 'Updated enum choices' })),
          }),
        },
        async ({ tenant, tenantDb, attributesService, params: { collectionId, key }, body }) => {
          if (!tenant.isAdmin && !tenant.isAPIUser) {
            throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
          }
          const attr = await attributesService.updateAttribute(tenantDb, collectionId, key, body)
          return formatAttribute(attr)
        },
      )

      // 14. Delete attribute by key
      .delete(
        '/collections/:collectionId/attributes/:key',
        {
          detail: {
            summary: 'Delete attribute by key',
            description: 'Remove and drop an attribute column from the collection schema.',
            tags: ['Schemas Attributes'],
          },
          params: t.Object({
            schemaId: t.String({ description: 'Schema identifier' }),
            collectionId: t.String({ description: 'Collection identifier' }),
            key: t.String({ description: 'Attribute name/key' }),
          }),
          response: {
            204: t.Null({ description: 'Attribute deleted successfully (no content)' }),
          },
        },
        async ({ tenant, tenantDb, attributesService, params: { collectionId, key }, set }) => {
          if (!tenant.isAdmin && !tenant.isAPIUser) {
            throw new ForbiddenError('Access forbidden', { code: 'user_forbidden' })
          }
          await attributesService.deleteAttribute(tenantDb, collectionId, key)
          set.status = 204
          return null
        },
      )
  )
}
