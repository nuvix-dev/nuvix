export type * from './generated';
import { Doc } from '@nuvix-tech/db';

export type RecordDoc<T extends unknown = unknown> = Doc<Record<string, T>>;
