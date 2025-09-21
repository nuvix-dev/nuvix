import { Inject, Injectable } from '@nestjs/common';
import { CreateWaitlistDTO } from './DTO/waitlist.dto';
import { DB_FOR_PLATFORM, GEO_DB } from '@nuvix/utils';
import { Database, Doc, DuplicateException } from '@nuvix-tech/db';
import { CountryResponse, Reader } from 'maxmind';
import { Exception } from '@nuvix/core/extend/exception';

@Injectable()
export class UsersService {
  constructor(
    @Inject(DB_FOR_PLATFORM) private readonly db: Database,
    @Inject(GEO_DB) private readonly geoDb: Reader<CountryResponse>,
  ) {}
}
