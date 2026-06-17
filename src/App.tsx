import "./styles.css";
import { useState, useRef, useCallback, useEffect } from "react";
import BlindTastingCard from "./components/BlindTastingCard";
import BlindQuiz from "./components/BlindQuiz";
import AromaLexicon from "./components/AromaLexicon";
import ReviewPlan, { ReviewRecord } from "./components/ReviewPlan";
import WineComparison from "./components/WineComparison";
import WineRecordForm from "./components/WineRecordForm";
import RegionMapDashboard from "./components/RegionMapDashboard";
import RegionDetailView from "./components/RegionDetailView";
import ExamPanel from "./components/ExamPanel";
import AdaptiveDashboard from "./components/AdaptiveDashboard";
import LearningProfilePanel from "./components/LearningProfilePanel";
import { aromaKeywords } from "./data/aromaData";
import { wineComparisons } from "./data/wineData";
import { useWineRecords } from "./hooks/useWineRecords";
import { WineRecordInput, WineRecord } from "./data/wineRecordTypes";

const project = {
  id: "hxwl-08",
  port: 5108,
  title: "葡萄酒盲品训练",
  subtitle: "产区、品种与感官特征的盲品复习系统",
  stack: "React + Vite + TypeScript + CSS",
  domain: "葡萄酒学习",
  users: ["侍酒师学员", "讲师", "爱好者"],
  metrics: ["复习卡片", "易混淆酒款", "正确率", "产区覆盖"],
  filters: ["波尔多", "勃艮第", "纳帕", "里奥哈"],
  fields: ["产区", "葡萄品种", "年份", "酸度", "单宁", "酒体", "香气关键词"],
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
  const [dashboardRefreshSignal, setDashboardRefreshSignal] = useState(0);
  const lexiconRef = useRef<HTMLElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerDashboardRefresh = useCallback(() => {
    setDashboardRefreshSignal((s) => s + 1);
  }, []);

  const { records, loading, error, addRecord, updateRecord, deleteRecord } = useWineRecords();

  const [formState, setFormState] = useState<{
    open: boolean;
    mode: "add" | "edit";
    record?: WineRecord;
  }>({ open: false, mode: "add" });

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [selectedRegionKey, setSelectedRegionKey] = useState<string | null>(null);

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

  const handleOpenAddForm = useCallback(() => {
    setFormState({ open: true, mode: "add" });
  }, []);

  const handleOpenEditForm = useCallback((record: WineRecord) => {
    setFormState({ open: true, mode: "edit", record });
    setOpenMenuId(null);
  }, []);

  const handleFormCancel = useCallback(() => {
    setFormState({ open: false, mode: "add" });
  }, []);

  const handleFormSubmit = useCallback(
    async (data: WineRecordInput) => {
      try {
        if (formState.mode === "edit" && formState.record) {
          await updateRecord(formState.record.id, data);
          showToast("记录已更新", "info");
        } else {
          await addRecord(data);
          showToast("记录已添加", "info");
        }
        setFormState({ open: false, mode: "add" });
      } catch {
        showToast(formState.mode === "edit" ? "更新失败" : "添加失败", "warn");
      }
    },
    [formState.mode, formState.record, addRecord, updateRecord, showToast]
  );

  const handleDeleteClick = useCallback((id: string) => {
    setDeleteConfirm(id);
    setOpenMenuId(null);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteConfirm) return;
    try {
      await deleteRecord(deleteConfirm);
      showToast("记录已删除", "info");
    } catch {
      showToast("删除失败", "warn");
    }
    setDeleteConfirm(null);
  }, [deleteConfirm, deleteRecord, showToast]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteConfirm(null);
  }, []);

  const handleToggleMenu = useCallback((id: string) => {
    setOpenMenuId((prev: string | null) => (prev === id ? null : id));
  }, []);

  useEffect(() => {
    if (!openMenuId) return;
    const close = () => setOpenMenuId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [openMenuId]);

  const handleSelectRegion = useCallback((regionKey: string) => {
    setSelectedRegionKey(regionKey);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleBackToMap = useCallback(() => {
    setSelectedRegionKey(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const reviewRecords: ReviewRecord[] = records.map((record) => ({
    name: record.name,
    grape: record.grape,
    characteristic: record.characteristic,
    aromas: record.aromas,
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
            <button className="primary-action" onClick={handleOpenAddForm}>
              新增记录
            </button>
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

      <BlindQuiz onAromaClick={handleAromaClick} records={records} />

      <ExamPanel records={records} onAromaClick={handleAromaClick} />

      <AdaptiveDashboard
        records={records}
        onAromaClick={handleAromaClick}
        onRefreshSignal={dashboardRefreshSignal}
      />

      {selectedRegionKey ? (
        <RegionDetailView
          records={records}
          regionKey={selectedRegionKey}
          onBack={handleBackToMap}
          onAromaClick={handleAromaClick}
        />
      ) : (
        <RegionMapDashboard
          records={records}
          onSelectRegion={handleSelectRegion}
        />
      )}

      <AromaLexicon
        ref={lexiconRef}
        selectedAroma={selectedAroma}
        onAromaViewed={handleAromaViewed}
      />

      <section className="records panel">
        <div className="section-heading">
          <div>
            <p>本地数据</p>
            <h2>近期记录</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span className="records-count">共 {records.length} 条</span>
            <button className="primary-action" onClick={handleOpenAddForm}>
              新增记录
            </button>
          </div>
        </div>

        {loading && <div className="records-loading">加载中...</div>}
        {error && <div className="records-error">{error}</div>}

        {!loading && !error && records.length === 0 && (
          <div className="empty-state">
            <span className="empty-icon">🍷</span>
            <p>暂无盲品记录</p>
            <p className="empty-hint">点击「新增记录」开始记录你的品鉴体验</p>
          </div>
        )}

        <div className="record-list">
          {records.map((record: WineRecord, index: number) => (
            <article key={record.id} className="record-card">
              <div className="record-index">{String(index + 1).padStart(2, "0")}</div>
              <div className="record-card-header">
                <div className="record-card-main">
                  <h3>{record.name}</h3>
                  <p>
                    {[record.grape, record.region, record.year].filter(Boolean).join(" · ")}
                    {record.aromas.length > 0 && (
                      <span className="record-aromas">
                        {record.aromas.map((a: string) => (
                          <button
                            key={a}
                            className="record-aroma-link"
                            onClick={() => handleAromaClick(a)}
                          >
                            {a}
                          </button>
                        ))}
                      </span>
                    )}
                  </p>
                </div>
                <div className="record-card-menu" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                  <button className="menu-btn" onClick={() => handleToggleMenu(record.id)}>
                    ⋯
                  </button>
                  {openMenuId === record.id && (
                    <div className="record-card-dropdown">
                      <div className="dropdown-menu">
                        <button
                          className="dropdown-item"
                          onClick={() => handleOpenEditForm(record)}
                        >
                          编辑
                        </button>
                        <button
                          className="dropdown-item delete-item"
                          onClick={() => handleDeleteClick(record.id)}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <ReviewPlan records={reviewRecords} onAromaClick={handleAromaClick} />

      <WineComparison onAromaClick={handleAromaClick} />

      <LearningProfilePanel records={records} />

      {formState.open && (
        <WineRecordForm
          mode={formState.mode}
          initialData={formState.record}
          onSubmit={handleFormSubmit}
          onCancel={handleFormCancel}
        />
      )}

      {deleteConfirm && (
        <div className="confirm-delete-overlay" onClick={handleDeleteCancel}>
          <div className="confirm-delete-dialog" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <h3>确认删除</h3>
            <p>删除后无法恢复，确定要删除这条盲品记录吗？</p>
            <div className="confirm-delete-actions">
              <button onClick={handleDeleteCancel}>取消</button>
              <button className="confirm-delete-btn" onClick={handleDeleteConfirm}>
                删除
              </button>
            </div>
          </div>
        </div>
      )}

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
