import { useState, useEffect, useCallback, forwardRef } from "react";
import {
  AromaCategory,
  AromaKeyword,
  aromaKeywords,
  categoryConfig,
} from "../data/aromaData";

const categories: AromaCategory[] = ["水果", "花香", "草本", "橡木", "陈年风味"];

interface AromaLexiconProps {
  selectedAroma?: string | null;
  onAromaViewed?: () => void;
}

const AromaLexicon = forwardRef<HTMLElement, AromaLexiconProps>(
  function AromaLexicon({ selectedAroma, onAromaViewed }, ref) {
  const [activeCategory, setActiveCategory] = useState<AromaCategory>("水果");
  const [detailKeyword, setDetailKeyword] = useState<AromaKeyword | null>(
    null
  );

  const filteredKeywords = aromaKeywords.filter(
    (k) => k.category === activeCategory
  );

  const openDetail = useCallback((keyword: AromaKeyword) => {
    setDetailKeyword(keyword);
  }, []);

  const closeDetail = useCallback(() => {
    setDetailKeyword(null);
    if (onAromaViewed) onAromaViewed();
  }, [onAromaViewed]);

  useEffect(() => {
    if (selectedAroma) {
      const found = aromaKeywords.find((k) => k.name === selectedAroma);
      if (found) {
        setActiveCategory(found.category);
        setDetailKeyword(found);
      }
    }
  }, [selectedAroma]);

  useEffect(() => {
    if (detailKeyword) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [detailKeyword]);

  return (
    <section className="aroma-lexicon panel" ref={ref}>
      <div className="section-heading">
        <div>
          <p>感官参考</p>
          <h2>香气关键词词库</h2>
        </div>
        <span className="lexicon-count">
          共 {aromaKeywords.length} 个关键词
        </span>
      </div>

      <div className="category-tabs">
        {categories.map((cat) => {
          const cfg = categoryConfig[cat];
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              className={`category-tab ${isActive ? "active" : ""}`}
              style={
                {
                  "--tab-color": cfg.color,
                } as React.CSSProperties
              }
              onClick={() => setActiveCategory(cat)}
            >
              <span className="tab-icon">{cfg.icon}</span>
              <span className="tab-label">{cfg.label}</span>
              <span className="tab-count">
                {aromaKeywords.filter((k) => k.category === cat).length}
              </span>
            </button>
          );
        })}
      </div>

      <div className="keyword-grid">
        {filteredKeywords.map((keyword) => {
          const cfg = categoryConfig[keyword.category];
          return (
            <button
              key={keyword.name}
              className="keyword-card"
              style={
                {
                  "--keyword-color": cfg.color,
                } as React.CSSProperties
              }
              onClick={() => openDetail(keyword)}
            >
              <span className="keyword-icon">{cfg.icon}</span>
              <span className="keyword-name">{keyword.name}</span>
              <span className="keyword-grapes">
                {keyword.grapes.slice(0, 2).join(" · ")}
              </span>
            </button>
          );
        })}
      </div>

      {detailKeyword && (
        <div className="modal-overlay" onClick={closeDetail}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
          >
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
                      onClick={() => openDetail(related)}
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

export default AromaLexicon;
