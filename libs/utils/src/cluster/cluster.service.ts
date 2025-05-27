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
  V1Namespace,
  V1StatefulSet,
} from '@kubernetes/client-node';
import { ASSETS } from '../constants';
import { GoogleAuth } from 'google-auth-library';

export class ClusterService {
  private readonly logger = new Logger(ClusterService.name);
  private kubeClient: KubeConfig;
  private coreV1Api: CoreV1Api;
  private appsV1Api: AppsV1Api;
  private auth: GoogleAuth;

  constructor() {
    this.auth = new GoogleAuth({
      keyFile: ASSETS.get('google-access-key.json'),
    });
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
      },
    );

    kubeconfig.contexts = [
      {
        name: contextName,
        cluster: clusterName,
        user: userName,
      },
    ];

    kubeconfig.setCurrentContext(contextName);

    this.kubeClient = kubeconfig;
    this.coreV1Api = kubeconfig.makeApiClient(CoreV1Api);
    this.appsV1Api = kubeconfig.makeApiClient(AppsV1Api);

    return kubeconfig;
  }

  private async getGKEToken(): Promise<string> {
    const client = await this.auth.getClient();
    const token = await client.getAccessToken();
    this.logger.debug('See, this is the token:', token);
    return token.token;
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
      // Initialize kube client
      const cluster = await this.getCluster();
      this.logger.debug('We got the cluster:', cluster.id);
      await this.createKubeClient(cluster);

      // Create namespace for project
      const namespace = `project-${projectId}`;
      await this.createNamespace(namespace);
      this.logger.debug('Yap!, namespace created.');

      // Clean up any existing StatefulSet and PVC to ensure fresh deployment
      await this.cleanupExistingStatefulSet(namespace, projectId);

      // Create service account for better security
      await this.createServiceAccount(namespace, projectId);

      // Create pgcat config
      await this.createPgcatConfig(namespace, projectId, dbConfig);

      // Deploy StatefulSet instead of Pod for persistence
      const statefulSetInfo = await this.deployStatefulSet(
        namespace,
        projectId,
        dbConfig,
      );
      this.logger.debug('We got statefulSetInfo', statefulSetInfo);

      // Create service to expose the StatefulSet with load balancing
      const serviceInfo = await this.createService(namespace, projectId);

      // Create pod disruption budget to prevent unwanted deletions
      await this.createPodDisruptionBudget(namespace, projectId);

      return {
        namespace,
        statefulSetName: `${projectId}-statefulset`,
        serviceName: `${projectId}-service`,
        connectionInfo: {
          host: serviceInfo.spec?.clusterIP,
          port: 6432, // pgcat port for load balancing
          database: dbConfig.database,
          username: dbConfig.username,
          // pgcat will handle the authentication and connection pooling
        },
        status: 'deployed',
      };
    } catch (error) {
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
      // Delete StatefulSet first
      try {
        await this.appsV1Api.deleteNamespacedStatefulSet({
          name: statefulSetName,
          namespace: namespace,
          body: {
            propagationPolicy: 'Foreground',
          },
        });
        this.logger.log(`Existing StatefulSet ${statefulSetName} deleted`);

        // Wait for StatefulSet to be fully deleted
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (error) {
        if (error.response?.statusCode !== 404) {
          this.logger.warn(
            `Failed to delete existing StatefulSet: ${error.message}`,
          );
        }
      }

      // Delete PVC to ensure clean volume
      try {
        await this.coreV1Api.deleteNamespacedPersistentVolumeClaim({
          name: pvcName,
          namespace: namespace,
        });
        this.logger.log(`Existing PVC ${pvcName} deleted`);

        // Wait for PVC to be fully deleted
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (error) {
        if (error.response?.statusCode !== 404) {
          this.logger.warn(`Failed to delete existing PVC: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to cleanup existing StatefulSet for project ${projectId}:`,
        error,
      );
      // Don't throw - we want to continue with deployment
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
    } catch (error) {
      if (error.response?.statusCode !== 409) {
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
    } catch (error) {
      if (error.response?.statusCode !== 409) {
        // 409 = already exists
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
    } catch (error) {
      if (error.response?.statusCode === 409) {
        // Update existing configmap
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
    log_level = "info"
    stats_collection_interval = 60
    application_name = "nuvix-pgcat"
    connect_timeout = 5
    idle_timeout = 30
    server_lifetime = 3600
    server_round_robin = true

    [pools.${dbConfig.database}]
    pool_mode = "transaction"
    default_role = "any"
    query_parser_enabled = true
    primary_reads_enabled = true
    sharding_function = "pg_bigint_hash"
    automatic_sharding_key = "data"
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
    
    # Load balancing configuration
    [pools.${dbConfig.database}.load_balancing]
    type = "round_robin"
    health_check_enabled = true
    health_check_interval = 10
    
    # Connection pooling optimization
    [pools.${dbConfig.database}.connection_pooling]
    pool_checkout_timeout = 5000
    pool_validation_timeout = 3000
    connection_max_lifetime = 7200
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
              'cluster-autoscaler.kubernetes.io/safe-to-evict': 'false', // Prevent auto-eviction
              'autopilot.gke.io/resource-adjustment': 'auto',
            },
          },
          spec: {
            serviceAccountName: `${projectId}-sa`,
            terminationGracePeriodSeconds: 30,
            securityContext: {
              fsGroup: 999,
              runAsNonRoot: true,
              runAsUser: 999,
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
                    value: dbConfig.password,
                  },
                  {
                    name: 'PROJECT_ID',
                    value: projectId,
                  },
                  {
                    name: 'PGDATA',
                    value: '/var/lib/postgresql/data',
                  },
                  {
                    name: 'POSTGRES_USER',
                    value: 'nuvix_admin',
                  },
                  {
                    name: 'POSTGRES_DB',
                    value: dbConfig.database,
                  },
                  {
                    name: 'POSTGRES_INITDB_ARGS',
                    value:
                      '--allow-group-access --locale-provider=icu --encoding=UTF-8 --icu-locale=en_US.UTF-8',
                  },
                ],
                resources: {
                  requests: {
                    memory: '300Mi',
                    cpu: '100m',
                    'ephemeral-storage': '500Mi',
                  },
                  limits: {
                    memory: '400Mi',
                    cpu: '150m',
                    'ephemeral-storage': '1Gi',
                  },
                },
                securityContext: {
                  runAsUser: 999,
                  runAsGroup: 999,
                  allowPrivilegeEscalation: false,
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
                ],
                command: ['pgcat'],
                args: ['/etc/pgcat/pgcat.toml'],
                resources: {
                  requests: {
                    memory: '100Mi',
                    cpu: '50m',
                    'ephemeral-storage': '50Mi',
                  },
                  limits: {
                    memory: '150Mi',
                    cpu: '100m',
                    'ephemeral-storage': '100Mi',
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
            ],
            restartPolicy: 'Always',
            // GKE Autopilot optimized scheduling
            affinity: {
              podAntiAffinity: {
                preferredDuringSchedulingIgnoredDuringExecution: [
                  {
                    weight: 100,
                    podAffinityTerm: {
                      labelSelector: {
                        matchExpressions: [
                          {
                            key: 'app',
                            operator: 'In',
                            values: [projectId],
                          },
                        ],
                      },
                      topologyKey: 'kubernetes.io/hostname',
                    },
                  },
                ],
              },
            },
            // Remove nodeSelector and tolerations for GKE Autopilot compatibility
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
                  storage: '10Gi',
                },
              },
              storageClassName: 'standard-rwo', // GKE Autopilot compatible storage class
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

    const statefulSet = await this.appsV1Api.createNamespacedStatefulSet({
      namespace: namespace,
      body: statefulSetManifest,
    });
    this.logger.log(
      `StatefulSet for project ${projectId} created successfully`,
    );
    return statefulSet;
  }

  /**@deprecated: use stateful instead */
  private async deployPod(
    namespace: string,
    projectId: string,
    dbConfig: any,
  ): Promise<any> {
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
            image:
              'ghcr.io/postgresml/pgcat:4a7a6a8e7a78354b889002a4db118a8e2f2d6d79',
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
      body: podManifest,
    });
    this.logger.log(`Pod for project ${projectId} created successfully`);
    return pod;
  }

  private async createService(namespace: string, projectId: string) {
    // Create headless service for StatefulSet
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

    // Create load balancer service for external access
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
          'cloud.google.com/load-balancer-type': 'Internal',
          'networking.gke.io/load-balancer-type': 'Internal',
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
          {
            name: 'metrics',
            port: 9930,
            targetPort: 9930,
            protocol: 'TCP',
          },
        ],
        type: 'LoadBalancer',
        sessionAffinity: 'ClientIP',
        sessionAffinityConfig: {
          clientIP: {
            timeoutSeconds: 10800, // 3 hours
          },
        },
      },
    };

    try {
      // Create headless service first
      await this.coreV1Api.createNamespacedService({
        namespace: namespace,
        body: headlessServiceManifest,
      });
      this.logger.log(
        `Headless service for project ${projectId} created successfully`,
      );

      // Create load balancer service
      const response = await this.coreV1Api.createNamespacedService({
        namespace: namespace,
        body: serviceManifest,
      });
      this.logger.log(
        `Load balancer service for project ${projectId} created successfully`,
      );
      return response;
    } catch (error) {
      if (error.response?.statusCode === 409) {
        // Update existing service
        const response = await this.coreV1Api.replaceNamespacedService({
          name: `${projectId}-service`,
          namespace: namespace,
          body: serviceManifest,
        });
        this.logger.log(
          `Service for project ${projectId} updated successfully`,
        );
        return response;
      } else {
        throw error;
      }
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
    } catch (error) {
      if (error.response?.statusCode !== 409) {
        this.logger.warn(
          `Failed to create PodDisruptionBudget for project ${projectId}:`,
          error.message,
        );
      }
    }
  }

  private async createService_old(namespace: string, projectId: string) {
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
      body: serviceManifest,
    });
    this.logger.log(`Service for project ${projectId} created successfully`);
    return response;
  }

  async getStatefulSetStatus(projectId: string): Promise<any> {
    const namespace = `project-${projectId}`;
    const statefulSetName = `${projectId}-statefulset`;

    try {
      // Initialize kube client if not already done
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
    } catch (error) {
      this.logger.error(
        `Failed to get StatefulSet status for project ${projectId}:`,
        error,
      );
      throw error;
    }
  }

  async getPodStatus(projectId: string): Promise<any> {
    const namespace = `project-${projectId}`;
    const podName = `${projectId}-pod`;

    try {
      const response = await this.coreV1Api.readNamespacedPod({
        name: podName,
        namespace: namespace,
      });
      return {
        status: response.status?.phase,
        ready:
          response.status?.conditions?.find(c => c.type === 'Ready')?.status ===
          'True',
        restartCount:
          response.status?.containerStatuses?.[0]?.restartCount || 0,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get pod status for project ${projectId}:`,
        error,
      );
      throw error;
    }
  }

  async deleteProject(projectId: string): Promise<void> {
    const namespace = `project-${projectId}`;
    const statefulSetName = `${projectId}-statefulset`;
    const serviceName = `${projectId}-service`;
    const headlessServiceName = `${projectId}-headless`;
    const configMapName = `${projectId}-pgcat-config`;
    const serviceAccountName = `${projectId}-sa`;
    const pdbName = `${projectId}-pdb`;

    try {
      // Initialize kube client if not already done
      if (!this.appsV1Api || !this.coreV1Api) {
        const cluster = await this.getCluster();
        await this.createKubeClient(cluster);
      }

      // Delete StatefulSet
      await this.appsV1Api
        .deleteNamespacedStatefulSet({
          name: statefulSetName,
          namespace: namespace,
        })
        .catch(error => {
          if (error.response?.statusCode !== 404) {
            this.logger.warn(
              `Failed to delete StatefulSet ${statefulSetName}:`,
              error.message,
            );
          }
        });

      // Delete services
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

      // Delete configmap
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

      // Delete service account
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

      // Delete PodDisruptionBudget
      try {
        await this.kubeClient.makeApiClient(KubernetesObjectApi).delete({
          apiVersion: 'policy/v1',
          kind: 'PodDisruptionBudget',
          metadata: {
            name: pdbName,
            namespace: namespace,
          },
        });
      } catch (error) {
        if (error.response?.statusCode !== 404) {
          this.logger.warn(`Failed to delete PDB ${pdbName}:`, error.message);
        }
      }

      this.logger.log(
        `All resources for project ${projectId} deleted successfully`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to delete resources for project ${projectId}:`,
        error,
      );
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
        namespace: namespace,
      });

      // Delete service
      await this.coreV1Api.deleteNamespacedService({
        name: serviceName,
        namespace: namespace,
      });

      // Delete configmap
      await this.coreV1Api.deleteNamespacedConfigMap({
        name: configMapName,
        namespace: namespace,
      });

      this.logger.log(
        `Resources for project ${projectId} deleted successfully`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to delete resources for project ${projectId}:`,
        error,
      );
      throw error;
    }
  }

  async deleteNameSpace(name: string) {
    // Make sure kubernetes client is initialized
    if (!this.coreV1Api) {
      const cluster = await this.getCluster();
      await this.createKubeClient(cluster);
    }

    await this.coreV1Api
      .deleteNamespace({
        name: `project-${name}`,
      })
      .catch(error => {
        if (error.response?.statusCode !== 404) {
          // 404 = not found
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
  statefulSetName: string;
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
console.log('Yah, runtime reached to create a Object.');
const service = new ClusterService();
(async () => {
  console.log('Woo! Object created!');
  try {
    try {
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
      password: 'testpassword',
    });

    console.log('Deployment Result:', result);

    // Check status
    setTimeout(async () => {
      try {
        const status = await service.getStatefulSetStatus('test-project');
        console.log('StatefulSet Status:', status);
      } catch (error) {
        console.error('Error getting status:', error);
      }
    }, 30000); // Check after 30 seconds
  } catch (error) {
    console.error('Error during operation:', error);
  }
})();
// Uncomment the line above to run the test
