import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  WineCard,
  wineCards,
  regionScopes,
  RegionScopeOption,
} from "../data/wineData";
import {
  saveQuizSession,
  QuizSession,
  QuizAttemptDetail,
  MistakeType,
  weightedSampleCards,
} from "../data/adaptiveReview";
import { WineRecord } from "../data/wineRecordTypes";
import { syncQuizSessionToProfile } from "../data/learningProfileSync";
import { checkRegionAnswer, checkGrapeAnswer, MatchResult } from "../data/answerChecker";
import { initUnifiedStore } from "../data/unifiedStore";

type QuizPhase = "setup" | "quiz" | "result";

interface UserAnswer {
  region: string;
  grape: string;
  reasoning: string;
}

interface QuizQuestion {
  card: WineCard;
  answer: UserAnswer;
}

interface QuestionResult {
  question: QuizQuestion;
  regionCorrect: boolean;
  grapeCorrect: boolean;
  fullyCorrect: boolean;
  regionMatch: MatchResult;
  grapeMatch: MatchResult;
}

const QUESTION_PRESETS = [5, 8, 10];

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

function getPool(scope: RegionScopeOption): WineCard[] {
  if (scope.value === "all") return wineCards;
  return wineCards.filter((c) => scope.countries.includes(c.country));
}

interface BlindQuizProps {
  onAromaClick?: (aroma: string) => void;
  records: WineRecord[];
  onProfileSynced?: () => void;
  onQuizCompleted?: (session: QuizSession, records: WineRecord[]) => void;
}

export default function BlindQuiz({ onAromaClick, records, onProfileSynced, onQuizCompleted }: BlindQuizProps) {
  const [phase, setPhase] = useState<QuizPhase>("setup");
  const [scopeValue, setScopeValue] = useState("all");
  const [desiredCount, setDesiredCount] = useState(5);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [results, setResults] = useState<QuestionResult[]>([]);
  const [confirmingQuit, setConfirmingQuit] = useState(false);
  const [questionStartTimes, setQuestionStartTimes] = useState<number[]>([]);
  const [questionEndTimes, setQuestionEndTimes] = useState<number[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectedScope = useMemo(
    () => regionScopes.find((s) => s.value === scopeValue) ?? regionScopes[0],
    [scopeValue]
  );

  const pool = useMemo(() => getPool(selectedScope), [selectedScope]);
  const availableCount = pool.length;
  const effectiveCount = Math.min(desiredCount, availableCount);

  useEffect(() => {
    if (desiredCount > availableCount) {
      setDesiredCount(availableCount);
    }
  }, [availableCount, desiredCount]);

  useEffect(() => {
    if (phase !== "quiz" || startTime === null) return;
    timerRef.current = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, startTime]);

  const startQuiz = useCallback(async () => {
    const picked = await weightedSampleCards(pool, effectiveCount, records);
    const now = Date.now();
    setQuestions(
      picked.map((card) => ({
        card,
        answer: { region: "", grape: "", reasoning: "" },
      }))
    );
    setCurrentIndex(0);
    setStartTime(now);
    setElapsed(0);
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
  }, [pool, effectiveCount, records]);

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

  const finishQuiz = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const endTime = Date.now();
    if (startTime !== null) {
      setElapsed(endTime - startTime);
    }
    const computed: QuestionResult[] = questions.map((question) => {
      const regionMatch = checkRegionAnswer(
        question.answer.region,
        question.card.region
      );
      const grapeMatch = checkGrapeAnswer(
        question.answer.grape,
        question.card.grape
      );
      return {
        question,
        regionCorrect: regionMatch.correct,
        grapeCorrect: grapeMatch.correct,
        fullyCorrect: regionMatch.correct && grapeMatch.correct,
        regionMatch,
        grapeMatch,
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
        questionId: result.question.card.id,
        source: "wineCard",
        regionCorrect: result.regionCorrect,
        grapeCorrect: result.grapeCorrect,
        userRegionAnswer: userRegion,
        userGrapeAnswer: userGrape,
        correctRegion: result.question.card.region,
        correctGrape: result.question.card.grape,
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
      id: `quiz-${Date.now().toString(36)}`,
      sessionName: `盲品测验 - ${selectedScope.label}`,
      startTime: startTime || endTime,
      endTime,
      totalDurationMs: endTime - (startTime || endTime),
      attempts,
      overallAccuracy: computed.length > 0 ? correctCount / computed.length : 0,
    };
    await saveQuizSession(session);
    await syncQuizSessionToProfile(session, records);
    onProfileSynced?.();
    onQuizCompleted?.(session, records);

    setResults(computed);
    setPhase("result");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [questions, startTime, questionEndTimes, questionStartTimes, currentIndex, selectedScope, records, onProfileSynced, onQuizCompleted]);

  const restart = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase("setup");
    setQuestions([]);
    setResults([]);
    setStartTime(null);
    setElapsed(0);
    setCurrentIndex(0);
    setConfirmingQuit(false);
  }, []);

  if (phase === "setup") {
    return (
      <section className="blind-quiz panel">
        <div className="section-heading">
          <div>
            <p>计时挑战</p>
            <h2>盲品测验模式</h2>
          </div>
        </div>

        <p className="quiz-intro">
          选择产区范围与题目数量后开始计时答题。每题仅展示感官描述（香气、颜色、酸度、单宁、酒体、酒精度），你需要判断产区、品种并写出关键推理依据。测验结束后将生成成绩、错题列表与每题参考推理。
        </p>

        <div className="quiz-setup">
          <div className="quiz-setup-block">
            <span className="quiz-setup-label">产区范围</span>
            <div className="chips muted quiz-chips">
              {regionScopes.map((scope) => {
                const active = scope.value === scopeValue;
                const count = getPool(scope).length;
                return (
                  <button
                    key={scope.value}
                    className={active ? "quiz-chip-active" : ""}
                    onClick={() => setScopeValue(scope.value)}
                    disabled={count === 0}
                  >
                    {scope.label}
                  </button>
                );
              })}
            </div>
            <span className="quiz-setup-hint">
              该范围共 {availableCount} 题
            </span>
          </div>

          <div className="quiz-setup-block">
            <span className="quiz-setup-label">题目数量</span>
            <div className="chips muted quiz-chips">
              {QUESTION_PRESETS.map((n) => {
                const active = n === desiredCount;
                const disabled = n > availableCount;
                return (
                  <button
                    key={n}
                    className={active ? "quiz-chip-active" : ""}
                    onClick={() => setDesiredCount(n)}
                    disabled={disabled}
                  >
                    {n} 题
                  </button>
                );
              })}
              <button
                className={
                  desiredCount === availableCount &&
                  !QUESTION_PRESETS.includes(desiredCount)
                    ? "quiz-chip-active"
                    : ""
                }
                onClick={() => setDesiredCount(availableCount)}
              >
                全部 {availableCount} 题
              </button>
            </div>
            <span className="quiz-setup-hint">
              本次将作答 {effectiveCount} 题
            </span>
          </div>
        </div>

        <button
          className="primary-action quiz-start-btn"
          onClick={startQuiz}
          disabled={effectiveCount === 0}
        >
          开始测验
        </button>
      </section>
    );
  }

  if (phase === "quiz") {
    const current = questions[currentIndex];
    const total = questions.length;
    const card = current.card;
    const answer = current.answer;
    const isLast = currentIndex === total - 1;
    const answeredCount = questions.filter(
      (q) => q.answer.region.trim() || q.answer.grape.trim()
    ).length;

    return (
      <section className="blind-quiz panel">
        <div className="section-heading">
          <div>
            <p>计时挑战</p>
            <h2>
              盲品测验 · 第 {currentIndex + 1} / {total} 题
            </h2>
          </div>
          <div className="quiz-meta">
            <span className="quiz-timer">⏱ {formatDuration(elapsed)}</span>
            {!confirmingQuit ? (
              <button
                className="quiz-quit-btn"
                onClick={() => setConfirmingQuit(true)}
              >
                退出测验
              </button>
            ) : (
              <span className="quiz-quit-confirm">
                <span>确认退出？</span>
                <button onClick={restart}>退出</button>
                <button onClick={() => setConfirmingQuit(false)}>取消</button>
              </span>
            )}
          </div>
        </div>

        <div className="quiz-progress-bar">
          <div
            className="quiz-progress-fill"
            style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
          />
        </div>

        <div className="tasting-card quiz-tasting-card">
          <div className="card-header">
            <span className="card-label">感官描述</span>
            <span className="card-hint">仅凭线索判断产区与品种</span>
          </div>

          <div className="sensory-grid">
            <div className="sensory-item">
              <span className="sensory-label">香气</span>
              <div className="aroma-tags">
                {card.aromas.map((aroma) => (
                  <span key={aroma} className="aroma-tag">
                    {aroma}
                  </span>
                ))}
              </div>
            </div>

            {card.color && (
              <div className="sensory-item">
                <span className="sensory-label">颜色</span>
                <span className="sensory-value">{card.color}</span>
              </div>
            )}

            <div className="sensory-item">
              <span className="sensory-label">酸度</span>
              <span className="sensory-value">{card.acidity}</span>
            </div>

            <div className="sensory-item">
              <span className="sensory-label">单宁</span>
              <span className="sensory-value">{card.tannin}</span>
            </div>

            <div className="sensory-item">
              <span className="sensory-label">酒体</span>
              <span className="sensory-value">{card.body}</span>
            </div>

            {card.alcohol && (
              <div className="sensory-item">
                <span className="sensory-label">酒精度</span>
                <span className="sensory-value">{card.alcohol}</span>
              </div>
            )}
          </div>

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
              <span>关键判断依据</span>
              <textarea
                className="quiz-reasoning"
                value={answer.reasoning}
                onChange={(e) => updateAnswer("reasoning", e.target.value)}
                placeholder="写出你判断产区与品种的关键线索，例如：高酸＋黑醋栗＋雪松＋铅笔芯指向波尔多左岸赤霞珠……"
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
  const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  const wrongResults = results.filter((r) => !r.fullyCorrect);

  return (
    <section className="blind-quiz panel">
      <div className="section-heading">
        <div>
          <p>测验成绩</p>
          <h2>盲品测验报告</h2>
        </div>
        <button className="primary-action" onClick={restart}>
          再来一次
        </button>
      </div>

      <div className="quiz-result-stats">
        <div className="quiz-stat quiz-stat-primary">
          <span>正确率</span>
          <strong>{accuracy}%</strong>
        </div>
        <div className="quiz-stat">
          <span>答对题数</span>
          <strong>
            {correctCount} / {total}
          </strong>
        </div>
        <div className="quiz-stat">
          <span>耗时</span>
          <strong>{formatDuration(elapsed)}</strong>
        </div>
        <div className="quiz-stat">
          <span>错题数</span>
          <strong>{wrongResults.length}</strong>
        </div>
      </div>

      <div className="quiz-progress-bar quiz-result-bar">
        <div
          className="quiz-progress-fill"
          style={{ width: `${accuracy}%` }}
        />
      </div>

      {wrongResults.length > 0 && (
        <div className="quiz-review-section">
          <h3 className="quiz-review-title">
            错题列表 · {wrongResults.length} 题
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
        <h3 className="quiz-review-title">全部题目参考推理</h3>
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
  const { question, regionCorrect, grapeCorrect, fullyCorrect, regionMatch, grapeMatch } = result;
  const { card, answer } = question;
  const sensoryLine = [
    card.color,
    card.acidity,
    card.tannin,
    card.body,
    card.alcohol,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article
      className={`quiz-review-card ${
        fullyCorrect ? "quiz-review-correct" : "quiz-review-wrong"
      }`}
    >
      <div className="quiz-review-head">
        <span className="quiz-review-index">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="quiz-review-id">
          <h4>
            {card.region} · {card.grape}
          </h4>
          <span
            className={`quiz-review-badge ${
              fullyCorrect ? "badge-correct" : "badge-wrong"
            }`}
          >
            {fullyCorrect ? "回答正确" : "回答有误"}
          </span>
        </div>
      </div>

      <div className="quiz-review-sensory">
        <span className="quiz-review-label">感官线索</span>
        <div className="aroma-tags">
          {card.aromas.map((a) => (
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
          <span className="quiz-compare-correct">{regionMatch.sourceLabel}</span>
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
          <span className="quiz-compare-correct">{grapeMatch.sourceLabel}</span>
        </div>
      </div>

      <div className="quiz-review-reasoning">
        <span className="quiz-review-label">你的判断依据</span>
        <p className="quiz-review-text">
          {answer.reasoning.trim() || "（未填写）"}
        </p>
      </div>

      <div className="quiz-review-explanation">
        <span className="quiz-review-label">参考推理</span>
        <p className="quiz-review-text">{card.explanation}</p>
      </div>
    </article>
  );
}
