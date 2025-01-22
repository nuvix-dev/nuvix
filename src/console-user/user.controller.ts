import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Headers,
  Req,
  Res,
  Put,
  UseInterceptors,
  ClassSerializerInterceptor,
  Query,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Request, Response } from 'express';
import { Public } from 'src/Utils/decorator';
import { InjectModel } from '@nestjs/mongoose';
import { Organization } from './schemas/organization.schema';
import { Model } from 'mongoose';

@Controller({ version: ['1'], path: 'console/users' })
@UseInterceptors(ClassSerializerInterceptor)
export class UserController {
  constructor(
    private readonly userService: UserService,
    @InjectModel(Organization.name, 'server')
    private readonly orgModel: Model<Organization>,
  ) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Get()
  @Public()
  findAll(@Headers() headers, @Req() req) {
    // console.log(req.user);
    return this.userService.findAll();
  }

  @Get('me')
  me(@Req() req: Request, @Res() res: Response) {
    const user = req.user as any;
    delete user?.session;
    return res.json(user);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(+id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userService.remove(+id);
  }
}
