import { AromaCategory } from "./aromaData";
import { WineRecord } from "./wineRecordTypes";
import { QuizSource } from "./adaptiveReview";

export type TaskType = "new_learn" | "review" | "confusion_practice" | "aroma_mastery" | "region_coverage";

export type WeaknessDimension = "region" | "grape" | "aroma" | "both";

export type ForgettingStage = "new" | "learning" | "consolidating" | "mastered";

export interface ExplanationEvidence {
  type: "mistake_history" | "forgetting_curve" | "coverage_gap" | "confusion_link" | "weak_dimension";
  description: string;
  detail: string;
  relatedRecordIds?: string[];
  timestamp?: number;
}

export interface TaskExplanation {
  summary: string;
  evidences: ExplanationEvidence[];
}

export interface WeaknessReason {
  dimension: WeaknessDimension;
  dimensionName: string;
  errorRate: number;
  totalAttempts: number;
  mistakeCount: number;
  description: string;
  relatedWineIds: string[];
}

export interface CoverageGap {
  type: "region" | "grape" | "aroma_category";
  name: string;
  coverageRate: number;
  totalAvailable: number;
  practicedCount: number;
  description: string;
}

export interface PathTask {
  id: string;
  taskType: TaskType;
  wineId: string;
  source: QuizSource;
  wineName: string;
  region: string;
  grape: string;
  country: string;
  aromas: string[];
  scheduledDate: string;
  dayOffset: number;
  priorityScore: number;
  estimatedTimeMinutes: number;
  completed: boolean;
  completedAt: number | null;
  explanation: TaskExplanation;
  weaknessReasons: WeaknessReason[];
  forgettingStage: ForgettingStage;
  createdAt: number;
  lastReviewedAt: number | null;
}

export interface DailyStats {
  totalTasks: number;
  completedTasks: number;
  estimatedTotalMinutes: number;
  newLearnCount: number;
  reviewCount: number;
  confusionCount: number;
  aromaCount: number;
  regionCount: number;
  weaknessSummary: string[];
  coverageGaps: CoverageGap[];
}

export interface DailyPlan {
  dateKey: string;
  dayOffset: number;
  dayLabel: string;
  tasks: PathTask[];
  stats: DailyStats;
}

export interface LearningPath {
  id: string;
  generatedAt: number;
  startDate: string;
  endDate: string;
  days: DailyPlan[];
  overallStats: {
    totalTasks: number;
    totalEstimatedMinutes: number;
    weaknessDimensions: { dimension: WeaknessDimension; count: number }[];
    coverageGaps: CoverageGap[];
  };
  triggerSource: "initial" | "quiz_completed" | "profile_imported" | "records_changed" | "manual";
}

export interface PathGenerationOptions {
  daysAhead?: number;
  maxTasksPerDay?: number;
  includeTaskTypes?: TaskType[];
  prioritizeWeekends?: boolean;
}

export interface ForgettingCurvePoint {
  wineId: string;
  stage: ForgettingStage;
  retentionRate: number;
  daysSinceLastReview: number;
  optimalReviewInterval: number;
  nextRecommendedDays: number;
}
