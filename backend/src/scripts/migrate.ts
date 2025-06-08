// backend/src/scripts/migrate.ts
import fs from 'fs';
import path from 'path';
import { pool } from '../config/database';

interface Migration {
  id: number;
  name: string;
  executed_at: Date;
}

class MigrationRunner {
  private migrationsPath: string;

  constructor() {
    this.migrationsPath = path.join(__dirname, '../../migrations');
  }

  // Create migrations table if it doesn't exist
  private async createMigrationsTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    try {
      await pool.query(query);
      console.log('✅ Migrations table ready');
    } catch (error) {
      console.error('❌ Failed to create migrations table:', error);
      throw error;
    }
  }

  // Get executed migrations
  private async getExecutedMigrations(): Promise<string[]> {
    try {
      const result = await pool.query('SELECT name FROM migrations ORDER BY id');
      return result.rows.map(row => row.name);
    } catch (error) {
      console.error('❌ Failed to get executed migrations:', error);
      throw error;
    }
  }

  // Get available migration files
  private getAvailableMigrations(): string[] {
    try {
      if (!fs.existsSync(this.migrationsPath)) {
        console.warn('⚠️  Migrations directory not found, creating it...');
        fs.mkdirSync(this.migrationsPath, { recursive: true });
        return [];
      }

      return fs.readdirSync(this.migrationsPath)
        .filter(file => file.endsWith('.sql'))
        .sort();
    } catch (error) {
      console.error('❌ Failed to read migrations directory:', error);
      throw error;
    }
  }

  // Execute a single migration
  private async executeMigration(filename: string): Promise<void> {
    const filePath = path.join(this.migrationsPath, filename);
    
    try {
      const sql = fs.readFileSync(filePath, 'utf8');
      
      // Begin transaction
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');
        
        // Execute the migration SQL
        await client.query(sql);
        
        // Record the migration as executed
        await client.query(
          'INSERT INTO migrations (name) VALUES ($1)',
          [filename]
        );
        
        await client.query('COMMIT');
        console.log(`✅ Executed migration: ${filename}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error(`❌ Failed to execute migration ${filename}:`, error);
      throw error;
    }
  }

  // Run all pending migrations
  async runMigrations(): Promise<void> {
    try {
      console.log('🚀 Starting database migrations...');
      
      // Ensure migrations table exists
      await this.createMigrationsTable();
      
      // Get executed and available migrations
      const [executed, available] = await Promise.all([
        this.getExecutedMigrations(),
        this.getAvailableMigrations()
      ]);
      
      // Find pending migrations
      const pending = available.filter(migration => !executed.includes(migration));
      
      if (pending.length === 0) {
        console.log('✅ No pending migrations');
        return;
      }
      
      console.log(`📝 Found ${pending.length} pending migration(s):`);
      pending.forEach(migration => console.log(`   - ${migration}`));
      
      // Execute pending migrations
      for (const migration of pending) {
        await this.executeMigration(migration);
      }
      
      console.log('🎉 All migrations completed successfully!');
    } catch (error) {
      console.error('💥 Migration failed:', error);
      throw error;
    }
  }

  // Rollback last migration (basic implementation)
  async rollbackLastMigration(): Promise<void> {
    try {
      const result = await pool.query(
        'SELECT name FROM migrations ORDER BY id DESC LIMIT 1'
      );
      
      if (result.rows.length === 0) {
        console.log('📭 No migrations to rollback');
        return;
      }
      
      const lastMigration = result.rows[0].name;
      console.log(`⏪ Rolling back migration: ${lastMigration}`);
      
      // Remove from migrations table
      await pool.query('DELETE FROM migrations WHERE name = $1', [lastMigration]);
      
      console.log('⚠️  Migration record removed. Manual database cleanup may be required.');
    } catch (error) {
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }

  // Get migration status
  async getStatus(): Promise<void> {
    try {
      const [executed, available] = await Promise.all([
        this.getExecutedMigrations(),
        this.getAvailableMigrations()
      ]);
      
      const pending = available.filter(migration => !executed.includes(migration));
      
      console.log('\n📊 Migration Status:');
      console.log(`   Total migrations: ${available.length}`);
      console.log(`   Executed: ${executed.length}`);
      console.log(`   Pending: ${pending.length}`);
      
      if (executed.length > 0) {
        console.log('\n✅ Executed migrations:');
        executed.forEach(migration => console.log(`   - ${migration}`));
      }
      
      if (pending.length > 0) {
        console.log('\n⏳ Pending migrations:');
        pending.forEach(migration => console.log(`   - ${migration}`));
      }
    } catch (error) {
      console.error('❌ Failed to get migration status:', error);
      throw error;
    }
  }
}

// CLI functionality
async function main() {
  const runner = new MigrationRunner();
  const command = process.argv[2] || 'up';
  
  try {
    switch (command) {
      case 'up':
        await runner.runMigrations();
        break;
      case 'down':
        await runner.rollbackLastMigration();
        break;
      case 'status':
        await runner.getStatus();
        break;
      default:
        console.log('Usage: npm run migrate [up|down|status]');
        console.log('  up     - Run pending migrations (default)');
        console.log('  down   - Rollback last migration');
        console.log('  status - Show migration status');
        process.exit(1);
    }
  } catch (error) {
    console.error('💥 Migration script failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { MigrationRunner };