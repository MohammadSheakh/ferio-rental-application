# Renter Portal — "My Rental"

**Surface:** ferio.com/renter (inside marketplace-web) · **Auth:** JWT bound via `Renter.centralUserId`
**Frontend:** `ferio-marketplace-web/app/renter/page.tsx`

The renter is NOT a workspace member. Resolution fans out across ACTIVE tenant DBs looking for a Renter row bound to the caller's identity holding an ACTIVE lease.

---

## 1. Dashboard Screen

### Screen: My Rental Overview
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | GET | `/renter/me` | Tenancy snapshot: lease dates, rent, unit + property, outstanding total, per-owner payment instructions (bKash/Nagad/bank by share %) |

---

## 2. Statements Screen

### Screen: Monthly Statements
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | GET | `/renter/invoices` | All invoices w/ lines, payments, receipt numbers, status pills |

---

## 3. Report Payment Screen

### Screen: Pay Rent Directly to Owner
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | POST | `/renter/payments` | Report a payment made to owner → enters verification queue (never auto-paid) |

```json
{ "invoiceId": "...", "method": "BKASH", "amount": 35000, "reference": "TRX123" }
```

---

## 4. Utilities Screen

### Screen: Utility Accounts & Meters
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | GET | `/renter/utilities` | Utility accounts for rented unit: DESCO/WASA/Titas accounts, meters, latest readings with consumption |

---

## 5. Maintenance Screens

### Screen: My Tickets
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | GET | `/renter/maintenance` | Tickets on my unit (newest first, with work-order status) |

### Screen: Report an Issue
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | POST | `/renter/maintenance` | Open UNIT-scoped ticket → enters OPEN status in staff queue |

```json
{ "title": "AC not cooling", "urgency": "URGENT", "description": "...", "photoUrls": ["..."] }
```

### Screen: Confirm Completed Work
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | POST | `/renter/maintenance/:ticketId/confirm` | Accept completed work → RESOLVED → CONFIRMED |

### Screen: Reopen Ticket
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | POST | `/renter/maintenance/:ticketId/reopen` | Reject completed work → REOPENED (+reopenCount) |

```json
{ "reason": "AC still not cooling after two days" }
```

---

## 6. Notices Screen

### Screen: Announcements from Management
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | GET | `/renter/notices` | Org-wide ∪ unit-targeted notices (max 50) |

---

## 7. Documents Screen

### Screen: Lease & Unit Documents
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | GET | `/renter/documents` | LEASE/UNIT-attached documents only |
