
export interface CredentialsFile {
    AccountTag: string;
    TunnelID: string;
    TunnelName: string;
    TunnelSecret: string;
}

export interface Connection {
    colo_name: string;
    uuid: string;
    id: string;
    is_pending_reconnect: boolean;
    origin_ip: string;
    opened_at: string;
    client_id: string;
    client_version: string;
}

export interface Tunnel {
    id: string;
    account_tag: string;
    created_at: string;
    deleted_at: string | null;
    name: string;
    connections: Connection[];
    conns_active_at: string | null;
    conns_inactive_at: string | null;
    tun_type: string;
    metadata: Record<string, any>;
    status: string;
    remote_config: boolean;
    credentials_file: CredentialsFile;
    token: string;
}

export interface TunnelResponse {
    success: boolean;
    errors: string[];
    messages: string[];
    result: Tunnel;
}

export interface OriginRequest {
    [key: string]: any;
}

export interface TunnelConfigResponse {
    success: boolean;
    errors: string[];
    messages: string[];
    result: TunnelConfigRes;
}

export interface TunnelConfigRes {
    account_id: string;
    config: TunnelConfig;
    source: string;
    version: number;
}

export interface TunnelConfig {
    ingress: IngressRule[];
    originRequest?: OriginRequest;
}

export interface IngressRule {
    hostname?: string;
    service: string;
    originRequest?: OriginRequest;
    path?: string;
}

export interface OriginRequest {
    access?: {
        audTag: string[];
        teamName: string;
        required: boolean;
    };
    caPool?: string;
    connectTimeout?: number;
    disableChunkedEncoding?: boolean;
    http2Origin?: boolean;
    httpHostHeader?: string;
    keepAliveConnections?: number;
    keepAliveTimeout?: number;
    noHappyEyeballs?: boolean;
    noTLSVerify?: boolean;
    originServerName?: string;
    proxyType?: string;
    tcpKeepAlive?: number;
    tlsTimeout?: number;
}
