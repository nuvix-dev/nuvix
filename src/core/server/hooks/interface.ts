import { FastifyRequest, FastifyReply } from 'fastify';
import { LifecycleHook } from 'fastify/types/hooks';

export type Hooks = LifecycleHook;

export type AsyncHook<T = void> = (
  req: FastifyRequest,
  reply: FastifyReply,
  ...args: T[]
) => Promise<void>;

export type LifecycleHookMethods = {
  onRequest: AsyncHook;
  preParsing: AsyncHook<{ payload: any }>;
  preValidation: AsyncHook;
  preHandler: AsyncHook;
  preSerialization: AsyncHook<{ payload: any }>;
  onSend: AsyncHook<{ payload: any }>;
  onResponse: AsyncHook;
  onError: AsyncHook<{ error: Error }>;
  onTimeout: AsyncHook;
};

export interface Hook extends Partial<LifecycleHookMethods> {}

export const HookMethods = [
  'onRequest',
  'preParsing',
  'preValidation',
  'preHandler',
  'preSerialization',
  'onSend',
  'onResponse',
  'onRequest',
  'onError',
  'onTimeout',
  'onRequestAbort',
] as const;
