# Unit Owner Portal

**Surface:** saas-web (owner view) · **Auth:** JWT bound via `UnitOwnership.ownerCentralUserId`
**Resolution:** Cross-org fan-out — collects stakes from every ACTIVE organization where the caller holds an ownership stake.

---

## 1. Portfolio Dashboard Screen

### Screen: My Units Across All Organizations
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | GET | `/owner/me` | Per-unit snapshot: share %, co-owners (names + shares), active lease (renter name, dates, rent, status), expected monthly rent = lease.rent × my share %, outstanding balance from open invoices |

**Response shape:**
```json
{
  "units": [
    {
      "unitName": "4B",
      "propertyName": "Rose Valley Heights",
      "mySharePercent": 60,
      "coOwners": [{ "name": "Sultana", "sharePercent": 40 }],
      "lease": { "renterName": "Karim", "monthlyRent": 50000, "status": "ACTIVE" },
      "expectedMonthlyRentBdt": 30000,
      "outstandingBdt": 20000,
      "activeWorkOrders": [...]
    }
  ],
  "portfolioTotalExpectedBdt": 30000,
  "portfolioTotalOutstandingBdt": 20000
}
```

---

## 2. Statements Screen

### Screen: Consolidated Statements Across Owned Units
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | GET | `/owner/invoices` | All invoices on owned units w/ lines + payments/receipts, newest first |

---

## 3. Maintenance Visibility Screen

### Screen: Tickets on My Units
| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | GET | `/owner/maintenance` | Maintenance tickets on any owned unit (read-only visibility) |
