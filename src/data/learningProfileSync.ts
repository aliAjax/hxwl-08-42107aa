import { QuizSession, getAllSessions, ConfusionPair, QuizAttemptDetail, computeConfusionPairs } from "./adaptiveReview";
import { wineCards } from "./wineData";
import { WineRecord } from "./wineRecordTypes";
import {
  putBlindTastingRecords,
  putQuizResults,
  putReviewPlans,
  putConfusionItems,
  getAllBlindTastingRecords,
  getAllQuizResults,
  getAllReviewPlans,
  getAllConfusionItems,
} from "./learningProfileDB";
import {
  quizSessionToQuizResult,
  quizAttemptToBlindTastingRecord,
  confusionPairToConfusionItem,
  reviewTaskToReviewPlanRecord,
} from "./learningProfileAdapters";
import {
  BlindTastingRecord,
  QuizResultRecord,
  ReviewPlanRecord,
  ConfusionItem,
} from "./learningProfileTypes";

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
    const quizResult = quizSessionToQuizResult(session);
    await putQuizResults([quizResult]);

    const blindRecords: BlindTastingRecord[] = [];
    for (const attempt of session.attempts) {
      const wineInfo = getWineInfo(attempt.questionId, records);
      const record = quizAttemptToBlindTastingRecord(
        attempt,
        session.id,
        wineInfo.name,
        wineInfo.aromas
      );
      record.createdAt = session.endTime;
      blindRecords.push(record);
    }

    if (blindRecords.length > 0) {
      await putBlindTastingRecords(blindRecords);
    }
  } catch (err) {
    console.warn("Failed to sync quiz session to learning profile:", err);
  }
}

export async function syncAllSessionsToProfile(): Promise<{
  sessionsSynced: number;
  blindRecordsSynced: number;
}> {
  const sessions = getAllSessions();
  let blindCount = 0;

  for (const session of sessions) {
    const quizResult = quizSessionToQuizResult(session);
    await putQuizResults([quizResult]);

    const blindRecords: BlindTastingRecord[] = [];
    for (const attempt of session.attempts) {
      const wineInfo = getWineInfo(attempt.questionId);
      const record = quizAttemptToBlindTastingRecord(
        attempt,
        session.id,
        wineInfo.name,
        wineInfo.aromas
      );
      record.createdAt = session.endTime;
      blindRecords.push(record);
    }

    if (blindRecords.length > 0) {
      await putBlindTastingRecords(blindRecords);
      blindCount += blindRecords.length;
    }
  }

  return { sessionsSynced: sessions.length, blindRecordsSynced: blindCount };
}

export async function syncConfusionPairsToProfile(pairs: ConfusionPair[]): Promise<number> {
  try {
    const items = pairs.map((p) => confusionPairToConfusionItem(p));
    await putConfusionItems(items);
    return items.length;
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
    const records = tasks.map((t) => reviewTaskToReviewPlanRecord(t));
    await putReviewPlans(records);
    return records.length;
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
    getAllBlindTastingRecords(),
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

const MIGRATION_FLAG_KEY = "hxwl-08-profile-migrated";

export function hasMigratedProfile(): boolean {
  return localStorage.getItem(MIGRATION_FLAG_KEY) === "1";
}

export function setProfileMigrated(value: boolean = true): void {
  if (value) {
    localStorage.setItem(MIGRATION_FLAG_KEY, "1");
  } else {
    localStorage.removeItem(MIGRATION_FLAG_KEY);
  }
}

export interface MigrationResult {
  quizResults: number;
  blindTastingRecords: number;
  confusionItems: number;
  fromExisting: boolean;
}

export async function migrateExistingDataToProfile(
  records: WineRecord[] = [],
  force: boolean = false
): Promise<MigrationResult> {
  if (!force && hasMigratedProfile()) {
    return { quizResults: 0, blindTastingRecords: 0, confusionItems: 0, fromExisting: true };
  }

  const sessions = getAllSessions();
  let quizCount = 0;
  let blindCount = 0;

  for (const session of sessions) {
    const quizResult = quizSessionToQuizResult(session);
    await putQuizResults([quizResult]);
    quizCount++;

    const blindRecords: BlindTastingRecord[] = [];
    for (const attempt of session.attempts) {
      const wineInfo = getWineInfo(attempt.questionId);
      const record = quizAttemptToBlindTastingRecord(
        attempt,
        session.id,
        wineInfo.name,
        wineInfo.aromas
      );
      record.createdAt = session.endTime;
      blindRecords.push(record);
    }

    if (blindRecords.length > 0) {
      await putBlindTastingRecords(blindRecords);
      blindCount += blindRecords.length;
    }
  }

  const confusionPairs = computeConfusionPairs(records);
  const pairsWithCount = confusionPairs.filter((p) => p.mutualConfusionCount > 0);
  let confusionCount = 0;
  if (pairsWithCount.length > 0) {
    confusionCount = await syncConfusionPairsToProfile(pairsWithCount);
  }

  setProfileMigrated(true);

  return {
    quizResults: quizCount,
    blindTastingRecords: blindCount,
    confusionItems: confusionCount,
    fromExisting: false,
  };
}
