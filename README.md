<div align="center">

<img src="https://raw.githubusercontent.com/nuvix-dev/console/main/apps/www/public/images/dashboard/hero_dark.png" width="100%" alt="Nuvix" />

# Nuvix

### The open-source backend for secure, AI-ready applications.

Auth. Database. Storage. Messaging. One platform. Self-host anywhere.

[![License: FSL-1.1-Apache-2.0](https://img.shields.io/badge/license-FSL--1.1--Apache--2.0-blue)](LICENSE)
[![Discord](https://img.shields.io/discord/1417928996003250320?label=discord&logo=discord&logoColor=white)](https://discord.gg/rHKCXu7cYW)
[![GitHub Issues](https://img.shields.io/github/issues/nuvix-dev/nuvix)](https://github.com/nuvix-dev/nuvix/issues)

[Documentation](https://nuvix-docs.vercel.app) · [Discord](https://discord.gg/rHKCXu7cYW) · [Report Bug](https://github.com/nuvix-dev/nuvix/issues) · [Request Feature](https://github.com/nuvix-dev/nuvix/issues)

</div>

---

## What is Nuvix?

Most apps need the same backend building blocks: auth, a database, file storage, and messaging. The usual answer is 4 different vendors, 4 dashboards, and 4 billing pages before you write a single line of product code.

Nuvix replaces all of that. One backend, one API, one permission model. Fully self-hostable, security-first by design, and built to support AI-powered products from day one.

---

## Features

### Authentication
Multi-tenant auth with user accounts, sessions, teams, and role-based access. Security is not a config option; it's the default.

### Database
PostgreSQL under the hood. Three schema modes so you pick the right fit for each use case:

| Schema | Best For | What You Get |
| --- | --- | --- |
| **Document** | Prototyping, MVPs | NoSQL-style flexibility, no SQL needed |
| **Managed** | Production apps | Auto-generated CRUD + Row-Level Security policies |
| **Unmanaged** | Custom logic | Raw SQL, full control, no guardrails |

Mix and match across the same project. All three share one unified API.

### Storage
Permission-aware file system with S3-compatible drivers or local storage. The same permission rules that govern your database govern your files.

### Messaging
Email, SMS, and push notifications through a single API. No need to wire up SendGrid, Twilio, and Firebase separately.

### AI-Ready
Nuvix gives AI products what they actually need: secure data layers, granular permissions, session management, and file handling for ML pipelines. Store embeddings, manage context, enforce access rules on every request.

---

## Quick Start

```bash
git clone https://github.com/nuvix-dev/docker.git nuvix
cd nuvix
cp .env.example .env
docker compose up -d
```

Open `http://localhost:3000` and create your first project.

**Requirements:** [Docker](https://docs.docker.com/get-docker/) + [Bun](https://bun.sh) >= 1.3.7

For full self-hosting instructions, see the [Self-Hosting Guide](https://docs.nuvix.in/self-hosting).

### Local Development

```bash
bun install
bun run dev     # Start dev server
bun run test    # Run tests
bun run lint    # Lint with Biome
```

---

## Architecture

```
nuvix/
├── apps/
│   ├── server          # Core API server
│   └── platform        # Platform services
├── libs/
│   ├── core            # Shared core logic
│   ├── pg-meta         # PostgreSQL metadata layer
│   └── utils           # Common utilities
├── configs/            # Default configurations
├── docs/               # Documentation source
└── scripts/            # Build & deployment scripts
```

---

## Security Model

Every request in Nuvix passes through the same permission pipeline, regardless of whether it touches the database, storage, or messaging.

- **Managed schemas** auto-generate Row-Level Security policies. You don't write them by hand.
- **Project isolation** keeps tenant data separated at the database level.
- **Self-hosted** means your data never leaves your infrastructure.

You don't enable security in Nuvix. It's already on.

---

## Roadmap

- [ ] Realtime subscriptions
- [ ] Edge functions
- [ ] TypeScript SDK (stable)
- [ ] Python SDK
- [ ] Vector / embeddings support
- [ ] Multi-region self-hosting guide

Have a feature in mind? [Open an issue](https://github.com/nuvix-dev/nuvix/issues) or bring it up in [Discord](https://discord.gg/2fWv2T6RzK).

---

## Contributing

Contributions of all kinds are welcome: code, docs, bug reports, ideas.

1. Read the [Contributing Guide](CONTRIBUTING.md)
2. Browse [open issues](https://github.com/nuvix-dev/nuvix/issues)
3. Join the [Discord](https://discord.gg/2fWv2T6RzK)

> By submitting a pull request, you agree that Nuvix may use, modify, copy, and redistribute the contribution under terms of its choosing.

---

## Bugs and Security

**Found a bug?** Open an issue on [GitHub](https://github.com/nuvix-dev/nuvix/issues) with steps to reproduce.

**Found a vulnerability?** Please do not open a public issue. Email [security@nuvix.in](mailto:security@nuvix.in) instead. We will work with you to patch it before any public disclosure.

---

## Resources

| | |
| --- | --- |
| 📖 [Documentation](https://nuvix-docs.vercel.app) | Guides, API reference, tutorials |
| 🖥️ [Console](https://github.com/nuvix-dev/console) | Admin dashboard (separate repo) |
| 💬 [Discord](https://discord.gg/rHKCXu7cYW) | Community, help, discussion |
| 📢 [X / Twitter](https://x.com/_nuvix) | Updates and announcements |

---

## License

[FSL-1.1-Apache-2.0](LICENSE)

---

<div align="center">

[![Star History Chart](https://api.star-history.com/svg?repos=nuvix-dev/nuvix&type=Date)](https://star-history.com/#nuvix-dev/nuvix&Date)

**If Nuvix saves you time, drop a star. It helps more than you think.** ⭐

</div>
