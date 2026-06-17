import {
  LearningProfile,
  BlindTastingRecord,
  QuizResultRecord,
  ReviewPlanRecord,
  ConfusionItem,
  ImportSummary,
  ImportMode,
  PROFILE_SCHEMA_VERSION,
} from "./learningProfileTypes";
import {
  getAllBlindTastingRecords,
  getAllQuizResults,
  getAllReviewPlans,
  getAllConfusionItems,
  putBlindTastingRecords,
  putQuizResults,
  putReviewPlans,
  putConfusionItems,
  takeRollbackSnapshot,
  generateId,
} from "./learningProfileDB";

export async function exportProfile(): Promise<string> {
  const profile: LearningProfile = {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    exportedAt: Date.now(),
    deviceInfo: navigator.userAgent,
    blindTastingRecords: await getAllBlindTastingRecords(),
    quizResults: await getAllQuizResults(),
    reviewPlans: await getAllReviewPlans(),
    confusionItems: await getAllConfusionItems(),
  };

  return JSON.stringify(profile, null, 2);
}

function isValidBlindTastingRecord(raw: unknown): raw is BlindTastingRecord {
  if (typeof raw !== "object" || raw === null) return false;
  const r = raw as Record<string, unknown>;
  return (
    typeof r.wineName === "string" &&
    typeof r.region === "string" &&
    typeof r.grape === "string" &&
    typeof r.mistakeType === "string" &&
    ["region", "grape", "both", "none"].includes(r.mistakeType as string)
  );
}

function isValidQuizResultRecord(raw: unknown): raw is QuizResultRecord {
  if (typeof raw !== "object" || raw === null) return false;
  const r = raw as Record<string, unknown>;
  return (
    typeof r.sessionId === "string" &&
    typeof r.totalQuestions === "number" &&
    typeof r.correctCount === "number"
  );
}

function isValidReviewPlanRecord(raw: unknown): raw is ReviewPlanRecord {
  if (typeof raw !== "object" || raw === null) return false;
  const r = raw as Record<string, unknown>;
  return (
    typeof r.wineName === "string" &&
    typeof r.grape === "string" &&
    typeof r.scheduledDate === "string" &&
    typeof r.stage === "string" &&
    ["today", "three-days", "one-week"].includes(r.stage as string)
  );
}

function isValidConfusionItem(raw: unknown): raw is ConfusionItem {
  if (typeof raw !== "object" || raw === null) return false;
  const r = raw as Record<string, unknown>;
  return (
    typeof r.wineA === "object" &&
    r.wineA !== null &&
    typeof r.wineB === "object" &&
    r.wineB !== null &&
    typeof (r.wineA as Record<string, unknown>).region === "string" &&
    typeof (r.wineB as Record<string, unknown>).region === "string"
  );
}

function migrateBlindTastingRecord(raw: Record<string, unknown>): BlindTastingRecord {
  const migratedFields: string[] = [];

  if (raw.id === undefined || raw.id === null) {
    raw.id = generateId();
    migratedFields.push("id");
  }
  if (raw.createdAt === undefined || raw.createdAt === null) {
    raw.createdAt = Date.now();
    migratedFields.push("createdAt");
  }
  if (raw.userRegionAnswer === undefined) {
    raw.userRegionAnswer = "";
    migratedFields.push("userRegionAnswer");
  }
  if (raw.userGrapeAnswer === undefined) {
    raw.userGrapeAnswer = "";
    migratedFields.push("userGrapeAnswer");
  }
  if (raw.correctRegion === undefined) {
    raw.correctRegion = false;
    migratedFields.push("correctRegion");
  }
  if (raw.correctGrape === undefined) {
    raw.correctGrape = false;
    migratedFields.push("correctGrape");
  }
  if (raw.timeSpentMs === undefined) {
    raw.timeSpentMs = 0;
    migratedFields.push("timeSpentMs");
  }
  if (raw.aromas === undefined) {
    raw.aromas = [];
    migratedFields.push("aromas");
  }

  const record = raw as unknown as BlindTastingRecord;
  return { ...record, _migratedFields: migratedFields } as BlindTastingRecord & { _migratedFields: string[] };
}

function migrateQuizResultRecord(raw: Record<string, unknown>): QuizResultRecord {
  const migratedFields: string[] = [];

  if (raw.id === undefined || raw.id === null) {
    raw.id = generateId();
    migratedFields.push("id");
  }
  if (raw.createdAt === undefined || raw.createdAt === null) {
    raw.createdAt = Date.now();
    migratedFields.push("createdAt");
  }
  if (raw.accuracy === undefined) {
    raw.accuracy = raw.totalQuestions && (raw.correctCount as number) / (raw.totalQuestions as number) || 0;
    migratedFields.push("accuracy");
  }
  if (raw.avgTimeMs === undefined) {
    raw.avgTimeMs = 0;
    migratedFields.push("avgTimeMs");
  }
  if (raw.mistakeTypes === undefined) {
    raw.mistakeTypes = { region: 0, grape: 0, both: 0 };
    migratedFields.push("mistakeTypes");
  }

  const record = raw as unknown as QuizResultRecord;
  return { ...record, _migratedFields: migratedFields } as QuizResultRecord & { _migratedFields: string[] };
}

function migrateReviewPlanRecord(raw: Record<string, unknown>): ReviewPlanRecord {
  const migratedFields: string[] = [];

  if (raw.id === undefined || raw.id === null) {
    raw.id = generateId();
    migratedFields.push("id");
  }
  if (raw.createdAt === undefined || raw.createdAt === null) {
    raw.createdAt = Date.now();
    migratedFields.push("createdAt");
  }
  if (raw.completed === undefined) {
    raw.completed = false;
    migratedFields.push("completed");
  }
  if (raw.completedAt === undefined) {
    raw.completedAt = null;
    migratedFields.push("completedAt");
  }

  const record = raw as unknown as ReviewPlanRecord;
  return { ...record, _migratedFields: migratedFields } as ReviewPlanRecord & { _migratedFields: string[] };
}

function migrateConfusionItem(raw: Record<string, unknown>): ConfusionItem {
  const migratedFields: string[] = [];

  if (raw.id === undefined || raw.id === null) {
    raw.id = generateId();
    migratedFields.push("id");
  }
  if (raw.createdAt === undefined || raw.createdAt === null) {
    raw.createdAt = Date.now();
    migratedFields.push("createdAt");
  }
  if (raw.lastConfusionTime === undefined) {
    raw.lastConfusionTime = null;
    migratedFields.push("lastConfusionTime");
  }
  if (raw.similarities === undefined) {
    raw.similarities = [];
    migratedFields.push("similarities");
  }

  const record = raw as unknown as ConfusionItem;
  return { ...record, _migratedFields: migratedFields } as ConfusionItem & { _migratedFields: string[] };
}

function deduplicateById<T extends { id: string }>(
  incoming: T[],
  existing: T[],
  mode: ImportMode
): { toAdd: T[]; duplicates: number } {
  const existingIds = new Set(existing.map((e) => e.id));

  if (mode === "skip") {
    const toAdd = incoming.filter((item) => !existingIds.has(item.id));
    return { toAdd, duplicates: incoming.length - toAdd.length };
  }

  if (mode === "overwrite") {
    const toAdd = incoming.map((item) => {
      if (existingIds.has(item.id)) {
        return { ...item, id: item.id + "_imported_" + Date.now().toString(36) };
      }
      return item;
    });
    return { toAdd, duplicates: incoming.filter((item) => existingIds.has(item.id)).length };
  }

  const toAdd = incoming.map((item) => {
    if (existingIds.has(item.id)) {
      return { ...item, id: generateId() };
    }
    return item;
  });
  return { toAdd, duplicates: incoming.filter((item) => existingIds.has(item.id)).length };
}

export async function importProfile(
  jsonString: string,
  duplicateMode: ImportMode = "merge"
): Promise<ImportSummary> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error("无效的 JSON 格式，请检查文件内容");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("文件内容不是有效的学习档案对象");
  }

  const data = parsed as Record<string, unknown>;

  const rawBlind = Array.isArray(data.blindTastingRecords) ? data.blindTastingRecords : [];
  const rawQuiz = Array.isArray(data.quizResults) ? data.quizResults : [];
  const rawReview = Array.isArray(data.reviewPlans) ? data.reviewPlans : [];
  const rawConfusion = Array.isArray(data.confusionItems) ? data.confusionItems : [];

  const allMigratedFields: string[] = [];

  const validatedBlind: BlindTastingRecord[] = [];
  let blindInvalid = 0;
  for (const raw of rawBlind) {
    if (isValidBlindTastingRecord(raw)) {
      const migrated = migrateBlindTastingRecord(raw as Record<string, unknown>);
      const mf = (migrated as unknown as { _migratedFields?: string[] })._migratedFields;
      if (mf) allMigratedFields.push(...mf);
      const { _migratedFields, ...clean } = migrated as unknown as { _migratedFields: string[] } & BlindTastingRecord;
      validatedBlind.push(clean);
    } else {
      blindInvalid++;
    }
  }

  const validatedQuiz: QuizResultRecord[] = [];
  let quizInvalid = 0;
  for (const raw of rawQuiz) {
    if (isValidQuizResultRecord(raw)) {
      const migrated = migrateQuizResultRecord(raw as Record<string, unknown>);
      const mf = (migrated as unknown as { _migratedFields?: string[] })._migratedFields;
      if (mf) allMigratedFields.push(...mf);
      const { _migratedFields, ...clean } = migrated as unknown as { _migratedFields: string[] } & QuizResultRecord;
      validatedQuiz.push(clean);
    } else {
      quizInvalid++;
    }
  }

  const validatedReview: ReviewPlanRecord[] = [];
  let reviewInvalid = 0;
  for (const raw of rawReview) {
    if (isValidReviewPlanRecord(raw)) {
      const migrated = migrateReviewPlanRecord(raw as Record<string, unknown>);
      const mf = (migrated as unknown as { _migratedFields?: string[] })._migratedFields;
      if (mf) allMigratedFields.push(...mf);
      const { _migratedFields, ...clean } = migrated as unknown as { _migratedFields: string[] } & ReviewPlanRecord;
      validatedReview.push(clean);
    } else {
      reviewInvalid++;
    }
  }

  const validatedConfusion: ConfusionItem[] = [];
  let confusionInvalid = 0;
  for (const raw of rawConfusion) {
    if (isValidConfusionItem(raw)) {
      const migrated = migrateConfusionItem(raw as Record<string, unknown>);
      const mf = (migrated as unknown as { _migratedFields?: string[] })._migratedFields;
      if (mf) allMigratedFields.push(...mf);
      const { _migratedFields, ...clean } = migrated as unknown as { _migratedFields: string[] } & ConfusionItem;
      validatedConfusion.push(clean);
    } else {
      confusionInvalid++;
    }
  }

  await takeRollbackSnapshot();

  const existingBlind = await getAllBlindTastingRecords();
  const existingQuiz = await getAllQuizResults();
  const existingReview = await getAllReviewPlans();
  const existingConfusion = await getAllConfusionItems();

  const blindResult = deduplicateById(validatedBlind, existingBlind, duplicateMode);
  const quizResult = deduplicateById(validatedQuiz, existingQuiz, duplicateMode);
  const reviewResult = deduplicateById(validatedReview, existingReview, duplicateMode);
  const confusionResult = deduplicateById(validatedConfusion, existingConfusion, duplicateMode);

  if (blindResult.toAdd.length > 0) await putBlindTastingRecords(blindResult.toAdd);
  if (quizResult.toAdd.length > 0) await putQuizResults(quizResult.toAdd);
  if (reviewResult.toAdd.length > 0) await putReviewPlans(reviewResult.toAdd);
  if (confusionResult.toAdd.length > 0) await putConfusionItems(confusionResult.toAdd);

  const uniqueMigratedFields = [...new Set(allMigratedFields)];

  return {
    totalRecordsInFile: rawBlind.length + rawQuiz.length + rawReview.length + rawConfusion.length,
    blindTastingImported: blindResult.toAdd.length,
    blindTastingDuplicates: blindResult.duplicates,
    blindTastingInvalid: blindInvalid,
    quizResultsImported: quizResult.toAdd.length,
    quizResultsDuplicates: quizResult.duplicates,
    quizResultsInvalid: quizInvalid,
    reviewPlansImported: reviewResult.toAdd.length,
    reviewPlansDuplicates: reviewResult.duplicates,
    reviewPlansInvalid: reviewInvalid,
    confusionItemsImported: confusionResult.toAdd.length,
    confusionItemsDuplicates: confusionResult.duplicates,
    confusionItemsInvalid: confusionInvalid,
    migratedFields: uniqueMigratedFields,
    rollbackAvailable: true,
  };
}

export function formatImportSummary(summary: ImportSummary): string {
  const lines: string[] = [];
  lines.push(`导入完成：文件包含 ${summary.totalRecordsInFile} 条记录`);
  lines.push("");

  if (summary.blindTastingImported > 0 || summary.blindTastingDuplicates > 0 || summary.blindTastingInvalid > 0) {
    const parts: string[] = [];
    if (summary.blindTastingImported > 0) parts.push(`${summary.blindTastingImported} 条导入`);
    if (summary.blindTastingDuplicates > 0) parts.push(`${summary.blindTastingDuplicates} 条重复跳过`);
    if (summary.blindTastingInvalid > 0) parts.push(`${summary.blindTastingInvalid} 条无效`);
    lines.push(`盲品记录：${parts.join("，")}`);
  }

  if (summary.quizResultsImported > 0 || summary.quizResultsDuplicates > 0 || summary.quizResultsInvalid > 0) {
    const parts: string[] = [];
    if (summary.quizResultsImported > 0) parts.push(`${summary.quizResultsImported} 条导入`);
    if (summary.quizResultsDuplicates > 0) parts.push(`${summary.quizResultsDuplicates} 条重复跳过`);
    if (summary.quizResultsInvalid > 0) parts.push(`${summary.quizResultsInvalid} 条无效`);
    lines.push(`测验结果：${parts.join("，")}`);
  }

  if (summary.reviewPlansImported > 0 || summary.reviewPlansDuplicates > 0 || summary.reviewPlansInvalid > 0) {
    const parts: string[] = [];
    if (summary.reviewPlansImported > 0) parts.push(`${summary.reviewPlansImported} 条导入`);
    if (summary.reviewPlansDuplicates > 0) parts.push(`${summary.reviewPlansDuplicates} 条重复跳过`);
    if (summary.reviewPlansInvalid > 0) parts.push(`${summary.reviewPlansInvalid} 条无效`);
    lines.push(`复习计划：${parts.join("，")}`);
  }

  if (summary.confusionItemsImported > 0 || summary.confusionItemsDuplicates > 0 || summary.confusionItemsInvalid > 0) {
    const parts: string[] = [];
    if (summary.confusionItemsImported > 0) parts.push(`${summary.confusionItemsImported} 条导入`);
    if (summary.confusionItemsDuplicates > 0) parts.push(`${summary.confusionItemsDuplicates} 条重复跳过`);
    if (summary.confusionItemsInvalid > 0) parts.push(`${summary.confusionItemsInvalid} 条无效`);
    lines.push(`混淆项：${parts.join("，")}`);
  }

  if (summary.migratedFields.length > 0) {
    lines.push("");
    lines.push(`自动补全字段：${summary.migratedFields.join("、")}`);
  }

  if (summary.rollbackAvailable) {
    lines.push("");
    lines.push("已创建回滚快照，可随时撤销本次导入");
  }

  return lines.join("\n");
}
