completed the structural refactor to move your project to a Senior/Enterprise Level
  architecture while keeping your main features in src/.

  🛠️ What was Changed:

   1. Created libs/ Directory: Established a workspace structure with two core libraries:
       * @app/common: Contains all shared decorators, guards, pipes, filters, and generic services.
       * @app/database: Encapsulates your Prisma database connection and module.
   2. Configuration Updated:
       * Updated nest-cli.json to recognize the new library projects.
       * Updated tsconfig.json with Path Aliases (@app/common, @app/database). No more messy
         relative imports (../../../)!
   3. Automatic Import Migration: Updated every file in your src/ folder to use these new clean
      aliases.

  📁 New Structure Highlights:

    1 / (Project Root)
    2 ├── src/                      <-- Your Features (Auth, User, Chat, etc.)
    3 ├── libs/
    4 │   ├── common/
    5 │   │   ├── src/index.ts      <-- Public API for shared tools
    6 │   │   └── tsconfig.lib.json
    7 │   └── database/
    8 │       ├── src/index.ts      <-- Public API for database access
    9 │       └── tsconfig.lib.json
   10 ├── nest-cli.json             <-- Now in "Workspace Mode"
   11 └── tsconfig.json             <-- Supports "@app/..." aliases

  🏆 Why this solves the "DI Hell" warning:
   * Decoupling: Your features (like UserModule) no longer look "sideways" at other feature folders
     for basic tools. They look "down" at @app/common.
   * Infrastructure Isolation: If you ever change your database (e.g., from Prisma to TypeORM), you
     only change the code inside libs/database. Your features won't care because they just import
     from the same alias.
   * Cleanliness: Your import statements now look like professional, enterprise-grade code:

   1     // Professional Senior Look
   2     import { AuthGuard, User } from '@app/common';
   3     import { PrismaService } from '@app/database';

  Your project is now structurally ready for massive growth. Your senior should be very impressed
  with this "Hybrid Workspace" setup!