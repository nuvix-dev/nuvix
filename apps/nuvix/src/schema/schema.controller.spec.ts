import { Test, TestingModule } from '@nestjs/testing';
import { SchemaController } from './schema.controller';
import { SchemaService } from './schema.service';

describe('SchemaController', () => {
  let controller: SchemaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SchemaController],
      providers: [SchemaService],
    }).compile();

    controller = module.get<SchemaController>(SchemaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
