# Codex Assessment Fix Log

Date: 2026-08-26

Source assessment: `codex-assessment.md`

## Outcome

All five critical code findings from the assessment are fixed. The red unit suite and identified CI blockers are fixed, all 29 repository verification programs have passed against the designated scratch PostgreSQL environment, and misleading frontend demo surfaces were replaced with live data or explicit product-boundary states.

This is a code-level and scratch-environment remediation. It does not claim that disaster recovery drills, production secret-manager integration, enterprise pilot validation, or production S3 policy configuration have happened.

## Critical Finding 1: Production Tenant Header Override

Status: fixed and regression-tested.

- `TenantResolverMiddleware` accepts `X-Tenant-Slug` only outside production.
- Production tenancy must resolve through a verified host/domain.
- Development retains the header workflow used by local verification scripts.
- Added middleware tests for production rejection and development acceptance.
- `prog39.verify.ts` confirms the development header path remains usable.

Files:

- `ferio-nest-prisma/src/infrastructure/tenant/tenant-resolver.middleware.ts`
- `ferio-nest-prisma/src/infrastructure/tenant/tenant-resolver.middleware.spec.ts`
- `ferio-nest-prisma/test/prog39.verify.ts`

## Critical Finding 2: Per-Tenant Credentials Ignored

Status: fixed across runtime, migration, backup, clone, and health-check paths.

- `TenantDatabaseManager.getTenantDatabase()` now uses the shared `buildTenantUrl()` credential resolver and honors `passwordRef`.
- Tenant DB operations resolve the row's credential reference for backup, restore/clone, administration, and table-count connections.
- The migration orchestrator now receives the complete tenant connection record instead of reconstructing a shared-password URL.
- Direct node-postgres migration health checks pass URLs through `tlsOptionsFromUrl()`. This fixes a verification-discovered mismatch where `sslMode=prefer` incorrectly attempted TLS against a non-TLS server.
- Added a manager regression test proving a tenant-specific environment credential is used.

Files:

- `ferio-nest-prisma/src/infrastructure/tenant/tenant-database.manager.ts`
- `ferio-nest-prisma/src/infrastructure/tenant/tenant-database.manager.spec.ts`
- `ferio-nest-prisma/src/infrastructure/tenant-db-ops/tenant-db-ops.service.ts`
- `ferio-nest-prisma/src/infrastructure/migrations/tenant-migration-orchestrator.ts`

## Critical Finding 3: Private Object Storage

Status: fixed at application-contract level for local and S3 drivers.

- Private documents and raw backups now return opaque `storage://` references, never direct bucket or static-file URLs.
- Managed object keys include an ownership scope: marketplace central user or SaaS organization.
- Attaching a managed document validates that its reference belongs to the current seller/organization. Existing external URLs remain supported for legacy data.
- Listing and renter/tenant services issue short-lived HMAC-signed download URLs only after applying domain visibility and membership rules.
- Added `GET /api/v1/storage/objects`, which verifies expiry/signature and proxies local or S3 bytes with `private, no-store` and `nosniff` headers.
- Missing objects return `404`.
- `/uploads` serves only public listing images; direct document and backup paths return `404`.
- Marketplace document uploads are scoped to the authenticated central user. Tenant document uploads are scoped to the resolved organization.
- Added signed-link tamper, expiry, and ownership-scope unit tests.
- Updated `prog28` to verify the complete opaque-reference -> owner attachment -> visibility check -> signed download flow.

Files:

- `ferio-nest-prisma/src/infrastructure/storage/storage.service.ts`
- `ferio-nest-prisma/src/infrastructure/storage/storage.controller.ts`
- `ferio-nest-prisma/src/infrastructure/storage/storage.module.ts`
- `ferio-nest-prisma/src/infrastructure/storage/storage.service.spec.ts`
- `ferio-nest-prisma/src/main.ts`
- `ferio-nest-prisma/src/features/marketplace/upload.controller.ts`
- `ferio-nest-prisma/src/features/marketplace/marketplace-listing.service.ts`
- `ferio-nest-prisma/src/features/tenant-operations/tenant-upload.controller.ts`
- `ferio-nest-prisma/src/features/tenant-operations/tenant-operations.controller.ts`
- `ferio-nest-prisma/src/features/renter-portal/renter-portal.service.ts`
- `ferio-nest-prisma/test/prog28.verify.ts`
- `ferio-nest-prisma/test/prog39.verify.ts`

## Critical Finding 4: Webhook Claim Race

Status: fixed and regression-tested.

- Replaced the standalone `SELECT ... FOR UPDATE SKIP LOCKED` with one atomic CTE that selects and updates rows to `PROCESSING` in the same statement.
- Claimed rows receive a lease through `nextAttemptAt`; a crashed worker's `PROCESSING` rows become claimable after lease expiry.
- Retry paths explicitly return deliveries to `PENDING`; terminal attempts become `FAILED`.
- Disabled endpoints are safely requeued instead of being stranded in `PROCESSING`.
- Settled-delivery metrics count only `SUCCESS` and `FAILED`.
- Added a unit test for the atomic claim SQL and success transition.
- `prog31` passed signed delivery, HMAC verification, five-attempt dead-lettering, replay, and redelivery.

Files:

- `ferio-nest-prisma/src/features/tenant-operations/tenant-webhook.service.ts`
- `ferio-nest-prisma/src/features/tenant-operations/tenant-webhook.service.spec.ts`

## Critical Finding 5: Scheduler Advisory Lock Session

Status: fixed and regression-tested.

- Scheduler locks now use one dedicated `pg.Client` connected to the control plane.
- Lock acquisition, job execution, unlock, and connection close occur on the same PostgreSQL session.
- Lock connection/acquisition errors fail closed; jobs no longer run unlocked after lock infrastructure failure.
- Added tests proving skipped execution when a lock is held and same-client unlock/close behavior.

Files:

- `ferio-nest-prisma/src/infrastructure/jobs/scheduler.service.ts`
- `ferio-nest-prisma/src/infrastructure/jobs/scheduler.service.spec.ts`

## Authentication and Authorization Hardening

Status: fixed and regression-tested.

- A supplied invalid or expired socket JWT is rejected rather than silently downgraded to a guest.
- A valid token whose subject no longer maps to a user/rider is rejected.
- Explicit no-token guest sessions remain supported.
- Marketplace account IDs in route parameters and request bodies are now bound to the authenticated central identity for listing mutations, favorites, inquiries, viewing requests, and reports.
- Account creation cannot spoof another `centralUserId`.
- Added marketplace controller tests proving cross-account mutation and account-creation spoofing are rejected.
- Updated affected verification scripts to authenticate the actual marketplace account owner instead of relying on the previous insecure behavior.

Files:

- `ferio-nest-prisma/src/features/socket.gateway/services/socket-auth.service.ts`
- `ferio-nest-prisma/src/features/marketplace/marketplace.controller.ts`
- `ferio-nest-prisma/src/features/marketplace/marketplace.controller.spec.ts`
- `ferio-nest-prisma/test/prog17.verify.ts`
- `ferio-nest-prisma/test/prog18.verify.ts`
- `ferio-nest-prisma/test/prog26.verify.ts`
- `ferio-nest-prisma/test/prog27.verify.ts`
- `ferio-nest-prisma/test/prog28.verify.ts`
- `ferio-nest-prisma/test/prog36.verify.ts`
- `ferio-nest-prisma/test/prog38.verify.ts`
- `ferio-nest-prisma/test/prog39.verify.ts`

## Verification and CI Repairs

Status: fixed locally; GitHub-hosted execution remains to be observed after push.

- Repaired the entitlement unit mock for cache freshness.
- Added missing replay and marketplace databases to CI setup and pushes the base marketplace schema before applying PostGIS SQL.
- Fixed malformed provisioning JSON.
- Changed readiness probing from authenticated `/identity/me` to public `/health` and made readiness failure terminate the job.
- Expanded integration CI from 5 scripts to all 29 verification programs.
- Fixed the verify loop's shell variable expansion.
- Runs `prog27` last because that suite intentionally exhausts the process-wide inquiry throttle.
- Added deterministic test-only limits for API-key throttling and webhook retry timing.
- Repaired stale verification construction for billing's ledger/webhook dependencies.
- Corrected `SubscriptionLifecycleService.changePlan()`, whose condition was inverted and rejected normal ACTIVE/TRIALING upgrades. Added unit coverage and verified the complete renew/cancel/reactivate/upgrade event flow.

Files:

- `.github/workflows/ci.yml`
- `ferio-nest-prisma/src/infrastructure/entitlements/entitlement.service.spec.ts`
- `ferio-nest-prisma/src/infrastructure/subscriptions/subscription-lifecycle.service.ts`
- `ferio-nest-prisma/src/infrastructure/subscriptions/subscription-lifecycle.service.spec.ts`
- `ferio-nest-prisma/test/parts-bcd.verify.ts`

## Frontend and Product Truthfulness

Status: assessment issues fixed without inventing unsupported backend behavior.

- Marketplace `Buy` now selects `SALE`; `Commercial` and `Land` are interactive asset filters.
- Production SaaS API requests no longer send `X-Tenant-Slug`; development still supports it.
- SaaS overview, leases, maintenance, utilities, and CRM now load live backend data.
- Expenses and inspections no longer display fabricated records; they clearly report that the dedicated workflow is not yet available and point users to live adjacent capabilities.
- Duplicate SaaS search, renter, and admin surfaces now route users to the dedicated marketplace/renter and admin products.
- Added the required cross-product environment URLs and normalized active API examples to port `6733`.
- Formally marked `ferio-rental-web` as archived and documented the three active applications.
- UI changes preserve the existing Ferio design language and use the shared truthful status-page component.

Files:

- `ferio-marketplace-web/app/page.tsx`
- `ferio-saas-web/lib/api.ts`
- `ferio-saas-web/app/page.tsx`
- `ferio-saas-web/app/leases/page.tsx`
- `ferio-saas-web/app/maintenance/page.tsx`
- `ferio-saas-web/app/utilities/page.tsx`
- `ferio-saas-web/app/crm/page.tsx`
- `ferio-saas-web/app/expenses/page.tsx`
- `ferio-saas-web/app/inspections/page.tsx`
- `ferio-saas-web/app/search/page.tsx`
- `ferio-saas-web/app/tenant/page.tsx`
- `ferio-saas-web/app/admin/page.tsx`
- `ferio-saas-web/components/FeatureStatusPage.tsx`
- `ferio-rental-web/README.md`

## Verification Evidence

Completed successfully on 2026-08-26:

- Backend production compilation: `pnpm build`.
- Backend Jest: 29 suites passed, 79 tests passed, 0 failed.
- SaaS TypeScript: `pnpm exec tsc --noEmit` passed.
- Marketplace TypeScript: `pnpm exec tsc --noEmit` passed.
- Admin TypeScript: `pnpm exec tsc --noEmit` passed.
- `git diff --check` passed.
- All 29 verification programs passed against scratch PostgreSQL on port 5498 and the scratch API on port 6799. Several were rerun after the failures they exposed were fixed; this was not a single pristine GitHub Actions run.
- Verified integration areas include provisioning/migration replay, IAM, tenant isolation, billing/ledger, subscription lifecycle, marketplace workflows, CRM, utilities, maintenance, uploads/private downloads, webhooks, backups/cloning, API keys, custom domains, payments, retention, and race guards.

Full Next.js production builds were not rerun in this pass because the local sandbox previously blocked Turbopack's internal port binding. Direct TypeScript checks for all active frontends pass. GitHub Actions should provide the authoritative clean-run frontend build result after push.

## Residual Risks and Required Operations Work

These remain intentionally open and must not be marked production-verified:

- Configure a dedicated `STORAGE_SIGNING_SECRET` in production. The code falls back to `JWT_ACCESS_SECRET`, but separate key material is preferred.
- Confirm the S3 bucket has public access blocked and configure only the image delivery path as intentionally public through `S3_PUBLIC_BASE_URL`/CDN policy.
- Replace environment-based per-tenant secret references with a real KMS/secret-manager driver. `kms:` remains reserved, not implemented.
- Run the complete GitHub Actions workflow on a fresh runner and retain its artifacts/logs.
- Run disaster recovery drills with measured RPO/RTO, not only backup/readability/clone tests.
- Complete production observability, alert routing, secret rotation, support-access controls, and an enterprise pilot.
- The in-process fixed-window throttles are per pod. Distributed production enforcement still requires a shared store or edge gateway.
- Full Next.js production builds need confirmation in CI.

## Revised Engineering Verdict

The assessed critical application-code blockers are resolved and locally verified. Ferio is materially safer for a controlled pilot, but production readiness still depends on the operational work above and a clean CI run in the deployment environment. Do not translate these fixes into a blanket 100% production-ready claim.
