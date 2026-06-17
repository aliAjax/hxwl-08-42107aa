import { useState, useMemo, useEffect, useCallback } from "react";
import { WineRecord } from "../data/wineRecordTypes";
import {
  buildAdaptiveDashboard,
  AdaptiveDashboardData,
  PrioritizedWine,
  WeightFactor,
  ConfusionPair,
  clearAllHistory,
} from "../data/adaptiveReview";

interface AdaptiveDashboardProps {
  records: WineRecord[];
  onAromaClick?: (aroma: string) => void;
  onRefreshSignal?: number;
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
}: AdaptiveDashboardProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("weight");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [confirmReset, setConfirmReset] = useState(false);
  const [rebuildTrigger, setRebuildTrigger] = useState(0);

  const dashboard: AdaptiveDashboardData = useMemo(() => {
    return buildAdaptiveDashboard(records);
  }, [records, rebuildTrigger, onRefreshSignal]);

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
            className="primary-action"
            onClick={() => setRebuildTrigger((t) => t + 1)}
          >
            刷新数据
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
          onClick={() => setConfirmReset(false)}
        >
          <div
            className="confirm-delete-dialog"
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
