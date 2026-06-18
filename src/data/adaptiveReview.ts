import { WineCard, wineCards, wineComparisons, WineComparison } from "./wineData";
import { WineRecord } from "./wineRecordTypes";
import { matchRegionKey, REGION_GROUPS } from "./regionStats";
import { syncReviewTasksToProfile } from "./learningProfileSync";
import {
  saveQuizSession as unifiedSaveQuizSession,
  getAllQuizSessions as unifiedGetAllQuizSessions,
  clearQuizSessions as unifiedClearQuizSessions,
  saveAdaptiveTaskBundle as unifiedSaveTaskBundle,
  loadAdaptiveTaskBundle as unifiedLoadTaskBundle,
  clearAdaptiveTaskBundles as unifiedClearTaskBundles,
  resetPracticeHistory as unifiedResetPractice,
  AdaptiveTaskBundle,
} from "./unifiedStore";

const SEED_HISTORY_FLAG = "hxwl-08-history-seeded";

export type QuizSource = "wineCard" | "wineRecord";
export type MistakeType = "region" | "grape" | "both" | "none";

export interface QuizAttemptDetail {
  questionId: string;
  source: QuizSource;
  regionCorrect: boolean;
  grapeCorrect: boolean;
  userRegionAnswer: string;
  userGrapeAnswer: string;
  correctRegion: string;
  correctGrape: string;
  timeSpentMs: number;
  mistakeType: MistakeType;
  confusedWithRegion?: string;
  confusedWithGrape?: string;
}

export interface QuizSession {
  id: string;
  sessionName: string;
  startTime: number;
  endTime: number;
  totalDurationMs: number;
  attempts: QuizAttemptDetail[];
  overallAccuracy: number;
}

export interface WineStats {
  id: string;
  displayName: string;
  source: QuizSource;
  region: string;
  grape: string;
  country: string;
  aromas: string[];
  totalAttempts: number;
  correctCount: number;
  regionErrorCount: number;
  grapeErrorCount: number;
  bothErrorCount: number;
  avgTimeSpentMs: number;
  lastAttemptTime: number | null;
  lastResultCorrect: boolean | null;
  recentStreak: number;
}

export interface WeightFactor {
  name: string;
  label: string;
  value: number;
  explanation: string;
}

export interface PrioritizedWine {
  stats: WineStats;
  finalWeight: number;
  rank: number;
  factors: WeightFactor[];
  summaryReason: string;
}

export interface ConfusionPair {
  pairId: string;
  wineA: { id: string; region: string; grape: string };
  wineB: { id: string; region: string; grape: string };
  mutualConfusionCount: number;
  lastConfusionTime: number | null;
  difficulty: WineComparison["difficulty"];
  similarities: string[];
}

export interface AdaptiveDashboardData {
  prioritizedWines: PrioritizedWine[];
  confusionPairs: ConfusionPair[];
  overallStats: {
    totalSessions: number;
    totalAttempts: number;
    globalAccuracy: number;
    avgTimePerQuestionMs: number;
    weakGrapes: { grape: string; errorRate: number; attempts: number }[];
    weakRegions: { region: string; errorRate: number; attempts: number }[];
  };
}

const WEIGHT_BASE = 1.0;
const WEIGHT_ERROR_BOTH = 2.5;
const WEIGHT_ERROR_REGION = 1.8;
const WEIGHT_ERROR_GRAPE = 1.6;
const WEIGHT_SLOW_TIME = 1.4;
const WEIGHT_STREAK_NEGATIVE = 1.5;
const WEIGHT_STREAK_POSITIVE = 0.6;
const WEIGHT_TIME_DECAY = 1.3;
const WEIGHT_CONFUSION_LINK = 1.25;
const WEIGHT_NOVICE = 1.5;
const WEIGHT_PERFECT_MASTERED = 0.3;

const SLOW_TIME_THRESHOLD_MS = 45 * 1000;
const DECAY_DAYS_THRESHOLD = 7;
const ATTEMPT_MASTERY_THRESHOLD = 5;
const ACCURACY_MASTERY_THRESHOLD = 0.9;
const NOVICE_ATTEMPT_THRESHOLD = 2;

function getWeightLevel(weight: number, maxWeight: number): "high" | "medium" | "low" {
  const ratio = maxWeight > 0 ? weight / maxWeight : 0;
  if (ratio >= 0.6) return "high";
  if (ratio >= 0.3) return "medium";
  return "low";
}

export function saveQuizSessionSync(session: QuizSession): void {
  unifiedSaveQuizSession(session).catch(() => {});
}

export async function saveQuizSession(session: QuizSession): Promise<void> {
  await unifiedSaveQuizSession(session);
}

export async function getAllSessions(): Promise<QuizSession[]> {
  return unifiedGetAllQuizSessions();
}

function _loadRawHistoryFromLS(): QuizSession[] {
  try {
    const raw = localStorage.getItem("hxwl-08-quiz-history");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QuizSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mergeCardAndRecordSources(records: WineRecord[]): Map<
  string,
  {
    id: string;
    source: QuizSource;
    region: string;
    grape: string;
    country: string;
    aromas: string[];
    displayName: string;
  }
> {
  const map = new Map();

  for (const card of wineCards) {
    map.set(`wineCard:${card.id}`, {
      id: card.id,
      source: "wineCard",
      region: card.region,
      grape: card.grape,
      country: card.country,
      aromas: card.aromas,
      displayName: card.region,
    });
  }

  for (const record of records) {
    map.set(`wineRecord:${record.id}`, {
      id: record.id,
      source: "wineRecord",
      region: record.region,
      grape: record.grape,
      country: record.country,
      aromas: record.aromas,
      displayName: record.name || record.region,
    });
  }

  return map;
}

export async function seedDemoHistoryIfEmpty(records: WineRecord[]): Promise<void> {
  const flag = localStorage.getItem(SEED_HISTORY_FLAG);
  if (flag === "1") return;
  const existing = await getAllSessions();
  if (existing.length > 0) {
    localStorage.setItem(SEED_HISTORY_FLAG, "1");
    return;
  }

  const sessions: QuizSession[] = [];
  const now = Date.now();

  const demoAttempts: Array<{
    cardId: string;
    mistakes: Array<{ type: MistakeType; daysAgo: number; timeSpent: number }>;
  }> = [
    {
      cardId: "bordeaux-left-bank",
      mistakes: [
        { type: "none", daysAgo: 12, timeSpent: 52000 },
        { type: "grape", daysAgo: 6, timeSpent: 38000 },
        { type: "none", daysAgo: 1, timeSpent: 30000 },
      ],
    },
    {
      cardId: "bourgogne-village",
      mistakes: [
        { type: "region", daysAgo: 10, timeSpent: 65000 },
        { type: "region", daysAgo: 3, timeSpent: 58000 },
      ],
    },
    {
      cardId: "rioja-reserva",
      mistakes: [
        { type: "both", daysAgo: 8, timeSpent: 75000 },
        { type: "region", daysAgo: 2, timeSpent: 62000 },
      ],
    },
    {
      cardId: "napa-cabernet",
      mistakes: [
        { type: "region", daysAgo: 5, timeSpent: 48000 },
      ],
    },
    {
      cardId: "chianti-classico",
      mistakes: [
        { type: "grape", daysAgo: 9, timeSpent: 40000 },
        { type: "none", daysAgo: 4, timeSpent: 35000 },
      ],
    },
    {
      cardId: "barolo",
      mistakes: [
        { type: "both", daysAgo: 7, timeSpent: 90000 },
        { type: "grape", daysAgo: 1, timeSpent: 78000 },
      ],
    },
    {
      cardId: "malbec-mendoza",
      mistakes: [
        { type: "region", daysAgo: 11, timeSpent: 45000 },
      ],
    },
    {
      cardId: "shiraz-barossa",
      mistakes: [
        { type: "both", daysAgo: 6, timeSpent: 70000 },
        { type: "region", daysAgo: 2, timeSpent: 55000 },
      ],
    },
    {
      cardId: "sancerre",
      mistakes: [
        { type: "none", daysAgo: 14, timeSpent: 28000 },
        { type: "none", daysAgo: 5, timeSpent: 22000 },
      ],
    },
    {
      cardId: "chablis",
      mistakes: [
        { type: "grape", daysAgo: 4, timeSpent: 50000 },
      ],
    },
  ];

  const confusionAnswers: Record<string, { region: string; grape: string }> = {
    "bordeaux-left-bank": { region: "里奥哈", grape: "丹魄" },
    "bourgogne-village": { region: "巴罗洛", grape: "内比奥罗" },
    "rioja-reserva": { region: "基安蒂经典", grape: "桑娇维塞" },
    "napa-cabernet": { region: "波尔多左岸", grape: "赤霞珠" },
    "chianti-classico": { region: "里奥哈", grape: "丹魄" },
    "barolo": { region: "勃艮第村级", grape: "黑皮诺" },
    "malbec-mendoza": { region: "巴罗萨谷", grape: "西拉" },
    "shiraz-barossa": { region: "门多萨", grape: "马尔贝克" },
    "chablis": { region: "桑塞尔", grape: "长相思" },
  };

  function buildSession(
    sessionIndex: number,
    sessionName: string,
    pickFn: (m: typeof demoAttempts[0]) => boolean
  ): QuizSession | null {
    const picked = demoAttempts.filter((p) => {
      if (!pickFn(p)) return false;
      return sessionIndex < p.mistakes.length;
    });
    if (picked.length === 0) return null;

    const attempts: QuizAttemptDetail[] = picked.map((p) => {
      const card = wineCards.find((c) => c.id === p.cardId)!;
      const m = p.mistakes[sessionIndex];
      const confused = confusionAnswers[p.cardId];
      return {
        questionId: p.cardId,
        source: "wineCard",
        regionCorrect: m.type !== "region" && m.type !== "both",
        grapeCorrect: m.type !== "grape" && m.type !== "both",
        userRegionAnswer:
          m.type === "region" || m.type === "both"
            ? confused?.region || ""
            : card.region,
        userGrapeAnswer:
          m.type === "grape" || m.type === "both"
            ? confused?.grape || ""
            : card.grape,
        correctRegion: card.region,
        correctGrape: card.grape,
        timeSpentMs: m.timeSpent,
        mistakeType: m.type,
        confusedWithRegion:
          m.type === "region" || m.type === "both" ? confused?.region : undefined,
        confusedWithGrape:
          m.type === "grape" || m.type === "both" ? confused?.grape : undefined,
      };
    });

    const correct = attempts.filter(
      (a) => a.regionCorrect && a.grapeCorrect
    ).length;

    const sessionStart =
      now - attempts[0].timeSpentMs - (attempts[0].timeSpentMs * 0.1);

    return {
      id: `seed-${sessionIndex}`,
      sessionName,
      startTime: sessionStart,
      endTime: sessionStart + attempts.reduce((s, a) => s + a.timeSpentMs, 0),
      totalDurationMs: attempts.reduce((s, a) => s + a.timeSpentMs, 0),
      attempts,
      overallAccuracy: attempts.length > 0 ? correct / attempts.length : 0,
    };
  }

  for (let i = 0; i < 3; i++) {
    const s = buildSession(i, `示例练习 ${i + 1}`, () => true);
    if (s) {
      s.startTime = now - (8 - i * 2) * 24 * 3600 * 1000;
      s.endTime = s.startTime + s.totalDurationMs;
      s.attempts.forEach((a) => (a.timeSpentMs = Math.round(a.timeSpentMs * (0.9 + i * 0.1))));
      sessions.push(s);
    }
  }

  await saveQuizSession(sessions[0]);
  if (sessions.length > 1) await saveQuizSession(sessions[1]);
  if (sessions.length > 2) await saveQuizSession(sessions[2]);
  localStorage.setItem(SEED_HISTORY_FLAG, "1");
}

export async function computeWineStats(records: WineRecord[]): Promise<Map<string, WineStats>> {
  const sessions = await getAllSessions();
  const sources = mergeCardAndRecordSources(records);
  const statsMap = new Map<string, WineStats>();

  for (const [key, meta] of sources) {
    statsMap.set(key, {
      id: meta.id,
      displayName: meta.displayName,
      source: meta.source,
      region: meta.region,
      grape: meta.grape,
      country: meta.country,
      aromas: meta.aromas,
      totalAttempts: 0,
      correctCount: 0,
      regionErrorCount: 0,
      grapeErrorCount: 0,
      bothErrorCount: 0,
      avgTimeSpentMs: 0,
      lastAttemptTime: null,
      lastResultCorrect: null,
      recentStreak: 0,
    });
  }

  for (const session of sessions) {
    for (const attempt of session.attempts) {
      const key = `${attempt.source}:${attempt.questionId}`;
      const stats = statsMap.get(key);
      if (!stats) continue;

      stats.totalAttempts++;
      const isCorrect = attempt.regionCorrect && attempt.grapeCorrect;
      if (isCorrect) {
        stats.correctCount++;
        if (stats.lastResultCorrect === true) {
          stats.recentStreak = Math.max(1, stats.recentStreak + 1);
        } else {
          stats.recentStreak = 1;
        }
        stats.lastResultCorrect = true;
      } else {
        if (attempt.mistakeType === "both") stats.bothErrorCount++;
        else if (attempt.mistakeType === "region") stats.regionErrorCount++;
        else if (attempt.mistakeType === "grape") stats.grapeErrorCount++;

        if (stats.lastResultCorrect === false) {
          stats.recentStreak = Math.min(-1, stats.recentStreak - 1);
        } else {
          stats.recentStreak = -1;
        }
        stats.lastResultCorrect = false;
      }

      const totalTime =
        stats.avgTimeSpentMs * (stats.totalAttempts - 1) + attempt.timeSpentMs;
      stats.avgTimeSpentMs = Math.round(totalTime / stats.totalAttempts);

      if (
        stats.lastAttemptTime === null ||
        session.endTime > stats.lastAttemptTime
      ) {
        stats.lastAttemptTime = session.endTime;
      }
    }
  }

  return statsMap;
}

export async function computeConfusionPairs(records: WineRecord[]): Promise<ConfusionPair[]> {
  const sessions = await getAllSessions();
  const sources = mergeCardAndRecordSources(records);
  const pairMap = new Map<string, ConfusionPair>();

  for (const comp of wineComparisons) {
    const [idA, idB] = comp.wineIds;
    const metaA = sources.get(`wineCard:${idA}`);
    const metaB = sources.get(`wineCard:${idB}`);
    if (!metaA || !metaB) continue;

    const pairId = comp.id;
    pairMap.set(pairId, {
      pairId,
      wineA: { id: idA, region: metaA.region, grape: metaA.grape },
      wineB: { id: idB, region: metaB.region, grape: metaB.grape },
      mutualConfusionCount: 0,
      lastConfusionTime: null,
      difficulty: comp.difficulty,
      similarities: comp.similarities,
    });
  }

  for (const session of sessions) {
    for (const attempt of session.attempts) {
      if (
        attempt.mistakeType === "none" ||
        (!attempt.confusedWithRegion && !attempt.confusedWithGrape)
      )
        continue;

      for (const [pairId, pair] of pairMap) {
        const regions = [pair.wineA.region, pair.wineB.region];
        const grapes = [pair.wineA.grape, pair.wineB.grape];
        const correctRegion = attempt.correctRegion;
        const userRegion = attempt.userRegionAnswer;
        const correctGrape = attempt.correctGrape;
        const userGrape = attempt.userGrapeAnswer;

        const bothRegionsInPair =
          regions.includes(correctRegion) && regions.includes(userRegion);
        const bothGrapesInPair =
          grapes.includes(correctGrape) && grapes.includes(userGrape);
        const regionMismatch = correctRegion !== userRegion;
        const grapeMismatch = correctGrape !== userGrape;

        if (
          (regionMismatch && bothRegionsInPair) ||
          (grapeMismatch && bothGrapesInPair)
        ) {
          pair.mutualConfusionCount++;
          if (
            pair.lastConfusionTime === null ||
            session.endTime > pair.lastConfusionTime
          ) {
            pair.lastConfusionTime = session.endTime;
          }
        }
      }
    }
  }

  return Array.from(pairMap.values()).sort(
    (a, b) => b.mutualConfusionCount - a.mutualConfusionCount
  );
}

export async function prioritizeWines(records: WineRecord[]): Promise<PrioritizedWine[]> {
  const statsMap = await computeWineStats(records);
  const confusionPairs = await computeConfusionPairs(records);
  const confusionLinks = new Map<string, number>();

  for (const pair of confusionPairs) {
    if (pair.mutualConfusionCount === 0) continue;
    const boost =
      pair.mutualConfusionCount * (pair.difficulty === "high" ? 2 : pair.difficulty === "medium" ? 1.5 : 1);
    for (const id of [pair.wineA.id, pair.wineB.id]) {
      confusionLinks.set(id, (confusionLinks.get(id) || 0) + boost);
    }
  }

  const prioritized: PrioritizedWine[] = [];
  const now = Date.now();

  for (const [key, stats] of statsMap) {
    const factors: WeightFactor[] = [];
    let weight = WEIGHT_BASE;
    const attempts = stats.totalAttempts;
    const accuracy =
      attempts > 0 ? stats.correctCount / attempts : 0;

    factors.push({
      name: "base",
      label: "基础权重",
      value: WEIGHT_BASE,
      explanation: "每款酒都具备基础复习权重",
    });

    if (attempts === 0) {
      factors.push({
        name: "novice",
        label: "新题优先",
        value: WEIGHT_NOVICE,
        explanation: "尚未练习，建议尽快覆盖",
      });
      weight *= WEIGHT_NOVICE;
    } else if (attempts < NOVICE_ATTEMPT_THRESHOLD) {
      factors.push({
        name: "lowAttempt",
        label: "练习不足",
        value: 1 + (WEIGHT_NOVICE - 1) * (1 - attempts / NOVICE_ATTEMPT_THRESHOLD),
        explanation: `仅练习 ${attempts} 次，尚未形成稳定记忆`,
      });
      weight *= 1 + (WEIGHT_NOVICE - 1) * (1 - attempts / NOVICE_ATTEMPT_THRESHOLD);
    }

    if (attempts > 0) {
      if (stats.bothErrorCount > 0) {
        const intensity = 1 + (stats.bothErrorCount - 1) * 0.3;
        const v = WEIGHT_ERROR_BOTH * intensity;
        factors.push({
          name: "bothError",
          label: "产区+品种双错",
          value: +v.toFixed(2),
          explanation: `共 ${stats.bothErrorCount} 次完全答错，记忆薄弱`,
        });
        weight *= v;
      }
      if (stats.regionErrorCount > 0 && stats.bothErrorCount === 0) {
        const intensity = 1 + (stats.regionErrorCount - 1) * 0.25;
        const v = WEIGHT_ERROR_REGION * intensity;
        factors.push({
          name: "regionError",
          label: "产区识别错误",
          value: +v.toFixed(2),
          explanation: `共 ${stats.regionErrorCount} 次产区判断错误`,
        });
        weight *= v;
      }
      if (stats.grapeErrorCount > 0 && stats.bothErrorCount === 0) {
        const intensity = 1 + (stats.grapeErrorCount - 1) * 0.25;
        const v = WEIGHT_ERROR_GRAPE * intensity;
        factors.push({
          name: "grapeError",
          label: "品种识别错误",
          value: +v.toFixed(2),
          explanation: `共 ${stats.grapeErrorCount} 次品种判断错误`,
        });
        weight *= v;
      }
    }

    if (attempts > 0 && stats.avgTimeSpentMs > SLOW_TIME_THRESHOLD_MS) {
      const ratio = stats.avgTimeSpentMs / SLOW_TIME_THRESHOLD_MS;
      const v = 1 + (WEIGHT_SLOW_TIME - 1) * Math.min(ratio - 1, 1.5);
      factors.push({
        name: "slowResponse",
        label: "判断耗时过长",
        value: +v.toFixed(2),
        explanation: `平均耗时 ${Math.round(stats.avgTimeSpentMs / 1000)} 秒，反应迟缓需要加强`,
      });
      weight *= v;
    }

    if (stats.recentStreak <= -2) {
      const v = WEIGHT_STREAK_NEGATIVE + (Math.abs(stats.recentStreak) - 2) * 0.2;
      factors.push({
        name: "losingStreak",
        label: "连续答错",
        value: +v.toFixed(2),
        explanation: `最近 ${Math.abs(stats.recentStreak)} 次连续错误`,
      });
      weight *= v;
    } else if (stats.recentStreak >= 3) {
      const v = WEIGHT_STREAK_POSITIVE - Math.min((stats.recentStreak - 3) * 0.05, 0.2);
      factors.push({
        name: "winningStreak",
        label: "连续答对",
        value: +v.toFixed(2),
        explanation: `最近 ${stats.recentStreak} 次连续正确，可降低优先级`,
      });
      weight *= v;
    }

    if (attempts > 0 && stats.lastAttemptTime !== null) {
      const daysSince = (now - stats.lastAttemptTime) / (24 * 3600 * 1000);
      if (daysSince >= DECAY_DAYS_THRESHOLD) {
        const intensity = Math.min((daysSince - DECAY_DAYS_THRESHOLD) / 14, 1);
        const v = 1 + (WEIGHT_TIME_DECAY - 1) * intensity;
        factors.push({
          name: "timeDecay",
          label: "记忆衰减",
          value: +v.toFixed(2),
          explanation: `${Math.round(daysSince)} 天未复习，需要重新巩固`,
        });
        weight *= v;
      }
    }

    const idForKey = key.split(":").slice(1).join(":");
    const confusionBoost = confusionLinks.get(idForKey);
    if (confusionBoost && confusionBoost > 0) {
      const v = 1 + (WEIGHT_CONFUSION_LINK - 1) * Math.min(confusionBoost / 3, 1.5);
      factors.push({
        name: "confusionLink",
        label: "易混淆关联",
        value: +v.toFixed(2),
        explanation: `与其他酒款产生 ${confusionBoost.toFixed(1)} 次相互混淆`,
      });
      weight *= v;
    }

    if (
      attempts >= ATTEMPT_MASTERY_THRESHOLD &&
      accuracy >= ACCURACY_MASTERY_THRESHOLD &&
      stats.recentStreak >= 2
    ) {
      factors.push({
        name: "mastered",
        label: "已掌握",
        value: WEIGHT_PERFECT_MASTERED,
        explanation: `高正确率（${Math.round(accuracy * 100)}%）+ 稳定发挥，可降低频率`,
      });
      weight *= WEIGHT_PERFECT_MASTERED;
    }

    const reasonParts: string[] = [];
    if (attempts === 0) reasonParts.push("未练习");
    if (stats.bothErrorCount > 0) reasonParts.push(`双错×${stats.bothErrorCount}`);
    if (stats.regionErrorCount > 0 && stats.bothErrorCount === 0)
      reasonParts.push(`产区错×${stats.regionErrorCount}`);
    if (stats.grapeErrorCount > 0 && stats.bothErrorCount === 0)
      reasonParts.push(`品种错×${stats.grapeErrorCount}`);
    if (stats.avgTimeSpentMs > SLOW_TIME_THRESHOLD_MS)
      reasonParts.push(`耗时${Math.round(stats.avgTimeSpentMs / 1000)}秒`);
    if (stats.recentStreak <= -2) reasonParts.push(`${Math.abs(stats.recentStreak)}连错`);
    if (stats.lastAttemptTime) {
      const d = Math.round((now - stats.lastAttemptTime) / 86400000);
      if (d >= 7) reasonParts.push(`${d}天未练`);
    }
    if (confusionBoost && confusionBoost > 0) reasonParts.push("易混淆");
    if (
      attempts >= ATTEMPT_MASTERY_THRESHOLD &&
      accuracy >= ACCURACY_MASTERY_THRESHOLD
    )
      reasonParts.push("已掌握");

    const summary = reasonParts.length > 0
      ? reasonParts.join(" · ")
      : "正常复习";

    prioritized.push({
      stats,
      finalWeight: +weight.toFixed(2),
      rank: 0,
      factors,
      summaryReason: summary,
    });
  }

  prioritized.sort((a, b) => b.finalWeight - a.finalWeight);
  prioritized.forEach((p, i) => (p.rank = i + 1));

  return prioritized;
}

export async function buildAdaptiveDashboard(records: WineRecord[]): Promise<AdaptiveDashboardData> {
  await seedDemoHistoryIfEmpty(records);
  const prioritizedWines = await prioritizeWines(records);
  const confusionPairs = await computeConfusionPairs(records);
  const sessions = await getAllSessions();

  const allAttempts = sessions.flatMap((s) => s.attempts);
  const totalAttempts = allAttempts.length;
  const totalCorrect = allAttempts.filter(
    (a) => a.regionCorrect && a.grapeCorrect
  ).length;
  const globalAccuracy =
    totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;
  const avgTimePerQuestionMs =
    totalAttempts > 0
      ? Math.round(allAttempts.reduce((s, a) => s + a.timeSpentMs, 0) / totalAttempts)
      : 0;

  const grapeStats = new Map<
    string,
    { attempts: number; errors: number }
  >();
  const regionStats = new Map<
    string,
    { attempts: number; errors: number }
  >();

  for (const attempt of allAttempts) {
    const gKey = attempt.correctGrape;
    const rKey = matchRegionKey(attempt.correctRegion) || attempt.correctRegion;

    if (!grapeStats.has(gKey)) grapeStats.set(gKey, { attempts: 0, errors: 0 });
    if (!regionStats.has(rKey)) regionStats.set(rKey, { attempts: 0, errors: 0 });

    const gs = grapeStats.get(gKey)!;
    const rs = regionStats.get(rKey)!;
    gs.attempts++;
    rs.attempts++;

    if (attempt.mistakeType !== "none") {
      gs.errors++;
      rs.errors++;
    }
  }

  const weakGrapes = Array.from(grapeStats.entries())
    .map(([grape, s]) => ({
      grape,
      attempts: s.attempts,
      errorRate: s.attempts > 0 ? Math.round((s.errors / s.attempts) * 100) : 0,
    }))
    .filter((g) => g.attempts >= 2)
    .sort((a, b) => b.errorRate - a.errorRate)
    .slice(0, 5);

  const weakRegions = Array.from(regionStats.entries())
    .map(([regionKey, s]) => {
      const group = REGION_GROUPS.find((g) => g.key === regionKey);
      return {
        region: group?.name || regionKey,
        attempts: s.attempts,
        errorRate: s.attempts > 0 ? Math.round((s.errors / s.attempts) * 100) : 0,
      };
    })
    .filter((r) => r.attempts >= 2)
    .sort((a, b) => b.errorRate - a.errorRate)
    .slice(0, 5);

  return {
    prioritizedWines,
    confusionPairs: confusionPairs.filter((p) => p.mutualConfusionCount > 0),
    overallStats: {
      totalSessions: sessions.length,
      totalAttempts,
      globalAccuracy,
      avgTimePerQuestionMs,
      weakGrapes,
      weakRegions,
    },
  };
}

export async function clearAllHistory(): Promise<void> {
  await unifiedResetPractice();
  localStorage.removeItem(SEED_HISTORY_FLAG);
}

export async function weightedSampleCards(
  pool: WineCard[],
  count: number,
  records: WineRecord[]
): Promise<WineCard[]> {
  if (pool.length === 0) return [];
  const effective = Math.min(count, pool.length);

  const prioritized = await prioritizeWines(records);
  const weightMap = new Map<string, number>();
  for (const pw of prioritized) {
    if (pw.stats.source === "wineCard") {
      weightMap.set(pw.stats.id, pw.finalWeight);
    }
  }

  const items = pool.map((card) => ({
    card,
    weight: weightMap.get(card.id) ?? 1.0,
  }));

  const result: WineCard[] = [];
  const remaining = [...items];

  for (let i = 0; i < effective; i++) {
    const totalWeight = remaining.reduce((s, item) => s + item.weight, 0);
    let rand = Math.random() * totalWeight;
    let chosenIndex = 0;

    for (let j = 0; j < remaining.length; j++) {
      rand -= remaining[j].weight;
      if (rand <= 0) {
        chosenIndex = j;
        break;
      }
    }

    result.push(remaining[chosenIndex].card);
    remaining.splice(chosenIndex, 1);
  }

  return result;
}

export async function weightedSampleRecords(
  pool: WineRecord[],
  count: number,
  records: WineRecord[]
): Promise<WineRecord[]> {
  if (pool.length === 0) return [];
  const effective = Math.min(count, pool.length);

  const prioritized = await prioritizeWines(records);
  const weightMap = new Map<string, number>();
  for (const pw of prioritized) {
    if (pw.stats.source === "wineRecord") {
      weightMap.set(pw.stats.id, pw.finalWeight);
    }
  }

  const items = pool.map((record) => ({
    record,
    weight: weightMap.get(record.id) ?? 1.0,
  }));

  const result: WineRecord[] = [];
  const remaining = [...items];

  for (let i = 0; i < effective; i++) {
    const totalWeight = remaining.reduce((s, item) => s + item.weight, 0);
    let rand = Math.random() * totalWeight;
    let chosenIndex = 0;

    for (let j = 0; j < remaining.length; j++) {
      rand -= remaining[j].weight;
      if (rand <= 0) {
        chosenIndex = j;
        break;
      }
    }

    result.push(remaining[chosenIndex].record);
    remaining.splice(chosenIndex, 1);
  }

  return result;
}

export type ReviewStage = "today" | "three-days" | "one-week";

export type GenerationScope = "highPriority" | "unpracticed" | "weakRegions";

export interface GenerationOptions {
  scopes: GenerationScope[];
  count: number;
  includeStages?: ReviewStage[];
}

export interface AdaptiveReviewTask {
  id: string;
  wineId: string;
  source: QuizSource;
  wineName: string;
  region: string;
  grape: string;
  aromas: string[];
  characteristic: string;
  stage: ReviewStage;
  scheduledDate: string;
  completed: boolean;
  completedAt: number | null;
  createdAt: number;
  generationScope: GenerationScope;
  weight: number;
  rank: number;
}

export interface AdaptiveReviewTaskBundle {
  generatedAt: number;
  dateKey: string;
  tasks: AdaptiveReviewTask[];
}

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

async function loadAdaptiveTasks(): Promise<AdaptiveReviewTaskBundle | null> {
  const todayKey = getTodayKey();
  const bundle = await unifiedLoadTaskBundle(todayKey);
  if (!bundle) return null;
  return bundle as unknown as AdaptiveReviewTaskBundle;
}

async function saveAdaptiveTasks(bundle: AdaptiveReviewTaskBundle): Promise<void> {
  await unifiedSaveTaskBundle(bundle as unknown as AdaptiveTaskBundle);
}

export async function getAdaptiveReviewTasks(): Promise<AdaptiveReviewTask[]> {
  const bundle = await loadAdaptiveTasks();
  return bundle ? bundle.tasks : [];
}

export async function clearAdaptiveReviewTasks(): Promise<void> {
  await unifiedClearTaskBundles();
}

export async function toggleAdaptiveTaskCompleted(taskId: string): Promise<boolean> {
  const bundle = await loadAdaptiveTasks();
  if (!bundle) return false;
  const task = bundle.tasks.find((t) => t.id === taskId);
  if (!task) return false;
  task.completed = !task.completed;
  task.completedAt = task.completed ? Date.now() : null;
  await saveAdaptiveTasks(bundle);
  syncBundleToProfile(bundle).catch(() => {});
  return task.completed;
}

export async function syncAdaptiveTasksToProfile(): Promise<number> {
  const bundle = await loadAdaptiveTasks();
  if (!bundle) return 0;
  try {
    return await syncBundleToProfile(bundle);
  } catch {
    return 0;
  }
}

function syncBundleToProfile(bundle: AdaptiveReviewTaskBundle): Promise<number> {
  const tasksForSync = bundle.tasks.map((t) => {
    const [y, m, d] = t.scheduledDate.split("-").map(Number);
    return {
      id: `adaptive_${t.id}`,
      wineName: t.wineName,
      grape: t.grape,
      stage: t.stage,
      scheduledDate: new Date(y, m - 1, d),
      completed: t.completed,
      completedAt: t.completedAt,
      createdAt: t.createdAt,
    };
  });
  return syncReviewTasksToProfile(tasksForSync);
}

export interface GenerationResult {
  tasks: AdaptiveReviewTask[];
  counts: Record<GenerationScope, number>;
}

export async function generateTodayReviewPlan(
  records: WineRecord[],
  options: GenerationOptions
): Promise<GenerationResult> {
  const dashboard = await buildAdaptiveDashboard(records);
  const { prioritizedWines, overallStats } = dashboard;
  const maxWeight = prioritizedWines[0]?.finalWeight ?? 1;

  const selectedMap = new Map<string, PrioritizedWine>();
  const counts: Record<GenerationScope, number> = {
    highPriority: 0,
    unpracticed: 0,
    weakRegions: 0,
  };

  const scopes: GenerationScope[] = options.scopes.length > 0 ? options.scopes : ["highPriority"];
  const stages: ReviewStage[] = (options.includeStages?.length ?? 0) > 0 ? options.includeStages! : ["today"];

  if (scopes.includes("highPriority")) {
    const highPriorityWines = prioritizedWines.filter((w) => {
      const level = getWeightLevel(w.finalWeight, maxWeight);
      return level === "high";
    });
    for (const w of highPriorityWines) {
      const key = `${w.stats.source}:${w.stats.id}`;
      if (!selectedMap.has(key)) {
        selectedMap.set(key, w);
        counts.highPriority++;
      }
    }
  }

  if (scopes.includes("unpracticed")) {
    const unpracticedWines = prioritizedWines.filter(
      (w) => w.stats.totalAttempts === 0
    );
    for (const w of unpracticedWines) {
      const key = `${w.stats.source}:${w.stats.id}`;
      if (!selectedMap.has(key)) {
        selectedMap.set(key, w);
        counts.unpracticed++;
      }
    }
  }

  if (scopes.includes("weakRegions")) {
    const weakRegionNames = new Set(overallStats.weakRegions.map((r) => r.region));
    const weakRegionWines = prioritizedWines.filter((w) => {
      const regionGroup = REGION_GROUPS.find((g) => g.key === matchRegionKey(w.stats.region));
      const regionName = regionGroup?.name || w.stats.region;
      return weakRegionNames.has(regionName);
    });
    for (const w of weakRegionWines) {
      const key = `${w.stats.source}:${w.stats.id}`;
      if (!selectedMap.has(key)) {
        selectedMap.set(key, w);
        counts.weakRegions++;
      }
    }
  }

  let candidates = Array.from(selectedMap.values());
  candidates.sort((a, b) => b.finalWeight - a.finalWeight);

  if (candidates.length > options.count) {
    candidates = candidates.slice(0, options.count);
  }

  const todayKey = getTodayKey();
  const stageOffsets: Record<string, number> = {
    today: 0,
    "three-days": 3,
    "one-week": 7,
  };

  const tasks: AdaptiveReviewTask[] = [];
  let globalRank = 1;

  for (const stage of stages) {
    const scheduledDate = addDaysToKey(todayKey, stageOffsets[stage]);
    for (const wine of candidates) {
      const task: AdaptiveReviewTask = {
        id: `adp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}_${wine.stats.source}_${wine.stats.id}_${stage}`,
        wineId: wine.stats.id,
        source: wine.stats.source,
        wineName: wine.stats.displayName,
        region: wine.stats.region,
        grape: wine.stats.grape,
        aromas: wine.stats.aromas,
        characteristic: buildCharacteristic(wine),
        stage,
        scheduledDate,
        completed: false,
        completedAt: null,
        createdAt: Date.now(),
        generationScope: determineScope(wine, scopes, maxWeight, overallStats),
        weight: wine.finalWeight,
        rank: globalRank++,
      };
      tasks.push(task);
    }
  }

  const bundle: AdaptiveReviewTaskBundle = {
    generatedAt: Date.now(),
    dateKey: todayKey,
    tasks,
  };
  await saveAdaptiveTasks(bundle);
  syncBundleToProfile(bundle).catch(() => {});

  return { tasks, counts };
}

export async function generateTodayReviewPlanAsync(
  records: WineRecord[],
  options: GenerationOptions
): Promise<GenerationResult> {
  const result = await generateTodayReviewPlan(records, options);
  const bundle = await loadAdaptiveTasks();
  if (bundle) {
    try {
      await syncBundleToProfile(bundle);
    } catch {
    }
  }
  return result;
}

function buildCharacteristic(wine: PrioritizedWine): string {
  const parts: string[] = [];
  if (wine.stats.region) parts.push(wine.stats.region);
  if (wine.stats.country) parts.push(wine.stats.country);
  if (wine.summaryReason) parts.push(wine.summaryReason);
  return parts.join(" · ");
}

function determineScope(
  wine: PrioritizedWine,
  scopes: GenerationScope[],
  maxWeight: number,
  overallStats: AdaptiveDashboardData["overallStats"]
): GenerationScope {
  if (scopes.includes("unpracticed") && wine.stats.totalAttempts === 0) {
    return "unpracticed";
  }
  if (scopes.includes("weakRegions")) {
    const weakRegionNames = new Set(overallStats.weakRegions.map((r) => r.region));
    const regionGroup = REGION_GROUPS.find((g) => g.key === matchRegionKey(wine.stats.region));
    const regionName = regionGroup?.name || wine.stats.region;
    if (weakRegionNames.has(regionName)) {
      return "weakRegions";
    }
  }
  return "highPriority";
}

export const scopeLabels: Record<GenerationScope, string> = {
  highPriority: "高优先级酒款",
  unpracticed: "未练习酒款",
  weakRegions: "薄弱产区酒款",
};

export const scopeHints: Record<GenerationScope, string> = {
  highPriority: "综合权重最高的酒款，包含错题多、记忆衰退等因素",
  unpracticed: "从未进行过练习的新题，建议尽快覆盖",
  weakRegions: "属于错误率最高产区的酒款，加强产区识别",
};

export type SmartPickStrategy =
  | "regionCoverage"
  | "weakGrape"
  | "recentUnpracticed"
  | "aromaCategory";

export interface SmartPickConfig {
  strategies: SmartPickStrategy[];
  regionCoverageRatio?: number;
  weakGrapeRatio?: number;
  recentUnpracticedRatio?: number;
  aromaCategoryRatio?: number;
  unpracticedDaysThreshold?: number;
  selectedAromaCategories?: string[];
}

export interface QuestionSourceStat {
  strategy: SmartPickStrategy;
  label: string;
  count: number;
  description: string;
}

export interface SmartPickResult {
  records: WineRecord[];
  stats: QuestionSourceStat[];
  regionBreakdown: { region: string; count: number }[];
  grapeBreakdown: { grape: string; count: number }[];
  aromaCategoryBreakdown: { category: string; count: number }[];
}

export const strategyLabels: Record<SmartPickStrategy, string> = {
  regionCoverage: "产区覆盖",
  weakGrape: "薄弱品种",
  recentUnpracticed: "最近未练习",
  aromaCategory: "香气类别",
};

export const strategyDescriptions: Record<SmartPickStrategy, string> = {
  regionCoverage: "确保题目覆盖多个不同产区，避免集中在单一产区",
  weakGrape: "优先选择历史错误率较高的葡萄品种相关题目",
  recentUnpracticed: "优先选择超过一定天数未练习的题目",
  aromaCategory: "按指定香气类别选题，覆盖不同香气特征",
};

function getAromaCategory(aromaName: string, aromaKeywords: { name: string; category: string }[]): string {
  const found = aromaKeywords.find((k) => k.name === aromaName);
  return found?.category || "其他";
}

function categorizeRecordsByAroma(
  records: WineRecord[],
  aromaKeywordsData: { name: string; category: string }[]
): Map<string, WineRecord[]> {
  const map = new Map<string, WineRecord[]>();
  for (const record of records) {
    const categories = new Set<string>();
    for (const aroma of record.aromas) {
      const cat = getAromaCategory(aroma, aromaKeywordsData);
      if (cat !== "其他") {
        categories.add(cat);
      }
    }
    for (const cat of categories) {
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(record);
    }
  }
  return map;
}

export async function smartPickRecords(
  allRecords: WineRecord[],
  count: number,
  config: SmartPickConfig,
  aromaKeywordsData: { name: string; category: string }[]
): Promise<SmartPickResult> {
  if (allRecords.length === 0 || count <= 0) {
    return {
      records: [],
      stats: [],
      regionBreakdown: [],
      grapeBreakdown: [],
      aromaCategoryBreakdown: [],
    };
  }

  const effectiveCount = Math.min(count, allRecords.length);
  const rawStrategies: SmartPickStrategy[] = config.strategies.length > 0 ? config.strategies : ["regionCoverage"];
  const STRATEGY_PRIORITY: SmartPickStrategy[] = ["weakGrape", "recentUnpracticed", "regionCoverage", "aromaCategory"];
  const strategies = [...rawStrategies].sort((a, b) => STRATEGY_PRIORITY.indexOf(a) - STRATEGY_PRIORITY.indexOf(b));
  const recordsById = new Map(allRecords.map((r) => [r.id, r]));
  const selectedIds = new Set<string>();
  const statsMap = new Map<SmartPickStrategy, number>();
  strategies.forEach((s) => statsMap.set(s, 0));

  const strategyRatios: Record<SmartPickStrategy, number> = {
    regionCoverage: config.regionCoverageRatio ?? 0.3,
    weakGrape: config.weakGrapeRatio ?? 0.3,
    recentUnpracticed: config.recentUnpracticedRatio ?? 0.25,
    aromaCategory: config.aromaCategoryRatio ?? 0.15,
  };

  const totalRatio = strategies.reduce((s, st) => s + strategyRatios[st], 0);
  const normalizedRatios: Record<string, number> = {};
  for (const st of strategies) {
    normalizedRatios[st] = totalRatio > 0 ? strategyRatios[st] / totalRatio : 1 / strategies.length;
  }

  const statsMapAll = await computeWineStats(allRecords);
  const prioritized = await prioritizeWines(allRecords);
  const weightMap = new Map<string, PrioritizedWine>();
  for (const pw of prioritized) {
    if (pw.stats.source === "wineRecord") {
      weightMap.set(pw.stats.id, pw);
    }
  }

  const grapeErrorMap = new Map<string, { attempts: number; errors: number; errorRate: number }>();
  for (const [, stats] of statsMapAll) {
    if (stats.source !== "wineRecord") continue;
    const key = stats.grape;
    if (!grapeErrorMap.has(key)) {
      grapeErrorMap.set(key, { attempts: 0, errors: 0, errorRate: 0 });
    }
    const entry = grapeErrorMap.get(key)!;
    entry.attempts += stats.totalAttempts;
    entry.errors += stats.regionErrorCount + stats.grapeErrorCount + stats.bothErrorCount;
  }
  for (const [, entry] of grapeErrorMap) {
    entry.errorRate = entry.attempts > 0 ? entry.errors / entry.attempts : 0;
  }

  function getRemaining(): WineRecord[] {
    return allRecords.filter((r) => !selectedIds.has(r.id));
  }

  function pickByWeight(pool: WineRecord[], n: number): WineRecord[] {
    if (pool.length === 0 || n <= 0) return [];
    const effective = Math.min(n, pool.length);
    const items = pool.map((record) => ({
      record,
      weight: weightMap.get(record.id)?.finalWeight ?? 1.0,
    }));
    const result: WineRecord[] = [];
    const remaining = [...items];
    for (let i = 0; i < effective; i++) {
      const totalWeight = remaining.reduce((s, item) => s + item.weight, 0);
      let rand = Math.random() * totalWeight;
      let chosenIndex = 0;
      for (let j = 0; j < remaining.length; j++) {
        rand -= remaining[j].weight;
        if (rand <= 0) {
          chosenIndex = j;
          break;
        }
      }
      result.push(remaining[chosenIndex].record);
      remaining.splice(chosenIndex, 1);
    }
    return result;
  }

  function pickFromStrategy(strategy: SmartPickStrategy, targetCount: number): WineRecord[] {
    if (targetCount <= 0) return [];
    const pool = getRemaining();
    if (pool.length === 0) return [];

    if (strategy === "regionCoverage") {
      const regionMap = new Map<string, WineRecord[]>();
      for (const r of pool) {
        const regionKey = matchRegionKey(r.region) || r.region;
        if (!regionMap.has(regionKey)) regionMap.set(regionKey, []);
        regionMap.get(regionKey)!.push(r);
      }
      const regions = Array.from(regionMap.keys());
      const picked: WineRecord[] = [];
      let round = 0;
      while (picked.length < targetCount && regions.length > 0) {
        for (const region of regions) {
          if (picked.length >= targetCount) break;
          const regionRecords = regionMap.get(region) || [];
          const available = regionRecords.filter((r) => !picked.includes(r) && !selectedIds.has(r.id));
          if (available.length > round) {
            picked.push(available[round]);
          }
        }
        round++;
        if (round > 10) break;
      }
      if (picked.length < targetCount) {
        const rest = pool.filter((r) => !picked.includes(r));
        picked.push(...pickByWeight(rest, targetCount - picked.length));
      }
      return picked.slice(0, targetCount);
    }

    if (strategy === "weakGrape") {
      const sortedByWeakness = [...pool].sort((a, b) => {
        const aStat = grapeErrorMap.get(a.grape);
        const bStat = grapeErrorMap.get(b.grape);
        const aRate = aStat?.errorRate ?? 0;
        const bRate = bStat?.errorRate ?? 0;
        if (bRate !== aRate) return bRate - aRate;
        const aAttempts = aStat?.attempts ?? 0;
        const bAttempts = bStat?.attempts ?? 0;
        return bAttempts - aAttempts;
      });
      return sortedByWeakness.slice(0, targetCount);
    }

    if (strategy === "recentUnpracticed") {
      const daysThreshold = config.unpracticedDaysThreshold ?? 7;
      const now = Date.now();
      const sortedByUnpracticed = [...pool].sort((a, b) => {
        const aStat = statsMapAll.get(`wineRecord:${a.id}`);
        const bStat = statsMapAll.get(`wineRecord:${b.id}`);
        const aLast = aStat?.lastAttemptTime ?? 0;
        const bLast = bStat?.lastAttemptTime ?? 0;
        const aDays = aLast === 0 ? 9999 : (now - aLast) / 86400000;
        const bDays = bLast === 0 ? 9999 : (now - bLast) / 86400000;
        if (aDays >= daysThreshold && bDays < daysThreshold) return -1;
        if (bDays >= daysThreshold && aDays < daysThreshold) return 1;
        return bDays - aDays;
      });
      return sortedByUnpracticed.slice(0, targetCount);
    }

    if (strategy === "aromaCategory") {
      const selectedCats = config.selectedAromaCategories && config.selectedAromaCategories.length > 0
        ? config.selectedAromaCategories
        : ["水果", "花香", "草本", "橡木", "陈年风味"];
      const categorized = categorizeRecordsByAroma(pool, aromaKeywordsData);
      const picked: WineRecord[] = [];
      const availableCategories = selectedCats.filter((c) => categorized.has(c) && categorized.get(c)!.length > 0);

      if (availableCategories.length === 0) {
        return pickByWeight(pool, targetCount);
      }

      let catIndex = 0;
      while (picked.length < targetCount) {
        const cat = availableCategories[catIndex % availableCategories.length];
        const catRecords = categorized.get(cat)?.filter((r) => !picked.includes(r) && !selectedIds.has(r.id)) || [];
        if (catRecords.length > 0) {
          const weighted = pickByWeight(catRecords, 1);
          if (weighted.length > 0) {
            picked.push(weighted[0]);
          }
        }
        catIndex++;
        if (catIndex > availableCategories.length * 50) break;
      }

      if (picked.length < targetCount) {
        const rest = pool.filter((r) => !picked.includes(r));
        picked.push(...pickByWeight(rest, targetCount - picked.length));
      }
      return picked.slice(0, targetCount);
    }

    return pickByWeight(pool, targetCount);
  }

  const picksPerStrategy: Record<string, number> = {};
  let remainingToPick = effectiveCount;
  for (let i = 0; i < strategies.length; i++) {
    const st = strategies[i];
    if (i === strategies.length - 1) {
      picksPerStrategy[st] = remainingToPick;
    } else {
      const n = Math.min(Math.round(effectiveCount * normalizedRatios[st]), remainingToPick);
      picksPerStrategy[st] = n;
      remainingToPick -= n;
    }
  }

  const finalRecords: WineRecord[] = [];
  for (const st of strategies) {
    const n = picksPerStrategy[st] ?? 0;
    if (n <= 0) continue;
    const picked = pickFromStrategy(st, n);
    for (const r of picked) {
      if (!selectedIds.has(r.id)) {
        selectedIds.add(r.id);
        finalRecords.push(r);
        statsMap.set(st, (statsMap.get(st) ?? 0) + 1);
      }
    }
  }

  if (finalRecords.length < effectiveCount) {
    const remaining = allRecords.filter((r) => !selectedIds.has(r.id));
    const fill = pickByWeight(remaining, effectiveCount - finalRecords.length);
    for (const r of fill) {
      selectedIds.add(r.id);
      finalRecords.push(r);
    }
  }

  const stats: QuestionSourceStat[] = strategies.map((st) => ({
    strategy: st,
    label: strategyLabels[st],
    count: statsMap.get(st) ?? 0,
    description: strategyDescriptions[st],
  }));

  const regionCount = new Map<string, number>();
  const grapeCount = new Map<string, number>();
  const aromaCatCount = new Map<string, number>();

  for (const r of finalRecords) {
    const regionKey = matchRegionKey(r.region) || r.region;
    regionCount.set(regionKey, (regionCount.get(regionKey) ?? 0) + 1);
    grapeCount.set(r.grape, (grapeCount.get(r.grape) ?? 0) + 1);
    const categories = new Set<string>();
    for (const aroma of r.aromas) {
      const cat = getAromaCategory(aroma, aromaKeywordsData);
      if (cat !== "其他") categories.add(cat);
    }
    for (const cat of categories) {
      aromaCatCount.set(cat, (aromaCatCount.get(cat) ?? 0) + 1);
    }
  }

  return {
    records: shuffleArray(finalRecords),
    stats,
    regionBreakdown: Array.from(regionCount.entries())
      .map(([region, count]) => ({ region, count }))
      .sort((a, b) => b.count - a.count),
    grapeBreakdown: Array.from(grapeCount.entries())
      .map(([grape, count]) => ({ grape, count }))
      .sort((a, b) => b.count - a.count),
    aromaCategoryBreakdown: Array.from(aromaCatCount.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
  };
}

function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
