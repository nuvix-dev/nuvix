import { Inject, Injectable, Logger, Scope } from '@nestjs/common';
import { UserEntity } from 'src/core/entities/users/user.entity';
import { DataSource, Repository } from 'typeorm';

@Injectable({ scope: Scope.REQUEST })
export class UsersService {
  private userRepo: Repository<UserEntity>;
  constructor(
    @Inject('CONNECTION') private readonly dataSource: DataSource
  ) {
    this.userRepo = this.dataSource.getRepository(UserEntity);
  }
  private logger = new Logger(UsersService.name)
  async ping() {
    this.logger.log(this.dataSource.migrations)
    let m = await this.dataSource.runMigrations()
    this.logger.log(m)
    return await this.userRepo.find();
  }

}
