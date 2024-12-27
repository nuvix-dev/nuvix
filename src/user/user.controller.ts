import { Controller, Get, Post, Body, Patch, Param, Delete, Headers, UseGuards, Req, Res } from '@nestjs/common';
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
    console.log(req.user)
    return this.userService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: Request, @Res() res: Response) {
    let user = req.user as any
    delete user?.session;
    return res.json(user)
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

  @UseGuards(JwtAuthGuard)
  @Get('organization')
  async findOrganizations(@Req() req: Request) {
    let orgs = await this.userService.findUserOrganizations(req.user.id)
    return orgs;
  }

  @UseGuards(JwtAuthGuard)
  @Post('organization')
  async createOrganization(@Req() req: Request, @Body() createOrgDto: CreateOrgDto) {
    if (!createOrgDto.$id || !createOrgDto.name) throw new Exception(Exception.MISSING_REQUIRED_PARMS, "Please provide `$id` and `name` fields in body.")
    return await this.userService.createOrganization(req.user.id, createOrgDto)
  }

  @UseGuards(JwtAuthGuard)
  @Get('organization/:id')
  async findOneOrganization(@Param('id') id: string, @Req() req: Request) {
    let org = await this.userService.findOneOrganization(id, req.user.id)
    if (org) {
      return org
    }
    throw new Exception(null, "Organization not found.", 404)
  }

  @UseGuards(JwtAuthGuard)
  @Patch('organization/:id')
  async updateOrganization(@Param('id') id: string, @Req() req, @Body() input: UpdateOrgDto) {
    return await this.userService.updateOrganization(id, req.user.id, input)
  }

  @UseGuards(JwtAuthGuard)
  @Delete('organization/:id')
  async deleteOrganization(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    await this.userService.deleteOrganization(id, req.user.id)
    return res.status(200).json({
      success: true,
      message: "Organization deleted successfully."
    })
  }
}
