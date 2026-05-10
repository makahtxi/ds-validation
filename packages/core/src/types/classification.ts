export type ComponentClassification = "interactive" | "non-interactive" | "ambiguous";

export interface CheckComponentRules {
  interactive: string[];
  nonInteractive: string[];
}

export interface ClassificationDecision {
  componentName: string;
  checkId: string;
  classification: ComponentClassification;
}

export interface ClassificationStore {
  fileKey: string;
  decisions: Record<string, ComponentClassification>;
  updatedAt: string;
}

export interface ClassificationOverride {
  interactive?: string[];
  nonInteractive?: string[];
}
