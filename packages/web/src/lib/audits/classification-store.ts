import type {
  ClassificationStore,
  ComponentClassification,
} from "@ds-validation/core";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Postgres-backed {@link ClassificationStore} keyed by (user_id, file_key), so
 * re-audits of the same file reuse prior decisions.
 *
 * The engine's `ClassificationStore` interface is synchronous, but Postgres is
 * async. We bridge with **preload + buffered flush**: {@link create} preloads
 * the file's decisions, the sync `load()` returns that snapshot, `save()`
 * buffers, and {@link flush} (awaited after the run) upserts them.
 */
export class PostgresClassificationStore implements ClassificationStore {
  private buffer = new Map<string, Record<string, ComponentClassification>>();
  private dirty = new Set<string>();
  private loadHit = false;

  private constructor(
    private readonly userId: string,
    private readonly fileKey: string,
    private readonly snapshot: Record<string, ComponentClassification>,
  ) {}

  static async create(
    userId: string,
    fileKey: string,
  ): Promise<PostgresClassificationStore> {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("classifications")
      .select("decisions")
      .eq("user_id", userId)
      .eq("file_key", fileKey)
      .maybeSingle();

    const decisions =
      (data?.decisions as Record<string, ComponentClassification> | undefined) ??
      {};
    return new PostgresClassificationStore(userId, fileKey, decisions);
  }

  load(fileKey: string): Record<string, ComponentClassification> {
    this.loadHit = true;
    return fileKey === this.fileKey ? this.snapshot : {};
  }

  save(
    fileKey: string,
    decisions: Record<string, ComponentClassification>,
  ): void {
    this.buffer.set(fileKey, decisions);
    this.dirty.add(fileKey);
  }

  /** Persist any buffered decisions. No-op when nothing was saved. */
  async flush(): Promise<void> {
    if (this.dirty.size === 0) return;
    const supabase = createServiceClient();
    for (const fileKey of this.dirty) {
      await supabase.from("classifications").upsert(
        {
          user_id: this.userId,
          file_key: fileKey,
          decisions: this.buffer.get(fileKey) ?? {},
        },
        { onConflict: "user_id,file_key" },
      );
    }
    this.dirty.clear();
  }

  /** True if the engine queried preloaded decisions (used in reuse tests). */
  get loadWasHit(): boolean {
    return this.loadHit;
  }
}
