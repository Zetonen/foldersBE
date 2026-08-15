export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');

export interface SignedUpload {
  url: string;
  token: string;
  storageKey: string;
}

export interface StoredObject {
  storageKey: string;
  sizeBytes: number | null;
  mimeType: string | null;
}

export interface StorageProvider {
  createUploadUrl(storageKey: string): Promise<SignedUpload>;

  createDownloadUrl(
    storageKey: string,
    ttlSeconds: number,
    downloadFileName?: string,
  ): Promise<string>;

  head(storageKey: string): Promise<StoredObject | null>;

  remove(storageKey: string): Promise<void>;
}
