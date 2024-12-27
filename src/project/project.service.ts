import { Injectable } from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Project } from './schemas/project.schema';
import { Model } from 'mongoose';
import { Exception } from 'src/core/extend/exception';
import { Organization } from 'src/user/schemas/user.schema';

@Injectable()
export class ProjectService {
  constructor(
    @InjectModel(Project.name, 'server') private readonly projectModel: Model<Project>,
    @InjectModel(Organization.name, 'server') private readonly orgModel: Model<Organization>

  ) { }

  async create(createProjectDto: CreateProjectDto, userId: string): Promise<Project> {
    try {
      let org = await this.orgModel.findOne({ $id: createProjectDto.orgnizationId, $userId: userId })
      if (!org) throw new Exception(Exception.DOCUMENT_NOT_FOUND, "Organization not found.")

      const createdProject = new this.projectModel({
        ...createProjectDto,
        $userIduserId: userId, // Associate the project with the user
      });

      const savedProject = await createdProject.save();
      return savedProject;
    } catch (error) {
      if (error instanceof Exception) {
        throw error
      }
      else if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors)
          .map((val: any) => val.message)
          .join(', ');
        throw new Exception(null, `Validation failed: ${messages}`);
      }
      else if (error.code === 11000) { // Handle duplicate key errors
        // Check which field caused the duplicate key error. Adapt to your needs.
        if (error.keyPattern && error.keyPattern.name === 1) {
          throw new Exception(null, 'Project with this name already exists.');
        } else {
          console.error("Duplicate key error details:", error);
          throw new Exception(null, 'Duplicate key error occurred.');
        }
      } else {
        console.error('Error creating project:', error); // Log the error for debugging
        throw new Exception(null, 'Failed to create project.');
      }
    }
  }

  findAll() {
    return this.projectModel.find()
  }

  findOne(id: number) {
    return this.projectModel.findOne({ $id: id })
  }

  update(id: number, updateProjectDto: UpdateProjectDto) {
    return `This action updates a #${id} project`;
  }

  remove(id: number) {
    return `This action removes a #${id} project`;
  }
}
