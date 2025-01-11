import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { UserModel, UsersListModel } from 'src/core/models/user.model';
import { CreateUserDto } from './dto/user.dto';
import { CreateTargetDto } from './dto/target.dto';

@Controller({ version: ['1'], path: 'users' })
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Get()
  async findAll(
    @Query('queries') queries: string[],
    @Query('search') search: string,
  ): Promise<UsersListModel> {
    return new UsersListModel(await this.usersService.findAll(queries, search));
  }

  @Post()
  async create(
    @Body() createUserDto: CreateUserDto
  ): Promise<UserModel> {
    return new UserModel(await this.usersService.create(createUserDto));
  }

  @Post('argon2')
  async createWithArgon2(
    @Body() createUserDto: CreateUserDto
  ): Promise<UserModel> {
    return new UserModel(await this.usersService.createWithArgon2(createUserDto));
  }

  @Post('bcrypt')
  async createWithBcrypt(
    @Body() createUserDto: CreateUserDto
  ): Promise<UserModel> {
    return new UserModel(await this.usersService.createWithBcrypt(createUserDto));
  }

  @Post('md5')
  async createWithMd5(
    @Body() createUserDto: CreateUserDto
  ): Promise<UserModel> {
    return new UserModel(await this.usersService.createWithMd5(createUserDto));
  }

  @Post('sha')
  async createWithSha(
    @Body() createUserDto: CreateUserDto
  ): Promise<UserModel> {
    return new UserModel(await this.usersService.createWithSha(createUserDto));
  }

  @Post('phpass')
  async createWithPhpass(
    @Body() createUserDto: CreateUserDto
  ): Promise<UserModel> {
    return new UserModel(await this.usersService.createWithPhpass(createUserDto));
  }

  @Post('scrypt')
  async createWithScrypt(
    @Body() createUserDto: CreateUserDto
  ): Promise<UserModel> {
    return new UserModel(await this.usersService.createWithScrypt(createUserDto));
  }

  @Post('scrypt-modified')
  async createWithScryptModified(
    @Body() createUserDto: CreateUserDto
  ): Promise<UserModel> {
    return new UserModel(await this.usersService.createWithScryptMod(createUserDto));
  }

  @Post(':id/targets')
  async addTarget(
    @Param('id') id: string,
    @Body() createTargetDto: CreateTargetDto
  ): Promise<any> {
    return await this.usersService.createTarget(id, createTargetDto);
  }
}
