# Ticket Booking System

Ticket booking application for movies and concerts, with authentication, seat
holds, booking history, cancellations, waitlists, live seat maps and QR tickets.

This repository is the starting point for the Durable Functions assessment in
[CANDIDATE.md](CANDIDATE.md). The Express application and local infrastructure
are available. The Functions Checkout API, shared checkout domain, durable
orchestration, `DESIGN.md` and `RUNBOOK.md` are still pending. Starting the DTS
emulator does not start a Functions application.

## Assessment scope

The assessment requires moving checkout into Azure Durable Functions using
TypeScript, the Node.js programming model v4, `durable-functions` 3.5.0 or later,
and Durable Task Scheduler. PostgreSQL remains the system of record and payments
must use the simulator's HTTP API.

Seat transitions, pricing, hold validation and booking creation must be shared
between the legacy API and Functions. The existing features must keep working.
The implementation must cover concurrency, idempotency, bounded retries,
compensation, hold expiry, cancellation and checkout correlation IDs.

The five equally weighted areas are refactoring, testing and observability,
Durable Functions and DTS, compensation, and transaction locks and retries.
Required deliverables include incremental Git history, `DESIGN.md`, tests,
`RUNBOOK.md` and a walkthrough of five minutes or less. Submit a private
repository. [CANDIDATE.md](CANDIDATE.md) contains the complete contract and rules.

## Packages

| Path | Responsibility |
|---|---|
| `packages/api` | Express API, Prisma schema, migrations, seed and integration tests |
| `packages/web` | React 18 application with Vite 6, Tailwind and TanStack Query |
| `packages/shared` | TypeScript contracts, enums and Zod schemas |
| `packages/payment-sim` | Local HTTP payment simulator and its tests |
| `packages/acceptance` | Public acceptance tests for the required Checkout API |
| `scripts` | Environment setup, diagnostics and an optional pre-commit guard |

The API uses Express 4, Prisma 5 and Socket.io 4. Local infrastructure uses
PostgreSQL 17, Mailpit, Azurite and the DTS emulator. The current implementation
is described in [SYSTEM_DESIGN.md](SYSTEM_DESIGN.md).

## Prerequisites

- Node.js 22 or 24 and npm 10 or later. `.nvmrc` selects Node.js 22.
- Docker with Compose and its engine running.
- Azure Functions Core Tools v4 (`func --version`).

No Azure subscription or hosted database is needed for local development.

## First run

Run from the repository root:

```bash
npm run setup:local
```

This command checks prerequisites, creates missing `packages/api/.env` and
`packages/web/.env` files from their examples, installs the locked dependencies,
starts the five Compose services, generates Prisma Client and applies existing
migrations. Existing environment files are preserved. The setup accepts only
the local `ticketing` database on port 5433 with schema `public`.

For a new, disposable local database, load the demonstration data once:

```bash
npm run db:seed
```

**The seed deletes existing application data before inserting demo records.**
Do not use it on a database whose contents you need to retain.

Start the API and web application:

```bash
npm run dev
```

Keep that terminal open. Use another terminal for tests and Git commands.

## Subsequent runs

Start Docker, then run:

```bash
npm run infra:up
npm run dev
```

Seeding is not required on each startup. Use `npm run infra:down` to stop
the containers. `npm run infra:reset` also removes the PostgreSQL and Azurite
volumes and therefore deletes their local data.

## Local services

| Service | Address or host port |
|---|---|
| Web application | <http://localhost:5173> |
| API health | <http://localhost:4000/api/health> |
| PostgreSQL | `localhost:5433`, database `ticketing` |
| Payment simulator health | <http://localhost:4100/health> |
| Mailpit inbox | <http://localhost:8025> |
| Mailpit SMTP | `localhost:1025` |
| DTS dashboard | <http://localhost:8082> |
| DTS gRPC | `localhost:8080` |
| Azurite blob, queue and table | `10000`, `10001`, `10002` |

`http://localhost:4000/` returns `Route not found` because the API has no root
page. Use `/api/health` to check the API and port 5173 for the application.

The DTS emulator and payment simulator store their state in memory. Restarting
either clears its state; restarting the Express process does not restart them.

## Demo accounts

All seeded accounts use password `password123`.

| Role | Email |
|---|---|
| Admin | `admin@ticket.dev` |
| Organiser | `organiser@ticket.dev` |
| Customer | `alice@ticket.dev` |
| Customer | `bob@ticket.dev` |
| Customer | `carol@ticket.dev` |

Alice starts with a Premium booking for Interstellar. Bob and Carol are waiting
for that category. Cancel Alice's booking to exercise the existing waitlist
flow, then inspect the offer email in Mailpit. Tests create additional fixtures
in the local database, so test events can also appear in the application.

## Configuration

The API reads `packages/api/.env`; Vite reads `packages/web/.env`. The root
[.env.example](.env.example) is a combined reference, not the API's config file.
Only example files belong in version control. The supplied credentials and
passwords are for local demonstration.

| Variable | Local setting or purpose |
|---|---|
| `DATABASE_URL` | `postgresql://ticket:ticket@localhost:5433/ticketing?schema=public` |
| `PORT` | `4000` |
| `JWT_SECRET` | Shared secret for authentication and ticket signatures |
| `CORS_ORIGIN` | `http://localhost:5173` |
| `APP_BASE_URL` | `http://localhost:5173`, used in email links |
| `HOLD_TTL_SECONDS` | `600` |
| `WAITLIST_OFFER_TTL_SECONDS` | `600` |
| `SWEEP_INTERVAL_SECONDS` | `15` |
| `PAYMENT_API_URL` | `http://localhost:4100` |
| `PAYMENT_TIMEOUT_MS` | `10000` |
| `SMTP_URL` | `smtp://localhost:1025` |
| `RESEND_API_KEY` | Leave empty to use local SMTP |
| `MAIL_FROM` | Sender address for ticket and waitlist emails |
| `VITE_API_URL` | `http://localhost:4000` |
| `VITE_SOCKET_URL` | `http://localhost:4000` |

Use the committed lockfile with `npm ci`. Dependency upgrades are separate from
environment setup.

## Tests and checks

| Level | Command | Dependencies |
|---|---|---|
| API integration | `npm test` | PostgreSQL, applied migrations and payment simulator |
| Payment simulator unit | `npm run test:sim` | Installed dependencies; starts its own test server |
| Checkout acceptance | `npm run test:acceptance` | Express, Functions, PostgreSQL, simulator and Mailpit |
| API type checking | `npm run lint` | Installed dependencies and generated Prisma Client |
| Web type checking | `npm run typecheck -w @ticket/web` | Installed dependencies |
| API and web builds | `npm run build` | Installed dependencies and Prisma generation |

The existing API suite has nine tests covering competing holds, hold expiry
and waitlist behaviour. The simulator suite has seven tests covering payment
responses, idempotency, refunds, request logs and fault injection. These tests
do not establish all the restart and payment guarantees required by the
assessment.

The four public checkout acceptance scenarios cover payment confirmation,
unpaid expiry, decline and cancellation. They expect the Functions API at
`http://localhost:7071/api`, the same `JWT_SECRET` as Express, and
`HOLD_TTL_SECONDS=10` in the Functions process. They cannot pass until the
Functions Checkout API is implemented and running.

## Current API

Routes use the `/api` prefix. Authenticate with `POST /api/auth/login`; protected
routes accept `Authorization: Bearer <JWT>`.

| Area | Routes |
|---|---|
| Authentication | `/api/auth` |
| Venues and layouts | `/api/venues` |
| Events and shows | `/api/events`, `/api/shows` |
| Seat holds | `POST /api/shows/:id/holds`, `DELETE /api/holds/:id` |
| Bookings and cancellation | `/api/bookings` |
| Waitlists and offers | `/api/shows/:id/waitlist`, `/api/waitlist` |
| Ticket verification and QR | `/api/tickets` |

The existing booking endpoint takes `{ holdId, paymentToken }`. Payment tokens,
failure behaviours and simulator endpoints are documented in
[packages/payment-sim/README.md](packages/payment-sim/README.md).

## Troubleshooting

```bash
npm run doctor
docker compose ps
```

If existing containers are stopped, run `npm run infra:up` before retrying the
setup. For a missing `func`, finish installing and linking Core Tools v4, then
check `func --version`. If a port is occupied, inspect the reported process or
container before changing configuration.

The migration at `packages/api/prisma/migrations/0_init/migration.sql` is the
initial schema. Keep applied migrations unchanged; add a new migration for
future schema changes.

## Repository contents

Keep application source, tests, migrations, example environment files, package
manifests, the lockfile and project documentation in Git. Local settings,
credentials, dependencies, build output, caches, downloaded patches and editor
configuration are excluded by `.gitignore`.

The optional secret guard can be installed after cloning:

```bash
cp scripts/git-hooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

It checks staged environment files and common secret patterns; it is not a
complete credential audit. Review staged changes before committing.

[NOTICE.md](NOTICE.md) records the supplied project's origin and licence.
