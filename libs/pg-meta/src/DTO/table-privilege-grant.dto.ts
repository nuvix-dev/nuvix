import { IsBoolean, IsIn, IsInt, IsOptional, IsString } from 'class-validator';

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

export class TablePrivilegeGrantDTO {
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

  @IsOptional()
  @IsBoolean()
  is_grantable?: boolean;
}
