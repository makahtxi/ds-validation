import type {
  FigmaNode,
  FigmaStyle,
  FigmaVariable,
  FigmaFileMeta,
  FigmaPageSummary,
  FigmaColor,
  FigmaVariableValue,
} from "@ds-validation/core";

export type VariableSource = "rest-api" | "mcp";

export interface McpConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
  figmaApiKey?: string;
}

interface FigmaRestFile {
  name: string;
  lastModified: string;
  thumbnailUrl?: string;
  document: FigmaRestNode;
  styles?: Record<string, FigmaRestStyle>;
}

interface FigmaRestNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaRestNode[];
  fills?: unknown[];
  strokes?: unknown[];
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  cornerRadius?: number;
  rectangleCornerRadii?: number[];
  itemSpacing?: number;
  styleId?: string;
  boundVariables?: Record<string, { id: string; type: string }>;
  componentPropertyDefinitions?: Record<string, unknown>;
  characters?: string;
  style?: unknown;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  layoutMode?: string;
  primaryAxisSizingMode?: string;
  counterAxisSizingMode?: string;
  effects?: unknown[];
  opacity?: number;
  visible?: boolean;
  locked?: boolean;
}

interface FigmaRestStyle {
  id: string;
  name: string;
  styleType: "FILL" | "TEXT" | "EFFECT" | "GRID";
  description?: string;
}

interface FigmaRestVariablesResponse {
  meta: {
    variableCollections: Record<
      string,
      {
        id: string;
        name: string;
        defaultModeId: string;
        modes: { modeId: string; name: string }[];
      }
    >;
    variables: Record<string, FigmaRestVariable>;
  };
}

interface FigmaRestVariable {
  id: string;
  name: string;
  variableCollectionId: string;
  resolvedType: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
  valuesByMode: Record<string, unknown>;
}

function mapNode(raw: FigmaRestNode): FigmaNode {
  return {
    id: raw.id,
    name: raw.name,
    type: raw.type,
    fills: raw.fills as FigmaNode["fills"],
    strokes: raw.strokes as FigmaNode["strokes"],
    paddingLeft: raw.paddingLeft,
    paddingRight: raw.paddingRight,
    paddingTop: raw.paddingTop,
    paddingBottom: raw.paddingBottom,
    cornerRadius: raw.cornerRadius,
    rectangleCornerRadii: raw.rectangleCornerRadii,
    itemSpacing: raw.itemSpacing,
    styleId: raw.styleId,
    boundVariables: raw.boundVariables as FigmaNode["boundVariables"],
    componentPropertyDefinitions: raw.componentPropertyDefinitions as FigmaNode["componentPropertyDefinitions"],
    children: raw.children?.map(mapNode),
    characters: raw.characters,
    style: raw.style as FigmaNode["style"],
    x: raw.x,
    y: raw.y,
    width: raw.width,
    height: raw.height,
    layoutMode: raw.layoutMode,
    primaryAxisSizingMode: raw.primaryAxisSizingMode,
    counterAxisSizingMode: raw.counterAxisSizingMode,
    effects: raw.effects as FigmaNode["effects"],
    opacity: raw.opacity,
    visible: raw.visible,
    locked: raw.locked,
  };
}

function mapVariableValue(raw: unknown): FigmaVariableValue {
  if (typeof raw === "number" || typeof raw === "string" || typeof raw === "boolean") {
    return raw;
  }
  if (typeof raw === "object" && raw !== null) {
    const obj = raw as Record<string, unknown>;
    if (obj.type === "VARIABLE_ALIAS" && typeof obj.id === "string") {
      return { type: "VARIABLE_ALIAS", id: obj.id as string };
    }
    if (typeof obj.r === "number" && typeof obj.g === "number" && typeof obj.b === "number") {
      const colorObj: FigmaColor = {
        r: obj.r as number,
        g: obj.g as number,
        b: obj.b as number,
        a: (obj.a as number) ?? 1,
      };
      return colorObj;
    }
  }
  return String(raw);
}

export class FigmaClient {
  private accessToken: string;
  private baseUrl = "https://api.figma.com/v1";

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async request<T>(endpoint: string): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const res = await fetch(url, {
      headers: { "X-Figma-Token": this.accessToken },
    });

    if (res.status === 429) {
      const retryAfter = res.headers.get("Retry-After");
      const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 60000;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      return this.request<T>(endpoint);
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Figma API error ${res.status}: ${body}`);
    }

    return res.json() as Promise<T>;
  }

  async getFileMeta(fileKey: string): Promise<FigmaFileMeta> {
    const data = await this.request<FigmaRestFile>(`/files/${fileKey}`);
    return {
      key: fileKey,
      name: data.name,
      lastModified: data.lastModified,
      thumbnailUrl: data.thumbnailUrl,
    };
  }

  async getFilePages(fileKey: string): Promise<FigmaPageSummary[]> {
    const data = await this.request<FigmaRestFile>(`/files/${fileKey}`);
    const pages: FigmaPageSummary[] = [];
    for (const page of data.document.children ?? []) {
      const componentCount = countComponents(page);
      pages.push({ id: page.id, name: page.name, componentCount });
    }
    return pages;
  }

  async getFileNodes(
    fileKey: string,
    nodeIds: string[],
  ): Promise<Record<string, FigmaNode>> {
    const ids = nodeIds.join(",");
    const data = await this.request<{
      nodes: Record<string, { document: FigmaRestNode }>;
    }>(`/files/${fileKey}/nodes?ids=${ids}`);

    const result: Record<string, FigmaNode> = {};
    for (const [id, node] of Object.entries(data.nodes)) {
      result[id] = mapNode(node.document);
    }
    return result;
  }

  async getFileStyles(
    fileKey: string,
  ): Promise<Record<string, FigmaStyle>> {
    const data = await this.request<FigmaRestFile>(`/files/${fileKey}`);
    const styles: Record<string, FigmaStyle> = {};
    for (const [id, style] of Object.entries(data.styles ?? {})) {
      styles[id] = {
        id: style.id,
        name: style.name,
        styleType: style.styleType,
        description: style.description,
      };
    }
    return styles;
  }

  async getFileVariables(
    fileKey: string,
  ): Promise<Record<string, FigmaVariable>> {
    const data = await this.request<FigmaRestVariablesResponse>(
      `/files/${fileKey}/variables/local`,
    );

    const variables: Record<string, FigmaVariable> = {};

    if (!data.meta || !data.meta.variables) {
      return {};
    }

    for (const [id, v] of Object.entries(data.meta.variables)) {
      const valuesByMode: Record<string, FigmaVariableValue> = {};
      if (v.valuesByMode) {
        for (const [modeId, rawValue] of Object.entries(v.valuesByMode)) {
          valuesByMode[modeId] = mapVariableValue(rawValue);
        }
      }

      variables[id] = {
        id: v.id,
        name: v.name,
        variableCollectionId: v.variableCollectionId,
        resolvedType: v.resolvedType,
        valuesByMode,
      };
    }

    return variables;
  }

  async getComponentNodes(
    fileKey: string,
    pageId: string,
  ): Promise<FigmaNode[]> {
    const nodes = await this.getFileNodes(fileKey, [pageId]);
    const pageNode = nodes[pageId];
    if (!pageNode) return [];

    const components: FigmaNode[] = [];
    findComponents(pageNode, components);
    return components;
  }

  async getComponentNodesWithData(
    fileKey: string,
    pageId: string,
  ): Promise<FigmaNode[]> {
    const nodes = await this.getFileNodes(fileKey, [pageId]);
    const pageNode = nodes[pageId];
    if (!pageNode) return [];

    const componentIds: string[] = [];
    collectComponentIds(pageNode, componentIds);

    if (componentIds.length === 0) return [];

    const detailedNodes = await this.getFileNodes(fileKey, componentIds);
    return Object.values(detailedNodes);
  }
}

function countComponents(node: FigmaRestNode): number {
  let count = 0;
  if (
    node.type === "COMPONENT" ||
    node.type === "COMPONENT_SET" ||
    node.type === "INSTANCE"
  ) {
    count = 1;
  }
  for (const child of node.children ?? []) {
    count += countComponents(child);
  }
  return count;
}

function findComponents(node: FigmaNode, result: FigmaNode[]): void {
  if (
    node.type === "COMPONENT" ||
    node.type === "COMPONENT_SET" ||
    node.type === "INSTANCE"
  ) {
    result.push(node);
    return;
  }
  for (const child of node.children ?? []) {
    findComponents(child, result);
  }
}

function collectComponentIds(node: FigmaNode, ids: string[]): void {
  if (
    node.type === "COMPONENT" ||
    node.type === "COMPONENT_SET" ||
    node.type === "INSTANCE"
  ) {
    ids.push(node.id);
    return;
  }
  for (const child of node.children ?? []) {
    collectComponentIds(child, ids);
  }
}