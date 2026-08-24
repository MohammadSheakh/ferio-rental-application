# Progress Report 32 — § Week 26 Custom Domains + Ledger Widening

**Date:** 2026-08-24
**Role:** Senior Solution Architect & Full-Stack Developer
**Status:** Completed — prog32 12/12; full regression battery **14 suites / 157 assertions** green (prog31 requires its rate-limit/webhook env)

---

## Executive Summary

Closed Week 26: organizations can now attach and verify **custom domains**, which resolve to their workspace ahead of subdomain rules. Also widened ledger coverage: broker commission payouts post balanced entries.

## 1. Custom Domains (§ Week 26)

### Flow
```
owner adds rentals.myagency.com
      ↓ instructions: TXT _ferio-verify.<domain> = ferio-verify=<token>
        (or CNAME → sites.ferio.com)
owner runs "Verify" → DNS proof → VERIFIED + sslStatus ACTIVE
      ↓
middleware resolves that Host to the workspace BEFORE subdomain rules
      ↓ optional: promote to PRIMARY
```

### Guarantees verified E2E
| Concern | Proof |
|---|---|
| Takeover protection | cross-org claim of a VERIFIED domain → 409; `ferio.com` subdomains rejected; unverified hosts never resolve |
| Fresh verification | positive-only hostname cache — a just-verified domain resolves immediately (negative caching removed after it poisoned resolution in testing) |
| Dual drivers | real TXT/CNAME resolution in prod; `DOMAIN_DNS_MODE=mock` for scratch suites |

Owner surface `/tenant/domains` (add/list/verify/primary/remove, owner-gated); audit events on every verification pass/fail.

## 2. Ledger Widening

Broker commission payouts now settle into the books:
```
payout:<id> → Dr COMMISSION_EXPENSE · Cr cash-by-method
```
Trial balance remains zero-drift with the new legs (verified +৳21,000 on both sides). Same one-line pattern is ready for utility postings and deposit accounting.

## 3. Issues Found En Route

| Issue | Fix |
|---|---|
| DI failure at boot: `DomainVerificationService` provided but not exported by the global infra module | added to exports (same-module providers don't need it; cross-module consumers do) |
| Negative hostname-cache poisoning: a custom domain checked before verification stayed unresolvable for 60s | cache only positive resolutions |

## 4. Verification (prog32.verify.ts)

Non-owner blocked · ferio.com suffix rejected · add w/ TXT instructions · unverified host rejected (takeover) · mock TXT proof → VERIFIED+ACTIVE · Host-header resolution works · primary promotion · rival-org takeover 409 · payout settle → balanced COMMISSION_EXPENSE/BKASH group · trial balance drift 0. **12/12.**

Regression battery: prog13 19 · prog14 5 · prog17 11 · prog18 4 · prog19 10 · prog20 9 · prog21 9 · prog22 5 · prog26 21 · prog27 10 · prog28 11 · prog29 14 · prog30 12 · prog31 17*(with its env)* = **157/157 ✅**

Builds: ferio-nest-prisma ✅

## 5. Remaining Next Steps

1. Payment-gateway integrations (bKash/Nagad APIs or Stripe) to automate platform-billing + promotion payment confirmation.
2. SSL cert issuance automation (reverse-proxy/LetsEncrypt wiring outside app scope).
3. Ledger: utility posting legs + deposit accounting.
4. API key rotation UX + webhook event catalog docs.

---

*Progress chain: … prog-31 → **prog-32 (custom domains + ledger widening)**.*
