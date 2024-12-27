import { Headers, Injectable, Req, Res } from '@nestjs/common';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { UserService } from 'src/user/user.service';
import emailValidator from 'src/core/validators/common.validator';
import { Request, Response } from 'express';
import { InjectModel } from '@nestjs/mongoose';
import { Session } from './schemas/account.schema';
import { Model } from 'mongoose';
import { User, UserDocument } from 'src/user/schemas/user.schema';
import { JwtService } from '@nestjs/jwt';
import { Exception } from 'src/core/extend/exception';
import { ID } from 'src/core/helper/ID.helper';

@Injectable()
export class AccountService {
  constructor(
    private readonly userSerice: UserService,
    @InjectModel(Session.name, 'server')
    private readonly sessionModel: Model<Session>,
    private jwtService: JwtService
  ) { }

  create(createAccountDto: CreateAccountDto) {
    return 'This action adds a new account';
  }

  findAll() {
    return `This action returns all account`;
  }

  findOne(id: number) {
    return `This action returns a #${id} account`;
  }

  update(id: number, updateAccountDto: UpdateAccountDto) {
    return `This action updates a #${id} account`;
  }

  remove(id: number) {
    return `This action removes a #${id} account`;
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
      let session = await this.sessionModel.findOne({ where: { refreshToken: token } })
      if (session && session.refreshTokenExpires > new Date()) {
        session.accessToken = this.jwtService.sign({ _id: session.id })
        await session.save()
        return session.accessToken
      } else throw new Exception(null, 'Refresh token expired or session invalid.', 403)
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
        userAgent: userAgent,
        ipAddress: ipAddress,
        location: location,
        device: device,
        userId: user.id,
        accessToken: "--",
        accessTokenExpires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
        refreshToken: refresh_token,
        refreshTokenExpires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
      })
      if (!session || !session.$isValid) throw new Error("Session validation error.");
      session.accessToken = this.jwtService.sign({ _id: session.id })
      await session.save()
      return {
        success: true,
        session: session
      }
    } catch (e) {
      console.log('[SESSION:CREATE] ', e)
      return {
        success: false,
        message: "An error occured while creating session."
      }
    }
  }
}
