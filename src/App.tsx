import "./styles.css";
import { useState, useRef, useCallback } from "react";
import BlindTastingCard from "./components/BlindTastingCard";
import BlindQuiz from "./components/BlindQuiz";
import AromaLexicon from "./components/AromaLexicon";
import AromaInference from "./components/AromaInference";
import ReviewPlan, { ReviewRecord } from "./components/ReviewPlan";
import WineComparison from "./components/WineComparison";
import WineRecordForm from "./components/WineRecordForm";
import RegionMapDashboard from "./components/RegionMapDashboard";
import RegionDetailView from "./components/RegionDetailView";
import ExamPanel from "./components/ExamPanel";
import AdaptiveDashboard from "./components/AdaptiveDashboard";
import LearningProfilePanel from "./components/LearningProfilePanel";
import LearningPathPanel from "./components/LearningPathPanel";
import { aromaKeywords } from "./data/aromaData";
import { wineComparisons } from "./data/wineData";
import { useWineRecords } from "./hooks/useWineRecords";
import { WineRecord } from "./data/wineRecordTypes";
import { triggerPathRefreshAfterQuiz, triggerPathRefreshAfterImport } from "./data/learningPathStore";
import { useToast } from "./hooks/useToast";
import { useRecordFilter } from "./hooks/useRecordFilter";
import { useRecordForm } from "./hooks/useRecordForm";
import { useRegionExam } from "./hooks/useRegionExam";

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
  const [dashboardRefreshSignal, setDashboardRefreshSignal] = useState(0);
  const [profileRefreshSignal, setProfileRefreshSignal] = useState(0);
  const [reviewPlanRefreshSignal, setReviewPlanRefreshSignal] = useState(0);
  const [learningPathRefreshSignal, setLearningPathRefreshSignal] = useState(0);
  const lexiconRef = useRef<HTMLElement>(null);
  const inferenceRef = useRef<HTMLElement>(null);
  const recordsRef = useRef<HTMLElement>(null);
  const learningPathRef = useRef<HTMLElement>(null);
  const [highlightedRecordId, setHighlightedRecordId] = useState<string | null>(null);

  const { toast, showToast } = useToast();

  const triggerDashboardRefresh = useCallback(() => {
    setDashboardRefreshSignal((s) => s + 1);
  }, []);

  const triggerProfileRefresh = useCallback(() => {
    setProfileRefreshSignal((s) => s + 1);
  }, []);

  const triggerReviewPlanRefresh = useCallback(() => {
    setReviewPlanRefreshSignal((s) => s + 1);
  }, []);

  const triggerLearningPathRefresh = useCallback(() => {
    setLearningPathRefreshSignal((s) => s + 1);
  }, []);

  const handleReviewPlanGenerated = useCallback(() => {
    setReviewPlanRefreshSignal((s) => s + 1);
    setProfileRefreshSignal((s) => s + 1);
  }, []);

  const handleQuizCompletedForPath = useCallback(async () => {
    try {
      await triggerPathRefreshAfterQuiz();
      setLearningPathRefreshSignal((s) => s + 1);
      showToast("学习路径已根据测验结果更新", "info");
    } catch {
      showToast("学习路径更新失败", "warn");
    }
  }, [showToast]);

  const handleImportCompletedForPath = useCallback(async () => {
    try {
      await triggerPathRefreshAfterImport();
      setLearningPathRefreshSignal((s) => s + 1);
      showToast("学习路径已根据导入档案更新", "info");
    } catch {
      showToast("学习路径更新失败", "warn");
    }
  }, [showToast]);

  const handleReviewTaskStatusChanged = useCallback(() => {
    setProfileRefreshSignal((s) => s + 1);
  }, []);

  const { records, loading, error, addRecord, updateRecord, deleteRecord } = useWineRecords();

  const {
    searchQuery,
    filterCountry,
    filterRegion,
    filterGrape,
    filterAroma,
    setSearchQuery,
    setFilterCountry,
    setFilterRegion,
    setFilterGrape,
    setFilterAroma,
    filterOptions,
    hasActiveFilters,
    filteredRecords,
    clearAllFilters,
  } = useRecordFilter(records);

  const {
    formState,
    deleteConfirm,
    openMenuId,
    handleOpenAddForm,
    handleOpenEditForm,
    handleFormCancel,
    handleFormSubmit,
    handleDeleteClick,
    handleDeleteConfirm,
    handleDeleteCancel,
    handleToggleMenu,
  } = useRecordForm({
    addRecord,
    updateRecord,
    deleteRecord,
    showToast,
    triggerLearningPathRefresh,
  });

  const [selectedRegionKey, setSelectedRegionKey] = useState<string | null>(null);

  const {
    examPreset,
    examPanelRef,
    handleStartExamForRegion,
    handleClearExamPreset,
  } = useRegionExam({ records, showToast });

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

  const handleViewRecord = useCallback((recordId: string, recordName: string) => {
    setHighlightedRecordId(recordId);
    clearAllFilters();
    recordsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => {
      const el = document.getElementById(`record-${recordId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 300);
    showToast(`已定位到记录「${recordName}」`, "info");
    setTimeout(() => {
      setHighlightedRecordId(null);
    }, 4000);
  }, [showToast, clearAllFilters]);

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

      <BlindQuiz
        onAromaClick={handleAromaClick}
        records={records}
        onProfileSynced={triggerProfileRefresh}
        onQuizCompleted={handleQuizCompletedForPath}
      />

      <section ref={examPanelRef}>
        <ExamPanel
          records={records}
          onAromaClick={handleAromaClick}
          onProfileSynced={triggerProfileRefresh}
          onQuizCompleted={handleQuizCompletedForPath}
          presetRecordIds={examPreset?.recordIds}
          presetExamName={examPreset?.examName}
          onPresetCleared={handleClearExamPreset}
        />
      </section>

      <AdaptiveDashboard
        records={records}
        onAromaClick={handleAromaClick}
        onRefreshSignal={dashboardRefreshSignal}
        onReviewPlanGenerated={handleReviewPlanGenerated}
      />

      {selectedRegionKey ? (
        <RegionDetailView
          records={records}
          regionKey={selectedRegionKey}
          onBack={handleBackToMap}
          onAromaClick={handleAromaClick}
          onStartExamForRegion={handleStartExamForRegion}
        />
      ) : (
        <RegionMapDashboard
          records={records}
          onSelectRegion={handleSelectRegion}
          onStartExamForRegion={handleStartExamForRegion}
        />
      )}

      <AromaInference
        ref={inferenceRef}
        wineRecords={records}
        onAromaClick={handleAromaClick}
        onViewRecord={handleViewRecord}
      />

      <AromaLexicon
        ref={lexiconRef}
        selectedAroma={selectedAroma}
        onAromaViewed={handleAromaViewed}
      />

      <section className="records panel" ref={recordsRef}>
        <div className="section-heading">
          <div>
            <p>本地数据</p>
            <h2>近期记录</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span className="records-count">
              {hasActiveFilters
                ? `筛选结果 ${filteredRecords.length} / 共 ${records.length} 条`
                : `共 ${records.length} 条`}
            </span>
            <button className="primary-action" onClick={handleOpenAddForm}>
              新增记录
            </button>
          </div>
        </div>

        <div className="records-filter-bar">
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder="搜索酒名、产区、品种、香气关键词..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="search-clear-btn"
                onClick={() => setSearchQuery("")}
                aria-label="清除搜索"
              >
                ✕
              </button>
            )}
          </div>
          <div className="filter-selects">
            <label className="filter-select-label">
              <span>国家</span>
              <select
                className="filter-select"
                value={filterCountry}
                onChange={(e) => setFilterCountry(e.target.value)}
              >
                <option value="">全部</option>
                {filterOptions.countries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-select-label">
              <span>产区</span>
              <select
                className="filter-select"
                value={filterRegion}
                onChange={(e) => setFilterRegion(e.target.value)}
              >
                <option value="">全部</option>
                {filterOptions.regions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-select-label">
              <span>葡萄品种</span>
              <select
                className="filter-select"
                value={filterGrape}
                onChange={(e) => setFilterGrape(e.target.value)}
              >
                <option value="">全部</option>
                {filterOptions.grapes.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-select-label">
              <span>香气</span>
              <select
                className="filter-select"
                value={filterAroma}
                onChange={(e) => setFilterAroma(e.target.value)}
              >
                <option value="">全部</option>
                {filterOptions.aromas.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {hasActiveFilters && (
            <button className="clear-filters-btn" onClick={clearAllFilters}>
              清除所有筛选
            </button>
          )}
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

        {!loading && !error && records.length > 0 && filteredRecords.length === 0 && (
          <div className="empty-state">
            <span className="empty-icon">🔍</span>
            <p>没有匹配的记录</p>
            <p className="empty-hint">试试调整搜索关键词或筛选条件</p>
            <button className="clear-filters-btn" style={{ marginTop: "12px" }} onClick={clearAllFilters}>
              清除所有筛选
            </button>
          </div>
        )}

        <div className="record-list">
          {filteredRecords.map((record: WineRecord, index: number) => {
            const isHighlighted = highlightedRecordId === record.id;
            return (
              <article
                key={record.id}
                className={`record-card ${isHighlighted ? "record-card-highlighted" : ""}`}
                id={`record-${record.id}`}
              >
              <div className="record-index">{String(index + 1).padStart(2, "0")}</div>
              <div className="record-card-header">
                <div className="record-card-main">
                  <h3>{record.name}</h3>
                  <p>
                    {[record.grape, record.region, record.country, record.year]
                      .filter(Boolean)
                      .join(" · ")}
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
            );
          })}
        </div>
      </section>

      <ReviewPlan records={reviewRecords} onAromaClick={handleAromaClick} refreshSignal={reviewPlanRefreshSignal} onTaskStatusChanged={handleReviewTaskStatusChanged} />

      <WineComparison onAromaClick={handleAromaClick} />

      <LearningProfilePanel
        records={records}
        refreshSignal={profileRefreshSignal}
        onImportCompleted={handleImportCompletedForPath}
      />

      <section ref={learningPathRef}>
        <LearningPathPanel
          records={records}
          refreshSignal={learningPathRefreshSignal}
          onAromaClick={handleAromaClick}
        />
      </section>

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
