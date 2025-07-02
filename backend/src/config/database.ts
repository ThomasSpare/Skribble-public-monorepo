// backend/src/config/database.ts - FIXED VERSION
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Database configuration
const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  // Fallback for local development
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'password',
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432', 10),
  database: process.env.PGDATABASE || 'skribble',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
};

// Create the connection pool
export const pool = new Pool(dbConfig);

// Add connection event listeners for better debugging
pool.on('connect', (client) => {
  console.log('🔗 New database client connected');
});

pool.on('error', (err, client) => {
  console.error('❌ Unexpected database client error:', err);
});

pool.on('acquire', (client) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('📦 Database client acquired from pool');
  }
});

pool.on('release', (err, client) => {
  if (err) {
    console.error('❌ Error releasing database client:', err);
  } else if (process.env.NODE_ENV === 'development') {
    console.log('🔓 Database client released back to pool');
  }
});

// Initialize database connection
export const initializeDatabase = async (): Promise<void> => {
  try {
    // Test the connection
    const client = await pool.connect();
    console.log('✅ Database connected successfully');
    
    // Run a simple query to verify
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('📊 Database info:', {
      currentTime: result.rows[0].current_time,
      version: result.rows[0].pg_version.split(' ')[0] // Just show PostgreSQL version
    });
    
    client.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
};

// Graceful shutdown
export const closeDatabase = async (): Promise<void> => {
  try {
    await pool.end();
    console.log('🔌 Database connection closed');
  } catch (error) {
    console.error('❌ Error closing database connection:', error);
    throw error;
  }
};

// Query helper with error handling
export const query = async (text: string, params?: any[]): Promise<any> => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('📝 Query executed:', { 
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        duration: `${duration}ms`, 
        rows: result.rowCount 
      });
    }
    
    return result;
  } catch (error) {
    console.error('❌ Database query error:', {
      query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      params: params,
      error: error.message
    });
    throw error;
  }
};

// Transaction helper
export const withTransaction = async <T>(
  callback: (client: any) => Promise<T>
): Promise<T> => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    console.log('🔄 Transaction started');
    
    const result = await callback(client);
    
    await client.query('COMMIT');
    console.log('✅ Transaction committed');
    
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    console.log('🔄 Transaction rolled back due to error:', error.message);
    throw error;
  } finally {
    client.release();
  }
};

// Health check
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    const start = Date.now();
    await pool.query('SELECT 1');
    const duration = Date.now() - start;
    
    console.log('💚 Database health check passed', `(${duration}ms)`);
    return true;
  } catch (error) {
    console.error('💔 Database health check failed:', error);
    return false;
  }
};

// FIXED: Remove the circular import line and add proper default export
export default pool;