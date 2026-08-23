# Progress Report 18 — Inquiry→CRM Auto-Attribution (Growth Loop Closed)

**Date:** 2026-08-23
**Role:** Senior Solution Architect & Fullstack Engineer
**Status:** Completed — 4/4 live assertions; the PRD's headline marketplace→SaaS connection now happens automatically

---

## Executive Overview

Closed the last Week 30 gap: **marketplace inquiries on org-published units now auto-attribute as `MARKETPLACE_INQUIRY` leads in that organization's CRM** — no manual entry. This is the PRD §9/§10 growth loop (`Inquiry → CRM → Lease`) working end-to-end without human wiring.

---

## 1. Implementation

`MarketplaceInteractionService.createInquiry` — after persisting the inquiry, a **best-effort async attribution** fires for listings projected from managed units (`sourceOrganizationId` + `sourceUnitId` present):

1. Resolves the sender's marketplace profile for contact details.
2. Connects to the source organization's tenant DB and maps the marketplace unit → local unit.
3. **Dedupes**: same contact phone on the same unit stays one lead (follow-up inquiries don't spam the pipeline).
4. Creates the `CrmLead` with `source=MARKETPLACE_INQUIRY`, sender contact, and the inquiry message as notes.

Attribution failures never block the inquiry — logged and skipped by design.

## 2. Supporting fix

Added the missing **`CrmLead ↔ Renter` relation** (`convertedRenterId` FK, migration `0006`) so converted leads can include their renter record — previously the include referenced an undeclared relation.

## 3. Verification (live :6799)

| Check | Result |
|---|---|
| Unit published via outbox → projected listing | ✅ |
| Two inquiries sent by same prospect | ✅ |
| Exactly ONE deduped `MARKETPLACE_INQUIRY` lead appears in org CRM, linked to the unit, with contact captured | ✅ |

`test/prog18.verify.ts` — polls briefly for the async worker-style attribution before asserting.

## 4. Remaining Next Steps

1. Viewing-request tracking per lead (Week 30 tail).
2. Commission payout ledger (Week 30 tail).
3. Sale CRM offers/negotiation (Week 31); automation engine (Week 32).

---

*Progress chain: prog-08 … prog-17 → **prog-18 (growth loop closed)**.*
