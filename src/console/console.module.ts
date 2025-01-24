import { Module } from '@nestjs/common';
import { ConsoleService } from './console.service';
import { ConsoleController } from './console.controller';
import { AccountModule } from './account/account.module';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';

@Module({
  controllers: [ConsoleController],
  providers: [ConsoleService],
  imports: [AccountModule, UsersModule, OrganizationsModule],
})
export class ConsoleModule {}
