import { ApiProperty } from '@nestjs/swagger';
import { UserDto } from './user.dto';

export class AuthResponseDto {
  @ApiProperty({
    description: 'Access JWT, send as Authorization: Bearer <token>',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken!: string;

  @ApiProperty({ description: 'Access token lifetime in seconds', example: 900 })
  expiresIn!: number;

  @ApiProperty({ type: UserDto })
  user!: UserDto;
}
