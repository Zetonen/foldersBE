import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { buildDataSourceOptions } from './database.options';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): TypeOrmModuleOptions =>
        buildDataSourceOptions({
          url: config.getOrThrow<string>('DATABASE_URL'),
          rejectUnauthorized: config.get<boolean>('DATABASE_SSL_REJECT_UNAUTHORIZED') ?? false,
          logging: config.get<boolean>('DATABASE_LOGGING') ?? false,
          mode: 'runtime',
        }),
    }),
  ],
})
export class DatabaseModule {}
