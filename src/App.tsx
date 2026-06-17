import "./styles.css";
import { useState, useRef, useCallback, useEffect } from "react";
import BlindTastingCard from "./components/BlindTastingCard";
import BlindQuiz from "./components/BlindQuiz";
import AromaLexicon from "./components/AromaLexicon";
import ReviewPlan, { ReviewRecord } from "./components/ReviewPlan";
import WineComparison from "./components/WineComparison";
import { aromaKeywords } from "./data/aromaData";
import { wineComparisons } from "./data/wineData";

const project = {
  "id": "hxwl-08",
  "port": 5108,
  "title": "葡萄酒盲品训练",
  "subtitle": "产区、品种与感官特征的盲品复习系统",
  "stack": "React + Vite + TypeScript + CSS",
  "theme": [
    "#9f1239",
    "#047857",
    "#d97706"
  ],
  "domain": "葡萄酒学习",
  "users": [
    "侍酒师学员",
    "讲师",
    "爱好者"
  ],
  "metrics": [
    "复习卡片",
    "易混淆酒款",
    "正确率",
    "产区覆盖"
  ],
  "filters": [
    "波尔多",
    "勃艮第",
    "纳帕",
    "里奥哈"
  ],
  "fields": [
    "产区",
    "葡萄品种",
    "年份",
    "酸度",
    "单宁",
    "酒体",
    "香气关键词"
  ],
  "records": [
    [
      "左岸混酿",
      "赤霞珠",
      "高单宁",
      "黑醋栗、雪松、铅笔芯"
    ],
    [
      "勃艮第村级",
      "黑皮诺",
      "中等酒体",
      "红樱桃、蘑菇、湿叶"
    ],
    [
      "里奥哈珍藏",
      "丹魄",
      "橡木明显",
      "香草、椰子、熟李子"
    ]
  ]
};

const statusColors = ["status-ok", "status-watch", "status-danger"];

function MetricCard({ label, value, index }: { label: string; value: string; index: number }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <i className={statusColors[index % statusColors.length]} />
    </article>
  );
}

function App() {
  const [selectedAroma, setSelectedAroma] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "warn" | "info" } | null>(null);
  const lexiconRef = useRef<HTMLElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, tone: "warn" | "info" = "warn") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, tone });
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const handleAromaClick = useCallback((aroma: string) => {
    const found = aromaKeywords.some((k) => k.name === aroma);
    if (!found) {
      showToast(`词库中暂无「${aroma}」的详细解析`, "warn");
      return;
    }
    setSelectedAroma(aroma);
    lexiconRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [showToast]);

  const handleAromaViewed = useCallback(() => {
    setSelectedAroma(null);
  }, []);

  const reviewRecords: ReviewRecord[] = project.records.map((record) => ({
    name: record[0],
    grape: record[1],
    characteristic: record[2],
    aromas: record[3]?.split("、").map((a) => a.trim()).filter(Boolean) || [],
  }));

  const values = project.metrics.map((metric: string, index: number) => {
    if (metric === "易混淆酒款") {
      return String(wineComparisons.length);
    }
    const base = [84, 12, 31, 7][index % 4];
    return String(base + index * 3);
  });

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">{project.id} · port {project.port}</p>
          <h1>{project.title}</h1>
          <p className="subtitle">{project.subtitle}</p>
        </div>
        <div className="stack-card">
          <span>技术栈</span>
          <strong>{project.stack}</strong>
        </div>
      </section>

      <section className="metrics-grid">
        {project.metrics.map((metric: string, index: number) => (
          <MetricCard key={metric} label={metric} value={values[index]} index={index} />
        ))}
      </section>

      <section className="workspace">
        <aside className="panel narrow">
          <h2>角色</h2>
          <div className="chips">
            {project.users.map((user: string) => (
              <span key={user}>{user}</span>
            ))}
          </div>
          <h2>筛选</h2>
          <div className="chips muted">
            {project.filters.map((filter: string) => (
              <button key={filter}>{filter}</button>
            ))}
          </div>
        </aside>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p>{project.domain}</p>
              <h2>记录字段</h2>
            </div>
            <button className="primary-action">新增记录</button>
          </div>
          <div className="field-grid">
            {project.fields.map((field: string) => (
              <label key={field}>
                <span>{field}</span>
                <input placeholder={"填写" + field} />
              </label>
            ))}
          </div>
        </section>
      </section>

      <BlindTastingCard onAromaClick={handleAromaClick} />

      <BlindQuiz onAromaClick={handleAromaClick} />

      <AromaLexicon
        ref={lexiconRef}
        selectedAroma={selectedAroma}
        onAromaViewed={handleAromaViewed}
      />

      <section className="records panel">
        <div className="section-heading">
          <div>
            <p>示例数据</p>
            <h2>近期记录</h2>
          </div>
          <button>导出摘要</button>
        </div>
        <div className="record-list">
          {project.records.map((record: string[], index: number) => {
            const aromas = record[3]?.split("、") || [];
            return (
              <article key={record.join("-")} className="record-card">
                <div className="record-index">{String(index + 1).padStart(2, "0")}</div>
                <div>
                  <h3>{record[0]}</h3>
                  <p>
                    {record.slice(1, 3).join(" · ")}
                    {aromas.length > 0 && (
                      <span className="record-aromas">
                        {aromas.map((a) => (
                          <button
                            key={a}
                            className="record-aroma-link"
                            onClick={() => handleAromaClick(a.trim())}
                          >
                            {a.trim()}
                          </button>
                        ))}
                      </span>
                    )}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <ReviewPlan records={reviewRecords} onAromaClick={handleAromaClick} />

      <WineComparison onAromaClick={handleAromaClick} />

      {toast && (
        <div
          className={`aroma-toast aroma-toast-${toast.tone}`}
          role="status"
          aria-live="polite"
        >
          <span className="aroma-toast-icon">
            {toast.tone === "warn" ? "⚠️" : "ℹ️"}
          </span>
          <span className="aroma-toast-text">{toast.message}</span>
        </div>
      )}
    </main>
  );
}

export default App;
