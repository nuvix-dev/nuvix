const consoleScopes = {
  'project.read': {
    description: 'Access to read project details',
  },
  'organization.write': {
    description: 'Access to create, update, and delete organization',
  },
}

export const scopes = {
  account: {
    description: 'Access to your account',
  },

  'sessions.write': {
    description: 'Access to create, update, and delete user sessions',
  },

  'users.read': {
    description: "Access to read your project's users",
  },
  'users.write': {
    description: "Access to create, update, and delete your project's users",
  },

  'teams.read': {
    description: "Access to read your project's teams",
  },
  'teams.write': {
    description: "Access to create, update, and delete your project's teams",
  },

  'collections.read': {
    description: "Access to read your project's database collections",
  },
  'collections.write': {
    description:
      "Access to create, update, and delete your project's database collections",
  },

  'attributes.read': {
    description:
      "Access to read your project's database collection's attributes",
  },
  'attributes.write': {
    description:
      "Access to create, update, and delete your project's database collection's attributes",
  },

  'indexes.read': {
    description: "Access to read your project's database collection's indexes",
  },
  'indexes.write': {
    description:
      "Access to create, update, and delete your project's database collection's indexes",
  },

  'documents.read': {
    description: "Access to read your project's database documents",
  },
  'documents.write': {
    description:
      "Access to create, update, and delete your project's database documents",
  },

  'files.read': {
    description:
      "Access to read your project's storage files and preview images",
  },
  'files.write': {
    description:
      "Access to create, update, and delete your project's storage files",
  },

  'buckets.read': {
    description: "Access to read your project's storage buckets",
  },
  'buckets.write': {
    description:
      "Access to create, update, and delete your project's storage buckets",
  },

  'locale.read': {
    description: "Access to access your project's Locale service",
  },
  'avatars.read': {
    description: "Access to access your project's Avatars service",
  },
  'health.read': {
    description: "Access to read your project's health status",
  },

  'providers.read': {
    description: "Access to read your project's providers",
  },
  'providers.write': {
    description:
      "Access to create, update, and delete your project's providers",
  },

  'messages.read': {
    description: "Access to read your project's messages",
  },
  'messages.write': {
    description: "Access to create, update, and delete your project's messages",
  },

  'topics.read': {
    description: "Access to read your project's topics",
  },
  'topics.write': {
    description: "Access to create, update, and delete your project's topics",
  },

  'subscribers.read': {
    description: "Access to read your project's subscribers",
  },
  'subscribers.write': {
    description:
      "Access to create, update, and delete your project's subscribers",
  },

  'targets.read': {
    description: "Access to read your project's targets",
  },
  'targets.write': {
    description: "Access to create, update, and delete your project's targets",
  },

  'schemas.read': {
    description: 'Access to read a schema',
  },
  'schemas.write': {
    description: 'Access to create, update, and delete a schema',
  },

  'schemas.tables.read': {
    description: 'Access to read schema tables',
  },
  'schemas.tables.write': {
    description: 'Access to create, update, and delete schema tables',
  },

  ...consoleScopes,
} as const
