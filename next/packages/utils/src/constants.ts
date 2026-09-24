/**
 * Queue names used across Nuvix v2.
 * Mirrors legacy QueueFor enum 1:1.
 */
export enum QueueFor {
  AUDITS = 'audits',
  PROJECTS = 'projects',
  MESSAGING = 'messaging',
  MAILS = 'mails',
  STATS = 'stats',
  LOGS = 'logs',
  DELETES = 'deletes',
  WEBHOOKS = 'webhooks',
  BATCH = 'batch',
}

export const EVENT_DELIMITER = '.'
