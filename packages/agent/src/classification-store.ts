import fs from "fs";
import path from "path";
import type { ComponentClassification } from "@ds-validation/core";

const CLASSIFICATION_DIR = ".ds-validation";

function getClassificationPath(fileKey: string): string {
  const fileName = `${fileKey}-classifications.json`;
  return path.join(process.cwd(), CLASSIFICATION_DIR, fileName);
}

export function loadClassifications(fileKey: string): Record<string, ComponentClassification> {
  const filePath = getClassificationPath(fileKey);
  try {
    if (!fs.existsSync(filePath)) {
      return {};
    }
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return parsed.decisions ?? {};
  } catch {
    return {};
  }
}

export function saveClassifications(
  fileKey: string,
  decisions: Record<string, ComponentClassification>,
): void {
  const dirPath = path.join(process.cwd(), CLASSIFICATION_DIR);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  const filePath = getClassificationPath(fileKey);
  const data = {
    fileKey,
    decisions,
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}
