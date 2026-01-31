import { faker } from '@faker-js/faker'
import { ID } from '@nuvix/db'
import { CreateTeamDTO } from 'apps/server/src/teams/DTO/team.dto'

export function buildCreateTeamDTO(
  overrides: Partial<CreateTeamDTO> = {},
): CreateTeamDTO {
  return {
    teamId: ID.unique(),
    name: faker.company.name(),
    roles: ['owner'],
    ...overrides,
  }
}
