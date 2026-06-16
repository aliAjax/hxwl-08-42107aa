import { useState, useCallback } from "react";
import { WineCard, wineCards } from "../data/wineData";

type GameStatus = "playing" | "submitted";

function getRandomCard(excludeId?: string): WineCard {
  const available = excludeId
    ? wineCards.filter((c) => c.id !== excludeId)
    : wineCards;
  const index = Math.floor(Math.random() * available.length);
  return available[index];
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

interface BlindTastingCardProps {
  onAromaClick?: (aroma: string) => void;
}

export default function BlindTastingCard({ onAromaClick }: BlindTastingCardProps) {
  const [currentCard, setCurrentCard] = useState<WineCard>(() => getRandomCard());
  const [status, setStatus] = useState<GameStatus>("playing");
  const [regionInput, setRegionInput] = useState("");
  const [grapeInput, setGrapeInput] = useState("");
  const [regionCorrect, setRegionCorrect] = useState<boolean | null>(null);
  const [grapeCorrect, setGrapeCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const handleSubmit = useCallback(() => {
    const isRegionCorrect = checkAnswer(regionInput, currentCard.region);
    const isGrapeCorrect = checkAnswer(grapeInput, currentCard.grape);
    setRegionCorrect(isRegionCorrect);
    setGrapeCorrect(isGrapeCorrect);
    setStatus("submitted");
    setScore((prev) => ({
      correct: prev.correct + (isRegionCorrect && isGrapeCorrect ? 1 : 0),
      total: prev.total + 1,
    }));
  }, [regionInput, grapeInput, currentCard]);

  const handleNext = useCallback(() => {
    setCurrentCard(getRandomCard(currentCard.id));
    setStatus("playing");
    setRegionInput("");
    setGrapeInput("");
    setRegionCorrect(null);
    setGrapeCorrect(null);
  }, [currentCard.id]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && status === "playing") {
      handleSubmit();
    }
  };

  return (
    <section className="blind-tasting panel">
      <div className="section-heading">
        <div>
          <p>互动练习</p>
          <h2>盲品练习卡</h2>
        </div>
        <div className="score-badge">
          <span>得分</span>
          <strong>
            {score.correct}/{score.total}
          </strong>
        </div>
      </div>

      <div className="tasting-card">
        <div className="card-header">
          <span className="card-label">盲品练习</span>
          <span className="card-hint">根据感官线索猜产区和品种</span>
        </div>

        <div className="sensory-grid">
          <div className="sensory-item">
            <span className="sensory-label">香气</span>
            <div className="aroma-tags">
              {currentCard.aromas.map((aroma) => (
                <button
                  key={aroma}
                  className="aroma-tag aroma-tag-clickable"
                  onClick={() => onAromaClick?.(aroma)}
                  title={`在词库中查看「${aroma}」`}
                >
                  {aroma}
                </button>
              ))}
            </div>
          </div>

          <div className="sensory-item">
            <span className="sensory-label">酸度</span>
            <span className="sensory-value">{currentCard.acidity}</span>
          </div>

          <div className="sensory-item">
            <span className="sensory-label">单宁</span>
            <span className="sensory-value">{currentCard.tannin}</span>
          </div>

          <div className="sensory-item">
            <span className="sensory-label">酒体</span>
            <span className="sensory-value">{currentCard.body}</span>
          </div>

          {currentCard.color && (
            <div className="sensory-item">
              <span className="sensory-label">颜色</span>
              <span className="sensory-value">{currentCard.color}</span>
            </div>
          )}

          {currentCard.alcohol && (
            <div className="sensory-item">
              <span className="sensory-label">酒精度</span>
              <span className="sensory-value">{currentCard.alcohol}</span>
            </div>
          )}
        </div>

        <div className="answer-section">
          <div className="answer-inputs">
            <label>
              <span>产区</span>
              <input
                type="text"
                value={regionInput}
                onChange={(e) => setRegionInput(e.target.value)}
                placeholder="请输入产区名称"
                disabled={status === "submitted"}
                onKeyDown={handleKeyDown}
                className={
                  status === "submitted"
                    ? regionCorrect
                      ? "correct"
                      : "incorrect"
                    : ""
                }
              />
            </label>

            <label>
              <span>葡萄品种</span>
              <input
                type="text"
                value={grapeInput}
                onChange={(e) => setGrapeInput(e.target.value)}
                placeholder="请输入葡萄品种"
                disabled={status === "submitted"}
                onKeyDown={handleKeyDown}
                className={
                  status === "submitted"
                    ? grapeCorrect
                      ? "correct"
                      : "incorrect"
                    : ""
                }
              />
            </label>
          </div>

          {status === "playing" ? (
            <button
              className="primary-action submit-btn"
              onClick={handleSubmit}
              disabled={!regionInput.trim() || !grapeInput.trim()}
            >
              提交答案
            </button>
          ) : (
            <div className="result-section">
              <div className="result-header">
                <span
                  className={`result-tag ${
                    regionCorrect && grapeCorrect ? "all-correct" : "partial"
                  }`}
                >
                  {regionCorrect && grapeCorrect ? "完全正确！" : "继续加油"}
                </span>
              </div>

              <div className="correct-answers">
                <div className="correct-answer-item">
                  <span className="answer-label">参考答案 · 产区</span>
                  <span className="answer-value">{currentCard.region}</span>
                </div>
                <div className="correct-answer-item">
                  <span className="answer-label">参考答案 · 品种</span>
                  <span className="answer-value">{currentCard.grape}</span>
                </div>
              </div>

              <div className="explanation">
                <span className="explanation-label">解析</span>
                <p className="explanation-text">{currentCard.explanation}</p>
              </div>

              <button className="primary-action next-btn" onClick={handleNext}>
                下一题
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
