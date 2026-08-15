import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true' || value === '1';
  }
  return value;
};

export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  @IsOptional()
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @Transform(({ value }) => (value === undefined ? 3001 : Number(value)))
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3001;

  @IsString()
  FRONTEND_URL!: string;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  DIRECT_URL!: string;

  @Transform(toBoolean)
  @IsBoolean()
  @IsOptional()
  DATABASE_SSL_REJECT_UNAUTHORIZED: boolean = false;

  @Transform(toBoolean)
  @IsBoolean()
  @IsOptional()
  DATABASE_LOGGING: boolean = false;

  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @MinLength(32)
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @Matches(/^\d+[smhd]?$/)
  @IsOptional()
  JWT_ACCESS_TTL: string = '15m';

  @IsString()
  @Matches(/^\d+[smhd]?$/)
  @IsOptional()
  JWT_REFRESH_TTL: string = '7d';

  @IsString()
  SUPABASE_URL!: string;

  @IsString()
  SUPABASE_SERVICE_ROLE_KEY!: string;

  @IsString()
  SUPABASE_STORAGE_BUCKET!: string;

  @Transform(({ value }) => (value === undefined ? 104857600 : Number(value)))
  @IsInt()
  @Min(1)
  FILE_MAX_SIZE_BYTES: number = 104857600;

  @IsString()
  @IsOptional()
  FILE_ALLOWED_MIME_TYPES: string = 'application/pdf';

  @Transform(({ value }) => (value === undefined ? 900 : Number(value)))
  @IsInt()
  @Min(1)
  @Max(604800)
  FILE_DOWNLOAD_URL_TTL_SECONDS: number = 900;

  @Transform(({ value }) => (value === undefined ? 10 : Number(value)))
  @IsInt()
  @Min(1)
  AUTH_THROTTLE_LIMIT: number = 10;

  @Transform(({ value }) => (value === undefined ? 60 : Number(value)))
  @IsInt()
  @Min(1)
  AUTH_THROTTLE_TTL_SECONDS: number = 60;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: false,
    exposeDefaultValues: true,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
    whitelist: false,
  });

  if (errors.length > 0) {
    const details = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  return validated;
}
