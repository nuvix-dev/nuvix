import { Test, TestingModule } from '@nestjs/testing';
import { PgMetaService } from './pg-meta.service';

describe('PgMetaService', () => {
  let service: PgMetaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PgMetaService],
    }).compile();

    service = module.get<PgMetaService>(PgMetaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
