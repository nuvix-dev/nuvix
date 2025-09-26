import { Injectable, StreamableFile } from '@nestjs/common';
import { configuration } from '@nuvix/utils';
import { readFile } from 'fs/promises';
import path from 'path';

@Injectable()
export class AppService {
  constructor() {}

  async getFavicon() {
    const favicon = await readFile(
      path.join(configuration.assets.root, 'trademark', 'icon.png'),
    );
    return new StreamableFile(favicon, {
      disposition: 'inline; filename="favicon.ico"',
    });
  }
}
