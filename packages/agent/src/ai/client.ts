import { generateObject } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import type { AIClient, TokenClassificationResult, Violation, SummaryEntry } from "@ds-validation/core";

const TokenClassificationSchema = z.object({
  classification: z.enum(["semantic", "primitive", "wrong_category"]),
  category: z.string().optional(),
  suggestedReplacement: z.string().nullable(),
});

const BatchClassificationSchema = z.record(
  z.string(),
  TokenClassificationSchema,
);

export type AIProvider = "anthropic" | "openai";

export interface AIClientConfig {
  provider?: AIProvider;
  model?: string;
  apiKey?: string;
}

function createModel(config?: AIClientConfig) {
  const provider = config?.provider ?? "anthropic";

  if (provider === "openai") {
    const openai = createOpenAI({
      apiKey: config?.apiKey ?? process.env.OPENAI_API_KEY,
    });
    return openai(config?.model ?? "gpt-4o");
  }

  const anthropic = createAnthropic({
    apiKey: config?.apiKey ?? process.env.ANTHROPIC_API_KEY,
  });
  return anthropic(config?.model ?? "claude-sonnet-4-20250514");
}

export function createAIClient(config?: AIClientConfig): AIClient {
  const model = createModel(config);

  return {
    async classifyToken(
      tokenName: string,
      semanticTokenList: string[],
    ): Promise<TokenClassificationResult> {
      const result = await generateObject({
        model,
        schema: TokenClassificationSchema,
        prompt: `You are a design system token classifier. Given a token name and a list of all tokens from the same design system, classify the token.

Token to classify: "${tokenName}"

All tokens in the design system:
${semanticTokenList.map((t) => `- ${t}`).join("\n")}

Classification rules:
- "semantic" = a token that conveys meaning, purpose, or intent. This includes:
  * Tokens with semantic naming like "color-action-primary", "spacing-page-horizontal"
  * Named design system tokens with structured naming like "Spacing/spacing-1", "Color/red-500", "Typography/body-md"
  * Any token that has a meaningful name in the design system hierarchy — even if it maps to a raw value like a number or color
  * Tokens that are part of a naming/scale system (e.g., "spacing-1", "spacing-2", "gray-100", "gray-200")
- "primitive" = ONLY flag as primitive if the token name is clearly a raw/unnamed value with NO semantic context, such as bare hex colors or numbers with no naming structure
- "wrong_category" = semantic token but used outside its intended category

IMPORTANT: Be VERY conservative with "primitive" classification. Most named tokens in a design system are semantic. Default to "semantic" when uncertain.

If the token is primitive or wrong_category, suggest the best semantic replacement from the list above.
If the token is semantic and correctly used, set suggestedReplacement to null.`,
      });
      return result.object as TokenClassificationResult;
    },

    async classifyTokens(
      tokens: string[],
      semanticTokenList: string[],
    ): Promise<Record<string, TokenClassificationResult>> {
      const result = await generateObject({
        model,
        schema: BatchClassificationSchema,
        prompt: `You are a design system token classifier. Given a list of token names and ALL the tokens in the design system, classify each token.

Tokens to classify:
${tokens.map((t) => `- ${t}`).join("\n")}

All tokens in the design system:
${semanticTokenList.map((t) => `- ${t}`).join("\n")}

Classification rules:
- "semantic" = a token that conveys meaning, purpose, or intent. This includes:
  * Tokens with semantic naming like "color-action-primary", "spacing-page-horizontal"
  * Named design system tokens with structured naming like "Spacing/spacing-1", "Color/red-500", "Typography/body-md"
  * Any token that has a meaningful name in the design system hierarchy — even if it maps to a raw value like a number or color
  * Tokens that are part of a naming/scale system (e.g., "spacing-1", "spacing-2", "gray-100", "gray-200")
- "primitive" = ONLY flag as primitive if the token name is clearly a raw/unnamed value with NO semantic context, such as:
  * Bare hex colors or numbers with no naming structure (e.g., "#3B82F6", "4px", "16")
  * Generic unnamed values that lack any design system naming convention
- "wrong_category" = semantic token used outside its intended category (specify the correct category)

IMPORTANT: Be VERY conservative with "primitive" classification. Most named tokens in a design system are semantic, even if they hold raw values. Only classify as "primitive" if the token clearly has no semantic naming. Default to "semantic" when uncertain.

For each token, provide its classification and, if primitive or wrong_category, suggest the best semantic replacement from the list above. If correctly semantic, set suggestedReplacement to null.`,
      });
      return result.object as Record<string, TokenClassificationResult>;
    },

    async generatePrimitiveTokenSummary(
      violations: Violation[],
    ): Promise<SummaryEntry> {
      const primitiveCount = violations.filter(
        (v) => v.expected === "A semantic/component-level token",
      ).length;
      const wrongCategoryCount = violations.filter(
        (v) => v.expected === "A token in the correct category",
      ).length;

      if (primitiveCount > 0 && wrongCategoryCount > 0) {
        const examples = violations
          .slice(0, 3)
          .map((v) => `${v.rawValue} → ${v.suggestedReplacement ?? "?"}`)
          .join(", ");
        return {
          template: "primitive_tokens_found",
          params: {
            count: violations.length,
            examples: examples,
          },
        };
      }

      if (primitiveCount > 0) {
        const examples = violations
          .slice(0, 3)
          .map((v) => v.rawValue)
          .join(", ");
        return {
          template: "primitive_tokens_found",
          params: { count: primitiveCount, examples },
        };
      }

      if (wrongCategoryCount > 0) {
        const example = violations[0]
          ? `${violations[0].rawValue} used as ${violations[0].property}`
          : "";
        return {
          template: "wrong_category_usage_found",
          params: { count: wrongCategoryCount, example },
        };
      }

      return {
        template: "primitive_tokens_clean",
        params: {},
      };
    },
  };
}