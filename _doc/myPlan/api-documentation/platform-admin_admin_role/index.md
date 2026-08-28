# Platform Admin — Ferio Operations

**Surface:** admin.ferio.com (port 3002) · **Auth:** Staff JWT (`/identity/platform/login`) + `PlatformAdminGuard` + TOTP
**Frontend:** `ferio-admin-web`

---

## 1. Organizations Screen

### Screen: Organization List & Detail
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | POST | `/platform/organizations` | Provision new workspace (DB + migration + seed + subscription) |
| 2 | GET | `/platform/organizations` | List all orgs w/ plan, DB status, domain |
| 3 | GET | `/platform/organizations/:id` | Org detail w/ domains + DB registry |
| 4 | PATCH | `/platform/organizations/:id/suspend` | Suspend (resolver blocks access instantly) |
| 5 | PATCH | `/platform/organizations/:id/activate` | Reactivate suspended org |
| 6 | GET | `/platform/organizations/:id/provisioning-jobs` | Provisioning pipeline job history |

### Screen: Provisioning Failures
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | POST | `/platform/organizations/:id/provisioning/retry` | Resume failed provisioning from last step |
| 2 | POST | `/platform/organizations/:id/provisioning/rollback` | Rollback artifacts (physical DB drop opt-in) |

### Screen: Archive / Unarchive
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | POST | `/platform/organizations/:id/archive` | DISABLED → resolver lockout + connection drop |
| 2 | POST | `/platform/organizations/:id/unarchive` | Back to READY |
| 3 | GET | `/platform/organizations/:id/export` | JSON data-portability export |

---

## 2. Subscriptions Screen

### Screen: Subscription Lifecycle
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | POST | `/platform/organizations/:id/subscription/renew` | Renew for next period |
| 2 | POST | `/platform/organizations/:id/subscription/cancel` | Cancel subscription |
| 3 | POST | `/platform/organizations/:id/subscription/past-due` | Mark PAST_DUE (grace starts) |
| 4 | POST | `/platform/organizations/:id/subscription/suspend` | Suspend after grace expires |
| 5 | POST | `/platform/organizations/:id/subscription/reactivate` | Reactivate from suspension |
| 6 | PATCH | `/platform/organizations/:id/subscription/plan` | Upgrade/downgrade mid-cycle |

---

## 3. Platform Billing Screen

### Screen: Subscription Invoices
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | GET | `/platform/billing/invoices?organizationId=&status=` | List invoices w/ payments |
| 2 | POST | `/platform/billing/invoices/:id/payments` | Confirm bKash/Nagad/bank/GATEWAY payment → PAID when covered |
| 3 | POST | `/platform/jobs/generate-subscription-invoices` | Create missing period invoices (idempotent) |

---

## 4. Plans & Entitlements Screen

### Screen: Plan Management
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | GET | `/platform/plans` | List plans w/ limits and feature flags |
| 2 | POST | `/platform/plans/seed` | Seed default five tiers |
| 3 | POST | `/platform/plans/:planId/entitlements` | Set per-plan entitlement overrides |
| 4 | GET | `/platform/plans/:planId/entitlements` | View entitlements |

---

## 5. Marketplace Moderation Screen

### Screen: Pending Review Queue
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | GET | `/platform/marketplace/listings/pending-review` | Listings awaiting approval |
| 2 | POST | `/platform/marketplace/listings/:listingId/approve` | Approve → ACTIVE |
| 3 | POST | `/platform/marketplace/listings/:listingId/reject` | Reject with reason → REJECTED |
| 4 | POST | `/platform/marketplace/listings/:listingId/takedown` | Emergency takedown of live listing |

### Screen: Abuse Reports
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | GET | `/platform/marketplace/reports?status=PENDING` | Abuse reports by status |
| 2 | POST | `/platform/marketplace/reports/:reportId/action` | Resolve as ACTIONED or DISMISSED |

---

## 6. Promotions Admin Screen

### Screen: Promotion Management
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | GET | `/platform/marketplace/promotions?status=` | All promotions across marketplace |
| 2 | POST | `/platform/marketplace/promotions/:id/confirm-payment` | Confirm payment → promotion ACTIVE |
| 3 | POST | `/platform/marketplace/promotions/:id/cancel` | Revoke promotion |

---

## 7. Tenant DB Operations Screen

### Screen: Database Fleet
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | GET | `/platform/tenant-db` | Registry w/ schema version, health, status |
| 2 | POST | `/platform/tenant-db/migrate` | Migrate one/batch/all tenants (bounded pool) |
| 3 | GET | `/platform/tenant-db/metrics` | Pool stats · fleet status · backup totals |

### Screen: Backups
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | POST | `/platform/organizations/:orgId/backups` | Take pg_dump -Fc backup |
| 2 | GET | `/platform/backups` | List backups |
| 3 | POST | `/platform/backups/:id/verify` | Prove archive readability |
| 4 | POST | `/platform/backups/:id/clone` | Clone-to-staging database |

### Screen: Archive
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | POST | `/platform/organizations/:orgId/archive` | Lock out tenant (DISABLED) |
| 2 | POST | `/platform/organizations/:orgId/unarchive` | Restore access (READY) |

### Screen: Data Export
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | GET | `/platform/organizations/:orgId/export` | ferio-export-v1 JSON download |

---

## 8. External API Keys Screen

### Screen: API Key Management
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | POST | `/platform/organizations/:orgId/api-keys` | Issue key (shown once) |
| 2 | GET | `/platform/api-keys` | List keys |
| 3 | POST | `/platform/api-keys/:id/revoke` | Immediate revoke |
| 4 | POST | `/platform/api-keys/:id/rotate` | New secret issued once, old revoked |
| 5 | GET | `/platform/api-keys/scopes` | Valid scope list |

---

## 9. Analytics Screens

### Screen: Platform Overview
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | GET | `/platform/analytics` | MRR · orgs · listings · inquiry conversion · promotions revenue · subscription conversion |
| 2 | GET | `/platform/analytics/marketplace` | Listing volume · type trends · price ranges · area demand · search activity |
| 3 | GET | `/platform/analytics/growth` | Churn rate · tenant DB growth by month |

---

## 10. Ops Alerts Screen

### Screen: System Health
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | GET | `/platform/ops/alerts` | Aggregated failure signals: ledger drift, dead-letters, stuck fulfillments, provisioning failures |
| 2 | GET | `/platform/health` | Full system health check (DB connections, pool stats) |

---

## 11. Scheduled Jobs (Ops Triggers)

All jobs are also auto-scheduled via SchedulerService. These routes allow manual invocation.

| # | Method | Endpoint | Job |
|---|---|---|---|
| 1 | POST | `/platform/jobs/generate-monthly-statements` | Create current-period statements |
| 2 | POST | `/platform/jobs/overdue-invoice-scan` | Mark overdue invoices |
| 3 | POST | `/platform/jobs/lease-expiry-scan` | Scan expiring leases |
| 4 | POST | `/platform/jobs/subscription-past-due-scan` | Mark PAST_DUE subscriptions |
| 5 | POST | `/platform/jobs/rent-reminders` | Emit rent.reminder webhooks |
| 6 | POST | `/platform/jobs/maintenance-escalation` | Escalate stale tickets |
| 7 | POST | `/platform/jobs/expire-listings` | Expire past-dated listings |
| 8 | POST | `/platform/jobs/expire-promotions` | Expire paid promotions |
| 9 | POST | `/platform/jobs/refulfill-payments` | Complete stuck payment fulfillments |
| 10 | POST | `/platform/jobs/retention-sweep` | Trim expired search events + delivery logs |
| 11 | POST | `/platform/jobs/generate-subscription-invoices` | Create missing platform invoices |

---

## 12. Feature Flags & Audit

| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | GET | `/platform/feature-flags` | List flags |
| 2 | POST | `/platform/feature-flags` | Create/update flag |
| 3 | GET | `/platform/audit` | Platform audit trail |
