import { useState, useEffect, useCallback } from "react";
import { WineComparison as WineComparisonType, wineComparisons, wineCards } from "../data/wineData";

const STORAGE_KEY = "hxwl-08-review-list";

function loadReviewList(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as string[]) : [];
  } catch {
    return [];
  }
}

interface WineComparisonProps {
  onAromaClick?: (aroma: string) => void;
}

const difficultyConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  high: { label: "极易混淆", color: "#e11d48", bgColor: "rgba(225, 29, 72, 0.1)" },
  medium: { label: "中等难度", color: "#d97706", bgColor: "rgba(217, 119, 6, 0.1)" },
  low: { label: "基础对比", color: "#047857", bgColor: "rgba(4, 120, 87, 0.1)" },
};

export default function WineComparison({ onAromaClick }: WineComparisonProps) {
  const [reviewList, setReviewList] = useState<string[]>(loadReviewList);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "review">("all");

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reviewList));
    } catch {
      // ignore storage errors
    }
  }, [reviewList]);

  const toggleReview = useCallback((id: string) => {
    setReviewList((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      } else {
        return [...prev, id];
      }
    });
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const getWineById = (id: string) => wineCards.find((w) => w.id === id);

  const displayComparisons = activeTab === "review"
    ? wineComparisons.filter((c) => reviewList.includes(c.id))
    : wineComparisons;

  return (
    <section className="wine-comparison panel">
      <div className="section-heading">
        <div>
          <p>易混淆酒款</p>
          <h2>对比辨析</h2>
        </div>
        <div className="comparison-tabs">
          <button
            className={activeTab === "all" ? "tab-active" : ""}
            onClick={() => setActiveTab("all")}
          >
            全部对比
            <span className="tab-count">{wineComparisons.length}</span>
          </button>
          <button
            className={activeTab === "review" ? "tab-active" : ""}
            onClick={() => setActiveTab("review")}
          >
            重点复习
            <span className="tab-count">{reviewList.length}</span>
          </button>
        </div>
      </div>

      {displayComparisons.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">📚</span>
          <p>暂无重点复习内容</p>
          <p className="empty-hint">点击对比卡片右上角的"加入复习"按钮添加重点内容</p>
        </div>
      ) : (
        <div className="comparison-list">
          {displayComparisons.map((comparison) => (
            <ComparisonCard
              key={comparison.id}
              comparison={comparison}
              isExpanded={expandedId === comparison.id}
              isInReview={reviewList.includes(comparison.id)}
              onToggleExpand={() => toggleExpand(comparison.id)}
              onToggleReview={() => toggleReview(comparison.id)}
              getWineById={getWineById}
              onAromaClick={onAromaClick}
            />
          ))}
        </div>
      )}
    </section>
  );
}

interface ComparisonCardProps {
  comparison: WineComparisonType;
  isExpanded: boolean;
  isInReview: boolean;
  onToggleExpand: () => void;
  onToggleReview: () => void;
  getWineById: (id: string) => typeof wineCards[0] | undefined;
  onAromaClick?: (aroma: string) => void;
}

function ComparisonCard({
  comparison,
  isExpanded,
  isInReview,
  onToggleExpand,
  onToggleReview,
  getWineById,
  onAromaClick,
}: ComparisonCardProps) {
  const difficulty = difficultyConfig[comparison.difficulty];
  const wine1 = getWineById(comparison.wineIds[0]);
  const wine2 = getWineById(comparison.wineIds[1]);

  return (
    <article className={`comparison-card ${isExpanded ? "expanded" : ""}`}>
      <div className="comparison-header">
        <div className="comparison-titles">
          <div className="wines-row">
            <span className="wine-name">{comparison.wines[0]}</span>
            <span className="vs-divider">VS</span>
            <span className="wine-name">{comparison.wines[1]}</span>
          </div>
          <div className="comparison-meta">
            <span
              className="difficulty-badge"
              style={{ color: difficulty.color, background: difficulty.bgColor }}
            >
              {difficulty.label}
            </span>
            {wine1 && wine2 && (
              <span className="wine-grapes">
                {wine1.grape} vs {wine2.grape}
              </span>
            )}
          </div>
        </div>
        <div className="comparison-actions">
          <button
            className={`review-toggle-btn ${isInReview ? "in-review" : ""}`}
            onClick={onToggleReview}
            title={isInReview ? "从重点复习中移除" : "加入重点复习"}
          >
            <span className="star-icon">{isInReview ? "★" : "☆"}</span>
            <span>{isInReview ? "已加入" : "加入复习"}</span>
          </button>
          <button
            className="expand-btn"
            onClick={onToggleExpand}
            aria-expanded={isExpanded}
          >
            {isExpanded ? "收起" : "展开"}
            <span className={`chevron ${isExpanded ? "up" : "down"}`}>▼</span>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="comparison-content">
          <div className="content-section similarities">
            <h4 className="section-title">
              <span className="section-icon">🤝</span>
              相似点
            </h4>
            <ul className="bullet-list">
              {comparison.similarities.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="content-section distinguishing">
            <h4 className="section-title">
              <span className="section-icon">🔍</span>
              关键区分线索
            </h4>
            <div className="clues-grid">
              {comparison.distinguishingClues.map((wineClues, idx) => (
                <div key={idx} className="wine-clues">
                  <h5 className="wine-title">{wineClues.wine}</h5>
                  <ul className="clue-list">
                    {wineClues.clues.map((clue, clueIdx) => (
                      <li key={clueIdx}>
                        <span className="clue-dot" />
                        {clue}
                      </li>
                    ))}
                  </ul>
                  {idx === 0 && wine1 && (
                    <div className="wine-aromas">
                      <span className="aromas-label">典型香气：</span>
                      <div className="aroma-tags">
                        {wine1.aromas.map((aroma) => (
                          <button
                            key={aroma}
                            className="aroma-tag aroma-tag-clickable"
                            onClick={() => onAromaClick?.(aroma)}
                          >
                            {aroma}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {idx === 1 && wine2 && (
                    <div className="wine-aromas">
                      <span className="aromas-label">典型香气：</span>
                      <div className="aroma-tags">
                        {wine2.aromas.map((aroma) => (
                          <button
                            key={aroma}
                            className="aroma-tag aroma-tag-clickable"
                            onClick={() => onAromaClick?.(aroma)}
                          >
                            {aroma}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="content-section misjudgment">
            <h4 className="section-title">
              <span className="section-icon">⚠️</span>
              常见误判原因
            </h4>
            <ul className="bullet-list warning-list">
              {comparison.misjudgmentReasons.map((reason, index) => (
                <li key={index}>{reason}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </article>
  );
}
