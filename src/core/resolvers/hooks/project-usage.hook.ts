import { Injectable, Logger } from '@nestjs/common';
import { Document } from '@nuvix/database';
import {
  METRIC_NETWORK_INBOUND,
  METRIC_NETWORK_OUTBOUND,
  METRIC_NETWORK_REQUESTS,
  PROJECT,
} from 'src/Utils/constants';
import { ProjectUsageService } from 'src/core/project-usage.service';
import { Hook } from './base.hook';
import { FastifyRequest, FastifyReply } from 'fastify';

@Injectable()
export class ProjectUsageHook implements Hook {
  private readonly logger = new Logger(ProjectUsageHook.name);

  constructor(private readonly projectUsage: ProjectUsageService) {}

  async onRequest(req: FastifyRequest): Promise<void> {
    try {
      const project: Document = req[PROJECT];
      if (project.isEmpty() || project.getId() === 'console') return;
      const inboundSize = this.calculateInboundSize(req);
      await this.projectUsage.addMetric(METRIC_NETWORK_REQUESTS, 1);
      await this.projectUsage.addMetric(METRIC_NETWORK_INBOUND, inboundSize);
      this.logger.debug(`Project: ${project.getId()}, Inbound: ${inboundSize}`);
    } catch (error) {
      this.logger.error(
        `Usage hook failed (onRequest): ${error.message}`,
        error.stack,
      );
    }
  }

  async onResponse(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const project: Document = req[PROJECT];
      if (project.isEmpty() || project.getId() === 'console') return;
      const outboundSize = this.calculateOutboundSize(reply);
      await this.projectUsage.addMetric(METRIC_NETWORK_OUTBOUND, outboundSize);
      this.logger.debug(
        `Project: ${project.getId()}, Outbound: ${outboundSize}`,
      );
    } catch (error) {
      this.logger.error(
        `Usage hook failed (onResponse): ${error.message}`,
        error.stack,
      );
    }
  }

  private calculateInboundSize(req: FastifyRequest): number {
    let size = 0;

    if (req.body) {
      if (typeof req.body === 'string') {
        size += Buffer.byteLength(req.body);
      }
      // else if (req.body.file || req.body.files) {
      //   if (req.body.file?.data) {
      //     size += req.body.file.data.length;
      //   }
      //   if (req.body.files) {
      //     for (const file of Array.isArray(req.body.files) ? req.body.files : [req.body.files]) {
      //       if (file?.data) {
      //         size += file.data.length;
      //       }
      //     }
      //   }
      //   size += Buffer.byteLength(JSON.stringify(req.body));
      // }
      else {
        size += Buffer.byteLength(JSON.stringify(req.body));
      }
    }

    size += Buffer.byteLength(JSON.stringify(req.headers));
    return size;
  }

  private calculateOutboundSize(reply: FastifyReply): number {
    let size = 0;
    size += Number(reply.getHeader('content-length')) || 0;
    size += Buffer.byteLength(JSON.stringify(reply.getHeaders()));
    return size;
  }
}
