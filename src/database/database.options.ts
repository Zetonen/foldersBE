import { DataSourceOptions } from 'typeorm';

export type ConnectionMode = 'runtime' | 'migration';

export interface BuildOptionsInput {
  url: string;
  rejectUnauthorized: boolean;
  logging: boolean;
  mode: ConnectionMode;
}

export function buildDataSourceOptions(input: BuildOptionsInput): DataSourceOptions {
  const { url, rejectUnauthorized, logging, mode } = input;

  return {
    type: 'postgres',
    url,
    ssl: { rejectUnauthorized },
    synchronize: false,
    logging,
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/migrations/*{.ts,.js}'],
    migrationsTableName: 'migrations',
    migrationsRun: false,
    poolSize: mode === 'runtime' ? 10 : 1,
    extra: {
      max: mode === 'runtime' ? 10 : 1,
      statement_timeout: 30_000,
      ...(mode === 'runtime' ? { prepare: false } : {}),
    },
  };
}
