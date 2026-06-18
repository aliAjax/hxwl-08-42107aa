import {
  BlindTastingRecord,
  QuizResultRecord,
  ReviewPlanRecord,
  ConfusionItem,
  RollbackSnapshot,
} from "./learningProfileTypes";
import {
  generateId as unifiedGenerateId,
  getAllBlindTastings as unifiedGetAllBlind,
  addBlindTasting as unifiedAddBlind,
  putBlindTastings as unifiedPutBlind,
  getAllQuizResults as unifiedGetAllQuiz,
  addQuizResult as unifiedAddQuiz,
  putQuizResults as unifiedPutQuiz,
  getAllReviewPlans as unifiedGetAllReview,
  addReviewPlan as unifiedAddReview,
  putReviewPlans as unifiedPutReview,
  getAllConfusionItems as unifiedGetAllConfusion,
  addConfusionItem as unifiedAddConfusion,
  putConfusionItems as unifiedPutConfusion,
  takeSnapshot as unifiedTakeSnapshot,
  getAllSnapshots as unifiedGetAllSnapshots,
  executeRollback as unifiedExecuteRollback,
  deleteSnapshot as unifiedDeleteSnapshot,
  clearAllLearningData as unifiedClearAll,
} from "./unifiedStore";

export function generateId(): string {
  return unifiedGenerateId();
}

export async function getAllBlindTastingRecords(): Promise<BlindTastingRecord[]> {
  return unifiedGetAllBlind();
}

export async function addBlindTastingRecord(
  record: Omit<BlindTastingRecord, "id" | "createdAt">
): Promise<BlindTastingRecord> {
  return unifiedAddBlind(record);
}

export async function putBlindTastingRecords(
  records: BlindTastingRecord[]
): Promise<void> {
  return unifiedPutBlind(records);
}

export async function getAllQuizResults(): Promise<QuizResultRecord[]> {
  return unifiedGetAllQuiz();
}

export async function addQuizResult(
  record: Omit<QuizResultRecord, "id" | "createdAt">
): Promise<QuizResultRecord> {
  return unifiedAddQuiz(record);
}

export async function putQuizResults(
  records: QuizResultRecord[]
): Promise<void> {
  return unifiedPutQuiz(records);
}

export async function getAllReviewPlans(): Promise<ReviewPlanRecord[]> {
  return unifiedGetAllReview();
}

export async function addReviewPlan(
  record: Omit<ReviewPlanRecord, "id" | "createdAt">
): Promise<ReviewPlanRecord> {
  return unifiedAddReview(record);
}

export async function putReviewPlans(
  records: ReviewPlanRecord[]
): Promise<void> {
  return unifiedPutReview(records);
}

export async function getAllConfusionItems(): Promise<ConfusionItem[]> {
  return unifiedGetAllConfusion();
}

export async function addConfusionItem(
  record: Omit<ConfusionItem, "id" | "createdAt">
): Promise<ConfusionItem> {
  return unifiedAddConfusion(record);
}

export async function putConfusionItems(
  records: ConfusionItem[]
): Promise<void> {
  return unifiedPutConfusion(records);
}

export async function takeRollbackSnapshot(): Promise<RollbackSnapshot> {
  return unifiedTakeSnapshot();
}

export async function getAllRollbackSnapshots(): Promise<RollbackSnapshot[]> {
  return unifiedGetAllSnapshots();
}

export async function executeRollback(snapshotId: string): Promise<void> {
  return unifiedExecuteRollback(snapshotId);
}

export async function deleteRollbackSnapshot(
  snapshotId: string
): Promise<void> {
  return unifiedDeleteSnapshot(snapshotId);
}

export async function clearAllProfileData(): Promise<void> {
  return unifiedClearAll();
}
