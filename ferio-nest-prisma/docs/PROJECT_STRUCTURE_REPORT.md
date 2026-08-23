# Project Structure Report (NestJS)

Date: 2026-05-12

## Snapshot: current structure

Top-level:

```
.
├─ docs/
├─ src/
├─ test/
├─ package.json
├─ nest-cli.json
├─ tsconfig.json
└─ eslint.config.mjs
```

`src/`:

```
src/
├─ app.controller.ts
├─ app.controller.spec.ts
├─ app.module.ts
├─ app.service.ts
├─ main.ts
├─ common/
│  ├─ decorators/
│  ├─ exceptions/
│  ├─ filters/
│  ├─ guards/
│  ├─ interceptors/
│  ├─ middleware/
│  ├─ pipes/
│  └─ utils/
├─ config/
│  ├─ app.config.ts
│  ├─ config.module.ts
│  ├─ config.service.ts
│  └─ database.config.ts
├─ core/
│  ├─ cache/
│  ├─ database/
│  ├─ health/
│  ├─ logger/
│  ├─ queue/
│  │  └─ processor/
│  └─ storage/
├─ features/
├─ infrastructure/
│  ├─ email/
│  ├─ file-storage/
│  │  └─ r...
│  └─ readme.md
└─ shared/
   ├─ constants/
   ├─ enums/
   ├─ interfaces/
   ├─ types/
   └─ utils/
```

## What’s good

- Clear intent to separate cross-cutting concerns (`common/`), technical core modules (`core/`), third-party adapters (`infrastructure/`), and feature modules (`features/`).
- Dedicated `config/` folder (good direction for centralized env/config).
- `shared/` folder reserved for code reuse (types/constants/utils).

## Gaps / inconsistencies noticed

- Many folders are currently empty (or contain only placeholder comments), so the structure is not yet “enforced” by code.
- `src/config/*.ts` files are placeholders and are not wired into `AppModule` (`src/app.module.ts`) or bootstrap (`src/main.ts`).
- Repo name suggests Prisma, but there are no Prisma dependencies in `package.json` and no `prisma/` folder/schema.
- Testing is split between `src/*.spec.ts` (unit) and `test/` (e2e); that can be fine, but it needs a consistent convention.

## Recommended conventions (practical + scalable)

### 1) Define responsibilities of each top-level src folder

- `features/`: business use-cases grouped by bounded context (e.g. `users`, `auth`, `properties`, `bookings`).
  - Contains controllers, services/use-cases, DTOs, feature-specific guards/interceptors, and feature module wiring.
- `core/`: app-wide technical modules that are used across many features (database, cache, logger, queue, health).
  - Prefer `@Global()` modules here (carefully) and keep their public API narrow.
- `infrastructure/`: third-party integration adapters (email providers, S3/GCS/local storage, payment gateways).
  - Keep provider SDK usage here; expose clean interfaces to the rest of the app.
- `common/`: NestJS cross-cutting building blocks that can be reused anywhere (filters/guards/interceptors/pipes).
  - Avoid putting business logic here.
- `shared/`: framework-agnostic utilities and shared types/constants.
  - Keep it dependency-light; avoid importing NestJS in `shared/` if possible.
- `config/`: configuration loading, validation, and typed accessors.

### 2) Suggested per-feature structure

For each feature folder, keep a consistent layout:

```
src/features/<feature>/
├─ <feature>.module.ts
├─ controllers/
├─ services/            (or use-cases/)
├─ dto/
├─ entities/            (if not generated)
└─ repositories/        (interfaces here; infra implementations elsewhere)
```

Rule of thumb: if something changes mainly because a *feature* changes, it belongs in that feature folder.

### 3) Configuration approach (typed + validated)

Suggested approach for `src/config/`:

- Use a single `ConfigModule` that:
  - loads config sources (env files + process env),
  - validates them (Zod/Joi/class-validator),
  - exposes typed getters (via `ConfigService` wrapper or typed config tokens).
- Keep config definitions split by concern (app/db/queue/etc), but wire them through one module.

If you want Nest’s standard approach, consider adding `@nestjs/config` and centralizing all `registerAs(...)` definitions.

### 4) Prisma (only if you truly want it)

If Prisma is intended:

- Add dependencies (`prisma`, `@prisma/client`) and a `prisma/schema.prisma`.
- Put Prisma wiring under `src/core/database/` (e.g. `PrismaModule`, `PrismaService`).
- Keep DB access behind repository interfaces used by features.

If Prisma is not intended, consider renaming the repository/package to avoid confusion.

### 5) Testing conventions

- Keep unit tests beside the code: `src/**/__tests__/*.spec.ts` or `src/**/*.spec.ts`.
- Keep e2e tests under `test/` only.
- Keep fixtures/builders in `test/support/` (or `src/shared/test/` if reused).

## Suggested next steps (actionable)

1. Add minimal “module entry points” so the structure is real:
   - `src/config/config.module.ts` exporting a working module
   - `src/core/logger/logger.module.ts` (and similar for `database`, `cache`, etc.)
2. Wire `ConfigModule` into `AppModule` and use config for `app.listen(...)` (instead of raw `process.env` in `main.ts`).
3. Add per-folder `README.md` (at least for `core/`, `features/`, `infrastructure/`) explaining rules and examples.
4. Decide Prisma vs non-Prisma and align package name + dependencies.

## Notes about the current code

- `src/app.module.ts` currently imports nothing and contains only the default starter wiring.
- `src/main.ts` binds to `process.env.PORT ?? 3000` directly; that’s fine for a starter, but you’ll likely want centralized config/validation as the app grows.

## Addendum (new files detected in `src/`)

Since the first draft of this report, the following non-empty areas were added:

- `src/common/` now contains: base contracts, a generic CRUD controller/service, decorators, guards, exception filters, interceptors, and a custom pipe.
- `src/core/database/` now contains: Mongo (`src/core/database/mongo/mongodb.module.ts`), Redis (`src/core/database/redis/*`), and a placeholder `prisma/` directory.
- `src/core/queue/` now contains a BullMQ module/provider/constants and multiple processors.
- `src/shared/types/paginate.ts` now defines shared pagination types.

### Critical build blockers to fix first

These issues will prevent compilation or running the app as-is:

1. Missing dependencies in `package.json`
   - Code imports packages that are not installed, including:
     - `@nestjs/config` (used by `src/config/config.module.ts`, `src/config/config.service.ts`, `src/core/database/redis/redis.provider.ts`)
     - `@nestjs/jwt` (used by `src/common/guards/auth.guard.ts`)
     - `@nestjs/swagger` (used by `src/common/generic/generic.controller.ts`)
     - `mongoose` and `@nestjs/mongoose` (used by Mongo module, generic service/controller, pipes, processors)
     - `redis` (used by `src/core/database/redis/redis.provider.ts`)
     - `bullmq` and `@nestjs/bullmq` (used by `src/core/queue/*`)
2. Broken internal imports (path issues)
   - `src/common/generic/generic.controller.ts` imports `PaginateOptions` from `../../types/paginate` but the file exists at `src/shared/types/paginate.ts`.
   - `src/common/generic/generic.service.ts` and `src/common/base/base.entity.ts` have the same incorrect `../../types/paginate` import.
   - `src/core/database/mongo/mongodb.module.ts` imports `ConfigService` from `../config/config.service`, but the config service is currently at `src/config/config.service.ts`.
3. Incorrect NestJS import usage
   - `src/common/generic/generic.controller.ts` imports `ParseObjectIdPipe` from `@nestjs/common`, but it is your own pipe at `src/common/pipes/parse-object-id.pipe.ts`.
4. Orphaned / copied processor code
   - `src/core/queue/processors/notification.processor.ts` references paths that don’t exist in this repo (e.g. `../../modules/...`), so it cannot compile until those modules/schemas/gateways are added or the processor is removed/replaced.
5. Type error in `src/common/filters/mongoose-exception.filter.ts`
   - The file uses `Request` but does not import it; this will fail TypeScript compilation.

### Quality / consistency notes (non-blocking, but important)

- Several files contain mojibake characters in comments/logs (e.g. `ðŸ“š`, `âœ…`), which usually means an encoding/copy-paste issue. It doesn’t break runtime, but it makes the codebase look corrupted and hard to read.
- Some “industry standard” comments are very long; consider replacing them with short docstrings + linking to a `docs/` guideline.
- `src/config/config.module.ts` validation checks treat env values as numbers, but environment variables start as strings; prefer parsing/coercion explicitly (or use a schema validator).

### Recommended next steps (to make it runnable)

1. Decide your data stack (Mongo/Mongoose vs Prisma vs both) and align:
   - Remove unused folders, or add the missing dependencies and wiring.
2. Make the app compile:
   - Fix the internal import paths listed above.
   - Add required dependencies (or remove the code that needs them).
3. Wire modules in `src/app.module.ts`:
   - Import `src/config/config.module.ts`
   - Import the DB module(s) and queue module(s) you actually use
4. Add a minimal “health” endpoint in `src/app.controller.ts` that proves DB/Redis connectivity (optional, but helpful).
