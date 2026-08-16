import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class GoogleCallbackDto {
  @ApiProperty({
    description: 'One-time authorization code Google put in the ?code= query of the callback page',
    example: '4/0AeanS0b7xVQ...',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  code!: string;

  @ApiPropertyOptional({
    description:
      'The ?state= value Google echoed back. Optional for now, but verified when present — send it.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  state?: string;
}
