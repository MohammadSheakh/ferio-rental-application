# External API — Integration Role

**Surface:** `/external/v1/*` · **Auth:** API Key (`Authorization: Bearer fk_live_<prefix>_<secret>`)
**Scopes:** `units:read` · `invoices:read` · `leases:read` · `maintenance:read`
**Rate Limit:** 120/min per key (env-tunable) → 429 + `X-RateLimit-*` headers

---

## Key Management (Platform Admin)

| # | Method | Endpoint | Purpose |
|---|---|---|---|
| 1 | POST | `/platform/organizations/:orgId/api-keys` | Issue key — full key returned **once** |
| 2 | GET | `/platform/api-keys` | List keys |
| 3 | POST | `/platform/api-keys/:id/rotate` | New secret issued, old revoked atomically |
| 4 | POST | `/platform/api-keys/:id/revoke` | Immediate revoke |

---

## Endpoints

### Connectivity Probe
| # | Method | Endpoint | Scope | Purpose |
|---|---|---|---|---|
| 1 | GET | `/external/v1/ping` | *(any valid key)* | Confirm authentication + org binding |

### Units
| # | Method | Endpoint | Scope | Purpose |
|---|---|---|---|---|
| 2 | GET | `/external/v1/units?propertyId=` | `units:read` | List units in the key's organization |

### Invoices
| # | Method | Endpoint | Scope | Purpose |
|---|---|---|---|---|
| 3 | GET | `/external/v1/invoices?status=` | `invoices:read` | Recent invoices w/ amounts |

### Leases
| # | Method | Endpoint | Scope | Purpose |
|---|---|---|---|---|
| 4 | GET | `/external/v1/leases?status=` | `leases:read` | Leases w/ renter + unit context |

### Maintenance
| # | Method | Endpoint | Scope | Purpose |
|---|---|---|---|---|
| 5 | GET | `/external/v1/maintenance?status=` | `maintenance:read` | Maintenance requests |

---

## Error Responses

| Status | Reason |
|---|---|
| 401 | Missing / invalid / revoked API key |
| 403 | Key lacks required scope for this endpoint |
| 429 | Rate limit exceeded (see X-RateLimit-Reset header) |
