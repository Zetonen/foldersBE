import { Module } from '@nestjs/common';
import { STORAGE_PROVIDER } from './storage.interface';
import { SupabaseStorageService } from './supabase-storage.service';

@Module({
  providers: [{ provide: STORAGE_PROVIDER, useClass: SupabaseStorageService }],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
