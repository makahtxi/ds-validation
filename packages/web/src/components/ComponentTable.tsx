"use client";

import { useState, useMemo } from "react";
import { statusForScore } from "@/lib/utils";
import { ScoreBar } from "./ScoreBar";
import { CheckDots } from "./CheckDots";

interface ComponentTableProps {
  audit: {
    components: {
      name: string;
      score: number;
      passedChecks: number;
      totalChecks: number;
      pageName: string;
      jsonPath: string;
    }[];
  };
  onPick: (slug: string) => void;
}

function fileSlugFor(component: { jsonPath: string }): string {
  return component.jsonPath.replace(/^components\//, "").replace(/\.json$/, "");
}

type SortKey = "name" | "page" | "score" | "passed";
type FilterType = "all" | "pass" | "partial" | "fail";

export function ComponentTable({ audit, onPick }: ComponentTableProps) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "score", dir: "asc" });

  const filtered = useMemo(() => {
    let rows = audit.components;
    if (q) {
      const lq = q.toLowerCase();
      rows = rows.filter(
        (c) => c.name.toLowerCase().includes(lq) || (c.pageName || "").toLowerCase().includes(lq),
      );
    }
    if (filter !== "all") {
      rows = rows.filter((c) => statusForScore(c.score) === filter);
    }
    rows = rows.slice().sort((a, b) => {
      let av: string | number, bv: string | number;
      switch (sort.key) {
        case "name":
          av = a.name;
          bv = b.name;
          break;
        case "page":
          av = a.pageName || "";
          bv = b.pageName || "";
          break;
        case "passed":
          av = a.passedChecks;
          bv = b.passedChecks;
          break;
        default:
          av = a.score;
          bv = b.score;
      }
      if (av < bv) return sort.dir === "asc" ? -1 : 1;
      if (av > bv) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
    return rows;
  }, [audit.components, q, filter, sort]);

  function setSortKey(k: SortKey) {
    setSort((prev) =>
      prev.key === k
        ? { key: k, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key: k, dir: k === "name" || k === "page" ? "asc" : "asc" },
    );
  }

  const sortChev = (k: SortKey) => (sort.key === k ? (sort.dir === "asc" ? " \u2191" : " \u2193") : "");

  return (
    <>
      <div className="section-h">
        <h2>All Components</h2>
        <span className="meta">
          {filtered.length} of {audit.components.length}
        </span>
      </div>
      <div className="table-card">
        <div className="table-toolbar">
          <input
            placeholder="Filter by name or page\u2026"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {(["all", "pass", "partial", "fail"] as const).map((f) => (
            <button
              key={f}
              className={`filter-btn${filter === f ? " on" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All" : f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div style={{ maxHeight: 480, overflowY: "auto" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th onClick={() => setSortKey("name")} className={sort.key === "name" ? "sorted" : ""}>
                  Component{sortChev("name")}
                </th>
                <th onClick={() => setSortKey("page")} className={sort.key === "page" ? "sorted" : ""}>
                  Page{sortChev("page")}
                </th>
                <th
                  onClick={() => setSortKey("score")}
                  className={sort.key === "score" ? "sorted" : ""}
                  style={{ width: 200 }}
                >
                  Score{sortChev("score")}
                </th>
                <th
                  onClick={() => setSortKey("passed")}
                  className={sort.key === "passed" ? "sorted" : ""}
                  style={{ width: 120 }}
                >
                  Checks{sortChev("passed")}
                </th>
                <th style={{ width: 96 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-row">No components match.</div>
                  </td>
                </tr>
              )}
              {filtered.map((c) => {
                const slug = fileSlugFor(c);
                const status = statusForScore(c.score);
                return (
                  <tr
                    key={c.name + slug}
                    className="row clickable"
                    onClick={() => onPick(slug)}
                  >
                    <td className="name">{c.name}</td>
                    <td className="page-cell">{(c.pageName || "").trim()}</td>
                    <td className="score-cell">
                      <ScoreBar score={c.score} />
                      <span style={{ fontWeight: 600 }}>{c.score}</span>
                    </td>
                    <td className="score-cell">
                      <CheckDots component={c} />
                    </td>
                    <td>
                      <span
                        className="detail-check"
                        style={{
                          padding: "2px 8px",
                          display: "inline-block",
                          borderRadius: 999,
                          fontFamily: "var(--mono)",
                          fontSize: 10,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          border: "none",
                          background:
                            status === "pass"
                              ? "var(--pass-soft)"
                              : status === "partial"
                                ? "var(--partial-soft)"
                                : "var(--fail-soft)",
                          color:
                            status === "pass"
                              ? "var(--pass)"
                              : status === "partial"
                                ? "oklch(0.45 0.14 75)"
                                : "var(--fail)",
                        }}
                      >
                        {status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
