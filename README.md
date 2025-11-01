# FSD_Project3

Lightweight microservices demo (users, posts, comments) used for Full Stack development practice.

## Repository layout

- `gateway/` — API gateway that proxies `/users`, `/posts`, `/comments` to service backends.
  - `src/index.js` — gateway entry; targets are overridable via env vars `USER_SERVICE_URL`, `POST_SERVICE_URL`, `COMMENT_SERVICE_URL`.
- `services/`
  - `user-service/` — Express + Mongoose user service (runs on port 4001 by default).
    - `src/index.js`, `src/routes/userRoutes.js`, `src/models/User.js`
  - `post-service/` — Post service (port 4002). Implements create and list; CRUD expanded for tests.
    - `src/index.js`, `src/routes/postRoutes.js`, `src/models/Post.js`
  - `comment-service/` — Comment service (port 4003).
    - `src/index.js`, `src/routes/commentRoutes.js`, `src/models/Comment.js`
- `docker-compose.yml` — Compose file to run all services + MongoDB containers.

## Current progress / status

- User service: implemented and tested. Basic CRUD routes exist in `services/user-service/src/routes/userRoutes.js`.
- Post service: implemented; `postRoutes.js` was extended to include GET /:id, PUT /:id and DELETE /:id to support full CRUD (these changes are present in the repo).
- Comment service: implemented basic create/list endpoints. Tested through the automated runner.
- Gateway: proxies to the services. Targets can be overridden with environment variables to test locally (useful with mocks).
- Automated test runner: `scripts/test_all_services.mjs` — verified locally. It reported successful HTTP statuses for create/read/update/delete flows across all services.
# FSD_Project3

Microservices-based blogging platform (users, auth, posts, comments) built with Node.js and MongoDB. This repo contains service code, a gateway, Docker compose, and local test helpers.

## Repository layout

- `gateway/` — API gateway that proxies `/users`, `/posts`, `/comments`, and `/auth` to service backends.
  - `src/index.js` — gateway entry; targets are overridable via env vars `USER_SERVICE_URL`, `POST_SERVICE_URL`, `COMMENT_SERVICE_URL`, `AUTH_SERVICE_URL`.
- `services/`
  - `user-service/` — Express + Mongoose user service (port 4001).
  - `auth-service/` — Authentication service (port 4004). Exposes `/auth/register` and `/auth/login` and issues JWTs.
  - `post-service/` — Post service (port 4002). Protected create route (requires JWT) and full CRUD.
  - `comment-service/` — Comment service (port 4003). Protected create route (requires JWT) and listing.
- `docker-compose.yml` — Compose file to run all services + MongoDB containers. Includes `auth-service` and `auth-mongo`.
- `scripts/`
  - `test_local_flow.mjs` — local flow test runner that:
    - starts an in-memory MongoDB (mongodb-memory-server),
    - spawns user/post/comment/auth services with MONGO_URI pointing to the in-memory DB,
    - registers and logs in via `auth-service` to obtain a JWT, then uses the token to exercise protected post/comment creation and basic read/list flows,
    - prints a concise results table and cleans up.
  - `run_gateway_mocks.mjs` — small mock servers for gateway testing (optional).

## Current progress / status

- Services implemented: user, auth, post, comment. Post and comment create endpoints are protected via JWT (middleware present in each service).
- Gateway updated to include `/auth` proxy to `auth-service:4004`.
- `docker-compose.yml` updated to include `auth-service`, `auth-mongo` and `auth-data` volume.
- `scripts/test_local_flow.mjs` added and verified locally (uses in-memory MongoDB and spawns the services).

## Quick start — local flow test (recommended for development)

Prerequisites:
- Node.js (v16+ recommended)

Install runtime deps required by the test runner (run from repo root):

```pwsh
npm install mongodb-memory-server axios jsonwebtoken bcryptjs dotenv
```

Run the local flow test (starts in-memory MongoDB and spawns services):

```pwsh
node .\scripts\test_local_flow.mjs
```

What this does:
- Registers a test user via `POST /auth/register` on the auth service.
- Logs in and obtains a JWT via `POST /auth/login`.
- Uses the JWT to call `POST /posts` and `POST /comments` (protected endpoints).
- Reads back the post and lists comments; prints a summary table of results.

Notes:
- The script runs services by invoking their `src/index.js` directly and sets `MONGO_URI` to the in-memory DB. If you prefer per-service node_modules, run `npm install` inside each service folder.
- The in-memory MongoDB downloads a Mongo binary the first time it runs — expect some download time the first run.

## Running with Docker Compose

To run the full stack with Docker (uses real MongoDB containers defined in `docker-compose.yml`):

```pwsh
docker-compose up --build
```

This will start:
- gateway: mapped to host port 8080
- user-service: 4001
- post-service: 4002
- comment-service: 4003
- auth-service: 4004

There are separate MongoDB containers and named volumes for each service (see `docker-compose.yml` for ports and volume names).

## Gateway proxy (local testing)

The gateway proxies the API paths to their respective services. To run the gateway locally and point it at local services or mocks, set the environment variables and start the gateway. Example (PowerShell):

```pwsh
cd gateway
npm install
# Optionally start mocks or services on localhost:4001-4004
$env:USER_SERVICE_URL = 'http://localhost:4001'
$env:POST_SERVICE_URL = 'http://localhost:4002'
$env:COMMENT_SERVICE_URL = 'http://localhost:4003'
$env:AUTH_SERVICE_URL = 'http://localhost:4004'
node .\src\index.js
```

Then test proxying via the gateway (default port 8080):

```pwsh
curl http://localhost:8080/        # gateway health
curl http://localhost:8080/auth/register -X POST -H 'Content-Type: application/json' -d '{"username":"a","email":"a@e.com","password":"p"}'
curl http://localhost:8080/posts
```

## Env files & Docker Compose validation

Each service referenced in `docker-compose.yml` uses an `env_file` entry. For example the gateway service loads `.env` (this file is present in the repo and contains `PORT=8080` plus optional URL overrides such as `USER_SERVICE_URL`).

To validate the compose file and see the resolved configuration (including loaded env files) run in PowerShell:

```pwsh
docker compose config
```

Then start the stack with:

```pwsh
docker compose up --build
```

If a container exits immediately, inspect its logs with `docker compose logs <service-name>` (for example `docker compose logs user-service`) and confirm the service's `package.json` includes a `start` script and required environment variables are provided by the `.env` file.

## RBAC tests (local)

This project includes a small RBAC test script that exercises role-based access control locally using an in-memory MongoDB. The script registers a regular user and an admin, obtains JWTs, and verifies that protected endpoints enforce roles (for example, only admins can list all posts).

Script: `scripts/test_rbac.mjs`

Prerequisites (run from repo root):

```pwsh
npm install mongodb-memory-server axios --no-audit --no-fund
```

Run the RBAC test locally:

```pwsh
node .\scripts\test_rbac.mjs
```

Expected outcome (summary):
- Regular users are blocked from admin-only endpoints (HTTP 403).
- Admins can access admin-only endpoints.
- Both users and admins can create posts.

If you want these checks run in CI, I can add a simple workflow that runs the RBAC script on pull requests.

## Notes, caveats, and observations

- Services use a shared shape for users and expect `userId` references as string IDs.
- Mongoose may print deprecation warnings about connection options; these are non-blocking.
- The auth middleware requires an Authorization header: `Bearer <token>`; decoded payload is attached as `req.user`.

## Suggested next steps

- Add a root-level npm script (e.g., `test:local-flow`) that runs `node ./scripts/test_local_flow.mjs` for convenience.
- Add CI that runs the local flow script on pull requests and reports results.
- Expand tests with negative cases (invalid token, missing fields) and structured output (JSON/JUnit).

---

If you want, I can add the `test:local-flow` npm script to the root `package.json` and/or add CI integration next.
