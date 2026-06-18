import { useState, useMemo, useEffect, useCallback } from "react";
import { WineRecord } from "../data/wineRecordTypes";
import {
  buildAdaptiveDashboard,
  AdaptiveDashboardData,
  PrioritizedWine,
  WeightFactor,
  ConfusionPair,
  clearAllHistory,
  generateTodayReviewPlan,
  GenerationScope,
  scopeLabels,
  scopeHints,
  GenerationResult,
} from "../data/adaptiveReview";
import { syncConfusionPairsToProfile } from "../data/learningProfileSync";

interface AdaptiveDashboardProps {
  records: WineRecord[];
  onAromaClick?: (aroma: string) => void;
  onRefreshSignal?: number;
  onReviewPlanGenerated?: () => void;
}

type SortKey = "weight" | "attempts" | "accuracy" | "recent";
type FilterKey = "all" | "high" | "medium" | "low" | "unpracticed";

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s}秒`;
  return `${m}分${String(s).padStart(2, "0")}秒`;
}

function formatRelativeTime(timestamp: number | null): string {
  if (!timestamp) return "从未练习";
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  const months = Math.floor(days / 30);
  return `${months}月前`;
}

function getWeightLevel(weight: number, maxWeight: number): "high" | "medium" | "low" {
  const ratio = weight / maxWeight;
  if (ratio >= 0.6) return "high";
  if (ratio >= 0.3) return "medium";
  return "low";
}

function getFilterMatch(wine: PrioritizedWine, filter: FilterKey, maxWeight: number): boolean {
  if (filter === "all") return true;
  if (filter === "unpracticed") return wine.stats.totalAttempts === 0;
  const level = getWeightLevel(wine.finalWeight, maxWeight);
  return level === filter;
}

export default function AdaptiveDashboard({
  records,
  onAromaClick,
  onRefreshSignal,
  onReviewPlanGenerated,
}: AdaptiveDashboardProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("weight");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [confirmReset, setConfirmReset] = useState(false);
  const [rebuildTrigger, setRebuildTrigger] = useState(0);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [selectedScopes, setSelectedScopes] = useState<GenerationScope[]>(["highPriority"]);
  const [taskCount, setTaskCount] = useState(5);
  const [includeStages, setIncludeStages] = useState<("today" | "three-days" | "one-week")[]>(["today"]);
  const [lastGenResult, setLastGenResult] = useState<GenerationResult | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: "ok" | "info" } | null>(null);

  const dashboard: AdaptiveDashboardData = useMemo(() => {
    return buildAdaptiveDashboard(records);
  }, [records, rebuildTrigger, onRefreshSignal]);

  useEffect(() => {
    const pairsWithConfusion = dashboard.confusionPairs.filter(
      (p) => p.mutualConfusionCount > 0
    );
    if (pairsWithConfusion.length > 0) {
      syncConfusionPairsToProfile(pairsWithConfusion);
    }
  }, [dashboard.confusionPairs]);

  const maxWeight = useMemo(() => {
    if (dashboard.prioritizedWines.length === 0) return 1;
    return dashboard.prioritizedWines[0].finalWeight;
  }, [dashboard]);

  const filteredAndSorted = useMemo(() => {
    const filtered = dashboard.prioritizedWines.filter((w) =>
      getFilterMatch(w, filter, maxWeight)
    );

    const sorted = [...filtered];
    switch (sortKey) {
      case "weight":
        sorted.sort((a, b) => b.finalWeight - a.finalWeight);
        break;
      case "attempts":
        sorted.sort((a, b) => a.stats.totalAttempts - b.stats.totalAttempts);
        break;
      case "accuracy":
        sorted.sort((a, b) => {
          const accA =
            a.stats.totalAttempts > 0
              ? a.stats.correctCount / a.stats.totalAttempts
              : -1;
          const accB =
            b.stats.totalAttempts > 0
              ? b.stats.correctCount / b.stats.totalAttempts
              : -1;
          return accA - accB;
        });
        break;
      case "recent":
        sorted.sort((a, b) => {
          const ta = a.stats.lastAttemptTime ?? 0;
          const tb = b.stats.lastAttemptTime ?? 0;
          return ta - tb;
        });
        break;
    }
    return sorted;
  }, [dashboard, filter, sortKey, maxWeight]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const handleReset = useCallback(() => {
    clearAllHistory();
    setRebuildTrigger((t) => t + 1);
    setConfirmReset(false);
  }, []);

  const showToastMsg = useCallback((msg: string, tone: "ok" | "info" = "ok") => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 2800);
  }, []);

  const toggleScope = useCallback((scope: GenerationScope) => {
    setSelectedScopes((prev) => {
      if (prev.includes(scope)) {
        const next = prev.filter((s) => s !== scope);
        return next.length > 0 ? next : prev;
      }
      return [...prev, scope];
    });
  }, []);

  const toggleStage = useCallback(
    (stage: "today" | "three-days" | "one-week") => {
      setIncludeStages((prev) => {
        if (prev.includes(stage)) {
          const next = prev.filter((s) => s !== stage);
          return next.length > 0 ? next : prev;
        }
        return [...prev, stage];
      });
    },
    []
  );

  const handleGeneratePlan = useCallback(() => {
    const result = generateTodayReviewPlan(records, {
      scopes: selectedScopes,
      count: taskCount,
      includeStages,
    });
    setLastGenResult(result);
    setShowGenerateDialog(false);
    onReviewPlanGenerated?.();
    const scopeSummary = selectedScopes.map((s) => scopeLabels[s]).join("+");
    showToastMsg(`已生成 ${result.tasks.length} 条复习任务（${scopeSummary}，前${taskCount}个）`, "ok");
  }, [records, selectedScopes, taskCount, includeStages, onReviewPlanGenerated, showToastMsg]);

  const { overallStats } = dashboard;

  return (
    <section className="adaptive-dashboard panel">
      <div className="section-heading">
        <div>
          <p>智能学习引擎</p>
          <h2>自适应复习看板</h2>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            className="secondary-action"
            onClick={() => setConfirmReset(true)}
          >
            重置练习历史
          </button>
          <button
            className="secondary-action"
            onClick={() => setRebuildTrigger((t) => t + 1)}
          >
            刷新数据
          </button>
          <button
            className="primary-action"
            onClick={() => setShowGenerateDialog(true)}
            style={{ background: "linear-gradient(135deg, var(--accent), #7c5cff)" }}
          >
            🎯 生成今日复习计划
          </button>
        </div>
      </div>

      <div className="adaptive-overview-grid">
        <article className="adaptive-stat-card">
          <span>练习场次</span>
          <strong>{overallStats.totalSessions}</strong>
          <i className="status-ok" />
        </article>
        <article className="adaptive-stat-card">
          <span>总答题数</span>
          <strong>{overallStats.totalAttempts}</strong>
          <i className="status-ok" />
        </article>
        <article className="adaptive-stat-card">
          <span>全局正确率</span>
          <strong>{overallStats.globalAccuracy}%</strong>
          <i
            className={
              overallStats.globalAccuracy >= 80
                ? "status-ok"
                : overallStats.globalAccuracy >= 60
                ? "status-watch"
                : "status-danger"
            }
          />
        </article>
        <article className="adaptive-stat-card">
          <span>平均答题时间</span>
          <strong>{formatDuration(overallStats.avgTimePerQuestionMs)}</strong>
          <i className="status-watch" />
        </article>
      </div>

      <div className="adaptive-weak-sections">
        {overallStats.weakRegions.length > 0 && (
          <div className="weak-section">
            <h4>薄弱产区 TOP</h4>
            <div className="weak-list">
              {overallStats.weakRegions.map((r) => (
                <div key={r.region} className="weak-item">
                  <span className="weak-label">{r.region}</span>
                  <div className="weak-bar">
                    <div
                      className="weak-bar-fill"
                      style={{
                        width: `${r.errorRate}%`,
                        background:
                          r.errorRate >= 50
                            ? "var(--danger)"
                            : r.errorRate >= 30
                            ? "var(--warn)"
                            : "var(--accent)",
                      }}
                    />
                  </div>
                  <span className="weak-meta">
                    错 {r.errorRate}% · {r.attempts}题
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {overallStats.weakGrapes.length > 0 && (
          <div className="weak-section">
            <h4>薄弱品种 TOP</h4>
            <div className="weak-list">
              {overallStats.weakGrapes.map((g) => (
                <div key={g.grape} className="weak-item">
                  <span className="weak-label">{g.grape}</span>
                  <div className="weak-bar">
                    <div
                      className="weak-bar-fill"
                      style={{
                        width: `${g.errorRate}%`,
                        background:
                          g.errorRate >= 50
                            ? "var(--danger)"
                            : g.errorRate >= 30
                            ? "var(--warn)"
                            : "var(--accent)",
                      }}
                    />
                  </div>
                  <span className="weak-meta">
                    错 {g.errorRate}% · {g.attempts}题
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="adaptive-toolbar">
        <div className="filter-chips">
          {(
            [
              { k: "all", label: "全部" },
              { k: "high", label: "高优先级" },
              { k: "medium", label: "中优先级" },
              { k: "low", label: "低优先级" },
              { k: "unpracticed", label: "未练习" },
            ] as { k: FilterKey; label: string }[]
          ).map((c) => (
            <button
              key={c.k}
              className={`filter-chip ${filter === c.k ? "active" : ""}`}
              onClick={() => setFilter(c.k)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="sort-select">
          <label>排序</label>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            <option value="weight">按权重</option>
            <option value="accuracy">按正确率升序</option>
            <option value="attempts">按练习次数升序</option>
            <option value="recent">按上次练习最远</option>
          </select>
        </div>
      </div>

      <div className="adaptive-wine-list">
        {filteredAndSorted.length === 0 && (
          <div className="empty-state">
            <span className="empty-icon">📊</span>
            <p>当前筛选无结果</p>
          </div>
        )}
        {filteredAndSorted.map((wine) => (
          <WinePriorityCard
            key={`${wine.stats.source}-${wine.stats.id}`}
            wine={wine}
            maxWeight={maxWeight}
            expanded={expandedId === `${wine.stats.source}-${wine.stats.id}`}
            onToggle={() =>
              toggleExpand(`${wine.stats.source}-${wine.stats.id}`)
            }
            onAromaClick={onAromaClick}
          />
        ))}
      </div>

      {dashboard.confusionPairs.length > 0 && (
        <div className="confusion-section">
          <div className="section-heading" style={{ padding: 0 }}>
            <div>
              <p>易混淆监控</p>
              <h3>高混淆产区对 · {dashboard.confusionPairs.length} 组</h3>
            </div>
          </div>
          <div className="confusion-list">
            {dashboard.confusionPairs.map((pair) => (
              <ConfusionPairCard key={pair.pairId} pair={pair} />
            ))}
          </div>
        </div>
      )}

      {confirmReset && (
        <div
          className="confirm-delete-overlay"
          style={{ zIndex: 9990 }}
          onClick={() => setConfirmReset(false)}
        >
          <div
            className="confirm-delete-dialog"
            style={{ zIndex: 9991 }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <h3>确认重置</h3>
            <p>
              将清除所有练习历史数据，示例数据也会重新生成。确定要重置吗？
            </p>
            <div className="confirm-delete-actions">
              <button onClick={() => setConfirmReset(false)}>取消</button>
              <button
                className="confirm-delete-btn"
                onClick={handleReset}
              >
                确认重置
              </button>
            </div>
          </div>
        </div>
      )}

      {showGenerateDialog && (
        <div
          className="confirm-delete-overlay"
          style={{ zIndex: 9990 }}
          onClick={() => setShowGenerateDialog(false)}
        >
          <div
            className="confirm-delete-dialog"
            style={{ maxWidth: "560px", width: "92%", zIndex: 9991 }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <h3 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              🎯 生成今日复习计划
            </h3>
            <p style={{ marginBottom: "20px", color: "var(--text-muted)" }}>
              智能选择需要重点复习的酒款，生成间隔复习任务并同步到学习档案。
            </p>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ fontWeight: 600, marginBottom: "10px", display: "block" }}>
                生成范围（可多选）
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {(["highPriority", "unpracticed", "weakRegions"] as GenerationScope[]).map(
                  (scope) => (
                    <label
                      key={scope}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                        padding: "12px 14px",
                        border: "1px solid",
                        borderColor: selectedScopes.includes(scope)
                          ? "var(--accent)"
                          : "var(--border)",
                        borderRadius: "10px",
                        background: selectedScopes.includes(scope)
                          ? "rgba(99, 102, 241, 0.08)"
                          : "transparent",
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedScopes.includes(scope)}
                        onChange={() => toggleScope(scope)}
                        style={{ marginTop: "3px" }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>{scopeLabels[scope]}</div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "var(--text-muted)",
                            marginTop: "2px",
                          }}
                        >
                          {scopeHints[scope]}
                        </div>
                      </div>
                    </label>
                  )
                )}
              </div>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ fontWeight: 600, marginBottom: "10px", display: "block" }}>
                复习阶段（可多选）
              </label>
              <div style={{ display: "flex", gap: "10px" }}>
                {(
                  [
                    { k: "today", label: "今天", hint: "立即复习" },
                    { k: "three-days", label: "3天后", hint: "短期巩固" },
                    { k: "one-week", label: "1周后", hint: "长期记忆" },
                  ] as {
                    k: "today" | "three-days" | "one-week";
                    label: string;
                    hint: string;
                  }[]
                ).map((stg) => (
                  <label
                    key={stg.k}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "4px",
                      padding: "12px 8px",
                      border: "1px solid",
                      borderColor: includeStages.includes(stg.k)
                        ? "var(--accent)"
                        : "var(--border)",
                      borderRadius: "10px",
                      background: includeStages.includes(stg.k)
                        ? "rgba(99, 102, 241, 0.08)"
                        : "transparent",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={includeStages.includes(stg.k)}
                      onChange={() => toggleStage(stg.k)}
                    />
                    <strong>{stg.label}</strong>
                    <span
                      style={{
                        fontSize: "11px",
                        color: "var(--text-muted)",
                      }}
                    >
                      {stg.hint}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label
                style={{
                  fontWeight: 600,
                  marginBottom: "10px",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>每个阶段酒款数量</span>
                <strong style={{ color: "var(--accent)" }}>{taskCount} 个</strong>
              </label>
              <input
                type="range"
                min={1}
                max={15}
                value={taskCount}
                onChange={(e) => setTaskCount(Number(e.target.value))}
                style={{ width: "100%" }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  marginTop: "4px",
                }}
              >
                <span>1</span>
                <span>5</span>
                <span>10</span>
                <span>15</span>
              </div>
            </div>

            {lastGenResult && (
              <div
                style={{
                  padding: "12px",
                  background: "var(--bg-secondary)",
                  borderRadius: "8px",
                  marginBottom: "16px",
                  fontSize: "13px",
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: "6px" }}>上次生成结果：</div>
                <div style={{ color: "var(--text-muted)" }}>
                  共 {lastGenResult.tasks.length} 条任务
                  {lastGenResult.counts.highPriority > 0 &&
                    ` · 高优${lastGenResult.counts.highPriority}`}
                  {lastGenResult.counts.unpracticed > 0 &&
                    ` · 未练${lastGenResult.counts.unpracticed}`}
                  {lastGenResult.counts.weakRegions > 0 &&
                    ` · 薄产${lastGenResult.counts.weakRegions}`}
                </div>
              </div>
            )}

            <div className="confirm-delete-actions">
              <button onClick={() => setShowGenerateDialog(false)}>取消</button>
              <button
                className="confirm-delete-btn"
                style={{
                  background: "linear-gradient(135deg, var(--accent), #7c5cff)",
                }}
                onClick={handleGeneratePlan}
                disabled={selectedScopes.length === 0}
              >
                生成复习计划
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "32px",
            left: "50%",
            transform: "translateX(-50%)",
            padding: "12px 20px",
            background: toast.tone === "ok" ? "var(--accent)" : "var(--warn)",
            color: "white",
            borderRadius: "10px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            zIndex: 10000,
            fontWeight: 500,
            animation: "fadeInUp 0.3s ease",
          }}
        >
          {toast.tone === "ok" ? "✅ " : "ℹ️ "}
          {toast.msg}
        </div>
      )}
    </section>
  );
}

interface WinePriorityCardProps {
  wine: PrioritizedWine;
  maxWeight: number;
  expanded: boolean;
  onToggle: () => void;
  onAromaClick?: (aroma: string) => void;
}

function WinePriorityCard({
  wine,
  maxWeight,
  expanded,
  onToggle,
  onAromaClick,
}: WinePriorityCardProps) {
  const { stats, factors, finalWeight, summaryReason, rank } = wine;
  const attempts = stats.totalAttempts;
  const accuracy =
    attempts > 0 ? Math.round((stats.correctCount / attempts) * 100) : 0;
  const level = getWeightLevel(finalWeight, maxWeight);
  const weightPercent = Math.max(5, Math.min(100, (finalWeight / maxWeight) * 100));

  const levelClass =
    level === "high"
      ? "priority-high"
      : level === "medium"
      ? "priority-medium"
      : "priority-low";
  const levelLabel =
    level === "high" ? "高优先级" : level === "medium" ? "中优先级" : "低优先级";

  return (
    <article className={`priority-card ${levelClass}`}>
      <div className="priority-card-head" onClick={onToggle}>
        <div className="priority-rank">
          <span className="rank-badge">#{rank}</span>
          <span className={`priority-label ${levelClass}`}>{levelLabel}</span>
        </div>

        <div className="priority-main">
          <div className="priority-title-row">
            <h4>
              {stats.displayName}
              <span className="priority-meta">
                {stats.region} · {stats.grape}
                <span className={`source-tag source-${stats.source}`}>
                  {stats.source === "wineCard" ? "示例题" : "自录题"}
                </span>
              </span>
            </h4>
            <span className="priority-weight">
              权重 <strong>{finalWeight.toFixed(2)}</strong>
            </span>
          </div>
          <div className="priority-bar">
            <div
              className="priority-bar-fill"
              style={{ width: `${weightPercent}%` }}
            />
          </div>
          <p className="priority-summary">推荐原因：{summaryReason}</p>
        </div>

        <span className={`expand-icon ${expanded ? "expanded" : ""}`}>
          {expanded ? "▲" : "▼"}
        </span>
      </div>

      <div className="priority-card-body" onClick={onToggle}>
        <div className="priority-stats-row">
          <div className="mini-stat">
            <span>练习次数</span>
            <strong>{attempts}</strong>
          </div>
          <div className="mini-stat">
            <span>正确率</span>
            <strong>
              {attempts > 0 ? `${accuracy}%` : "—"}
            </strong>
          </div>
          <div className="mini-stat">
            <span>平均耗时</span>
            <strong>
              {attempts > 0 ? formatDuration(stats.avgTimeSpentMs) : "—"}
            </strong>
          </div>
          <div className="mini-stat">
            <span>上次练习</span>
            <strong>{formatRelativeTime(stats.lastAttemptTime)}</strong>
          </div>
          <div className="mini-stat">
            <span>近期状态</span>
            <strong>
              {stats.recentStreak > 0
                ? `${stats.recentStreak}连对`
                : stats.recentStreak < 0
                ? `${Math.abs(stats.recentStreak)}连错`
                : "稳定"}
            </strong>
          </div>
        </div>

        <div className="priority-error-breakdown">
          <div className="error-chip error-both">
            <span>双错</span>
            <strong>{stats.bothErrorCount}</strong>
          </div>
          <div className="error-chip error-region">
            <span>产区错</span>
            <strong>{stats.regionErrorCount}</strong>
          </div>
          <div className="error-chip error-grape">
            <span>品种错</span>
            <strong>{stats.grapeErrorCount}</strong>
          </div>
        </div>

        {stats.aromas.length > 0 && (
          <div className="priority-aromas">
            <span className="aromas-label">关键香气线索</span>
            <div className="aroma-tags">
              {stats.aromas.map((a) => (
                <button
                  key={a}
                  className="aroma-tag aroma-tag-clickable"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAromaClick?.(a);
                  }}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {expanded && (
        <div className="priority-factors">
          <h5>权重因子明细</h5>
          <div className="factors-grid">
            {factors.map((f) => (
              <FactorCard key={f.name} factor={f} />
            ))}
          </div>
          <div className="factors-formula">
            <span className="formula-label">综合计算：</span>
            <code>
              {factors.map((f, i) => (
                <span key={f.name}>
                  {i > 0 && " × "}
                  <span className={`formula-value formula-${f.name}`}>
                    {f.value.toFixed(2)}
                  </span>
                </span>
              ))}
              {" = "}
              <strong>{finalWeight.toFixed(2)}</strong>
            </code>
          </div>
        </div>
      )}
    </article>
  );
}

function FactorCard({ factor }: { factor: WeightFactor }) {
  const isBoost = factor.value >= 1;
  const isNeutral = factor.value === 1;
  const toneClass = isNeutral
    ? "factor-neutral"
    : isBoost
    ? factor.name === "mastered"
      ? "factor-reduce"
      : "factor-boost"
    : "factor-reduce";

  return (
    <div className={`factor-card ${toneClass}`}>
      <div className="factor-head">
        <span className="factor-label">{factor.label}</span>
        <span className="factor-value">×{factor.value.toFixed(2)}</span>
      </div>
      <p className="factor-explanation">{factor.explanation}</p>
    </div>
  );
}

function ConfusionPairCard({ pair }: { pair: ConfusionPair }) {
  const difficultyLabel = {
    high: "高难度",
    medium: "中难度",
    low: "低难度",
  }[pair.difficulty];
  const difficultyClass = `diff-${pair.difficulty}`;

  return (
    <article className="confusion-card">
      <div className="confusion-head">
        <div className="confusion-wines">
          <span className="confusion-wine">
            <strong>{pair.wineA.region}</strong>
            <span>{pair.wineA.grape}</span>
          </span>
          <span className="confusion-arrow">⇄</span>
          <span className="confusion-wine">
            <strong>{pair.wineB.region}</strong>
            <span>{pair.wineB.grape}</span>
          </span>
        </div>
        <div className="confusion-meta">
          <span className={`confusion-diff ${difficultyClass}`}>
            {difficultyLabel}
          </span>
          <span className="confusion-count">
            共 {pair.mutualConfusionCount} 次互混
          </span>
        </div>
      </div>
      <div className="confusion-similarities">
        <span className="similarities-label">相似点：</span>
        <ul>
          {pair.similarities.slice(0, 3).map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </div>
      {pair.lastConfusionTime && (
        <div className="confusion-last">
          上次混淆：{formatRelativeTime(pair.lastConfusionTime)}
        </div>
      )}
    </article>
  );
}
