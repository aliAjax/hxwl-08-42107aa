import { useState, useEffect, useCallback, useRef } from "react";
import { ImportSummary, ImportMode } from "../data/learningProfileTypes";
import {
  getAllBlindTastingRecords,
  getAllQuizResults,
  getAllReviewPlans,
  getAllConfusionItems,
  getAllRollbackSnapshots,
  executeRollback,
  deleteRollbackSnapshot,
} from "../data/learningProfileDB";
import { exportProfile, importProfile, formatImportSummary } from "../data/learningProfileIO";
import { BlindTastingRecord, QuizResultRecord, ReviewPlanRecord, ConfusionItem, RollbackSnapshot } from "../data/learningProfileTypes";
import {
  migrateExistingDataToProfile,
  hasMigratedProfile,
  MigrationResult,
} from "../data/learningProfileSync";
import { WineRecord } from "../data/wineRecordTypes";

interface LearningProfilePanelProps {
  records?: WineRecord[];
}

interface ProfileStats {
  blindCount: number;
  quizCount: number;
  reviewCount: number;
  confusionCount: number;
  totalRecords: number;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatTimeRelative(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}

export default function LearningProfilePanel({ records = [] }: LearningProfilePanelProps) {
  const [stats, setStats] = useState<ProfileStats>({
    blindCount: 0,
    quizCount: 0,
    reviewCount: 0,
    confusionCount: 0,
    totalRecords: 0,
  });
  const [rollbacks, setRollbacks] = useState<RollbackSnapshot[]>([]);
  const [importMode, setImportMode] = useState<ImportMode>("merge");
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [confirmRollbackId, setConfirmRollbackId] = useState<string | null>(null);
  const [showRollbackList, setShowRollbackList] = useState(false);
  const [isMigrated, setIsMigrated] = useState(false);
  const [recentBlind, setRecentBlind] = useState<BlindTastingRecord[]>([]);
  const [recentQuiz, setRecentQuiz] = useState<QuizResultRecord[]>([]);
  const [recentReview, setRecentReview] = useState<ReviewPlanRecord[]>([]);
  const [recentConfusion, setRecentConfusion] = useState<ConfusionItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshData = useCallback(async () => {
    const [blind, quiz, review, confusion, snapshots] = await Promise.all([
      getAllBlindTastingRecords(),
      getAllQuizResults(),
      getAllReviewPlans(),
      getAllConfusionItems(),
      getAllRollbackSnapshots(),
    ]);

    setStats({
      blindCount: blind.length,
      quizCount: quiz.length,
      reviewCount: review.length,
      confusionCount: confusion.length,
      totalRecords: blind.length + quiz.length + review.length + confusion.length,
    });

    setRollbacks(snapshots.sort((a, b) => b.createdAt - a.createdAt));

    setRecentBlind(blind.sort((a, b) => b.createdAt - a.createdAt).slice(0, 5));
    setRecentQuiz(quiz.sort((a, b) => b.createdAt - a.createdAt).slice(0, 5));
    setRecentReview(review.sort((a, b) => b.createdAt - a.createdAt).slice(0, 5));
    setRecentConfusion(confusion.sort((a, b) => b.createdAt - a.createdAt).slice(0, 5));
  }, []);

  useEffect(() => {
    refreshData();
    setIsMigrated(hasMigratedProfile());
  }, [refreshData]);

  useEffect(() => {
    const shouldAutoMigrate = !hasMigratedProfile() && stats.totalRecords === 0;
    if (shouldAutoMigrate && records.length > 0) {
      handleMigrate(true);
    }
  }, [records]);

  const handleMigrate = useCallback(
    async (silent: boolean = false) => {
      if (migrating) return;
      setMigrating(true);
      setMigrationResult(null);
      try {
        const result = await migrateExistingDataToProfile(records, true);
        if (!silent) {
          setMigrationResult(result);
        }
        setIsMigrated(true);
        await refreshData();
      } catch (err) {
        console.error("Migration failed:", err);
      } finally {
        setMigrating(false);
      }
    },
    [records, migrating, refreshData]
  );

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const json = await exportProfile();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wine-learning-profile-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  }, []);

  const handleImport = useCallback(async () => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setImporting(true);
      setImportError(null);
      setImportSummary(null);

      try {
        const text = await file.text();
        const summary = await importProfile(text, importMode);
        setImportSummary(summary);
        await refreshData();
      } catch (err) {
        setImportError(err instanceof Error ? err.message : "导入失败");
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [importMode, refreshData]
  );

  const handleRollback = useCallback(
    async (snapshotId: string) => {
      try {
        await executeRollback(snapshotId);
        await refreshData();
        setImportSummary(null);
        setConfirmRollbackId(null);
      } catch (err) {
        console.error("Rollback failed:", err);
      }
    },
    [refreshData]
  );

  const handleDeleteSnapshot = useCallback(
    async (snapshotId: string) => {
      try {
        await deleteRollbackSnapshot(snapshotId);
        await refreshData();
      } catch (err) {
        console.error("Delete snapshot failed:", err);
      }
    },
    [refreshData]
  );

  const mistakeTypeLabel: Record<string, string> = {
    region: "产区错",
    grape: "品种错",
    both: "双错",
    none: "全对",
  };

  return (
    <section className="learning-profile panel">
      <div className="section-heading">
        <div>
          <p>离线优先</p>
          <h2>学习档案</h2>
        </div>
        <div className="profile-actions">
          <button
            className="secondary-action"
            onClick={() => handleMigrate(false)}
            disabled={migrating}
            title="从本地历史数据同步到学习档案"
          >
            {migrating ? "同步中..." : "同步数据"}
          </button>
          <button
            className="secondary-action"
            onClick={handleExport}
            disabled={exporting || stats.totalRecords === 0}
          >
            {exporting ? "导出中..." : "导出 JSON"}
          </button>
          <button className="primary-action" onClick={handleImport} disabled={importing}>
            {importing ? "导入中..." : "导入 JSON"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
        </div>
      </div>

      <div className="profile-stats-grid">
        <article className="profile-stat-card">
          <span>盲品记录</span>
          <strong>{stats.blindCount}</strong>
          <i className="status-ok" />
        </article>
        <article className="profile-stat-card">
          <span>测验结果</span>
          <strong>{stats.quizCount}</strong>
          <i className="status-ok" />
        </article>
        <article className="profile-stat-card">
          <span>复习计划</span>
          <strong>{stats.reviewCount}</strong>
          <i className="status-watch" />
        </article>
        <article className="profile-stat-card">
          <span>混淆项</span>
          <strong>{stats.confusionCount}</strong>
          <i className="status-danger" />
        </article>
      </div>

      <div className="profile-import-config">
        <span className="profile-config-label">重复记录处理：</span>
        <div className="profile-mode-chips">
          {(
            [
              { k: "merge" as ImportMode, label: "合并（新ID）" },
              { k: "skip" as ImportMode, label: "跳过" },
              { k: "overwrite" as ImportMode, label: "覆盖" },
            ] as { k: ImportMode; label: string }[]
          ).map((opt) => (
            <button
              key={opt.k}
              className={`filter-chip ${importMode === opt.k ? "active" : ""}`}
              onClick={() => setImportMode(opt.k)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {importError && (
        <div className="profile-import-error">
          <span className="profile-import-error-icon">❌</span>
          <span>{importError}</span>
        </div>
      )}

      {migrationResult && !migrationResult.fromExisting && (
        <div className="profile-migration-summary">
          <div className="import-summary-header">
            <span className="import-summary-icon">🔄</span>
            <h4>数据同步完成</h4>
          </div>
          <p className="migration-text">
            已从本地历史同步：
            {migrationResult.quizResults > 0 && ` ${migrationResult.quizResults} 场测验`}
            {migrationResult.blindTastingRecords > 0 && ` · ${migrationResult.blindTastingRecords} 条盲品记录`}
            {migrationResult.confusionItems > 0 && ` · ${migrationResult.confusionItems} 个混淆项`}
            {migrationResult.quizResults === 0 && migrationResult.blindTastingRecords === 0 && " 暂无历史数据可同步"}
          </p>
        </div>
      )}

      {importSummary && (
        <div className="profile-import-summary">
          <div className="import-summary-header">
            <span className="import-summary-icon">✅</span>
            <h4>导入摘要</h4>
          </div>
          <pre className="import-summary-text">{formatImportSummary(importSummary)}</pre>
          {importSummary.rollbackAvailable && rollbacks.length > 0 && (
            <div className="import-summary-actions">
              <button
                className="secondary-action"
                onClick={() => setShowRollbackList(!showRollbackList)}
              >
                {showRollbackList ? "隐藏回滚入口" : "回滚本次导入"}
              </button>
            </div>
          )}
        </div>
      )}

      {showRollbackList && rollbacks.length > 0 && (
        <div className="profile-rollback-section">
          <h4>回滚快照</h4>
          <div className="rollback-list">
            {rollbacks.map((snapshot) => (
              <article key={snapshot.id} className="rollback-card">
                <div className="rollback-info">
                  <span className="rollback-time">{formatTime(snapshot.createdAt)}</span>
                  <span className="rollback-meta">
                    {formatTimeRelative(snapshot.createdAt)} ·
                    盲品 {snapshot.blindTastingRecords.length} ·
                    测验 {snapshot.quizResults.length} ·
                    复习 {snapshot.reviewPlans.length} ·
                    混淆 {snapshot.confusionItems.length}
                  </span>
                </div>
                <div className="rollback-actions">
                  {confirmRollbackId === snapshot.id ? (
                    <>
                      <span className="rollback-confirm-text">确定回滚？</span>
                      <button
                        className="confirm-delete-btn"
                        onClick={() => handleRollback(snapshot.id)}
                      >
                        确认
                      </button>
                      <button onClick={() => setConfirmRollbackId(null)}>取消</button>
                    </>
                  ) : (
                    <>
                      <button
                        className="secondary-action"
                        onClick={() => setConfirmRollbackId(snapshot.id)}
                      >
                        回滚到此版本
                      </button>
                      <button onClick={() => handleDeleteSnapshot(snapshot.id)}>
                        删除快照
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      <div className="profile-data-preview">
        {recentBlind.length > 0 && (
          <div className="profile-preview-section">
            <h4>近期盲品记录</h4>
            <div className="profile-preview-list">
              {recentBlind.map((r) => (
                <div key={r.id} className="profile-preview-item">
                  <div className="preview-item-main">
                    <strong>{r.wineName}</strong>
                    <span className="preview-item-meta">
                      {r.region} · {r.grape}
                    </span>
                  </div>
                  <span className={`preview-item-badge badge-${r.mistakeType}`}>
                    {mistakeTypeLabel[r.mistakeType] || r.mistakeType}
                  </span>
                  <span className="preview-item-time">{formatTimeRelative(r.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {recentQuiz.length > 0 && (
          <div className="profile-preview-section">
            <h4>近期测验结果</h4>
            <div className="profile-preview-list">
              {recentQuiz.map((r) => (
                <div key={r.id} className="profile-preview-item">
                  <div className="preview-item-main">
                    <strong>场次 {r.sessionId.slice(0, 8)}</strong>
                    <span className="preview-item-meta">
                      {r.correctCount}/{r.totalQuestions} 正确
                    </span>
                  </div>
                  <span className="preview-item-badge badge-accuracy">
                    {Math.round(r.accuracy * 100)}%
                  </span>
                  <span className="preview-item-time">{formatTimeRelative(r.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {recentReview.length > 0 && (
          <div className="profile-preview-section">
            <h4>近期复习计划</h4>
            <div className="profile-preview-list">
              {recentReview.map((r) => (
                <div key={r.id} className="profile-preview-item">
                  <div className="preview-item-main">
                    <strong>{r.wineName}</strong>
                    <span className="preview-item-meta">
                      {r.grape} · {r.scheduledDate}
                    </span>
                  </div>
                  <span className={`preview-item-badge ${r.completed ? "badge-done" : "badge-pending"}`}>
                    {r.completed ? "已完成" : "待复习"}
                  </span>
                  <span className="preview-item-time">{formatTimeRelative(r.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {recentConfusion.length > 0 && (
          <div className="profile-preview-section">
            <h4>近期混淆项</h4>
            <div className="profile-preview-list">
              {recentConfusion.map((r) => (
                <div key={r.id} className="profile-preview-item">
                  <div className="preview-item-main">
                    <strong>{r.wineA.region} ⇄ {r.wineB.region}</strong>
                    <span className="preview-item-meta">
                      {r.wineA.grape} / {r.wineB.grape}
                    </span>
                  </div>
                  <span className="preview-item-badge badge-confusion">
                    {r.confusionCount}次互混
                  </span>
                  <span className="preview-item-time">{formatTimeRelative(r.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {stats.totalRecords === 0 && (
          <div className="empty-state">
            <span className="empty-icon">📂</span>
            <p>学习档案为空</p>
            <p className="empty-hint">点击「同步数据」导入历史记录，或进行盲品练习来建立你的学习档案</p>
          </div>
        )}
      </div>
    </section>
  );
}
