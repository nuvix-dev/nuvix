const consoleScopes = {
  'project.create': {
    description: 'Access to create project',
  },
  'project.read': {
    description: 'Access to read project details',
  },
  'project.update': {
    description: 'Access to update project settings',
  },
  'project.delete': {
    description: 'Access to delete project',
  },
  'organization.create': {
    description: 'Access to create organization',
  },
  'organization.read': {
    description: 'Access to read organization details',
  },
  'organization.update': {
    description: 'Access to update organization settings',
  },
  'organization.delete': {
    description: 'Access to delete organization',
  },
};

export const scopes = {
  // List of publicly visible scopes
  account: {
    description: 'Access to your account',
  },
  'sessions.create': {
    description: 'Access to create user sessions',
  },
  'sessions.update': {
    description: 'Access to update user sessions',
  },
  'sessions.delete': {
    description: 'Access to delete user sessions',
  },
  'users.read': {
    description: "Access to read your project's users",
  },
  'users.create': {
    description: "Access to create your project's users",
  },
  'users.update': {
    description: "Access to update your project's users",
  },
  'users.delete': {
    description: "Access to delete your project's users",
  },
  'teams.read': {
    description: "Access to read your project's teams",
  },
  'teams.create': {
    description: "Access to create your project's teams",
  },
  'teams.update': {
    description: "Access to update your project's teams",
  },
  'teams.delete': {
    description: "Access to delete your project's teams",
  },
  'databases.read': {
    description: "Access to read your project's databases",
  },
  'databases.create': {
    description: "Access to create your project's databases",
  },
  'databases.update': {
    description: "Access to update your project's databases",
  },
  'databases.delete': {
    description: "Access to delete your project's databases",
  },
  'collections.read': {
    description: "Access to read your project's database collections",
  },
  'collections.create': {
    description: "Access to create your project's database collections",
  },
  'collections.update': {
    description: "Access to update your project's database collections",
  },
  'collections.delete': {
    description: "Access to delete your project's database collections",
  },
  'attributes.read': {
    description:
      "Access to read your project's database collection's attributes",
  },
  'attributes.create': {
    description:
      "Access to create your project's database collection's attributes",
  },
  'attributes.update': {
    description:
      "Access to update your project's database collection's attributes",
  },
  'attributes.delete': {
    description:
      "Access to delete your project's database collection's attributes",
  },
  'indexes.read': {
    description: "Access to read your project's database collection's indexes",
  },
  'indexes.create': {
    description:
      "Access to create your project's database collection's indexes",
  },
  'indexes.update': {
    description:
      "Access to update your project's database collection's indexes",
  },
  'indexes.delete': {
    description:
      "Access to delete your project's database collection's indexes",
  },
  'documents.read': {
    description: "Access to read your project's database documents",
  },
  'documents.create': {
    description: "Access to create your project's database documents",
  },
  'documents.update': {
    description: "Access to update your project's database documents",
  },
  'documents.delete': {
    description: "Access to delete your project's database documents",
  },
  'files.read': {
    description:
      "Access to read your project's storage files and preview images",
  },
  'files.create': {
    description: "Access to create your project's storage files",
  },
  'files.update': {
    description: "Access to update your project's storage files",
  },
  'files.delete': {
    description: "Access to delete your project's storage files",
  },
  'buckets.read': {
    description: "Access to read your project's storage buckets",
  },
  'buckets.create': {
    description: "Access to create your project's storage buckets",
  },
  'buckets.update': {
    description: "Access to update your project's storage buckets",
  },
  'buckets.delete': {
    description: "Access to delete your project's storage buckets",
  },
  'functions.read': {
    description: "Access to read your project's functions and code deployments",
  },
  'functions.create': {
    description:
      "Access to create your project's functions and code deployments",
  },
  'functions.update': {
    description:
      "Access to update your project's functions and code deployments",
  },
  'functions.delete': {
    description:
      "Access to delete your project's functions and code deployments",
  },
  'execution.read': {
    description: "Access to read your project's execution logs",
  },
  'execution.create': {
    description: "Access to execute your project's functions",
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
  'providers.create': {
    description: "Access to create your project's providers",
  },
  'providers.update': {
    description: "Access to update your project's providers",
  },
  'providers.delete': {
    description: "Access to delete your project's providers",
  },
  'messages.read': {
    description: "Access to read your project's messages",
  },
  'messages.create': {
    description: "Access to create your project's messages",
  },
  'messages.update': {
    description: "Access to update your project's messages",
  },
  'messages.delete': {
    description: "Access to delete your project's messages",
  },
  'topics.read': {
    description: "Access to read your project's topics",
  },
  'topics.create': {
    description: "Access to create your project's topics",
  },
  'topics.update': {
    description: "Access to update your project's topics",
  },
  'topics.delete': {
    description: "Access to delete your project's topics",
  },
  'subscribers.read': {
    description: "Access to read your project's subscribers",
  },
  'subscribers.create': {
    description: "Access to create your project's subscribers",
  },
  'subscribers.update': {
    description: "Access to update your project's subscribers",
  },
  'subscribers.delete': {
    description: "Access to delete your project's subscribers",
  },
  'targets.read': {
    description: "Access to read your project's targets",
  },
  'targets.create': {
    description: "Access to create your project's targets",
  },
  'targets.update': {
    description: "Access to update your project's targets",
  },
  'targets.delete': {
    description: "Access to delete your project's targets",
  },
  'rules.read': {
    description: "Access to read your project's proxy rules",
  },
  'rules.create': {
    description: "Access to create your project's proxy rules",
  },
  'rules.update': {
    description: "Access to update your project's proxy rules",
  },
  'rules.delete': {
    description: "Access to delete your project's proxy rules",
  },
  'migrations.read': {
    description: "Access to read your project's migrations",
  },
  'migrations.create': {
    description: "Access to create your project's migrations",
  },
  'migrations.update': {
    description: "Access to update your project's migrations",
  },
  'migrations.delete': {
    description: "Access to delete your project's migrations",
  },
  'vcs.read': {
    description: "Access to read your project's VCS repositories",
  },
  'vcs.create': {
    description: "Access to create your project's VCS repositories",
  },
  'vcs.update': {
    description: "Access to update your project's VCS repositories",
  },
  'vcs.delete': {
    description: "Access to delete your project's VCS repositories",
  },
  'assistant.read': {
    description: 'Access to read the Assistant service',
  },

  // schema

  'schema.create': {
    description: 'Access to create a schema',
  },
  'schema.update': {
    description: 'Access to update a schema',
  },
  'schema.delete': {
    description: 'Access to delete a schema',
  },
  'schema.read': {
    description: 'Access to read a schema',
  },
  'schema.tables.read': {
    description: 'Access to read a schema tables',
  },
  'schema.tables.create': {
    description: 'Access to create a schema tables',
  },
  'schema.tables.update': {
    description: 'Access to update a schema tables',
  },
  'schema.tables.delete': {
    description: 'Access to delete a schema tables',
  },
  ...consoleScopes,
};
