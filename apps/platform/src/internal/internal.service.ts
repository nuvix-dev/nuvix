import { Injectable } from '@nestjs/common';
import { Database, Doc } from '@nuvix-tech/db';
import { CoreService } from '@nuvix/core';
import type { CreateFeedback } from './internal.types';
import type { Feedback } from '@nuvix/utils/types';

@Injectable()
export class InternalService {
  private readonly db: Database;

  constructor(private readonly coreService: CoreService) {
    this.db = this.coreService.getPlatformDb();
  }

  async createFeedback({
    data,
    ip,
    userAgent,
    userEmail,
    userName,
  }: CreateFeedback) {
    const feedback = new Doc<Feedback>({
      email: userEmail,
      message: data.content,
      type: data.type,
      metadata: {
        ip,
        userAgent,
        userName,
      },
    });

    await this.db.createDocument('feedback', feedback);

    return {
      success: true,
      message: 'Thank you for your feedback. We’ve received it successfully.',
    };
  }
}
