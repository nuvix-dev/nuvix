import { Test, TestingModule } from '@nestjs/testing'
import { AvatarsController } from './avatars.controller'
import { AvatarsService } from './avatars.service'

describe('AvatarsController', () => {
  let controller: AvatarsController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AvatarsController],
      providers: [AvatarsService],
    }).compile()

    controller = module.get<AvatarsController>(AvatarsController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})
