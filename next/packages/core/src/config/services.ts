export interface ServiceItem {
  key: string
  name: string
  subtitle: string
  optional: boolean
}

export const services: Record<string, ServiceItem> = {
  account: {
    key: 'account',
    name: 'Account',
    subtitle: 'The Account service allows you to authenticate and manage a user account.',
    optional: true,
  },
  avatars: {
    key: 'avatars',
    name: 'Avatars',
    subtitle:
      'The Avatars service aims to help you complete everyday tasks related to your app image, icons, and avatars.',
    optional: true,
  },
  schemas: {
    key: 'schemas',
    name: 'Schemas',
    subtitle:
      'The Schemas service allows you to create structured collections of documents, query and filter lists of documents',
    optional: true,
  },
  database: {
    key: 'database',
    name: 'Database',
    subtitle: 'The Database service allows you to create schemas and manage your database.',
    optional: true,
  },
  locale: {
    key: 'locale',
    name: 'Locale',
    subtitle: "The Locale service allows you to customize your app based on your users' location.",
    optional: true,
  },
  health: {
    key: 'health',
    name: 'Health',
    subtitle:
      "The Health service allows you to both validate and monitor your nuvix server's health.",
    optional: true,
  },
  storage: {
    key: 'storage',
    name: 'Storage',
    subtitle: 'The Storage service allows you to manage your project files.',
    optional: true,
  },
  teams: {
    key: 'teams',
    name: 'Teams',
    subtitle:
      'The Teams service allows you to group users of your project and to enable them to share read and write access to your project resources',
    optional: true,
  },
  users: {
    key: 'users',
    name: 'Users',
    subtitle: 'The Users service allows you to manage your project users.',
    optional: true,
  },
  messaging: {
    key: 'messaging',
    name: 'Messaging',
    subtitle:
      'The Messaging service allows you to send messages to any provider type (SMTP, push notification, SMS, etc.).',
    optional: true,
  },
  projects: {
    key: 'projects',
    name: 'Projects',
    subtitle: 'The Projects service allows you to manage your projects and their resources.',
    optional: true,
  },
  project: {
    key: 'project',
    name: 'Project',
    subtitle: 'The Project service allows you to manage your project and its resources.',
    optional: true,
  },
} as const
