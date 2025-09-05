import { Reflector } from '@nestjs/core';
import { RouteConfig } from '@nestjs/platform-fastify';
import { RouteContext } from '@nuvix/utils';

type EventActions = 'create' | 'update' | 'delete';

const event = <T extends string>(name: T): readonly `${T}.${EventActions}`[] =>
  [`${name}.create`, `${name}.update`, `${name}.delete`] as const;

type EventCategory = 'user' | 'target' | 'session';

const auditEvents = [
  'identity.delete',
  ...event<EventCategory>('user'),
  ...event<EventCategory>('target'),
  ...event<EventCategory>('session'),
  ...event('recovery'),
  ...event('verification'),
  ...event('identities'),
  ...event('provider'),
  ...event('topic'),
  ...event('subscriber'),
  ...event('message'),
] as const;

export type AuditEventKey = (typeof auditEvents)[number];

type ParameterKey = 'user' | 'req' | 'res' | 'params' | 'body' | 'query';
type ResourceSegment = `{${ParameterKey}.${string}}`;
export type ResourcePath =
  | `${string}/${ResourceSegment}`
  | `${string}/${string | ResourceSegment}/${ResourceSegment}`
  | `${ResourceSegment}/${string | ResourceSegment}/${string | ResourceSegment}/${ResourceSegment}`
  | ResourceSegment;

export type _AuditEvent = {
  resource: ResourcePath;
  userId?: `{${ParameterKey}.${string}}`;
};

export type AuditEventType = {
  event: AuditEventKey;
  meta: _AuditEvent;
};

/**
 * Decorator function to configure an audit event for a route.
 *
 * @param event - The event representing the audit event. This is typically a constant
 *              that identifies the type of event being audited.
 *              Example: `'user.create'`, `'session.delete'`.
 * @param meta - Metadata associated with the audit event. This can either be:
 *               - A `ResourcePath` string representing the resource being audited.
 *                 Example: `'users/{user.id}'`, `'sessions/{session.id}/details'`.
 *               - An `_AuditEvent` object containing detailed metadata about the event.
 *                 Example: `{ resource: 'users/{user.id}', userId: '{user.id}' }`.
 *
 * @returns A function that applies the audit event configuration to the route.
 */
export const AuditEvent = (
  event: AuditEventKey,
  meta: _AuditEvent | ResourcePath,
) =>
  RouteConfig({
    [RouteContext.AUDIT]: {
      event,
      meta: typeof meta === 'string' ? { resource: meta } : meta,
    },
  });

const events = ['user.{userId}.create'] as const;

type EventKey = (typeof events)[number];

export const SimpleEvent = Reflector.createDecorator<
  EventKey | EventKey[],
  EventKey[]
>({
  transform(value) {
    return Array.isArray(value) ? value : [value];
  },
});
