#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "--help" ]]; then
  cat <<'HELP'
Usage: npm run setup:local

Checks local prerequisites, creates missing API/web .env files, installs the
locked dependencies, starts Docker Compose, generates Prisma Client and applies
committed migrations to the local ticketing database on port 5433.

Existing .env files are preserved. Demo data is NOT seeded automatically because
the existing seed script deletes data. See README.md for the first run.
HELP
  exit 0
fi
if [[ "$#" -ne 0 ]]; then
  printf '%s\n' 'Unexpected argument. Use --help for usage.' >&2
  exit 1
fi

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_dir"

for tool in node npm docker func; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    printf 'Missing prerequisite: %s. See README.md.\n' "$tool" >&2
    exit 1
  fi
done

node -e 'const major = Number(process.versions.node.split(".")[0]); if (major !== 22 && major !== 24) { console.error("Use Node.js 22 or 24."); process.exit(1); }'
npm_version="$(npm --version)"
if [[ "${npm_version%%.*}" -lt 10 ]]; then
  printf '%s\n' 'Use npm 10 or later.' >&2
  exit 1
fi
func_version="$(func --version)"
if [[ "$func_version" != 4.* ]]; then
  printf '%s\n' 'Use Azure Functions Core Tools v4.' >&2
  exit 1
fi
docker compose version >/dev/null
if ! docker info >/dev/null 2>&1; then
  printf '%s\n' 'Docker is not ready. Open Docker Desktop and wait for the engine.' >&2
  exit 1
fi

npm run doctor

for package in api web; do
  env_path="packages/$package/.env"
  if [[ ! -e "$env_path" && ! -L "$env_path" ]]; then
    (umask 077; cp "packages/$package/.env.example" "$env_path")
    printf 'Created %s from the local example.\n' "$env_path"
  else
    printf 'Preserved existing %s.\n' "$env_path"
  fi
done

node --input-type=module <<'NODE'
const inherited = process.env.DATABASE_URL;
delete process.env.DATABASE_URL;
process.loadEnvFile('packages/api/.env');
const urls = [process.env.DATABASE_URL];
if (inherited !== undefined) urls.push(inherited);
for (const value of urls) {
  let valid = false;
  try {
    const url = new URL(value);
    valid = ['postgres:', 'postgresql:'].includes(url.protocol)
      && ['localhost', '127.0.0.1'].includes(url.hostname)
      && url.port === '5433'
      && url.pathname === '/ticketing'
      && (url.searchParams.get('schema') ?? 'public') === 'public';
  } catch {}
  if (!valid) {
    console.error('Setup requires DATABASE_URL for local ticketing on localhost:5433, schema public.');
    console.error('Check packages/api/.env and any exported DATABASE_URL; no migrations were run.');
    process.exit(1);
  }
}
NODE

npm ci --registry=https://registry.npmjs.org
npm run infra:up
npm run doctor
npm run db:generate
npm run db:deploy

cat <<'DONE'

Local infrastructure and schema are ready.

For a NEW disposable local database only: npm run db:seed
The seed replaces existing data; do not run it on a database you need to keep.

Then run:
  npm test
  npm run test:sim
  npm run dev

Web:          http://localhost:5173
API health:   http://localhost:4000/api/health
Local emails: http://localhost:8025
DTS dashboard:http://localhost:8082

The Functions Checkout API is not implemented yet.
Acceptance tests require that API running on port 7071.
DONE
