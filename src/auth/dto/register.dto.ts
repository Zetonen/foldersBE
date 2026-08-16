import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { trim, trimLower } from '../../common/validation/transforms';

export class RegisterDto {
  @ApiProperty({ example: 'anna@example.com', maxLength: 255 })
  @Transform(trimLower)
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: 'correct-horse-battery', minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @ApiProperty({ example: 'Anna Kovalenko', minLength: 1, maxLength: 120 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
}
