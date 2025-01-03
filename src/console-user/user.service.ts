import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './schemas/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { CreateOrgDto, UpdateOrgDto } from './dto/org.dto';
import { Exception } from 'src/core/extend/exception';
import { ID } from 'src/core/helper/ID.helper';
import { Organization, OrganizationDocument } from './schemas/organization.schema';
import { Membership } from './schemas/membersip.schema';
import { UpdateEmailDto } from 'src/console-account/dto/update-account.dto';

@Injectable()
export class UserService {

  constructor(
    @InjectModel(User.name, 'server')
    private readonly userModel: Model<User>,
    @InjectModel(Organization.name, 'server')
    private readonly orgModel: Model<Organization>,
    @InjectModel(Membership.name, 'server') private readonly membershipModel: Model<Membership>
  ) { }

  async create(createUserDto: CreateUserDto) {
    let password = await this.hashPassword(createUserDto.password);
    createUserDto.password = password;
    let user = this.userModel.create(createUserDto);
    return user;
  }

  findAll() {
    return this.userModel.find();
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

  async updateEmail(userId: string, updateEmailDto: UpdateEmailDto) {
    let user = await this.userModel.findOne({ id: userId });
    if (!user) throw new Exception(Exception.USER_NOT_FOUND);
    let authorized = await this.comparePasswords(updateEmailDto.password, user.password);
    if (!authorized) throw new Exception(Exception.USER_UNAUTHORIZED);
    user.email = updateEmailDto.email;
    /**
     * @todo Email Verification ...
     **/
    await user.save();
    return user;
  }

  async findOneOrganization(id: string, userId: string) {
    let org = await this.orgModel.findOne(
      { id: id }
    )
    return org
  }

  async findUserOrganizations(userId: string): Promise<OrganizationDocument[]> {
    return await this.orgModel.find().exec();
  }

  async createOrganization(user: Express.User, input: CreateOrgDto): Promise<Organization> {
    try {
      // Create a new Organization document
      input.organizationId = ID.auto(input.organizationId);
      const createdOrg = new this.orgModel({
        id: input.organizationId,
        ...input,
        total: 1
      });

      const savedOrg = await createdOrg.save();

      // Create a new Membership document for the user as the owner of the organization
      const member = await this.membershipModel.create({
        id: ID.unique(),
        userId: user.id,
        orgId: createdOrg.id,
        roles: ['owner'],
        userEmail: user.email,
        userName: user.name,
        invited: new Date(),
        joined: new Date(),
        confirm: true,
        orgName: createdOrg.name,
        mfa: false
      });

      await member.save();
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
      const org = await this.orgModel.findOne({ id: id, }).exec(); // exec() for a proper Promise

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
      const org = await this.orgModel.findOneAndDelete({ id: id, }).exec(); // exec() for a proper Promise

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

  async getOrganizationMembers(id: string) {
    let members = await this.membershipModel.find({ orgId: id })
    return members;
  }

  /**
 * Retrieves the preferences of a user by their ID.
 *
 * @param userId - The unique identifier of the user.
 * @returns A promise that resolves to the user's preferences object. If the user has no preferences, an empty object is returned.
 * @throws Exception if the user is not found.
 */
  async getPrefs(userId: string) {
    let user = await this.userModel.findOne({ id: userId })
    await user.save()
    if (!user) throw new Exception(Exception.USER_NOT_FOUND)
    return user.prefs ?? {}
  }

  /**
   * Updates the preferences of a user.
   *
   * @param userId - The ID of the user whose preferences are to be updated.
   * @param prefs - The new preferences to be set for the user.
   * @returns The updated preferences of the user.
   * @throws Exception if the user is not found.
   */
  async updatePrefs(userId: string, prefs: any) {
    let user = await this.userModel.findOne({ id: userId })
    if (!user) throw new Exception(Exception.USER_NOT_FOUND)
    user.prefs = prefs
    await user.save()
    return user.prefs ?? {}
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
