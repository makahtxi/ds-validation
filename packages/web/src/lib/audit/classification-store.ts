import type { ClassificationStore, ComponentClassification } from "@ds-validation/core";
import { createServiceClient } from "../supabase/service";

interface PgStoreOptions {
  userId: string;
  fileKey: string;
}

export class PostgresClassificationStore implements ClassificationStore {
  private userId: string;
  private fileKey: string;
  private cache: Record<string, ComponentClassification> | null = null;
  private dirty = false;

  constructor(options: PgStoreOptions) {
    this.userId = options.userId;
    this.fileKey = options.fileKey;
  }

  load(fileKey: string): Record<string, ComponentClassification> {
    if (fileKey !== this.fileKey) {
      return {};
    }
    if (this.cache !== null) {
      return this.cache;
    }
    return {};
  }

  setCache(data: Record<string, ComponentClassification>): void {
    this.cache = { ...data };
  }

  save(fileKey: string, decisions: Record<string, ComponentClassification>): void {
    if (fileKey !== this.fileKey) {
      return;
    }
    this.cache = { ...decisions };
    this.dirty = true;
  }

  get isDirty(): boolean {
    return this.dirty;
  }

  async flush(): Promise<void> {
    if (!this.dirty || !this.cache) return;

    const supabase = createServiceClient();

    const { error } = await supabase
      .from("classifications")
      .upsert(
        {
          user_id: this.userId,
          file_key: this.fileKey,
          decisions: this.cache,
        },
        { onConflict: "user_id,file_key" },
      );

    if (error) {
      console.error(`Failed to flush classifications for ${this.fileKey}:`, error);
    } else {
      this.dirty = false;
    }
  }
}