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
  relation_id: number;

  @IsString()
  grantee: string;

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
  privilege_type: PrivilegeType;
}
