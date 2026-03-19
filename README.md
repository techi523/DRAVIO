# DRAVIO // Global Data Marketplace

DRAVIO is a decentralized marketplace for high-speed internet data. This monorepo contains the entire platform ecosystem, from edge relays to administrative control rooms.

## 🛠️ Quickstart

To spin up the entire development environment (PostgreSQL, Redis, Kafka, and core services):

```bash
docker-compose up --build
```

- **Buyer Portal:** [http://localhost:3000](http://localhost:3000)
- **Admin Portal:** [http://localhost:3001](http://localhost:3001)
- **API Documentation:** [http://localhost:8080/docs](http://localhost:8080/docs) (ISP Gateway)

## 📁 Repository Structure

- `apps/`: Frontend applications (Next.js).
- `services/`: Backend microservices (Go, Node, Python).
- `infra/`: Infrastructure as Code (Terraform, Helm, K8s).
- `packages/`: Shared libraries and TypeScript configs.
- `.github/`: CI/CD pipelines.

## 🧠 Brain (Design Philosophy)

Documentation and architectural implementation plans can be found in the `.gemini/antigravity/brain/` directory:

- [Walkthrough](brain/c596e6ba-da8c-4ef9-9fd1-421d7a689a2d/walkthrough.md)
- [System Overview](brain/c596e6ba-da8c-4ef9-9fd1-421d7a689a2d/01_system_overview.md)
- [Monorepo Strategy](brain/c596e6ba-da8c-4ef9-9fd1-421d7a689a2d/02_application_layer.md)

---
© 2026 DRAVIO. All rights reserved. Secure. Scalable. Decentralized.
