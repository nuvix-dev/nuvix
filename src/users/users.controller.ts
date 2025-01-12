import { Body, Controller, Get, Param, Post, Query, UseInterceptors } from '@nestjs/common';
import { UsersService } from './users.service';
import { UserModel } from 'src/core/models/User.model';
import { CreateUserDto } from './dto/user.dto';
import { CreateTargetDto } from './dto/target.dto';
import { ResolverInterceptor, ResponseType } from 'src/core/resolver/response.resolver';

@Controller({ version: ['1'], path: 'users' })
@UseInterceptors(ResolverInterceptor)
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Get()
  @ResponseType({ type: UserModel, list: true })
  async findAll(
    @Query('queries') queries: string[],
    @Query('search') search: string,
  ) {
    return await this.usersService.findAll(queries, search);
  }

  @Post()
  @ResponseType({ type: UserModel })
  async create(
    @Body() createUserDto: CreateUserDto
  ) {
    return await this.usersService.create(createUserDto);
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

  @Get('temp/migrate')
  async migrate() {
    return this.usersService.tempDoMigrations();
  }

  @Get('temp/unmigrate')
  async unmigrate() {
    return await this.usersService.tempUndoMigrations();
  }

  @Get(':id')
  @ResponseType({ type: UserModel })
  async findOne(
    @Param('id') id: string
  ) {
    return await this.usersService.findOne(id);
  }

  @Post(':id/targets')
  async addTarget(
    @Param('id') id: string,
    @Body() createTargetDto: CreateTargetDto
  ): Promise<any> {
    return await this.usersService.createTarget(id, createTargetDto);
  }
}
