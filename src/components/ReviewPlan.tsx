import { useState, useEffect, useCallback } from "react";

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
}

interface ReviewGroup {
  stage: ReviewStage;
  scheduledDate: Date;
  tasks: ReviewTask[];
}

interface ReviewPlanProps {
  records: ReviewRecord[];
  onAromaClick?: (aroma: string) => void;
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

export default function ReviewPlan({ records, onAromaClick }: ReviewPlanProps) {
  const [today] = useState(() => startOfDay(new Date()));
  const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>(
    loadCompleted
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(completedTasks));
    } catch {
      // ignore storage errors (e.g. private browsing)
    }
  }, [completedTasks]);

  const toggleTask = useCallback((taskId: string) => {
    setCompletedTasks((prev) => {
      const next = { ...prev };
      if (next[taskId]) {
        delete next[taskId];
      } else {
        next[taskId] = true;
      }
      return next;
    });
  }, []);

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
    return { stage, scheduledDate, tasks };
  });

  const todayTasks = groups[0].tasks;
  const todayTotal = todayTasks.length;
  const todayDone = todayTasks.filter((t) => t.completed).length;
  const progress =
    todayTotal > 0 ? Math.round((todayDone / todayTotal) * 100) : 0;

  return (
    <section className="review-plan panel">
      <div className="section-heading">
        <div>
          <p>间隔复习</p>
          <h2>近期复习计划</h2>
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
          const done = group.tasks.filter((t) => t.completed).length;
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
                  {done}/{group.tasks.length} · {cfg.hint}
                </span>
              </div>

              <div className="review-task-list">
                {group.tasks.map((task) => (
                  <article
                    key={task.id}
                    className={`review-task ${
                      task.completed ? "review-task-done" : ""
                    }`}
                  >
                    <button
                      className="review-check"
                      onClick={() => toggleTask(task.id)}
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
