import dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure the pool with optimized settings for better performance
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  // Connection pool settings for faster performance
  max: 20,                    // Maximum number of connections in the pool
  min: 5,                     // Minimum number of connections to keep open
  idleTimeoutMillis: 30000,   // Close idle connections after 30 seconds
  connectionTimeoutMillis: 10000, // Timeout after 10 seconds when connecting
  ssl: {
    rejectUnauthorized: false  // Required for Supabase/cloud databases
  }
});

// Warm up the connection pool on startup
pool.on('connect', () => {
  console.log('Database connection established');
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

// Pre-warm the pool with initial connections
(async () => {
  try {
    const client = await pool.connect();
    console.log('Database pool warmed up successfully');
    client.release();
  } catch (err) {
    console.error('Failed to warm up database pool:', err);
  }
})();

export const db = drizzle(pool, { schema });