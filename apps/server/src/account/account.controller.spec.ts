import { Test, TestingModule } from '@nuvix/core/server/test'
import { AccountController } from './account.controller'
import { AccountService } from './account.service'
import { CoreModule } from '@nuvix/core'

describe('AccountController', () => {
  let controller: AccountController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [CoreModule],
      controllers: [AccountController],
      providers: [AccountService],
    }).compile()

    controller = module.get<AccountController>(AccountController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})
