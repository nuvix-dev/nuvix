import { Injectable, StreamableFile } from '@nestjs/common';
import { readFile } from 'fs/promises';

@Injectable()
export class AppService {
  constructor() {}

  async getFavicon() {
    const favicon = await readFile('assets/images/nuvix.png');
    return new StreamableFile(favicon);
  }
}
