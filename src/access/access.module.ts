import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AccessResolverService } from './access-resolver.service';
import { ACCESS_REPOSITORY } from './access.types';
import { ResourceAccessGuard } from './guards/resource-access.guard';
import { ShareAwareAuthGuard } from './guards/share-aware-auth.guard';
import { TypeormAccessRepository } from './typeorm-access.repository';

@Module({
  imports: [AuthModule],
  providers: [
    { provide: ACCESS_REPOSITORY, useClass: TypeormAccessRepository },
    AccessResolverService,
    ResourceAccessGuard,
    ShareAwareAuthGuard,
  ],
  exports: [AccessResolverService, ResourceAccessGuard, ShareAwareAuthGuard],
})
export class AccessModule {}
