import { Global, Module } from '@nestjs/common';
import { NameConflictService } from './services/name-conflict.service';

@Global()
@Module({
  providers: [NameConflictService],
  exports: [NameConflictService],
})
export class CommonModule {}
