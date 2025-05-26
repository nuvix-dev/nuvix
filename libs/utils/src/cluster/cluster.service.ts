import { ClusterManagerClient } from '@google-cloud/container';
import { Logger } from '@nestjs/common';
import {
  KubeConfig,
  KubernetesObjectApi,
  CoreV1Api,
  AppsV1Api,
  V1Pod,
  V1ConfigMap,
  V1Service,
  V1Namespace
} from '@kubernetes/client-node';
import { ASSETS, GOOGLE_CLOUD_API, PROJECT_ROOT } from '../constants';
import { GoogleAuth } from 'google-auth-library';

export class ClusterService {
  private readonly logger = new Logger(ClusterService.name);
  private kubeClient: KubeConfig;
  private coreV1Api: CoreV1Api;
  private appsV1Api: AppsV1Api;
  private auth: GoogleAuth;

  constructor() {
    this.auth = new GoogleAuth({ keyFile: ASSETS.get('google-access-key.json') });
  }

  async getCluster() {
    const client = new ClusterManagerClient({ auth: this.auth });
    const [cluster] = await client.getCluster({
      name: 'projects/uplifted-matrix-459802-d9/locations/us-central1/clusters/nuvix',
    });
    return cluster;
  }

  async createKubeClient(cluster: Awaited<ReturnType<typeof this.getCluster>>) {
    const kubeconfig = new KubeConfig();

    // Define names
    const clusterName = cluster.name;
    const userName = '';
    const contextName = `${clusterName}-context`;

    // Add the cluster and user
    kubeconfig.loadFromClusterAndUser(
      {
        name: clusterName,
        server: `https://gke-662e41ebc4264ed18bd848b2c90e8022bffa-55770962934.us-central1.gke.goog`,
        skipTLSVerify: true,
        caData: cluster.masterAuth.clusterCaCertificate,
      },
      {
        name: userName,
        token: await this.getGKEToken(),
        certData: cluster.masterAuth.clientCertificate,
      }
    );

    kubeconfig.contexts = [{
      name: contextName,
      cluster: clusterName,
      user: userName,
    }];

    kubeconfig.setCurrentContext(contextName);

    this.kubeClient = kubeconfig;
    this.coreV1Api = kubeconfig.makeApiClient(CoreV1Api);
    this.appsV1Api = kubeconfig.makeApiClient(AppsV1Api);

    return kubeconfig;
  }

  private async getGKEToken(): Promise<string> {
    const client = await this.auth.getClient();
    const token = await client.getAccessToken();
    this.logger.debug('See, this is the token:', token)
    return token.token;
  }

  async deployProjectPod(projectId: string, dbConfig: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
  }) {
    try {
      // Initialize kube client
      const cluster = await this.getCluster();
      this.logger.debug('We got the cluster:', cluster.id)
      await this.createKubeClient(cluster);

      // Create namespace for project
      const namespace = `project-${projectId}`;
      await this.createNamespace(namespace);
      this.logger.debug('Yap!, namespace created.')
      // Create pgcat config
      await this.createPgcatConfig(namespace, projectId, dbConfig);

      // Deploy pod with main container and pgcat sidecar
      const podInfo = await this.deployPod(namespace, projectId, dbConfig);
      this.logger.debug('We gota podInfo', podInfo)

      // Create service to expose the pod
      const serviceInfo = await this.createService(namespace, projectId);

      return {
        namespace,
        podName: `${projectId}-pod`,
        serviceName: `${projectId}-service`,
        connectionInfo: {
          host: serviceInfo.spec?.clusterIP,
          port: 5432, // pgcat port
          database: dbConfig.database,
          username: dbConfig.username,
          // pgcat will handle the authentication
        },
        status: 'deployed'
      };
    } catch (error) {
      this.logger.error(`Failed to deploy pod for project ${projectId}:`, error);
      throw error;
    }
  }

  private async createNamespace(namespace: string): Promise<void> {
    try {
      const namespaceManifest: V1Namespace = {
        apiVersion: 'v1',
        kind: 'Namespace',
        metadata: {
          name: namespace,
          labels: {
            'app.kubernetes.io/managed-by': 'nuvix',
          },
        },
      };

      await this.coreV1Api.createNamespace({ body: namespaceManifest });
      this.logger.log(`Namespace ${namespace} created successfully`);
    } catch (error) {
      if (error.response?.statusCode !== 409) { // 409 = already exists
        throw error;
      }
      this.logger.log(`Namespace ${namespace} already exists`);
    }
  }

  private async createPgcatConfig(namespace: string, projectId: string, dbConfig: any): Promise<void> {
    const pgcatConfig = this.generatePgcatConfig(dbConfig);

    const configMap: V1ConfigMap = {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        name: `${projectId}-pgcat-config`,
        namespace: namespace,
      },
      data: {
        'pgcat.toml': pgcatConfig,
      },
    };

    try {
      await this.coreV1Api.createNamespacedConfigMap({
        namespace: namespace,
        body: configMap
      });
      this.logger.log(`ConfigMap for project ${projectId} created successfully`);
    } catch (error) {
      if (error.response?.statusCode === 409) {
        // Update existing configmap
        await this.coreV1Api.replaceNamespacedConfigMap({
          name: `${projectId}-pgcat-config`,
          namespace: namespace,
          body: configMap
        });
        this.logger.log(`ConfigMap for project ${projectId} updated successfully`);
      } else {
        throw error;
      }
    }
  }

  private generatePgcatConfig(dbConfig: any): string {
    return `
    [general]
    host = "0.0.0.0"
    port = 6432
    prometheus_exporter_port = 9930
    admin_username = "admin_user"
    admin_password = "${dbConfig.password}"

    [pools.${dbConfig.database}]
    pool_mode = "transaction"
    default_role = "any"
    query_parser_enabled = false
    primary_reads_enabled = true
    sharding_function = "pg_bigint_hash"

    [pools.${dbConfig.database}.users.0]
    username = "postgres"
    password = "${dbConfig.password}"
    pool_size = 25
    statement_timeout = 0

    [pools.${dbConfig.database}.users.1]
    username = "${dbConfig.username}"
    password = "${dbConfig.password}"
    pool_size = 25
    statement_timeout = 0

    [pools.${dbConfig.database}.shards.0]
    servers = [[ "${dbConfig.host}", ${dbConfig.port}, "primary" ]]
    database = "${dbConfig.database}"
    `.trim();
  }

  private async deployPod(namespace: string, projectId: string, dbConfig: any): Promise<any> {
    const podManifest: V1Pod = {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: {
        name: `${projectId}-pod`,
        namespace: namespace,
        labels: {
          app: projectId,
          'app.kubernetes.io/managed-by': 'nuvix',
        },
      },
      spec: {
        containers: [
          {
            name: 'nxpg',
            image: 'ravikan6/nxpg:latest',
            ports: [
              {
                containerPort: 5432,
                name: 'postgres',
              },
            ],
            env: [
              {
                name: 'POSTGRES_PASSWORD',
                value: dbConfig.password,
              },
              {
                name: 'PROJECT_ID',
                value: projectId,
              },
            ],
            resources: {
              requests: {
                memory: '300Mi',
                cpu: '150m',
              },
              limits: {
                memory: '350Mi',
                cpu: '150m',
              },
            },
          },
          {
            name: 'pgcat',
            image: 'ghcr.io/postgresml/pgcat:4a7a6a8e7a78354b889002a4db118a8e2f2d6d79',
            ports: [
              {
                containerPort: 6432, // PG Bouncer Port
                name: 'pgcat',
              },
              {
                containerPort: 9930,
                name: 'metrics',
              },
            ],
            volumeMounts: [
              {
                name: 'pgcat-config',
                mountPath: '/etc/pgcat',
              },
            ],
            command: ['pgcat'],
            args: ['/etc/pgcat/pgcat.toml'],
            resources: {
              requests: {
                memory: '100Mi',
                cpu: '50m',
              },
              limits: {
                memory: '150Mi',
                cpu: '100m',
              },
            },
          },
        ],
        volumes: [
          {
            name: 'pgcat-config',
            configMap: {
              name: `${projectId}-pgcat-config`,
            },
          },
        ],
        restartPolicy: 'Always',
      },
    };

    const pod = await this.coreV1Api.createNamespacedPod({
      namespace: namespace,
      body: podManifest
    });
    this.logger.log(`Pod for project ${projectId} created successfully`);
    return pod;
  }

  private async createService(namespace: string, projectId: string) {
    const serviceManifest: V1Service = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: `${projectId}-service`,
        namespace: namespace,
        labels: {
          app: projectId,
        },
      },
      spec: {
        selector: {
          app: projectId,
        },
        ports: [
          {
            name: 'postgres',
            port: 5432,
            targetPort: 5432,
          },
          {
            name: 'pgcat',
            port: 6432,
            targetPort: 6432,
          },
          {
            name: 'metrics',
            port: 9930,
            targetPort: 9930,
          },
        ],
        type: 'ClusterIP',
      },
    };

    const response = await this.coreV1Api.createNamespacedService({
      namespace: namespace,
      body: serviceManifest
    });
    this.logger.log(`Service for project ${projectId} created successfully`);
    return response;
  }

  async getPodStatus(projectId: string): Promise<any> {
    const namespace = `project-${projectId}`;
    const podName = `${projectId}-pod`;

    try {
      const response = await this.coreV1Api.readNamespacedPod({
        name: podName,
        namespace: namespace
      });
      return {
        status: response.status?.phase,
        ready: response.status?.conditions?.find(c => c.type === 'Ready')?.status === 'True',
        restartCount: response.status?.containerStatuses?.[0]?.restartCount || 0,
      };
    } catch (error) {
      this.logger.error(`Failed to get pod status for project ${projectId}:`, error);
      throw error;
    }
  }

  async deletePod(projectId: string): Promise<void> {
    const namespace = `project-${projectId}`;
    const podName = `${projectId}-pod`;
    const serviceName = `${projectId}-service`;
    const configMapName = `${projectId}-pgcat-config`;

    try {
      // Delete pod
      await this.coreV1Api.deleteNamespacedPod({
        name: podName,
        namespace: namespace
      });

      // Delete service
      await this.coreV1Api.deleteNamespacedService({
        name: serviceName,
        namespace: namespace
      });

      // Delete configmap
      await this.coreV1Api.deleteNamespacedConfigMap({
        name: configMapName,
        namespace: namespace
      });

      this.logger.log(`Resources for project ${projectId} deleted successfully`);
    } catch (error) {
      this.logger.error(`Failed to delete resources for project ${projectId}:`, error);
      throw error;
    }
  }

  async deleteNameSpace(name: string) {
    // Make sure kubernetes client is initialized
    if (!this.coreV1Api) {
      const cluster = await this.getCluster();
      await this.createKubeClient(cluster);
    }
    
    await this.coreV1Api.deleteNamespace({
      name: `project-${name}`,
    }).catch(error => {
      if (error.response?.statusCode !== 404) { // 404 = not found
        this.logger.error(`Failed to delete namespace ${name}:`, error);
        throw error;
      }
      this.logger.log(`Namespace ${name} not found, nothing to delete.`);
    });
    this.logger.log(`Namespace ${name} deleted successfully`);
  }
}

// Example usage interface
export interface DeploymentResult {
  namespace: string;
  podName: string;
  serviceName: string;
  connectionInfo: {
    host: string;
    port: number;
    database: string;
    username: string;
  };
  status: string;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}


// Simple test, 
console.log('Yah, runtime reached to create a Object.')
const service = new ClusterService();
(async () => {
  console.log('Woo! Object created!')
  try {
    try{
    await service.deleteNameSpace('test-project');
    console.log('Namespace deleted successfully');
    } catch (error) {
      console.error('Error deleting namespace:', error);
    }
    console.log('Starting deployment...');
    
    const result = await service.deployProjectPod('test-project', {
      host: 'localhost',
      port: 5432,
      database: 'postgres',
      username: 'postgres',
      password: 'testpassword'
    });
    
    console.log('Deployment Result:', result);
  } catch (error) {
    console.error('Error during operation:', error);
  }
})();
// Uncomment the line above to run the test