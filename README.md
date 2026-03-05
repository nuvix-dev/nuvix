<div align="center">

<img src="https://raw.githubusercontent.com/nuvix-dev/console/main/apps/www/public/images/dashboard/hero_dark.png" width="100%" alt="Nuvix" />

# Nuvix

### The open-source backend for secure, AI-ready applications.

Auth. Database. Storage. Messaging. One platform. Self-host anywhere.

[Documentation](https://nuvix-docs.vercel.app) · [Discord](https://discord.gg/2fWv2T6RzK) · [Report Bug](https://github.com/nuvix-dev/nuvix/issues) · [Request Feature](https://github.com/nuvix-dev/nuvix/issues)

</div>

---

## Why Nuvix?

Building a modern app means stitching together auth providers, databases, file storage, and messaging services. That's 4+ vendors, 4+ dashboards, and 4+ billing pages before you write a single line of product code.

**Nuvix replaces all of that.** One backend. One API. One permission model. Fully self-hostable.

Whether you're building an **AI-powered SaaS**, a **mobile app**, or an **internal tool**, Nuvix gives you the secure infrastructure to ship fast and scale without limits.

---

## ✨ Features

### 🔐 Authentication & Security

Multi-tenant auth with user accounts, sessions, teams, and role-based access. Security is not an afterthought; it's built into every layer. Managed schemas auto-generate Row-Level Security policies so your data is locked down from day one.

### 🗄️ Three-Schema Database

PostgreSQL-powered. Pick the right model for each use case:

| Schema | Best For | What You Get |
| --- | --- | --- |
| **Document** | Rapid prototyping, MVPs | NoSQL-style flexibility, zero SQL needed |
| **Managed** | Production apps at scale | Auto-generated CRUD policies, RLS, permission tables |
| **Unmanaged** | Full control, custom logic | Raw SQL, your tables, your views, no restrictions |

Mix and match across a single project. All schemas share one unified API.

### 🤖 AI-Ready Infrastructure

Build AI applications with confidence. Nuvix provides the secure data layer, auth, and storage that AI-powered products need. Store embeddings, manage user sessions, handle file uploads for ML pipelines, and enforce granular permissions on every request.

### 📦 Storage

Permission-aware file system with S3-compatible drivers or local storage. Upload, serve, and manage files with the same permission rules as your database.

### 📬 Messaging

Email, SMS, and push notifications through a single API. Built-in templates and provider integrations so you're not wiring up SendGrid, Twilio, and Firebase separately.

---

## 🚀 Quick Start

Get running in under 2 minutes:

```bash
git clone https://github.com/nuvix-dev/docker.git nuvix
cd nuvix
cp .env.example .env    # Configure your secrets
docker compose up -d

```

Open **[http://localhost:3000](http://localhost:3000)** and create your first project.

That's it. No complex setup. No 47-step guide.

### Development

```bash
bun install        # Install dependencies
bun run dev        # Start dev server
bun run test       # Run tests
bun run lint       # Lint with Biome

```

**Requirements:** [Docker](https://docs.docker.com/get-docker/) + [Bun](https://bun.sh) ≥ 1.3.7

For detailed self-hosting instructions, see the **[Self-Hosting Guide](https://docs.nuvix.in/self-hosting)**.

---

## 🏗️ Architecture

```text
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

## 🛡️ Security First

Nuvix is designed with a **zero-trust permission model**:

* **Every request** passes through permission checks across database, storage, and messaging.
* **Managed schemas** auto-generate Row-Level Security policies, so you don't need to write them by hand.
* **Project isolation** keeps tenant data separated at the database level.
* **Self-hosted** means your data never leaves your infrastructure.

You don't "enable" security in Nuvix. It's the default.

---

## 🐞 Bugs & Vulnerabilities

Building a secure, robust platform is a community effort. We actively welcome feedback and reports.

* **Found a bug?** Please open an issue on our [GitHub Issues](https://github.com/nuvix-dev/nuvix/issues) page with steps to reproduce.
* **Found a security vulnerability?** Please **do not** open a public issue. Instead, email us directly at [security@nuvix.in](mailto:security@nuvix.in). We take security reports seriously and will work with you to patch the exploit immediately before public disclosure.

---

## 🔗 Resources

|  |  |
| --- | --- |
| 📖 **[Documentation](https://nuvix-docs.vercel.app)** | Guides, API reference, and tutorials |
| 🖥️ **[Console](https://github.com/nuvix-dev/console)** | Admin dashboard (separate repo) |
| 💬 **[Discord](https://discord.gg/2fWv2T6RzK)** | Community, help, and discussion |
| 📢 **[X / Twitter](https://x.com/_nuvix)** | Updates and announcements |
| 🐛 **[Issues](https://github.com/nuvix-dev/nuvix/issues)** | Bug reports and feature requests |

---

## 🤝 Contributing

We welcome contributions of all kinds: code, docs, bug reports, and ideas.

1. Read the [Contributing Guide](CONTRIBUTING.md)
2. Browse [open issues](https://github.com/nuvix-dev/nuvix/issues)
3. Join the [Discord](https://discord.gg/2fWv2T6RzK)

> By submitting a pull request, you agree that Nuvix may use, modify, copy, and redistribute the contribution under terms of its choosing.

## License

[FSL-1.1-Apache-2.0](LICENSE)

---

<div align="center">

[![Star History Chart](https://api.star-history.com/svg?repos=nuvix-dev/nuvix&type=Date)](https://star-history.com/#nuvix-dev/nuvix&Date)

**If Nuvix saves you time, drop a star. It helps more than you think.** ⭐

</div>
