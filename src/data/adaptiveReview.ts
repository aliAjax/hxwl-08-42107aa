import { WineCard, wineCards, wineComparisons, WineComparison } from "./wineData";
import { WineRecord } from "./wineRecordTypes";
import { matchRegionKey, REGION_GROUPS } from "./regionStats";

const HISTORY_STORAGE_KEY = "hxwl-08-quiz-history";
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

function loadRawHistory(): QuizSession[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QuizSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRawHistory(sessions: QuizSession[]): void {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // ignore storage errors
  }
}

export function saveQuizSession(session: QuizSession): void {
  const all = loadRawHistory();
  all.push(session);
  saveRawHistory(all);
}

export function getAllSessions(): QuizSession[] {
  return loadRawHistory();
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

export function seedDemoHistoryIfEmpty(records: WineRecord[]): void {
  const flag = localStorage.getItem(SEED_HISTORY_FLAG);
  if (flag === "1") return;
  const existing = loadRawHistory();
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

  saveRawHistory(sessions);
  localStorage.setItem(SEED_HISTORY_FLAG, "1");
}

export function computeWineStats(records: WineRecord[]): Map<string, WineStats> {
  const sessions = getAllSessions();
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

export function computeConfusionPairs(records: WineRecord[]): ConfusionPair[] {
  const sessions = getAllSessions();
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

export function prioritizeWines(records: WineRecord[]): PrioritizedWine[] {
  const statsMap = computeWineStats(records);
  const confusionPairs = computeConfusionPairs(records);
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

export function buildAdaptiveDashboard(records: WineRecord[]): AdaptiveDashboardData {
  seedDemoHistoryIfEmpty(records);
  const prioritizedWines = prioritizeWines(records);
  const confusionPairs = computeConfusionPairs(records);
  const sessions = getAllSessions();

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

export function clearAllHistory(): void {
  localStorage.removeItem(HISTORY_STORAGE_KEY);
  localStorage.removeItem(SEED_HISTORY_FLAG);
}

export function weightedSampleCards(
  pool: WineCard[],
  count: number,
  records: WineRecord[]
): WineCard[] {
  if (pool.length === 0) return [];
  const effective = Math.min(count, pool.length);

  const prioritized = prioritizeWines(records);
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

export function weightedSampleRecords(
  pool: WineRecord[],
  count: number,
  records: WineRecord[]
): WineRecord[] {
  if (pool.length === 0) return [];
  const effective = Math.min(count, pool.length);

  const prioritized = prioritizeWines(records);
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
