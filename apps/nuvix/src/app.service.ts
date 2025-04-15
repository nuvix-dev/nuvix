import { Injectable, StreamableFile } from '@nestjs/common';
import { readFileSync } from 'fs';

@Injectable()
export class AppService {
  constructor() {}

  async getHello(): Promise<string> {
    return 'Hello World!';
  }

  getFavicon() {
    const favicon = readFileSync('assets/images/nuvix.png');
    return new StreamableFile(favicon);
  }
}
