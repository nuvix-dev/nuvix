# Nuvix

<div align="center">

**Modern backend infrastructure for ambitious developers.**

[![Discord](https://img.shields.io/badge/Discord-Join-5865F2?logo=discord&logoColor=white)](https://discord.gg/2fWv2T6RzK)
[![X (Twitter)](https://img.shields.io/badge/Follow%20on%20X-000000?logo=x)](https://twitter.com/nuvix_tech)
[![License](https://img.shields.io/badge/License-BSD%203--Clause-blue.svg)](LICENSE)

</div>

<p align="center">
  <img src="https://github.com/Nuvix-Tech/console/raw/main/apps/www/public/images/dashboard/hero_dark.png" width="100%" alt="Nuvix Dashboard" />
</p>

---

## What is Nuvix?

Nuvix is a backend platform that helps you build secure and scalable applications. It combines authentication, a multi-schema database, file storage, and messaging into a single system you can self-host anywhere.

Whether you're building for web, mobile, or server environments, Nuvix provides a solid backend foundation without unnecessary complexity.

---

## Key Features

### Authentication

Built-in user accounts, sessions, and team management. Designed for secure, multi-tenant applications.

### Database

A flexible, permission-driven data layer powered by PostgreSQL, featuring the Nuvix three-schema system:

#### Document Schemas

A NoSQL-style model for fast iteration. Define attributes and indexes without writing SQL.

#### Managed Schemas

Structured PostgreSQL tables enhanced with Nuvix automation:

* Auto-generated CRUD policies
* Automatic Row-Level Security
* Built-in permission tables
* Secure by default

#### Unmanaged Schemas

Full SQL freedom. Bring your own tables, views, and logic with no restrictions.

All schema types share a consistent API and follow the same permission rules.

### Storage

A simple, permission-aware file system with support for S3-compatible drivers or local storage.

### Messaging

A unified interface for outbound communication:

* Email
* SMS
* Push notifications

Templates and integrations included.

---

## Why Nuvix?

### Developer-first

TypeScript everywhere. Clean APIs. Predictable behavior. Minimal setup.

### Secure by Default

Permission checks apply across database, storage, messaging, and project boundaries.

Managed schemas include automatic RLS and policy generation—no SQL required.

### Self-Host Anywhere

Deploy using simple containers on any cloud, server, or local environment.

### Flexible by Design

Mix and match schema types depending on your project needs:

* Prototype quickly with Document Schemas
* Scale confidently with Managed Schemas
* Take full control with Unmanaged Schemas

---

## Quick Start

Get Nuvix running locally with Docker and manage everything through the admin console.

### Prerequisites
- Docker & Docker Compose
- Bun (for development)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Nuvix-Tech/nuvix.git
   cd nuvix
   ```

2. **Start with Docker Compose:**
   ```bash
   cp .env.example .env
   # Edit .env to configure your setup (e.g., admin credentials, database settings)
   docker compose up -d
   ```

3. **Access the Console:**
   - Open [http://localhost:3000](http://localhost:3000) in your browser
   - Set up your first project and start building!

For detailed setup instructions, see our [documentation](https://docs.nuvix.in).

---

## Resources

- **[Repository](https://github.com/Nuvix-Tech/nuvix)** - Source code and issues
- **[Console](https://github.com/Nuvix-Tech/console)** - Admin dashboard and management interface
- **[Documentation](https://docs.nuvix.in)** - Comprehensive guides and API reference *(coming soon)*
- **[Discord Community](https://discord.gg/2fWv2T6RzK)** - Get help and share ideas
- **[X (Twitter)](https://twitter.com/nuvix_tech)** - Follow for updates

---

## Contributing

We welcome contributions of all kinds: features, bug fixes, docs, and feedback.

- Check out our [Contributing Guide](CONTRIBUTING.md)
- Join the [Discord](https://discord.gg/2fWv2T6RzK) for discussions
- Report issues on [GitHub](https://github.com/Nuvix-Tech/nuvix/issues)
- By submitting pull requests, you confirm that Nuvix can use, modify, copy, and redistribute the contribution, under the terms of its choice.
---

<div align="center">

**Built with ❤️ by the Nuvix team**

</div>
