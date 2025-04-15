import { SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

const auditEvents = [
  'user.create',
  'user.update',
  'user.delete',
  'target.create',
  'target.update',
  'target.delete',
] as const;

type AuditEventKey = (typeof auditEvents)[number];

type ResourceType = `${string}{${'res' | 'req' | 'user'}.${string}}`;

export const AuditEvent = (key: AuditEventKey, resource: ResourceType) =>
  SetMetadata('audit-event', { key, resource });

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
