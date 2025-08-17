import { IsOptional, IsString } from 'class-validator';

export class ColumnPrivilegeGrantDTO {
  @IsString()
  declare grantee: string;

  @IsString()
  declare privilege_type: 'SELECT' | 'INSERT' | 'UPDATE' | 'REFERENCES' | 'ALL';

  @IsOptional()
  @IsString()
  declare column_id: string;

  @IsOptional()
  is_grantable?: boolean;
}
