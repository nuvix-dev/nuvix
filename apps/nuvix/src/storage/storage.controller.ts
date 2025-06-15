import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { ResponseInterceptor } from '@nuvix/core/resolvers/interceptors/response.interceptor';
import { StorageService } from './storage.service';
import { Models } from '@nuvix/core/helper/response.helper';
import { ParseQueryPipe } from '@nuvix/core/pipes/query.pipe';
import { Database, Document, Query as Queries } from '@nuvix/database';
import { Mode } from '@nuvix/core/decorators/mode.decorator';
import { ProjectGuard } from '@nuvix/core/resolvers/guards/project.guard';
import {
  MultipartParam,
  ResModel,
  Scope,
  ProjectDatabase,
  UploadedFile,
} from '@nuvix/core/decorators';

import { UpdateFileDTO } from './DTO/file.dto';
import { CreateBucketDTO, UpdateBucketDTO } from './DTO/bucket.dto';
import { ApiInterceptor } from '@nuvix/core/resolvers/interceptors/api.interceptor';
import { ParseDuplicatePipe } from '@nuvix/core/pipes/duplicate.pipe';
import { MultipartFile, MultipartValue } from '@fastify/multipart';
import { User } from '@nuvix/core/decorators/project-user.decorator';
import { Exception } from '@nuvix/core/extend/exception';

@Controller({ version: ['1'], path: 'storage' })
@UseGuards(ProjectGuard)
@UseInterceptors(ApiInterceptor, ResponseInterceptor)
export class StorageController {
  private readonly logger = new Logger(StorageController.name);
  constructor(private readonly storageService: StorageService) {}

  @Get('buckets')
  @ResModel({ type: Models.BUCKET, list: true })
  async getBuckets(
    @ProjectDatabase() db: Database,
    @Query('queries', ParseQueryPipe) queries: Queries[],
    @Query('search') search?: string,
  ) {
    return await this.storageService.getBuckets(db, queries, search);
  }

  @Post('buckets')
  @ResModel(Models.BUCKET)
  async createBucket(
    @ProjectDatabase() db: Database,
    @Body() createBucketDTO: CreateBucketDTO,
  ) {
    return await this.storageService.createBucket(db, createBucketDTO);
  }

  @Get('buckets/:id')
  @ResModel(Models.BUCKET)
  async getBucket(@ProjectDatabase() db: Database, @Param('id') id: string) {
    return await this.storageService.getBucket(db, id);
  }

  @Put('buckets/:id')
  @ResModel(Models.BUCKET)
  async updateBucket(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
    @Body() createBucketDTO: UpdateBucketDTO,
  ) {
    return await this.storageService.updateBucket(db, id, createBucketDTO);
  }

  @Delete('buckets/:id')
  @ResModel(Models.NONE)
  async deleteBucket(@ProjectDatabase() db: Database, @Param('id') id: string) {
    return await this.storageService.deleteBucket(db, id);
  }

  @Get('buckets/:id/files')
  @ResModel({ type: Models.FILE, list: true })
  async getFiles(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
    @Query('queries', ParseQueryPipe) queries: Queries[],
    @Query('search') search?: string,
  ) {
    return await this.storageService.getFiles(db, id, queries, search);
  }

  // @Get('buckets/:id/objects')
  // @ResModel(Models.OBJECT, { list: true })
  // async getObjects(
  //   @ProjectDatabase() db: Database,
  //   @Param('id') id: string,
  //   @Query('queries', ParseQueryPipe) queries: Queries[],
  //   @Query('search') search?: string,
  //   @Query('path') path?: string,
  // ) {
  //   return await this.storageService.getObjects(db, id, queries, search, path);
  // }

  // @Post('buckets/:id/objects')
  // @Scope('files.create')
  // @Label('res.status', 'CREATED')
  // @Label('res.type', 'JSON')
  // @ResModel(Models.OBJECT)
  // async createObject(
  //   @ProjectDatabase() db: Database,
  //   @Param('id') id: string,
  //   @Body() createObjectDTO: CreateBucketDTO,
  //   @User() user: Document,
  // ) {
  //   return await this.storageService.createFolder(
  //     db,
  //     user,
  //     id,
  //     createObjectDTO,
  //   );
  // }

  // @Post('buckets/:id/upload')
  // @Scope('files.create')
  // @Label('res.status', 'CREATED')
  // @Label('res.type', 'JSON')
  // @ResModel(Models.OBJECT)
  // async uploadFile(
  //   @ProjectDatabase() db: Database,
  //   @Param('id') id: string,
  //   @Body('fileId') fileId: string,
  //   @Body('name') name: string,
  //   @Body('permissions') permissions: string[] = [],
  //   @UploadedFile() file: MultipartFile,
  //   @Req() req: NuvixRequest,
  //   @User() user: Document,
  // ) {
  //   return await this.storageService.uploadFile(
  //     db,
  //     id,
  //     { fileId, permissions, name },
  //     file,
  //     req,
  //     user,
  //   );
  // }

  @Post('buckets/:id/files')
  @ResModel(Models.FILE)
  async createFile(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
    @MultipartParam('fileId') fileId: string,
    @MultipartParam('permissions') permissions: string[] = [],
    @UploadedFile() file: MultipartFile,
    @Req() req: NuvixRequest,
    @User() user: Document,
    @Mode() mode: string,
  ) {
    if (!fileId)
      throw new Exception(Exception.INVALID_PARAMS, 'fileId is required');
    return await this.storageService.createFile(
      db,
      id,
      { fileId, permissions },
      file,
      req,
      user,
      mode,
    );
  }

  @Get('buckets/:id/files/:fileId')
  @ResModel(Models.FILE)
  async getFile(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
    @Param('fileId') fileId: string,
  ) {
    return await this.storageService.getFile(db, id, fileId);
  }

  @Get('buckets/:id/files/:fileId/preview')
  async previewFile(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @Req() req: NuvixRequest,
    @Query('width', ParseDuplicatePipe, new ParseIntPipe({ optional: true }))
    width?: string,
    @Query('height', ParseDuplicatePipe, new ParseIntPipe({ optional: true }))
    height?: string,
    @Query('gravity', ParseDuplicatePipe) gravity?: string,
    @Query('quality', ParseDuplicatePipe, new ParseIntPipe({ optional: true }))
    quality?: string,
    @Query(
      'borderWidth',
      ParseDuplicatePipe,
      new ParseIntPipe({ optional: true }),
    )
    borderWidth?: string,
    @Query('borderColor', ParseDuplicatePipe) borderColor?: string,
    @Query(
      'borderRadius',
      ParseDuplicatePipe,
      new ParseIntPipe({ optional: true }),
    )
    borderRadius?: string,
    @Query('opacity', ParseDuplicatePipe, new ParseIntPipe({ optional: true }))
    opacity?: string,
    @Query('rotation', ParseDuplicatePipe, new ParseIntPipe({ optional: true }))
    rotation?: string,
    @Query('background', ParseDuplicatePipe) background?: string,
    @Query('output', ParseDuplicatePipe) output?: string,
  ) {
    return await this.storageService.previewFile(db, id, fileId, {
      width,
      height,
      gravity,
      quality,
      borderWidth,
      borderColor,
      borderRadius,
      opacity,
      rotation,
      background,
      output,
    } as any);
  }

  @Get('buckets/:id/files/:fileId/download')
  async downloadFile(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @Req() req: NuvixRequest,
    @Res({ passthrough: true }) res: any,
  ) {
    return await this.storageService.downloadFile(db, id, fileId, res, req);
  }

  @Get('buckets/:id/files/:fileId/view')
  async viewFile(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @Req() req: NuvixRequest,
    @Res({ passthrough: true }) res: any,
  ) {
    return await this.storageService.viewFile(db, id, fileId, res, req);
  }

  @Get('buckets/:id/files/:fileId/push')
  async getFileForPushNotification(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @Query('jwt') jwt: string,
    @Req() req: NuvixRequest,
    @Res({ passthrough: true }) res: any,
  ) {
    return await this.storageService.getFileForPushNotification(
      db,
      id,
      fileId,
      jwt,
      req,
      res,
    );
  }

  @Put('buckets/:id/files/:fileId')
  @ResModel(Models.FILE)
  async updateFile(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @Body() updateFileDTO: UpdateFileDTO,
  ) {
    return await this.storageService.updateFile(db, id, fileId, updateFileDTO);
  }

  @Delete('buckets/:id/files/:fileId')
  @ResModel(Models.NONE)
  async deleteFile(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
    @Param('fileId') fileId: string,
  ) {
    return await this.storageService.deleteFile(db, id, fileId);
  }

  @Get('usage')
  @ResModel(Models.USAGE_STORAGE)
  async getUsage(
    @ProjectDatabase() db: Database,
    @Query('range') range?: string,
  ) {
    return await this.storageService.getStorageUsage(db, range);
  }

  @Get(':id/usage')
  @ResModel(Models.USAGE_BUCKETS)
  async getBucketUsage(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
    @Query('range') range?: string,
  ) {
    return await this.storageService.getBucketStorageUsage(db, id, range);
  }
}
