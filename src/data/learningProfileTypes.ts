export const PROFILE_SCHEMA_VERSION = 1;

export interface BlindTastingRecord {
  id: string;
  wineName: string;
  region: string;
  grape: string;
  userRegionAnswer: string;
  userGrapeAnswer: string;
  correctRegion: boolean;
  correctGrape: boolean;
  mistakeType: "region" | "grape" | "both" | "none";
  aromas: string[];
  timeSpentMs: number;
  createdAt: number;
}

export interface QuizResultRecord {
  id: string;
  sessionId: string;
  totalQuestions: number;
  correctCount: number;
  accuracy: number;
  avgTimeMs: number;
  mistakeTypes: { region: number; grape: number; both: number };
  createdAt: number;
}

export interface ReviewPlanRecord {
  id: string;
  wineName: string;
  grape: string;
  scheduledDate: string;
  stage: "today" | "three-days" | "one-week";
  completed: boolean;
  completedAt: number | null;
  createdAt: number;
}

export interface ConfusionItem {
  id: string;
  wineA: { region: string; grape: string };
  wineB: { region: string; grape: string };
  confusionCount: number;
  lastConfusionTime: number | null;
  similarities: string[];
  createdAt: number;
}

export interface LearningProfile {
  schemaVersion: number;
  exportedAt: number;
  deviceInfo: string;
  blindTastingRecords: BlindTastingRecord[];
  quizResults: QuizResultRecord[];
  reviewPlans: ReviewPlanRecord[];
  confusionItems: ConfusionItem[];
}

export interface ImportSummary {
  totalRecordsInFile: number;
  blindTastingImported: number;
  blindTastingDuplicates: number;
  blindTastingInvalid: number;
  quizResultsImported: number;
  quizResultsDuplicates: number;
  quizResultsInvalid: number;
  reviewPlansImported: number;
  reviewPlansDuplicates: number;
  reviewPlansInvalid: number;
  confusionItemsImported: number;
  confusionItemsDuplicates: number;
  confusionItemsInvalid: number;
  migratedFields: string[];
  rollbackAvailable: boolean;
  duplicateMode: ImportMode;
}

export interface RollbackSnapshot {
  id: string;
  createdAt: number;
  blindTastingRecords: BlindTastingRecord[];
  quizResults: QuizResultRecord[];
  reviewPlans: ReviewPlanRecord[];
  confusionItems: ConfusionItem[];
}

export type ImportMode = "skip" | "overwrite" | "merge";

export interface ImportOptions {
  mode: ImportMode;
  handleDuplicates: ImportMode;
}

export interface RecordCategoryPreview<T> {
  totalInFile: number;
  toAdd: T[];
  duplicateIds: string[];
  invalidCount: number;
}

export interface ImportPreview {
  duplicateMode: ImportMode;
  totalRecordsInFile: number;
  blindTasting: RecordCategoryPreview<BlindTastingRecord>;
  quizResults: RecordCategoryPreview<QuizResultRecord>;
  reviewPlans: RecordCategoryPreview<ReviewPlanRecord>;
  confusionItems: RecordCategoryPreview<ConfusionItem>;
  migratedFields: string[];
}
