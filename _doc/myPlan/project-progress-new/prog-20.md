# Progress Report 20 — Week 30 Complete: Lead Viewings & Commission Payout Ledger

**Date:** 2026-08-23
**Role:** Senior Solution Architect & Fullstack Engineer
**Status:** Completed — 9/9 live assertions; Broker CRM is now 100% (all eight Week 30 checklist items)

---

## Executive Overview

Closed the final two Week 30 items: **viewing appointments per CRM lead** and a **commission payout ledger** that auto-creates a DUE payout at lease conversion and is settled by staff with method/reference — completing the broker lifecycle from inquiry to paid commission.

---

## 1. Schema (migration `0007_lead_viewings_commission_payouts`)

- **`LeadViewing`** — leadId FK (cascade), scheduledAt, status enum (`SCHEDULED/COMPLETED/NO_SHOW/CANCELLED`), notes.
- **`CommissionPayout`** — leaseId FK (cascade), brokerName, amount, status (`DUE/PAID`), PaymentMethod, reference, paidAt, recordedBy.

## 2. Behaviour

### Viewings
- `POST /tenant/crm/leads/:leadId/viewings` — schedule (leasing-domain gated)
- `GET /tenant/crm/leads/:leadId/viewings` — newest first
- `PATCH /tenant/crm/viewings/:id` — mark COMPLETED / NO_SHOW / CANCELLED, reschedule, notes

### Commission payouts
- Conversion now **auto-creates a DUE payout** inside the same transaction when commissionAmount > 0; payoutId included in conversion response + audit metadata.
- `GET /tenant/crm/payouts?status=DUE|PAID` — with lease/unit context and commission %.
- `POST /tenant/crm/payouts/:id/settle {method, reference?}` — marks PAID (billing-domain gated), double-settle blocked (400), audited as `crm.payout_settled`.

## 3. Verification (live :6799)

| Check | Result |
|---|---|
| Convert @50% of ৳40k rent | ✅ DUE payout auto-created (৳20,000) |
| Viewing schedule → COMPLETED → list | ✅ |
| DUE payout visible w/ broker + % + amount | ✅ |
| Settle → PAID; removed from DUE list | ✅ |
| Double-settle blocked (400) | ✅ |

Migration `0007` applied via orchestrator-style deploy after resolving the earlier push/deploy drift on the scratch tenant.

## 4. Remaining Next Steps

1. Sale CRM tail: dedicated sale-timeline endpoint; controlled doc sharing wired into offers.
2. Automation engine (Week 32) over domain events.
3. Analytics groundwork (Weeks 34–35).

---

*Progress chain: prog-08 … prog-19 → **prog-20 (Week 30 fully complete)**.*
