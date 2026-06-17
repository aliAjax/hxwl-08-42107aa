import {
  BlindTastingRecord,
  QuizResultRecord,
  ReviewPlanRecord,
  ConfusionItem,
} from "./learningProfileTypes";
import { generateId } from "./learningProfileDB";
import { QuizSession, QuizAttemptDetail, ConfusionPair, MistakeType } from "./adaptiveReview";

export function quizSessionToQuizResult(session: QuizSession): QuizResultRecord {
  const totalQuestions = session.attempts.length;
  const correctCount = session.attempts.filter(
    (a) => a.mistakeType === "none"
  ).length;
  const totalTimeMs = session.attempts.reduce(
    (sum, a) => sum + a.timeSpentMs,
    0
  );
  const avgTimeMs = totalQuestions > 0 ? totalTimeMs / totalQuestions : 0;

  const mistakeTypes = { region: 0, grape: 0, both: 0 };
  for (const a of session.attempts) {
    if (a.mistakeType === "region") mistakeTypes.region++;
    else if (a.mistakeType === "grape") mistakeTypes.grape++;
    else if (a.mistakeType === "both") mistakeTypes.both++;
  }

  return {
    id: `qr_${session.id}`,
    sessionId: session.id,
    totalQuestions,
    correctCount,
    accuracy: totalQuestions > 0 ? correctCount / totalQuestions : 0,
    avgTimeMs,
    mistakeTypes,
    createdAt: session.endTime,
  };
}

export function quizAttemptToBlindTastingRecord(
  attempt: QuizAttemptDetail,
  sessionId: string,
  wineName: string,
  aromas: string[] = []
): BlindTastingRecord {
  const mistakeType: "region" | "grape" | "both" | "none" = attempt.mistakeType as MistakeType;

  return {
    id: `bt_${attempt.questionId}_${sessionId}`,
    wineName,
    region: attempt.correctRegion,
    grape: attempt.correctGrape,
    userRegionAnswer: attempt.userRegionAnswer,
    userGrapeAnswer: attempt.userGrapeAnswer,
    correctRegion: attempt.regionCorrect,
    correctGrape: attempt.grapeCorrect,
    mistakeType,
    aromas,
    timeSpentMs: attempt.timeSpentMs,
    createdAt: Date.now(),
  };
}

export function confusionPairToConfusionItem(pair: ConfusionPair): ConfusionItem {
  return {
    id: `ci_${pair.pairId}`,
    wineA: { region: pair.wineA.region, grape: pair.wineA.grape },
    wineB: { region: pair.wineB.region, grape: pair.wineB.grape },
    confusionCount: pair.mutualConfusionCount,
    lastConfusionTime: pair.lastConfusionTime,
    similarities: pair.similarities,
    createdAt: pair.lastConfusionTime || Date.now(),
  };
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

export function reviewTaskToReviewPlanRecord(task: ReviewTaskInput): ReviewPlanRecord {
  const scheduledDate = new Date(task.scheduledDate);
  const dateStr = `${scheduledDate.getFullYear()}-${String(scheduledDate.getMonth() + 1).padStart(2, "0")}-${String(scheduledDate.getDate()).padStart(2, "0")}`;

  return {
    id: `rp_${task.id}`,
    wineName: task.wineName,
    grape: task.grape,
    scheduledDate: dateStr,
    stage: task.stage,
    completed: task.completed,
    completedAt: task.completedAt ?? null,
    createdAt: task.createdAt ?? Date.now(),
  };
}
