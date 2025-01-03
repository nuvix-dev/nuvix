import { Request } from 'express';
import { UserDocument } from 'src/console-user/schemas/user.schema';

declare global {
    namespace Express {
        interface User extends Partial<UserDocument | null> {

        }

    }
}