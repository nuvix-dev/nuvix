import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard, Public } from '@nuvix/core/resolvers/guards/auth.guard';
import { ResponseInterceptor } from '@nuvix/core/resolvers/interceptors/response.interceptor';
import { InternalService } from './internal.service';
import { CreateFeedbackDTO } from './DTO/feedback.dto';
import { Throttle, User } from '@nuvix/core/decorators';
import type { UsersDoc } from '@nuvix/utils/types';

@Controller('internal')
@UseGuards(AuthGuard)
@UseInterceptors(ResponseInterceptor)
export class InternalController {
  constructor(private readonly internalService: InternalService) {}

  @Public()
  @Post('feedback')
  @Throttle(5)
  addFeedback(
    @Body() data: CreateFeedbackDTO,
    @Req() req: NuvixRequest,
    @User() user: UsersDoc,
  ) {
    return this.internalService.createFeedback({
      data,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      userEmail: user.get('email'),
      userName: user.get('name'),
    });
  }
}
