import { LearningPath, PathGenerationOptions, PathTask } from "./learningPathTypes";
import { generateLearningPath } from "./learningPathEngine";
import { WineRecord } from "./wineRecordTypes";
import {
  openUnifiedDB,
  getAllWineRecords,
  generateId,
  STORES,
} from "./unifiedStore";
import { QuizSession } from "./adaptiveReview";

const LEARNING_PATH_STORE = "learningPaths";
const CURRENT_PATH_KEY = "currentLearningPath";
const PATH_REFRESH_COOLDOWN_MS = 5 * 60 * 1000;

let currentPathCache: LearningPath | null = null;
let lastRefreshTime: number = 0;
let listeners: Set<() => void> = new Set();

export function subscribeToPathChanges(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function notifyListeners() {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // ignore listener errors
    }
  }
}

export async function saveLearningPath(path: LearningPath): Promise<void> {
  const db = await openUnifiedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.metadata, "readwrite");
    const store = tx.objectStore(STORES.metadata);
    store.put({
      key: CURRENT_PATH_KEY,
      value: JSON.stringify(path),
      updatedAt: Date.now(),
    });
    tx.oncomplete = () => {
      currentPathCache = path;
      lastRefreshTime = Date.now();
      notifyListeners();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadLearningPath(): Promise<LearningPath | null> {
  if (currentPathCache) return currentPathCache;

  const db = await openUnifiedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.metadata, "readonly");
    const store = tx.objectStore(STORES.metadata);
    const req = store.get(CURRENT_PATH_KEY);
    req.onsuccess = () => {
      const entry = req.result;
      if (entry && entry.value) {
        try {
          const path = JSON.parse(entry.value) as LearningPath;
          currentPathCache = path;
          lastRefreshTime = Date.now();
          resolve(path);
        } catch {
          resolve(null);
        }
      } else {
        resolve(null);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function clearLearningPath(): Promise<void> {
  const db = await openUnifiedDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.metadata, "readwrite");
    const store = tx.objectStore(STORES.metadata);
    store.delete(CURRENT_PATH_KEY);
    tx.oncomplete = () => {
      currentPathCache = null;
      lastRefreshTime = 0;
      notifyListeners();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCurrentLearningPath(
  records: WineRecord[],
  options: PathGenerationOptions = {},
  forceRefresh: boolean = false
): Promise<LearningPath> {
  const now = Date.now();
  const cached = await loadLearningPath();

  if (!forceRefresh && cached && now - lastRefreshTime < PATH_REFRESH_COOLDOWN_MS) {
    return cached;
  }

  const triggerSource = forceRefresh ? "manual" : cached ? "quiz_completed" : "initial";
  const path = await generateLearningPath(records, options, triggerSource);
  await saveLearningPath(path);
  return path;
}

export async function refreshLearningPath(
  records?: WineRecord[],
  triggerSource: LearningPath["triggerSource"] = "manual"
): Promise<LearningPath> {
  const wineRecords = records || (await getAllWineRecords());
  const path = await generateLearningPath(wineRecords, {}, triggerSource);
  await saveLearningPath(path);
  return path;
}

export async function triggerPathRefreshAfterQuiz(
  session: QuizSession,
  records: WineRecord[]
): Promise<LearningPath> {
  return refreshLearningPath(records, "quiz_completed");
}

export async function triggerPathRefreshAfterImport(
  records: WineRecord[]
): Promise<LearningPath> {
  return refreshLearningPath(records, "profile_imported");
}

export async function triggerPathRefreshAfterRecordsChange(
  records: WineRecord[]
): Promise<LearningPath> {
  return refreshLearningPath(records, "records_changed");
}

export async function togglePathTaskCompleted(
  taskId: string,
  completed?: boolean
): Promise<boolean> {
  const path = await loadLearningPath();
  if (!path) return false;

  let newCompletedState = false;
  for (const day of path.days) {
    for (const task of day.tasks) {
      if (task.id === taskId) {
        newCompletedState = completed !== undefined ? completed : !task.completed;
        task.completed = newCompletedState;
        task.completedAt = newCompletedState ? Date.now() : null;
        if (newCompletedState) {
          day.stats.completedTasks++;
        } else {
          day.stats.completedTasks = Math.max(0, day.stats.completedTasks - 1);
        }
        break;
      }
    }
  }

  await saveLearningPath(path);
  return newCompletedState;
}

export async function getPathTaskById(taskId: string): Promise<PathTask | null> {
  const path = await loadLearningPath();
  if (!path) return null;

  for (const day of path.days) {
    for (const task of day.tasks) {
      if (task.id === taskId) return task;
    }
  }
  return null;
}

export async function getTodayTasks(): Promise<PathTask[]> {
  const path = await loadLearningPath();
  if (!path || path.days.length === 0) return [];
  return path.days[0].tasks;
}

export async function getOverallProgress(): Promise<{
  totalTasks: number;
  completedTasks: number;
  percentage: number;
}> {
  const path = await loadLearningPath();
  if (!path) return { totalTasks: 0, completedTasks: 0, percentage: 0 };

  let total = 0;
  let completed = 0;
  for (const day of path.days) {
    total += day.stats.totalTasks;
    completed += day.stats.completedTasks;
  }

  return {
    totalTasks: total,
    completedTasks: completed,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

export async function getWeeklyProgress(): Promise<
  Array<{
    dayOffset: number;
    dayLabel: string;
    totalTasks: number;
    completedTasks: number;
    percentage: number;
  }>
> {
  const path = await loadLearningPath();
  if (!path) return [];

  return path.days.map((day) => ({
    dayOffset: day.dayOffset,
    dayLabel: day.dayLabel,
    totalTasks: day.stats.totalTasks,
    completedTasks: day.stats.completedTasks,
    percentage:
      day.stats.totalTasks > 0
        ? Math.round((day.stats.completedTasks / day.stats.totalTasks) * 100)
        : 0,
  }));
}

export interface PathInsight {
  type: "weakness" | "coverage" | "achievement" | "reminder";
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
}

export async function getPathInsights(): Promise<PathInsight[]> {
  const path = await loadLearningPath();
  if (!path) return [];

  const insights: PathInsight[] = [];
  const today = path.days[0];

  if (today) {
    if (today.stats.confusionCount > 0) {
      insights.push({
        type: "reminder",
        title: "今日重点：易混淆辨析",
        description: `今天有${today.stats.confusionCount}个易混淆酒款对比练习，请关注它们的区别特征`,
        priority: "high",
      });
    }

    if (today.stats.newLearnCount > 0) {
      insights.push({
        type: "reminder",
        title: "今日新内容",
        description: `今天将学习${today.stats.newLearnCount}款新酒，建议预留充足时间`,
        priority: "medium",
      });
    }

    if (today.stats.aromaCount > 0) {
      insights.push({
        type: "reminder",
        title: "香气专项训练",
        description: `今天有${today.stats.aromaCount}个香气专项任务，建议对照香气词库学习`,
        priority: "medium",
      });
    }
  }

  if (path.overallStats.coverageGaps.length > 0) {
    const topGap = path.overallStats.coverageGaps[0];
    insights.push({
      type: "coverage",
      title: "知识覆盖缺口",
      description: `${topGap.type === "region" ? "产区" : topGap.type === "grape" ? "品种" : "香气"}「${topGap.name}」覆盖率仅${topGap.coverageRate}%`,
      priority: topGap.coverageRate < 30 ? "high" : "medium",
    });
  }

  if (path.overallStats.weaknessDimensions.length > 0) {
    const topWeakness = path.overallStats.weaknessDimensions.sort(
      (a, b) => b.count - a.count
    )[0];
    const weaknessName: Record<string, string> = {
      region: "产区识别",
      grape: "品种识别",
      aroma: "香气辨识",
      both: "产区+品种双错",
    };
    insights.push({
      type: "weakness",
      title: "主要薄弱维度",
      description: `${weaknessName[topWeakness.dimension]}相关任务共${topWeakness.count}个，需重点关注`,
      priority: "high",
    });
  }

  const progress = await getOverallProgress();
  if (progress.percentage >= 50) {
    insights.push({
      type: "achievement",
      title: "学习进度过半",
      description: `已完成${progress.completedTasks}/${progress.totalTasks}个任务，继续加油！`,
      priority: "low",
    });
  }

  return insights.sort((a, b) => {
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}
