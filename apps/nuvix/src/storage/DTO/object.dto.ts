import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { IsUID } from '@nuvix/core/validators';

export class CreateFolderDTO {
  /**
   * The name of the folder.
   */
  @IsNotEmpty()
  @IsString()
  @Length(1, 255)
  @Matches(/^[a-zA-Z0-9-_]+$/, {
    message:
      'Folder name can only contain letters, numbers, dashes, and underscores',
  })
  name: string;

  /**
   * The metadata of the folder.
   */
  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;

  /**
   * permissions
   */
  @IsOptional()
  @IsString({ each: true })
  permissions?: string[];
}

export class UploadFileDTO {
  @IsUID()
  fileId: string;
  /**
   * The name of the file.
   */
  @IsNotEmpty()
  @IsString()
  @Length(1, 255)
  @Matches(/^[a-zA-Z0-9-_]+$/, {
    message:
      'File name can only contain letters, numbers, dashes, and underscores',
  })
  name: string;

  /**
   * The metadata of the file.
   */
  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;

  /**
   * permissions
   */
  @IsOptional()
  @IsString({ each: true })
  permissions?: string[];
}
