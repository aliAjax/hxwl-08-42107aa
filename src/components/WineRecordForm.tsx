import { useState, useEffect, useMemo, useRef } from "react";
import { WineRecordInput } from "../data/wineRecordTypes";
import { aromaKeywords, AromaKeyword, categoryConfig, AromaCategory } from "../data/aromaData";

interface WineRecordFormProps {
  initialData?: WineRecordInput;
  onSubmit: (data: WineRecordInput) => void;
  onCancel: () => void;
  mode: "add" | "edit";
}

const acidityOptions = ["低", "中低", "中等", "中高", "高", "极高"];
const tanninOptions = ["无", "低", "中低", "中等", "中高", "高", "极高"];
const bodyOptions = ["轻盈", "轻盈到中等", "中等", "中等偏饱满", "饱满"];
const aromaCategories: AromaCategory[] = ["水果", "花香", "草本", "橡木", "陈年风味"];

export default function WineRecordForm({
  initialData,
  onSubmit,
  onCancel,
  mode,
}: WineRecordFormProps) {
  const [formData, setFormData] = useState<WineRecordInput>({
    name: "",
    region: "",
    country: "",
    grape: "",
    year: "",
    acidity: "中等",
    tannin: "中等",
    body: "中等",
    color: "",
    alcohol: "",
    aromas: [],
    characteristic: "",
    notes: "",
  });
  const [aromaSearchQuery, setAromaSearchQuery] = useState("");
  const [customAromaInput, setCustomAromaInput] = useState("");
  const [activeAromaCategory, setActiveAromaCategory] = useState<AromaCategory | "全部">("全部");
  const customInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const toggleAroma = (aromaName: string) => {
    setFormData((prev) => {
      const hasAroma = prev.aromas.includes(aromaName);
      return {
        ...prev,
        aromas: hasAroma
          ? prev.aromas.filter((a) => a !== aromaName)
          : [...prev.aromas, aromaName],
      };
    });
  };

  const removeAroma = (aromaName: string) => {
    setFormData((prev) => ({
      ...prev,
      aromas: prev.aromas.filter((a) => a !== aromaName),
    }));
  };

  const addCustomAroma = () => {
    const trimmed = customAromaInput.trim();
    if (!trimmed) return;
    if (formData.aromas.includes(trimmed)) {
      setCustomAromaInput("");
      return;
    }
    setFormData((prev) => ({
      ...prev,
      aromas: [...prev.aromas, trimmed],
    }));
    setCustomAromaInput("");
    customInputRef.current?.focus();
  };

  const handleCustomAromaKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addCustomAroma();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const isValid = formData.name.trim() && formData.region.trim() && formData.grape.trim();

  const isLexiconAroma = (name: string): boolean => {
    return aromaKeywords.some((k) => k.name === name);
  };

  const selectedLexiconAromas = formData.aromas.filter(isLexiconAroma);
  const selectedCustomAromas = formData.aromas.filter((a) => !isLexiconAroma(a));

  const filteredAromasByCategory = useMemo(() => {
    let filtered = aromaKeywords;
    if (aromaSearchQuery.trim()) {
      const q = aromaSearchQuery.trim().toLowerCase();
      filtered = filtered.filter(
        (k) =>
          k.name.toLowerCase().includes(q) ||
          k.description.toLowerCase().includes(q) ||
          k.grapes.some((g) => g.toLowerCase().includes(q)) ||
          k.regions.some((r) => r.toLowerCase().includes(q))
      );
    }
    if (activeAromaCategory !== "全部") {
      filtered = filtered.filter((k) => k.category === activeAromaCategory);
    }
    const grouped = filtered.reduce((acc, aroma) => {
      if (!acc[aroma.category]) {
        acc[aroma.category] = [];
      }
      acc[aroma.category].push(aroma);
      return acc;
    }, {} as Record<string, AromaKeyword[]>);
    return grouped;
  }, [aromaSearchQuery, activeAromaCategory]);

  const hasSearchResults = Object.keys(filteredAromasByCategory).length > 0;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content wine-record-form" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-row">
            <span className="modal-icon">🍷</span>
            <h3>{mode === "add" ? "新增盲品记录" : "编辑盲品记录"}</h3>
          </div>
          <button className="modal-close" onClick={onCancel}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <h4 className="form-section-title">基本信息</h4>
            <div className="field-grid">
              <label>
                <span>酒款名称 *</span>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="例如：左岸混酿"
                  required
                />
              </label>
              <label>
                <span>葡萄品种 *</span>
                <input
                  type="text"
                  name="grape"
                  value={formData.grape}
                  onChange={handleChange}
                  placeholder="例如：赤霞珠"
                  required
                />
              </label>
              <label>
                <span>产区 *</span>
                <input
                  type="text"
                  name="region"
                  value={formData.region}
                  onChange={handleChange}
                  placeholder="例如：波尔多左岸"
                  required
                />
              </label>
              <label>
                <span>国家</span>
                <input
                  type="text"
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  placeholder="例如：法国"
                />
              </label>
              <label>
                <span>年份</span>
                <input
                  type="text"
                  name="year"
                  value={formData.year || ""}
                  onChange={handleChange}
                  placeholder="例如：2018"
                />
              </label>
              <label>
                <span>颜色</span>
                <input
                  type="text"
                  name="color"
                  value={formData.color || ""}
                  onChange={handleChange}
                  placeholder="例如：深宝石红"
                />
              </label>
              <label>
                <span>酒精度</span>
                <input
                  type="text"
                  name="alcohol"
                  value={formData.alcohol || ""}
                  onChange={handleChange}
                  placeholder="例如：13.5%-14.5%"
                />
              </label>
              <label>
                <span>主要特征</span>
                <input
                  type="text"
                  name="characteristic"
                  value={formData.characteristic}
                  onChange={handleChange}
                  placeholder="例如：高单宁"
                />
              </label>
            </div>
          </div>

          <div className="form-section">
            <h4 className="form-section-title">感官特征</h4>
            <div className="field-grid">
              <label>
                <span>酸度</span>
                <select name="acidity" value={formData.acidity} onChange={handleChange}>
                  {acidityOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>单宁</span>
                <select name="tannin" value={formData.tannin} onChange={handleChange}>
                  {tanninOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>酒体</span>
                <select name="body" value={formData.body} onChange={handleChange}>
                  {bodyOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="form-section">
            <h4 className="form-section-title">
              香气关键词
              <span className="form-hint">已选 {formData.aromas.length} 个</span>
            </h4>

            {formData.aromas.length > 0 && (
              <div className="selected-aromas-section">
                <span className="selected-aromas-label">已选香气：</span>
                <div className="selected-aromas-list">
                  {formData.aromas.map((aroma) => {
                    const isLexicon = isLexiconAroma(aroma);
                    return (
                      <span
                        key={aroma}
                        className={`selected-aroma-chip ${isLexicon ? "is-lexicon" : "is-custom"}`}
                      >
                        <span className="chip-text">{aroma}</span>
                        <button
                          type="button"
                          className="chip-remove"
                          onClick={() => removeAroma(aroma)}
                          title={`移除「${aroma}」`}
                        >
                          ✕
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="aroma-selector-toolbar">
              <div className="aroma-search-wrapper">
                <span className="aroma-search-icon">🔍</span>
                <input
                  type="text"
                  className="aroma-search-input"
                  placeholder="搜索香气关键词、品种、产区..."
                  value={aromaSearchQuery}
                  onChange={(e) => setAromaSearchQuery(e.target.value)}
                />
                {aromaSearchQuery && (
                  <button
                    type="button"
                    className="aroma-search-clear"
                    onClick={() => setAromaSearchQuery("")}
                    title="清除搜索"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <div className="aroma-category-tabs">
              <button
                type="button"
                className={`aroma-category-tab ${activeAromaCategory === "全部" ? "active" : ""}`}
                onClick={() => setActiveAromaCategory("全部")}
              >
                全部
              </button>
              {aromaCategories.map((cat) => {
                const cfg = categoryConfig[cat];
                const isActive = activeAromaCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    className={`aroma-category-tab ${isActive ? "active" : ""}`}
                    style={isActive ? { background: cfg.color, borderColor: cfg.color } : undefined}
                    onClick={() => setActiveAromaCategory(cat)}
                  >
                    <span>{cfg.icon}</span>
                    {cfg.label}
                  </button>
                );
              })}
            </div>

            <div className="aroma-selector">
              {hasSearchResults ? (
                Object.entries(filteredAromasByCategory).map(([category, aromas]) => {
                  const cfg = categoryConfig[category as AromaCategory];
                  return (
                    <div key={category} className="aroma-category-group">
                      <h5 className="aroma-category-title" style={{ color: cfg?.color }}>
                        {cfg?.icon} {category}
                      </h5>
                      <div className="aroma-tag-list">
                        {aromas.map((aroma) => (
                          <button
                            key={aroma.name}
                            type="button"
                            className={`aroma-select-tag ${
                              formData.aromas.includes(aroma.name) ? "selected" : ""
                            }`}
                            onClick={() => toggleAroma(aroma.name)}
                            title={aroma.description}
                          >
                            {aroma.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="aroma-no-results">
                  <span className="no-results-icon">🔍</span>
                  <p>没有找到匹配的香气关键词</p>
                  <p className="no-results-hint">
                    试试其他搜索词，或在下方添加自定义香气
                  </p>
                </div>
              )}
            </div>

            <div className="custom-aroma-section">
              <span className="custom-aroma-label">补充自定义香气：</span>
              <div className="custom-aroma-input-row">
                <input
                  ref={customInputRef}
                  type="text"
                  className="custom-aroma-input"
                  placeholder="输入自定义香气名称，如：蓝莓、焦糖..."
                  value={customAromaInput}
                  onChange={(e) => setCustomAromaInput(e.target.value)}
                  onKeyDown={handleCustomAromaKeyDown}
                />
                <button
                  type="button"
                  className="custom-aroma-add-btn"
                  onClick={addCustomAroma}
                  disabled={!customAromaInput.trim() || formData.aromas.includes(customAromaInput.trim())}
                >
                  添加
                </button>
              </div>
              {selectedCustomAromas.length > 0 && (
                <p className="custom-aroma-hint">
                  💡 自定义香气（共 {selectedCustomAromas.length} 个）保存后可正常显示与记录，但香气词库中暂无详细解析
                </p>
              )}
            </div>
          </div>

          <div className="form-section">
            <h4 className="form-section-title">品鉴笔记</h4>
            <label>
              <span>笔记</span>
              <textarea
                name="notes"
                value={formData.notes || ""}
                onChange={handleChange}
                placeholder="记录你的品鉴感受..."
                rows={4}
              />
            </label>
          </div>

          <div className="form-actions">
            <button type="button" className="form-btn cancel-btn" onClick={onCancel}>
              取消
            </button>
            <button
              type="submit"
              className="form-btn submit-btn primary-action"
              disabled={!isValid}
            >
              {mode === "add" ? "添加记录" : "保存修改"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
