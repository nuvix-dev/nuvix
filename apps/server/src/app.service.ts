import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { Injectable, StreamableFile } from '@nestjs/common'
import { configuration } from '@nuvix/utils'

@Injectable()
export class AppService {
  async getFavicon() {
    const favicon = await readFile(
      path.join(configuration.assets.root, 'trademark', 'icon.png'),
    )
    return new StreamableFile(favicon, {
      disposition: 'inline; filename="favicon.ico"',
    })
  }
}
