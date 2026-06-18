import { useState, useEffect, useCallback, useMemo } from "react";
import { syncReviewTasksToProfile } from "../data/learningProfileSync";
import {
  getAdaptiveReviewTasks,
  toggleAdaptiveTaskCompleted,
  syncAdaptiveTasksToProfile,
  AdaptiveReviewTask,
  scopeLabels,
  GenerationScope,
} from "../data/adaptiveReview";

export interface ReviewRecord {
  name: string;
  grape: string;
  characteristic: string;
  aromas: string[];
}

type ReviewStage = "today" | "three-days" | "one-week";

interface ReviewTask {
  id: string;
  wineName: string;
  grape: string;
  characteristic: string;
  aromas: string[];
  stage: ReviewStage;
  scheduledDate: Date;
  completed: boolean;
  isAdaptive?: boolean;
  adaptiveScope?: GenerationScope;
  adaptiveRank?: number;
  adaptiveWeight?: number;
}

interface ReviewGroup {
  stage: ReviewStage;
  scheduledDate: Date;
  tasks: ReviewTask[];
  adaptiveTasks: ReviewTask[];
}

interface ReviewPlanProps {
  records: ReviewRecord[];
  onAromaClick?: (aroma: string) => void;
  refreshSignal?: number;
  onTaskStatusChanged?: () => void;
}

const STORAGE_KEY = "hxwl-08-review-status";

const stageConfig: Record<
  ReviewStage,
  { label: string; hint: string; offset: number }
> = {
  today: { label: "今天复习", hint: "今日待办", offset: 0 },
  "three-days": { label: "三天后巩固", hint: "短期记忆", offset: 3 },
  "one-week": { label: "一周后回忆", hint: "长期记忆", offset: 7 },
};

const stageOrder: ReviewStage[] = ["today", "three-days", "one-week"];

const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日 · ${weekdays[date.getDay()]}`;
}

function loadCompleted(): Record<string, boolean> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export default function ReviewPlan({
  records,
  onAromaClick,
  refreshSignal,
  onTaskStatusChanged,
}: ReviewPlanProps) {
  const [today] = useState(() => startOfDay(new Date()));
  const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>(
    loadCompleted
  );
  const [adaptiveTasks, setAdaptiveTasks] = useState<AdaptiveReviewTask[]>([]);
  const [adaptiveVersion, setAdaptiveVersion] = useState(0);

  const loadAdaptive = useCallback(() => {
    setAdaptiveTasks(getAdaptiveReviewTasks());
    setAdaptiveVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    loadAdaptive();
  }, [refreshSignal, loadAdaptive]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(completedTasks));
    } catch {
      // ignore storage errors (e.g. private browsing)
    }
  }, [completedTasks]);

  useEffect(() => {
    const allTasks = stageOrder.flatMap((stage) => {
      const scheduledDate = addDays(today, stageConfig[stage].offset);
      const dateKey = formatDateKey(scheduledDate);
      return records.map((record, index) => {
        const id = `${index}-${stage}-${dateKey}`;
        return {
          id,
          wineName: record.name,
          grape: record.grape,
          stage: stage as "today" | "three-days" | "one-week",
          scheduledDate,
          completed: Boolean(completedTasks[id]),
          completedAt: completedTasks[id] ? Date.now() : null,
        };
      });
    });
    syncReviewTasksToProfile(allTasks);
  }, [records, today, completedTasks]);

  const toggleTask = useCallback(
    async (taskId: string, isAdaptive: boolean = false) => {
      if (isAdaptive) {
        toggleAdaptiveTaskCompleted(taskId);
        loadAdaptive();
        try {
          await syncAdaptiveTasksToProfile();
        } catch {
        }
      } else {
        setCompletedTasks((prev) => {
          const next = { ...prev };
          if (next[taskId]) {
            delete next[taskId];
          } else {
            next[taskId] = true;
          }
          return next;
        });
      }
      onTaskStatusChanged?.();
    },
    [loadAdaptive, onTaskStatusChanged]
  );

  const adaptiveTasksByStage = useMemo(() => {
    const map: Record<ReviewStage, ReviewTask[]> = {
      today: [],
      "three-days": [],
      "one-week": [],
    };
    for (const at of adaptiveTasks) {
      const [y, m, d] = at.scheduledDate.split("-").map(Number);
      const task: ReviewTask = {
        id: at.id,
        wineName: at.wineName,
        grape: at.grape,
        characteristic: at.characteristic,
        aromas: at.aromas,
        stage: at.stage,
        scheduledDate: new Date(y, m - 1, d),
        completed: at.completed,
        isAdaptive: true,
        adaptiveScope: at.generationScope,
        adaptiveRank: at.rank,
        adaptiveWeight: at.weight,
      };
      if (map[at.stage]) {
        map[at.stage].push(task);
      }
    }
    for (const stage of stageOrder) {
      map[stage].sort((a, b) => (a.adaptiveRank ?? 0) - (b.adaptiveRank ?? 0));
    }
    return map;
  }, [adaptiveTasks, adaptiveVersion]);

  const groups: ReviewGroup[] = stageOrder.map((stage) => {
    const scheduledDate = addDays(today, stageConfig[stage].offset);
    const dateKey = formatDateKey(scheduledDate);
    const tasks: ReviewTask[] = records.map((record, index) => {
      const id = `${index}-${stage}-${dateKey}`;
      return {
        id,
        wineName: record.name,
        grape: record.grape,
        characteristic: record.characteristic,
        aromas: record.aromas,
        stage,
        scheduledDate,
        completed: Boolean(completedTasks[id]),
      };
    });
    return {
      stage,
      scheduledDate,
      tasks,
      adaptiveTasks: adaptiveTasksByStage[stage],
    };
  });

  const todayTasks = [...groups[0].tasks, ...groups[0].adaptiveTasks];
  const todayTotal = todayTasks.length;
  const todayDone = todayTasks.filter((t) => t.completed).length;
  const progress =
    todayTotal > 0 ? Math.round((todayDone / todayTotal) * 100) : 0;

  const hasAdaptiveToday = groups[0].adaptiveTasks.length > 0;

  return (
    <section className="review-plan panel">
      <div className="section-heading">
        <div>
          <p>间隔复习</p>
          <h2>近期复习计划</h2>
          {hasAdaptiveToday && (
            <div
              style={{
                marginTop: "6px",
                fontSize: "12px",
                color: "var(--accent)",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px",
                background: "rgba(124, 92, 255, 0.1)",
                borderRadius: "20px",
                fontWeight: 500,
              }}
            >
              🎯 今日含 {groups[0].adaptiveTasks.length} 条自适应任务
            </div>
          )}
        </div>
        <div className="review-progress">
          <span>今日进度</span>
          <strong>
            {todayDone}/{todayTotal}
          </strong>
        </div>
      </div>

      <div className="review-progress-bar">
        <div
          className="review-progress-fill"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="review-groups">
        {groups.map((group) => {
          const cfg = stageConfig[group.stage];
          const done =
            group.tasks.filter((t) => t.completed).length +
            group.adaptiveTasks.filter((t) => t.completed).length;
          const isActive = group.stage === "today";
          return (
            <div
              key={group.stage}
              className={`review-group ${
                isActive ? "review-group-active" : ""
              }`}
            >
              <div className="review-group-header">
                <div className="review-group-title">
                  <span className="review-group-dot" />
                  <h3>{cfg.label}</h3>
                  <span className="review-group-date">
                    {formatDisplayDate(group.scheduledDate)}
                  </span>
                </div>
                <span className="review-group-hint">
                  {done}/{group.tasks.length + group.adaptiveTasks.length}
                  {group.adaptiveTasks.length > 0 &&
                    ` (含${group.adaptiveTasks.length}自适应)`}
                  {" · "}{cfg.hint}
                </span>
              </div>

              <div className="review-task-list">
                {group.adaptiveTasks.length > 0 && (
                  <div
                    style={{
                      margin: "8px 0 4px",
                      padding: "6px 12px",
                      background:
                        "linear-gradient(90deg, rgba(124, 92, 255, 0.12), transparent)",
                      borderRadius: "6px",
                      borderLeft: "3px solid var(--accent)",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "var(--accent)",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    🎯 自适应生成任务 · {group.adaptiveTasks.length} 条
                  </div>
                )}
                {group.adaptiveTasks.map((task) => (
                  <article
                    key={task.id}
                    className={`review-task ${
                      task.completed ? "review-task-done" : ""
                    }`}
                    style={{
                      border: "1px solid rgba(124, 92, 255, 0.25)",
                      background: task.completed
                        ? "linear-gradient(135deg, rgba(99,102,241,0.04), rgba(124,92,255,0.02))"
                        : "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(124,92,255,0.04))",
                    }}
                  >
                    <button
                      className="review-check"
                      onClick={() => toggleTask(task.id, true)}
                      aria-pressed={task.completed}
                      title={task.completed ? "标记为未完成" : "标记为已完成"}
                      style={{
                        borderColor: task.completed ? "var(--accent)" : undefined,
                        background: task.completed ? "var(--accent)" : undefined,
                      }}
                    >
                      {task.completed ? "✓" : ""}
                    </button>

                    <div className="review-task-body">
                      <div className="review-task-head">
                        <h4 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          {task.wineName}
                          <span
                            style={{
                              fontSize: "10px",
                              padding: "2px 8px",
                              borderRadius: "10px",
                              background:
                                task.adaptiveScope === "highPriority"
                                  ? "rgba(239, 68, 68, 0.12)"
                                  : task.adaptiveScope === "unpracticed"
                                  ? "rgba(59, 130, 246, 0.12)"
                                  : "rgba(245, 158, 11, 0.12)",
                              color:
                                task.adaptiveScope === "highPriority"
                                  ? "#ef4444"
                                  : task.adaptiveScope === "unpracticed"
                                  ? "#3b82f6"
                                  : "#f59e0b",
                              fontWeight: 600,
                            }}
                          >
                            {task.adaptiveScope ? scopeLabels[task.adaptiveScope] : ""}
                          </span>
                          {task.adaptiveRank !== undefined && (
                            <span
                              style={{
                                fontSize: "10px",
                                padding: "2px 6px",
                                borderRadius: "8px",
                                background: "var(--bg-secondary)",
                                color: "var(--text-muted)",
                              }}
                            >
                              #{task.adaptiveRank}
                            </span>
                          )}
                        </h4>
                        <span className="review-task-meta">
                          {task.grape} · {task.characteristic}
                        </span>
                      </div>

                      <div className="review-clues">
                        <span className="review-clues-label">重点线索</span>
                        <div className="review-clue-tags">
                          {task.aromas.map((aroma) => (
                            <button
                              key={aroma}
                              className="review-clue-tag"
                              onClick={() => onAromaClick?.(aroma)}
                              title={`在词库中查看「${aroma}」`}
                            >
                              {aroma}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`review-status ${
                        task.completed
                          ? "review-status-done"
                          : "review-status-pending"
                      }`}
                    >
                      {task.completed ? "已完成" : "待复习"}
                    </span>
                  </article>
                ))}
                {group.adaptiveTasks.length > 0 && group.tasks.length > 0 && (
                  <div
                    style={{
                      margin: "12px 0 4px",
                      padding: "6px 12px",
                      background: "var(--bg-secondary)",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: 500,
                      color: "var(--text-muted)",
                    }}
                  >
                    📋 常规复习计划
                  </div>
                )}
                {group.tasks.map((task) => (
                  <article
                    key={task.id}
                    className={`review-task ${
                      task.completed ? "review-task-done" : ""
                    }`}
                  >
                    <button
                      className="review-check"
                      onClick={() => toggleTask(task.id, false)}
                      aria-pressed={task.completed}
                      title={task.completed ? "标记为未完成" : "标记为已完成"}
                    >
                      {task.completed ? "✓" : ""}
                    </button>

                    <div className="review-task-body">
                      <div className="review-task-head">
                        <h4>{task.wineName}</h4>
                        <span className="review-task-meta">
                          {task.grape} · {task.characteristic}
                        </span>
                      </div>

                      <div className="review-clues">
                        <span className="review-clues-label">重点线索</span>
                        <div className="review-clue-tags">
                          {task.aromas.map((aroma) => (
                            <button
                              key={aroma}
                              className="review-clue-tag"
                              onClick={() => onAromaClick?.(aroma)}
                              title={`在词库中查看「${aroma}」`}
                            >
                              {aroma}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`review-status ${
                        task.completed
                          ? "review-status-done"
                          : "review-status-pending"
                      }`}
                    >
                      {task.completed ? "已完成" : "待复习"}
                    </span>
                  </article>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
