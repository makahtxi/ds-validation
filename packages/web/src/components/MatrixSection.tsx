"use client";

import { useState, useMemo } from "react";
import { bucketForScore, statusForScore } from "@/lib/utils";
import { ScoreBar } from "./ScoreBar";

interface TooltipData {
  x: number;
  y: number;
  name: string;
  score: number;
  passed: number;
  total: number;
  page: string;
}

interface MatrixSectionProps {
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

export function MatrixSection({ audit, onPick }: MatrixSectionProps) {
  const [tt, setTt] = useState<TooltipData | null>(null);
  const [sortPages, setSortPages] = useState<"volume" | "health">("volume");

  const pages = useMemo(() => {
    const map = new Map<string, typeof audit.components>();
    for (const c of audit.components) {
      const key = c.pageName?.trim() || "Unpaged";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    const arr = Array.from(map.entries()).map(([name, comps]) => {
      const avg = Math.round(comps.reduce((a, b) => a + b.score, 0) / comps.length);
      return { name, comps: comps.slice().sort((a, b) => a.score - b.score), avg };
    });
    arr.sort((a, b) => (sortPages === "health" ? a.avg - b.avg : b.comps.length - a.comps.length));
    return arr;
  }, [audit.components, sortPages]);

  return (
    <>
      <div className="section-h">
        <h2>Component Matrix</h2>
        <span className="meta">
          {audit.components.length} components &middot; grouped by page
        </span>
      </div>
      <div className="matrix-card">
        <div className="matrix-toolbar">
          <div className="matrix-legend">
            <span>Health</span>
            <span className="scale">
              <span style={{ background: "var(--heat-0)" }} title="< 55" />
              <span style={{ background: "var(--heat-1)" }} title="55-69" />
              <span style={{ background: "var(--heat-2)" }} title="70-79" />
              <span style={{ background: "var(--heat-3)" }} title="80-89" />
              <span style={{ background: "var(--heat-4)" }} title=">= 90" />
            </span>
            <span>0 &rarr; 100</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className={`filter-btn${sortPages === "volume" ? " on" : ""}`}
              onClick={() => setSortPages("volume")}
              style={{ padding: "4px 8px" }}
            >
              Sort: Components
              
            </button>
            <button
              className={`filter-btn${sortPages === "health" ? " on" : ""}`}
              onClick={() => setSortPages("health")}
              style={{ padding: "4px 8px" }}
            >
              Sort:  Health
            </button>
          </div>
        </div>
        <div className="matrix-pages">
          {pages.map((p) => (
            <div key={p.name} className="matrix-page">
              <div className="label">
                <div className="name">{p.name}</div>
                <div className="sub">{p.comps.length} components</div>
              </div>
              <div className="matrix-cells">
                {p.comps.map((c) => {
                  const slug = fileSlugFor(c);
                  return (
                    <div
                      key={slug + c.name}
                      className="matrix-cell"
                      data-bucket={bucketForScore(c.score)}
                      onMouseEnter={(e) =>
                        setTt({
                          x: e.clientX,
                          y: e.clientY,
                          name: c.name,
                          score: c.score,
                          passed: c.passedChecks,
                          total: c.totalChecks,
                          page: p.name,
                        })
                      }
                      onMouseMove={(e) => setTt((t) => t && { ...t, x: e.clientX, y: e.clientY })}
                      onMouseLeave={() => setTt(null)}
                      onClick={() => onPick(slug)}
                    />
                  );
                })}
              </div>
              <div className="agg">
                <span className="score-mini">{p.avg}</span>
                <ScoreBar score={p.avg} width={48} />
              </div>
            </div>
          ))}
        </div>
        {tt && (
          <div className="tt" style={{ left: tt.x + 14, top: tt.y + 14 }}>
            <div className="tt-name">{tt.name}</div>
            <div className="tt-row">
              <span>Score</span>
              <span className="tt-score">{tt.score}</span>
            </div>
            <div className="tt-row">
              <span>Checks</span>
              <span>
                {tt.passed}/{tt.total} passed
              </span>
            </div>
            <div className="tt-row">
              <span>Page</span>
              <span>{tt.page.trim()}</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
