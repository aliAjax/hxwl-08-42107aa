import {
  ForgettingCurvePoint,
  ForgettingStage,
  WeaknessReason,
  WeaknessDimension,
  CoverageGap,
  ExplanationEvidence,
  TaskExplanation,
  PathTask,
  TaskType,
  LearningPath,
  DailyPlan,
  DailyStats,
  PathGenerationOptions,
} from "./learningPathTypes";
import { WineRecord } from "./wineRecordTypes";
import { WineCard, wineCards, wineComparisons } from "./wineData";
import { aromaKeywords, AromaCategory } from "./aromaData";
import {
  WineStats,
  computeWineStats,
  computeConfusionPairs,
  ConfusionPair,
  QuizSource,
  PrioritizedWine,
  prioritizeWines,
  QuizAttemptDetail,
  getAllSessions,
} from "./adaptiveReview";
import { matchRegionKey, REGION_GROUPS } from "./regionStats";
import { generateId } from "./unifiedStore";

const FORGETTING_PARAMS = {
  NEW_RETENTION: 1.0,
  LEARNING_RETENTION: 0.7,
  CONSOLIDATING_RETENTION: 0.4,
  MASTERED_RETENTION: 0.15,
  NEW_INTERVAL_DAYS: 1,
  LEARNING_INTERVAL_DAYS: 3,
  CONSOLIDATING_INTERVAL_DAYS: 7,
  MASTERED_INTERVAL_DAYS: 14,
  RETENTION_THRESHOLD_NEW: 0.9,
  RETENTION_THRESHOLD_LEARNING: 0.6,
  RETENTION_THRESHOLD_CONSOLIDATING: 0.3,
};

const ESTIMATED_TIME_PER_TASK = {
  new_learn: 8,
  review: 5,
  confusion_practice: 10,
  aroma_mastery: 7,
  region_coverage: 6,
};

function getTodayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function addDaysToKey(baseKey: string, days: number): string {
  const [y, m, d] = baseKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getDayLabel(dayOffset: number): string {
  if (dayOffset === 0) return "今天";
  if (dayOffset === 1) return "明天";
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  return weekdays[d.getDay()];
}

export function computeForgettingCurve(
  stats: WineStats,
  now: number = Date.now()
): ForgettingCurvePoint {
  const attempts = stats.totalAttempts;
  const accuracy = attempts > 0 ? stats.correctCount / attempts : 0;
  const lastAttempt = stats.lastAttemptTime;
  const daysSince = lastAttempt ? (now - lastAttempt) / (24 * 3600 * 1000) : 999;
  const streak = stats.recentStreak;

  let stage: ForgettingStage;
  let retentionRate: number;
  let optimalInterval: number;
  let nextRecommendedDays: number;

  if (attempts === 0) {
    stage = "new";
    retentionRate = 1.0;
    optimalInterval = FORGETTING_PARAMS.NEW_INTERVAL_DAYS;
    nextRecommendedDays = 0;
  } else if (attempts < 3 || accuracy < 0.5 || streak <= -1) {
    stage = "learning";
    const decay = Math.min(daysSince / 14, 1);
    retentionRate = FORGETTING_PARAMS.LEARNING_RETENTION * (1 - decay * 0.6);
    optimalInterval = FORGETTING_PARAMS.LEARNING_INTERVAL_DAYS;
    nextRecommendedDays = Math.max(0, Math.round(optimalInterval - daysSince));
  } else if (attempts < 6 || accuracy < 0.8 || streak < 3) {
    stage = "consolidating";
    const decay = Math.min(daysSince / 21, 1);
    retentionRate = FORGETTING_PARAMS.CONSOLIDATING_RETENTION * (1 - decay * 0.5);
    optimalInterval = FORGETTING_PARAMS.CONSOLIDATING_INTERVAL_DAYS;
    nextRecommendedDays = Math.max(0, Math.round(optimalInterval - daysSince));
  } else {
    stage = "mastered";
    const decay = Math.min(daysSince / 30, 1);
    retentionRate = FORGETTING_PARAMS.MASTERED_RETENTION * (1 - decay * 0.4);
    optimalInterval = FORGETTING_PARAMS.MASTERED_INTERVAL_DAYS;
    nextRecommendedDays = Math.max(0, Math.round(optimalInterval - daysSince));
  }

  return {
    wineId: stats.id,
    stage,
    retentionRate: Math.max(0, Math.min(1, retentionRate)),
    daysSinceLastReview: Math.round(daysSince),
    optimalReviewInterval: optimalInterval,
    nextRecommendedDays,
  };
}

export async function analyzeWeaknesses(
  records: WineRecord[]
): Promise<Map<string, WeaknessReason[]>> {
  const statsMap = await computeWineStats(records);
  const sessions = await getAllSessions();
  const allAttempts = sessions.flatMap((s) => s.attempts);

  const wineWeaknesses = new Map<string, WeaknessReason[]>();

  for (const [key, stats] of statsMap) {
    const id = stats.id;
    const weaknesses: WeaknessReason[] = [];
    const totalAttempts = stats.totalAttempts;

    if (totalAttempts === 0) continue;

    if (stats.bothErrorCount > 0) {
      const errorRate = stats.bothErrorCount / totalAttempts;
      weaknesses.push({
        dimension: "both",
        dimensionName: "产区+品种",
        errorRate: Math.round(errorRate * 100),
        totalAttempts,
        mistakeCount: stats.bothErrorCount,
        description: `共${stats.bothErrorCount}次完全答错，产区和品种识别均存在困难`,
        relatedWineIds: [id],
      });
    }

    if (stats.regionErrorCount > 0) {
      const errorRate = stats.regionErrorCount / totalAttempts;
      weaknesses.push({
        dimension: "region",
        dimensionName: "产区识别",
        errorRate: Math.round(errorRate * 100),
        totalAttempts,
        mistakeCount: stats.regionErrorCount,
        description: `共${stats.regionErrorCount}次产区判断错误，需加强产区特征记忆`,
        relatedWineIds: [id],
      });
    }

    if (stats.grapeErrorCount > 0) {
      const errorRate = stats.grapeErrorCount / totalAttempts;
      weaknesses.push({
        dimension: "grape",
        dimensionName: "品种识别",
        errorRate: Math.round(errorRate * 100),
        totalAttempts,
        mistakeCount: stats.grapeErrorCount,
        description: `共${stats.grapeErrorCount}次品种判断错误，需加强葡萄品种特征学习`,
        relatedWineIds: [id],
      });
    }

    const aromaMistakes = findAromaRelatedMistakes(stats, allAttempts);
    if (aromaMistakes.length > 0) {
      weaknesses.push({
        dimension: "aroma",
        dimensionName: "香气辨识",
        errorRate: Math.round((aromaMistakes.length / totalAttempts) * 100),
        totalAttempts,
        mistakeCount: aromaMistakes.length,
        description: `香气线索利用不足，相关错误${aromaMistakes.length}次`,
        relatedWineIds: [id],
      });
    }

    if (weaknesses.length > 0) {
      wineWeaknesses.set(key, weaknesses);
    }
  }

  return wineWeaknesses;
}

function findAromaRelatedMistakes(
  stats: WineStats,
  attempts: QuizAttemptDetail[]
): QuizAttemptDetail[] {
  return attempts.filter((a) => {
    if (a.mistakeType === "none") return false;
    if (a.questionId !== stats.id) return false;
    const correctAromas = stats.aromas || [];
    const userAromas = a.aromas || [];
    const overlap = correctAromas.filter((a) => userAromas.includes(a));
    return overlap.length < correctAromas.length * 0.5;
  });
}

export async function analyzeCoverageGaps(
  records: WineRecord[]
): Promise<CoverageGap[]> {
  const statsMap = await computeWineStats(records);
  const gaps: CoverageGap[] = [];

  const regionStats = new Map<string, { total: number; practiced: Set<string> }>();
  const grapeStats = new Map<string, { total: number; practiced: Set<string> }>();
  const aromaCategoryStats = new Map<string, { total: number; practiced: Set<string> }>();

  for (const card of wineCards) {
    const regionKey = matchRegionKey(card.region) || card.region;
    const group = REGION_GROUPS.find((g) => g.key === regionKey);
    const regionName = group?.name || card.region;

    if (!regionStats.has(regionName)) {
      regionStats.set(regionName, { total: 0, practiced: new Set() });
    }
    regionStats.get(regionName)!.total++;

    if (!grapeStats.has(card.grape)) {
      grapeStats.set(card.grape, { total: 0, practiced: new Set() });
    }
    grapeStats.get(card.grape)!.total++;

    for (const aroma of card.aromas) {
      const keyword = aromaKeywords.find((k) => k.name === aroma);
      if (keyword) {
        if (!aromaCategoryStats.has(keyword.category)) {
          aromaCategoryStats.set(keyword.category, { total: 0, practiced: new Set() });
        }
        aromaCategoryStats.get(keyword.category)!.total++;
      }
    }
  }

  for (const record of records) {
    const regionKey = matchRegionKey(record.region) || record.region;
    const group = REGION_GROUPS.find((g) => g.key === regionKey);
    const regionName = group?.name || record.region;

    if (!regionStats.has(regionName)) {
      regionStats.set(regionName, { total: 0, practiced: new Set() });
    }
    regionStats.get(regionName)!.total++;

    if (!grapeStats.has(record.grape)) {
      grapeStats.set(record.grape, { total: 0, practiced: new Set() });
    }
    grapeStats.get(record.grape)!.total++;

    for (const aroma of record.aromas) {
      const keyword = aromaKeywords.find((k) => k.name === aroma);
      if (keyword) {
        if (!aromaCategoryStats.has(keyword.category)) {
          aromaCategoryStats.set(keyword.category, { total: 0, practiced: new Set() });
        }
        aromaCategoryStats.get(keyword.category)!.total++;
      }
    }
  }

  for (const [key, stats] of statsMap) {
    const regionKey = matchRegionKey(stats.region) || stats.region;
    const group = REGION_GROUPS.find((g) => g.key === regionKey);
    const regionName = group?.name || stats.region;

    if (stats.totalAttempts > 0) {
      if (regionStats.has(regionName)) {
        regionStats.get(regionName)!.practiced.add(stats.id);
      }
      if (grapeStats.has(stats.grape)) {
        grapeStats.get(stats.grape)!.practiced.add(stats.id);
      }
      for (const aroma of stats.aromas || []) {
        const keyword = aromaKeywords.find((k) => k.name === aroma);
        if (keyword && aromaCategoryStats.has(keyword.category)) {
          aromaCategoryStats.get(keyword.category)!.practiced.add(stats.id);
        }
      }
    }
  }

  for (const [name, s] of regionStats) {
    const coverageRate = s.total > 0 ? s.practiced.size / s.total : 0;
    if (coverageRate < 0.7) {
      gaps.push({
        type: "region",
        name,
        coverageRate: Math.round(coverageRate * 100),
        totalAvailable: s.total,
        practicedCount: s.practiced.size,
        description: `产区「${name}」覆盖率仅${Math.round(coverageRate * 100)}%，建议加强练习`,
      });
    }
  }

  for (const [name, s] of grapeStats) {
    const coverageRate = s.total > 0 ? s.practiced.size / s.total : 0;
    if (coverageRate < 0.7) {
      gaps.push({
        type: "grape",
        name,
        coverageRate: Math.round(coverageRate * 100),
        totalAvailable: s.total,
        practicedCount: s.practiced.size,
        description: `品种「${name}」覆盖率仅${Math.round(coverageRate * 100)}%，建议加强练习`,
      });
    }
  }

  for (const [name, s] of aromaCategoryStats) {
    const coverageRate = s.total > 0 ? s.practiced.size / s.total : 0;
    if (coverageRate < 0.6) {
      gaps.push({
        type: "aroma_category",
        name,
        coverageRate: Math.round(coverageRate * 100),
        totalAvailable: s.total,
        practicedCount: s.practiced.size,
        description: `香气类别「${name}」覆盖率仅${Math.round(coverageRate * 100)}%，建议加强辨识`,
      });
    }
  }

  return gaps.sort((a, b) => a.coverageRate - b.coverageRate);
}

export async function buildTaskExplanation(
  stats: WineStats,
  taskType: TaskType,
  forgettingCurve: ForgettingCurvePoint,
  weaknessReasons: WeaknessReason[],
  confusionPairs: ConfusionPair[],
  coverageGaps: CoverageGap[]
): Promise<TaskExplanation> {
  const evidences: ExplanationEvidence[] = [];
  const summaryParts: string[] = [];

  const now = Date.now();
  const sessions = await getAllSessions();
  const attempts = sessions.flatMap((s) => s.attempts);
  const wineAttempts = attempts.filter(
    (a) => a.questionId === stats.id && a.source === stats.source
  );

  if (stats.totalAttempts === 0) {
    evidences.push({
      type: "coverage_gap",
      description: "未练习酒款",
      detail: "该酒款尚未进行过任何练习，属于知识覆盖缺口",
    });
    summaryParts.push("首次学习");
  } else {
    const mistakeAttempts = wineAttempts.filter((a) => a.mistakeType !== "none");
    if (mistakeAttempts.length > 0) {
      const recentMistake = mistakeAttempts[mistakeAttempts.length - 1];
      const daysAgo = Math.round((now - recentMistake.timeSpentMs) / 86400000);
      evidences.push({
        type: "mistake_history",
        description: `历史错误${mistakeAttempts.length}次`,
        detail: `最近一次错误在${daysAgo}天前，错误类型：${formatMistakeType(recentMistake.mistakeType)}，当时答案：${recentMistake.userRegionAnswer} / ${recentMistake.userGrapeAnswer}`,
        relatedRecordIds: [recentMistake.questionId],
        timestamp: recentMistake.timeSpentMs,
      });
      summaryParts.push(`错题${mistakeAttempts.length}次`);
    }
  }

  if (forgettingCurve.stage !== "mastered" || forgettingCurve.nextRecommendedDays <= 2) {
    const retentionDesc = formatRetentionStage(forgettingCurve.stage);
    evidences.push({
      type: "forgetting_curve",
      description: `记忆阶段：${retentionDesc}`,
      detail: `当前记忆保留率约${Math.round(forgettingCurve.retentionRate * 100)}%，距上次复习${forgettingCurve.daysSinceLastReview}天，最佳复习间隔${forgettingCurve.optimalReviewInterval}天`,
    });
    if (forgettingCurve.nextRecommendedDays <= 0) {
      summaryParts.push("应尽快复习");
    } else if (forgettingCurve.nextRecommendedDays <= 2) {
      summaryParts.push(`建议${forgettingCurve.nextRecommendedDays}天内复习`);
    }
  }

  const relatedConfusion = confusionPairs.filter(
    (p) =>
      (p.wineA.id === stats.id || p.wineB.id === stats.id) &&
      p.mutualConfusionCount > 0
  );
  if (relatedConfusion.length > 0) {
    const cp = relatedConfusion[0];
    const otherName = cp.wineA.id === stats.id ? cp.wineB.region : cp.wineA.region;
    evidences.push({
      type: "confusion_link",
      description: `与「${otherName}」易混淆`,
      detail: `已发生${cp.mutualConfusionCount}次相互混淆，相似点：${cp.similarities.slice(0, 2).join("、")}`,
    });
    summaryParts.push("易混淆");
  }

  if (weaknessReasons.length > 0) {
    const topWeakness = weaknessReasons.sort(
      (a, b) => b.errorRate - a.errorRate
    )[0];
    evidences.push({
      type: "weak_dimension",
      description: `薄弱维度：${topWeakness.dimensionName}`,
      detail: `${topWeakness.dimensionName}错误率${topWeakness.errorRate}%，共${topWeakness.mistakeCount}次错误`,
    });
    summaryParts.push(`${topWeakness.dimensionName}薄弱`);
  }

  const relatedGap = coverageGaps.find((g) => {
    if (g.type === "region") {
      const regionKey = matchRegionKey(stats.region) || stats.region;
      const group = REGION_GROUPS.find((rg) => rg.key === regionKey);
      return group?.name === g.name || stats.region === g.name;
    }
    if (g.type === "grape") return stats.grape === g.name;
    if (g.type === "aroma_category") {
      return stats.aromas?.some((a) => {
        const kw = aromaKeywords.find((k) => k.name === a);
        return kw?.category === g.name;
      });
    }
    return false;
  });
  if (relatedGap) {
    summaryParts.push(`补${relatedGap.type === "region" ? "产区" : relatedGap.type === "grape" ? "品种" : "香气"}`);
  }

  const summary =
    summaryParts.length > 0 ? summaryParts.join(" · ") : "常规复习";

  return { summary, evidences };
}

function formatMistakeType(type: string): string {
  const map: Record<string, string> = {
    region: "产区错误",
    grape: "品种错误",
    both: "产区+品种均错误",
    none: "正确",
  };
  return map[type] || type;
}

function formatRetentionStage(stage: ForgettingStage): string {
  const map: Record<ForgettingStage, string> = {
    new: "未学习",
    learning: "学习中",
    consolidating: "巩固中",
    mastered: "已掌握",
  };
  return map[stage];
}

function determineTaskType(
  stats: WineStats,
  forgettingCurve: ForgettingCurvePoint,
  weaknessReasons: WeaknessReason[],
  confusionPairs: ConfusionPair[],
  coverageGaps: CoverageGap[]
): TaskType {
  if (stats.totalAttempts === 0) return "new_learn";

  const hasConfusion = confusionPairs.some(
    (p) =>
      (p.wineA.id === stats.id || p.wineB.id === stats.id) &&
      p.mutualConfusionCount > 0
  );
  if (hasConfusion && weaknessReasons.some((w) => w.dimension === "both" || w.dimension === "region" || w.dimension === "grape")) {
    return "confusion_practice";
  }

  const hasAromaWeakness = weaknessReasons.some((w) => w.dimension === "aroma");
  const hasAromaGap = coverageGaps.some((g) => {
    if (g.type !== "aroma_category") return false;
    return stats.aromas?.some((a) => {
      const kw = aromaKeywords.find((k) => k.name === a);
      return kw?.category === g.name;
    });
  });
  if (hasAromaWeakness || hasAromaGap) {
    return "aroma_mastery";
  }

  const hasRegionGap = coverageGaps.some((g) => {
    if (g.type !== "region") return false;
    const regionKey = matchRegionKey(stats.region) || stats.region;
    const group = REGION_GROUPS.find((rg) => rg.key === regionKey);
    return group?.name === g.name || stats.region === g.name;
  });
  if (hasRegionGap && stats.regionErrorCount > 0) {
    return "region_coverage";
  }

  return "review";
}

export async function generateLearningPath(
  records: WineRecord[],
  options: PathGenerationOptions = {},
  triggerSource: LearningPath["triggerSource"] = "initial"
): Promise<LearningPath> {
  const daysAhead = options.daysAhead ?? 7;
  const maxTasksPerDay = options.maxTasksPerDay ?? 5;
  const includeTaskTypes = options.includeTaskTypes ?? [
    "new_learn",
    "review",
    "confusion_practice",
    "aroma_mastery",
    "region_coverage",
  ];

  const now = Date.now();
  const todayKey = getTodayKey();

  const statsMap = await computeWineStats(records);
  const prioritized = await prioritizeWines(records);
  const confusionPairs = await computeConfusionPairs(records);
  const coverageGaps = await analyzeCoverageGaps(records);
  const weaknessMap = await analyzeWeaknesses(records);
  const sessions = await getAllSessions();
  const attempts = sessions.flatMap((s) => s.attempts);

  const taskCandidates: Array<{
    stats: WineStats;
    prioritized: PrioritizedWine;
    forgettingCurve: ForgettingCurvePoint;
    weaknessReasons: WeaknessReason[];
    taskType: TaskType;
    priorityScore: number;
    explanation: TaskExplanation;
  }> = [];

  for (const pw of prioritized) {
    const key = `${pw.stats.source}:${pw.stats.id}`;
    const stats = statsMap.get(key);
    if (!stats) continue;

    const forgettingCurve = computeForgettingCurve(stats, now);
    const weaknessReasons = weaknessMap.get(key) || [];
    const taskType = determineTaskType(
      stats,
      forgettingCurve,
      weaknessReasons,
      confusionPairs,
      coverageGaps
    );

    if (!includeTaskTypes.includes(taskType)) continue;

    let priorityScore = pw.finalWeight * 10;

    if (forgettingCurve.nextRecommendedDays <= 0) {
      priorityScore *= 1.5;
    } else if (forgettingCurve.nextRecommendedDays <= 1) {
      priorityScore *= 1.2;
    }

    if (forgettingCurve.stage === "learning") {
      priorityScore *= 1.3;
    } else if (forgettingCurve.stage === "new") {
      priorityScore *= 1.4;
    }

    const explanation = await buildTaskExplanation(
      stats,
      taskType,
      forgettingCurve,
      weaknessReasons,
      confusionPairs,
      coverageGaps
    );

    taskCandidates.push({
      stats,
      prioritized: pw,
      forgettingCurve,
      weaknessReasons,
      taskType,
      priorityScore,
      explanation,
    });
  }

  taskCandidates.sort((a, b) => b.priorityScore - a.priorityScore);

  const days: DailyPlan[] = [];
  const scheduledWineIds = new Set<string>();

  for (let dayOffset = 0; dayOffset < daysAhead; dayOffset++) {
    const dateKey = addDaysToKey(todayKey, dayOffset);
    const dayTasks: PathTask[] = [];
    const dayPriorityThreshold = dayOffset === 0 ? 0 : 5;

    const availableCandidates = taskCandidates.filter((tc) => {
      if (scheduledWineIds.has(`${tc.stats.source}:${tc.stats.id}:${dayOffset}`)) return false;

      if (dayOffset === 0) {
        return (
          tc.forgettingCurve.nextRecommendedDays <= 1 ||
          tc.stats.totalAttempts === 0 ||
          tc.taskType === "confusion_practice"
        );
      }

      if (tc.forgettingCurve.nextRecommendedDays >= 0 && tc.forgettingCurve.nextRecommendedDays <= dayOffset) {
        return true;
      }

      if (tc.priorityScore < dayPriorityThreshold) return false;

      if (dayOffset <= 2 && tc.taskType === "new_learn") return true;
      if (dayOffset <= 3 && tc.taskType === "confusion_practice") return true;
      if (dayOffset <= 5 && tc.taskType === "aroma_mastery") return true;

      return dayOffset >= 3 && tc.taskType === "review";
    });

    for (const tc of availableCandidates.slice(0, maxTasksPerDay)) {
      const taskId = `path_${generateId()}`;
      const estimatedTime = ESTIMATED_TIME_PER_TASK[tc.taskType];

      const task: PathTask = {
        id: taskId,
        taskType: tc.taskType,
        wineId: tc.stats.id,
        source: tc.stats.source,
        wineName: tc.stats.displayName,
        region: tc.stats.region,
        grape: tc.stats.grape,
        country: tc.stats.country,
        aromas: tc.stats.aromas || [],
        scheduledDate: dateKey,
        dayOffset,
        priorityScore: Math.round(tc.priorityScore),
        estimatedTimeMinutes: estimatedTime,
        completed: false,
        completedAt: null,
        explanation: tc.explanation,
        weaknessReasons: tc.weaknessReasons,
        forgettingStage: tc.forgettingCurve.stage,
        createdAt: now,
        lastReviewedAt: tc.stats.lastAttemptTime,
      };

      dayTasks.push(task);
      scheduledWineIds.add(`${tc.stats.source}:${tc.stats.id}:${dayOffset}`);
    }

    const dayStats: DailyStats = {
      totalTasks: dayTasks.length,
      completedTasks: 0,
      estimatedTotalMinutes: dayTasks.reduce((s, t) => s + t.estimatedTimeMinutes, 0),
      newLearnCount: dayTasks.filter((t) => t.taskType === "new_learn").length,
      reviewCount: dayTasks.filter((t) => t.taskType === "review").length,
      confusionCount: dayTasks.filter((t) => t.taskType === "confusion_practice").length,
      aromaCount: dayTasks.filter((t) => t.taskType === "aroma_mastery").length,
      regionCount: dayTasks.filter((t) => t.taskType === "region_coverage").length,
      weaknessSummary: dayTasks
        .flatMap((t) => t.weaknessReasons.map((w) => `${w.dimensionName}(${w.errorRate}%)`))
        .filter((v, i, a) => a.indexOf(v) === i)
        .slice(0, 5),
      coverageGaps: coverageGaps.filter((g) => {
        return dayTasks.some((t) => {
          if (g.type === "region") {
            const regionKey = matchRegionKey(t.region) || t.region;
            const group = REGION_GROUPS.find((rg) => rg.key === regionKey);
            return group?.name === g.name || t.region === g.name;
          }
          if (g.type === "grape") return t.grape === g.name;
          if (g.type === "aroma_category") {
            return t.aromas.some((a) => {
              const kw = aromaKeywords.find((k) => k.name === a);
              return kw?.category === g.name;
            });
          }
          return false;
        });
      }),
    };

    days.push({
      dateKey,
      dayOffset,
      dayLabel: getDayLabel(dayOffset),
      tasks: dayTasks,
      stats: dayStats,
    });
  }

  const totalTasks = days.reduce((s, d) => s + d.stats.totalTasks, 0);
  const totalMinutes = days.reduce((s, d) => s + d.stats.estimatedTotalMinutes, 0);

  const dimensionCounts = new Map<WeaknessDimension, number>();
  for (const d of days) {
    for (const t of d.tasks) {
      for (const w of t.weaknessReasons) {
        dimensionCounts.set(w.dimension, (dimensionCounts.get(w.dimension) || 0) + 1);
      }
    }
  }
  const weaknessDimensions = Array.from(dimensionCounts.entries()).map(
    ([dimension, count]) => ({ dimension, count })
  );

  const endDate = addDaysToKey(todayKey, daysAhead - 1);

  return {
    id: `learning_path_${generateId()}`,
    generatedAt: now,
    startDate: todayKey,
    endDate,
    days,
    overallStats: {
      totalTasks,
      totalEstimatedMinutes: totalMinutes,
      weaknessDimensions,
      coverageGaps,
    },
    triggerSource,
  };
}

export const taskTypeLabels: Record<TaskType, string> = {
  new_learn: "初次学习",
  review: "复习巩固",
  confusion_practice: "易混淆辨析",
  aroma_mastery: "香气专项",
  region_coverage: "产区覆盖",
};

export const taskTypeHints: Record<TaskType, string> = {
  new_learn: "首次接触的新酒款，建立基础记忆",
  review: "已学过的内容，巩固记忆痕迹",
  confusion_practice: "针对易混淆酒款的对比练习",
  aroma_mastery: "加强香气识别能力的专项训练",
  region_coverage: "填补产区知识覆盖缺口",
};

export const forgettingStageLabels: Record<ForgettingStage, { label: string; color: string }> = {
  new: { label: "未学习", color: "#ef4444" },
  learning: { label: "学习中", color: "#f59e0b" },
  consolidating: { label: "巩固中", color: "#3b82f6" },
  mastered: { label: "已掌握", color: "#10b981" },
};
