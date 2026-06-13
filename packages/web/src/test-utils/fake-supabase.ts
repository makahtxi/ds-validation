/* eslint-disable @typescript-eslint/no-explicit-any */
// Minimal in-memory stand-in for a supabase-js client, covering just the
// query shapes used by the audit service. Not a general-purpose mock.

type Row = Record<string, any>;

interface Filter {
  col: string;
  op: "eq" | "in" | "lt" | "notNull";
  val: any;
}

let idCounter = 1;

class Query implements PromiseLike<{ data: any; error: any; count: number | null }> {
  private filters: Filter[] = [];
  private op: "select" | "update" | "insert" | "upsert" | "delete" = "select";
  private values: any;
  private conflict?: string;
  private selectAfter = false;
  private countExact = false;
  private headOnly = false;

  constructor(
    private tables: Record<string, Row[]>,
    private table: string,
  ) {}

  select(_cols?: string, opts?: { count?: "exact"; head?: boolean }) {
    if (this.op !== "select") this.selectAfter = true;
    if (opts?.count === "exact") this.countExact = true;
    if (opts?.head) this.headOnly = true;
    return this;
  }
  update(values: any) {
    this.op = "update";
    this.values = values;
    return this;
  }
  insert(values: any) {
    this.op = "insert";
    this.values = values;
    return this;
  }
  upsert(values: any, opts?: { onConflict?: string }) {
    this.op = "upsert";
    this.values = values;
    this.conflict = opts?.onConflict;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  eq(col: string, val: any) {
    this.filters.push({ col, op: "eq", val });
    return this;
  }
  in(col: string, val: any[]) {
    this.filters.push({ col, op: "in", val });
    return this;
  }
  lt(col: string, val: any) {
    this.filters.push({ col, op: "lt", val });
    return this;
  }
  not(col: string, _op: string, val: any) {
    if (val === null) this.filters.push({ col, op: "notNull", val: null });
    return this;
  }
  order() {
    return this;
  }
  limit() {
    return this;
  }
  maybeSingle() {
    return this.run("single");
  }
  single() {
    return this.run("single");
  }
  then<R1, R2>(
    onFulfilled?: ((v: { data: any; error: any; count: number | null }) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((reason: any) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.run("many").then(onFulfilled, onRejected);
  }

  private rows() {
    return this.tables[this.table] ?? (this.tables[this.table] = []);
  }
  private matches(row: Row) {
    return this.filters.every((f) => {
      const cell = row[f.col];
      if (f.op === "eq") return cell === f.val;
      if (f.op === "in") return f.val.includes(cell);
      if (f.op === "lt") return cell != null && cell < f.val;
      if (f.op === "notNull") return cell !== null && cell !== undefined;
      return true;
    });
  }

  private async run(mode: "single" | "many") {
    const all = this.rows();
    if (this.op === "select") {
      const matched = all.filter((r) => this.matches(r));
      if (this.countExact) {
        return { data: this.headOnly ? null : matched, error: null, count: matched.length };
      }
      if (mode === "single") return { data: matched[0] ?? null, error: null, count: null };
      return { data: matched, error: null, count: matched.length };
    }
    if (this.op === "update") {
      const updated: Row[] = [];
      for (const r of all) {
        if (this.matches(r)) {
          Object.assign(r, this.values);
          updated.push(r);
        }
      }
      const data = this.selectAfter
        ? mode === "single"
          ? (updated[0] ?? null)
          : updated
        : null;
      return { data, error: null, count: updated.length };
    }
    if (this.op === "insert") {
      const rows = Array.isArray(this.values) ? this.values : [this.values];
      const inserted = rows.map((r) => ({ id: r.id ?? `id-${idCounter++}`, ...r }));
      all.push(...inserted);
      const data = this.selectAfter
        ? mode === "single"
          ? inserted[0]
          : inserted
        : null;
      return { data, error: null, count: inserted.length };
    }
    if (this.op === "upsert") {
      const rows = Array.isArray(this.values) ? this.values : [this.values];
      const keys = (this.conflict ?? "id").split(",").map((s) => s.trim());
      for (const r of rows) {
        const existing = all.find((e) => keys.every((k) => e[k] === r[k]));
        if (existing) Object.assign(existing, r);
        else all.push({ id: r.id ?? `id-${idCounter++}`, ...r });
      }
      return { data: null, error: null, count: rows.length };
    }
    if (this.op === "delete") {
      const remaining = all.filter((r) => !this.matches(r));
      this.tables[this.table] = remaining;
      return { data: null, error: null, count: all.length - remaining.length };
    }
    return { data: null, error: null, count: null };
  }
}

export interface FakeSupabase {
  from(table: string): Query;
  __tables: Record<string, Row[]>;
}

export function createFakeSupabase(
  seed: Record<string, Row[]> = {},
): FakeSupabase {
  const tables: Record<string, Row[]> = {};
  for (const [k, v] of Object.entries(seed)) tables[k] = v.map((r) => ({ ...r }));
  return {
    __tables: tables,
    from(table: string) {
      return new Query(tables, table);
    },
  };
}
