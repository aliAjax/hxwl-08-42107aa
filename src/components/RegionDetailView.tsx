import { useMemo } from "react";
import { WineRecord } from "../data/wineRecordTypes";
import {
  computeRegionDetail,
  formatLastPracticed,
  WeakGrapeSummary,
} from "../data/regionStats";

interface RegionDetailViewProps {
  records: WineRecord[];
  regionKey: string;
  onBack: () => void;
  onAromaClick?: (aroma: string) => void;
  onStartExamForRegion: (regionKey: string, regionName: string) => void;
}

export default function RegionDetailView({
  records,
  regionKey,
  onBack,
  onAromaClick,
  onStartExamForRegion,
}: RegionDetailViewProps) {
  const detail = useMemo(
    () => computeRegionDetail(records, regionKey),
    [records, regionKey]
  );

  if (!detail) {
    return (
      <section className="region-detail panel">
        <div className="region-detail-header">
          <button className="back-btn" onClick={onBack}>
            ← 返回地图
          </button>
          <div className="empty-state">
            <span className="empty-icon">🍷</span>
            <p>未找到该产区</p>
          </div>
        </div>
      </section>
    );
  }

  const { stat, records: regionRecords, weakGrapes } = detail;

  return (
    <section className="region-detail panel">
      <div className="region-detail-header">
        <button className="back-btn" onClick={onBack}>
          ← 返回地图
        </button>
        <div
          className="region-detail-title"
          style={{ "--region-color": stat.color } as React.CSSProperties}
        >
          <span className="region-detail-dot" />
          <div>
            <h2>{stat.name}</h2>
            <p>
              {stat.country} · 共 {regionRecords.length} 条记录
            </p>
          </div>
        </div>
        <div className="region-detail-stats">
          <div className="mini-stat">
            <span>正确率</span>
            <strong>{stat.accuracy}%</strong>
          </div>
          <div className="mini-stat">
            <span>最近练习</span>
            <strong>{formatLastPracticed(stat.lastPracticed)}</strong>
          </div>
        </div>
        <button
          className="primary-action region-detail-practice-btn"
          onClick={() => onStartExamForRegion(stat.key, stat.name)}
        >
          📝 按当前产区练习
        </button>
      </div>

      <div className="region-detail-progress">
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{
              width: `${stat.accuracy}%`,
              background: stat.color,
            }}
          />
        </div>
        <span className="progress-label">
          正确率 {stat.accuracy}%
        </span>
      </div>

      {weakGrapes.length > 0 && (
        <div className="weak-grapes-section">
          <div className="section-subheading">
            <h3>薄弱品种摘要</h3>
            <span className="weak-grapes-count">
              {weakGrapes.length} 个品种
            </span>
          </div>
          <div className="weak-grapes-grid">
            {weakGrapes.map((wg) => (
              <WeakGrapeCard key={wg.grape} summary={wg} />
            ))}
          </div>
        </div>
      )}

      <div className="region-records-section">
        <div className="section-subheading">
          <h3>产区记录列表</h3>
          <span className="records-count">共 {regionRecords.length} 条</span>
        </div>

        {regionRecords.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📝</span>
            <p>暂无该产区的记录</p>
            <p className="empty-hint">快去添加一条新记录吧！</p>
          </div>
        ) : (
          <div className="record-list">
            {regionRecords.map((record, index) => (
              <article key={record.id} className="record-card">
                <div className="record-index">{String(index + 1).padStart(2, "0")}</div>
                <div className="record-card-header">
                  <div className="record-card-main">
                    <h3>{record.name}</h3>
                    <p>
                      {[record.grape, record.region, record.year]
                        .filter(Boolean)
                        .join(" · ")}
                      {record.aromas.length > 0 && (
                        <span className="record-aromas">
                          {record.aromas.map((a: string) => (
                            <button
                              key={a}
                              className="record-aroma-link"
                              onClick={() => onAromaClick?.(a)}
                            >
                              {a}
                            </button>
                          ))}
                        </span>
                      )}
                    </p>
                    <div className="record-meta">
                      <span className="record-meta-item">
                        酸度：{record.acidity}
                      </span>
                      <span className="record-meta-item">
                        单宁：{record.tannin}
                      </span>
                      <span className="record-meta-item">
                        酒体：{record.body}
                      </span>
                      {record.characteristic && (
                        <span className="record-meta-item">
                          特征：{record.characteristic}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

interface WeakGrapeCardProps {
  summary: WeakGrapeSummary;
}

function WeakGrapeCard({ summary }: WeakGrapeCardProps) {
  const severity =
    summary.errorRate >= 50
      ? "high"
      : summary.errorRate >= 30
      ? "medium"
      : "low";

  return (
    <div className={`weak-grape-card weak-${severity}`}>
      <div className="weak-grape-header">
        <h4>{summary.grape}</h4>
        <span className={`weak-rate-badge rate-${severity}`}>
          {summary.errorRate}% 错误率
        </span>
      </div>
      <div className="weak-grape-stats">
        <span className="weak-stat">
          <strong>{summary.count}</strong> 条记录
        </span>
        <span className="weak-stat">
          <strong>{summary.errorCount}</strong> 次错误
        </span>
      </div>
      <div className="weak-progress-bar">
        <div
          className={`weak-progress-fill rate-${severity}`}
          style={{ width: `${summary.errorRate}%` }}
        />
      </div>
      <div className="weak-suggestion">
        {severity === "high"
          ? "⚠️ 重点复习，建议加强练习"
          : severity === "medium"
          ? "💡 需要关注，定期巩固"
          : "✓ 表现良好，继续保持"}
      </div>
    </div>
  );
}
