# Zwakala

Ride-hailing MVP — passenger app prototype, database schema, API design, backend
implementation, and system architecture, built incrementally in one design session.

## Structure

- **`prototype/`** — interactive HTML/JS mockup of the passenger app flow (search → ride select → match → trip → pay → rate). Open `index.html` directly in a browser.
- **`backend/`** — NestJS + Prisma + PostgreSQL API implementing the core loop. See `backend/README.md` for setup.
- **`docs/`**
  - `erd.mermaid` — entity relationship diagram (matches `backend/prisma/schema.prisma`)
  - `openapi.yaml` — REST API spec, importable into Postman/Swagger
  - `api-design-notes.md` — auth flow, WebSocket events, conventions
  - `system-architecture.md` — component breakdown, sequence diagrams, scaling notes
  - `architecture-diagram.mermaid` — system component diagram

## Quick start (backend)

```bash
cd backend
npm install
cp .env.example .env
npx prisma migrate dev
npx prisma db seed
npm run start:dev
```

Docs at `http://localhost:3000/docs` once running.
