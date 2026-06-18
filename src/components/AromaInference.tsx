import { useState, useMemo, useCallback, forwardRef } from "react";
import {
  AromaCategory,
  AromaKeyword,
  aromaKeywords,
  categoryConfig,
} from "../data/aromaData";
import { wineCards, WineCard } from "../data/wineData";
import { WineRecord } from "../data/wineRecordTypes";

const categories: AromaCategory[] = ["水果", "花香", "草本", "橡木", "陈年风味"];

interface GrapeCandidate {
  name: string;
  score: number;
  supportingAromas: string[];
}

interface RegionCandidate {
  name: string;
  score: number;
  supportingAromas: string[];
}

interface WineCardCandidate {
  card: WineCard;
  score: number;
  matchedAromas: string[];
}

interface WineRecordCandidate {
  record: WineRecord;
  score: number;
  matchedAromas: string[];
}

interface InferenceResult {
  grapes: GrapeCandidate[];
  regions: RegionCandidate[];
  wineCards: WineCardCandidate[];
  wineRecords: WineRecordCandidate[];
}

interface AromaInferenceProps {
  wineRecords: WineRecord[];
  onAromaClick: (aroma: string) => void;
  onViewAromaDetail?: (keyword: AromaKeyword) => void;
  onViewRecord?: (recordId: string, recordName: string) => void;
}

function inferFromAromas(selectedAromas: string[], wineRecords: WineRecord[]): InferenceResult {
  const selectedKeywords = aromaKeywords.filter((k) => selectedAromas.includes(k.name));

  const grapeMap = new Map<string, { score: number; supportingAromas: Set<string> }>();
  const regionMap = new Map<string, { score: number; supportingAromas: Set<string> }>();

  selectedKeywords.forEach((kw) => {
    kw.grapes.forEach((g) => {
      if (!grapeMap.has(g)) {
        grapeMap.set(g, { score: 0, supportingAromas: new Set() });
      }
      const entry = grapeMap.get(g)!;
      entry.score += 1;
      entry.supportingAromas.add(kw.name);
    });
    kw.regions.forEach((r) => {
      if (!regionMap.has(r)) {
        regionMap.set(r, { score: 0, supportingAromas: new Set() });
      }
      const entry = regionMap.get(r)!;
      entry.score += 1;
      entry.supportingAromas.add(kw.name);
    });
  });

  const grapes: GrapeCandidate[] = Array.from(grapeMap.entries())
    .map(([name, data]) => ({
      name,
      score: data.score,
      supportingAromas: Array.from(data.supportingAromas),
    }))
    .sort((a, b) => b.score - a.score);

  const regions: RegionCandidate[] = Array.from(regionMap.entries())
    .map(([name, data]) => ({
      name,
      score: data.score,
      supportingAromas: Array.from(data.supportingAromas),
    }))
    .sort((a, b) => b.score - a.score);

  const wineCardCandidates: WineCardCandidate[] = wineCards
    .map((card) => {
      const matched = card.aromas.filter((a) => selectedAromas.includes(a));
      return {
        card,
        score: matched.length,
        matchedAromas: matched,
      };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);

  const wineRecordCandidates: WineRecordCandidate[] = wineRecords
    .map((record) => {
      const matched = record.aromas.filter((a) => selectedAromas.includes(a));
      return {
        record,
        score: matched.length,
        matchedAromas: matched,
      };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);

  return { grapes, regions, wineCards: wineCardCandidates, wineRecords: wineRecordCandidates };
}

const AromaInference = forwardRef<HTMLElement, AromaInferenceProps>(
  function AromaInference({ wineRecords, onAromaClick, onViewAromaDetail, onViewRecord }, ref) {
    const [activeCategory, setActiveCategory] = useState<AromaCategory>("水果");
    const [selectedAromas, setSelectedAromas] = useState<string[]>([]);
    const [detailKeyword, setDetailKeyword] = useState<AromaKeyword | null>(null);

    const filteredKeywords = aromaKeywords.filter(
      (k) => k.category === activeCategory
    );

    const toggleAroma = useCallback((name: string) => {
      setSelectedAromas((prev) =>
        prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name]
      );
    }, []);

    const clearSelection = useCallback(() => {
      setSelectedAromas([]);
    }, []);

    const closeDetail = useCallback(() => {
      setDetailKeyword(null);
    }, []);

    const handleKeywordClick = useCallback(
      (keyword: AromaKeyword) => {
        if (onViewAromaDetail) {
          onViewAromaDetail(keyword);
        } else {
          setDetailKeyword(keyword);
        }
      },
      [onViewAromaDetail]
    );

    const result = useMemo<InferenceResult>(
      () => inferFromAromas(selectedAromas, wineRecords),
      [selectedAromas, wineRecords]
    );

    const hasSelection = selectedAromas.length > 0;
    const hasAnyResult =
      result.grapes.length > 0 ||
      result.regions.length > 0 ||
      result.wineCards.length > 0 ||
      result.wineRecords.length > 0;

    const maxGrapeScore = result.grapes[0]?.score ?? 0;
    const maxRegionScore = result.regions[0]?.score ?? 0;

    return (
      <section className="aroma-inference panel" ref={ref}>
        <div className="section-heading">
          <div>
            <p>盲品辅助</p>
            <h2>香气推理</h2>
          </div>
          {hasSelection && (
            <button className="clear-filters-btn" onClick={clearSelection}>
              清空选择 ({selectedAromas.length})
            </button>
          )}
        </div>

        <p className="inference-hint">
          选择你感知到的香气关键词，系统将根据香气词库、范例酒卡和本地记录反推可能的葡萄品种、产区和对应酒款。
        </p>

        <div className="inference-category-tabs">
          {categories.map((cat) => {
            const cfg = categoryConfig[cat];
            const isActive = activeCategory === cat;
            const countInCategory = aromaKeywords.filter(
              (k) => k.category === cat
            ).length;
            const selectedInCategory = selectedAromas.filter((a) =>
              aromaKeywords.find((k) => k.name === a && k.category === cat)
            ).length;
            return (
              <button
                key={cat}
                className={`category-tab ${isActive ? "active" : ""}`}
                style={{ "--tab-color": cfg.color } as React.CSSProperties}
                onClick={() => setActiveCategory(cat)}
              >
                <span className="tab-icon">{cfg.icon}</span>
                <span className="tab-label">{cfg.label}</span>
                <span className="tab-count">
                  {selectedInCategory > 0
                    ? `${selectedInCategory}/${countInCategory}`
                    : countInCategory}
                </span>
              </button>
            );
          })}
        </div>

        <div className="inference-keyword-grid">
          {filteredKeywords.map((keyword) => {
            const cfg = categoryConfig[keyword.category];
            const isSelected = selectedAromas.includes(keyword.name);
            return (
              <div key={keyword.name} className="inference-keyword-wrapper">
                <button
                  className={`keyword-card inference-keyword-card ${
                    isSelected ? "selected" : ""
                  }`}
                  style={{ "--keyword-color": cfg.color } as React.CSSProperties}
                  onClick={() => toggleAroma(keyword.name)}
                >
                  <span className="keyword-icon">{cfg.icon}</span>
                  <span className="keyword-name">{keyword.name}</span>
                  {isSelected && <span className="selected-check">✓</span>}
                </button>
                <button
                  className="keyword-info-btn"
                  onClick={() => handleKeywordClick(keyword)}
                  title="查看香气详情"
                >
                  ⓘ
                </button>
              </div>
            );
          })}
        </div>

        {hasSelection && (
          <div className="selected-aromas-bar">
            <span className="selected-label">已选香气：</span>
            <div className="selected-aromas-tags">
              {selectedAromas.map((a) => {
                const kw = aromaKeywords.find((k) => k.name === a);
                const color = kw ? categoryConfig[kw.category].color : "#888";
                return (
                  <span
                    key={a}
                    className="selected-aroma-tag"
                    style={{ background: color }}
                  >
                    {a}
                    <button onClick={() => toggleAroma(a)}>✕</button>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {!hasSelection ? (
          <div className="empty-state">
            <span className="empty-icon">🧠</span>
            <p>请先选择至少一个香气关键词</p>
            <p className="empty-hint">系统将根据你选择的香气组合进行推理</p>
          </div>
        ) : !hasAnyResult ? (
          <div className="empty-state">
            <span className="empty-icon">🔍</span>
            <p>没有匹配的品种或产区</p>
            <p className="empty-hint">
              当前选择的香气组合在词库数据中暂无对应品种或产区。
              可以尝试选择更多关键词，或点击下方「查看香气详情」获取单个香气的解析。
            </p>
            <button
              className="clear-filters-btn"
              style={{ marginTop: "12px" }}
              onClick={clearSelection}
            >
              重新选择
            </button>
          </div>
        ) : (
          <div className="inference-results">
            {result.grapes.length > 0 && (
              <div className="result-section">
                <div className="result-section-header">
                  <h3>🍇 候选葡萄品种</h3>
                  <span className="result-count">{result.grapes.length} 个</span>
                </div>
                <div className="result-list">
                  {result.grapes.map((g) => {
                    const pct = maxGrapeScore > 0 ? (g.score / maxGrapeScore) * 100 : 0;
                    return (
                      <div key={g.name} className="result-item">
                        <div className="result-item-main">
                          <div className="result-item-title-row">
                            <span className="result-item-name">{g.name}</span>
                            <span className="result-item-score">匹配度 {g.score}</span>
                          </div>
                          <div className="result-item-bar">
                            <div
                              className="result-item-bar-fill grape-bar"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="result-item-supporting">
                            <span className="supporting-label">匹配香气：</span>
                            {g.supportingAromas.map((a) => (
                              <button
                                key={a}
                                className="supporting-aroma-link"
                                onClick={() => onAromaClick(a)}
                              >
                                {a}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {result.regions.length > 0 && (
              <div className="result-section">
                <div className="result-section-header">
                  <h3>🗺️ 候选产区</h3>
                  <span className="result-count">{result.regions.length} 个</span>
                </div>
                <div className="result-list">
                  {result.regions.map((r) => {
                    const pct = maxRegionScore > 0 ? (r.score / maxRegionScore) * 100 : 0;
                    return (
                      <div key={r.name} className="result-item">
                        <div className="result-item-main">
                          <div className="result-item-title-row">
                            <span className="result-item-name">{r.name}</span>
                            <span className="result-item-score">匹配度 {r.score}</span>
                          </div>
                          <div className="result-item-bar">
                            <div
                              className="result-item-bar-fill region-bar"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="result-item-supporting">
                            <span className="supporting-label">匹配香气：</span>
                            {r.supportingAromas.map((a) => (
                              <button
                                key={a}
                                className="supporting-aroma-link"
                                onClick={() => onAromaClick(a)}
                              >
                                {a}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {result.wineCards.length > 0 && (
              <div className="result-section">
                <div className="result-section-header">
                  <h3>📋 范例酒卡匹配</h3>
                  <span className="result-count">{result.wineCards.length} 款</span>
                </div>
                <div className="result-list">
                  {result.wineCards.map((wc) => (
                    <div key={wc.card.id} className="result-item wine-match-item">
                      <div className="result-item-main">
                        <div className="result-item-title-row">
                          <span className="result-item-name">
                            {wc.card.region} · {wc.card.grape}
                          </span>
                          <span className="result-item-score">
                            {wc.matchedAromas.length}/{wc.card.aromas.length} 香气匹配
                          </span>
                        </div>
                        <p className="wine-match-explanation">{wc.card.explanation}</p>
                        <div className="result-item-supporting">
                          <span className="supporting-label">匹配香气：</span>
                          {wc.matchedAromas.map((a) => (
                            <button
                              key={a}
                              className="supporting-aroma-link matched"
                              onClick={() => onAromaClick(a)}
                            >
                              {a}
                            </button>
                          ))}
                        </div>
                        <div className="result-item-supporting">
                          <span className="supporting-label">酒卡香气：</span>
                          {wc.card.aromas.map((a) => {
                            const isMatched = wc.matchedAromas.includes(a);
                            return (
                              <button
                                key={a}
                                className={`supporting-aroma-link ${
                                  isMatched ? "matched" : "unmatched"
                                }`}
                                onClick={() => onAromaClick(a)}
                              >
                                {a}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.wineRecords.length > 0 && (
              <div className="result-section">
                <div className="result-section-header">
                  <h3>📝 本地记录匹配</h3>
                  <span className="result-count">{result.wineRecords.length} 条</span>
                </div>
                <div className="result-list">
                  {result.wineRecords.map((wr) => (
                    <div key={wr.record.id} className="result-item wine-match-item record-match-item">
                      <div className="result-item-main">
                        <div className="result-item-title-row">
                          <span className="result-item-name">
                            {wr.record.name}
                            {wr.record.year ? ` (${wr.record.year})` : ""}
                          </span>
                          <span className="result-item-score">
                            {wr.matchedAromas.length}/{wr.record.aromas.length} 香气匹配
                          </span>
                        </div>
                        <p className="wine-match-subtitle">
                          {[wr.record.grape, wr.record.region, wr.record.country]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        {wr.record.notes && (
                          <p className="wine-match-explanation">{wr.record.notes}</p>
                        )}
                        <div className="result-item-supporting">
                          <span className="supporting-label">匹配香气：</span>
                          {wr.matchedAromas.map((a) => (
                            <button
                              key={a}
                              className="supporting-aroma-link matched"
                              onClick={() => onAromaClick(a)}
                            >
                              {a}
                            </button>
                          ))}
                        </div>
                        <div className="result-item-supporting">
                          <span className="supporting-label">记录香气：</span>
                          {wr.record.aromas.map((a) => {
                            const isMatched = wr.matchedAromas.includes(a);
                            return (
                              <button
                                key={a}
                                className={`supporting-aroma-link ${
                                  isMatched ? "matched" : "unmatched"
                                }`}
                                onClick={() => onAromaClick(a)}
                              >
                                {a}
                              </button>
                            );
                          })}
                        </div>
                        {onViewRecord && (
                          <div className="record-match-actions">
                            <button
                              className="view-record-btn"
                              onClick={() =>
                                onViewRecord(wr.record.id, wr.record.name)
                              }
                            >
                              <span>📄</span>
                              <span>查看完整记录</span>
                              <span className="view-record-arrow">→</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {detailKeyword && (
          <div className="modal-overlay" onClick={closeDetail}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-title-row">
                  <span className="modal-icon">
                    {categoryConfig[detailKeyword.category].icon}
                  </span>
                  <h3>{detailKeyword.name}</h3>
                  <span
                    className="modal-category-badge"
                    style={{
                      background: categoryConfig[detailKeyword.category].color,
                    }}
                  >
                    {detailKeyword.category}
                  </span>
                </div>
                <button className="modal-close" onClick={closeDetail}>
                  ✕
                </button>
              </div>

              <p className="modal-description">{detailKeyword.description}</p>

              <div className="modal-section">
                <h4>常见对应品种</h4>
                <div className="modal-tags">
                  {detailKeyword.grapes.map((grape) => (
                    <span key={grape} className="modal-tag grape-tag">
                      {grape}
                    </span>
                  ))}
                </div>
              </div>

              <div className="modal-section">
                <h4>典型产区</h4>
                <div className="modal-tags">
                  {detailKeyword.regions.map((region) => (
                    <span key={region} className="modal-tag region-tag">
                      {region}
                    </span>
                  ))}
                </div>
              </div>

              <div className="modal-section">
                <h4>相关香气</h4>
                <div className="modal-tags">
                  {aromaKeywords
                    .filter(
                      (k) =>
                        k.category === detailKeyword.category &&
                        k.name !== detailKeyword.name
                    )
                    .slice(0, 5)
                    .map((related) => (
                      <button
                        key={related.name}
                        className="modal-tag related-tag"
                        onClick={() => setDetailKeyword(related)}
                      >
                        {related.name}
                      </button>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    );
  }
);

export default AromaInference;
