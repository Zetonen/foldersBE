import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok', enum: ['ok', 'error'] })
  status!: 'ok' | 'error';

  @ApiProperty({ example: 'up', enum: ['up', 'down'] })
  database!: 'up' | 'down';

  @ApiProperty({ example: 12, description: 'Database round-trip time in milliseconds' })
  latencyMs!: number;

  @ApiProperty({ example: '2026-08-15T12:00:00.000Z' })
  timestamp!: string;

  @ApiProperty({ required: false, example: 'connection terminated unexpectedly' })
  error?: string;
}
