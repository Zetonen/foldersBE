import { ApiProperty } from '@nestjs/swagger';

export class GoogleAuthUrlDto {
  @ApiProperty({
    description: 'Redirect the browser here with window.location.assign(url)',
    example:
      'https://accounts.google.com/o/oauth2/v2/auth?client_id=...&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fcallback&response_type=code&scope=openid+email+profile&state=eyJhbGciOi...',
  })
  url!: string;

  @ApiProperty({
    description:
      'CSRF state, already embedded in the url. Google echoes it back to the callback page; pass it to POST /auth/google/callback so the server can verify the flow it started. Valid for 10 minutes.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  state!: string;
}
