export const TokenType = {
  VERIFICATION: 2,
  RECOVERY: 3,
  INVITE: 4,
  MAGIC_URL: 5,
  PHONE: 6,
  OAUTH2: 7,
  GENERIC: 8,
  EMAIL: 9,
} as const

export type TokenType = (typeof TokenType)[keyof typeof TokenType]
