import { Headers, Injectable, Logger, Req, Res } from '@nestjs/common';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { UserService } from 'src/user/user.service';
import emailValidator from 'src/core/validators/common.validator';
import { Request, Response } from 'express';
import { InjectModel } from '@nestjs/mongoose';
import { Session, SessionDocument } from './schemas/account.schema';
import { Model } from 'mongoose';
import { Target, User, UserDocument } from 'src/user/schemas/user.schema';
import { JwtService } from '@nestjs/jwt';
import { Exception } from 'src/core/extend/exception';
import { ID } from 'src/core/helper/ID.helper';
import { CreateEmailSessionDto } from './dto/create-email-session.dto';
import Permission from 'src/core/helper/permission.helper';
import Role from 'src/core/helper/role.helper';
import { validate } from 'class-validator';
import Permissions from 'src/core/validators/permissions.validator';

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name)

  constructor(
    private readonly userSerice: UserService,
    @InjectModel(Session.name, 'server')
    private readonly sessionModel: Model<Session>,
    @InjectModel(User.name, 'server')
    private readonly userModel: Model<User>,
    @InjectModel(Target.name, 'server')
    private readonly targetModel: Model<Target>,
    private jwtService: JwtService
  ) { }

  async create(createAccountDto: CreateAccountDto) {
    validate(createAccountDto).then(errors => {
      if (errors.length > 0) {
        throw new Exception(Exception.ATTRIBUTE_VALUE_INVALID)
      }
    })
    let userId = createAccountDto.userId === 'unique()' ? ID.unique() : createAccountDto.userId;
    try {
      let user = await this.userModel.create({
        id: userId,
        name: createAccountDto.name,
        email: createAccountDto.email,
        password: await this.userSerice.hashPassword(createAccountDto.password), // Hash the password
        registration: new Date(),
        status: true,
        $permissions: [
          Permission.Read(Role.Any()).toString(),
          Permission.Update(Role.User(userId)).toString(),
          Permission.Delete(Role.User(userId)).toString(),
        ]
      })
      await user.save()
      let target = await this.targetModel.create({
        id: ID.unique(),
        userId: user.$id,
        userInternalId: user._id,
        providerType: 'email',
        identifier: createAccountDto.email,
        $permissions: [
          Permission.Read(Role.User(userId)).toString(),
          Permission.Update(Role.User(userId)).toString(),
          Permission.Delete(Role.User(userId)).toString(),
        ]
      })
      await target.save()
      user.targets.push(target)
      await user.save()
      console.log(user)
      return user
    } catch (e) {
      console.log(e)
      throw new Exception(Exception.GENERAL_SERVER_ERROR)
    }
  }

  findAll() {
    let userId = ID.unique();
    return {
      id: [
        Permission.Read(Role.Any()).toString(),
        Permission.Update(Role.User(userId)).toString(),
        Permission.Delete(Role.User(userId)).toString(),
      ]
    }
  }


  findOne(id: string) {
    return this.userModel.findOne({ id: id });
  }

  update(id: number, updateAccountDto: UpdateAccountDto) {
    return `This action updates a #${id} account`;
  }

  async remove(id: string, userId: string) {
    let account = await this.userModel.findOne({ id: id });
    if (!account) {
      throw new Exception(Exception.USER_NOT_FOUND)
    }
    let isValid = new Permissions(0, [Permission.Delete(Role.User(userId)).toString()]).isValid(account.$permissions)
    if (!isValid) {
      throw new Exception(Exception.GENERAL_REGION_ACCESS_DENIED)
    }
    await this.targetModel.deleteMany({ userInternalId: account._id })
    await account.deleteOne()
  }

  async emailLogin(input: CreateEmailSessionDto, req: Request, headers: Request["headers"]): Promise<SessionDocument> {
    if (input.email !== undefined && input.password !== undefined && emailValidator(input.email)) {
      let user = await this.userSerice.findOneByEmail(input.email);
      if (!user || !user.password) {
        throw new Exception(Exception.USER_NOT_FOUND)
      }
      let isPasswordValid = await this.userSerice.comparePasswords(input.password, user.password);
      if (isPasswordValid) {
        let session = await this.createSession(user, req, headers);
        if (!session.success) {
          throw new Exception(undefined, "Session creation failed.", 200)
        }
        return session.session
      } else {
        throw new Exception(Exception.USER_PASSWORD_MISMATCH)
      }
    }
  }

  async login(loginDto: LoginDto, @Res() res: Response, @Req() req: Request, @Headers() headers: Request["headers"]) {
    if (loginDto.email !== undefined && loginDto.password !== undefined && emailValidator(loginDto.email)) {
      let user = await this.userSerice.findOneByEmail(loginDto.email);
      if (!user || !user.password) {
        return res.json({
          success: false,
          message: "User not found"
        })
      }
      let isPasswordValid = await this.userSerice.comparePasswords(loginDto.password, user.password);
      if (isPasswordValid) {
        let session = await this.createSession(user, req, headers);
        if (!session.success) {
          throw new Exception(undefined, "Session creation failed.", 200)
        }
        return res.json({
          success: true,
          message: "Login successful",
          session: session.session
        })
      } else {
        throw new Exception(Exception.USER_PASSWORD_MISMATCH)
      }
    }
  }

  async register(registerDto: RegisterDto, @Res() res: Response) {
    if (!registerDto.email || !registerDto.password) {
      throw new Exception(Exception.ATTRIBUTE_VALUE_INVALID)
    }
    try {
      let user = await this.userSerice.create(registerDto);
      if (user.$isValid)
        return res.json({
          success: true,
          message: "User created successfully"
        })
      else {
        return res.json({
          success: false,
          message: "User not created"
        })
      }
    } catch (e) {
      return res.json({
        success: false,
        message: "An error ocured while creating User."
      })
    }
  }

  async refreshToken(token: string) {
    if (!token) throw new Exception(null, 'Please include refreshToken in body to refresh the access token.', 401)
    try {
      // let session = await this.sessionModel.findOne({ where: { refreshToken: token } })
      // if (session && session.refreshTokenExpires > new Date()) {
      //   session.accessToken = this.jwtService.sign({ _id: session.id })
      //   await session.accessTokensave()
      //   return session.
      // } else throw new Exception(null, 'Refresh token expired or session invalid.', 403)
    } catch (err: any) {
      if (err instanceof Exception) {
        throw err
      } else throw new Exception(Exception.GENERAL_SERVER_ERROR)
    }
  }

  async createSession(user: UserDocument, @Req() req: Request, @Headers() headers: Request["headers"],) {
    let userAgent = headers['user-agent'];
    let ipAddress = req.ip;
    let location = req.headers['cf-ipcountry'];
    let device = req.headers['device'];
    let refresh_token = ID.unique(15);

    try {
      let session = await this.sessionModel.create({
        userId: user.id,
        userInternalId: user._id,
        provider: 'email',
        userAgent: userAgent,
        ip: ipAddress,
        countryName: location,
        deviceName: device,
        secret: "--",
        expire: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      })
      if (!session || !session.$isValid) throw new Error("Session validation error.");
      session.secret = this.jwtService.sign({ _id: session.id })
      await session.save()
      return {
        success: true,
        session: session
      }
    } catch (e) {
      this.logger.error('[SESSION:CREATE] ', e)
      return {
        success: false,
        message: "An error occured while creating session."
      }
    }
  }
}
