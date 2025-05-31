import { Controller } from '@nestjs/common';
import { MessagingService } from './messaging.service';

@Controller('messaging')
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}
}
