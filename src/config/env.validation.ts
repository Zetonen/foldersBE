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
