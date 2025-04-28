import { FastifyRequest, FastifyReply } from 'fastify';
import { LifecycleHook } from 'fastify/types/hooks';

export type Hooks = LifecycleHook;

export type AsyncHook<T extends any[] = []> = (
  req: FastifyRequest,
  reply: FastifyReply,
  next: (err?: Error) => void,
  ...args: T
) => Promise<unknown>;

export interface LifecycleHookMethods {
  /**
   * Triggered before the request is processed.
   * Useful for tasks like authentication or logging.
   */
  onRequest: AsyncHook;

  /**
   * Triggered before the request body is parsed.
   * Useful for modifying or validating raw payload data.
   */
  preParsing: AsyncHook<[payload: unknown]>;

  /**
   * Triggered before the request is validated.
   * Useful for custom validation logic or preprocessing.
   */
  preValidation: AsyncHook;

  /**
   * Triggered before the request handler is executed.
   * Useful for tasks like authorization or setting up context.
   */
  preHandler: AsyncHook;

  /**
   * Triggered before the response is serialized.
   * Useful for modifying the response payload before sending it.
   */
  preSerialization: AsyncHook<[payload: unknown]>;

  /**
   * Triggered before the response is sent to the client.
   * Useful for adding headers or modifying the response.
   */
  onSend: AsyncHook<[payload: unknown]>;

  /**
   * Triggered after the response is sent to the client.
   * Useful for cleanup tasks or logging.
   */
  onResponse: AsyncHook;

  /**
   * Triggered when an error occurs during request processing.
   * Useful for custom error handling or logging.
   */
  onError: AsyncHook<[error: Error]>;

  /**
   * Triggered when a request times out.
   * Useful for handling timeout-specific logic.
   */
  onTimeout: AsyncHook;

  /**
   * Triggered when a request is aborted by the client.
   * Useful for cleanup or logging aborted requests.
   */
  onRequestAbort: AsyncHook;
}

export type HookMethod = keyof LifecycleHookMethods;

export interface Hook extends Partial<LifecycleHookMethods> {
  // Explicitly define method signatures for better IDE autocompletion
  onRequest?: (
    req: FastifyRequest,
    reply: FastifyReply,
    next: (err?: Error) => void,
  ) => Promise<unknown>;
  preParsing?: (
    req: FastifyRequest,
    reply: FastifyReply,
    next: (err?: Error) => void,
    payload: unknown,
  ) => Promise<unknown>;
  preValidation?: (
    req: FastifyRequest,
    reply: FastifyReply,
    next: (err?: Error) => void,
  ) => Promise<unknown>;
  preHandler?: (
    req: FastifyRequest,
    reply: FastifyReply,
    next: (err?: Error) => void,
  ) => Promise<unknown>;
  preSerialization?: (
    req: FastifyRequest,
    reply: FastifyReply,
    next: (err?: Error) => void,
    payload: unknown,
  ) => Promise<unknown>;
  onSend?: (
    req: FastifyRequest,
    reply: FastifyReply,
    next: (err?: Error) => void,
    payload: unknown,
  ) => Promise<unknown>;
  onResponse?: (
    req: FastifyRequest,
    reply: FastifyReply,
    next: (err?: Error) => void,
  ) => Promise<unknown>;
  onError?: (
    req: FastifyRequest,
    reply: FastifyReply,
    next: (err?: Error) => void,
    error: Error,
  ) => Promise<unknown>;
  onTimeout?: (
    req: FastifyRequest,
    reply: FastifyReply,
    next: (err?: Error) => void,
  ) => Promise<unknown>;
  onRequestAbort?: (
    req: FastifyRequest,
    reply: FastifyReply,
    next: (err?: Error) => void,
  ) => Promise<unknown>;
}

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
