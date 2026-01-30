import { faker } from '@faker-js/faker'

export interface CreateFileDTO {
  fileId: string
  permissions?: string[]
}

export function buildCreateFileDTO(
  overrides: Partial<CreateFileDTO> = {},
): CreateFileDTO {
  return {
    fileId: faker.string.alphanumeric(12),
    permissions: [],
    ...overrides,
  }
}

export function buildUpdateFileDTO(
  overrides: { name?: string; permissions?: string[] } = {},
): { name?: string; permissions?: string[] } {
  return {
    name: overrides.name ?? faker.system.fileName(),
    permissions: overrides.permissions ?? [],
    ...overrides,
  }
}
