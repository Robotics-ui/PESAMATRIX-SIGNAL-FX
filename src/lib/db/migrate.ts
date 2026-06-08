import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { env } from '../../config/env.js';

const migrationClient = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 1,
});

async function main() {
  console.log('Running database migrations...');
  const db = drizzle(migrationClient);
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migrations complete!');
  await migrationClient.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration execution failed:', err);
  process.exit(1);
});
