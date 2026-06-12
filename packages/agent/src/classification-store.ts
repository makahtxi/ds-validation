import fs from "fs";
import path from "path";
import type { ComponentClassification, ClassificationStore, ClassificationStoreData } from "@ds-validation/core";

const CLASSIFICATION_DIR = ".ds-validation";

export class FileClassificationStore implements ClassificationStore {
  private cwd: string;

  constructor(cwd?: string) {
    this.cwd = cwd ?? process.cwd();
  }

  private getPath(fileKey: string): string {
    const fileName = `${fileKey}-classifications.json`;
    return path.join(this.cwd, CLASSIFICATION_DIR, fileName);
  }

  load(fileKey: string): Record<string, ComponentClassification> {
    const filePath = this.getPath(fileKey);
    try {
      if (!fs.existsSync(filePath)) {
        return {};
      }
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw) as ClassificationStoreData;
      return parsed.decisions ?? {};
    } catch {
      return {};
    }
  }

  save(fileKey: string, decisions: Record<string, ComponentClassification>): void {
    const dirPath = path.join(this.cwd, CLASSIFICATION_DIR);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    const filePath = this.getPath(fileKey);
    const data: ClassificationStoreData = {
      fileKey,
      decisions,
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  }
}

/**
 * @deprecated Use FileClassificationStore instance instead. 
 * Kept for backward compatibility with CLI code that imports these directly.
 */
const defaultStore = new FileClassificationStore();

export function loadClassifications(fileKey: string): Record<string, ComponentClassification> {
  return defaultStore.load(fileKey);
}

export function saveClassifications(
  fileKey: string,
  decisions: Record<string, ComponentClassification>,
): void {
  defaultStore.save(fileKey, decisions);
}
