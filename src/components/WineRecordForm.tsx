import { useState, useEffect } from "react";
import { WineRecordInput } from "../data/wineRecordTypes";
import { aromaKeywords, AromaKeyword } from "../data/aromaData";

interface WineRecordFormProps {
  initialData?: WineRecordInput;
  onSubmit: (data: WineRecordInput) => void;
  onCancel: () => void;
  mode: "add" | "edit";
}

const acidityOptions = ["低", "中低", "中等", "中高", "高", "极高"];
const tanninOptions = ["无", "低", "中低", "中等", "中高", "高", "极高"];
const bodyOptions = ["轻盈", "轻盈到中等", "中等", "中等偏饱满", "饱满"];

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const isValid = formData.name.trim() && formData.region.trim() && formData.grape.trim();

  const aromasByCategory = aromaKeywords.reduce((acc, aroma) => {
    if (!acc[aroma.category]) {
      acc[aroma.category] = [];
    }
    acc[aroma.category].push(aroma);
    return acc;
  }, {} as Record<string, AromaKeyword[]>);

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
            <div className="aroma-selector">
              {Object.entries(aromasByCategory).map(([category, aromas]) => (
                <div key={category} className="aroma-category-group">
                  <h5 className="aroma-category-title">{category}</h5>
                  <div className="aroma-tag-list">
                    {aromas.map((aroma) => (
                      <button
                        key={aroma.name}
                        type="button"
                        className={`aroma-select-tag ${
                          formData.aromas.includes(aroma.name) ? "selected" : ""
                        }`}
                        onClick={() => toggleAroma(aroma.name)}
                      >
                        {aroma.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
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
