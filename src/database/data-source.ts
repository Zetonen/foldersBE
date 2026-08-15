import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './database.options';

loadEnv();

const url = process.env.DIRECT_URL;

if (!url) {
  throw new Error('DIRECT_URL is required to run migrations (Supabase direct connection, port 5432)');
}

export const dataSourceOptions = buildDataSourceOptions({
  url,
  rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true',
  logging: true,
  mode: 'migration',
});

export default new DataSource(dataSourceOptions);
