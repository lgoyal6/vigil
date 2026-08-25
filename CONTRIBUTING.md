# Contributing to Vigil

Thanks for looking. Vigil is a security claim with a demo attached, so the bar on
anything touching the gate, the grant store or service auth is high, and the bar for
everything else is normal.

## The contract you must not break

**The agent holds zero standing production credentials.** Every destructive action has
to earn a single-use, scoped, just-in-time grant, and that one sentence is what the whole
repo exists to defend. Concretely, and each of these is easy to undo by accident:

- `/rollback` and `/restart` are reachable only through Pomerium, and `payments-api`
  re-verifies the grant token with the gate afterwards. Two layers, on purpose. A direct
  call path from the agent to a destructive route defeats the entire project.
- `GrantStore.verifyAndConsume()` consumes a token exactly once, scoped to one action
  plus one service, inside a 60s TTL. Redis does it with an atomic Lua CAS so single-use
  holds across replicas, and `grants.test.ts` has a concurrent-consume test that must
  keep yielding exactly one winner.
- The gate derives `requestedBy` from the authenticated caller and accepts
  `sandboxPassed` only when a worker-signed attestation backs it. **The agent must never
  hold `WORKER_ATTEST_SECRET`**, because the point is that it cannot forge its own
  evidence. The env matrix in `PRODUCTION.md` marks that cell as forbidden, not optional.
- Fail closed in prod, fail convenient in dev, gated on `VIGIL_ENV`. A new code path
  that falls back to a permissive default must sit inside an `isDev` branch.
- `GET /grants` redacts tokens to an unusable prefix. Do not add an endpoint or log
  line that reveals a live one.

## Getting oriented

| Path | What lives there |
|---|---|
| `PRODUCTION.md` | Threat model, env matrix, and an honest known-limitations list. Read it first. |
| `services/gate/src/policy.ts` | The verdict rules: blast radius, sandbox evidence, budget, repeat failure. |
| `services/gate/src/grants.ts` | The `GrantStore` interface plus the in-memory and Redis implementations. |
| `services/shared/auth.ts` | HMAC service-to-service auth and the attestation format. Canonical. |
| `services/vigil-agent/src/orchestrator.ts` | The eight-beat loop the frontend streams over SSE. |
| `services/diagnostic-worker/` | The Akash worker. Signs the sandbox attestation the gate requires. |
| `pomerium/` | The config that makes Pomerium the only route to destructive endpoints. |
| `src/lib/contract.ts` | The wire contract shared by the frontend and the services. `e2e/incident.spec.ts` drives the incident page in SIM mode. |

## Building and testing

Node 20 (see `.nvmrc`).

```bash
npm ci
npm run lint                # eslint, --max-warnings=0
npx tsc --noEmit            # frontend typecheck
npm run test:services       # unit tests for shared, gate, vigil-agent
npm run test:e2e            # Playwright, SIM mode

cp .env.example .env        # unset vars fall back to local mimics
./scripts/dev-all.sh        # payments-api, gate, vigil-agent, and the web app
```

CI runs lint, the frontend typecheck, `tsc --noEmit` for all five services, the
`shared`/`gate`/`vigil-agent` test suites against a real Redis service container, and
`docker compose build`. It does not run Playwright.

## What makes a good PR here

- One concern per PR, with a test that fails before and passes after.
- Anything that changes what the agent can reach needs a sentence in the PR description
  about blast radius, not just a diff.
- Policy changes need a case in `services/gate/src/policy.test.ts`, and grant-lifetime
  changes need one in `grants.test.ts` plus `grants.redis.test.ts`, because the two
  stores have to behave identically.
- `services/diagnostic-worker/src/auth-lite.ts` and `contract-lite.ts` are deliberate
  hand-maintained duplicates: the worker's Docker build context is only its own folder.
  If you change the canonical string or attestation format in `services/shared/auth.ts`,
  change both copies in the same PR. Divergence breaks authentication silently.
- New env vars go in `.env.example`, marked if prod-required, and validated in the
  relevant `env.ts` so a missing secret fails at boot rather than at 3am.

## Good first areas

- **`servicesAffected` and `budgetUsed` are still caller-asserted.** `policy.ts` denies
  the beat-8 escalation on `req.servicesAffected > blastThreshold`, and the agent supplies
  that number. `PRODUCTION.md` names the fix: a gate-side budget ledger and an
  action-to-blast-radius table.
- **Playwright is scaffolded but never runs in CI.** The spec exists and needs no backend,
  so wiring a job into `.github/workflows/ci.yml` is contained work.
- **`services/diagnostic-worker` has no tests** (its `test` script is the npm placeholder
  that exits 1), and it signs the attestation the gate trusts. `payments-api` has no test
  script either; `test:services` covers neither.
- **A drift test for the lite duplicates.** Nothing currently asserts that
  `auth-lite.ts` and `shared/auth.ts` produce the same canonical string, which is exactly
  the failure their own comments warn is silent.
- **Shared-secret auth proves mesh membership, not peer identity.** Per-caller keys or
  mTLS/SPIFFE is the documented upgrade path.

## Conduct

Be decent. Disagree about the threat model, not about the person.
