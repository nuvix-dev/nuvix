import { IsOptional, IsString } from 'class-validator';

export class ColumnPrivilegeGrantDTO {
  @IsString()
  grantee: string;

  @IsString()
  privilege_type: 'SELECT' | 'INSERT' | 'UPDATE' | 'REFERENCES' | 'ALL';

  @IsOptional()
  @IsString()
  column_id: string;

  @IsOptional()
  is_grantable?: boolean;
}
