// Migration runner script - run with: node server/migrations/run-migration.js
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🚀 Starting migration: Adding year column to all tables...\n');

    const sqlPath = path.join(__dirname, 'add-year-column.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    await pool.query(sql);

    console.log('✅ Migration completed successfully!');
    console.log('\nChanges made:');
    console.log('  - Created app_settings table');
    console.log('  - Set active_year to 2025');
    console.log('  - Added year column to orders table');
    console.log('  - Added year column to quotations table');
    console.log('  - Added year column to property_engineering_orders table');
    console.log('  - Added year column to property_engineering_quotations table');
    console.log('  - Added year column to liability_orders table');
    console.log('  - Added year column to liability_quotations table');
    console.log('  - Created indexes for optimized year filtering');
    console.log('\n📅 All existing data is now tagged with year 2025.');
    console.log('📅 When you switch to 2026, new entries will be created with year 2026.');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigration().catch((err) => {
  console.error(err);
  process.exit(1);
});




