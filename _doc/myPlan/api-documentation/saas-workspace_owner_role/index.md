# SaaS Workspace — Owner / Staff Role

**Surface:** app.ferio.com (port 3000) · **Auth:** JWT + ActiveMemberGuard
**Frontend:** `ferio-saas-web`
**Tenant Resolution:** `X-Tenant-Slug` header (dev) or subdomain/custom-domain (prod)

All routes below are prefixed with `/tenant/` and require an ACTIVE membership in the resolved organization. Write mutations additionally require the correct domain role (inventory/billing/leasing/maintenance).

---

## 1. Properties & Units

### Screen: Property List
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | POST | `/tenant/properties` | Create property/building |
| 2 | GET | `/tenant/properties` | List properties (scope-filtered) |
| 3 | GET | `/tenant/properties/:id` | Detail w/ units + owner shares |

### Screen: Unit List & Detail
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | POST | `/tenant/units` | Create unit |
| 2 | GET | `/tenant/units?propertyId=` | List units |

### Screen: Unit Rooms (§24 Room-by-Room)
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | POST | `/tenant/units/:id/rooms` | Add room (name/type/ft×ft/photos) |
| 2 | GET | `/tenant/units/:id/rooms` | List rooms w/ computed sqft |
| 3 | PATCH | `/tenant/unit-rooms/:roomId` | Edit room dimensions/description |
| 4 | DELETE | `/tenant/unit-rooms/:roomId` | Remove room |
| 5 | POST | `/tenant/unit-rooms/:roomId/media` | Add photo to room |
| 6 | DELETE | `/tenant/unit-room-media/:mediaId` | Remove room photo |

---

## 2. Buildings & Unit Ownership

### Screen: Buildings
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | POST | `/tenant/buildings` | Create building under property |
| 2 | GET | `/tenant/buildings` | List buildings |

### Screen: Unit Ownership (co-owners, shares, payment routing)
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | POST | `/tenant/units/:id/owners` | Add co-owner w/ share % |
| 2 | GET | `/tenant/units/:id/ownership` | Ownership summary (allocated/unallocated) |
| 3 | PATCH | `/tenant/ownership/unit/:id/share` | Change share % (effective-dated) |
| 4 | PATCH | `/tenant/ownership/unit/:id/payment` | Set bKash/Nagad/bank destination |
| 5 | POST | `/tenant/ownership/unit/:id/end` | End ownership stake |

---

## 3. Marketplace Publishing

### Screen: Publish Unit to Marketplace
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | POST | `/tenant/units/:id/publish` | Publish via outbox → marketplace listing |
| 2 | PATCH | `/tenant/units/:id/publish` | Update projection (price/description) |
| 3 | POST | `/tenant/units/:id/unpublish` | Pause listing |
| 4 | POST | `/tenant/units/:id/mark-rented` | Mark as RENTED |

---

## 4. Leasing (Renters & Leases)

### Screen: Renters
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | POST | `/tenant/renters` | Register renter (name/NID/phone/centralUserId) |
| 2 | GET | `/tenant/renters` | List renters |

### Screen: Leases
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | POST | `/tenant/leases` | Create lease → unit OCCUPIED |
| 2 | GET | `/tenant/leases` | List leases |

### Screen: Guarantors
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | POST | `/tenant/renters/:renterId/guarantors` | Add guarantor |
| 2 | GET | `/tenant/renters/:renterId/guarantors` | List guarantors |

### Screen: Reservation
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | POST | `/tenant/units/:unitId/reserve` | Reserve unit for prospect |

---

## 5. Billing

### Screen: Charge Definitions & Invoices
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | POST | `/tenant/billing/charges` | Define recurring charge (RENT/SERVICE_CHARGE/etc.) |
| 2 | GET | `/tenant/billing/accounts?unitId=` | Get billing account for unit |
| 3 | POST | `/tenant/billing/invoices` | Generate monthly invoice (idempotent per periodKey) |
| 4 | GET | `/tenant/billing/invoices` | List invoices w/ lines |

### Screen: Payment Recording & Verification
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | POST | `/tenant/billing/payments` | Record payment (PENDING → verification queue) |
| 2 | POST | `/tenant/billing/payments/:paymentId/verify` | Staff verifies → allocates + receipt |
| 3 | POST | `/tenant/billing/payments/:paymentId/reject` | Reject with reason |
| 4 | POST | `/tenant/billing/payments/:paymentId/reverse` | Reverse verified/settled payment |

---

## 6. Utilities

### Screen: Utility Accounts & Meters
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | POST | `/tenant/utilities` | Create utility account (DESCO/WASA/Titas) |
| 2 | POST | `/tenant/utilities/meters` | Register meter |
| 3 | POST | `/tenant/utilities/meter-readings` | Record reading (dup-prevention per month) |
| 4 | GET | `/tenant/utilities` | List accounts w/ meters + readings |

### Screen: Utility Bill Allocation
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | POST | `/tenant/utilities/bills` | Generate bill w/ allocation (EQUAL/AREA/OCCUPANCY/SUBMETER/PERCENTAGE/MANUAL/FIXED) |
| 2 | POST | `/tenant/utility-bills/:billId/post` | Post allocations onto unit invoices |

---

## 7. Maintenance Workflow

### Screen: Request Lifecycle
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | POST | `/tenant/maintenance` | Report issue (OPEN) |
| 2 | POST | `/tenant/maintenance/:id/triage` | Classify + estimate → TRIAGED |
| 3 | POST | `/tenant/maintenance/:id/estimate` | Approve/reject estimate gate |
| 4 | PATCH | `/tenant/maintenance/:id/status` | Guarded state transition |
| 5 | POST | `/tenant/maintenance/work-orders` | Assign crew/vendor → ASSIGNED |
| 6 | PATCH | `/tenant/maintenance/work-orders/:woId/complete` | Complete w/ actual cost → ledger entry |
| 7 | GET | `/tenant/maintenance?unitId=` | List requests + work orders |

---

## 8. Notices & Documents

### Screen: Workspace Notices
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | POST | `/tenant/notices` | Post org-wide or unit-targeted notice |
| 2 | GET | `/tenant/notices` | List notices |

### Screen: Documents
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | POST | `/tenant/documents` | Attach document to LEASE/UNIT |
| 2 | GET | `/tenant/documents` | List documents |

---

## 9. IAM — Members, Invites, Delegations

### Screen: Team Management
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | POST | `/tenant/iam/invites` | Invite member (role + email) |
| 2 | GET | `/tenant/iam/invites` | List invites |
| 3 | PATCH | `/tenant/iam/invites/:inviteId/revoke` | Revoke invite |
| 4 | POST | `/tenant/iam/invites/accept` | Accept invite (binds central identity) |
| 5 | GET | `/tenant/iam/members` | List members |
| 6 | PATCH | `/tenant/iam/members/:memberId` | Update role/status/scopes |

### Screen: Delegations (§ Week 9)
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | POST | `/tenant/iam/delegations` | Grant time-boxed write domains to member |
| 2 | GET | `/tenant/iam/delegations` | List granted/received |
| 3 | DELETE | `/tenant/iam/delegations/:id` | Revoke delegation |

---

## 10. CRM (Broker Leads)

### Screen: Lead Pipeline
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | POST | `/tenant/crm/leads` | Create lead (REFERRAL/WALK_IN/MARKETPLACE_INQUIRY) |
| 2 | GET | `/tenant/crm/leads` | Pipeline view |
| 3 | PATCH | `/tenant/crm/leads/:leadId` | Status transition (guarded) |
| 4 | POST | `/tenant/crm/leads/:leadId/convert` | Convert → renter + ACTIVE lease + commission payout |
| 5 | GET | `/tenant/crm/report` | Conversion rate + per-assignee stats |

### Screen: Lead Viewings
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | POST | `/tenant/crm/leads/:leadId/viewings` | Schedule viewing |
| 2 | GET | `/tenant/crm/leads/:leadId/viewings` | List viewings |
| 3 | PATCH | `/tenant/crm/viewings/:viewingId` | Mark COMPLETED / NO_SHOW |

### Screen: Commission Payouts
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | GET | `/tenant/crm/payouts?status=DUE` | DUE payouts |
| 2 | POST | `/tenant/crm/payouts/:payoutId/settle` | Settle → PAID (posts COMMISSION_EXPENSE ledger leg) |

---

## 11. Reports

| # | Method | Endpoint | Report |
|---|---|---|---|
| 1 | GET | `/tenant/reports/occupancy` | Occupancy + vacancy % |
| 2 | GET | `/tenant/reports/financial` | Rent collection + outstanding |
| 3 | GET | `/tenant/reports/beneficiary-split` | Receivable split by beneficiary |
| 4 | GET | `/tenant/reports/maintenance` | Maintenance cost + SLA |
| 5 | GET | `/tenant/reports/unit-profitability` | Revenue vs cost per unit |
| 6 | GET | `/tenant/reports/owner-receivable` | Per-owner expected vs collected by share % |
| 7 | GET | `/tenant/reports/allocation-reconciliation` | Line-totals vs invoice totals check |
| 8 | GET | `/tenant/reports/overdue-renters` | Renters with overdue invoices |
| 9 | GET | `/tenant/reports/lease-expiry?days=N` | Expiring leases |
| 10 | GET | `/tenant/reports/utility-collection` | Utility breakdown by category |
| 11 | GET | `/tenant/reports/payment-behavior` | Days-to-pay + on-time % per renter |
| 12 | GET | `/tenant/reports/trial-balance` | Ledger trial balance (drift must = 0) |
| 13 | GET | `/tenant/reports/ledger/:groupId` | Inspect one posting group |

---

## 12. Automations (§ Week 32)

| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | POST | `/tenant/automations/rules` | Create rule (trigger + action) |
| 2 | GET | `/tenant/automations/rules` | List rules |
| 3 | DELETE | `/tenant/automations/rules/:id` | Delete rule |
| 4 | POST | `/tenant/automations/dry-run` | Test without side effects |
| 5 | GET | `/tenant/automations/executions` | Execution history |
