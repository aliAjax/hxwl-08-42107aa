import { useMemo } from "react";
import { WineRecord } from "../data/wineRecordTypes";
import {
  computeRegionStats,
  formatLastPracticed,
  RegionStat,
} from "../data/regionStats";

interface RegionMapDashboardProps {
  records: WineRecord[];
  onSelectRegion: (regionKey: string) => void;
}

const REGION_LAYOUT: { key: string; gridArea: string }[] = [
  { key: "burgundy", gridArea: "burgundy" },
  { key: "bordeaux", gridArea: "bordeaux" },
  { key: "tuscany", gridArea: "tuscany" },
  { key: "piedmont", gridArea: "piedmont" },
  { key: "rioja", gridArea: "rioja" },
  { key: "napa", gridArea: "napa" },
  { key: "mendoza", gridArea: "mendoza" },
  { key: "barossa", gridArea: "barossa" },
];

export default function RegionMapDashboard({
  records,
  onSelectRegion,
}: RegionMapDashboardProps) {
  const stats = useMemo(() => computeRegionStats(records), [records]);

  const totalRecords = stats.reduce((sum, s) => sum + s.count, 0);
  const avgAccuracy =
    totalRecords > 0
      ? Math.round(
          stats.reduce((sum, s) => sum + s.accuracy * s.count, 0) / totalRecords
        )
      : 0;
  const activeRegions = stats.filter((s) => s.count > 0).length;

  return (
    <section className="region-dashboard panel">
      <div className="section-heading">
        <div>
          <p>产区覆盖</p>
          <h2>产区练习地图</h2>
        </div>
        <div style={{ display: "flex", gap: "16px" }}>
          <div className="mini-stat">
            <span>覆盖产区</span>
            <strong>{activeRegions} / {stats.length}</strong>
          </div>
          <div className="mini-stat">
            <span>总记录数</span>
            <strong>{totalRecords}</strong>
          </div>
          <div className="mini-stat">
            <span>平均正确率</span>
            <strong>{avgAccuracy}%</strong>
          </div>
        </div>
      </div>

      <div className="region-map-grid">
        {REGION_LAYOUT.map((layout) => {
          const stat = stats.find((s) => s.key === layout.key);
          if (!stat) return null;
          return (
            <RegionTile
              key={stat.key}
              stat={stat}
              onClick={() => onSelectRegion(stat.key)}
            />
          );
        })}
      </div>

      <div className="region-legend">
        <span className="legend-label">图例</span>
        <div className="legend-items">
          <span className="legend-item">
            <i className="legend-dot legend-ok" /> 高覆盖
          </span>
          <span className="legend-item">
            <i className="legend-dot legend-medium" /> 中覆盖
          </span>
          <span className="legend-item">
            <i className="legend-dot legend-low" /> 低覆盖
          </span>
          <span className="legend-item">
            <i className="legend-dot legend-empty" /> 未覆盖
          </span>
        </div>
      </div>
    </section>
  );
}

interface RegionTileProps {
  stat: RegionStat;
  onClick: () => void;
}

function RegionTile({ stat, onClick }: RegionTileProps) {
  const level =
    stat.count === 0 ? "empty" : stat.count >= 5 ? "high" : stat.count >= 2 ? "medium" : "low";

  return (
    <button
      className={`region-tile region-${level}`}
      style={{ "--region-color": stat.color } as React.CSSProperties}
      onClick={onClick}
    >
      <div className="region-tile-header">
        <span className="region-dot" />
        <span className="region-name">{stat.name}</span>
      </div>
      <div className="region-country">{stat.country}</div>

      <div className="region-stats">
        <div className="region-stat-item">
          <span className="region-stat-label">记录</span>
          <span className="region-stat-value">{stat.count}</span>
        </div>
        <div className="region-stat-item">
          <span className="region-stat-label">正确率</span>
          <span className="region-stat-value">{stat.accuracy || "-"}%</span>
        </div>
      </div>

      <div className="region-footer">
        <span className="region-practice">
          ⏱ {formatLastPracticed(stat.lastPracticed)}
        </span>
        <span className="region-arrow">→</span>
      </div>
    </button>
  );
}
