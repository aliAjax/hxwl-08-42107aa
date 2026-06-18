import { useState, useEffect, useCallback, useRef } from "react";
import { ImportSummary, ImportMode, ImportPreview } from "../data/learningProfileTypes";
import {
  getAllBlindTastingRecords,
  getAllQuizResults,
  getAllReviewPlans,
  getAllConfusionItems,
  getAllRollbackSnapshots,
  executeRollback,
  deleteRollbackSnapshot,
} from "../data/learningProfileDB";
import { exportProfile, importProfile, formatImportSummary, parseImportPreview, applyImportPreview } from "../data/learningProfileIO";
import { BlindTastingRecord, QuizResultRecord, ReviewPlanRecord, ConfusionItem, RollbackSnapshot } from "../data/learningProfileTypes";
import {
  migrateExistingDataToStore,
  hasMigratedProfile,
  MigrationResult as UnifiedMigrationResult,
} from "../data/unifiedStore";
import { WineRecord } from "../data/wineRecordTypes";

interface LearningProfilePanelProps {
  records?: WineRecord[];
  refreshSignal?: number;
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

export default function LearningProfilePanel({ records = [], refreshSignal = 0 }: LearningProfilePanelProps) {
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
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [migrationResult, setMigrationResult] = useState<UnifiedMigrationResult | null>(null);
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
    hasMigratedProfile().then(setIsMigrated);
  }, [refreshData, refreshSignal]);

  useEffect(() => {
    hasMigratedProfile().then((migrated) => {
      if (!migrated && stats.totalRecords === 0 && records.length > 0) {
        handleMigrate(true);
      }
    });
  }, [records]);

  const handleMigrate = useCallback(
    async (silent: boolean = false) => {
      if (migrating) return;
      setMigrating(true);
      setMigrationResult(null);
      try {
        const result = await migrateExistingDataToStore(records, true);
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
      setImportPreview(null);

      try {
        const text = await file.text();
        const preview = await parseImportPreview(text, importMode);
        setImportPreview(preview);
      } catch (err) {
        setImportError(err instanceof Error ? err.message : "导入失败");
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [importMode]
  );

  const handleConfirmImport = useCallback(async () => {
    if (!importPreview) return;
    setImporting(true);
    try {
      const summary = await applyImportPreview(importPreview);
      setImportSummary(summary);
      setImportPreview(null);
      await refreshData();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "导入失败");
    } finally {
      setImporting(false);
    }
  }, [importPreview, refreshData]);

  const handleCancelPreview = useCallback(() => {
    setImportPreview(null);
    setImportError(null);
  }, []);

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
            {migrationResult.quizResultsMigrated > 0 && ` ${migrationResult.quizResultsMigrated} 场测验`}
            {migrationResult.blindTastingsMigrated > 0 && ` · ${migrationResult.blindTastingsMigrated} 条盲品记录`}
            {migrationResult.confusionItemsMigrated > 0 && ` · ${migrationResult.confusionItemsMigrated} 个混淆项`}
            {migrationResult.wineRecordsMigrated > 0 && ` · ${migrationResult.wineRecordsMigrated} 条酒款记录`}
            {migrationResult.quizResultsMigrated === 0 && migrationResult.blindTastingsMigrated === 0 && migrationResult.wineRecordsMigrated === 0 && " 暂无历史数据可同步"}
          </p>
        </div>
      )}

      {importPreview && (
        <div className="profile-import-preview">
          <div className="import-summary-header">
            <span className="import-summary-icon">📋</span>
            <h4>导入预览</h4>
          </div>
          <p className="preview-total">文件共包含 <strong>{importPreview.totalRecordsInFile}</strong> 条记录</p>

          <div className="preview-categories">
            {importPreview.blindTasting.totalInFile > 0 && (
              <div className="preview-category-card">
                <h5>盲品记录</h5>
                <ul>
                  <li><span className="label">文件中：</span><span>{importPreview.blindTasting.totalInFile} 条</span></li>
                  <li><span className="label success">将新增：</span><span className="success">{importPreview.blindTasting.toAdd.length} 条</span></li>
                  <li><span className="label warning">重复：</span><span className="warning">{importPreview.blindTasting.duplicateIds.length} 条</span></li>
                  <li><span className="label danger">无效：</span><span className="danger">{importPreview.blindTasting.invalidCount} 条</span></li>
                </ul>
                {importPreview.blindTasting.toAdd.length > 0 && (
                  <details className="preview-details">
                    <summary>查看将新增的 {importPreview.blindTasting.toAdd.length} 条记录</summary>
                    <div className="preview-records">
                      {importPreview.blindTasting.toAdd.slice(0, 10).map((r) => (
                        <div key={r.id} className="preview-record preview-record-success">
                          <strong>{r.wineName}</strong>
                          <span className="preview-record-meta">{r.region} · {r.grape}</span>
                        </div>
                      ))}
                      {importPreview.blindTasting.toAdd.length > 10 && (
                        <p className="preview-more">...还有 {importPreview.blindTasting.toAdd.length - 10} 条</p>
                      )}
                    </div>
                  </details>
                )}
                {importPreview.blindTasting.duplicateRecords.length > 0 && (
                  <details className="preview-details">
                    <summary>查看重复的 {importPreview.blindTasting.duplicateRecords.length} 条记录</summary>
                    <div className="preview-records">
                      {importPreview.blindTasting.duplicateRecords.slice(0, 10).map((r) => (
                        <div key={r.id} className="preview-record preview-record-warning">
                          <strong>{r.wineName}</strong>
                          <span className="preview-record-meta">{r.region} · {r.grape}</span>
                          <span className="preview-record-id">ID: {r.id.slice(0, 8)}...</span>
                        </div>
                      ))}
                      {importPreview.blindTasting.duplicateRecords.length > 10 && (
                        <p className="preview-more">...还有 {importPreview.blindTasting.duplicateRecords.length - 10} 条</p>
                      )}
                    </div>
                  </details>
                )}
                {importPreview.blindTasting.invalidRecords.length > 0 && (
                  <details className="preview-details">
                    <summary>查看无效的 {importPreview.blindTasting.invalidRecords.length} 条记录</summary>
                    <div className="preview-records">
                      {importPreview.blindTasting.invalidRecords.slice(0, 5).map((r, i) => (
                        <div key={i} className="preview-record preview-record-danger">
                          <strong>无效记录 #{i + 1}</strong>
                          <pre className="preview-record-json">{JSON.stringify(r, null, 2).slice(0, 300)}{JSON.stringify(r).length > 300 ? "..." : ""}</pre>
                        </div>
                      ))}
                      {importPreview.blindTasting.invalidRecords.length > 5 && (
                        <p className="preview-more">...还有 {importPreview.blindTasting.invalidRecords.length - 5} 条</p>
                      )}
                    </div>
                  </details>
                )}
              </div>
            )}

            {importPreview.quizResults.totalInFile > 0 && (
              <div className="preview-category-card">
                <h5>测验结果</h5>
                <ul>
                  <li><span className="label">文件中：</span><span>{importPreview.quizResults.totalInFile} 条</span></li>
                  <li><span className="label success">将新增：</span><span className="success">{importPreview.quizResults.toAdd.length} 条</span></li>
                  <li><span className="label warning">重复：</span><span className="warning">{importPreview.quizResults.duplicateIds.length} 条</span></li>
                  <li><span className="label danger">无效：</span><span className="danger">{importPreview.quizResults.invalidCount} 条</span></li>
                </ul>
                {importPreview.quizResults.toAdd.length > 0 && (
                  <details className="preview-details">
                    <summary>查看将新增的 {importPreview.quizResults.toAdd.length} 条记录</summary>
                    <div className="preview-records">
                      {importPreview.quizResults.toAdd.slice(0, 10).map((r) => (
                        <div key={r.id} className="preview-record preview-record-success">
                          <strong>场次 {r.sessionId.slice(0, 8)}</strong>
                          <span className="preview-record-meta">{r.correctCount}/{r.totalQuestions} 正确 · {Math.round(r.accuracy * 100)}%</span>
                        </div>
                      ))}
                      {importPreview.quizResults.toAdd.length > 10 && (
                        <p className="preview-more">...还有 {importPreview.quizResults.toAdd.length - 10} 条</p>
                      )}
                    </div>
                  </details>
                )}
                {importPreview.quizResults.duplicateRecords.length > 0 && (
                  <details className="preview-details">
                    <summary>查看重复的 {importPreview.quizResults.duplicateRecords.length} 条记录</summary>
                    <div className="preview-records">
                      {importPreview.quizResults.duplicateRecords.slice(0, 10).map((r) => (
                        <div key={r.id} className="preview-record preview-record-warning">
                          <strong>场次 {r.sessionId.slice(0, 8)}</strong>
                          <span className="preview-record-meta">{r.correctCount}/{r.totalQuestions} 正确 · {Math.round(r.accuracy * 100)}%</span>
                          <span className="preview-record-id">ID: {r.id.slice(0, 8)}...</span>
                        </div>
                      ))}
                      {importPreview.quizResults.duplicateRecords.length > 10 && (
                        <p className="preview-more">...还有 {importPreview.quizResults.duplicateRecords.length - 10} 条</p>
                      )}
                    </div>
                  </details>
                )}
                {importPreview.quizResults.invalidRecords.length > 0 && (
                  <details className="preview-details">
                    <summary>查看无效的 {importPreview.quizResults.invalidRecords.length} 条记录</summary>
                    <div className="preview-records">
                      {importPreview.quizResults.invalidRecords.slice(0, 5).map((r, i) => (
                        <div key={i} className="preview-record preview-record-danger">
                          <strong>无效记录 #{i + 1}</strong>
                          <pre className="preview-record-json">{JSON.stringify(r, null, 2).slice(0, 300)}{JSON.stringify(r).length > 300 ? "..." : ""}</pre>
                        </div>
                      ))}
                      {importPreview.quizResults.invalidRecords.length > 5 && (
                        <p className="preview-more">...还有 {importPreview.quizResults.invalidRecords.length - 5} 条</p>
                      )}
                    </div>
                  </details>
                )}
              </div>
            )}

            {importPreview.reviewPlans.totalInFile > 0 && (
              <div className="preview-category-card">
                <h5>复习计划</h5>
                <ul>
                  <li><span className="label">文件中：</span><span>{importPreview.reviewPlans.totalInFile} 条</span></li>
                  <li><span className="label success">将新增：</span><span className="success">{importPreview.reviewPlans.toAdd.length} 条</span></li>
                  <li><span className="label warning">重复：</span><span className="warning">{importPreview.reviewPlans.duplicateIds.length} 条</span></li>
                  <li><span className="label danger">无效：</span><span className="danger">{importPreview.reviewPlans.invalidCount} 条</span></li>
                </ul>
                {importPreview.reviewPlans.toAdd.length > 0 && (
                  <details className="preview-details">
                    <summary>查看将新增的 {importPreview.reviewPlans.toAdd.length} 条记录</summary>
                    <div className="preview-records">
                      {importPreview.reviewPlans.toAdd.slice(0, 10).map((r) => (
                        <div key={r.id} className="preview-record preview-record-success">
                          <strong>{r.wineName}</strong>
                          <span className="preview-record-meta">{r.grape} · {r.scheduledDate} · {r.completed ? "已完成" : "待复习"}</span>
                        </div>
                      ))}
                      {importPreview.reviewPlans.toAdd.length > 10 && (
                        <p className="preview-more">...还有 {importPreview.reviewPlans.toAdd.length - 10} 条</p>
                      )}
                    </div>
                  </details>
                )}
                {importPreview.reviewPlans.duplicateRecords.length > 0 && (
                  <details className="preview-details">
                    <summary>查看重复的 {importPreview.reviewPlans.duplicateRecords.length} 条记录</summary>
                    <div className="preview-records">
                      {importPreview.reviewPlans.duplicateRecords.slice(0, 10).map((r) => (
                        <div key={r.id} className="preview-record preview-record-warning">
                          <strong>{r.wineName}</strong>
                          <span className="preview-record-meta">{r.grape} · {r.scheduledDate} · {r.completed ? "已完成" : "待复习"}</span>
                          <span className="preview-record-id">ID: {r.id.slice(0, 8)}...</span>
                        </div>
                      ))}
                      {importPreview.reviewPlans.duplicateRecords.length > 10 && (
                        <p className="preview-more">...还有 {importPreview.reviewPlans.duplicateRecords.length - 10} 条</p>
                      )}
                    </div>
                  </details>
                )}
                {importPreview.reviewPlans.invalidRecords.length > 0 && (
                  <details className="preview-details">
                    <summary>查看无效的 {importPreview.reviewPlans.invalidRecords.length} 条记录</summary>
                    <div className="preview-records">
                      {importPreview.reviewPlans.invalidRecords.slice(0, 5).map((r, i) => (
                        <div key={i} className="preview-record preview-record-danger">
                          <strong>无效记录 #{i + 1}</strong>
                          <pre className="preview-record-json">{JSON.stringify(r, null, 2).slice(0, 300)}{JSON.stringify(r).length > 300 ? "..." : ""}</pre>
                        </div>
                      ))}
                      {importPreview.reviewPlans.invalidRecords.length > 5 && (
                        <p className="preview-more">...还有 {importPreview.reviewPlans.invalidRecords.length - 5} 条</p>
                      )}
                    </div>
                  </details>
                )}
              </div>
            )}

            {importPreview.confusionItems.totalInFile > 0 && (
              <div className="preview-category-card">
                <h5>混淆项</h5>
                <ul>
                  <li><span className="label">文件中：</span><span>{importPreview.confusionItems.totalInFile} 条</span></li>
                  <li><span className="label success">将新增：</span><span className="success">{importPreview.confusionItems.toAdd.length} 条</span></li>
                  <li><span className="label warning">重复：</span><span className="warning">{importPreview.confusionItems.duplicateIds.length} 条</span></li>
                  <li><span className="label danger">无效：</span><span className="danger">{importPreview.confusionItems.invalidCount} 条</span></li>
                </ul>
                {importPreview.confusionItems.toAdd.length > 0 && (
                  <details className="preview-details">
                    <summary>查看将新增的 {importPreview.confusionItems.toAdd.length} 条记录</summary>
                    <div className="preview-records">
                      {importPreview.confusionItems.toAdd.slice(0, 10).map((r) => (
                        <div key={r.id} className="preview-record preview-record-success">
                          <strong>{r.wineA.region} ⇄ {r.wineB.region}</strong>
                          <span className="preview-record-meta">{r.wineA.grape} / {r.wineB.grape} · {r.confusionCount}次互混</span>
                        </div>
                      ))}
                      {importPreview.confusionItems.toAdd.length > 10 && (
                        <p className="preview-more">...还有 {importPreview.confusionItems.toAdd.length - 10} 条</p>
                      )}
                    </div>
                  </details>
                )}
                {importPreview.confusionItems.duplicateRecords.length > 0 && (
                  <details className="preview-details">
                    <summary>查看重复的 {importPreview.confusionItems.duplicateRecords.length} 条记录</summary>
                    <div className="preview-records">
                      {importPreview.confusionItems.duplicateRecords.slice(0, 10).map((r) => (
                        <div key={r.id} className="preview-record preview-record-warning">
                          <strong>{r.wineA.region} ⇄ {r.wineB.region}</strong>
                          <span className="preview-record-meta">{r.wineA.grape} / {r.wineB.grape} · {r.confusionCount}次互混</span>
                          <span className="preview-record-id">ID: {r.id.slice(0, 8)}...</span>
                        </div>
                      ))}
                      {importPreview.confusionItems.duplicateRecords.length > 10 && (
                        <p className="preview-more">...还有 {importPreview.confusionItems.duplicateRecords.length - 10} 条</p>
                      )}
                    </div>
                  </details>
                )}
                {importPreview.confusionItems.invalidRecords.length > 0 && (
                  <details className="preview-details">
                    <summary>查看无效的 {importPreview.confusionItems.invalidRecords.length} 条记录</summary>
                    <div className="preview-records">
                      {importPreview.confusionItems.invalidRecords.slice(0, 5).map((r, i) => (
                        <div key={i} className="preview-record preview-record-danger">
                          <strong>无效记录 #{i + 1}</strong>
                          <pre className="preview-record-json">{JSON.stringify(r, null, 2).slice(0, 300)}{JSON.stringify(r).length > 300 ? "..." : ""}</pre>
                        </div>
                      ))}
                      {importPreview.confusionItems.invalidRecords.length > 5 && (
                        <p className="preview-more">...还有 {importPreview.confusionItems.invalidRecords.length - 5} 条</p>
                      )}
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>

          {importPreview.migratedFields.length > 0 && (
            <div className="preview-migrated">
              <span className="label">自动补全字段：</span>
              <span>{importPreview.migratedFields.join("、")}</span>
            </div>
          )}

          <div className="preview-actions">
            <button
              className="primary-action"
              onClick={handleConfirmImport}
              disabled={importing}
            >
              {importing ? "导入中..." : "确认导入"}
            </button>
            <button
              className="secondary-action"
              onClick={handleCancelPreview}
              disabled={importing}
            >
              取消
            </button>
          </div>
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
                    {snapshot.quizSessions && snapshot.quizSessions.length > 0 && ` · 会话 ${snapshot.quizSessions.length}`}
                    {snapshot.wineRecords && snapshot.wineRecords.length > 0 && ` · 酒款 ${snapshot.wineRecords.length}`}
                    {snapshot.adaptiveTasks && snapshot.adaptiveTasks.length > 0 && ` · 自适应 ${snapshot.adaptiveTasks.length}`}
                    {snapshot.reviewStatus && snapshot.reviewStatus.length > 0 && ` · 状态 ${snapshot.reviewStatus.length}`}
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
