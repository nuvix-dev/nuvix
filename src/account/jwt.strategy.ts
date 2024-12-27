import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { JWT_SECRET } from 'src/Utils/constants';
import { Request } from 'express';
import { InjectModel } from '@nestjs/mongoose';
import { Session } from './schemas/account.schema';
import { Model } from 'mongoose';
import { User } from 'src/user/schemas/user.schema';

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
                }
                return token || ExtractJwt.fromAuthHeaderAsBearerToken;
            },
            ignoreExpiration: false,
            secretOrKey: JWT_SECRET,
        });
    }

    async validate(payload: any) {
        if (!payload) return null;
        let session = await this.sessionModel.findById(payload._id);
        if (!session || !session.$isValid) return null;
        let user = await this.userModel.findById(session.userId);
        if (!user || !user.$isValid) return null;
        user.password = null
        user.session = session
        return user
    }
}