import { Test, TestingModule } from '@nuvix/core/server/test'
import { MessagingController } from './messaging.controller'
import { MessagingService } from './messaging.service'

describe('MessagingController', () => {
  let controller: MessagingController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessagingController],
      providers: [MessagingService],
    }).compile()

    controller = module.get<MessagingController>(MessagingController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})
