import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Headers,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from 'src/account/jwt-auth.guard';
import { Request, Response } from 'express';
import { Exception } from 'src/core/extend/exception';
import { CreateOrgDto, UpdateOrgDto } from './dto/org.dto';

@Controller()
export class UserController {
  constructor(private readonly userService: UserService) { }

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Headers() headers, @Req() req) {
    console.log(req.user);
    return this.userService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: Request, @Res() res: Response) {
    const user = req.user as any;
    delete user?.session;
    return res.json(user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('organizations')
  async findOrganizations(@Req() req: Request, @Res() res: Response) {
    const orgs = await this.userService.findUserOrganizations(req.user.id);
    return res.json({
      total: orgs.length,
      organizations: orgs
    }).status(200)
  }

  @UseGuards(JwtAuthGuard)
  @Post('organizations')
  async createOrganization(
    @Req() req: Request,
    @Body() createOrgDto: CreateOrgDto,
  ) {
    if (!createOrgDto.organizationId || !createOrgDto.name)
      throw new Exception(
        Exception.MISSING_REQUIRED_PARMS,
        'Please provide `organizationId` and `name` fields in body.',
      );
    return await this.userService.createOrganization(req.user.id, createOrgDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('organizations/:id')
  async findOneOrganization(@Param('id') id: string, @Req() req: Request) {
    const org = await this.userService.findOneOrganization(id, req.user.id);
    if (org) {
      return org;
    }
    throw new Exception(null, 'Organization not found.', 404);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('organizations/:id')
  async updateOrganization(
    @Param('id') id: string,
    @Req() req,
    @Body() input: UpdateOrgDto,
  ) {
    return await this.userService.updateOrganization(id, req.user.id, input);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('organizations/:id')
  async deleteOrganization(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.userService.deleteOrganization(id, req.user.id);
    return res.status(200).json({
      success: true,
      message: 'Organization deleted successfully.',
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Res() res: Response) {
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
