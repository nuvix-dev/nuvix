# Nuvix

Modern backend infrastructure for TypeScript. Fast, modular, and scalable — powered by PostgreSQL, Bun, and Redis.

<p align="center">
  <img src="https://github.com/Nuvix-Tech/console/raw/main/apps/www/public/images/dashboard/hero_dark.png" alt="Nuvix project banner" width="100%" />
</p>

<p align="center">
  <a href="https://github.com/Nuvix-Tech/nuvix/releases"><img src="https://img.shields.io/github/v/release/Nuvix-Tech/nuvix?color=0A84FF" alt="Latest release" /></a>
  <a href="https://github.com/Nuvix-Tech/nuvix/actions"><img src="https://github.com/Nuvix-Tech/nuvix/actions/workflows/ci.yml/badge.svg" alt="CI status" /></a>
  <a href="https://discord.gg/2fWv2T6RzK"><img src="https://img.shields.io/badge/Discord-Join-5865F2?logo=discord&logoColor=white" alt="Join Discord" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-BSL%201.1-2EA44F" alt="License: BSL 1.1" /></a>
</p>

---

> [!WARNING]
> ## Project Status: Pre-Production
> Nuvix is feature-complete and entering pre-production testing. It is not yet recommended for production use. The current focus is on improving test coverage, stability, and documentation ahead of the first stable release.

---

## Contents

- [Overview](#overview)
- [Core features](#core-features)
- [Ecosystem](#ecosystem)
- [Quick start](#quick-start)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)
- [Acknowledgements](#acknowledgements)
- [Community](#community)
- [Vision](#vision)

---

## Overview

Nuvix is a high-performance backend platform that combines the simplicity of BaaS with the flexibility of a custom backend. It offers a modular architecture with first-class TypeScript support and a PostgreSQL-first data model.

Highlights:
- Built-in authentication, storage, messaging, and schema management
- Extensible, modular components
- Fine-grained access control using PostgreSQL Row-Level Security (RLS)
- Optional companion console for visual administration

---

## Core features

<details>
<summary><strong>Flexible schema system</strong></summary>

Nuvix supports multiple data models to match your needs:

| Schema type        | Description                                                                               | Typical use case          |
|--------------------|-------------------------------------------------------------------------------------------|---------------------------|
| Document           | NoSQL-like structure with relationship-based querying                                     | Rapid prototyping         |
| Managed            | Auto-provisioned permissions tables with PostgreSQL RLS for granular access control       | Secure, multi-tenant apps |
| Unmanaged          | Direct PostgreSQL access for advanced use cases                                           | Full database control     |
</details>

<details>
<summary><strong>Authentication and authorization</strong></summary>

- User and session management
- JWT-based authentication
- Role/permission-based access control
- Automatic RLS enforcement on managed schemas
</details>

<details>
<summary><strong>Unified messaging</strong></summary>

- Email, SMS, and push notifications through a single interface
- Template-driven messages
- Redis-backed queues for reliability
</details>

<details>
<summary><strong>File storage</strong></summary>

- S3-compatible or local adapters
- Chunked uploads
- Built-in file permissions
</details>

<details>
<summary><strong>Developer experience</strong></summary>

- Ultra-fast Bun runtime
- Modular TypeScript + NestJS architecture
- Integrated Redis for caching, queues, and events
- Designed for simplicity, scalability, and performance
</details>

---

## Ecosystem

### Nuvix Console
A companion dashboard to manage users, schemas, messages, and configuration.

Repository: [github.com/Nuvix-Tech/console](https://github.com/Nuvix-Tech/console)

### Documentation
Comprehensive docs and API references are in progress.

Docs (coming soon): [docs.nuvix.in](https://docs.nuvix.in)

---

## Quick start

<details>
<summary><strong>Prerequisites</strong></summary>

- Git
- Docker and Docker Compose
</details>

<details open>
<summary><strong>Setup with Docker</strong></summary>

1.  Clone the repository:
    ```bash
    git clone https://github.com/Nuvix-Tech/nuvix.git
    cd nuvix
    ```

2.  Create environment files from the examples:
    ```bash
    cp .env.example .env
    cp .env.platform.example .env.platform
    cp .env.server.example .env.server
    ```
    > **Note:** You can customize variables in these `.env` files as needed.

3.  Start the stack:
    ```bash
    docker compose up -d
    ```
    This launches:
    - PostgreSQL
    - Redis
    - Nuvix Server

4.  Access the server:
    - API: [http://localhost:4000](http://localhost:4000)
</details>

---

## Roadmap

| Milestone                      | Status          |
|--------------------------------|-----------------|
| Authentication & Authorization | Complete        |
| Flexible Schema System         | Complete        |
| Messaging (Email, SMS, Push)   | Complete        |
| Storage System                 | Complete        |
| Admin Dashboard                | Console ready   |
| Test Suite & Coverage          | In progress     |
| Documentation                  | In progress     |
| First Production Release       | Pending tests   |

---

## Contributing

Contributions are welcome. Please read the contributing guide before opening pull requests or issues.

- Contributing guide: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Good first issues: [github.com/Nuvix-Tech/nuvix/issues](https://github.com/Nuvix-Tech/nuvix/issues)

---

## Security

If you discover a security issue, please report it responsibly using private channels. Do not open public issues for security reports.

---

## License

This project is licensed under the Business Source License 1.1 (BSL). See [LICENSE](./LICENSE) for terms and conversion conditions.

---

## Acknowledgements

Inspired by:
- Supabase
- Appwrite
- Firebase

Nuvix builds on these ecosystems while introducing multi-schema flexibility, automatic RLS, and Bun-native performance.

---

## Community

<p align="center">
  <a href="https://discord.gg/2fWv2T6RzK"><img src="https://img.shields.io/badge/Join%20our%20Discord-5865F2?logo=discord&logoColor=white" alt="Join our Discord" /></a>
  <a href="https://twitter.com/nuvix_tech"><img src="https://img.shields.io/badge/Follow%20on%20X-000000?logo=x" alt="Follow on X" /></a>
  <a href="https://docs.nuvix.in"><img src="https://img.shields.io/badge/Docs-Coming%20Soon-1E90FF?logo=readthedocs" alt="Docs coming soon" /></a>
</p>

---

## Vision

Nuvix unifies backend development by combining the power of PostgreSQL with modern tooling. The goal is a single, developer-first platform that scales from prototype to production with minimal friction.
