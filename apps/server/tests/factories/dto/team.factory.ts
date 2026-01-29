import { faker } from '@faker-js/faker'
import { CreateTeamDTO } from 'apps/server/src/teams/DTO/team.dto'

export function buildCreateTeamDTO(
  overrides: Partial<CreateTeamDTO> = {},
): CreateTeamDTO {
  return {
    teamId: faker.string.alphanumeric(12),
    name: faker.company.name(),
    roles: ['owner'],
    ...overrides,
  }
}
