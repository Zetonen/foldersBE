import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuthModule } from '../auth/auth.module';
import { FilesModule } from '../files/files.module';
import { FoldersModule } from '../folders/folders.module';
import { UsersModule } from '../users/users.module';
import { ShareAccessController } from './share-access.controller';
import { ShareViewService } from './share-view.service';
import { SharedWithMeController } from './shared-with-me.controller';
import { SharesController } from './shares.controller';
import { SharesService } from './shares.service';

@Module({
  imports: [AuthModule, AccessModule, UsersModule, FoldersModule, FilesModule],
  controllers: [SharesController, SharedWithMeController, ShareAccessController],
  providers: [SharesService, ShareViewService],
  exports: [SharesService],
})
export class SharesModule {}
