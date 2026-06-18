import { QuizSession, ConfusionPair, computeConfusionPairs } from "./adaptiveReview";
import { wineCards } from "./wineData";
import { WineRecord } from "./wineRecordTypes";
import {
  syncQuizSessionToStore as unifiedSyncQuizSession,
  syncConfusionPairsToStore as unifiedSyncConfusion,
  syncReviewTasksToStore as unifiedSyncReview,
  getAllBlindTastings,
  getAllQuizResults,
  getAllReviewPlans,
  getAllConfusionItems,
  getAllQuizSessions,
  hasMigratedProfile,
  migrateExistingDataToStore,
  MigrationResult,
} from "./unifiedStore";

const WINE_NAME_MAP = new Map<string, { name: string; aromas: string[] }>();

function initWineNameMap() {
  if (WINE_NAME_MAP.size > 0) return;
  for (const card of wineCards) {
    WINE_NAME_MAP.set(card.id, { name: card.region, aromas: card.aromas || [] });
  }
}

function getWineInfo(wineId: string, records: WineRecord[] = []): { name: string; aromas: string[] } {
  initWineNameMap();
  const record = records.find((r) => r.id === wineId);
  if (record) {
    return { name: record.name || record.region, aromas: record.aromas || [] };
  }
  return WINE_NAME_MAP.get(wineId) || { name: wineId, aromas: [] };
}

export async function syncQuizSessionToProfile(
  session: QuizSession,
  records: WineRecord[] = []
): Promise<void> {
  try {
    await unifiedSyncQuizSession(session, records);
  } catch (err) {
    console.warn("Failed to sync quiz session to learning profile:", err);
  }
}

export async function syncAllSessionsToProfile(): Promise<{
  sessionsSynced: number;
  blindRecordsSynced: number;
}> {
  const sessions = await getAllQuizSessions();
  let blindCount = 0;

  for (const session of sessions) {
    try {
      await unifiedSyncQuizSession(session);
      blindCount += session.attempts.length;
    } catch (err) {
      console.warn("Failed to sync session:", session.id, err);
    }
  }

  return { sessionsSynced: sessions.length, blindRecordsSynced: blindCount };
}

export async function syncConfusionPairsToProfile(pairs: ConfusionPair[]): Promise<number> {
  try {
    return await unifiedSyncConfusion(pairs);
  } catch (err) {
    console.warn("Failed to sync confusion pairs:", err);
    return 0;
  }
}

interface ReviewTaskInput {
  id: string;
  wineName: string;
  grape: string;
  stage: "today" | "three-days" | "one-week";
  scheduledDate: Date;
  completed: boolean;
  completedAt?: number | null;
  createdAt?: number;
}

export async function syncReviewTasksToProfile(tasks: ReviewTaskInput[]): Promise<number> {
  try {
    return await unifiedSyncReview(tasks);
  } catch (err) {
    console.warn("Failed to sync review tasks:", err);
    return 0;
  }
}

export interface ProfileSyncResult {
  quizResults: number;
  blindTastingRecords: number;
  reviewPlans: number;
  confusionItems: number;
}

export async function getProfileCounts(): Promise<ProfileSyncResult> {
  const [blind, quiz, review, confusion] = await Promise.all([
    getAllBlindTastings(),
    getAllQuizResults(),
    getAllReviewPlans(),
    getAllConfusionItems(),
  ]);
  return {
    quizResults: quiz.length,
    blindTastingRecords: blind.length,
    reviewPlans: review.length,
    confusionItems: confusion.length,
  };
}

export { hasMigratedProfile, migrateExistingDataToStore } from "./unifiedStore";
export type { MigrationResult } from "./unifiedStore";
