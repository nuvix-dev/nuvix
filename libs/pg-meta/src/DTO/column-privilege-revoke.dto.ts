import { IsString } from 'class-validator';

export class ColumnPrivilegeRevokeDTO {
  @IsString()
  declare column_id: string;

  @IsString()
  declare grantee: string;

  @IsString()
  declare privilege_type: 'SELECT' | 'INSERT' | 'UPDATE' | 'REFERENCES' | 'ALL';
}
