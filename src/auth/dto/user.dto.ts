import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../users/entities/user.entity';

export class UserDto {
  @ApiProperty({ format: 'uuid', example: '3f4a1c9e-1c7d-4c8f-9b0e-2f5b1a6d7c81' })
  id!: string;

  @ApiProperty({ example: 'anna@example.com' })
  email!: string;

  @ApiProperty({ example: 'Anna Kovalenko' })
  name!: string;

  @ApiProperty({ example: '2026-08-15T12:00:00.000Z' })
  createdAt!: Date;

  static fromEntity(user: User): UserDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    };
  }
}
