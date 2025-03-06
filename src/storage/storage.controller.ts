import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  Res,
  Scope,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Request } from 'express';
import { ResponseInterceptor } from 'src/core/resolvers/interceptors/response.interceptor';
import { StorageService } from './storage.service';
import { Models } from 'src/core/helper/response.helper';
import { ParseQueryPipe } from 'src/core/pipes/query.pipe';
import { User } from 'src/core/decorators/user.decorator';
import { Document, Query as Queries } from '@nuvix/database';
import { Mode } from 'src/core/decorators/mode.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProjectGuard } from 'src/core/resolvers/guards/project.guard';
import { ResModel } from 'src/core/decorators';

import { UpdateFileDTO } from './DTO/file.dto';
import { CreateBucketDTO, UpdateBucketDTO } from './DTO/bucket.dto';
import { ApiInterceptor } from 'src/core/resolvers/interceptors/api.interceptor';
import { ParseDuplicatePipe } from 'src/core/pipes/duplicate.pipe';

@Controller({ version: ['1'], path: 'storage' })
@UseGuards(ProjectGuard)
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Get('buckets')
  @ResModel({ type: Models.BUCKET, list: true })
  async getBuckets(
    @Query('queries', ParseQueryPipe) queries: Queries[],
    @Query('search') search?: string,
  ) {
    return await this.storageService.getBuckets(queries, search);
  }

  @Post('buckets')
  @ResModel(Models.BUCKET)
  async createBucket(@Body() createBucketDto: CreateBucketDTO) {
    return await this.storageService.createBucket(createBucketDto);
  }

  @Get('buckets/:id')
  @ResModel(Models.BUCKET)
  async getBucket(@Param('id') id: string) {
    return await this.storageService.getBucket(id);
  }

  @Put('buckets/:id')
  @ResModel(Models.BUCKET)
  async updateBucket(
    @Param('id') id: string,
    @Body() createBucketDto: UpdateBucketDTO,
  ) {
    return await this.storageService.updateBucket(id, createBucketDto);
  }

  @Delete('buckets/:id')
  @ResModel(Models.NONE)
  async deleteBucket(@Param('id') id: string) {
    return await this.storageService.deleteBucket(id);
  }

  @Get('buckets/:id/files')
  @ResModel({ type: Models.FILE, list: true })
  async getFiles(
    @Param('id') id: string,
    @Query('queries', ParseQueryPipe) queries: Queries[],
    @Query('search') search?: string,
  ) {
    return await this.storageService.getFiles(id, queries, search);
  }

  @Post('buckets/:id/files')
  @ResModel(Models.FILE)
  @UseInterceptors(FileInterceptor('file'))
  async createFile(
    @Param('id') id: string,
    @Body('fileId') fileId: string,
    @Body('permissions') permissions: string[] = [],
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
    @User('project') user: Document,
    @Mode() mode: string,
  ) {
    return await this.storageService.createFile(
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
  async getFile(@Param('id') id: string, @Param('fileId') fileId: string) {
    return await this.storageService.getFile(id, fileId);
  }

  @Get('buckets/:id/files/:fileId/preview')
  async previewFile(
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @Req() req: Request,
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
    return await this.storageService.previewFile(id, fileId, {
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
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: any,
  ) {
    return await this.storageService.downloadFile(id, fileId, res, req);
  }

  @Get('buckets/:id/files/:fileId/view')
  async viewFile(
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: any,
  ) {
    return await this.storageService.viewFile(id, fileId, res, req);
  }

  @Get('buckets/:id/files/:fileId/push')
  async getFileForPushNotification(
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @Query('jwt') jwt: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: any,
  ) {
    return await this.storageService.getFileForPushNotification(
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
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @Body() updateFileDto: UpdateFileDTO,
  ) {
    return await this.storageService.updateFile(id, fileId, updateFileDto);
  }

  @Delete('buckets/:id/files/:fileId')
  @ResModel(Models.NONE)
  async deleteFile(@Param('id') id: string, @Param('fileId') fileId: string) {
    return await this.storageService.deleteFile(id, fileId);
  }

  @Get('usage')
  @ResModel(Models.USAGE_STORAGE)
  async getUsage(@Query('range') range?: string) {
    return await this.storageService.getStorageUsage(range);
  }

  @Get(':id/usage')
  @ResModel(Models.USAGE_BUCKETS)
  async getBucketUsage(
    @Param('id') id: string,
    @Query('range') range?: string,
  ) {
    return await this.storageService.getBucketStorageUsage(id, range);
  }
}
