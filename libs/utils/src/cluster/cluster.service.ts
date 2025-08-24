import { ClusterManagerClient } from '@google-cloud/container';
import { Logger } from '@nestjs/common';
import {
  KubeConfig,
  KubernetesObjectApi,
  CoreV1Api,
  AppsV1Api,
  NetworkingV1Api,
  V1ConfigMap,
  V1Service,
  V1Namespace,
  V1StatefulSet,
  V1Ingress,
} from '@kubernetes/client-node';
import { ASSETS } from '../constants';
import { GoogleAuth } from 'google-auth-library';
import { DNS } from '@google-cloud/dns';

/**
 * Service for managing Kubernetes clusters and database deployments.
 *
 * Handles creating, configuring, and managing PostgreSQL databases with
 * pgcat connection pooling in Kubernetes clusters. Supports service deployment,
 * DNS configuration, load balancing, and resource cleanup.
 *
 * @warning This service is under active development. Some functionality may be
 * incomplete or require additional testing before production use.
 * @todo Implement missing features and improve error handling
 */
export class ClusterService {
  private readonly logger = new Logger(ClusterService.name);
  private kubeClient!: KubeConfig;
  private coreV1Api!: CoreV1Api;
  private appsV1Api!: AppsV1Api;
  private networkingV1Api!: NetworkingV1Api;
  private auth: GoogleAuth;
  private dnsClient: DNS;
  private staticIp: string;

  constructor() {
    this.auth = new GoogleAuth({
      keyFile: ASSETS.get('google-access-key.json'),
    });
    this.dnsClient = new DNS({ keyFile: ASSETS.get('google-access-key.json') });
    this.staticIp = '34.60.12.32';
  }

  async getCluster() {
    const client = new ClusterManagerClient({ auth: this.auth });
    const [cluster] = await client.getCluster({
      name: 'projects/uplifted-matrix-459802-d9/locations/asia-south1/clusters/nuvix',
    });
    return cluster;
  }

  async createKubeClient(cluster: Awaited<ReturnType<typeof this.getCluster>>) {
    const kubeconfig = new KubeConfig();

    const clusterName = cluster.name;
    const userName = '';
    const contextName = `${clusterName}-context`;

    kubeconfig.loadFromClusterAndUser(
      {
        name: clusterName as string,
        server: `https://gke-08671a5fef924341b319c8d5ed19a930c483-55770962934.asia-south1.gke.goog`,
        skipTLSVerify: true,
        caData: cluster.masterAuth?.clusterCaCertificate ?? undefined,
      },
      {
        name: userName,
        token: await this.getGKEToken(),
        certData: cluster.masterAuth?.clientCertificate ?? undefined,
      },
    );

    kubeconfig.contexts = [
      {
        name: contextName,
        cluster: clusterName as string,
        user: userName,
      },
    ];

    kubeconfig.setCurrentContext(contextName);

    this.kubeClient = kubeconfig;
    this.coreV1Api = kubeconfig.makeApiClient(CoreV1Api);
    this.appsV1Api = kubeconfig.makeApiClient(AppsV1Api);
    this.networkingV1Api = kubeconfig.makeApiClient(NetworkingV1Api); // Added for Ingress

    return kubeconfig;
  }

  private async getGKEToken(): Promise<string> {
    const client = await this.auth.getClient();
    const token = await client.getAccessToken();
    this.logger.debug('See, this is the token:', token);
    return token.token as string;
  }

  async deployProjectPod(
    projectId: string,
    dbConfig: {
      host: string;
      port: number;
      database: string;
      username: string;
      password: string;
    },
  ) {
    try {
      const cluster = await this.getCluster();
      this.logger.debug('We got the cluster:', cluster.id);
      await this.createKubeClient(cluster);

      const namespace = projectId;
      await this.createNamespace(namespace);
      this.logger.debug('Yap!, namespace created.');

      await this.cleanupExistingStatefulSet(namespace, projectId);

      await this.createServiceAccount(namespace, projectId);

      await this.createPgcatConfig(namespace, projectId, dbConfig);

      const statefulSetInfo = await this.deployStatefulSet(
        namespace,
        projectId,
        dbConfig,
      );
      this.logger.debug('We got statefulSetInfo', statefulSetInfo);

      const serviceInfo = await this.createService(namespace, projectId);

      // await this.createIngress(namespace, projectId); // Added for subdomain routing

      // await this.configureDNS(projectId); // Added for DNS

      await this.createPodDisruptionBudget(namespace, projectId);

      // Get external IP
      const externalIp = serviceInfo.status?.loadBalancer?.ingress?.[0]?.ip;
      this.logger.log(
        `Project ${projectId} deployed successfully with external IP: ${externalIp}`,
      );
      this.logger.debug('We got the external IP:', externalIp);
      return {
        namespace,
        statefulSetName: `${projectId}-statefulset`,
        serviceName: `${projectId}-service`,
        connectionInfo: {
          host: `${projectId}.db.nuvix.in`,
          ports: [6432, 5432], // Return both ports
          database: dbConfig.database,
          username: dbConfig.username,
        },
        status: 'deployed',
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to deploy StatefulSet for project ${projectId}:`,
        error,
      );
      throw error;
    }
  }

  private async cleanupExistingStatefulSet(
    namespace: string,
    projectId: string,
  ): Promise<void> {
    const statefulSetName = `${projectId}-statefulset`;
    const pvcName = `postgres-data-${statefulSetName}-0`;

    try {
      try {
        await this.appsV1Api.deleteNamespacedStatefulSet({
          name: statefulSetName,
          namespace: namespace,
          body: {
            propagationPolicy: 'Foreground',
          },
        });
        this.logger.log(`Existing StatefulSet ${statefulSetName} deleted`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (error: any) {
        if (error.response?.statusCode !== 404) {
          this.logger.warn(
            `Failed to delete existing StatefulSet: ${error.message}`,
          );
        }
      }

      try {
        await this.coreV1Api.deleteNamespacedPersistentVolumeClaim({
          name: pvcName,
          namespace: namespace,
        });
        this.logger.log(`Existing PVC ${pvcName} deleted`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (error: any) {
        if (error.response?.statusCode !== 404) {
          this.logger.warn(`Failed to delete existing PVC: ${error.message}`);
        }
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to cleanup existing StatefulSet for project ${projectId}:`,
        error,
      );
    }
  }

  private async createServiceAccount(
    namespace: string,
    projectId: string,
  ): Promise<void> {
    const serviceAccount = {
      apiVersion: 'v1',
      kind: 'ServiceAccount',
      metadata: {
        name: `${projectId}-sa`,
        namespace: namespace,
        labels: {
          'app.kubernetes.io/managed-by': 'nuvix',
          app: projectId,
        },
      },
    };

    try {
      await this.coreV1Api.createNamespacedServiceAccount({
        namespace: namespace,
        body: serviceAccount,
      });
      this.logger.log(
        `ServiceAccount for project ${projectId} created successfully`,
      );
    } catch (error: any) {
      if (error.code !== 409) {
        throw error;
      }
      this.logger.log(`ServiceAccount for project ${projectId} already exists`);
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
    } catch (error: any) {
      if (error.code !== 409) {
        throw error;
      }
      this.logger.log(`Namespace ${namespace} already exists`);
    }
  }

  private async createPgcatConfig(
    namespace: string,
    projectId: string,
    dbConfig: any,
  ): Promise<void> {
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
        body: configMap,
      });
      this.logger.log(
        `ConfigMap for project ${projectId} created successfully`,
      );
    } catch (error: any) {
      if (error.code === 409) {
        await this.coreV1Api.replaceNamespacedConfigMap({
          name: `${projectId}-pgcat-config`,
          namespace: namespace,
          body: configMap,
        });
        this.logger.log(
          `ConfigMap for project ${projectId} updated successfully`,
        );
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
    pool_mode = "transaction"
    max_client_conn = 150
    default_role = "any"
    stats_collection_interval = 60
    application_name = "nuvix-pgcat"
    connect_timeout = 5
    idle_timeout = 30
    server_lifetime = 3600
    server_round_robin = true
    ssl = true
    ssl_ca_file = "/etc/pgcat/tls/ca.crt"
    ssl_cert_file = "/etc/pgcat/tls/tls.crt"
    ssl_key_file = "/etc/pgcat/tls/tls.key"

    [pools.${dbConfig.database}]
    pool_mode = "transaction"
    default_role = "any"
    query_parser_enabled = true
    primary_reads_enabled = true
    sharding_function = "pg_bigint_hash"
    healthcheck_delay = 30000
    healthcheck_timeout = 15000
    ban_time = 60

    [pools.${dbConfig.database}.users.0]
    username = "postgres"
    password = "${dbConfig.password}"
    pool_size = 30
    statement_timeout = 0
    min_pool_size = 5
    max_pool_size = 50

    [pools.${dbConfig.database}.users.1]
    username = "${dbConfig.username}"
    password = "${dbConfig.password}"
    pool_size = 30
    statement_timeout = 0
    min_pool_size = 5
    max_pool_size = 50

    [pools.${dbConfig.database}.shards.0]
    servers = [[ "127.0.0.1", 5432, "primary" ]]
    database = "${dbConfig.database}"
    `.trim();
  }

  private async deployStatefulSet(
    namespace: string,
    projectId: string,
    dbConfig: any,
  ): Promise<any> {
    const statefulSetManifest: V1StatefulSet = {
      apiVersion: 'apps/v1',
      kind: 'StatefulSet',
      metadata: {
        name: `${projectId}-statefulset`,
        namespace: namespace,
        labels: {
          app: projectId,
          'app.kubernetes.io/managed-by': 'nuvix',
        },
      },
      spec: {
        serviceName: `${projectId}-headless`,
        replicas: 1,
        selector: {
          matchLabels: {
            app: projectId,
          },
        },
        template: {
          metadata: {
            labels: {
              app: projectId,
              'app.kubernetes.io/managed-by': 'nuvix',
            },
            annotations: {
              'cluster-autoscaler.kubernetes.io/safe-to-evict': 'false',
              'autopilot.gke.io/resource-adjustment': 'auto',
              // 'prometheus.io/scrape': 'true',
              // 'prometheus.io/port': '9930',
            },
          },
          spec: {
            serviceAccountName: `${projectId}-sa`,
            terminationGracePeriodSeconds: 30,
            securityContext: {
              fsGroup: 106,
              runAsUser: 105,
            },
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
                    valueFrom: {
                      secretKeyRef: {
                        name: `${projectId}-db-secret`,
                        key: 'password',
                      },
                    },
                  },
                  {
                    name: 'PROJECT_ID',
                    value: projectId,
                  },
                  {
                    name: 'PGDATA',
                    value: '/var/lib/postgresql/data/pgdata',
                  },
                  {
                    name: 'POSTGRES_USER',
                    value: 'nuvix_admin',
                  },
                  {
                    name: 'POSTGRES_DB',
                    value: dbConfig.database,
                  },
                ],
                resources: {
                  requests: {
                    memory: '512Mi',
                    cpu: '250m',
                    'ephemeral-storage': '1Gi',
                  },
                  limits: {
                    memory: '1Gi',
                    cpu: '500m',
                    'ephemeral-storage': '2Gi',
                  },
                },
                livenessProbe: {
                  exec: {
                    command: [
                      'pg_isready',
                      '-U',
                      'nuvix_admin',
                      '-h',
                      'localhost',
                    ],
                  },
                  initialDelaySeconds: 60,
                  periodSeconds: 10,
                  timeoutSeconds: 5,
                  failureThreshold: 3,
                },
                readinessProbe: {
                  exec: {
                    command: [
                      'pg_isready',
                      '-U',
                      'nuvix_admin',
                      '-h',
                      'localhost',
                    ],
                  },
                  initialDelaySeconds: 30,
                  periodSeconds: 5,
                  timeoutSeconds: 3,
                  failureThreshold: 3,
                },
                volumeMounts: [
                  {
                    name: 'postgres-data',
                    mountPath: '/var/lib/postgresql/data',
                  },
                ],
              },
              {
                name: 'pgcat',
                image:
                  'ghcr.io/postgresml/pgcat:4a7a6a8e7a78354b889002a4db118a8e2f2d6d79',
                ports: [
                  {
                    containerPort: 6432,
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
                  {
                    name: 'tls',
                    mountPath: '/etc/pgcat/tls',
                  },
                ],
                command: ['pgcat'],
                args: ['/etc/pgcat/pgcat.toml'],
                resources: {
                  requests: {
                    memory: '128Mi',
                    cpu: '100m',
                    'ephemeral-storage': '100Mi',
                  },
                  limits: {
                    memory: '256Mi',
                    cpu: '200m',
                    'ephemeral-storage': '200Mi',
                  },
                },
                livenessProbe: {
                  tcpSocket: {
                    port: 6432,
                  },
                  initialDelaySeconds: 30,
                  periodSeconds: 10,
                  timeoutSeconds: 5,
                  failureThreshold: 3,
                },
                readinessProbe: {
                  tcpSocket: {
                    port: 6432,
                  },
                  initialDelaySeconds: 10,
                  periodSeconds: 5,
                  timeoutSeconds: 3,
                  failureThreshold: 3,
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
              {
                name: 'tls',
                secret: {
                  secretName: `${projectId}-db-tls`,
                },
              },
            ],
            restartPolicy: 'Always',
            // affinity: {
            //   podAntiAffinity: {
            //     preferredDuringSchedulingIgnoredDuringExecution: [
            //       {
            //         weight: 100,
            //         podAffinityTerm: {
            //           labelSelector: {
            //             matchLabels: {
            //               app: projectId,
            //             },
            //           },
            //           topologyKey: 'kubernetes.io/hostname',
            //         },
            //       },
            //     ],
            //   },
            // },
          },
        },
        volumeClaimTemplates: [
          {
            metadata: {
              name: 'postgres-data',
              labels: {
                app: projectId,
                'app.kubernetes.io/managed-by': 'nuvix',
              },
            },
            spec: {
              accessModes: ['ReadWriteOnce'],
              resources: {
                requests: {
                  storage: '1Gi',
                },
              },
              storageClassName: 'standard-rwo',
            },
          },
        ],
        updateStrategy: {
          type: 'RollingUpdate',
          rollingUpdate: {
            partition: 0,
          },
        },
      },
    };

    try {
      const statefulSet = await this.appsV1Api.createNamespacedStatefulSet({
        namespace: namespace,
        body: statefulSetManifest,
      });
      this.logger.log(
        `StatefulSet for project ${projectId} created successfully`,
      );
      return statefulSet;
    } catch (error: any) {
      if (error.code === 409) {
        await this.appsV1Api.replaceNamespacedStatefulSet({
          name: `${projectId}-statefulset`,
          namespace: namespace,
          body: statefulSetManifest,
        });
        this.logger.log(
          `StatefulSet for project ${projectId} updated successfully`,
        );
      }
      throw error;
    }
  }

  private async createService(namespace: string, projectId: string) {
    const headlessServiceManifest: V1Service = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: `${projectId}-headless`,
        namespace: namespace,
        labels: {
          app: projectId,
          'app.kubernetes.io/managed-by': 'nuvix',
        },
      },
      spec: {
        clusterIP: 'None',
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
        ],
      },
    };

    const serviceManifest: V1Service = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: `${projectId}-service`,
        namespace: namespace,
        labels: {
          app: projectId,
          'app.kubernetes.io/managed-by': 'nuvix',
        },
        annotations: {
          'cloud.google.com/neg': '{"ingress":true}',
          'networking.gke.io/load-balancer-type': 'External', // Changed to External
          'cloud.google.com/load-balancer-type': 'External', // Changed to External
        },
      },
      spec: {
        selector: {
          app: projectId,
        },
        ports: [
          {
            name: 'pgcat',
            port: 6432,
            targetPort: 6432,
            protocol: 'TCP',
          },
          {
            name: 'postgres-direct',
            port: 5432,
            targetPort: 5432,
            protocol: 'TCP',
          },
        ],
        type: 'LoadBalancer',
        sessionAffinity: 'ClientIP',
        sessionAffinityConfig: {
          clientIP: {
            timeoutSeconds: 10800,
          },
        },
      },
    };

    const metricsServiceManifest: V1Service = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: `${projectId}-metrics`,
        namespace: namespace,
        labels: {
          app: projectId,
          'app.kubernetes.io/managed-by': 'nuvix',
        },
        annotations: {
          'cloud.google.com/load-balancer-type': 'Internal',
          'prometheus.io/scrape': 'true',
          'prometheus.io/port': '9930',
        },
      },
      spec: {
        selector: {
          app: projectId,
        },
        ports: [
          {
            name: 'metrics',
            port: 9930,
            targetPort: 9930,
            protocol: 'TCP',
          },
        ],
        type: 'ClusterIP', // Internal for metrics
      },
    };

    try {
      await this.coreV1Api.createNamespacedService({
        namespace: namespace,
        body: headlessServiceManifest,
      });
      this.logger.log(
        `Headless service for project ${projectId} created successfully`,
      );

      const response = await this.coreV1Api.createNamespacedService({
        namespace: namespace,
        body: serviceManifest,
      });
      this.logger.log(
        `Load balancer service for project ${projectId} created successfully`,
      );

      await this.coreV1Api.createNamespacedService({
        namespace: namespace,
        body: metricsServiceManifest,
      });
      this.logger.log(
        `Metrics service for project ${projectId} created successfully`,
      );

      return response;
    } catch (error: any) {
      if (error.code === 409) {
        await this.coreV1Api.replaceNamespacedService({
          name: `${projectId}-service`,
          namespace: namespace,
          body: serviceManifest,
        });
        await this.coreV1Api.replaceNamespacedService({
          name: `${projectId}-metrics`,
          namespace: namespace,
          body: metricsServiceManifest,
        });
        this.logger.log(
          `Services for project ${projectId} updated successfully`,
        );
        return this.coreV1Api.readNamespacedService({
          name: `${projectId}-service`,
          namespace: namespace,
        });
      } else {
        throw error;
      }
    }
  }

  private async createIngress(namespace: string, projectId: string) {
    const ingressManifest: V1Ingress = {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'Ingress',
      metadata: {
        name: `${projectId}-ingress`,
        namespace: namespace,
        labels: {
          app: projectId,
          'app.kubernetes.io/managed-by': 'nuvix',
        },
        annotations: {
          'kubernetes.io/ingress.global-static-ip-name': 'nuvix-db-ip',
        },
      },
      spec: {
        rules: [
          {
            host: `${projectId}.db.nuvix.in`,
            http: {
              paths: [
                {
                  path: '/',
                  pathType: 'Prefix',
                  backend: {
                    service: {
                      name: `${projectId}-service`,
                      port: {
                        number: 5432,
                      },
                    },
                  },
                },
                {
                  path: '/',
                  pathType: 'Prefix',
                  backend: {
                    service: {
                      name: `${projectId}-service`,
                      port: {
                        number: 6432,
                      },
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    };

    try {
      await this.networkingV1Api.createNamespacedIngress({
        namespace: namespace,
        body: ingressManifest,
      });
      this.logger.log(`Ingress for project ${projectId} created successfully`);
    } catch (error: any) {
      if (error.code === 409) {
        await this.networkingV1Api.replaceNamespacedIngress({
          name: `${projectId}-ingress`,
          namespace: namespace,
          body: ingressManifest,
        });
        this.logger.log(
          `Ingress for project ${projectId} updated successfully`,
        );
      } else {
        throw error;
      }
    }

    // // Update NGINX Ingress TCP ConfigMap
    // const tcpConfigMap: V1ConfigMap = {
    //   apiVersion: 'v1',
    //   kind: 'ConfigMap',
    //   metadata: {
    //     name: 'tcp-services',
    //     namespace: 'ingress-nginx',
    //   },
    //   data: {
    //     '5432': `${namespace}/${projectId}-service:5432`,
    //     '6432': `${namespace}/${projectId}-service:6432`,
    //   },
    // };

    // try {
    //   await this.coreV1Api.createNamespacedConfigMap({
    //     namespace: 'ingress-nginx',
    //     body: tcpConfigMap,
    //   });
    //   this.logger.log(`TCP ConfigMap for project ${projectId} created`);
    // } catch (error: any) {
    //   if (error instanceof ApiException && error.code === 409) {
    //     await this.coreV1Api.replaceNamespacedConfigMap({
    //       name: 'tcp-services',
    //       namespace: 'ingress-nginx',
    //       body: tcpConfigMap,
    //     });
    //     this.logger.log(`TCP ConfigMap for project ${projectId} updated`);
    //   } else {
    //     throw error;
    //   }
    // }
  }

  private async configureDNS(projectId: string) {
    const zoneName = 'nuvix-zone';
    const dnsName = 'nuvix.in';
    const subdomain = `${projectId}.db.nuvix.in`;

    try {
      const zone = await this.dnsClient.zone(zoneName).get();
      const [records] = await zone[0].getRecords({
        name: `${subdomain}.`,
        type: 'A',
      });

      if (records && records.length > 0) {
        this.logger.log(`DNS record for ${subdomain} already exists`);
      } else {
        const record = zone[0].record('A', {
          name: `${subdomain}.`,
          ttl: 300,
          data: [this.staticIp],
        });

        const [_] = await zone[0].addRecords([record]);
        this.logger.log(`DNS record for ${subdomain} created successfully`);
      }
    } catch (error: any) {
      if (error.code !== 409) {
        this.logger.error(`Failed to configure DNS for ${subdomain}:`, error);
        throw error;
      }
      this.logger.log(`DNS record for ${subdomain} already exists`);
    }
  }

  private async createPodDisruptionBudget(
    namespace: string,
    projectId: string,
  ): Promise<void> {
    const pdbManifest = {
      apiVersion: 'policy/v1',
      kind: 'PodDisruptionBudget',
      metadata: {
        name: `${projectId}-pdb`,
        namespace: namespace,
        labels: {
          app: projectId,
          'app.kubernetes.io/managed-by': 'nuvix',
        },
      },
      spec: {
        minAvailable: 1,
        selector: {
          matchLabels: {
            app: projectId,
          },
        },
      },
    };

    try {
      await this.kubeClient
        .makeApiClient(KubernetesObjectApi)
        .create(pdbManifest);
      this.logger.log(
        `PodDisruptionBudget for project ${projectId} created successfully`,
      );
    } catch (error: any) {
      if (error.code !== 409) {
        this.logger.warn(
          `Failed to create PodDisruptionBudget for project ${projectId}:`,
          error.message,
        );
      }
    }
  }

  async deleteProject(projectId: string): Promise<void> {
    const namespace = projectId;
    const statefulSetName = `${projectId}-statefulset`;
    const serviceName = `${projectId}-service`;
    const metricsServiceName = `${projectId}-metrics`;
    const headlessServiceName = `${projectId}-headless`;
    const configMapName = `${projectId}-pgcat-config`;
    const serviceAccountName = `${projectId}-sa`;
    const pdbName = `${projectId}-pdb`;
    const ingressName = `${projectId}-ingress`;
    const pvcName = `postgres-data-${statefulSetName}-0`;

    try {
      if (!this.appsV1Api || !this.coreV1Api || !this.networkingV1Api) {
        const cluster = await this.getCluster();
        await this.createKubeClient(cluster);
      }

      await this.appsV1Api
        .deleteNamespacedStatefulSet({
          name: statefulSetName,
          namespace: namespace,
          body: { propagationPolicy: 'Foreground' },
        })
        .catch(error => {
          if (error.response?.statusCode !== 404) {
            this.logger.warn(
              `Failed to delete StatefulSet ${statefulSetName}:`,
              error.message,
            );
          }
        });

      await this.coreV1Api
        .deleteNamespacedService({
          name: serviceName,
          namespace: namespace,
        })
        .catch(error => {
          if (error.response?.statusCode !== 404) {
            this.logger.warn(
              `Failed to delete service ${serviceName}:`,
              error.message,
            );
          }
        });

      await this.coreV1Api
        .deleteNamespacedService({
          name: metricsServiceName,
          namespace: namespace,
        })
        .catch(error => {
          if (error.response?.statusCode !== 404) {
            this.logger.warn(
              `Failed to delete metrics service ${metricsServiceName}:`,
              error.message,
            );
          }
        });

      await this.coreV1Api
        .deleteNamespacedService({
          name: headlessServiceName,
          namespace: namespace,
        })
        .catch(error => {
          if (error.response?.statusCode !== 404) {
            this.logger.warn(
              `Failed to delete headless service ${headlessServiceName}:`,
              error.message,
            );
          }
        });

      await this.coreV1Api
        .deleteNamespacedConfigMap({
          name: configMapName,
          namespace: namespace,
        })
        .catch(error => {
          if (error.response?.statusCode !== 404) {
            this.logger.warn(
              `Failed to delete configmap ${configMapName}:`,
              error.message,
            );
          }
        });

      await this.coreV1Api
        .deleteNamespacedPersistentVolumeClaim({
          name: pvcName,
          namespace: namespace,
        })
        .catch(error => {
          if (error.response?.statusCode !== 404) {
            this.logger.warn(`Failed to delete PVC ${pvcName}:`, error.message);
          }
        });

      await this.networkingV1Api
        .deleteNamespacedIngress({
          name: ingressName,
          namespace: namespace,
        })
        .catch(error => {
          if (error.response?.statusCode !== 404) {
            this.logger.warn(
              `Failed to delete ingress ${ingressName}:`,
              error.message,
            );
          }
        });

      await this.coreV1Api
        .deleteNamespacedServiceAccount({
          name: serviceAccountName,
          namespace: namespace,
        })
        .catch(error => {
          if (error.response?.statusCode !== 404) {
            this.logger.warn(
              `Failed to delete service account ${serviceAccountName}:`,
              error.message,
            );
          }
        });

      await this.kubeClient
        .makeApiClient(KubernetesObjectApi)
        .delete({
          apiVersion: 'policy/v1',
          kind: 'PodDisruptionBudget',
          metadata: {
            name: pdbName,
            namespace: namespace,
          },
        })
        .catch(error => {
          if (error.response?.statusCode !== 404) {
            this.logger.warn(`Failed to delete PDB ${pdbName}:`, error.message);
          }
        });

      // Clean up DNS
      await this.deleteDNS(projectId);

      this.logger.log(
        `All resources for project ${projectId} deleted successfully`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to delete resources for project ${projectId}:`,
        error,
      );
      throw error;
    }
  }

  async deleteDNS(projectId: string): Promise<void> {
    const zoneName = 'nuvix-zone';
    const subdomain = `${projectId}.db.nuvix.in`;
    this.logger.log(`Attempting to delete DNS record for ${subdomain}`);
    try {
      const zone = await this.dnsClient.zone(zoneName).get();
      const [records] = await zone[0].getRecords({
        name: `${subdomain}.`,
        type: 'A',
      });

      if (records && records.length > 0) {
        await zone[0].deleteRecords(records);
        this.logger.log(`DNS record for ${subdomain} deleted successfully`);
      } else {
        this.logger.log(`DNS record for ${subdomain} not found`);
      }
    } catch (error: any) {
      if (error.code !== 404) {
        this.logger.error(`Failed to delete DNS for ${subdomain}:`, error);
        throw error;
      }
      this.logger.log(`DNS record for ${subdomain} not found`);
    }
  }

  async getStatefulSetStatus(projectId: string): Promise<any> {
    const namespace = projectId;
    const statefulSetName = `${projectId}-statefulset`;

    try {
      if (!this.appsV1Api) {
        const cluster = await this.getCluster();
        await this.createKubeClient(cluster);
      }

      const response = await this.appsV1Api.readNamespacedStatefulSet({
        name: statefulSetName,
        namespace: namespace,
      });

      const statefulSet = response;
      const readyReplicas = statefulSet.status?.readyReplicas || 0;
      const replicas = statefulSet.spec?.replicas || 0;

      return {
        status: readyReplicas === replicas ? 'Ready' : 'Not Ready',
        ready: readyReplicas === replicas,
        readyReplicas,
        replicas,
        currentRevision: statefulSet.status?.currentRevision,
        updateRevision: statefulSet.status?.updateRevision,
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to get StatefulSet status for project ${projectId}:`,
        error,
      );
      throw error;
    }
  }

  async deleteNameSpace(name: string) {
    if (!this.coreV1Api) {
      const cluster = await this.getCluster();
      await this.createKubeClient(cluster);
    }

    await this.coreV1Api
      .deleteNamespace({
        name: name,
        body: { propagationPolicy: 'Foreground' },
      })
      .catch(error => {
        if (error.code !== 404) {
          this.logger.error(`Failed to delete namespace ${name}:`, error);
          throw error;
        }
        this.logger.log(`Namespace ${name} not found, nothing to delete.`);
      });
    this.logger.log(`Namespace ${name} deleted successfully`);
  }
}

export interface DeploymentResult {
  namespace: string;
  statefulSetName: string;
  serviceName: string;
  connectionInfo: {
    host: string;
    ports: number[];
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
const service = new ClusterService();
(async () => {
  try {
    try {
      await service.deleteNameSpace('test-project');
      Logger.log('Namespace deleted successfully');
    } catch (error: any) {
      Logger.error('Error deleting namespace:', error);
    }
    Logger.log('Starting deployment...');

    const result = await service.deployProjectPod('test-project', {
      host: 'localhost',
      port: 5432,
      database: 'postgres',
      username: 'postgres',
      password: 'testpassword',
    });

    Logger.log('Deployment Result:', result);

    // Check status
    setTimeout(async () => {
      try {
        const status = await service.getStatefulSetStatus('test-project');
        Logger.log('StatefulSet Status:', status);
      } catch (error: any) {
        Logger.error('Error getting status:', error);
      }
    }, 30000); // Check after 30 seconds
  } catch (error: any) {
    console.error('Error during operation:', error);
  }
})();
// Uncomment the line above to run the test
