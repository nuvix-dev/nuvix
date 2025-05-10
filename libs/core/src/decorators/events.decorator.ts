import { SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

type EventActions = 'create' | 'update' | 'delete';

const event = <T extends string>(name: T): readonly `${T}.${EventActions}`[] =>
  [`${name}.create`, `${name}.update`, `${name}.delete`] as const;

type EventCategory = 'user' | 'target' | 'session';

const auditEvents = [
  ...event<EventCategory>('user'),
  ...event<EventCategory>('target'),
  ...event<EventCategory>('session'),
] as const;

type AuditEventKey = (typeof auditEvents)[number];

type ResourceType = `${string}{${'res' | 'req' | 'user'}.${string}}`;
type AuditEvent = {
  resource: ResourceType;
  userId?: `${'res' | 'req' | 'user'}.${string}`;
}

export const AuditEvent = (key: AuditEventKey, meta: AuditEvent | ResourceType) =>
  SetMetadata('audit-event', { key, meta: typeof meta === 'string' ? { resource: meta } : meta });

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
