import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { WineRecord } from "../data/wineRecordTypes";
import {
  saveQuizSession,
  QuizSession,
  QuizAttemptDetail,
  MistakeType,
  weightedSampleRecords,
} from "../data/adaptiveReview";

type ExamPhase = "setup" | "quiz" | "result";

interface ExamConfig {
  examName: string;
  questionCount: number;
  timeLimit: number;
  showHints: boolean;
  selectedRecordIds: string[];
}

interface UserAnswer {
  region: string;
  grape: string;
  reasoning: string;
}

interface ExamQuestion {
  record: WineRecord;
  answer: UserAnswer;
}

interface QuestionResult {
  question: ExamQuestion;
  regionCorrect: boolean;
  grapeCorrect: boolean;
  fullyCorrect: boolean;
}

function normalizeText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, "");
}

function checkAnswer(userAnswer: string, correctAnswer: string): boolean {
  const user = normalizeText(userAnswer);
  const correct = normalizeText(correctAnswer);
  if (!user) return false;
  if (user === correct) return true;
  if (correct.includes(user) || user.includes(correct)) return true;
  return false;
}

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

interface ExamPanelProps {
  records: WineRecord[];
  onAromaClick?: (aroma: string) => void;
}

export default function ExamPanel({ records, onAromaClick }: ExamPanelProps) {
  const [phase, setPhase] = useState<ExamPhase>("setup");
  const [examName, setExamName] = useState("");
  const [questionCount, setQuestionCount] = useState(5);
  const [timeLimit, setTimeLimit] = useState(0);
  const [showHints, setShowHints] = useState(true);
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());

  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [timeUp, setTimeUp] = useState(false);
  const [results, setResults] = useState<QuestionResult[]>([]);
  const [confirmingQuit, setConfirmingQuit] = useState(false);
  const [questionStartTimes, setQuestionStartTimes] = useState<number[]>([]);
  const [questionEndTimes, setQuestionEndTimes] = useState<number[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const availableCount = records.length;
  const effectiveCount = Math.min(questionCount, selectedRecordIds.size, availableCount);

  const toggleRecord = useCallback((id: string) => {
    setSelectedRecordIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedRecordIds(new Set(records.map((r) => r.id)));
  }, [records]);

  const clearSelection = useCallback(() => {
    setSelectedRecordIds(new Set());
  }, []);

  useEffect(() => {
    if (phase !== "quiz" || startTime === null) return;

    timerRef.current = setInterval(() => {
      const nowElapsed = Date.now() - startTime;
      setElapsed(nowElapsed);

      if (timeLimit > 0 && nowElapsed >= timeLimit * 60 * 1000) {
        setTimeUp(true);
        finishQuizInternal(nowElapsed);
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, startTime, timeLimit]);

  const finishQuizInternal = useCallback(
    (finalElapsed: number) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsed(finalElapsed);
      const endTime = Date.now();

      const computed: QuestionResult[] = questions.map((question) => {
        const regionCorrect = checkAnswer(
          question.answer.region,
          question.record.region
        );
        const grapeCorrect = checkAnswer(
          question.answer.grape,
          question.record.grape
        );
        return {
          question,
          regionCorrect,
          grapeCorrect,
          fullyCorrect: regionCorrect && grapeCorrect,
        };
      });

      const finalEndTimes = [...questionEndTimes];
      const finalStartTimes = [...questionStartTimes];
      if (finalEndTimes[currentIndex] === 0) {
        finalEndTimes[currentIndex] = endTime;
      }

      const attempts: QuizAttemptDetail[] = computed.map((result, i) => {
        const qStart = finalStartTimes[i] || startTime || endTime;
        const qEnd = finalEndTimes[i] || endTime;
        const timeSpent = Math.max(1000, qEnd - qStart);
        const userRegion = result.question.answer.region.trim();
        const userGrape = result.question.answer.grape.trim();
        let mistakeType: MistakeType = "none";
        if (!result.regionCorrect && !result.grapeCorrect) mistakeType = "both";
        else if (!result.regionCorrect) mistakeType = "region";
        else if (!result.grapeCorrect) mistakeType = "grape";

        return {
          questionId: result.question.record.id,
          source: "wineRecord",
          regionCorrect: result.regionCorrect,
          grapeCorrect: result.grapeCorrect,
          userRegionAnswer: userRegion,
          userGrapeAnswer: userGrape,
          correctRegion: result.question.record.region,
          correctGrape: result.question.record.grape,
          timeSpentMs: timeSpent,
          mistakeType,
          confusedWithRegion:
            mistakeType !== "none" && userRegion
              ? userRegion
              : undefined,
          confusedWithGrape:
            mistakeType !== "none" && userGrape
              ? userGrape
              : undefined,
        };
      });

      const correctCount = computed.filter((r) => r.fullyCorrect).length;
      const session: QuizSession = {
        id: `exam-${Date.now().toString(36)}`,
        sessionName: examName.trim() || "未命名测验",
        startTime: startTime || endTime,
        endTime,
        totalDurationMs: finalElapsed,
        attempts,
        overallAccuracy: computed.length > 0 ? correctCount / computed.length : 0,
      };
      saveQuizSession(session);

      setResults(computed);
      setPhase("result");
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [questions, questionEndTimes, questionStartTimes, currentIndex, startTime, examName]
  );

  const startQuiz = useCallback(() => {
    if (selectedRecordIds.size === 0) return;
    if (!examName.trim()) {
      setExamName("未命名测验");
    }

    const selectedRecords = records.filter((r) => selectedRecordIds.has(r.id));
    const picked = weightedSampleRecords(selectedRecords, effectiveCount, records);

    setQuestions(
      picked.map((record) => ({
        record,
        answer: { region: "", grape: "", reasoning: "" },
      }))
    );
    setCurrentIndex(0);
    const now = Date.now();
    setStartTime(now);
    setElapsed(0);
    setTimeUp(false);
    setResults([]);
    setConfirmingQuit(false);
    setQuestionStartTimes(picked.map(() => 0));
    setQuestionEndTimes(picked.map(() => 0));
    setTimeout(() => {
      setQuestionStartTimes((prev) => {
        const next = [...prev];
        next[0] = Date.now();
        return next;
      });
    }, 0);
    setPhase("quiz");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [records, selectedRecordIds, examName, effectiveCount]);

  const updateAnswer = useCallback(
    (field: keyof UserAnswer, value: string) => {
      setQuestions((prev) => {
        const next = [...prev];
        const current = next[currentIndex];
        next[currentIndex] = {
          ...current,
          answer: { ...current.answer, [field]: value },
        };
        return next;
      });
    },
    [currentIndex]
  );

  const goTo = useCallback(
    (index: number) => {
      setConfirmingQuit(false);
      if (index < 0 || index >= questions.length) return;
      const now = Date.now();
      setQuestionEndTimes((prev) => {
        const next = [...prev];
        if (next[currentIndex] === 0) {
          next[currentIndex] = now;
        }
        return next;
      });
      setQuestionStartTimes((prev) => {
        const next = [...prev];
        if (next[index] === 0) {
          next[index] = now;
        }
        return next;
      });
      setCurrentIndex(index);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [questions.length, currentIndex]
  );

  const finishQuiz = useCallback(() => {
    if (startTime !== null) {
      finishQuizInternal(Date.now() - startTime);
    }
  }, [startTime, finishQuizInternal]);

  const restart = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase("setup");
    setQuestions([]);
    setResults([]);
    setStartTime(null);
    setElapsed(0);
    setCurrentIndex(0);
    setConfirmingQuit(false);
    setTimeUp(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const resetAll = useCallback(() => {
    restart();
    setExamName("");
    setSelectedRecordIds(new Set());
    setQuestionCount(5);
    setTimeLimit(0);
    setShowHints(true);
  }, [restart]);

  if (phase === "setup") {
    return (
      <section className="exam-panel panel">
        <div className="section-heading">
          <div>
            <p>讲师出题</p>
            <h2>测验出题面板</h2>
          </div>
          {records.length > 0 && (
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={selectAll}>全选</button>
              <button onClick={clearSelection}>清空选择</button>
            </div>
          )}
        </div>

        <p className="exam-intro">
          从现有盲品记录中勾选题目，设置考试参数后生成一套本地可运行的测验。
        </p>

        <div className="exam-config">
          <div className="exam-config-row">
            <label>
              <span>考试名称 *</span>
              <input
                type="text"
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                placeholder="例如：期中考试 - 波尔多产区"
              />
            </label>
          </div>

          <div className="exam-config-grid">
            <label>
              <span>题量</span>
              <select
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
              >
                {[3, 5, 8, 10, 15, 20].map((n) => (
                  <option key={n} value={n} disabled={n > selectedRecordIds.size}>
                    {n} 题
                  </option>
                ))}
                {selectedRecordIds.size > 0 && (
                  <option value={selectedRecordIds.size}>
                    全部 {selectedRecordIds.size} 题
                  </option>
                )}
              </select>
            </label>

            <label>
              <span>限时（分钟，0=不限时）</span>
              <select
                value={timeLimit}
                onChange={(e) => setTimeLimit(Number(e.target.value))}
              >
                <option value={0}>不限时</option>
                {[5, 10, 15, 20, 30, 45, 60].map((n) => (
                  <option key={n} value={n}>
                    {n} 分钟
                  </option>
                ))}
              </select>
            </label>

            <label className="checkbox-label">
              <span>是否显示提示</span>
              <div className="checkbox-wrapper">
                <input
                  type="checkbox"
                  checked={showHints}
                  onChange={(e) => setShowHints(e.target.checked)}
                />
                <span className="checkbox-text">
                  显示香气、颜色、酸度等感官线索（关闭则完全盲答）
                </span>
              </div>
            </label>
          </div>

          <div className="exam-summary">
            <div className="exam-summary-item">
              <span>可用题库</span>
              <strong>{availableCount} 题</strong>
            </div>
            <div className="exam-summary-item">
              <span>已勾选</span>
              <strong>{selectedRecordIds.size} 题</strong>
            </div>
            <div className="exam-summary-item">
              <span>本次测验</span>
              <strong>{effectiveCount} 题</strong>
            </div>
          </div>
        </div>

        <div className="records-selector">
          <h3 className="records-selector-title">选择题目</h3>
          {records.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">🍷</span>
              <p>暂无盲品记录</p>
              <p className="empty-hint">请先在下方「近期记录」中添加品鉴记录</p>
            </div>
          ) : (
            <div className="record-select-list">
              {records.map((record, index) => {
                const checked = selectedRecordIds.has(record.id);
                return (
                  <label
                    key={record.id}
                    className={`record-select-item ${
                      checked ? "record-selected" : ""
                    }`}
                  >
                    <div className="record-select-check">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRecord(record.id)}
                      />
                    </div>
                    <div className="record-select-index">
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    <div className="record-select-body">
                      <div className="record-select-head">
                        <h4>{record.name}</h4>
                        <span className="record-select-meta">
                          {[record.grape, record.region, record.year]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </div>
                      <div className="record-select-aromas">
                        {record.aromas.map((a) => (
                          <span key={a} className="aroma-tag aroma-tag-small">
                            {a}
                          </span>
                        ))}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <button
          className="primary-action exam-generate-btn"
          onClick={startQuiz}
          disabled={selectedRecordIds.size === 0}
        >
          生成测验并开始
        </button>
      </section>
    );
  }

  if (phase === "quiz") {
    const current = questions[currentIndex];
    const total = questions.length;
    const record = current.record;
    const answer = current.answer;
    const isLast = currentIndex === total - 1;
    const answeredCount = questions.filter(
      (q) => q.answer.region.trim() || q.answer.grape.trim()
    ).length;

    const remaining =
      timeLimit > 0 ? Math.max(0, timeLimit * 60 * 1000 - elapsed) : null;

    return (
      <section className="exam-panel panel">
        <div className="section-heading">
          <div>
            <p>{examName || "未命名测验"}</p>
            <h2>
              答题中 · 第 {currentIndex + 1} / {total} 题
            </h2>
          </div>
          <div className="quiz-meta">
            {timeLimit > 0 ? (
              <span className={`quiz-timer ${remaining! < 60000 ? "timer-warning" : ""}`}>
                ⏱ 剩余 {formatDuration(remaining!)}
              </span>
            ) : (
              <span className="quiz-timer">⏱ 已用 {formatDuration(elapsed)}</span>
            )}
            {!confirmingQuit ? (
              <button
                className="quiz-quit-btn"
                onClick={() => setConfirmingQuit(true)}
              >
                提交并结束
              </button>
            ) : (
              <span className="quiz-quit-confirm">
                <span>确认提交？</span>
                <button onClick={finishQuiz}>提交</button>
                <button onClick={() => setConfirmingQuit(false)}>取消</button>
              </span>
            )}
          </div>
        </div>

        {timeUp && (
          <div className="time-up-notice">
            ⚠️ 时间已到，系统自动提交
          </div>
        )}

        <div className="quiz-progress-bar">
          <div
            className="quiz-progress-fill"
            style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
          />
        </div>

        <div className="tasting-card quiz-tasting-card">
          <div className="card-header">
            <span className="card-label">
              {showHints ? "感官描述" : "盲答模式"}
            </span>
            <span className="card-hint">
              仅凭线索判断产区与品种
            </span>
          </div>

          {showHints ? (
            <div className="sensory-grid">
              <div className="sensory-item">
                <span className="sensory-label">香气</span>
                <div className="aroma-tags">
                  {record.aromas.map((aroma) => (
                    <span key={aroma} className="aroma-tag">
                      {aroma}
                    </span>
                  ))}
                </div>
              </div>

              {record.color && (
                <div className="sensory-item">
                  <span className="sensory-label">颜色</span>
                  <span className="sensory-value">{record.color}</span>
                </div>
              )}

              <div className="sensory-item">
                <span className="sensory-label">酸度</span>
                <span className="sensory-value">{record.acidity}</span>
              </div>

              <div className="sensory-item">
                <span className="sensory-label">单宁</span>
                <span className="sensory-value">{record.tannin}</span>
              </div>

              <div className="sensory-item">
                <span className="sensory-label">酒体</span>
                <span className="sensory-value">{record.body}</span>
              </div>

              {record.alcohol && (
                <div className="sensory-item">
                  <span className="sensory-label">酒精度</span>
                  <span className="sensory-value">{record.alcohol}</span>
                </div>
              )}

              {record.characteristic && (
                <div className="sensory-item">
                  <span className="sensory-label">特征</span>
                  <span className="sensory-value">{record.characteristic}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="blind-mode-hint">
              <p>盲答模式：不提供任何感官线索</p>
              <p className="blind-mode-sub">请根据你的知识和经验作答</p>
            </div>
          )}

          <div className="answer-section">
            <div className="answer-inputs">
              <label>
                <span>产区</span>
                <input
                  type="text"
                  value={answer.region}
                  onChange={(e) => updateAnswer("region", e.target.value)}
                  placeholder="请输入产区名称"
                />
              </label>

              <label>
                <span>葡萄品种</span>
                <input
                  type="text"
                  value={answer.grape}
                  onChange={(e) => updateAnswer("grape", e.target.value)}
                  placeholder="请输入葡萄品种"
                />
              </label>
            </div>

            <label className="quiz-reasoning-label">
              <span>判断依据</span>
              <textarea
                className="quiz-reasoning"
                value={answer.reasoning}
                onChange={(e) => updateAnswer("reasoning", e.target.value)}
                placeholder="写出你判断产区与品种的关键线索……"
                rows={3}
              />
            </label>

            <div className="quiz-nav">
              <button
                className="quiz-nav-btn"
                onClick={() => goTo(currentIndex - 1)}
                disabled={currentIndex === 0}
              >
                上一题
              </button>
              {isLast ? (
                <button
                  className="primary-action quiz-nav-btn"
                  onClick={finishQuiz}
                >
                  提交测验
                </button>
              ) : (
                <button
                  className="primary-action quiz-nav-btn"
                  onClick={() => goTo(currentIndex + 1)}
                >
                  下一题
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="quiz-jump">
          <span className="quiz-jump-label">
            题目导航 · 已作答 {answeredCount}/{total}
          </span>
          <div className="quiz-jump-list">
            {questions.map((q, i) => {
              const done =
                q.answer.region.trim() !== "" || q.answer.grape.trim() !== "";
              return (
                <button
                  key={i}
                  className={`quiz-jump-dot ${
                    i === currentIndex ? "quiz-jump-current" : ""
                  } ${done ? "quiz-jump-done" : ""}`}
                  onClick={() => goTo(i)}
                  title={`第 ${i + 1} 题`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  const total = results.length;
  const correctCount = results.filter((r) => r.fullyCorrect).length;
  const partialCount = results.filter(
    (r) => (r.regionCorrect || r.grapeCorrect) && !r.fullyCorrect
  ).length;
  const wrongCount = total - correctCount - partialCount;
  const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  const wrongResults = results.filter((r) => !r.fullyCorrect);

  return (
    <section className="exam-panel panel">
      <div className="section-heading">
        <div>
          <p>{examName || "未命名测验"} · 测验报告</p>
          <h2>提交结果</h2>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={restart}>返回出题面板</button>
          <button className="primary-action" onClick={resetAll}>
            重置并重新出题
          </button>
        </div>
      </div>

      <div className="quiz-result-stats">
        <div className="quiz-stat quiz-stat-primary">
          <span>正确率</span>
          <strong>{accuracy}%</strong>
        </div>
        <div className="quiz-stat">
          <span>完全正确</span>
          <strong>
            {correctCount} / {total}
          </strong>
        </div>
        <div className="quiz-stat">
          <span>部分正确</span>
          <strong>{partialCount}</strong>
        </div>
        <div className="quiz-stat">
          <span>耗时</span>
          <strong>{formatDuration(elapsed)}</strong>
        </div>
      </div>

      <div className="quiz-progress-bar quiz-result-bar">
        <div
          className="quiz-progress-fill"
          style={{ width: `${accuracy}%` }}
        />
      </div>

      <div className="result-breakdown">
        <div
          className="result-breakdown-item"
          style={{ borderLeftColor: "var(--accent)" }}
        >
          <span className="breakdown-label">完全正确</span>
          <strong className="breakdown-value correct-value">
            {correctCount}
          </strong>
          <span className="breakdown-bar">
            <span
              className="breakdown-fill correct-fill"
              style={{ width: `${total > 0 ? (correctCount / total) * 100 : 0}%` }}
            />
          </span>
        </div>
        <div
          className="result-breakdown-item"
          style={{ borderLeftColor: "var(--warn)" }}
        >
          <span className="breakdown-label">部分正确</span>
          <strong className="breakdown-value partial-value">
            {partialCount}
          </strong>
          <span className="breakdown-bar">
            <span
              className="breakdown-fill partial-fill"
              style={{ width: `${total > 0 ? (partialCount / total) * 100 : 0}%` }}
            />
          </span>
        </div>
        <div
          className="result-breakdown-item"
          style={{ borderLeftColor: "#e11d48" }}
        >
          <span className="breakdown-label">错误</span>
          <strong className="breakdown-value wrong-value">
            {wrongCount}
          </strong>
          <span className="breakdown-bar">
            <span
              className="breakdown-fill wrong-fill"
              style={{ width: `${total > 0 ? (wrongCount / total) * 100 : 0}%` }}
            />
          </span>
        </div>
      </div>

      {wrongResults.length > 0 && (
        <div className="quiz-review-section">
          <h3 className="quiz-review-title">
            错题与部分正确 · {wrongResults.length} 题
          </h3>
          {wrongResults.map((r) => {
            const originalIndex = results.indexOf(r);
            return (
              <ReviewItem
                key={originalIndex}
                result={r}
                index={originalIndex}
                onAromaClick={onAromaClick}
              />
            );
          })}
        </div>
      )}

      <div className="quiz-review-section">
        <h3 className="quiz-review-title">全部题目解析</h3>
        {results.map((r, i) => (
          <ReviewItem
            key={i}
            result={r}
            index={i}
            onAromaClick={onAromaClick}
          />
        ))}
      </div>
    </section>
  );
}

interface ReviewItemProps {
  result: QuestionResult;
  index: number;
  onAromaClick?: (aroma: string) => void;
}

function ReviewItem({ result, index, onAromaClick }: ReviewItemProps) {
  const { question, regionCorrect, grapeCorrect, fullyCorrect } = result;
  const { record, answer } = question;
  const sensoryLine = [
    record.color,
    record.acidity,
    record.tannin,
    record.body,
    record.alcohol,
  ]
    .filter(Boolean)
    .join(" · ");

  const badgeLabel = fullyCorrect
    ? "完全正确"
    : regionCorrect || grapeCorrect
    ? "部分正确"
    : "回答有误";

  return (
    <article
      className={`quiz-review-card ${
        fullyCorrect
          ? "quiz-review-correct"
          : regionCorrect || grapeCorrect
          ? "quiz-review-partial"
          : "quiz-review-wrong"
      }`}
    >
      <div className="quiz-review-head">
        <span
          className="quiz-review-index"
          style={{
            background: fullyCorrect
              ? "var(--accent)"
              : regionCorrect || grapeCorrect
              ? "var(--warn)"
              : "#e11d48",
          }}
        >
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="quiz-review-id">
          <h4>
            {record.region} · {record.grape}
            {record.year && ` (${record.year})`}
          </h4>
          <span
            className={`quiz-review-badge ${
              fullyCorrect
                ? "badge-correct"
                : regionCorrect || grapeCorrect
                ? "badge-partial"
                : "badge-wrong"
            }`}
          >
            {badgeLabel}
          </span>
        </div>
      </div>

      <div className="quiz-review-sensory">
        <span className="quiz-review-label">感官线索</span>
        <div className="aroma-tags">
          {record.aromas.map((a) => (
            <button
              key={a}
              className="aroma-tag aroma-tag-clickable"
              onClick={() => onAromaClick?.(a)}
              title={`在词库中查看「${a}」`}
            >
              {a}
            </button>
          ))}
        </div>
        <span className="quiz-review-meta">{sensoryLine}</span>
      </div>

      <div className="quiz-review-compare">
        <div className="quiz-compare-row">
          <span className="quiz-compare-label">你的产区</span>
          <span
            className={`quiz-compare-value ${
              regionCorrect ? "is-correct" : "is-wrong"
            }`}
          >
            {answer.region.trim() || "（未作答）"}
          </span>
          <span className="quiz-compare-correct">正确：{record.region}</span>
        </div>
        <div className="quiz-compare-row">
          <span className="quiz-compare-label">你的品种</span>
          <span
            className={`quiz-compare-value ${
              grapeCorrect ? "is-correct" : "is-wrong"
            }`}
          >
            {answer.grape.trim() || "（未作答）"}
          </span>
          <span className="quiz-compare-correct">正确：{record.grape}</span>
        </div>
      </div>

      <div className="quiz-review-reasoning">
        <span className="quiz-review-label">你的判断依据</span>
        <p className="quiz-review-text">
          {answer.reasoning.trim() || "（未填写）"}
        </p>
      </div>

      {record.notes && (
        <div className="quiz-review-explanation">
          <span className="quiz-review-label">讲师备注 / 参考推理</span>
          <p className="quiz-review-text">{record.notes}</p>
        </div>
      )}

      {record.characteristic && (
        <div className="quiz-review-explanation">
          <span className="quiz-review-label">核心特征</span>
          <p className="quiz-review-text">{record.characteristic}</p>
        </div>
      )}
    </article>
  );
}
