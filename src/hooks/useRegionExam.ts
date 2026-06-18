import { useState, useRef, useCallback, type RefObject } from "react";
import { WineRecord } from "../data/wineRecordTypes";
import { matchRegionKey } from "../data/regionStats";

interface ExamPreset {
  recordIds: string[];
  examName: string;
}

interface UseRegionExamParams {
  records: WineRecord[];
  showToast: (message: string, tone?: "warn" | "info") => void;
}

interface UseRegionExamReturn {
  examPreset: ExamPreset | null;
  examPanelRef: RefObject<HTMLElement | null>;
  handleStartExamForRegion: (regionKey: string, regionName: string) => void;
  handleClearExamPreset: () => void;
}

export function useRegionExam({
  records,
  showToast,
}: UseRegionExamParams): UseRegionExamReturn {
  const [examPreset, setExamPreset] = useState<ExamPreset | null>(null);
  const examPanelRef = useRef<HTMLElement>(null);

  const handleStartExamForRegion = useCallback(
    (regionKey: string, regionName: string) => {
      const regionRecords = records.filter(
        (r) => matchRegionKey(r.region) === regionKey
      );

      if (regionRecords.length === 0) {
        showToast("该产区暂无记录，无法开始练习", "warn");
        return;
      }

      setExamPreset({
        recordIds: regionRecords.map((r) => r.id),
        examName: `产区练习 - ${regionName}`,
      });

      setTimeout(() => {
        examPanelRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);

      showToast(`已加载${regionRecords.length}条${regionName}记录到测验面板`, "info");
    },
    [records, showToast]
  );

  const handleClearExamPreset = useCallback(() => {
    setExamPreset(null);
  }, []);

  return {
    examPreset,
    examPanelRef,
    handleStartExamForRegion,
    handleClearExamPreset,
  };
}
