# Grievance E2E suite

End-to-end coverage for the two merged upstream grievance PRs:

- **BE PR #35** (`openimis-be-grievance_social_protection_py`) — fine-grained permission
  control, category resolution times, hierarchical categories.
- **FE PR #25** (`openimis-fe-grievance_social_protection_js`) — hierarchical category
  selection via `rc-cascader` in `CategoryPicker`.

Grievance categories and their dynamic rights (127100–127999) are generated once at
`apps.ready()`, so the permissioned config must be in the DB **before `backend` boots**.
`compose.test.yml` adds a `grievance-seed` service that upserts the `core.ModuleConfiguration`
rows (grievance + the maker-checker-disabling individual/social_protection configs) from
`cypress/fixtures/` after `migrations` and before `backend`.

## Prerequisites

- Both PRs merged 2026-04-08, so use image tags that include them (the `25.10` release
  predates them). In `.env`: `BE_TAG=develop`, `FE_TAG=develop`, `DB_TAG=develop`,
  `DEMO_DATASET=true`, and a free `HTTP_PORT` (examples use `8088`).
- `npm install` in this directory.

## Run

```bash
cd openimis-dist_dkr

# Seed config before backend boots, then bring the stack up.
docker compose -f compose.yml -f compose.test.yml up -d

# If backend was already running WITHOUT the override (apps.ready() ran before the seed),
# force it to re-read: docker compose -f compose.yml -f compose.test.yml up -d --force-recreate backend

CYPRESS_BASE_URL=http://localhost:8088 npx cypress run --spec "cypress/e2e/grievance*.cy.js"
```

## Specs

| Spec | Covers |
|---|---|
| `grievance-categories.cy.js` | rc-cascader picker: nested/parent-only selection, backward-compat string category, clear (PR #25) |
| `grievance-permissions.cy.js` | restricted role+user sees only permitted categories in the picker and only permitted tickets in the list (PR #35) |
| `grievance-resolution-times.cy.js` | per-category resolution-time auto-fill: override + inheritance (PR #35) |
| `grievance-config-behaviors.cy.js` | config-driven backend behaviours surfaced in the UI: default_grievance_type when no category is selected, flag-derived effective priority, restricted_read field masking (PR #35) |
| `grievance.cy.js` | general module coverage (create / comment / filter / status / detail / navigation), migrated to the cascader picker |

The permission spec provisions a restricted role + interactive user over GraphQL at runtime
(dynamic category rights only exist after the backend boots). It needs a CSRF token, so
`gqlLoginAsAdmin` fetches one via `getCsrfToken` and sends it as `X-CSRFToken`; the
provisioned user's password must satisfy the zxcvbn policy (score ≥ 3).
