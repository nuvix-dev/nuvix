import { IsIn, IsInt, IsString } from 'class-validator';

type PrivilegeType =
  | 'ALL'
  | 'SELECT'
  | 'INSERT'
  | 'UPDATE'
  | 'DELETE'
  | 'TRUNCATE'
  | 'REFERENCES'
  | 'TRIGGER'
  | 'MAINTAIN';

export class TablePrivilegeRevokeDTO {
  @IsInt()
  declare relation_id: number;

  @IsString()
  declare grantee: string;

  @IsIn([
    'ALL',
    'SELECT',
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'REFERENCES',
    'TRIGGER',
    'MAINTAIN',
  ])
  declare privilege_type: PrivilegeType;
}
