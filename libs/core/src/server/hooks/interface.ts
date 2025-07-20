import { LifecycleHook } from 'fastify/types/hooks';

export type Hooks = LifecycleHook;

export type AsyncHook<T extends any[] = []> = (
  req: NuvixRequest,
  reply: NuvixRes,
  next: (err?: Error) => void,
  ...args: T
) => Promise<unknown>;

export interface LifecycleHookMethods {
  /**
   * Triggered before the request is processed.
   * Useful for tasks like authentication or logging.
   */
  onRequest(
    req: NuvixRequest,
    reply: NuvixRes,
    next: (err?: Error) => void,
  ): Promise<unknown>;

  /**
   * Triggered before the request body is parsed.
   * Useful for modifying or validating raw payload data.
   */
  preParsing(
    req: NuvixRequest,
    reply: NuvixRes,
    next: (err?: Error) => void,
    payload: unknown,
  ): Promise<unknown>;

  /**
   * Triggered before the request is validated.
   * Useful for custom validation logic or preprocessing.
   */
  preValidation(
    req: NuvixRequest,
    reply: NuvixRes,
    next: (err?: Error) => void,
  ): Promise<unknown>;

  /**
   * Triggered before the request handler is executed.
   * Useful for tasks like authorization or setting up context.
   */
  preHandler(
    req: NuvixRequest,
    reply: NuvixRes,
    next: (err?: Error) => void,
  ): Promise<unknown>;

  /**
   * Triggered before the response is serialized.
   * Useful for modifying the response payload before sending it.
   */
  preSerialization(
    req: NuvixRequest,
    reply: NuvixRes,
    next: (err?: Error) => void,
    // payload: unknown,
  ): Promise<unknown>;

  /**
   * Triggered before the response is sent to the client.
   * Useful for adding headers or modifying the response.
   */
  onSend(
    req: NuvixRequest,
    reply: NuvixRes,
    next: (err?: Error) => void,
    // payload: unknown,
  ): Promise<unknown>;

  /**
   * Triggered after the response is sent to the client.
   * Useful for cleanup tasks or logging.
   */
  onResponse(
    req: NuvixRequest,
    reply: NuvixRes,
    next: (err?: Error) => void,
  ): Promise<unknown>;

  /**
   * Triggered when an error occurs during request processing.
   * Useful for custom error handling or logging.
   */
  onError(
    req: NuvixRequest,
    reply: NuvixRes,
    next: (err?: Error) => void,
    error: Error, // TODO: -----
  ): Promise<unknown>;

  /**
   * Triggered when a request times out.
   * Useful for handling timeout-specific logic.
   */
  onTimeout(
    req: NuvixRequest,
    reply: NuvixRes,
    next: (err?: Error) => void,
  ): Promise<unknown>;

  /**
   * Triggered when a request is aborted by the client.
   * Useful for cleanup or logging aborted requests.
   */
  onRequestAbort(
    req: NuvixRequest,
    reply: NuvixRes,
    next: (err?: Error) => void,
  ): Promise<unknown>;
}

export type HookMethod = keyof LifecycleHookMethods;

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
