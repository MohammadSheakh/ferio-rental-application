# Progress Report 07 — Multi-Project Architecture Split (3 Standalone Next.js Applications)

**Date:** 2026-08-22  
**Role:** Senior Solution Architect & Fullstack Engineer (10+ Years Experience)  
**Status:** Completed Multi-Project Monorepo Split into 3 Standalone Next.js Applications  

---

## Executive Overview

Separated the frontend layer into **3 dedicated, standalone Next.js applications** inside the monorepo workspace to align strictly with the architectural boundaries defined in `_doc/myPlan/prd-new.md` (Sections 7, 19, & 26).

---

## 1. Monorepo Project Breakdown

```text
/home/chillpc/MohammadSheakh/projects/26/ferio-rental/
├── pnpm-workspace.yaml
├── package.json (Root orchestration scripts)
│
├── ferio-marketplace-web/      # App 1: Public Property Marketplace (www.ferio.com)
├── ferio-saas-web/             # App 2: Rental SaaS Operations Workspace (app.ferio.com)
├── ferio-admin-web/            # App 3: Platform Control Plane Console (admin.ferio.com)
└── ferio-nest-prisma/          # Backend: Multi-Tenant NestJS Microservice Core
```

---

## 2. Individual Application Specifications

### App 1: `ferio-marketplace-web` (`www.ferio.com` — Port 3001)
- **Target Persona**: Renters, buyers, brokers, and free ad posters.
- **Key Features**:
  - OpenStreetMap coordinate location discovery grid with bounds filtering (Rampura, Gulshan, Banani, Dhanmondi, Uttara).
  - Purpose & category filters (`RENT`, `SALE`, `APARTMENT`, `SHOP`, `LAND`, `STORE_ROOM`, `OFFICE`).
  - Direct inquiry form dispatch to listing sellers.
  - Free property ad posting workflow (without requiring a SaaS subscription).

### App 2: `ferio-saas-web` (`app.ferio.com` / `[org].ferio.com` — Port 3000)
- **Target Persona**: Property managers, building owners, unit owners, staff, caretakers.
- **Key Features**:
  - Multi-property & unit inventory state machines (`AVAILABLE`, `OCCUPIED`, `MAINTENANCE_HOLD`, `RESERVED`).
  - NID-verified tenant leases & agreements.
  - Multi-beneficiary billing line routing (Rent → Owner, Service Charge → Building Management, Utility → Provider).
  - DESCO/WASA/Titas Gas submeter reading tracking and shared bill apportionment engine.
  - Caretaker maker/checker cash verification queue & double-entry financial ledger.

### App 3: `ferio-admin-web` (`admin.ferio.com` — Port 3002)
- **Target Persona**: Platform Administrators & Support Engineers.
- **Key Features**:
  - **SaaS Tenant Database Provisioning**: Controls PostgreSQL database-per-tenant migrations (`ferio_tenant_[slug]`).
  - **Plan Quotas & Entitlements**: Limits unit creation according to plan tier (`STARTER`, `PRO`, `BUSINESS`, `ENTERPRISE`).
  - **Marketplace Moderation Queue**: Audits seller NID and land deed papers before publishing listings live.
  - **Infrastructure Telemetry**: BullMQ worker queues and Postgres database connection pool telemetry.

---

## 3. Build & Compilation Verification

| Project Name | Package Type | Target Domain / Port | Build Command | Result |
|---|---|---|---|---|
| `ferio-marketplace-web` | Next.js 16 App | `www.ferio.com` (:3001) | `pnpm --filter ferio-marketplace-web run build` | ✅ PASS (0 errors) |
| `ferio-saas-web` | Next.js 16 App | `app.ferio.com` (:3000) | `pnpm --filter ferio-saas-web run build` | ✅ PASS (0 errors) |
| `ferio-admin-web` | Next.js 16 App | `admin.ferio.com` (:3002) | `pnpm --filter ferio-admin-web run build` | ✅ PASS (0 errors) |
| `ferio-nest-prisma` | NestJS Monorepo | Backend API (:3000) | `pnpm --filter ferio-nest-prisma run build` | ✅ PASS (0 errors) |
