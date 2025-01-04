import { Controller, Get, Post, Body, Patch, Param, Delete, Req, UseGuards } from '@nestjs/common';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/console-account/jwt-auth.guard';
import { ProjectListModel, ProjectModel } from './models/project.model';

@Controller()
export class ProjectController {
  constructor(private readonly projectService: ProjectService) { }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() createProjectDto: CreateProjectDto, @Req() req: Request): Promise<ProjectModel> {
    const project = await this.projectService.create(createProjectDto)
    return new ProjectModel(project);
  }

  @Get()
  async findAll(): Promise<ProjectListModel> {
    let data = await this.projectService.findAll();
    return new ProjectListModel(data);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.projectService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProjectDto: UpdateProjectDto) {
    return this.projectService.update(+id, updateProjectDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.projectService.remove(+id);
  }
}
