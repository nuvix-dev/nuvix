import { IsCustomID, IsUID } from '@nuvix/core/validators'
import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator'

export class CreateProjectDTO {
  /**
   * Unique Id. Choose a custom ID or generate a random ID with `ID.unique()`. Valid chars are a-z, and hyphen. Can\'t start with a special char. Max length is 36 chars.'
   */
  @IsCustomID()
  declare projectId: string

  /**
   * Project name. Max length: 128 chars.
   */
  @IsNotEmpty()
  @IsString()
  declare name: string

  /**
   * Team unique ID.
   */
  @IsString()
  @IsNotEmpty()
  declare teamId: string

  /**
   * Database password.
   */
  @IsString()
  @IsNotEmpty()
  @Length(6)
  declare password: string

  /**
   * Project Region.
   */
  @IsString()
  @IsNotEmpty()
  declare region: string

  /**
   * Project description. Max length: 256 chars.
   */
  @IsOptional()
  @IsString()
  description?: string

  /**
   * Project logo.
   */
  @IsOptional()
  @IsString()
  logo?: string

  /**
   * Project URL.
   */
  @IsOptional()
  @IsString()
  url?: string
}

// Params

export class ProjectParamsDTO {
  /**
   * Project ID.
   */
  @IsUID()
  declare projectId: string
}
