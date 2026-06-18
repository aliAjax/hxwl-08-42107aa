import { useState, useCallback, useMemo, useEffect } from "react";
import { useLearningPath, taskTypeLabels, forgettingStageLabels, taskTypeHints } from "../hooks/useLearningPath";
import { WineRecord } from "../data/wineRecordTypes";
import { PathTask, ExplanationEvidence } from "../data/learningPathTypes";
import { categoryConfig } from "../data/aromaData";

interface LearningPathPanelProps {
  records: WineRecord[];
  refreshSignal?: number;
  onAromaClick?: (aroma: string) => void;
  onWineSelect?: (wine: { id: string; source: string }) => void;
}

const evidenceTypeLabels: Record<ExplanationEvidence["type"], { label: string; icon: string; color: string }> = {
  mistake_history: { label: "错误历史", icon: "❌", color: "#ef4444" },
  forgetting_curve: { label: "记忆曲线", icon: "📈", color: "#f59e0b" },
  coverage_gap: { label: "覆盖缺口", icon: "🔲", color: "#3b82f6" },
  confusion_link: { label: "易混淆", icon: "🔄", color: "#8b5cf6" },
  weak_dimension: { label: "薄弱维度", icon: "⚠️", color: "#f97316" },
};

export default function LearningPathPanel({
  records,
  refreshSignal = 0,
  onAromaClick,
  onWineSelect,
}: LearningPathPanelProps) {
  const {
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
  } = useLearningPath(records, { daysAhead: 7, maxTasksPerDay: 5 });

  const [activeDay, setActiveDay] = useState(0);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState<string | null>(null);

  useEffect(() => {
    if (refreshSignal > 0) {
      setActiveDay(0);
    }
  }, [refreshSignal]);

  const activeDayPlan = useMemo(() => {
    return getDayPlan(activeDay);
  }, [activeDay, getDayPlan]);

  const handleToggleTask = useCallback(
    async (taskId: string) => {
      await toggleTask(taskId);
    },
    [toggleTask]
  );

  const handleRefresh = useCallback(async () => {
    await refresh(records, true);
  }, [refresh, records]);

  const formatDateKey = (dateKey: string): string => {
    const [y, m, d] = dateKey.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    return `${m}月${d}日 · ${weekdays[date.getDay()]}`;
  };

  if (loading) {
    return (
      <section className="learning-path-panel panel">
        <div className="section-heading">
          <div>
            <p>智能学习规划</p>
            <h2>📚 7天学习路径</h2>
          </div>
        </div>
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>⏳</div>
          <p style={{ marginBottom: "8px" }}>正在生成个性化学习路径...</p>
          <p style={{ fontSize: "12px" }}>基于您的学习历史、遗忘曲线和知识覆盖度智能规划</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="learning-path-panel panel">
        <div className="section-heading">
          <div>
            <p>智能学习规划</p>
            <h2>📚 7天学习路径</h2>
          </div>
        </div>
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#ef4444" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>❌</div>
          <p style={{ marginBottom: "8px" }}>{error}</p>
          <button
            onClick={handleRefresh}
            style={{
              marginTop: "12px",
              padding: "8px 20px",
              background: "var(--accent)",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            重新生成
          </button>
        </div>
      </section>
    );
  }

  if (!learningPath || records.length === 0) {
    return (
      <section className="learning-path-panel panel">
        <div className="section-heading">
          <div>
            <p>智能学习规划</p>
            <h2>📚 7天学习路径</h2>
          </div>
        </div>
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>📖</div>
          <h3 style={{ fontSize: "16px", color: "var(--text)", marginBottom: "8px" }}>
            开始您的学习之旅
          </h3>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "20px" }}>
            添加葡萄酒记录或开始测验后，系统将自动生成个性化学习路径
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              maxWidth: "280px",
              margin: "0 auto",
              textAlign: "left",
              padding: "16px",
              background: "var(--bg-secondary)",
              borderRadius: "10px",
            }}
          >
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              <span style={{ color: "var(--accent)", marginRight: "8px" }}>✓</span>
              基于艾宾浩斯遗忘曲线智能安排复习
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              <span style={{ color: "var(--accent)", marginRight: "8px" }}>✓</span>
              识别薄弱维度和知识覆盖缺口
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              <span style={{ color: "var(--accent)", marginRight: "8px" }}>✓</span>
              每个推荐都有完整的可解释依据
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="learning-path-panel panel">
      <div className="section-heading">
        <div>
          <p>智能学习规划</p>
          <h2>📚 7天学习路径</h2>
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
            {learningPath.triggerSource === "initial" && "🎯 初始生成"}
            {learningPath.triggerSource === "quiz_completed" && "✅ 测验完成后更新"}
            {learningPath.triggerSource === "profile_imported" && "📥 档案导入后更新"}
            {learningPath.triggerSource === "records_changed" && "📝 记录变更后更新"}
            {learningPath.triggerSource === "manual" && "🔄 手动刷新"}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div className="review-progress">
            <span>总进度</span>
            <strong>
              {overallProgress.completedTasks}/{overallProgress.totalTasks}
            </strong>
          </div>
          <button
            onClick={handleRefresh}
            style={{
              padding: "6px 12px",
              fontSize: "12px",
              background: "transparent",
              border: "1px solid var(--accent)",
              color: "var(--accent)",
              borderRadius: "8px",
              cursor: "pointer",
            }}
            title="重新生成学习路径"
          >
            🔄 刷新计划
          </button>
        </div>
      </div>

      <div className="review-progress-bar" style={{ marginBottom: "16px" }}>
        <div
          className="review-progress-fill"
          style={{ width: `${overallProgress.percentage}%` }}
        />
      </div>

      {insights.length > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <h3 style={{ fontSize: "14px", marginBottom: "12px", color: "var(--text)" }}>
            💡 学习洞察
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {insights.slice(0, 4).map((insight, idx) => (
              <div
                key={idx}
                style={{
                  padding: "10px 14px",
                  background:
                    insight.priority === "high"
                      ? "rgba(239, 68, 68, 0.08)"
                      : insight.priority === "medium"
                      ? "rgba(245, 158, 11, 0.08)"
                      : "rgba(16, 185, 129, 0.08)",
                  borderRadius: "10px",
                  borderLeft: `3px solid ${
                    insight.priority === "high"
                      ? "#ef4444"
                      : insight.priority === "medium"
                      ? "#f59e0b"
                      : "#10b981"
                  }`,
                }}
              >
                <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "2px" }}>
                  {insight.title}
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  {insight.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "8px",
          marginBottom: "16px",
        }}
      >
        {weeklyProgress.map((day) => (
          <button
            key={day.dayOffset}
            onClick={() => setActiveDay(day.dayOffset)}
            style={{
              padding: "12px 8px",
              background: activeDay === day.dayOffset ? "var(--accent)" : "var(--bg-secondary)",
              color: activeDay === day.dayOffset ? "white" : "var(--text)",
              border: "none",
              borderRadius: "10px",
              cursor: "pointer",
              transition: "all 0.2s",
              position: "relative",
            }}
          >
            <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
              {day.dayLabel}
            </div>
            <div style={{ fontSize: "18px", fontWeight: 700, marginBottom: "4px" }}>
              {day.completedTasks}/{day.totalTasks}
            </div>
            {day.totalTasks > 0 && (
              <div
                style={{
                  height: "4px",
                  background: "rgba(255,255,255,0.2)",
                  borderRadius: "2px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    background: activeDay === day.dayOffset ? "white" : "var(--accent)",
                    width: `${day.percentage}%`,
                    borderRadius: "2px",
                  }}
                />
              </div>
            )}
          </button>
        ))}
      </div>

      {activeDayPlan && (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
              padding: "12px 16px",
              background: "var(--bg-secondary)",
              borderRadius: "10px",
            }}
          >
            <div>
              <h3 style={{ fontSize: "15px", margin: 0 }}>
                {formatDateKey(activeDayPlan.dateKey)} · {activeDayPlan.dayLabel}
              </h3>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                {activeDayPlan.stats.totalTasks}个任务 · 约{activeDayPlan.stats.estimatedTotalMinutes}分钟
                {activeDayPlan.stats.newLearnCount > 0 &&
                  ` · 新学${activeDayPlan.stats.newLearnCount}`}
                {activeDayPlan.stats.reviewCount > 0 &&
                  ` · 复习${activeDayPlan.stats.reviewCount}`}
                {activeDayPlan.stats.confusionCount > 0 &&
                  ` · 辨析${activeDayPlan.stats.confusionCount}`}
              </div>
            </div>
            {activeDayPlan.stats.weaknessSummary.length > 0 && (
              <div style={{ fontSize: "11px", color: "var(--accent)" }}>
                重点: {activeDayPlan.stats.weaknessSummary.join("、")}
              </div>
            )}
          </div>

          {activeDayPlan.stats.coverageGaps.length > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <div
                style={{
                  padding: "10px 14px",
                  background: "rgba(59, 130, 246, 0.08)",
                  borderRadius: "8px",
                  borderLeft: "3px solid #3b82f6",
                }}
              >
                <div style={{ fontSize: "12px", fontWeight: 600, color: "#3b82f6" }}>
                  🎯 覆盖缺口补全
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                  {activeDayPlan.stats.coverageGaps.map((g) => (
                    <span key={g.name} style={{ marginRight: "12px" }}>
                      {g.type === "region" ? "产区" : g.type === "grape" ? "品种" : "香气"}
                      「{g.name}」{g.coverageRate}%
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="review-task-list">
            {activeDayPlan.tasks.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px",
                  color: "var(--text-muted)",
                }}
              >
                <div style={{ fontSize: "24px", marginBottom: "8px" }}>🎉</div>
                <p>当日暂无学习任务</p>
              </div>
            ) : (
              activeDayPlan.tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  expanded={expandedTask === task.id}
                  showExplanation={showExplanation === task.id}
                  onToggle={() => handleToggleTask(task.id)}
                  onExpand={() =>
                    setExpandedTask(expandedTask === task.id ? null : task.id)
                  }
                  onShowExplanation={() =>
                    setShowExplanation(
                      showExplanation === task.id ? null : task.id
                    )
                  }
                  onAromaClick={onAromaClick}
                  onWineSelect={onWineSelect}
                />
              ))
            )}
          </div>
        </div>
      )}

      <div
        style={{
          marginTop: "20px",
          padding: "16px",
          background: "var(--bg-secondary)",
          borderRadius: "12px",
        }}
      >
        <h4
          style={{
            fontSize: "13px",
            marginBottom: "12px",
            color: "var(--text)",
          }}
        >
          📊 学习路径概览
        </h4>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "12px",
          }}
        >
          <div
            style={{
              padding: "12px",
              background: "rgba(16, 185, 129, 0.1)",
              borderRadius: "8px",
            }}
          >
            <div style={{ fontSize: "11px", color: "#10b981", marginBottom: "4px" }}>
              总任务数
            </div>
            <div style={{ fontSize: "24px", fontWeight: 700, color: "#10b981" }}>
              {learningPath.overallStats.totalTasks}
            </div>
          </div>
          <div
            style={{
              padding: "12px",
              background: "rgba(59, 130, 246, 0.1)",
              borderRadius: "8px",
            }}
          >
            <div style={{ fontSize: "11px", color: "#3b82f6", marginBottom: "4px" }}>
              预计总耗时
            </div>
            <div style={{ fontSize: "24px", fontWeight: 700, color: "#3b82f6" }}>
              {learningPath.overallStats.totalEstimatedMinutes}分钟
            </div>
          </div>
          <div
            style={{
              padding: "12px",
              background: "rgba(239, 68, 68, 0.1)",
              borderRadius: "8px",
            }}
          >
            <div style={{ fontSize: "11px", color: "#ef4444", marginBottom: "4px" }}>
              覆盖缺口
            </div>
            <div style={{ fontSize: "24px", fontWeight: 700, color: "#ef4444" }}>
              {learningPath.overallStats.coverageGaps.length}
            </div>
          </div>
          <div
            style={{
              padding: "12px",
              background: "rgba(139, 92, 246, 0.1)",
              borderRadius: "8px",
            }}
          >
            <div style={{ fontSize: "11px", color: "#8b5cf6", marginBottom: "4px" }}>
              薄弱维度
            </div>
            <div style={{ fontSize: "24px", fontWeight: 700, color: "#8b5cf6" }}>
              {learningPath.overallStats.weaknessDimensions.length}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

interface TaskCardProps {
  task: PathTask;
  expanded: boolean;
  showExplanation: boolean;
  onToggle: () => void;
  onExpand: () => void;
  onShowExplanation: () => void;
  onAromaClick?: (aroma: string) => void;
  onWineSelect?: (wine: { id: string; source: string }) => void;
}

function TaskCard({
  task,
  expanded,
  showExplanation,
  onToggle,
  onExpand,
  onShowExplanation,
  onAromaClick,
  onWineSelect,
}: TaskCardProps) {
  const taskTypeInfo = taskTypeLabels[task.taskType];
  const taskTypeHint = taskTypeHints[task.taskType];
  const forgettingInfo = forgettingStageLabels[task.forgettingStage];

  return (
    <article
      className={`review-task ${task.completed ? "review-task-done" : ""}`}
      style={{
        border: "1px solid rgba(124, 92, 255, 0.2)",
        background: task.completed
          ? "linear-gradient(135deg, rgba(99,102,241,0.04), rgba(124,92,255,0.02))"
          : "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(124,92,255,0.04))",
      }}
    >
      <button
        className="review-check"
        onClick={onToggle}
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
          <h4
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            {task.wineName}
            <span
              style={{
                fontSize: "10px",
                padding: "2px 8px",
                borderRadius: "10px",
                background: `var(--bg-secondary)`,
                color: forgettingInfo.color,
                fontWeight: 600,
              }}
            >
              {forgettingInfo.label}
            </span>
            <span
              style={{
                fontSize: "10px",
                padding: "2px 8px",
                borderRadius: "10px",
                background:
                  task.taskType === "new_learn"
                    ? "rgba(16, 185, 129, 0.12)"
                    : task.taskType === "confusion_practice"
                    ? "rgba(139, 92, 246, 0.12)"
                    : task.taskType === "aroma_mastery"
                    ? "rgba(236, 72, 153, 0.12)"
                    : task.taskType === "region_coverage"
                    ? "rgba(245, 158, 11, 0.12)"
                    : "rgba(59, 130, 246, 0.12)",
                color:
                  task.taskType === "new_learn"
                    ? "#10b981"
                    : task.taskType === "confusion_practice"
                    ? "#8b5cf6"
                    : task.taskType === "aroma_mastery"
                    ? "#ec4899"
                    : task.taskType === "region_coverage"
                    ? "#f59e0b"
                    : "#3b82f6",
                fontWeight: 600,
              }}
              title={taskTypeHint}
            >
              {taskTypeInfo}
            </span>
            <span
              style={{
                fontSize: "10px",
                padding: "2px 6px",
                borderRadius: "8px",
                background: "var(--bg-secondary)",
                color: "var(--text-muted)",
              }}
            >
              优先级 #{task.priorityScore}
            </span>
          </h4>
          <span className="review-task-meta">
            {task.grape} · {task.region} · {task.country} · 约{task.estimatedTimeMinutes}分钟
          </span>
        </div>

        <div style={{ fontSize: "13px", color: "var(--accent)", marginBottom: "8px" }}>
          <strong>{task.explanation.summary}</strong>
        </div>

        <div className="review-clues">
          <span className="review-clues-label">重点香气</span>
          <div className="review-clue-tags">
            {task.aromas.map((aroma) => {
              const kw = categoryConfig;
              return (
                <button
                  key={aroma}
                  className="review-clue-tag"
                  onClick={() => onAromaClick?.(aroma)}
                  title={`在词库中查看「${aroma}」`}
                >
                  {aroma}
                </button>
              );
            })}
          </div>
        </div>

        {task.weaknessReasons.length > 0 && (
          <div
            style={{
              marginTop: "8px",
              padding: "8px 12px",
              background: "rgba(239, 68, 68, 0.06)",
              borderRadius: "6px",
              borderLeft: "2px solid #ef4444",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "#ef4444",
                marginBottom: "4px",
              }}
            >
              ⚠️ 薄弱原因
            </div>
            {task.weaknessReasons.map((w, idx) => (
              <div key={idx} style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                · {w.dimensionName}错误率{w.errorRate}% ({w.mistakeCount}次错误)
              </div>
            ))}
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: "8px",
            marginTop: "10px",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={onShowExplanation}
            style={{
              padding: "6px 12px",
              fontSize: "11px",
              background: "rgba(124, 92, 255, 0.1)",
              color: "var(--accent)",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            {showExplanation ? "隐藏" : "💡"}为什么推荐这个？
          </button>
          {onWineSelect && (
            <button
              onClick={() => onWineSelect({ id: task.wineId, source: task.source })}
              style={{
                padding: "6px 12px",
                fontSize: "11px",
                background: "rgba(16, 185, 129, 0.1)",
                color: "#10b981",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              🔍 查看详情
            </button>
          )}
          <button
            onClick={onExpand}
            style={{
              padding: "6px 12px",
              fontSize: "11px",
              background: "var(--bg-secondary)",
              color: "var(--text-muted)",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            {expanded ? "收起 ▲" : "展开 ▼"}
          </button>
        </div>

        {showExplanation && (
          <div
            style={{
              marginTop: "12px",
              padding: "12px",
              background: "var(--bg-secondary)",
              borderRadius: "8px",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                fontWeight: 600,
                marginBottom: "8px",
                color: "var(--accent)",
              }}
            >
              📖 推荐依据
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {task.explanation.evidences.map((evidence, idx) => {
                const typeInfo = evidenceTypeLabels[evidence.type];
                return (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      gap: "8px",
                      padding: "8px",
                      background: "rgba(255,255,255,0.3)",
                      borderRadius: "6px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "16px",
                        width: "24px",
                        textAlign: "center",
                      }}
                    >
                      {typeInfo.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          color: typeInfo.color,
                          marginBottom: "2px",
                        }}
                      >
                        {typeInfo.label}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text)", marginBottom: "2px" }}>
                        {evidence.description}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                        {evidence.detail}
                      </div>
                      {evidence.timestamp && (
                        <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>
                          记录时间: {new Date(evidence.timestamp).toLocaleDateString("zh-CN")}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {expanded && (
          <div
            style={{
              marginTop: "12px",
              padding: "12px",
              background: "var(--bg-secondary)",
              borderRadius: "8px",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                fontWeight: 600,
                marginBottom: "8px",
                color: "var(--text)",
              }}
            >
              📊 详细信息
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "11px" }}>
              <div>
                <span style={{ color: "var(--text-muted)" }}>记忆阶段: </span>
                <span style={{ color: forgettingInfo.color, fontWeight: 500 }}>
                  {forgettingInfo.label}
                </span>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }}>优先级分数: </span>
                <span style={{ fontWeight: 600 }}>{task.priorityScore}</span>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }}>预计耗时: </span>
                <span>{task.estimatedTimeMinutes}分钟</span>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }}>来源: </span>
                <span>{task.source === "wineCard" ? "标准酒卡" : "个人记录"}</span>
              </div>
              {task.lastReviewedAt && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <span style={{ color: "var(--text-muted)" }}>上次复习: </span>
                  <span>
                    {new Date(task.lastReviewedAt).toLocaleDateString("zh-CN")}
                  </span>
                </div>
              )}
              {task.completedAt && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <span style={{ color: "var(--text-muted)" }}>完成时间: </span>
                  <span style={{ color: "#10b981", fontWeight: 500 }}>
                    {new Date(task.completedAt).toLocaleString("zh-CN")}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <span
        className={`review-status ${
          task.completed ? "review-status-done" : "review-status-pending"
        }`}
      >
        {task.completed ? "已完成" : "待学习"}
      </span>
    </article>
  );
}
