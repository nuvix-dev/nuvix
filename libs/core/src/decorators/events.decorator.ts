import { SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

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

type AuditEventKey = (typeof auditEvents)[number];

type ParameterKey = 'user' | 'req' | 'res' | 'params' | 'body' | 'query';
type ResourceSegment = string | `{${ParameterKey}.${string}}`;
type ResourcePath =
  | `${ResourceSegment}/${ResourceSegment}`
  | `${ResourceSegment}/${ResourceSegment}/${ResourceSegment}`
  | `${ResourceSegment}/${ResourceSegment}/${ResourceSegment}/${ResourceSegment}`
  | ResourceSegment;

type AuditEvent = {
  resource: ResourcePath;
  userId?: `{${ParameterKey}.${string}}`;
};

export const AuditEvent = (
  key: AuditEventKey,
  meta: AuditEvent | ResourcePath,
) =>
  SetMetadata('audit-event', {
    key,
    meta: typeof meta === 'string' ? { resource: meta } : meta,
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
