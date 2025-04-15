import { Test, TestingModule } from '@nestjs/testing';
import { BaseResolver } from './base.resolver';
import { BaseService } from './base.service';

describe('BaseResolver', () => {
  let resolver: BaseResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BaseResolver, BaseService],
    }).compile();

    resolver = module.get<BaseResolver>(BaseResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
