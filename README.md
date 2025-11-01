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

## How to run (quick)

Prerequisites:
- Node.js (v16+ recommended)

Install the lightweight runtime deps used by the test runner (from repo root):

```pwsh
npm install mongodb-memory-server axios
```

Run the automated CRUD tests (this will start an in-memory MongoDB and spawn the services):

```pwsh
node .\scripts\test_all_services.mjs
```

Expected: the script prints service logs, runs CRUD calls against each service, and outputs a results table showing HTTP statuses.

Notes on running the gateway locally (proxy testing):
- Install gateway deps and start mocks (if you don't want to run all services):

```pwsh
cd gateway
npm install
cd ..
node .\scripts\run_gateway_mocks.mjs    # optional: starts simple mock user/post/comment servers on ports 4001-4003
SET USER_SERVICE_URL=http://localhost:4001
SET POST_SERVICE_URL=http://localhost:4002
SET COMMENT_SERVICE_URL=http://localhost:4003
node .\gateway\src\index.js
```

Then test proxying via the gateway (default port 8080):

```pwsh
curl http://localhost:8080/        # gateway health
curl http://localhost:8080/users   # proxied to user-service (or mock)
curl http://localhost:8080/posts
curl http://localhost:8080/comments
```

On Windows PowerShell replace `SET` with `$env:USER_SERVICE_URL = 'http://localhost:4001'` if you prefer.

## Notes, caveats, and observations

- The test runner uses `mongodb-memory-server`, which downloads a MongoDB binary on first run — expect some download time.
- Mongoose connection warnings about `useNewUrlParser` / `useUnifiedTopology` may appear; they are harmless warnings from older connection option usage and don't affect behavior.
- The test runner spawns service scripts directly (uses the `src/index.js` files). If you change service entrypoints or ports, update `scripts/test_all_services.mjs` accordingly.

## Suggested next steps

- Add a root-level npm script `test:services` that runs `node ./scripts/test_all_services.mjs` for convenience.
- Add assertions and structured test output (JSON or JUnit) to integrate into CI.
- Add more thorough tests (edge cases, invalid payloads, concurrency, and error paths).
- Optionally split the test runner into smaller steps (start, smoke tests, full tests) and add a small `Makefile` or NPM scripts.

---

If you'd like, I can:
- add the `test:services` npm script to package.json,
- produce CI config that runs the test runner on push,
- or add more assertions and detailed reporting to `test_all_services.mjs`.

Tell me which of those you prefer next.
# FSD_Project3
Microservices-based blogging platform with Node.js, MongoDB, Docker, and React