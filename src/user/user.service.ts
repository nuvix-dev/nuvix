import { Injectable, UseGuards } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Organization, User } from './schemas/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { CreateOrgDto, UpdateOrgDto } from './dto/org.dto';
import { Exception } from 'src/core/extend/exception';

@Injectable()
export class UserService {

  constructor(
    @InjectModel(User.name, 'server')
    private readonly userModel: Model<User>,
    @InjectModel(Organization.name, 'server')
    private readonly orgModel: Model<Organization>,
  ) { }

  async create(createUserDto: CreateUserDto) {
    let password = await this.hashPassword(createUserDto.password);
    createUserDto.password = password;
    let user = this.userModel.create(createUserDto);
    return user;
  }

  findAll() {
    return `This action returns all user`;
  }

  findOne(id: number) {
    return `This action returns a #${id} user`;
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }

  async findOneOrganization(id: string, userId: string) {
    let org = await this.orgModel.findOne({
      where: { $id: id, $userId: userId }
    })
    return org
  }

  async findUserOrganizations(userId: string) {
    return await this.orgModel.find({
      where: { $userId: userId }
    })
  }

  async createOrganization(userId: string, input: CreateOrgDto): Promise<Organization> {
    try {
      // Create a new Organization document
      const createdOrg = new this.orgModel({
        ...input,
        $userId: userId, // Associate the organization with the user
      });

      // Save the new organization to the database
      const savedOrg = await createdOrg.save();

      return savedOrg;
    } catch (error) {
      if (error.name === 'ValidationError') {
        // Handle Mongoose validation errors
        const messages = Object.values(error.errors).map((val: any) => val.message);
        const errorMessage = messages.join(', '); // Join messages with comma and space
        throw new Exception(null, `Validation failed: ${errorMessage}`);
      } else if (error.code === 11000 && error.keyPattern && error.keyPattern.name === 1) {
        // Handle duplicate key error (e.g., duplicate organization name)
        throw new Exception(null, 'Organization with this name already exists.');
      }
      else {
        // Handle other errors
        console.error('Error creating organization:', error);
        throw new Exception(null, 'Failed to create organization.');
      }
    }
  }

  async updateOrganization(id: string, userId: string, input: UpdateOrgDto): Promise<Organization> {
    try {
      // Find the organization by ID and user ID
      const org = await this.orgModel.findOne({ $id: id, $userId: userId }).exec(); // exec() for a proper Promise

      if (!org) {
        throw new Exception(null, 'Organization not found.');
      }

      // Update the organization with the provided input
      Object.assign(org, input); // Efficiently update the document

      // Save the updated organization
      const updatedOrg = await org.save();

      return updatedOrg;

    } catch (error) {
      if (error instanceof Exception) {
        throw error; // Re-throw custom exceptions
      } else {
        // Handle other potential errors (e.g., validation errors)
        console.error("Error updating organization:", error);
        throw new Exception(null, "Failed to update organization."); // Wrap other errors in custom exception
      }
    }
  }

  async deleteOrganization(id: string, userId: string) {
    try {
      // Find the organization by ID and user ID
      const org = await this.orgModel.findOneAndDelete({ $id: id, $userId: userId }).exec(); // exec() for a proper Promise

      if (!org) {
        throw new Exception(null, 'Organization not found.');
      }
      return org;
    } catch (error) {
      if (error instanceof Exception) {
        throw error; // Re-throw custom exceptions
      } else {
        // Handle other potential errors (e.g., validation errors)
        console.error("Error deleting organization:", error);
        throw new Exception(null, "Failed to delete organization."); // Wrap other errors in custom exception
      }
    }
  }

  async findOneByEmail(email: string) {
    let user = await this.userModel.findOne({ email: email });
    return user;
  }

  async hashPassword(password: string) {
    const saltRounds = 12;  // Higher is more secure but slower
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    return hashedPassword;
  }

  async comparePasswords(newPassword: string, oldPassword: string) {
    return await bcrypt.compare(newPassword, oldPassword);
  }
}
