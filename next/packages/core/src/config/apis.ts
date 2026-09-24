export interface ApiItem {
  key: string
  name: string
}

export const apis: Record<string, ApiItem> = {
  rest: {
    key: 'rest',
    name: 'REST',
  },
} as const
