import { Injectable, Logger } from "@nestjs/common";
import { AppConfigService } from "@nuvix/core";
import { HttpService } from "@nestjs/axios";
import type { TunnelConfig, TunnelConfigResponse, TunnelResponse } from "./cloudflare.types";
import { Exception } from "@nuvix/core/extend/exception";


@Injectable()
export class CloudflareService {
    private readonly apiKey: string;
    private readonly accountId: string;
    private readonly apiBaseUrl = 'https://api.cloudflare.com/client/v4';
    private readonly logger = new Logger(CloudflareService.name);

    private get baseHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
        };
    };

    constructor(
        private readonly appConfig: AppConfigService,
        private readonly httpService: HttpService,
    ) {
        const cloudflareConfig = this.appConfig.getCloudflareConfig();

        if (cloudflareConfig.apiKey === undefined || cloudflareConfig.accountId === undefined) {
            throw new Error('Cloudflare configuration is missing');
        }

        this.apiKey = cloudflareConfig.apiKey;
        this.accountId = cloudflareConfig.accountId;
    }

    public async createTunnel(tunnelName: string): Promise<any> {
        const url = `${this.apiBaseUrl}/accounts/${this.accountId}/cfd_tunnel`;
        const data = {
            name: tunnelName,
            config_src: "cloudflare"
        };
        const headers = this.baseHeaders;

        const res = await this.httpService.axiosRef.post<any, TunnelResponse>(url, data, { headers });

        if (!res.success) {
            this.logger.error(`Failed to create Cloudflare tunnel: ${JSON.stringify(res.errors)}`);
            throw new Exception(Exception.GENERAL_SERVER_ERROR, 'Failed to create Cloudflare tunnel');
        }

        return res.result;
    }

    public async getTunnel(tunnelId: string): Promise<any> {
        const url = `${this.apiBaseUrl}/accounts/${this.accountId}/cfd_tunnel/${tunnelId}`;
        const headers = this.baseHeaders;

        const res = await this.httpService.axiosRef.get<any, TunnelResponse>(url, { headers });

        if (!res.success) {
            this.logger.error(`Failed to get Cloudflare tunnel: ${JSON.stringify(res.errors)}`);
            throw new Exception(Exception.GENERAL_SERVER_ERROR, 'Failed to get Cloudflare tunnel');
        }

        return res.result;
    }

    public async updateTunnel(tunnelId: string, metadata: TunnelConfig): Promise<any> {
        const url = `${this.apiBaseUrl}/accounts/${this.accountId}/cfd_tunnel/${tunnelId}`;
        const data = {
            config: metadata
        };
        const headers = this.baseHeaders;

        const res = await this.httpService.axiosRef.put<any, TunnelConfigResponse>(url, data, { headers });

        if (!res.success) {
            this.logger.error(`Failed to update Cloudflare tunnel: ${JSON.stringify(res.errors)}`);
            throw new Exception(Exception.GENERAL_SERVER_ERROR, 'Failed to update Cloudflare tunnel');
        }

        return res.result;
    }


}
