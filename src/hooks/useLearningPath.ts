import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  LearningPath,
  PathTask,
  PathGenerationOptions,
  DailyPlan,
} from "../data/learningPathTypes";
import {
  getCurrentLearningPath,
  togglePathTaskCompleted,
  getTodayTasks,
  getOverallProgress,
  getWeeklyProgress,
  getPathInsights,
  PathInsight,
  subscribeToPathChanges,
  refreshLearningPath,
} from "../data/learningPathStore";
import { WineRecord } from "../data/wineRecordTypes";
import {
  taskTypeLabels,
  taskTypeHints,
  forgettingStageLabels,
} from "../data/learningPathEngine";

interface UseLearningPathReturn {
  learningPath: LearningPath | null;
  loading: boolean;
  error: string | null;
  todayTasks: PathTask[];
  overallProgress: {
    totalTasks: number;
    completedTasks: number;
    percentage: number;
  };
  weeklyProgress: Array<{
    dayOffset: number;
    dayLabel: string;
    totalTasks: number;
    completedTasks: number;
    percentage: number;
  }>;
  insights: PathInsight[];
  toggleTask: (taskId: string, completed?: boolean) => Promise<boolean>;
  refresh: (records: WineRecord[], force?: boolean) => Promise<void>;
  getDayPlan: (dayOffset: number) => DailyPlan | null;
}

const DEFAULT_PATH_OPTIONS: PathGenerationOptions = {};

export function useLearningPath(
  records: WineRecord[],
  options: PathGenerationOptions = DEFAULT_PATH_OPTIONS
): UseLearningPathReturn {
  const [learningPath, setLearningPath] = useState<LearningPath | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pathVersion, setPathVersion] = useState(0);
  const recordsRef = useRef(records);
  const optionsRef = useRef(options);

  useEffect(() => {
    recordsRef.current = records;
  }, [records]);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const loadPath = useCallback(async () => {
    const currentRecords = recordsRef.current;
    const currentOptions = optionsRef.current;
    if (currentRecords.length === 0) {
      setLoading(false);
      setLearningPath(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const path = await getCurrentLearningPath(currentRecords, currentOptions);
      setLearningPath(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载学习路径失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPath();
  }, [loadPath]);

  useEffect(() => {
    loadPath();
  }, [records.length, options.daysAhead, options.maxTasksPerDay, loadPath]);

  useEffect(() => {
    const unsubscribe = subscribeToPathChanges(() => {
      setPathVersion((v) => v + 1);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (pathVersion > 0) {
      loadPath();
    }
  }, [pathVersion, loadPath]);

  const toggleTask = useCallback(async (taskId: string, completed?: boolean) => {
    try {
      const result = await togglePathTaskCompleted(taskId, completed);
      return result;
    } catch (err) {
      console.error("Toggle task failed:", err);
      return false;
    }
  }, []);

  const refresh = useCallback(
    async (records: WineRecord[], force: boolean = false) => {
      try {
        setLoading(true);
        setError(null);
        if (force) {
          await refreshLearningPath(records, "manual");
        } else {
          await getCurrentLearningPath(records, options, true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "刷新学习路径失败");
      } finally {
        setLoading(false);
      }
    },
    [options]
  );

  const todayTasks = useMemo(() => {
    if (!learningPath || learningPath.days.length === 0) return [];
    return learningPath.days[0].tasks;
  }, [learningPath]);

  const overallProgress = useMemo(() => {
    if (!learningPath)
      return { totalTasks: 0, completedTasks: 0, percentage: 0 };
    let total = 0;
    let completed = 0;
    for (const day of learningPath.days) {
      total += day.stats.totalTasks;
      completed += day.stats.completedTasks;
    }
    return {
      totalTasks: total,
      completedTasks: completed,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }, [learningPath]);

  const weeklyProgress = useMemo(() => {
    if (!learningPath) return [];
    return learningPath.days.map((day) => ({
      dayOffset: day.dayOffset,
      dayLabel: day.dayLabel,
      totalTasks: day.stats.totalTasks,
      completedTasks: day.stats.completedTasks,
      percentage:
        day.stats.totalTasks > 0
          ? Math.round((day.stats.completedTasks / day.stats.totalTasks) * 100)
          : 0,
    }));
  }, [learningPath]);

  const insights = useMemo(() => {
    if (!learningPath) return [];
    const result: PathInsight[] = [];
    const today = learningPath.days[0];

    if (today) {
      if (today.stats.confusionCount > 0) {
        result.push({
          type: "reminder",
          title: "今日重点：易混淆辨析",
          description: `今天有${today.stats.confusionCount}个易混淆酒款对比练习，请关注它们的区别特征`,
          priority: "high",
        });
      }
      if (today.stats.newLearnCount > 0) {
        result.push({
          type: "reminder",
          title: "今日新内容",
          description: `今天将学习${today.stats.newLearnCount}款新酒，建议预留充足时间`,
          priority: "medium",
        });
      }
      if (today.stats.aromaCount > 0) {
        result.push({
          type: "reminder",
          title: "香气专项训练",
          description: `今天有${today.stats.aromaCount}个香气专项任务，建议对照香气词库学习`,
          priority: "medium",
        });
      }
    }

    if (learningPath.overallStats.coverageGaps.length > 0) {
      const topGap = learningPath.overallStats.coverageGaps[0];
      result.push({
        type: "coverage",
        title: "知识覆盖缺口",
        description: `${topGap.type === "region" ? "产区" : topGap.type === "grape" ? "品种" : "香气"}「${topGap.name}」覆盖率仅${topGap.coverageRate}%`,
        priority: topGap.coverageRate < 30 ? "high" : "medium",
      });
    }

    if (learningPath.overallStats.weaknessDimensions.length > 0) {
      const topWeakness = [...learningPath.overallStats.weaknessDimensions].sort(
        (a, b) => b.count - a.count
      )[0];
      const weaknessName: Record<string, string> = {
        region: "产区识别",
        grape: "品种识别",
        aroma: "香气辨识",
        both: "产区+品种双错",
      };
      result.push({
        type: "weakness",
        title: "主要薄弱维度",
        description: `${weaknessName[topWeakness.dimension]}相关任务共${topWeakness.count}个，需重点关注`,
        priority: "high",
      });
    }

    if (overallProgress.percentage >= 50) {
      result.push({
        type: "achievement",
        title: "学习进度过半",
        description: `已完成${overallProgress.completedTasks}/${overallProgress.totalTasks}个任务，继续加油！`,
        priority: "low",
      });
    }

    return result.sort((a, b) => {
      const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }, [learningPath, overallProgress]);

  const getDayPlan = useCallback(
    (dayOffset: number): DailyPlan | null => {
      if (!learningPath) return null;
      return learningPath.days[dayOffset] || null;
    },
    [learningPath]
  );

  return {
    learningPath,
    loading,
    error,
    todayTasks,
    overallProgress,
    weeklyProgress,
    insights,
    toggleTask,
    refresh,
    getDayPlan,
  };
}

export { taskTypeLabels, taskTypeHints, forgettingStageLabels };
