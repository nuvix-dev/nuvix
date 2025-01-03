import { Exclude } from "class-transformer";
import { UserModel } from "src/console-user/models/user.model";

@Exclude()
export class AccountModel extends UserModel {

  @Exclude() override password?: string;
  @Exclude() hash?: string;
  @Exclude() hashOptions?: object;

}