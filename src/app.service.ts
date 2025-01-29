import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class AppService {
  constructor(
    // @InjectQueue('email') private testQueue: Queue
  ) { }

  async getHello(): Promise<string> {
    // await this.testQueue.add('sendEmail', {
    //   to: '',
    //   subject: '',
    //   text: '',
    // });

    return 'Hello World!';
  }
}
