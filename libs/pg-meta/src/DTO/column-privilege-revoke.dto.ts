import { IsString } from 'class-validator';

export class ColumnPrivilegeRevokeDTO {
  @IsString()
  column_id: string;

  @IsString()
  grantee: string;

  @IsString()
  privilege_type: 'SELECT' | 'INSERT' | 'UPDATE' | 'REFERENCES' | 'ALL';
}
