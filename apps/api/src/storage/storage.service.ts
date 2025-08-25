import { Injectable, Logger, StreamableFile } from '@nestjs/common';
import {
  Authorization,
  Database,
  Doc,
  DuplicateException,
  ID,
  Permission,
  PermissionType,
  Query,
  Role,
} from '@nuvix-tech/db';
import { Exception } from '@nuvix/core/extend/exception';
import {
  APP_LIMIT_COUNT,
  APP_STORAGE_LIMIT,
  APP_STORAGE_READ_BUFFER,
  MAX_OUTPUT_CHUNK_SIZE,
} from '@nuvix/utils';
import { CreateBucketDTO, UpdateBucketDTO } from './DTO/bucket.dto';
import { Auth } from '@nuvix/core/helper/auth.helper';
import { CreateFileDTO, UpdateFileDTO } from './DTO/file.dto';

import { JwtService } from '@nestjs/jwt';
import usageConfig from '@nuvix/core/config/usage';
import sharp from 'sharp';
import { type SavedMultipartFile } from '@fastify/multipart';
import { logos } from '@nuvix/core/config/storage/logos';
import path from 'path';
import * as fs from 'fs/promises';
import { CoreService } from '@nuvix/core';
import { FileExt, FileSize } from '@nuvix/storage';
import collections from '@nuvix/utils/collections/index.js';
import type { Files, FilesDoc } from '@nuvix/utils/types';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    private readonly coreService: CoreService,
    private readonly jwtService: JwtService,
  ) {}

  private getCollectionName(s: number) {
    return `bucket_${s}`;
  }

  /**
   * Get buckets.
   */
  async getBuckets(db: Database, queries: Query[], search?: string) {
    if (search) {
      queries.push(Query.search('search', search));
    }
    const filterQueries = Query.groupByType(queries).filters;

    return {
      buckets: await db.find('buckets', queries),
      total: await db.count('buckets', filterQueries, APP_LIMIT_COUNT),
    };
  }

  /**
   * Create bucket.
   */
  async createBucket(
    db: Database,
    { bucketId, permissions: _perms, ...data }: CreateBucketDTO,
  ) {
    bucketId = bucketId === 'unique()' ? ID.unique() : bucketId;
    const permissions = Permission.aggregate(_perms ?? []);

    try {
      const filesCollection = collections.bucket['files'];
      if (!filesCollection) {
        throw new Exception(
          Exception.GENERAL_SERVER_ERROR,
          'Files collection is not configured.',
        );
      }

      const attributes = filesCollection.attributes.map(
        attribute => new Doc(attribute),
      );
      const indexes = filesCollection.indexes?.map(index => new Doc(index));

      await db.createDocument(
        'buckets',
        new Doc({
          $id: bucketId,
          $collection: 'buckets',
          $permissions: permissions ?? [],
          name: data.name,
          maximumFileSize: data.maximumFileSize,
          allowedFileExtensions: data.allowedFileExtensions,
          fileSecurity: data.fileSecurity,
          enabled: data.enabled,
          compression: data.compression,
          encryption: data.encryption,
          antivirus: data.antivirus,
          search: [bucketId, data.name].join(' '),
        }),
      );

      const bucket = await db.getDocument('buckets', bucketId);
      await db.createCollection({
        id: this.getCollectionName(bucket.getSequence()),
        attributes,
        indexes,
        permissions: permissions ?? [],
        documentSecurity: data.fileSecurity,
      });

      return bucket;
    } catch (error) {
      if (error instanceof DuplicateException) {
        throw new Exception(Exception.STORAGE_BUCKET_ALREADY_EXISTS);
      }
      throw error;
    }
  }

  /**
   * Get a bucket.
   */
  async getBucket(db: Database, id: string) {
    const bucket = await db.getDocument('buckets', id);

    if (bucket.empty()) throw new Exception(Exception.STORAGE_BUCKET_NOT_FOUND);

    return bucket;
  }

  /**
   * Update a bucket.
   */
  async updateBucket(db: Database, id: string, input: UpdateBucketDTO) {
    const bucket = await db.getDocument('buckets', id);

    if (bucket.empty()) {
      throw new Exception(Exception.STORAGE_BUCKET_NOT_FOUND);
    }

    const permissions = Permission.aggregate(
      input.permissions ?? bucket.getPermissions(),
    )!;
    const maximumFileSize =
      input.maximumFileSize ?? bucket.get('maximumFileSize', APP_LIMIT_COUNT);
    const allowedFileExtensions =
      input.allowedFileExtensions ?? bucket.get('allowedFileExtensions', []);
    const enabled = input.enabled ?? bucket.get('enabled', true);
    const encryption = input.encryption ?? bucket.get('encryption', true);
    const antivirus = input.antivirus ?? bucket.get('antivirus', true);

    const updatedBucket = await db.updateDocument(
      'buckets',
      id,
      bucket
        .set('name', input.name)
        .set('$permissions', permissions)
        .set('maximumFileSize', maximumFileSize)
        .set('allowedFileExtensions', allowedFileExtensions)
        .set('fileSecurity', input.fileSecurity)
        .set('enabled', enabled)
        .set('encryption', encryption)
        .set(
          'compression',
          input.compression ?? bucket.get('compression', 'none'),
        )
        .set('antivirus', antivirus),
    );

    await db.updateCollection({
      id: this.getCollectionName(bucket.getSequence()),
      permissions,
      documentSecurity: input.fileSecurity ?? bucket.get('fileSecurity', false),
    });

    return updatedBucket;
  }

  /**
   * Delete a bucket.
   */
  async deleteBucket(db: Database, id: string) {
    const bucket = await db.getDocument('buckets', id);

    if (bucket.empty()) {
      throw new Exception(Exception.STORAGE_BUCKET_NOT_FOUND);
    }

    if (!(await db.deleteDocument('buckets', id))) {
      throw new Exception(
        Exception.GENERAL_SERVER_ERROR,
        'Failed to remove bucket from DB',
      );
    }

    await db.deleteCollection(this.getCollectionName(bucket.getSequence())); // TODO: use queues to delete
    return;
  }

  /**
   * Get files.
   */
  async getFiles(
    db: Database,
    bucketId: string,
    queries: Query[],
    search?: string,
  ) {
    const bucket = await db.getDocument('buckets', bucketId);

    const isAPIKey = Auth.isAppUser(Authorization.getRoles());
    const isPrivilegedUser = Auth.isPrivilegedUser(Authorization.getRoles());

    if (
      bucket.empty() ||
      (!bucket.get('enabled') && !isAPIKey && !isPrivilegedUser)
    ) {
      throw new Exception(Exception.STORAGE_BUCKET_NOT_FOUND);
    }

    const fileSecurity = bucket.get('fileSecurity', false);
    const validator = new Authorization(PermissionType.Read);
    const valid = validator.$valid(bucket.getRead());
    if (!fileSecurity && !valid) {
      throw new Exception(Exception.USER_UNAUTHORIZED);
    }

    if (search) {
      queries.push(Query.search('search', search));
    }

    const filterQueries = Query.groupByType(queries).filters;
    const files = db.find(
      this.getCollectionName(bucket.getSequence()),
      queries,
    );

    const total = await db.count(
      this.getCollectionName(bucket.getSequence()),
      filterQueries,
      APP_LIMIT_COUNT,
    );

    return {
      files,
      total,
    };
  }

  /**
   * Create|Upload file.
   */
  async createFile(
    db: Database,
    bucketId: string,
    input: CreateFileDTO,
    file: SavedMultipartFile,
    request: NuvixRequest,
    user: Doc,
    project: Doc,
  ) {
    const deviceForFiles = this.coreService.getProjectDevice(project.getId());
    const bucket = await Authorization.skip(() =>
      db.getDocument('buckets', bucketId),
    );

    const isAPIKey = Auth.isAppUser(Authorization.getRoles());
    const isPrivilegedUser = Auth.isPrivilegedUser(Authorization.getRoles());

    if (
      bucket.empty() ||
      (!bucket.get('enabled') && !isAPIKey && !isPrivilegedUser)
    ) {
      throw new Exception(Exception.STORAGE_BUCKET_NOT_FOUND);
    }

    const validator = new Authorization(PermissionType.Create);
    if (!validator.$valid(bucket.getCreate())) {
      throw new Exception(Exception.USER_UNAUTHORIZED);
    }

    const allowedPermissions = [
      PermissionType.Read,
      PermissionType.Update,
      PermissionType.Delete,
    ];

    let permissions = Permission.aggregate(
      input.permissions ?? [],
      allowedPermissions,
    );

    const roles = Authorization.getRoles();
    if (!permissions || permissions.length === 0) {
      permissions = user.getId()
        ? allowedPermissions.map(permission =>
            new Permission(permission, Role.user(user.getId())).toString(),
          )
        : [];
    }

    if (!isAPIKey && !isPrivilegedUser) {
      permissions.forEach(permission => {
        const parsedPermission = Permission.parse(permission);
        if (!Authorization.isRole(parsedPermission.toString())) {
          throw new Exception(
            Exception.USER_UNAUTHORIZED,
            `Permissions must be one of: (${roles.join(', ')})`,
          );
        }
      });
    }

    const maximumFileSize = Math.min(
      bucket.get('maximumFileSize', APP_STORAGE_LIMIT),
      APP_STORAGE_LIMIT,
    );
    if (maximumFileSize > APP_STORAGE_LIMIT) {
      throw new Exception(
        Exception.GENERAL_SERVER_ERROR,
        'Maximum bucket file size exceeds APP_STORAGE_LIMIT',
      );
    }

    if (!file) {
      throw new Exception(Exception.STORAGE_FILE_EMPTY);
    }

    const fileName = file.filename;
    const stats = await fs.stat(file.filepath);
    const fileSize = stats.size;
    const fileExt = fileName.split('.').pop()?.toLowerCase() ?? '';
    const contentRange = request.headers['content-range'];

    if (!fileSize) {
      throw new Exception(Exception.STORAGE_FILE_EMPTY, 'File size is zero.');
    }

    let fileId = input.fileId === 'unique()' ? ID.unique() : input.fileId;
    let chunk = 1;
    let chunks = 1;
    let initialChunkSize = 0;
    let finalFileSize = fileSize;

    if (contentRange) {
      const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(contentRange);
      if (!match) {
        throw new Exception(
          Exception.STORAGE_INVALID_CONTENT_RANGE,
          'Invalid Content-Range format.',
        );
      }

      const [, start, end, size] = match.map(Number);
      const headerFileId = request.headers['x-nuvix-id'];
      if (headerFileId) {
        fileId = (
          Array.isArray(headerFileId) ? headerFileId[0] : headerFileId
        ) as string;
        if (!/^(?:[a-zA-Z0-9][a-zA-Z0-9._-]{0,35})$/.test(fileId)) {
          throw new Exception(
            Exception.INVALID_PARAMS,
            'Invalid file ID format',
          );
        }
      }

      if (
        start === undefined ||
        end === undefined ||
        size === undefined ||
        start > end ||
        end >= size ||
        start < 0
      ) {
        throw new Exception(
          Exception.STORAGE_INVALID_CONTENT_RANGE,
          'Invalid range values',
        );
      }

      const chunkSize = end - start + 1;
      initialChunkSize = initialChunkSize || chunkSize;
      chunks = Math.ceil(size / initialChunkSize);
      chunk = Math.floor(start / initialChunkSize) + 1;
      finalFileSize = size;
    }

    const allowedFileExtensions = bucket.get('allowedFileExtensions', []);
    const fileExtValidator = new FileExt(allowedFileExtensions);
    if (allowedFileExtensions.length && !fileExtValidator.isValid(fileName)) {
      throw new Exception(
        Exception.STORAGE_FILE_TYPE_UNSUPPORTED,
        'File extension not allowed',
      );
    }

    const fileSizeValidator = new FileSize(maximumFileSize);
    if (!fileSizeValidator.isValid(finalFileSize)) {
      throw new Exception(
        Exception.STORAGE_INVALID_FILE_SIZE,
        'File size exceeds bucket limit',
      );
    }

    const _path = deviceForFiles.getPath(
      path.join(bucket.getId(), fileId + '.' + fileExt),
    );

    let fileDocument: FilesDoc;
    let metadata: Record<string, any> = { content_type: file.mimetype };
    let chunksUploaded = 0;

    try {
      // Fetch existing document
      fileDocument = await db.getDocument<Files>(
        this.getCollectionName(bucket.getSequence()),
        fileId,
      );
      if (!fileDocument.empty()) {
        const chunksTotal = fileDocument.get('chunksTotal', 1);
        chunksUploaded = fileDocument.get('chunksUploaded', 0);
        metadata = fileDocument.get('metadata', {});
        chunks = chunksTotal;

        if (chunk === -1) chunk = chunksTotal;
        if (chunksUploaded === chunksTotal) {
          throw new Exception(Exception.STORAGE_FILE_ALREADY_EXISTS);
        }
      }

      chunksUploaded = await deviceForFiles.upload(
        file.filepath,
        _path,
        chunk,
        chunks,
        metadata,
      );

      if (!chunksUploaded) {
        throw new Exception(
          Exception.GENERAL_SERVER_ERROR,
          'Failed uploading file',
        );
      }

      if (chunksUploaded === chunks) {
        // Validate file
        const sizeActual = fileSize;
        const fileHash = await deviceForFiles.getFileHash(_path);
        const mimeType = file.mimetype;

        const data = await deviceForFiles.read(_path);
        if (data) {
          if (!(await deviceForFiles.write(_path, data, mimeType))) {
            throw new Exception(
              Exception.GENERAL_SERVER_ERROR,
              'Failed to save file',
            );
          }
        }

        // Create or update file document
        if (fileDocument.empty()) {
          fileDocument = await db.createDocument<Files>(
            this.getCollectionName(bucket.getSequence()),
            new Doc({
              $id: fileId,
              $permissions: permissions,
              bucketId: bucket.getId(),
              bucketInternalId: bucket.getSequence(),
              name: fileName,
              path: _path,
              signature: fileHash,
              mimeType,
              sizeOriginal: finalFileSize,
              sizeActual,
              chunksTotal: chunks,
              chunksUploaded,
              search: [fileId, fileName].join(' '),
              metadata,
            }),
          );
        } else {
          fileDocument = fileDocument
            .set('$permissions', permissions)
            .set('signature', fileHash)
            .set('mimeType', mimeType)
            .set('sizeActual', sizeActual)
            .set('metadata', metadata)
            .set('chunksUploaded', chunksUploaded);

          const updateValidator = new Authorization(PermissionType.Update);
          if (!updateValidator.$valid(bucket.getUpdate())) {
            throw new Exception(Exception.USER_UNAUTHORIZED);
          }

          fileDocument = await db.updateDocument(
            this.getCollectionName(bucket.getSequence()),
            fileId,
            fileDocument,
          );
        }
      } else {
        if (fileDocument.empty()) {
          fileDocument = await db.createDocument<Files>(
            this.getCollectionName(bucket.getSequence()),
            new Doc({
              $id: fileId,
              $permissions: permissions,
              bucketId: bucket.getId(),
              bucketInternalId: bucket.getSequence(),
              name: fileName,
              path: _path,
              signature: '',
              mimeType: '',
              sizeOriginal: finalFileSize,
              sizeActual: 0,
              chunksTotal: chunks,
              chunksUploaded,
              search: [fileId, fileName].join(' '),
              metadata,
            }),
          );
        } else {
          fileDocument = await db.updateDocument(
            this.getCollectionName(bucket.getSequence()),
            fileId,
            fileDocument
              .set('chunksUploaded', chunksUploaded)
              .set('metadata', metadata),
          );
        }
      }

      return fileDocument;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get a File.
   */
  async getFile(db: Database, bucketId: string, fileId: string) {
    const bucket = await Authorization.skip(() =>
      db.getDocument('buckets', bucketId),
    );

    const isAPIKey = Auth.isAppUser(Authorization.getRoles());
    const isPrivilegedUser = Auth.isPrivilegedUser(Authorization.getRoles());

    if (
      bucket.empty() ||
      (!bucket.get('enabled') && !isAPIKey && !isPrivilegedUser)
    ) {
      throw new Exception(Exception.STORAGE_BUCKET_NOT_FOUND);
    }

    const fileSecurity = bucket.get('fileSecurity', false);
    const validator = new Authorization(PermissionType.Read);
    const valid = validator.$valid(bucket.getRead());
    if (!fileSecurity && !valid) {
      throw new Exception(Exception.USER_UNAUTHORIZED);
    }

    // TODO: i think i should recheck the logic
    const file = (
      fileSecurity && !valid
        ? await db.getDocument(
            this.getCollectionName(bucket.getSequence()),
            fileId,
          )
        : await Authorization.skip(() =>
            db.getDocument(
              this.getCollectionName(bucket.getSequence()),
              fileId,
            ),
          )
    ) as FilesDoc;

    if (file.empty()) {
      throw new Exception(Exception.STORAGE_FILE_NOT_FOUND);
    }

    return file;
  }

  /**
   * Preview a file.
   * @todo
   */
  async previewFile(
    db: Database,
    bucketId: string,
    fileId: string,
    params: PreviewParams,
    project: Doc,
  ) {
    const deviceForFiles = this.coreService.getProjectDevice(project.getId());
    const {
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
    } = params;

    const bucket = await Authorization.skip(
      async () => await db.getDocument('buckets', bucketId),
    );

    const isAPIKey = Auth.isAppUser(Authorization.getRoles());
    const isPrivilegedUser = Auth.isPrivilegedUser(Authorization.getRoles());

    if (
      bucket.empty() ||
      (!bucket.get('enabled') && !isAPIKey && !isPrivilegedUser)
    ) {
      throw new Exception(Exception.STORAGE_BUCKET_NOT_FOUND);
    }

    const fileSecurity = bucket.get('fileSecurity', false);
    const validator = new Authorization(PermissionType.Read);
    const valid = validator.$valid(bucket.getRead());
    if (!fileSecurity && !valid) {
      throw new Exception(Exception.USER_UNAUTHORIZED);
    }

    const file =
      fileSecurity && !valid
        ? await db.getDocument(
            this.getCollectionName(bucket.getSequence()),
            fileId,
          )
        : await Authorization.skip(
            async () =>
              await db.getDocument(
                this.getCollectionName(bucket.getSequence()),
                fileId,
              ),
          );

    if (file.empty()) {
      throw new Exception(Exception.STORAGE_FILE_NOT_FOUND);
    }

    const path = file.get('path', '');

    try {
      await deviceForFiles.exists(path);
    } catch {
      throw new Exception(
        Exception.STORAGE_FILE_NOT_FOUND,
        'File not found in ' + path,
      );
    }

    const mimeType = file.get('mimeType');
    const fileName = file.get('name', '');
    const size = file.get('sizeOriginal', 0);

    // Unsupported file types or files larger then 10 MB
    if (!mimeType.startsWith('image/') || size / 1024 > 10 * 1024) {
      const path = logos[mimeType as keyof typeof logos] ?? logos.default;
      const buffer = await deviceForFiles.read(path);
      return new StreamableFile(buffer, {
        type: `image/png`,
        disposition: `inline; filename="${fileName}"`,
        length: buffer.length,
      });
    }

    const fileBuffer = await deviceForFiles.read(path);
    let image = sharp(fileBuffer);

    if (width || height) {
      image = image.resize(width, height, {
        fit: sharp.fit.cover,
        position: gravity,
      });
    }

    if (borderWidth) {
      image = image.extend({
        top: borderWidth,
        bottom: borderWidth,
        left: borderWidth,
        right: borderWidth,
        background: borderColor,
      });
    }

    if (borderRadius) {
      const metadata = await image.metadata();
      const imageWidth = width || metadata.width || 0;
      const imageHeight = height || metadata.height || 0;

      image = image.composite([
        {
          input: Buffer.from(
            `<svg><rect x="0" y="0" width="${imageWidth}" height="${imageHeight}" rx="${borderRadius}" ry="${borderRadius}"/></svg>`,
          ),
          blend: 'dest-in',
        },
      ]);
    }

    if (opacity !== undefined) {
      const metadata = await image.metadata();
      const imageWidth = width || metadata.width || 0;
      const imageHeight = height || metadata.height || 0;

      image = image.composite([
        {
          input: Buffer.from(
            `<svg><rect x="0" y="0" width="${imageWidth}" height="${imageHeight}" fill="rgba(255, 255, 255, ${opacity})"/></svg>`,
          ),
          blend: 'dest-in',
        },
      ]);
    }

    if (rotation) {
      image = image.rotate(rotation);
    }

    if (background) {
      image = image.flatten({ background });
    }

    const outputFormat = output || mimeType.split('/')[1];
    const buffer = await image.toFormat(outputFormat, { quality }).toBuffer();

    return new StreamableFile(buffer, {
      type: `image/${outputFormat}`,
      disposition: `inline; filename="${fileName}"`,
      length: buffer.length,
    });
  }

  /**
   * Download a file.
   */
  async downloadFile(
    db: Database,
    bucketId: string,
    fileId: string,
    response: NuvixRes,
    request: NuvixRequest,
    project: Doc,
  ) {
    const deviceForFiles = this.coreService.getProjectDevice(project.getId());
    const bucket = await Authorization.skip(() =>
      db.getDocument('buckets', bucketId),
    );

    const isAPIKey = Auth.isAppUser(Authorization.getRoles());
    const isPrivilegedUser = Auth.isPrivilegedUser(Authorization.getRoles());

    if (
      bucket.empty() ||
      (!bucket.get('enabled') && !isAPIKey && !isPrivilegedUser)
    ) {
      throw new Exception(Exception.STORAGE_BUCKET_NOT_FOUND);
    }

    const fileSecurity = bucket.get('fileSecurity', false);
    const validator = new Authorization(PermissionType.Read);
    const valid = validator.$valid(bucket.getRead());
    if (!fileSecurity && !valid) {
      throw new Exception(Exception.USER_UNAUTHORIZED);
    }

    const file =
      fileSecurity && !valid
        ? await db.getDocument(
            this.getCollectionName(bucket.getSequence()),
            fileId,
          )
        : await Authorization.skip(() =>
            db.getDocument(
              this.getCollectionName(bucket.getSequence()),
              fileId,
            ),
          );

    if (file.empty()) {
      throw new Exception(Exception.STORAGE_FILE_NOT_FOUND);
    }

    const path = file.get('path', '');

    try {
      await deviceForFiles.exists(path);
    } catch {
      throw new Exception(
        Exception.STORAGE_FILE_NOT_FOUND,
        'File not found in ' + path,
      );
    }

    const mimeType = file.get('mimeType');
    const fileName = file.get('name', '');
    const size = file.get('sizeOriginal', 0);

    const rangeHeader = request.headers['range'];
    let start = 0;
    let end = size - 1;

    if (rangeHeader) {
      const [unit, range] = rangeHeader.split('=') as [string, string];
      if (unit !== 'bytes') {
        throw new Exception(Exception.STORAGE_INVALID_RANGE);
      }

      const [rangeStart, rangeEnd] = range.split('-').map(Number) as [
        number,
        number,
      ];
      start = rangeStart;
      end = rangeEnd || end;

      if (start >= end || end >= size) {
        throw new Exception(Exception.STORAGE_INVALID_RANGE);
      }

      response.header('Accept-Ranges', 'bytes');
      response.header('Content-Range', `bytes ${start}-${end}/${size}`);
      response.header('Content-Length', end - start + 1);
      response.status(206);
    } else {
      response.header('Content-Length', size);
    }

    response.header('Content-Type', mimeType);
    response.header(
      'Content-Disposition',
      `attachment; filename="${fileName}"`,
    );
    response.header(
      'Expires',
      new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toUTCString(),
    );

    if (rangeHeader) {
      const source = await deviceForFiles.read(path);
      const buffer = source.subarray(start, end + 1);
      return new StreamableFile(buffer, {
        type: mimeType,
        disposition: `attachment; filename="${fileName}"`,
        length: buffer.length,
      });
    }

    if (size > APP_STORAGE_READ_BUFFER) {
      const totalChunks = Math.ceil(size / MAX_OUTPUT_CHUNK_SIZE);
      const chunks: Buffer[] = [];

      for (let i = 0; i < totalChunks; i++) {
        const offset = i * MAX_OUTPUT_CHUNK_SIZE;
        const chunkSize = Math.min(MAX_OUTPUT_CHUNK_SIZE, size - offset);
        const chunkData = await deviceForFiles.read(path, offset, chunkSize);
        chunks.push(chunkData);
      }

      const buffer = Buffer.concat(chunks);
      return new StreamableFile(buffer, {
        type: mimeType,
        disposition: `attachment; filename="${fileName}"`,
        length: buffer.length,
      });
    } else {
      const buffer = await deviceForFiles.read(path);
      return new StreamableFile(buffer, {
        type: mimeType,
        disposition: `attachment; filename="${fileName}"`,
        length: buffer.length,
      });
    }
  }

  /**
   * View a file.
   */
  async viewFile(
    db: Database,
    bucketId: string,
    fileId: string,
    response: NuvixRes,
    request: NuvixRequest,
    project: Doc,
  ) {
    const deviceForFiles = this.coreService.getProjectDevice(project.getId());
    const bucket = await Authorization.skip(() =>
      db.getDocument('buckets', bucketId),
    );

    const isAPIKey = Auth.isAppUser(Authorization.getRoles());
    const isPrivilegedUser = Auth.isPrivilegedUser(Authorization.getRoles());

    if (
      bucket.empty() ||
      (!bucket.get('enabled') && !isAPIKey && !isPrivilegedUser)
    ) {
      throw new Exception(Exception.STORAGE_BUCKET_NOT_FOUND);
    }

    const fileSecurity = bucket.get('fileSecurity', false);
    const validator = new Authorization(PermissionType.Read);
    const valid = validator.$valid(bucket.getRead());
    if (!fileSecurity && !valid) {
      throw new Exception(Exception.USER_UNAUTHORIZED);
    }

    const file =
      fileSecurity && !valid
        ? await db.getDocument(
            this.getCollectionName(bucket.getSequence()),
            fileId,
          )
        : await Authorization.skip(() =>
            db.getDocument(
              this.getCollectionName(bucket.getSequence()),
              fileId,
            ),
          );

    if (file.empty()) {
      throw new Exception(Exception.STORAGE_FILE_NOT_FOUND);
    }

    const path = file.get('path', '');

    try {
      await deviceForFiles.exists(path);
    } catch {
      throw new Exception(
        Exception.STORAGE_FILE_NOT_FOUND,
        'File not found in ' + path,
      );
    }

    const mimeType = file.get('mimeType');
    const fileName = file.get('name', '');
    const size = file.get('sizeOriginal', 0);

    const rangeHeader = request.headers['range'];
    let start = 0;
    let end = size - 1;

    if (rangeHeader) {
      const [unit, range] = rangeHeader.split('=') as [string, string];
      if (unit !== 'bytes') {
        throw new Exception(Exception.STORAGE_INVALID_RANGE);
      }

      const [rangeStart, rangeEnd] = range.split('-').map(Number) as [
        number,
        number,
      ];
      start = rangeStart;
      end = rangeEnd || end;

      if (start >= end || end >= size) {
        throw new Exception(Exception.STORAGE_INVALID_RANGE);
      }

      response.header('Accept-Ranges', 'bytes');
      response.header('Content-Range', `bytes ${start}-${end}/${size}`);
      response.header('Content-Length', end - start + 1);
      response.status(206);
    } else {
      response.header('Content-Length', size);
    }

    response.header('Content-Type', mimeType);
    response.header('Content-Disposition', `inline; filename="${fileName}"`);
    response.header(
      'Expires',
      new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toUTCString(),
    );

    if (rangeHeader) {
      const source = await deviceForFiles.read(path);
      const buffer = source.subarray(start, end + 1);
      return new StreamableFile(buffer, {
        type: mimeType,
        disposition: `attachment; filename="${fileName}"`,
        length: buffer.length,
      });
    }

    if (size > APP_STORAGE_READ_BUFFER) {
      const totalChunks = Math.ceil(size / MAX_OUTPUT_CHUNK_SIZE);
      const chunks: Buffer[] = [];

      for (let i = 0; i < totalChunks; i++) {
        const offset = i * MAX_OUTPUT_CHUNK_SIZE;
        const chunkSize = Math.min(MAX_OUTPUT_CHUNK_SIZE, size - offset);
        const chunkData = await deviceForFiles.read(path, offset, chunkSize);
        chunks.push(chunkData);
      }

      const buffer = Buffer.concat(chunks);
      return new StreamableFile(buffer, {
        type: mimeType,
        disposition: `attachment; filename="${fileName}"`,
        length: buffer.length,
      });
    } else {
      const buffer = await deviceForFiles.read(path);
      return new StreamableFile(buffer, {
        type: mimeType,
        disposition: `attachment; filename="${fileName}"`,
        length: buffer.length,
      });
    }
  }

  /**
   * Get file for push notification
   */
  async getFileForPushNotification(
    db: Database,
    bucketId: string,
    fileId: string,
    jwt: string,
    request: NuvixRequest,
    response: NuvixRes,
    project: Doc,
  ) {
    const deviceForFiles = this.coreService.getProjectDevice(project.getId());
    const bucket = await Authorization.skip(() =>
      db.getDocument('buckets', bucketId),
    );

    let decoded: any;
    try {
      decoded = this.jwtService.verify(jwt);
    } catch (error) {
      throw new Exception(Exception.USER_UNAUTHORIZED);
    }

    if (
      decoded.projectId !== bucket.get('projectId') ||
      decoded.bucketId !== bucketId ||
      decoded.fileId !== fileId
    ) {
      throw new Exception(Exception.USER_UNAUTHORIZED);
    }

    const isAPIKey = Auth.isAppUser(Authorization.getRoles());
    const isPrivilegedUser = Auth.isPrivilegedUser(Authorization.getRoles());

    if (
      bucket.empty() ||
      (!bucket.get('enabled') && !isAPIKey && !isPrivilegedUser)
    ) {
      throw new Exception(Exception.STORAGE_BUCKET_NOT_FOUND);
    }

    const file = await Authorization.skip(() =>
      db.getDocument(this.getCollectionName(bucket.getSequence()), fileId),
    );

    if (file.empty()) {
      throw new Exception(Exception.STORAGE_FILE_NOT_FOUND);
    }

    const path = file.get('path', '');

    try {
      await deviceForFiles.exists(path);
    } catch {
      throw new Exception(
        Exception.STORAGE_FILE_NOT_FOUND,
        'File not found in ' + path,
      );
    }

    const mimeType = file.get('mimeType', 'text/plain');
    const fileName = file.get('name', '');
    const size = file.get('sizeOriginal', 0);

    response.header('Content-Type', mimeType);
    response.header('Content-Disposition', `inline; filename="${fileName}"`);
    response.header(
      'Expires',
      new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toUTCString(),
    );
    response.header('X-Peak', process.memoryUsage().heapUsed.toString());

    const rangeHeader = request.headers['range'];
    if (rangeHeader) {
      const [unit, range] = rangeHeader.split('=') as [string, string];
      if (unit !== 'bytes') {
        throw new Exception(Exception.STORAGE_INVALID_RANGE);
      }

      const [start, end] = range.split('-').map(Number) as [number, number];
      const finalEnd = end || size - 1;

      if (start >= finalEnd || finalEnd >= size) {
        throw new Exception(Exception.STORAGE_INVALID_RANGE);
      }

      response.header('Accept-Ranges', 'bytes');
      response.header('Content-Range', `bytes ${start}-${finalEnd}/${size}`);
      response.header('Content-Length', finalEnd - start + 1);
      response.status(206);

      const source = await deviceForFiles.read(path);
      const buffer = source.subarray(start, end + 1);
      return new StreamableFile(buffer, {
        type: mimeType,
        disposition: `attachment; filename="${fileName}"`,
        length: buffer.length,
      });
    }

    response.header('Content-Length', size);
    const buffer = await deviceForFiles.read(path);
    return new StreamableFile(buffer, {
      type: mimeType,
      disposition: `attachment; filename="${fileName}"`,
      length: buffer.length,
    });
  }

  /**
   * Update a file.
   */
  async updateFile(
    db: Database,
    bucketId: string,
    fileId: string,
    input: UpdateFileDTO,
  ) {
    const bucket = await Authorization.skip(() =>
      db.getDocument('buckets', bucketId),
    );

    const isAPIKey = Auth.isAppUser(Authorization.getRoles());
    const isPrivilegedUser = Auth.isPrivilegedUser(Authorization.getRoles());

    if (
      bucket.empty() ||
      (!bucket.get('enabled') && !isAPIKey && !isPrivilegedUser)
    ) {
      throw new Exception(Exception.STORAGE_BUCKET_NOT_FOUND);
    }

    const fileSecurity = bucket.get('fileSecurity', false);
    const validator = new Authorization(PermissionType.Update);
    const valid = validator.$valid(bucket.getUpdate());
    if (!fileSecurity && !valid) {
      throw new Exception(Exception.USER_UNAUTHORIZED);
    }

    const file = await Authorization.skip(() =>
      db.getDocument(this.getCollectionName(bucket.getSequence()), fileId),
    );

    if (file.empty()) {
      throw new Exception(Exception.STORAGE_FILE_NOT_FOUND);
    }

    let permissions = Permission.aggregate(input.permissions ?? [], [
      PermissionType.Read,
      PermissionType.Update,
      PermissionType.Delete,
    ]);

    const roles = Authorization.getRoles();
    if (
      !Auth.isAppUser(roles) &&
      !Auth.isPrivilegedUser(roles) &&
      permissions
    ) {
      permissions.forEach(permission => {
        const parsedPermission = Permission.parse(permission);
        if (!Authorization.isRole(parsedPermission.toString())) {
          throw new Exception(
            Exception.USER_UNAUTHORIZED,
            `Permissions must be one of: (${roles.join(', ')})`,
          );
        }
      });
    }

    if (!permissions) {
      permissions = file.getPermissions() ?? [];
    }

    file.set('$permissions', permissions);

    if (input.name) {
      file.set('name', input.name);
    }

    if (fileSecurity && !valid) {
      return db.updateDocument(
        this.getCollectionName(bucket.getSequence()),
        fileId,
        file,
      );
    } else {
      return Authorization.skip(() =>
        db.updateDocument(
          this.getCollectionName(bucket.getSequence()),
          fileId,
          file,
        ),
      );
    }
  }

  /**
   * Delete a file.
   */
  async deleteFile(
    db: Database,
    bucketId: string,
    fileId: string,
    project: Doc,
  ) {
    const deviceForFiles = this.coreService.getProjectDevice(project.getId());
    const bucket = await Authorization.skip(() =>
      db.getDocument('buckets', bucketId),
    );

    const isAPIKey = Auth.isAppUser(Authorization.getRoles());
    const isPrivilegedUser = Auth.isPrivilegedUser(Authorization.getRoles());

    if (
      bucket.empty() ||
      (!bucket.get('enabled') && !isAPIKey && !isPrivilegedUser)
    ) {
      throw new Exception(Exception.STORAGE_BUCKET_NOT_FOUND);
    }

    const fileSecurity = bucket.get('fileSecurity', false);
    const validator = new Authorization(PermissionType.Delete);
    const valid = validator.$valid(bucket.getDelete());
    if (!fileSecurity && !valid) {
      throw new Exception(Exception.USER_UNAUTHORIZED);
    }

    const file = await Authorization.skip(() =>
      db.getDocument(this.getCollectionName(bucket.getSequence()), fileId),
    );

    if (file.empty()) {
      throw new Exception(Exception.STORAGE_FILE_NOT_FOUND);
    }

    if (fileSecurity && !valid && !validator.$valid(file.getDelete())) {
      throw new Exception(Exception.USER_UNAUTHORIZED);
    }

    const filePath = file.get('path');
    let deviceDeleted = false;

    if (file.get('chunksTotal') !== file.get('chunksUploaded')) {
      deviceDeleted = await deviceForFiles.abort(
        filePath,
        file.get('metadata', {})['uploadId'] ?? '',
      );
    } else {
      deviceDeleted = await deviceForFiles.delete(filePath);
    }

    if (deviceDeleted) {
      const deleted =
        fileSecurity && !valid
          ? await db.deleteDocument(
              this.getCollectionName(bucket.getSequence()),
              fileId,
            )
          : await Authorization.skip(
              async () =>
                await db.deleteDocument(
                  this.getCollectionName(bucket.getSequence()),
                  fileId,
                ),
            );

      if (!deleted) {
        throw new Exception(
          Exception.GENERAL_SERVER_ERROR,
          'Failed to remove file from DB',
        );
      }
    } else {
      throw new Exception(
        Exception.GENERAL_SERVER_ERROR,
        'Failed to delete file from device',
      );
    }

    return {};
  }

  /**
   * Get Storage Usage.
   */
  async getStorageUsage(db: Database, range: string = '7d') {
    const periods = usageConfig;

    const stats: any = {};
    const usage: any = {};
    const days = periods[range as keyof typeof periods];
    const metrics = ['buckets', 'files', 'filesStorage'];

    await Authorization.skip(async () => {
      for (const metric of metrics) {
        const result = await db.findOne('stats', [
          Query.equal('metric', [metric]),
          Query.equal('period', ['inf']),
        ]);

        stats[metric] = { total: result.get('value') ?? 0, data: {} };
        const results = await db.find('stats', [
          Query.equal('metric', [metric]),
          Query.equal('period', [days.period]),
          Query.limit(days.limit),
          Query.orderDesc('time'),
        ]);

        for (const res of results) {
          stats[metric].data[res.get('time') as string] = {
            value: res.get('value'),
          };
        }
      }
    });

    const format =
      days.period === '1h'
        ? 'YYYY-MM-DDTHH:00:00.000Z'
        : 'YYYY-MM-DDT00:00:00.000Z';

    for (const metric of metrics) {
      usage[metric] = { total: stats[metric].total, data: [] };
      let leap = Math.floor(Date.now() / 1000) - days.limit * days.factor;

      while (leap < Math.floor(Date.now() / 1000)) {
        leap += days.factor;
        const formatDate =
          new Date(leap * 1000).toISOString().split('.')[0] + 'Z';
        usage[metric].data.push({
          value: stats[metric].data[formatDate]?.value ?? 0,
          date: formatDate,
        });
      }
    }

    return {
      range,
      bucketsTotal: usage.buckets?.total,
      filesTotal: usage.files?.total,
      filesStorageTotal: usage.filesStorage?.total,
      buckets: usage.buckets?.data,
      files: usage.files?.data,
      storage: usage.filesStorage?.data,
    };
  }

  /**
   * Get Storage Usage of bucket.
   */
  async getBucketStorageUsage(
    db: Database,
    bucketId: string,
    range: string = '7d',
  ) {
    const bucket = await db.getDocument('buckets', bucketId);

    if (bucket.empty()) {
      throw new Exception(Exception.STORAGE_BUCKET_NOT_FOUND);
    }

    const periods = usageConfig;

    const stats: any = {};
    const usage: any = {};
    const days = periods[range as keyof typeof periods];
    const metrics = [
      `bucket_${bucket.getSequence()}_files`,
      `bucket_${bucket.getSequence()}_filesStorage`,
    ];

    await Authorization.skip(async () => {
      for (const metric of metrics) {
        const result = await db.findOne('stats', [
          Query.equal('metric', [metric]),
          Query.equal('period', ['inf']),
        ]);

        stats[metric] = { total: result.get('value') ?? 0, data: {} };
        const results = await db.find('stats', [
          Query.equal('metric', [metric]),
          Query.equal('period', [days.period]),
          Query.limit(days.limit),
          Query.orderDesc('time'),
        ]);

        for (const res of results) {
          stats[metric].data[res.get('time') as string] = {
            value: res.get('value'),
          };
        }
      }
    });

    const format =
      days.period === '1h'
        ? 'YYYY-MM-DDTHH:00:00.000Z'
        : 'YYYY-MM-DDT00:00:00.000Z';

    for (const metric of metrics) {
      usage[metric] = { total: stats[metric].total, data: [] };
      let leap = Math.floor(Date.now() / 1000) - days.limit * days.factor;

      while (leap < Math.floor(Date.now() / 1000)) {
        leap += days.factor;
        const formatDate =
          new Date(leap * 1000).toISOString().split('.')[0] + 'Z';
        usage[metric].data.push({
          value: stats[metric].data[formatDate]?.value ?? 0,
          date: formatDate,
        });
      }
    }

    return {
      range,
      filesTotal: usage[metrics[0]!]?.total,
      filesStorageTotal: usage[metrics[1]!]?.total,
      files: usage[metrics[0]!]?.data,
      storage: usage[metrics[1]!]?.data,
    };
  }
}

interface PreviewParams {
  width?: number;
  height?: number;
  gravity?: string;
  quality?: number;
  borderWidth?: number;
  borderColor?: string;
  borderRadius?: number;
  opacity?: number;
  rotation?: number;
  background?: string;
  output?: string;
}
