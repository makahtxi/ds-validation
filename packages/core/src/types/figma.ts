export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  fills?: FigmaPaint[];
  strokes?: FigmaPaint[];
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  itemSpacing?: number;
  styleId?: string;
  boundVariables?: Record<string, FigmaBoundVariable>;
  componentPropertyDefinitions?: Record<string, FigmaComponentPropertyDefinition>;
  children?: FigmaNode[];
  characters?: string;
  style?: FigmaTypeStyle;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  layoutMode?: string;
  primaryAxisSizingMode?: string;
  counterAxisSizingMode?: string;
  effects?: FigmaEffect[];
  opacity?: number;
  visible?: boolean;
  locked?: boolean;
}

export interface FigmaPaint {
  type: string;
  color?: FigmaColor;
  opacity?: number;
  visible?: boolean;
  styleId?: string;
  boundVariables?: Record<string, FigmaBoundVariable>;
}

export interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface FigmaBoundVariable {
  id: string;
  type: string;
}

export interface FigmaComponentPropertyDefinition {
  type: string;
  variantOptions?: string[];
  defaultValue?: string | boolean;
}

export interface FigmaTypeStyle {
  fontFamily?: string;
  fontWeight?: number;
  fontSize?: number;
  lineHeightPx?: number;
  lineHeightPercent?: number;
  lineHeightUnit?: string;
  letterSpacing?: number;
  textAlignHorizontal?: string;
  textAlignVertical?: string;
}

export interface FigmaEffect {
  type: string;
  radius?: number;
  color?: FigmaColor;
  offset?: { x: number; y: number };
  visible?: boolean;
}

export interface FigmaStyle {
  id: string;
  name: string;
  styleType: "FILL" | "TEXT" | "EFFECT" | "GRID";
  description?: string;
}

export interface FigmaVariable {
  id: string;
  name: string;
  variableCollectionId: string;
  resolvedType: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
  valuesByMode: Record<string, FigmaVariableValue>;
}

export type FigmaVariableValue =
  | { type: "VARIABLE_ALIAS"; id: string }
  | number
  | string
  | boolean
  | FigmaColor;

export interface FigmaFileMeta {
  key: string;
  name: string;
  lastModified: string;
  thumbnailUrl?: string;
}

export interface FigmaPageSummary {
  id: string;
  name: string;
  componentCount: number;
}