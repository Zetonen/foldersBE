import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageClient } from '@supabase/storage-js';
import { SignedUpload, StorageProvider, StoredObject } from './storage.interface';

interface ListedObject {
  name: string;
  metadata?: { size?: number; mimetype?: string } | null;
}

@Injectable()
export class SupabaseStorageService implements StorageProvider {
  private readonly logger = new Logger(SupabaseStorageService.name);
  private readonly client: StorageClient;
  private readonly bucket: string;

  constructor(configService: ConfigService) {
    const serviceRoleKey = configService.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');

    this.client = new StorageClient(
      `${configService.getOrThrow<string>('SUPABASE_URL').replace(/\/$/, '')}/storage/v1`,
      { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
    );
    this.bucket = configService.getOrThrow<string>('SUPABASE_STORAGE_BUCKET');
  }

  async createUploadUrl(storageKey: string): Promise<SignedUpload> {
    const { data, error } = await this.client.from(this.bucket).createSignedUploadUrl(storageKey);

    if (error || !data) {
      throw new InternalServerErrorException(`Storage upload URL failed: ${error?.message}`);
    }

    return { url: data.signedUrl, token: data.token, storageKey };
  }

  async createDownloadUrl(
    storageKey: string,
    ttlSeconds: number,
    downloadFileName?: string,
  ): Promise<string> {
    const { data, error } = await this.client
      .from(this.bucket)
      .createSignedUrl(
        storageKey,
        ttlSeconds,
        downloadFileName ? { download: downloadFileName } : undefined,
      );

    if (error || !data) {
      if (this.isMissingObject(error)) {
        throw new NotFoundException('File is no longer available in storage');
      }

      throw new InternalServerErrorException(`Storage download URL failed: ${error?.message}`);
    }

    return data.signedUrl;
  }

  async head(storageKey: string): Promise<StoredObject | null> {
    const separator = storageKey.lastIndexOf('/');
    const prefix = separator === -1 ? '' : storageKey.slice(0, separator);
    const name = separator === -1 ? storageKey : storageKey.slice(separator + 1);

    const { data, error } = await this.client
      .from(this.bucket)
      .list(prefix, { limit: 1, search: name });

    if (error) {
      throw new InternalServerErrorException(`Storage lookup failed: ${error.message}`);
    }

    const found = (data as ListedObject[] | null)?.find((object) => object.name === name);

    if (!found) {
      return null;
    }

    return {
      storageKey,
      sizeBytes: found.metadata?.size ?? null,
      mimeType: found.metadata?.mimetype ?? null,
    };
  }

  private isMissingObject(error: { message?: string; statusCode?: string } | null): boolean {
    return (
      error?.statusCode === '404' || (error?.message ?? '').toLowerCase().includes('not found')
    );
  }

  async remove(storageKey: string): Promise<void> {
    const { error } = await this.client.from(this.bucket).remove([storageKey]);

    if (error) {
      this.logger.warn(`Failed to remove ${storageKey} from storage: ${error.message}`);
    }
  }
}
