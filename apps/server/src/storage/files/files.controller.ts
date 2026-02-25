import { type SavedMultipartFile } from '@fastify/multipart'
import {
  Body,
  Controller,
  Param,
  Query,
  Req,
  Res,
  StreamableFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { ApiBody } from '@nestjs/swagger'
import { Delete, Get, Post, Put } from '@nuvix/core'
import {
  MultipartParam,
  Namespace,
  Project,
  ProjectDatabase,
  QueryFilter,
  QuerySearch,
  UploadedFile,
  AuthUser as User,
} from '@nuvix/core/decorators'
import { Exception } from '@nuvix/core/extend/exception'
import { Models } from '@nuvix/core/helpers'
import { FilesQueryPipe } from '@nuvix/core/pipes/queries'
import {
  ApiInterceptor,
  ProjectGuard,
  ResponseInterceptor,
} from '@nuvix/core/resolvers'
import { Database, Doc, Query as Queries } from '@nuvix/db'
import { configuration, IListResponse, IResponse } from '@nuvix/utils'
import { FilesDoc } from '@nuvix/utils/types'
import { BucketParamsDTO } from '../DTO/bucket.dto'
import {
  FileParamsDTO,
  PreviewFileQueryDTO,
  UpdateFileDTO,
} from './DTO/file.dto'
import { FilesService } from './files.service'

@Namespace('storage')
@UseGuards(ProjectGuard)
@Controller({ version: ['1'], path: 'storage/buckets/:bucketId/files' })
@UseInterceptors(ApiInterceptor, ResponseInterceptor)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get('', {
    summary: 'List files',
    scopes: 'files.read',
    model: { type: Models.FILE, list: true },
    sdk: {
      name: 'getFiles',
      descMd: '/docs/references/storage/list-files.md',
    },
  })
  async getFiles(

    @Param() { bucketId }: BucketParamsDTO,
    @QueryFilter(FilesQueryPipe) queries?: Queries[],
    @QuerySearch() search?: string,
  ): Promise<IListResponse<FilesDoc>> {
    return this.filesService.getFiles(db, bucketId, queries, search)
  }

  @Post('', {
    summary: 'Create file',
    scopes: 'files.create',
    model: Models.FILE,
    throttle: {
      limit: configuration.limits.writeRateDefault,
      ttl: configuration.limits.writeRatePeriodDefault,
      key: ({ req, user, ip }) =>
        [
          `ip:${ip}`,
          `userId:${user.getId()}`,
          `chunkId:${req.headers['x-nuvix-id']}`,
        ].join(','),
      configKey: 'bucket_files_create',
    },
    audit: {
      key: 'file.create',
      resource: 'file/{res.$id}',
    },
    sdk: {
      name: 'createFile',
      descMd: '/docs/references/storage/create-file.md',
    },
  })
  @ApiBody({
    description: 'Multipart form data with a file field.',
    schema: {
      type: 'object',
      properties: {
        fileId: {
          type: 'string',
          description:
            "File ID. Choose a custom ID or generate a random ID with `ID.unique()`. Valid chars are a-z, A-Z, 0-9, period, hyphen, and underscore. Can't start with a special char. Max length is 36 chars.",
        },
        permissions: {
          type: 'array',
          description:
            'An array of permission strings. By default, only the current user is granted all permissions. [Learn more about permissions](https://docs.nuvix.in/permissions).',
          items: { type: 'string' },
        },
        file: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['fileId', 'file'],
    },
  })
  async createFile(

    @Param() { bucketId }: BucketParamsDTO,
    @MultipartParam('fileId') fileId: string,
    @MultipartParam('permissions') permissions: string[],
    @UploadedFile() file: SavedMultipartFile,
    @Req() req: NuvixRequest,
    @User() user: Doc,
    @Project() project: Doc,
  ): Promise<IResponse<FilesDoc>> {
    if (!fileId) {
      throw new Exception(Exception.INVALID_PARAMS, 'fileId is required', 400)
    }
    return this.filesService.createFile(
      db,
      bucketId,
      { fileId, permissions },
      file,
      req,
      user,
      project,
    )
  }

  @Get(':fileId', {
    summary: 'Get file',
    scopes: 'files.read',
    model: Models.FILE,
    sdk: {
      name: 'getFile',
      descMd: '/docs/references/storage/get-file.md',
    },
  })
  async getFile(

    @Param() { fileId, bucketId }: FileParamsDTO,
  ): Promise<IResponse<FilesDoc>> {
    return this.filesService.getFile(db, bucketId, fileId)
  }

  @Get(':fileId/preview', {
    summary: 'Get file preview',
    scopes: 'files.read',
    sdk: {
      name: 'getFilePreview',
      descMd: '/docs/references/storage/get-file-preview.md',
      responses: [
        {
          status: 200,
          description: 'Returns the file preview as binary stream',
          contentTypes: ['image/png', 'image/jpeg', 'image/webp'],
        },
      ],
    },
  })
  async previewFile(

    @Param() { fileId, bucketId }: FileParamsDTO,
    @Project() project: Doc,
    @Query() queryParams: PreviewFileQueryDTO,
  ): Promise<StreamableFile> {
    return this.filesService.previewFile(
      db,
      bucketId,
      fileId,
      queryParams,
      project,
    )
  }

  @Get(':fileId/download', {
    summary: 'Get file for download',
    scopes: 'files.read',
    sdk: {
      name: 'getFileDownload',
      descMd: '/docs/references/storage/get-file-download.md',
      responses: [
        {
          status: 200,
          description: 'Returns the file as binary stream',
          contentTypes: ['application/octet-stream'],
        },
        {
          status: 206,
          description: 'Partial content (range requests)',
          contentTypes: ['application/octet-stream'],
        },
      ],
    },
  })
  async downloadFile(

    @Param() { fileId, bucketId }: FileParamsDTO,
    @Req() req: NuvixRequest,
    @Res({ passthrough: true }) res: NuvixRes,
    @Project() project: Doc,
  ): Promise<StreamableFile> {
    return this.filesService.downloadFile(
      db,
      bucketId,
      fileId,
      res,
      req,
      project,
    )
  }

  @Get(':fileId/view', {
    summary: 'Get file for view',
    scopes: 'files.read',
    sdk: {
      name: 'getFileView',
      descMd: '/docs/references/storage/get-file-view.md',
      responses: [
        {
          status: 200,
          description: 'Returns the file as binary stream',
          contentTypes: ['application/octet-stream'],
        },
        {
          status: 206,
          description: 'Partial content (range requests)',
          contentTypes: ['application/octet-stream'],
        },
      ],
    },
  })
  async viewFile(

    @Param() { fileId, bucketId }: FileParamsDTO,
    @Req() req: NuvixRequest,
    @Res({ passthrough: true }) res: NuvixRes,
    @Project() project: Doc,
  ): Promise<StreamableFile> {
    return this.filesService.viewFile(db, bucketId, fileId, res, req, project)
  }

  @Get(':fileId/push', {
    summary: 'Get file for push notification',
    scopes: 'files.read',
    // No need to document this endpoint in the SDK as it's used internally for push notifications
  })
  async getFileForPushNotification(

    @Param() { fileId, bucketId }: FileParamsDTO,
    @Query('jwt') jwt: string,
    @Req() req: NuvixRequest,
    @Res({ passthrough: true }) res: NuvixRes,
    @Project() project: Doc,
  ): Promise<StreamableFile> {
    return this.filesService.getFileForPushNotification(
      db,
      bucketId,
      fileId,
      jwt,
      req,
      res,
      project,
    )
  }

  @Put(':fileId', {
    summary: 'Update file',
    scopes: 'files.update',
    model: Models.FILE,
    throttle: {
      limit: configuration.limits.writeRateDefault,
      ttl: configuration.limits.writeRatePeriodDefault,
      key: ({ user, ip }) => [`ip:${ip}`, `userId:${user.getId()}`].join(','),
      configKey: 'bucket_files_update',
    },
    audit: {
      key: 'file.update',
      resource: 'file/{res.$id}',
    },
    sdk: {
      name: 'updateFile',
      descMd: '/docs/references/storage/update-file.md',
    },
  })
  async updateFile(

    @Param() { fileId, bucketId }: FileParamsDTO,
    @Body() updateFileDTO: UpdateFileDTO,
  ): Promise<IResponse<FilesDoc>> {
    return this.filesService.updateFile(db, bucketId, fileId, updateFileDTO)
  }

  @Delete(':fileId', {
    summary: 'Delete file',
    scopes: 'files.delete',
    model: Models.NONE,
    throttle: {
      limit: configuration.limits.writeRateDefault,
      ttl: configuration.limits.writeRatePeriodDefault,
      key: ({ user, ip }) => [`ip:${ip}`, `userId:${user.getId()}`].join(','),
      configKey: 'bucket_files_delete',
    },
    audit: {
      key: 'file.delete',
      resource: 'file/{params.fileId}',
    },
    sdk: {
      name: 'deleteFile',
      descMd: '/docs/references/storage/delete-file.md',
    },
  })
  async deleteFile(

    @Param() { fileId, bucketId }: FileParamsDTO,
    @Project() project: Doc,
  ): Promise<void> {
    return this.filesService.deleteFile(db, bucketId, fileId, project)
  }
}
