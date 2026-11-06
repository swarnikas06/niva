import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import * as fs from 'fs';
import * as path from 'path';

export const DRIZZLE_DB = 'DRIZZLE_DB';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool!: Pool;
  public db!: NodePgDatabase<typeof schema>;

  constructor(private readonly configService: ConfigService) {
    const databaseUrl = this.configService.get<string>('DATABASE_URL');
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    this.pool = new Pool({
      connectionString: databaseUrl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    this.db = drizzle(this.pool, { schema });
    this.logger.log('Database connection pool established');
  }

  async onModuleInit() {
    // Run pending migrations
    await this.runMigrations();
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
      this.logger.log('Database connection pool closed');
    }
  }

  getPool(): Pool {
    return this.pool;
  }

  getDb(): NodePgDatabase<typeof schema> {
    return this.db;
  }

  private async runMigrations(): Promise<void> {
    const client = await this.pool.connect();
    try {
      // 1. Create migrations tracking table if not exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS _niva_migrations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      // 2. Discover migration files
      // Check in __dirname/migrations, dist/database/migrations, and src/database/migrations
      let migrationsDir = path.resolve(__dirname, 'migrations');
      if (!fs.existsSync(migrationsDir)) {
        const distFallback = path.resolve(process.cwd(), 'dist', 'database', 'migrations');
        const srcFallback = path.resolve(process.cwd(), 'src', 'database', 'migrations');
        if (fs.existsSync(distFallback)) {
          migrationsDir = distFallback;
        } else if (fs.existsSync(srcFallback)) {
          migrationsDir = srcFallback;
        } else {
          this.logger.warn(
            `Migrations directory not found at: ${migrationsDir} (also checked ${distFallback} and ${srcFallback})`,
          );
          return;
        }
      }

      const files = fs
        .readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.sql'))
        .sort();

      for (const file of files) {
        const checkRes = await client.query(
          'SELECT 1 FROM _niva_migrations WHERE name = $1',
          [file],
        );
        if (checkRes.rowCount && checkRes.rowCount > 0) {
          continue; // Already applied
        }

        this.logger.log(`Applying migration: ${file}...`);
        const filePath = path.join(migrationsDir, file);
        const sqlContent = fs.readFileSync(filePath, 'utf8');

        await client.query('BEGIN');
        try {
          await client.query(sqlContent);
          await client.query(
            'INSERT INTO _niva_migrations (name) VALUES ($1)',
            [file],
          );
          await client.query('COMMIT');
          this.logger.log(`Successfully applied migration: ${file}`);
        } catch (err) {
          await client.query('ROLLBACK');
          this.logger.error(`Failed to apply migration ${file}:`, err);
          throw err;
        }
      }
    } finally {
      client.release();
    }
  }
}
