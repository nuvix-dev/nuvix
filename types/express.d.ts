import { Request } from 'express';
import { UserDocument } from 'src/user/schemas/user.schema';

declare global {
    namespace Express {
        interface User extends Partial<UserDocument | null> {

        }

    }
}