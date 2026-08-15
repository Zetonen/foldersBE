import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'anna@example.com' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: 'correct-horse-battery' })
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password!: string;
}
