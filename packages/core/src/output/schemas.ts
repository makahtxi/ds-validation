import { z } from "zod";

export const AuditResultSchema = z.object({
  meta: z.object({
    figmaFileKey: z.string(),
    figmaFileName: z.string(),
    auditedAt: z.string(),
    pagesAudited: z.array(z.string()),
    conformanceChecks: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        weight: z.number(),
      }),
    ),
  }),
  totalScore: z.number(),
  summary: z.object({
    template: z.string(),
    params: z.record(z.string(), z.union([z.string(), z.number()])),
  }),
  components: z.array(
    z.object({
      name: z.string(),
      score: z.number(),
      jsonPath: z.string(),
      passedChecks: z.number(),
      totalChecks: z.number(),
      pageName: z.string(),
    }),
  ),
});

export type AuditResult = z.infer<typeof AuditResultSchema>;

export const ComponentAuditResultSchema = z.object({
  componentName: z.string(),
  score: z.number(),
  checkResults: z.record(
    z.string(),
    z.object({
      checkId: z.string(),
      score: z.number(),
      status: z.enum(["pass", "partial", "fail"]),
      violations: z.array(
        z.object({
          nodePath: z.string(),
          property: z.string(),
          rawValue: z.string(),
          expected: z.string(),
          suggestedReplacement: z.string().optional(),
        }),
      ),
      summary: z.object({
        template: z.string(),
        params: z.record(z.string(), z.union([z.string(), z.number()])),
      }),
    }),
  ),
  pageName: z.string(),
});

export type ComponentAuditResult = z.infer<
  typeof ComponentAuditResultSchema
>;
