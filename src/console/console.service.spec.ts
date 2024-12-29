import { Test, TestingModule } from '@nestjs/testing';
import { ConsoleService } from './console.service';

describe('ConsoleService', () => {
  let service: ConsoleService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConsoleService],
    }).compile();

    service = module.get<ConsoleService>(ConsoleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
