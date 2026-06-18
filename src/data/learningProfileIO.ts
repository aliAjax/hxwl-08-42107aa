import {
  LearningProfile,
  BlindTastingRecord,
  QuizResultRecord,
  ReviewPlanRecord,
  ConfusionItem,
  ImportSummary,
  ImportMode,
  ImportPreview,
  PROFILE_SCHEMA_VERSION,
} from "./learningProfileTypes";
import {
  exportAllData as unifiedExport,
  parseImportPreview as unifiedParsePreview,
  applyImportPreview as unifiedApplyPreview,
  formatImportSummary as unifiedFormatSummary,
  importData as unifiedImport,
} from "./unifiedStore";

export async function exportProfile(): Promise<string> {
  return unifiedExport();
}

export async function parseImportPreview(
  jsonString: string,
  duplicateMode: ImportMode = "merge"
): Promise<ImportPreview> {
  return unifiedParsePreview(jsonString, duplicateMode);
}

export async function applyImportPreview(
  preview: ImportPreview
): Promise<ImportSummary> {
  return unifiedApplyPreview(preview);
}

export async function importProfile(
  jsonString: string,
  duplicateMode: ImportMode = "merge"
): Promise<ImportSummary> {
  return unifiedImport(jsonString, duplicateMode);
}

export function formatImportSummary(summary: ImportSummary): string {
  return unifiedFormatSummary(summary);
}
