/** Defines image and QR avatar endpoints while keeping rendering and SSRF checks in the service. */
import { Elysia, type HTTPHeaders, t } from 'elysia'
import type { AvatarService } from './service'

/** Apply service-produced content and cache headers without duplicating response wiring per route. */
function apply(
  set: { headers: HTTPHeaders },
  contentType: string,
  headers: Record<string, string>,
) {
  set.headers['content-type'] = contentType
  Object.assign(set.headers, headers)
}

const ImageQuery = t.Object({
  width: t.Optional(t.Integer({ minimum: 1, maximum: 2000, default: 100 })),
  height: t.Optional(t.Integer({ minimum: 1, maximum: 2000, default: 100 })),
  quality: t.Optional(t.Integer({ minimum: 0, maximum: 100, default: 90 })),
})

/** Register avatar routes and delegate image generation to the injected service. */
export function avatarRoutes(service: AvatarService) {
  return new Elysia({ name: 'avatar-routes' })
    .get(
      '/avatars/credit-cards/:code',
      {
        query: ImageQuery,
        detail: { summary: 'Get credit card logo', tags: ['avatars'] },
      },
      async ({ params, query, set }) => {
        const result = await service.resize(
          'credit-cards',
          params.code,
          query.width ?? 100,
          query.height ?? 100,
        )
        apply(set, result.contentType, result.headers)
        return result.body
      },
    )
    .get(
      '/avatars/browsers/:code',
      {
        query: ImageQuery,
        detail: { summary: 'Get browser logo', tags: ['avatars'] },
      },
      async ({ params, query, set }) => {
        const result = await service.resize(
          'browsers',
          params.code,
          query.width ?? 100,
          query.height ?? 100,
        )
        apply(set, result.contentType, result.headers)
        return result.body
      },
    )
    .get(
      '/avatars/flags/:code',
      {
        query: ImageQuery,
        detail: { summary: 'Get country flag', tags: ['avatars'] },
      },
      async ({ params, query, set }) => {
        const result = await service.resize(
          'flags',
          params.code,
          query.width ?? 100,
          query.height ?? 100,
        )
        apply(set, result.contentType, result.headers)
        return result.body
      },
    )
    .get(
      '/avatars/initials',
      {
        query: t.Object({
          name: t.Optional(t.String({ maxLength: 128 })),
          width: t.Optional(t.Integer({ minimum: 1, maximum: 2000, default: 500 })),
          height: t.Optional(t.Integer({ minimum: 1, maximum: 2000, default: 500 })),
          background: t.Optional(t.String({ maxLength: 32 })),
          circle: t.Optional(t.Boolean({ default: false })),
        }),
        detail: { summary: 'Get initials avatar', tags: ['avatars'] },
      },
      async ({ query, set }) => {
        const result = await service.initials(query)
        apply(set, result.contentType, result.headers)
        return result.body
      },
    )
    .get(
      '/avatars/favicon',
      {
        query: t.Object({ url: t.String({ minLength: 1, maxLength: 2048 }) }),
        detail: { summary: 'Get site favicon', tags: ['avatars'] },
      },
      async ({ query, set }) => {
        const result = await service.favicon(query.url)
        apply(set, result.contentType, result.headers)
        return result.body
      },
    )
    .get(
      '/avatars/qr',
      {
        query: t.Object({
          text: t.String({ minLength: 1, maxLength: 512 }),
          size: t.Optional(t.Integer({ minimum: 1, maximum: 1000, default: 400 })),
          margin: t.Optional(t.Integer({ minimum: 0, maximum: 10, default: 1 })),
          download: t.Optional(t.Boolean({ default: false })),
        }),
        detail: { summary: 'Get QR code', tags: ['avatars'] },
      },
      async ({ query, set }) => {
        const result = await service.qr(
          query.text,
          query.size ?? 400,
          query.margin ?? 1,
          !!query.download,
        )
        apply(set, result.contentType, result.headers)
        return result.body
      },
    )
}
