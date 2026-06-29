# Server

Express and MongoDB API for Legacy Trophies.

## Structure

- `src/common` — reusable errors, middleware, and utilities
- `src/config` — environment, database, logging, and provider setup
- `src/database` — seed and controlled admin bootstrap scripts
- `src/modules` — feature-owned models, schemas, services, controllers, and routes
- `src/routes` — API route composition
- `scripts` — operational smoke checks
- `tests` — backend tests

## Commands

Copy `.env.example` to `.env`, then run from this folder or through the root workspace:

```bash
npm run dev
npm run seed
npm test
npm run smoke
```

The API defaults to `http://localhost:5000` and all business routes are under `/api/v1`.
