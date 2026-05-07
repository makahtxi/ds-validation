import type { ConformanceCheck } from "@ds-validation/core";

class CheckRegistry {
  private checks: Map<string, ConformanceCheck> = new Map();

  register(check: ConformanceCheck): void {
    this.checks.set(check.id, check);
  }

  getAll(): ConformanceCheck[] {
    return Array.from(this.checks.values());
  }

  getById(id: string): ConformanceCheck | undefined {
    return this.checks.get(id);
  }
}

export const registry = new CheckRegistry();