/**
 * Ferio Marketplace — SQL migration applier
 *
 * Applies idempotent SQL files from prisma/marketplace/sql/ to the
 * marketplace database, tracked in `_ferio_sql_migrations`.
 *
 * Prisma Migrate cannot manage PostGIS DDL (generated geometry
 * columns, GiST indexes), so these live as versioned SQL files and
 * are applied by this script. Files are applied in lexical order and
 * recorded by filename; already-applied files are skipped.
 *
 * Usage:
 *   pnpm prisma:marketplace:sql
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

const SQL_DIR = join(__dirname, '..', 'marketplace', 'sql');

async function main() {
  const databaseUrl = process.env.MARKETPLACE_DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ MARKETPLACE_DATABASE_URL is not set');
    process.exit(1);
  }

  const files = readdirSync(SQL_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No SQL migrations found.');
    return;
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _ferio_sql_migrations (
        name        TEXT PRIMARY KEY,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const { rows } = await client.query<{ name: string }>(
      'SELECT name FROM _ferio_sql_migrations',
    );
    const applied = new Set(rows.map((r) => r.name));

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`⏭️  ${file} (already applied)`);
        continue;
      }

      const sql = readFileSync(join(SQL_DIR, file), 'utf8');
      const client2 = client;
      await client2.query('BEGIN');
      try {
        await client2.query(sql);
        await client2.query(
          'INSERT INTO _ferio_sql_migrations (name) VALUES ($1)',
          [file],
        );
        await client2.query('COMMIT');
        console.log(`✅ Applied ${file}`);
      } catch (err) {
        await client2.query('ROLLBACK');
        throw err;
      }
    }

    console.log('🏁 Marketplace SQL migrations up to date.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('❌ SQL migration failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
