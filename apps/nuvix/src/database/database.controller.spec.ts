import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseController } from '../schema/collections/collections.controller';
import { DatabaseService } from '../schema/collections/collections.service';

describe('DatabaseController', () => {
  let controller: DatabaseController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DatabaseController],
      providers: [DatabaseService],
    }).compile();

    controller = module.get<DatabaseController>(DatabaseController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
