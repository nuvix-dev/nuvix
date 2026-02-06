import { Injectable } from '@nestjs/common'
import { CoreService } from '@nuvix/core'

@Injectable()
export class TemplatesService {
  constructor(private coreService: CoreService) {}
}
