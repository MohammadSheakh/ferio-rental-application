# Ferio Platform — Disaster Recovery Runbook

**Scope:** Control plane (`ferio_control`), Marketplace (`ferio_marketplace`), Tenant DBs (`tenant_<slug>`), Redis, object storage.
**Tooling:** backup/verify/clone/archive endpoints from prog-34 (§ Week 36).

---

## RPO / RTO Targets (§ Week 37)

| Plane | Availability | RPO | RTO |
|---|---|---|---|
| Control | ≥ 99.9% | ≤ 1h | ≤ 2h |
| Marketplace | ≥ 99.9% | ≤ 1h | ≤ 2h |
| Tenant APIs | ≥ 99.9% | ≤ 1h | ≤ 2h |

## 1. Backup posture

- **Tenant DBs**: `pg_dump -Fc` per org via `POST /platform/organizations/:id/backups` (types: MANUAL, PRE_MIGRATION, SCHEDULED). Take a PRE_MIGRATION backup before any fleet migration roll. Stored via StorageService (S3 + versioning recommended).
- **Marketplace / Control**: nightly `pg_dump -Fc` by infra scheduler (cron/systemd timer) — same restore tooling applies. Retain 30 daily / 12 monthly.
- **PITR**: enable WAL archiving at the infrastructure layer (WAL-G / pgBackRest) — application tooling complements but does not replace it.
- **Verify weekly**: `POST /platform/backups/:id/verify` on a sample; alert on failure.

## 2. Restore procedures

### 2.1 Single tenant DB (logical corruption)
1. `POST /platform/organizations/:id/archive` — locks the workspace out (DB stays intact).
2. `POST /platform/backups/:id/clone` → produces `<db>_clone_<ts>` with full schema+data.
3. Inspect the clone; when satisfied, swap: archive live DB permanently if needed and point the org's `TenantDatabase` row at the clone (rename + status READY), or export/import the affected rows manually.
4. `POST .../unarchive` equivalent → READY; verify tenant route 200.

### 2.2 Marketplace plane
1. Stop API workers that write projections (outbox worker retries safely after restart).
2. Restore `ferio_marketplace` dump into replacement DB; re-point `MARKETPLACE_DATABASE_URL`.
3. Run reconciliation: `POST /platform/organizations/:id/outbox/reconcile` per org to re-project any listings lost since the backup point.

### 2.3 Control plane
1. Restore `ferio_control` dump (orgs/subs/keys/domains/audit).
2. Tenant DB registry rows must match reality — run fleet health check; re-register orphans manually.
3. Rotated JWT secrets invalidate sessions: users re-login (refresh families are hash-backed in this DB).

### 2.4 Redis loss
Tenant lookup cache + rate-limit buckets are rebuildable in-memory: restart API pods. No data loss (sessions persist via control-plane refresh tokens).

### 2.5 Object storage loss
Uploads (listing media, documents, backups) live under keys `images|documents|backups/...`. Restore from bucket versioning/replica; URL registrations in DBs remain valid because keys are stable.

## 3. Incident roles

| Role | Responsibility |
|---|---|
| Incident lead | declares severity, coordinates, communicates |
| DB operator | executes backups/restores via platform endpoints or psql |
| App operator | stops/starts workers, flips feature flags |
| Comms | status page + customer notices (use Notice system for workspace-level comms) |

## 4. Severity quick reference

| Sev | Example | First action |
|---|---|---|
| SEV1 | cross-tenant data exposure | take affected plane read-only, preserve audit, page lead |
| SEV1 | tenant DB lost | archive org → clone latest backup → swap |
| SEV2 | marketplace search down | restart API; check PostGIS container; reconcile projections |
| SEV3 | single feature degraded | flag off, schedule fix |

## 5. Drills

Quarterly: restore one random tenant backup into a clone and diff table counts; verify one marketplace + one control-plane dump with `pg_restore --list`.
