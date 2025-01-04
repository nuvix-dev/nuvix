import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, Req } from '@nestjs/common';
import { JWT_SECRET } from 'src/Utils/constants';
import { Request } from 'express';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from 'src/console-user/schemas/user.schema';
import { Session } from './schemas/account.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectModel(Session.name, 'server')
    private readonly sessionModel: Model<Session>,
    @InjectModel(User.name, 'server')
    private readonly userModel: Model<User>,
  ) {
    super({
      jwtFromRequest: (req: Request) => {
        let token = null;
        if (req && req.headers) {
          token = req.headers['x-nuvix-jwt'];
          if (!token) token = req.cookies["a_session"]
        }
        return token || ExtractJwt.fromAuthHeaderAsBearerToken;
      },
      ignoreExpiration: true,
      secretOrKey: JWT_SECRET,
    });
  }

  async validate(payload: any) {
    if (!payload) return null;
    const session = await this.sessionModel.findOne({ id: payload._id });
    if (!session || !session.$isValid) return null;
    const user = await this.userModel.findOne({ id: session.userId }).select('-password');
    if (!user) return null;
    user.session = session;
    return user as UserDocument;
  }
}
