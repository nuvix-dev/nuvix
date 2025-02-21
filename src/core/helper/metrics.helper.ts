import { Document } from '@nuvix/database';
import { Redis } from 'ioredis';

export class MetricsHelper {
  private redis: Redis;

  constructor(connection: Redis) {
    this.redis = connection;
  }

  async incrementBandwidth(
    project: Document,
    uploadSize: number,
    downloadSize: number,
  ) {
    const key = `bandwidth:${project.getId()}:${this.getCurrentHour()}`;

    await this.redis.hincrby(key, 'upload', uploadSize);
    await this.redis.hincrby(key, 'download', downloadSize);
    await this.redis.expire(key, 86400 * 2); // Store for 2 days
  }

  async getBandwidthKeys(): Promise<string[]> {
    return this.redis.keys('bandwidth:*');
  }

  async getBandwidthUsage(project: Document, timestamp: string) {
    const key = `bandwidth:${project.getId()}:${timestamp}`;
    const data = await this.redis.hgetall(key);
    return {
      upload: Number(data.upload) || 0,
      download: Number(data.download) || 0,
    };
  }

  async deleteKey(key: string) {
    await this.redis.del(key);
  }

  private getCurrentHour(): string {
    const now = new Date();
    return `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}-${now.getUTCHours()}`;
  }
}
