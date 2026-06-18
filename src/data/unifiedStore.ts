import {
  BlindTastingRecord,
  QuizResultRecord,
  ReviewPlanRecord,
  ConfusionItem,
  RollbackSnapshot,
  LearningProfile,
  ImportSummary,
  ImportMode,
  ImportPreview,
  RecordCategoryPreview,
  PROFILE_SCHEMA_VERSION,
} from "./learningProfileTypes";
import { WineRecord, WineRecordInput, seedRecords } from "./wineRecordTypes";
import { QuizSession, QuizAttemptDetail, ConfusionPair } from "./adaptiveReview";
import {
  quizSessionToQuizResult,
  quizAttemptToBlindTastingRecord,
  confusionPairToConfusionItem,
  reviewTaskToReviewPlanRecord,
} from "./learningProfileAdapters";

const DB_NAME = "hxwl-08-unified-store";
const DB_VERSION = 1;

const STORES = {
  quizSessions: "quizSessions",
  blindTastings: "blindTastings",
  quizResults: "quizResults",
  reviewPlans: "reviewPlans",
  confusionItems: "confusionItems",
  wineRecords: "wineRecords",
  rollbackSnapshots: "rollbackSnapshots",
  adaptiveTasks: "adaptiveTasks",
  reviewStatus: "reviewStatus",
  metadata: "metadata",
} as const;

type StoreName = (typeof STORES)[keyof typeof STORES];

const LEGACY_LS_KEYS = {
  quizHistory: "hxwl-08-quiz-history",
  adaptiveTasks: "hxwl-08-adaptive-review-tasks",
  reviewStatus: "hxwl-08-review-status",
  profileMigrated: "hxwl-08-profile-migrated",
  wineSeeded: "hxwl-08-wine-db-seeded",
  historySeeded: "hxwl-08-history-seeded",
} as const;

const LEGACY_IDB_NAMES = {
  learningProfile: "hxwl-08-learning-profile",
  wineDb: "hxwl-08-wine-db",
} as const;

let dbInstance: IDBDatabase | null = null;
let initPromise: Promise<IDBDatabase> | null = null;

function openUnifiedDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (initPromise) return initPromise;

  initPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      initPromise = null;
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      dbInstance.onclose = () => {
        dbInstance = null;
        initPromise = null;
      };
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const storeDefs: Array<{
        name: StoreName;
        keyPath: string;
        indexes?: Array<{ name: string; keyPath: string; unique?: boolean }>;
      }> = [
        {
          name: STORES.quizSessions,
          keyPath: "id",
          indexes: [{ name: "createdAt", keyPath: "endTime" }],
        },
        {
          name: STORES.blindTastings,
          keyPath: "id",
          indexes: [{ name: "createdAt", keyPath: "createdAt" }],
        },
        {
          name: STORES.quizResults,
          keyPath: "id",
          indexes: [{ name: "createdAt", keyPath: "createdAt" }],
        },
        {
          name: STORES.reviewPlans,
          keyPath: "id",
          indexes: [
            { name: "createdAt", keyPath: "createdAt" },
            { name: "scheduledDate", keyPath: "scheduledDate" },
          ],
        },
        {
          name: STORES.confusionItems,
          keyPath: "id",
          indexes: [{ name: "createdAt", keyPath: "createdAt" }],
        },
        {
          name: STORES.wineRecords,
          keyPath: "id",
          indexes: [
            { name: "createdAt", keyPath: "createdAt" },
            { name: "updatedAt", keyPath: "updatedAt" },
          ],
        },
        {
          name: STORES.rollbackSnapshots,
          keyPath: "id",
          indexes: [{ name: "createdAt", keyPath: "createdAt" }],
        },
        {
          name: STORES.adaptiveTasks,
          keyPath: "dateKey",
        },
        {
          name: STORES.reviewStatus,
          keyPath: "taskId",
        },
        {
          name: STORES.metadata,
          keyPath: "key",
        },
      ];

      for (const def of storeDefs) {
        if (!db.objectStoreNames.contains(def.name)) {
          const store = db.createObjectStore(def.name, {
            keyPath: def.keyPath,
          });
          if (def.indexes) {
            for (const idx of def.indexes) {
              store.createIndex(idx.name, idx.keyPath, {
                unique: idx.unique ?? false,
              });
            }
          }
        }
      }
    };
  });

  return initPromise;
}

function getAllFromStore<T>(storeName: StoreName): Promise<T[]> {
  return openUnifiedDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve(req.result as T[]);
      })
  );
}

function getFromStoreByKey<T>(
  storeName: StoreName,
  key: IDBValidKey
): Promise<T | undefined> {
  return openUnifiedDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const req = store.get(key);
        req.onerror = () => reject(req.error);
        req.onsuccess = () =>
          resolve(req.result ? (req.result as T) : undefined);
      })
  );
}

function putToStore<T>(storeName: StoreName, items: T[]): Promise<void> {
  return openUnifiedDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        for (const item of items) {
          store.put(item);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      })
  );
}

function putSingleToStore<T>(storeName: StoreName, item: T): Promise<void> {
  return putToStore(storeName, [item]);
}

function deleteFromStore(storeName: StoreName, key: IDBValidKey): Promise<void> {
  return openUnifiedDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const req = store.delete(key);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve();
      })
  );
}

function clearStore(storeName: StoreName): Promise<void> {
  return openUnifiedDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const req = store.clear();
        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve();
      })
  );
}

function clearStores(storeNames: StoreName[]): Promise<void> {
  return openUnifiedDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeNames, "readwrite");
        for (const name of storeNames) {
          tx.objectStore(name).clear();
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      })
  );
}

function getMetadata(key: string): Promise<string | null> {
  return getFromStoreByKey<{ key: string; value: string }>(
    STORES.metadata,
    key
  ).then((entry) => entry?.value ?? null);
}

function setMetadata(key: string, value: string): Promise<void> {
  return putSingleToStore(STORES.metadata, { key, value });
}

export function generateId(): string {
  return (
    "u_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2, 9)
  );
}

function contentHash(obj: unknown): string {
  const str = JSON.stringify(obj);
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return "ch_" + Math.abs(h).toString(36);
}

function semanticKeyBlindTasting(r: BlindTastingRecord): string {
  return `bt:${r.wineName}:${r.region}:${r.grape}:${r.userRegionAnswer}:${r.userGrapeAnswer}:${r.mistakeType}:${r.createdAt}`;
}

function semanticKeyQuizResult(r: QuizResultRecord): string {
  return `qr:${r.sessionId}:${r.totalQuestions}:${r.correctCount}:${r.createdAt}`;
}

function semanticKeyReviewPlan(r: ReviewPlanRecord): string {
  return `rp:${r.wineName}:${r.grape}:${r.scheduledDate}:${r.stage}`;
}

function semanticKeyConfusionItem(r: ConfusionItem): string {
  return `ci:${r.wineA.region}:${r.wineA.grape}:${r.wineB.region}:${r.wineB.grape}`;
}

function semanticKeyWineRecord(r: WineRecord): string {
  return `wr:${r.name}:${r.region}:${r.grape}:${r.country}`;
}

export async function initUnifiedStore(): Promise<MigrationResult> {
  await openUnifiedDB();
  return migrateFromLegacyIfNeeded();
}

export async function isStoreInitialized(): Promise<boolean> {
  const flag = await getMetadata("unified-store-initialized");
  return flag === "1";
}

export interface MigrationResult {
  quizSessionsMigrated: number;
  blindTastingsMigrated: number;
  quizResultsMigrated: number;
  reviewPlansMigrated: number;
  confusionItemsMigrated: number;
  wineRecordsMigrated: number;
  rollbackSnapshotsMigrated: number;
  adaptiveTasksMigrated: boolean;
  reviewStatusMigrated: boolean;
  fromExisting: boolean;
}

async function readLegacyIDB(
  dbName: string,
  storeNames: string[]
): Promise<Map<string, unknown[]>> {
  const result = new Map<string, unknown[]>();
  return new Promise((resolve) => {
    const request = indexedDB.open(dbName);
    request.onerror = () => resolve(result);
    request.onsuccess = () => {
      const db = request.result;
      const available = storeNames.filter((s) =>
        db.objectStoreNames.contains(s)
      );
      if (available.length === 0) {
        db.close();
        resolve(result);
        return;
      }
      let completed = 0;
      for (const name of available) {
        try {
          const tx = db.transaction(name, "readonly");
          const store = tx.objectStore(name);
          const req = store.getAll();
          req.onsuccess = () => {
            result.set(name, req.result ?? []);
            completed++;
            if (completed === available.length) {
              db.close();
              resolve(result);
            }
          };
          req.onerror = () => {
            result.set(name, []);
            completed++;
            if (completed === available.length) {
              db.close();
              resolve(result);
            }
          };
        } catch {
          result.set(name, []);
          completed++;
          if (completed === available.length) {
            db.close();
            resolve(result);
          }
        }
      }
    };
  });
}

async function migrateFromLegacyIfNeeded(): Promise<MigrationResult> {
  const alreadyMigrated = await getMetadata("unified-store-initialized");
  if (alreadyMigrated === "1") {
    return {
      quizSessionsMigrated: 0,
      blindTastingsMigrated: 0,
      quizResultsMigrated: 0,
      reviewPlansMigrated: 0,
      confusionItemsMigrated: 0,
      wineRecordsMigrated: 0,
      rollbackSnapshotsMigrated: 0,
      adaptiveTasksMigrated: false,
      reviewStatusMigrated: false,
      fromExisting: true,
    };
  }

  const result: MigrationResult = {
    quizSessionsMigrated: 0,
    blindTastingsMigrated: 0,
    quizResultsMigrated: 0,
    reviewPlansMigrated: 0,
    confusionItemsMigrated: 0,
    wineRecordsMigrated: 0,
    rollbackSnapshotsMigrated: 0,
    adaptiveTasksMigrated: false,
    reviewStatusMigrated: false,
    fromExisting: false,
  };

  try {
    const profileData = await readLegacyIDB(
      LEGACY_IDB_NAMES.learningProfile,
      [
        "blindTasting",
        "quizResults",
        "reviewPlans",
        "confusionItems",
        "rollbackSnapshots",
      ]
    );

    const blindTastings =
      (profileData.get("blindTasting") as BlindTastingRecord[]) ?? [];
    const quizResults =
      (profileData.get("quizResults") as QuizResultRecord[]) ?? [];
    const reviewPlans =
      (profileData.get("reviewPlans") as ReviewPlanRecord[]) ?? [];
    const confusionItems =
      (profileData.get("confusionItems") as ConfusionItem[]) ?? [];
    const rollbackSnapshots =
      (profileData.get("rollbackSnapshots") as RollbackSnapshot[]) ?? [];

    if (blindTastings.length > 0) {
      await dedupAndPut(STORES.blindTastings, blindTastings, (r) => r.id, semanticKeyBlindTasting);
      result.blindTastingsMigrated = blindTastings.length;
    }
    if (quizResults.length > 0) {
      await dedupAndPut(STORES.quizResults, quizResults, (r) => r.id, semanticKeyQuizResult);
      result.quizResultsMigrated = quizResults.length;
    }
    if (reviewPlans.length > 0) {
      await dedupAndPut(STORES.reviewPlans, reviewPlans, (r) => r.id, semanticKeyReviewPlan);
      result.reviewPlansMigrated = reviewPlans.length;
    }
    if (confusionItems.length > 0) {
      await dedupAndPut(STORES.confusionItems, confusionItems, (r) => r.id, semanticKeyConfusionItem);
      result.confusionItemsMigrated = confusionItems.length;
    }
    if (rollbackSnapshots.length > 0) {
      await putToStore(STORES.rollbackSnapshots, rollbackSnapshots);
      result.rollbackSnapshotsMigrated = rollbackSnapshots.length;
    }
  } catch (err) {
    console.warn("Failed to migrate learning profile data:", err);
  }

  try {
    const wineData = await readLegacyIDB(LEGACY_IDB_NAMES.wineDb, [
      "wineRecords",
    ]);
    const wineRecords =
      (wineData.get("wineRecords") as WineRecord[]) ?? [];
    if (wineRecords.length > 0) {
      await dedupAndPut(STORES.wineRecords, wineRecords, (r) => r.id, semanticKeyWineRecord);
      result.wineRecordsMigrated = wineRecords.length;
    }
  } catch (err) {
    console.warn("Failed to migrate wine record data:", err);
  }

  try {
    const rawHistory = localStorage.getItem(LEGACY_LS_KEYS.quizHistory);
    if (rawHistory) {
      const sessions = JSON.parse(rawHistory) as QuizSession[];
      if (Array.isArray(sessions) && sessions.length > 0) {
        const existingSessions = await getAllQuizSessions();
        const existingSessionIds = new Set(
          existingSessions.map((s) => s.id)
        );
        const newSessions = sessions.filter(
          (s) => !existingSessionIds.has(s.id)
        );
        if (newSessions.length > 0) {
          await putToStore(STORES.quizSessions, newSessions);
          result.quizSessionsMigrated = newSessions.length;

          const newQuizResults: QuizResultRecord[] = [];
          const newBlindTastings: BlindTastingRecord[] = [];
          for (const session of newSessions) {
            try {
              const quizResult = quizSessionToQuizResult(session);
              newQuizResults.push(quizResult);
              for (const attempt of session.attempts) {
                try {
                  const wineName = attempt.questionId || attempt.userRegionAnswer + " / " + attempt.userGrapeAnswer;
                  const bt = quizAttemptToBlindTastingRecord(
                    attempt,
                    session.id,
                    wineName,
                    []
                  );
                  newBlindTastings.push(bt);
                } catch {
                }
              }
            } catch {
            }
          }
          if (newQuizResults.length > 0) {
            await dedupAndPut(STORES.quizResults, newQuizResults, (r) => r.id, semanticKeyQuizResult);
            result.quizResultsMigrated = newQuizResults.length;
          }
          if (newBlindTastings.length > 0) {
            await dedupAndPut(STORES.blindTastings, newBlindTastings, (r) => r.id, semanticKeyBlindTasting);
            result.blindTastingsMigrated = newBlindTastings.length;
          }
        }
      }
    }
  } catch (err) {
    console.warn("Failed to migrate quiz history from localStorage:", err);
  }

  try {
    const rawTasks = localStorage.getItem(LEGACY_LS_KEYS.adaptiveTasks);
    if (rawTasks) {
      const bundle = JSON.parse(rawTasks);
      if (bundle && bundle.dateKey) {
        await putSingleToStore(STORES.adaptiveTasks, bundle);
        result.adaptiveTasksMigrated = true;
      }
    }
  } catch (err) {
    console.warn("Failed to migrate adaptive tasks from localStorage:", err);
  }

  try {
    const rawStatus = localStorage.getItem(LEGACY_LS_KEYS.reviewStatus);
    if (rawStatus) {
      const statusMap = JSON.parse(rawStatus) as Record<string, boolean>;
      const entries = Object.entries(statusMap).map(([taskId, completed]) => ({
        taskId,
        completed,
      }));
      if (entries.length > 0) {
        await putToStore(STORES.reviewStatus, entries);
        result.reviewStatusMigrated = true;
      }
    }
  } catch (err) {
    console.warn("Failed to migrate review status from localStorage:", err);
  }

  const hasWineData = await getMetadata("wine-seeded");
  if (!hasWineData) {
    const existingWines = await getAllWineRecords();
    if (existingWines.length === 0) {
      const now = Date.now();
      const seeded: WineRecord[] = seedRecords.map((s, i) => ({
        ...s,
        id: `rec_seed_${i}_${now.toString(36)}`,
        createdAt: now + i,
        updatedAt: now + i,
      }));
      await putToStore(STORES.wineRecords, seeded);
      await setMetadata("wine-seeded", "1");
    } else {
      await setMetadata("wine-seeded", "1");
    }
  }

  await setMetadata("unified-store-initialized", "1");

  return result;
}

async function dedupAndPut<T>(
  storeName: StoreName,
  incoming: T[],
  idExtractor: (item: T) => string,
  semanticKeyFn: (item: T) => string
): Promise<{ added: number; updated: number; skipped: number }> {
  if (incoming.length === 0) return { added: 0, updated: 0, skipped: 0 };

  const existing = await getAllFromStore<T>(storeName);
  const existingById = new Map(existing.map((e) => [idExtractor(e), e]));
  const existingSemanticKeys = new Set(existing.map(semanticKeyFn));

  const toWrite: T[] = [];
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const item of incoming) {
    const id = idExtractor(item);
    const semKey = semanticKeyFn(item);

    if (existingById.has(id)) {
      const existingItem = existingById.get(id)!;
      const existingHash = contentHash(existingItem);
      const incomingHash = contentHash(item);
      if (existingHash !== incomingHash) {
        toWrite.push(item);
        updated++;
      } else {
        skipped++;
      }
    } else if (existingSemanticKeys.has(semKey)) {
      skipped++;
    } else {
      toWrite.push(item);
      added++;
    }
  }

  if (toWrite.length > 0) {
    await putToStore(storeName, toWrite);
  }

  return { added, updated, skipped };
}

export async function saveQuizSession(session: QuizSession): Promise<void> {
  await putSingleToStore(STORES.quizSessions, session);
}

export async function getAllQuizSessions(): Promise<QuizSession[]> {
  const sessions = await getAllFromStore<QuizSession>(STORES.quizSessions);
  return sessions.sort((a, b) => b.endTime - a.endTime);
}

export async function clearQuizSessions(): Promise<void> {
  await clearStore(STORES.quizSessions);
}

export async function getAllBlindTastings(): Promise<BlindTastingRecord[]> {
  return getAllFromStore<BlindTastingRecord>(STORES.blindTastings);
}

export async function addBlindTasting(
  record: Omit<BlindTastingRecord, "id" | "createdAt">
): Promise<BlindTastingRecord> {
  const item: BlindTastingRecord = {
    ...record,
    id: generateId(),
    createdAt: Date.now(),
  };
  await putSingleToStore(STORES.blindTastings, item);
  return item;
}

export async function putBlindTastings(
  records: BlindTastingRecord[]
): Promise<void> {
  await putToStore(STORES.blindTastings, records);
}

export async function upsertBlindTastings(
  records: BlindTastingRecord[]
): Promise<{ added: number; updated: number; skipped: number }> {
  return dedupAndPut(
    STORES.blindTastings,
    records,
    (r) => r.id,
    semanticKeyBlindTasting
  );
}

export async function getAllQuizResults(): Promise<QuizResultRecord[]> {
  return getAllFromStore<QuizResultRecord>(STORES.quizResults);
}

export async function addQuizResult(
  record: Omit<QuizResultRecord, "id" | "createdAt">
): Promise<QuizResultRecord> {
  const item: QuizResultRecord = {
    ...record,
    id: generateId(),
    createdAt: Date.now(),
  };
  await putSingleToStore(STORES.quizResults, item);
  return item;
}

export async function putQuizResults(
  records: QuizResultRecord[]
): Promise<void> {
  await putToStore(STORES.quizResults, records);
}

export async function upsertQuizResults(
  records: QuizResultRecord[]
): Promise<{ added: number; updated: number; skipped: number }> {
  return dedupAndPut(
    STORES.quizResults,
    records,
    (r) => r.id,
    semanticKeyQuizResult
  );
}

export async function getAllReviewPlans(): Promise<ReviewPlanRecord[]> {
  return getAllFromStore<ReviewPlanRecord>(STORES.reviewPlans);
}

export async function addReviewPlan(
  record: Omit<ReviewPlanRecord, "id" | "createdAt">
): Promise<ReviewPlanRecord> {
  const item: ReviewPlanRecord = {
    ...record,
    id: generateId(),
    createdAt: Date.now(),
  };
  await putSingleToStore(STORES.reviewPlans, item);
  return item;
}

export async function putReviewPlans(
  records: ReviewPlanRecord[]
): Promise<void> {
  await putToStore(STORES.reviewPlans, records);
}

export async function upsertReviewPlans(
  records: ReviewPlanRecord[]
): Promise<{ added: number; updated: number; skipped: number }> {
  return dedupAndPut(
    STORES.reviewPlans,
    records,
    (r) => r.id,
    semanticKeyReviewPlan
  );
}

export async function getAllConfusionItems(): Promise<ConfusionItem[]> {
  return getAllFromStore<ConfusionItem>(STORES.confusionItems);
}

export async function addConfusionItem(
  record: Omit<ConfusionItem, "id" | "createdAt">
): Promise<ConfusionItem> {
  const item: ConfusionItem = {
    ...record,
    id: generateId(),
    createdAt: Date.now(),
  };
  await putSingleToStore(STORES.confusionItems, item);
  return item;
}

export async function putConfusionItems(
  records: ConfusionItem[]
): Promise<void> {
  await putToStore(STORES.confusionItems, records);
}

export async function upsertConfusionItems(
  records: ConfusionItem[]
): Promise<{ added: number; updated: number; skipped: number }> {
  return dedupAndPut(
    STORES.confusionItems,
    records,
    (r) => r.id,
    semanticKeyConfusionItem
  );
}

export async function getAllWineRecords(): Promise<WineRecord[]> {
  const records = await getAllFromStore<WineRecord>(STORES.wineRecords);
  return records.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getWineRecordById(
  id: string
): Promise<WineRecord | undefined> {
  return getFromStoreByKey<WineRecord>(STORES.wineRecords, id);
}

export async function addWineRecord(
  input: WineRecordInput
): Promise<WineRecord> {
  const now = Date.now();
  const record: WineRecord = {
    ...input,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };
  await putSingleToStore(STORES.wineRecords, record);
  return record;
}

export async function updateWineRecord(
  id: string,
  input: WineRecordInput
): Promise<WineRecord> {
  const existing = await getWineRecordById(id);
  if (!existing) {
    throw new Error(`Record with id ${id} not found`);
  }
  const updated: WineRecord = {
    ...existing,
    ...input,
    id,
    updatedAt: Date.now(),
  };
  await putSingleToStore(STORES.wineRecords, updated);
  return updated;
}

export async function deleteWineRecord(id: string): Promise<void> {
  await deleteFromStore(STORES.wineRecords, id);
}

let seedLock: Promise<WineRecord[]> | null = null;

export async function seedWineRecordsIfEmpty(): Promise<WineRecord[]> {
  if (seedLock) return seedLock;

  seedLock = (async () => {
    try {
      const seeded = await getMetadata("wine-seeded");
      const existing = await getAllWineRecords();

      if (seeded === "1") return existing;
      if (existing.length > 0) {
        await setMetadata("wine-seeded", "1");
        return existing;
      }

      const now = Date.now();
      const results: WineRecord[] = [];
      for (let i = 0; i < seedRecords.length; i++) {
        const s = seedRecords[i];
        const record: WineRecord = {
          ...s,
          id: `rec_seed_${i}_${now.toString(36)}`,
          createdAt: now + i,
          updatedAt: now + i,
        };
        results.push(record);
      }
      await putToStore(STORES.wineRecords, results);
      await setMetadata("wine-seeded", "1");
      return results;
    } finally {
      seedLock = null;
    }
  })();

  return seedLock;
}

export interface ReviewStatusEntry {
  taskId: string;
  completed: boolean;
}

export interface AdaptiveTaskBundle {
  generatedAt: number;
  dateKey: string;
  tasks: unknown[];
}

export async function saveAdaptiveTaskBundle(
  bundle: AdaptiveTaskBundle
): Promise<void> {
  await putSingleToStore(STORES.adaptiveTasks, bundle);
}

export async function loadAdaptiveTaskBundle(
  dateKey?: string
): Promise<AdaptiveTaskBundle | null> {
  if (dateKey) {
    return (await getFromStoreByKey<AdaptiveTaskBundle>(STORES.adaptiveTasks, dateKey)) ?? null;
  }
  const all = await getAllFromStore<AdaptiveTaskBundle>(STORES.adaptiveTasks);
  return all.length > 0 ? all[0] : null;
}

export async function clearAdaptiveTaskBundles(): Promise<void> {
  await clearStore(STORES.adaptiveTasks);
}

export async function getReviewStatus(): Promise<Record<string, boolean>> {
  const entries = await getAllFromStore<{ taskId: string; completed: boolean }>(
    STORES.reviewStatus
  );
  const result: Record<string, boolean> = {};
  for (const e of entries) {
    result[e.taskId] = e.completed;
  }
  return result;
}

export async function setReviewStatus(
  status: Record<string, boolean>
): Promise<void> {
  await clearStore(STORES.reviewStatus);
  const entries = Object.entries(status).map(([taskId, completed]) => ({
    taskId,
    completed,
  }));
  if (entries.length > 0) {
    await putToStore(STORES.reviewStatus, entries);
  }
}

export async function takeSnapshot(): Promise<RollbackSnapshot> {
  const [
    blindTastingRecords,
    quizResults,
    reviewPlans,
    confusionItems,
    quizSessions,
    adaptiveTasks,
    reviewStatus,
    wineRecords,
  ] = await Promise.all([
    getAllBlindTastings(),
    getAllQuizResults(),
    getAllReviewPlans(),
    getAllConfusionItems(),
    getAllQuizSessions(),
    getAllFromStore<AdaptiveTaskBundle>(STORES.adaptiveTasks),
    getAllFromStore<ReviewStatusEntry>(STORES.reviewStatus),
    getAllWineRecords(),
  ]);

  const snapshot: RollbackSnapshot = {
    id: generateId(),
    createdAt: Date.now(),
    blindTastingRecords,
    quizResults,
    reviewPlans,
    confusionItems,
    quizSessions,
    adaptiveTasks,
    reviewStatus,
    wineRecords,
  };

  await putSingleToStore(STORES.rollbackSnapshots, snapshot);
  return snapshot;
}

export async function getAllSnapshots(): Promise<RollbackSnapshot[]> {
  const snapshots = await getAllFromStore<RollbackSnapshot>(
    STORES.rollbackSnapshots
  );
  return snapshots.sort((a, b) => b.createdAt - a.createdAt);
}

export async function executeRollback(snapshotId: string): Promise<void> {
  const snapshots = await getAllSnapshots();
  const snapshot = snapshots.find((s) => s.id === snapshotId);
  if (!snapshot) throw new Error("回滚快照不存在");

  await clearStores([
    STORES.blindTastings,
    STORES.quizResults,
    STORES.reviewPlans,
    STORES.confusionItems,
    STORES.quizSessions,
    STORES.adaptiveTasks,
    STORES.reviewStatus,
  ]);

  if (snapshot.blindTastingRecords.length > 0)
    await putToStore(STORES.blindTastings, snapshot.blindTastingRecords);
  if (snapshot.quizResults.length > 0)
    await putToStore(STORES.quizResults, snapshot.quizResults);
  if (snapshot.reviewPlans.length > 0)
    await putToStore(STORES.reviewPlans, snapshot.reviewPlans);
  if (snapshot.confusionItems.length > 0)
    await putToStore(STORES.confusionItems, snapshot.confusionItems);
  if (snapshot.quizSessions && snapshot.quizSessions.length > 0)
    await putToStore(STORES.quizSessions, snapshot.quizSessions as QuizSession[]);
  if (snapshot.adaptiveTasks && snapshot.adaptiveTasks.length > 0)
    await putToStore(STORES.adaptiveTasks, snapshot.adaptiveTasks as AdaptiveTaskBundle[]);
  if (snapshot.reviewStatus && snapshot.reviewStatus.length > 0)
    await putToStore(STORES.reviewStatus, snapshot.reviewStatus as ReviewStatusEntry[]);
}

export async function deleteSnapshot(snapshotId: string): Promise<void> {
  await deleteFromStore(STORES.rollbackSnapshots, snapshotId);
}

export async function clearAllLearningData(): Promise<void> {
  await clearStores([
    STORES.quizSessions,
    STORES.blindTastings,
    STORES.quizResults,
    STORES.reviewPlans,
    STORES.confusionItems,
    STORES.adaptiveTasks,
    STORES.reviewStatus,
  ]);
}

export async function resetPracticeHistory(): Promise<void> {
  await takeSnapshot();
  await clearStores([
    STORES.quizSessions,
    STORES.blindTastings,
    STORES.quizResults,
    STORES.reviewPlans,
    STORES.confusionItems,
    STORES.adaptiveTasks,
    STORES.reviewStatus,
  ]);
}

export async function getStoreCounts(): Promise<{
  quizSessions: number;
  blindTastings: number;
  quizResults: number;
  reviewPlans: number;
  confusionItems: number;
  wineRecords: number;
  rollbackSnapshots: number;
}> {
  const [
    quizSessions,
    blindTastings,
    quizResults,
    reviewPlans,
    confusionItems,
    wineRecords,
    rollbackSnapshots,
  ] = await Promise.all([
    getAllFromStore(STORES.quizSessions),
    getAllFromStore(STORES.blindTastings),
    getAllFromStore(STORES.quizResults),
    getAllFromStore(STORES.reviewPlans),
    getAllFromStore(STORES.confusionItems),
    getAllFromStore(STORES.wineRecords),
    getAllFromStore(STORES.rollbackSnapshots),
  ]);

  return {
    quizSessions: quizSessions.length,
    blindTastings: blindTastings.length,
    quizResults: quizResults.length,
    reviewPlans: reviewPlans.length,
    confusionItems: confusionItems.length,
    wineRecords: wineRecords.length,
    rollbackSnapshots: rollbackSnapshots.length,
  };
}

export async function syncQuizSessionToStore(
  session: QuizSession,
  wineRecords: WineRecord[] = []
): Promise<void> {
  const wineNameMap = new Map<string, { name: string; aromas: string[] }>();
  for (const r of wineRecords) {
    wineNameMap.set(r.id, { name: r.name || r.region, aromas: r.aromas || [] });
  }

  await saveQuizSession(session);

  const quizResult = quizSessionToQuizResult(session);
  await upsertQuizResults([quizResult]);

  const blindRecords: BlindTastingRecord[] = [];
  for (const attempt of session.attempts) {
    const wineInfo = wineNameMap.get(attempt.questionId) ?? {
      name: attempt.questionId,
      aromas: [],
    };
    const record = quizAttemptToBlindTastingRecord(
      attempt,
      session.id,
      wineInfo.name,
      wineInfo.aromas
    );
    record.createdAt = session.endTime;
    blindRecords.push(record);
  }

  if (blindRecords.length > 0) {
    await upsertBlindTastings(blindRecords);
  }
}

export async function syncConfusionPairsToStore(
  pairs: ConfusionPair[]
): Promise<number> {
  const items = pairs.map((p) => confusionPairToConfusionItem(p));
  if (items.length === 0) return 0;
  const result = await upsertConfusionItems(items);
  return result.added + result.updated;
}

interface ReviewTaskInput {
  id: string;
  wineName: string;
  grape: string;
  stage: "today" | "three-days" | "one-week";
  scheduledDate: Date;
  completed: boolean;
  completedAt?: number | null;
  createdAt?: number;
}

export async function syncReviewTasksToStore(
  tasks: ReviewTaskInput[]
): Promise<number> {
  if (tasks.length === 0) return 0;
  const records = tasks.map((t) => reviewTaskToReviewPlanRecord(t));
  const result = await upsertReviewPlans(records);
  return result.added + result.updated;
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

function isValidWineRecord(raw: unknown): raw is WineRecord {
  if (typeof raw !== "object" || raw === null) return false;
  const r = raw as Record<string, unknown>;
  return (
    typeof r.name === "string" &&
    typeof r.region === "string" &&
    typeof r.grape === "string" &&
    typeof r.country === "string"
  );
}

function isValidQuizSession(raw: unknown): raw is QuizSession {
  if (typeof raw !== "object" || raw === null) return false;
  const r = raw as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.sessionName === "string" &&
    typeof r.startTime === "number" &&
    typeof r.endTime === "number" &&
    typeof r.overallAccuracy === "number" &&
    Array.isArray(r.attempts)
  );
}

function isValidAdaptiveTaskBundle(raw: unknown): raw is AdaptiveTaskBundle {
  if (typeof raw !== "object" || raw === null) return false;
  const r = raw as Record<string, unknown>;
  return (
    typeof r.generatedAt === "number" &&
    typeof r.dateKey === "string" &&
    Array.isArray(r.tasks)
  );
}

function isValidReviewStatusEntry(raw: unknown): raw is ReviewStatusEntry {
  if (typeof raw !== "object" || raw === null) return false;
  const r = raw as Record<string, unknown>;
  return typeof r.taskId === "string" && typeof r.completed === "boolean";
}

function migrateQuizSession(raw: Record<string, unknown>): QuizSession {
  if (raw.id === undefined || raw.id === null) raw.id = generateId();
  if (raw.sessionName === undefined || raw.sessionName === null)
    raw.sessionName = "未命名测验";
  if (raw.startTime === undefined || raw.startTime === null)
    raw.startTime = Date.now();
  if (raw.endTime === undefined || raw.endTime === null)
    raw.endTime = Date.now();
  if (raw.totalDurationMs === undefined || raw.totalDurationMs === null)
    raw.totalDurationMs = 0;
  if (!Array.isArray(raw.attempts)) raw.attempts = [];
  if (raw.overallAccuracy === undefined || raw.overallAccuracy === null)
    raw.overallAccuracy = 0;
  return raw as unknown as QuizSession;
}

function migrateBlindTastingRecord(
  raw: Record<string, unknown>
): BlindTastingRecord {
  if (raw.id === undefined || raw.id === null) raw.id = generateId();
  if (raw.createdAt === undefined || raw.createdAt === null)
    raw.createdAt = Date.now();
  if (raw.userRegionAnswer === undefined) raw.userRegionAnswer = "";
  if (raw.userGrapeAnswer === undefined) raw.userGrapeAnswer = "";
  if (raw.correctRegion === undefined) raw.correctRegion = false;
  if (raw.correctGrape === undefined) raw.correctGrape = false;
  if (raw.timeSpentMs === undefined) raw.timeSpentMs = 0;
  if (raw.aromas === undefined) raw.aromas = [];
  return raw as unknown as BlindTastingRecord;
}

function migrateQuizResultRecord(
  raw: Record<string, unknown>
): QuizResultRecord {
  if (raw.id === undefined || raw.id === null) raw.id = generateId();
  if (raw.createdAt === undefined || raw.createdAt === null)
    raw.createdAt = Date.now();
  if (raw.accuracy === undefined) {
    raw.accuracy =
      raw.totalQuestions && (raw.correctCount as number) / (raw.totalQuestions as number) || 0;
  }
  if (raw.avgTimeMs === undefined) raw.avgTimeMs = 0;
  if (raw.mistakeTypes === undefined)
    raw.mistakeTypes = { region: 0, grape: 0, both: 0 };
  return raw as unknown as QuizResultRecord;
}

function migrateReviewPlanRecord(
  raw: Record<string, unknown>
): ReviewPlanRecord {
  if (raw.id === undefined || raw.id === null) raw.id = generateId();
  if (raw.createdAt === undefined || raw.createdAt === null)
    raw.createdAt = Date.now();
  if (raw.completed === undefined) raw.completed = false;
  if (raw.completedAt === undefined) raw.completedAt = null;
  return raw as unknown as ReviewPlanRecord;
}

function migrateConfusionItem(raw: Record<string, unknown>): ConfusionItem {
  if (raw.id === undefined || raw.id === null) raw.id = generateId();
  if (raw.createdAt === undefined || raw.createdAt === null)
    raw.createdAt = Date.now();
  if (raw.lastConfusionTime === undefined) raw.lastConfusionTime = null;
  if (raw.similarities === undefined) raw.similarities = [];
  return raw as unknown as ConfusionItem;
}

function migrateWineRecord(raw: Record<string, unknown>): WineRecord {
  if (raw.id === undefined || raw.id === null) raw.id = generateId();
  if (raw.createdAt === undefined || raw.createdAt === null)
    raw.createdAt = Date.now();
  if (raw.updatedAt === undefined || raw.updatedAt === null)
    raw.updatedAt = raw.createdAt;
  if (raw.aromas === undefined) raw.aromas = [];
  return raw as unknown as WineRecord;
}

function deduplicateById<T extends { id: string }>(
  incoming: T[],
  existing: T[],
  mode: ImportMode
): { toAdd: T[]; duplicateIds: string[]; duplicateRecords: T[] } {
  const existingIds = new Set(existing.map((e) => e.id));
  const duplicateRecords = incoming.filter((item) => existingIds.has(item.id));
  const duplicateIds = duplicateRecords.map((item) => item.id);

  if (mode === "skip") {
    const toAdd = incoming.filter((item) => !existingIds.has(item.id));
    return { toAdd, duplicateIds, duplicateRecords };
  }

  if (mode === "overwrite") {
    return { toAdd: incoming, duplicateIds, duplicateRecords };
  }

  const toAdd = incoming.map((item) => {
    if (existingIds.has(item.id)) {
      return { ...item, id: generateId() };
    }
    return item;
  });
  return { toAdd, duplicateIds, duplicateRecords };
}

export interface UnifiedExportData {
  schemaVersion: number;
  exportedAt: number;
  deviceInfo: string;
  blindTastingRecords: BlindTastingRecord[];
  quizResults: QuizResultRecord[];
  reviewPlans: ReviewPlanRecord[];
  confusionItems: ConfusionItem[];
  quizSessions: QuizSession[];
  wineRecords: WineRecord[];
  adaptiveTasks: AdaptiveTaskBundle[];
  reviewStatus: ReviewStatusEntry[];
  rollbackSnapshots: RollbackSnapshot[];
}

export async function exportAllData(): Promise<string> {
  const [
    blindTastingRecords,
    quizResults,
    reviewPlans,
    confusionItems,
    quizSessions,
    wineRecords,
    adaptiveTasks,
    reviewStatus,
    rollbackSnapshots,
  ] = await Promise.all([
    getAllBlindTastings(),
    getAllQuizResults(),
    getAllReviewPlans(),
    getAllConfusionItems(),
    getAllQuizSessions(),
    getAllWineRecords(),
    getAllFromStore<AdaptiveTaskBundle>(STORES.adaptiveTasks),
    getAllFromStore<ReviewStatusEntry>(STORES.reviewStatus),
    getAllFromStore<RollbackSnapshot>(STORES.rollbackSnapshots),
  ]);

  const data: UnifiedExportData = {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    exportedAt: Date.now(),
    deviceInfo: navigator.userAgent,
    blindTastingRecords,
    quizResults,
    reviewPlans,
    confusionItems,
    quizSessions,
    wineRecords,
    adaptiveTasks,
    reviewStatus,
    rollbackSnapshots,
  };

  return JSON.stringify(data, null, 2);
}

export async function exportProfileOnly(): Promise<string> {
  const [blindTastingRecords, quizResults, reviewPlans, confusionItems] =
    await Promise.all([
      getAllBlindTastings(),
      getAllQuizResults(),
      getAllReviewPlans(),
      getAllConfusionItems(),
    ]);

  const profile: LearningProfile = {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    exportedAt: Date.now(),
    deviceInfo: navigator.userAgent,
    blindTastingRecords,
    quizResults,
    reviewPlans,
    confusionItems,
  };

  return JSON.stringify(profile, null, 2);
}

export async function parseImportPreview(
  jsonString: string,
  duplicateMode: ImportMode = "merge"
): Promise<ImportPreview> {
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

  const rawBlind = Array.isArray(data.blindTastingRecords)
    ? data.blindTastingRecords
    : [];
  const rawQuiz = Array.isArray(data.quizResults) ? data.quizResults : [];
  const rawReview = Array.isArray(data.reviewPlans) ? data.reviewPlans : [];
  const rawConfusion = Array.isArray(data.confusionItems)
    ? data.confusionItems
    : [];
  const rawSessions = Array.isArray(data.quizSessions) ? data.quizSessions : [];
  const rawWines = Array.isArray(data.wineRecords) ? data.wineRecords : [];
  const rawAdaptive = Array.isArray(data.adaptiveTasks) ? data.adaptiveTasks : [];
  const rawReviewStatus = Array.isArray(data.reviewStatus) ? data.reviewStatus : [];

  const allMigratedFields: string[] = [];

  const validatedBlind: BlindTastingRecord[] = [];
  const blindInvalidRecords: unknown[] = [];
  for (const raw of rawBlind) {
    if (isValidBlindTastingRecord(raw)) {
      const migrated = migrateBlindTastingRecord(
        raw as unknown as Record<string, unknown>
      );
      validatedBlind.push(migrated);
      if (raw.id === undefined || raw.id === null) allMigratedFields.push("id");
      if (raw.createdAt === undefined || raw.createdAt === null)
        allMigratedFields.push("createdAt");
    } else {
      blindInvalidRecords.push(raw);
    }
  }

  const validatedQuiz: QuizResultRecord[] = [];
  const quizInvalidRecords: unknown[] = [];
  for (const raw of rawQuiz) {
    if (isValidQuizResultRecord(raw)) {
      const migrated = migrateQuizResultRecord(
        raw as unknown as Record<string, unknown>
      );
      validatedQuiz.push(migrated);
      if (raw.id === undefined || raw.id === null) allMigratedFields.push("id");
      if (raw.createdAt === undefined || raw.createdAt === null)
        allMigratedFields.push("createdAt");
    } else {
      quizInvalidRecords.push(raw);
    }
  }

  const validatedReview: ReviewPlanRecord[] = [];
  const reviewInvalidRecords: unknown[] = [];
  for (const raw of rawReview) {
    if (isValidReviewPlanRecord(raw)) {
      const migrated = migrateReviewPlanRecord(
        raw as unknown as Record<string, unknown>
      );
      validatedReview.push(migrated);
      if (raw.id === undefined || raw.id === null) allMigratedFields.push("id");
      if (raw.createdAt === undefined || raw.createdAt === null)
        allMigratedFields.push("createdAt");
    } else {
      reviewInvalidRecords.push(raw);
    }
  }

  const validatedConfusion: ConfusionItem[] = [];
  const confusionInvalidRecords: unknown[] = [];
  for (const raw of rawConfusion) {
    if (isValidConfusionItem(raw)) {
      const migrated = migrateConfusionItem(
        raw as unknown as Record<string, unknown>
      );
      validatedConfusion.push(migrated);
      if (raw.id === undefined || raw.id === null) allMigratedFields.push("id");
      if (raw.createdAt === undefined || raw.createdAt === null)
        allMigratedFields.push("createdAt");
    } else {
      confusionInvalidRecords.push(raw);
    }
  }

  const validatedSessions: QuizSession[] = [];
  const sessionsInvalidRecords: unknown[] = [];
  for (const raw of rawSessions) {
    if (isValidQuizSession(raw)) {
      const migrated = migrateQuizSession(
        raw as unknown as Record<string, unknown>
      );
      validatedSessions.push(migrated);
      if (raw.id === undefined || raw.id === null) allMigratedFields.push("id");
    } else {
      sessionsInvalidRecords.push(raw);
    }
  }

  const validatedWines: WineRecord[] = [];
  const winesInvalidRecords: unknown[] = [];
  for (const raw of rawWines) {
    if (isValidWineRecord(raw)) {
      const migrated = migrateWineRecord(
        raw as unknown as Record<string, unknown>
      );
      validatedWines.push(migrated);
      if (raw.id === undefined || raw.id === null) allMigratedFields.push("id");
      if (raw.createdAt === undefined || raw.createdAt === null)
        allMigratedFields.push("createdAt");
    } else {
      winesInvalidRecords.push(raw);
    }
  }

  const validatedAdaptive: AdaptiveTaskBundle[] = [];
  for (const raw of rawAdaptive) {
    if (isValidAdaptiveTaskBundle(raw)) {
      validatedAdaptive.push(raw);
    }
  }

  const validatedReviewStatus: ReviewStatusEntry[] = [];
  for (const raw of rawReviewStatus) {
    if (isValidReviewStatusEntry(raw)) {
      validatedReviewStatus.push(raw);
    }
  }

  const [
    existingBlind,
    existingQuiz,
    existingReview,
    existingConfusion,
    existingSessions,
    existingWines,
  ] = await Promise.all([
    getAllBlindTastings(),
    getAllQuizResults(),
    getAllReviewPlans(),
    getAllConfusionItems(),
    getAllQuizSessions(),
    getAllWineRecords(),
  ]);

  const blindResult = deduplicateById(validatedBlind, existingBlind, duplicateMode);
  const quizResult = deduplicateById(validatedQuiz, existingQuiz, duplicateMode);
  const reviewResult = deduplicateById(
    validatedReview,
    existingReview,
    duplicateMode
  );
  const confusionResult = deduplicateById(
    validatedConfusion,
    existingConfusion,
    duplicateMode
  );
  const sessionsResult = deduplicateById(
    validatedSessions,
    existingSessions,
    duplicateMode
  );
  const winesResult = deduplicateById(
    validatedWines,
    existingWines,
    duplicateMode
  );

  const uniqueMigratedFields = [...new Set(allMigratedFields)];

  const blindPreview: RecordCategoryPreview<BlindTastingRecord> = {
    totalInFile: rawBlind.length,
    toAdd: blindResult.toAdd,
    duplicateIds: blindResult.duplicateIds,
    duplicateRecords: blindResult.duplicateRecords,
    invalidCount: blindInvalidRecords.length,
    invalidRecords: blindInvalidRecords,
  };

  const quizPreview: RecordCategoryPreview<QuizResultRecord> = {
    totalInFile: rawQuiz.length,
    toAdd: quizResult.toAdd,
    duplicateIds: quizResult.duplicateIds,
    duplicateRecords: quizResult.duplicateRecords,
    invalidCount: quizInvalidRecords.length,
    invalidRecords: quizInvalidRecords,
  };

  const reviewPreview: RecordCategoryPreview<ReviewPlanRecord> = {
    totalInFile: rawReview.length,
    toAdd: reviewResult.toAdd,
    duplicateIds: reviewResult.duplicateIds,
    duplicateRecords: reviewResult.duplicateRecords,
    invalidCount: reviewInvalidRecords.length,
    invalidRecords: reviewInvalidRecords,
  };

  const confusionPreview: RecordCategoryPreview<ConfusionItem> = {
    totalInFile: rawConfusion.length,
    toAdd: confusionResult.toAdd,
    duplicateIds: confusionResult.duplicateIds,
    duplicateRecords: confusionResult.duplicateRecords,
    invalidCount: confusionInvalidRecords.length,
    invalidRecords: confusionInvalidRecords,
  };

  const sessionsPreview: RecordCategoryPreview<unknown> = {
    totalInFile: rawSessions.length,
    toAdd: sessionsResult.toAdd,
    duplicateIds: sessionsResult.duplicateIds,
    duplicateRecords: sessionsResult.duplicateRecords,
    invalidCount: sessionsInvalidRecords.length,
    invalidRecords: sessionsInvalidRecords,
  };

  const winesPreview: RecordCategoryPreview<unknown> = {
    totalInFile: rawWines.length,
    toAdd: winesResult.toAdd,
    duplicateIds: winesResult.duplicateIds,
    duplicateRecords: winesResult.duplicateRecords,
    invalidCount: winesInvalidRecords.length,
    invalidRecords: winesInvalidRecords,
  };

  return {
    duplicateMode,
    totalRecordsInFile:
      rawBlind.length +
      rawQuiz.length +
      rawReview.length +
      rawConfusion.length +
      rawSessions.length +
      rawWines.length +
      rawAdaptive.length +
      rawReviewStatus.length,
    blindTasting: blindPreview,
    quizResults: quizPreview,
    reviewPlans: reviewPreview,
    confusionItems: confusionPreview,
    quizSessions: sessionsPreview,
    wineRecords: winesPreview,
    adaptiveTasks: { totalInFile: rawAdaptive.length, toImport: validatedAdaptive.length > 0, validatedBundles: validatedAdaptive },
    reviewStatus: { totalInFile: rawReviewStatus.length, toImport: validatedReviewStatus.length > 0, validatedEntries: validatedReviewStatus },
    migratedFields: uniqueMigratedFields,
  };
}

export async function applyImportPreview(
  preview: ImportPreview
): Promise<ImportSummary> {
  await takeSnapshot();

  if (preview.blindTasting.toAdd.length > 0)
    await putToStore(STORES.blindTastings, preview.blindTasting.toAdd);
  if (preview.quizResults.toAdd.length > 0)
    await putToStore(STORES.quizResults, preview.quizResults.toAdd);
  if (preview.reviewPlans.toAdd.length > 0)
    await putToStore(STORES.reviewPlans, preview.reviewPlans.toAdd);
  if (preview.confusionItems.toAdd.length > 0)
    await putToStore(STORES.confusionItems, preview.confusionItems.toAdd);
  if (preview.quizSessions && preview.quizSessions.toAdd.length > 0)
    await putToStore(STORES.quizSessions, preview.quizSessions.toAdd as QuizSession[]);
  if (preview.wineRecords && preview.wineRecords.toAdd.length > 0)
    await putToStore(STORES.wineRecords, preview.wineRecords.toAdd as WineRecord[]);
  if (preview.adaptiveTasks && preview.adaptiveTasks.toImport && preview.adaptiveTasks.validatedBundles) {
    await putToStore(STORES.adaptiveTasks, preview.adaptiveTasks.validatedBundles as AdaptiveTaskBundle[]);
  }
  if (preview.reviewStatus && preview.reviewStatus.toImport && preview.reviewStatus.validatedEntries) {
    await putToStore(STORES.reviewStatus, preview.reviewStatus.validatedEntries as ReviewStatusEntry[]);
  }

  return {
    totalRecordsInFile: preview.totalRecordsInFile,
    blindTastingImported: preview.blindTasting.toAdd.length,
    blindTastingDuplicates: preview.blindTasting.duplicateIds.length,
    blindTastingInvalid: preview.blindTasting.invalidCount,
    quizResultsImported: preview.quizResults.toAdd.length,
    quizResultsDuplicates: preview.quizResults.duplicateIds.length,
    quizResultsInvalid: preview.quizResults.invalidCount,
    reviewPlansImported: preview.reviewPlans.toAdd.length,
    reviewPlansDuplicates: preview.reviewPlans.duplicateIds.length,
    reviewPlansInvalid: preview.reviewPlans.invalidCount,
    confusionItemsImported: preview.confusionItems.toAdd.length,
    confusionItemsDuplicates: preview.confusionItems.duplicateIds.length,
    confusionItemsInvalid: preview.confusionItems.invalidCount,
    quizSessionsImported: preview.quizSessions?.toAdd.length ?? 0,
    quizSessionsDuplicates: preview.quizSessions?.duplicateIds.length ?? 0,
    quizSessionsInvalid: preview.quizSessions?.invalidCount ?? 0,
    wineRecordsImported: preview.wineRecords?.toAdd.length ?? 0,
    wineRecordsDuplicates: preview.wineRecords?.duplicateIds.length ?? 0,
    wineRecordsInvalid: preview.wineRecords?.invalidCount ?? 0,
    adaptiveTasksImported: preview.adaptiveTasks?.totalInFile ?? 0,
    reviewStatusImported: preview.reviewStatus?.totalInFile ?? 0,
    migratedFields: preview.migratedFields,
    rollbackAvailable: true,
    duplicateMode: preview.duplicateMode,
  };
}

export async function importData(
  jsonString: string,
  duplicateMode: ImportMode = "merge"
): Promise<ImportSummary> {
  const preview = await parseImportPreview(jsonString, duplicateMode);
  return applyImportPreview(preview);
}

export function formatImportSummary(summary: ImportSummary): string {
  const lines: string[] = [];
  lines.push(`导入完成：文件包含 ${summary.totalRecordsInFile} 条记录`);
  lines.push("");

  const dupLabels: Record<ImportMode, string> = {
    skip: "重复跳过",
    overwrite: "覆盖",
    merge: "合并（新ID）",
  };
  const dupLabel = dupLabels[summary.duplicateMode];

  if (
    summary.blindTastingImported > 0 ||
    summary.blindTastingDuplicates > 0 ||
    summary.blindTastingInvalid > 0
  ) {
    const parts: string[] = [];
    if (summary.blindTastingImported > 0)
      parts.push(`${summary.blindTastingImported} 条导入`);
    if (summary.blindTastingDuplicates > 0)
      parts.push(`${summary.blindTastingDuplicates} 条${dupLabel}`);
    if (summary.blindTastingInvalid > 0)
      parts.push(`${summary.blindTastingInvalid} 条无效`);
    lines.push(`盲品记录：${parts.join("，")}`);
  }

  if (
    summary.quizResultsImported > 0 ||
    summary.quizResultsDuplicates > 0 ||
    summary.quizResultsInvalid > 0
  ) {
    const parts: string[] = [];
    if (summary.quizResultsImported > 0)
      parts.push(`${summary.quizResultsImported} 条导入`);
    if (summary.quizResultsDuplicates > 0)
      parts.push(`${summary.quizResultsDuplicates} 条${dupLabel}`);
    if (summary.quizResultsInvalid > 0)
      parts.push(`${summary.quizResultsInvalid} 条无效`);
    lines.push(`测验结果：${parts.join("，")}`);
  }

  if (
    summary.reviewPlansImported > 0 ||
    summary.reviewPlansDuplicates > 0 ||
    summary.reviewPlansInvalid > 0
  ) {
    const parts: string[] = [];
    if (summary.reviewPlansImported > 0)
      parts.push(`${summary.reviewPlansImported} 条导入`);
    if (summary.reviewPlansDuplicates > 0)
      parts.push(`${summary.reviewPlansDuplicates} 条${dupLabel}`);
    if (summary.reviewPlansInvalid > 0)
      parts.push(`${summary.reviewPlansInvalid} 条无效`);
    lines.push(`复习计划：${parts.join("，")}`);
  }

  if (
    summary.confusionItemsImported > 0 ||
    summary.confusionItemsDuplicates > 0 ||
    summary.confusionItemsInvalid > 0
  ) {
    const parts: string[] = [];
    if (summary.confusionItemsImported > 0)
      parts.push(`${summary.confusionItemsImported} 条导入`);
    if (summary.confusionItemsDuplicates > 0)
      parts.push(`${summary.confusionItemsDuplicates} 条${dupLabel}`);
    if (summary.confusionItemsInvalid > 0)
      parts.push(`${summary.confusionItemsInvalid} 条无效`);
    lines.push(`混淆项：${parts.join("，")}`);
  }

  if (
    (summary.quizSessionsImported ?? 0) > 0 ||
    (summary.quizSessionsDuplicates ?? 0) > 0 ||
    (summary.quizSessionsInvalid ?? 0) > 0
  ) {
    const parts: string[] = [];
    if (summary.quizSessionsImported && summary.quizSessionsImported > 0)
      parts.push(`${summary.quizSessionsImported} 条导入`);
    if (summary.quizSessionsDuplicates && summary.quizSessionsDuplicates > 0)
      parts.push(`${summary.quizSessionsDuplicates} 条${dupLabel}`);
    if (summary.quizSessionsInvalid && summary.quizSessionsInvalid > 0)
      parts.push(`${summary.quizSessionsInvalid} 条无效`);
    lines.push(`测验会话：${parts.join("，")}`);
  }

  if (
    (summary.wineRecordsImported ?? 0) > 0 ||
    (summary.wineRecordsDuplicates ?? 0) > 0 ||
    (summary.wineRecordsInvalid ?? 0) > 0
  ) {
    const parts: string[] = [];
    if (summary.wineRecordsImported && summary.wineRecordsImported > 0)
      parts.push(`${summary.wineRecordsImported} 条导入`);
    if (summary.wineRecordsDuplicates && summary.wineRecordsDuplicates > 0)
      parts.push(`${summary.wineRecordsDuplicates} 条${dupLabel}`);
    if (summary.wineRecordsInvalid && summary.wineRecordsInvalid > 0)
      parts.push(`${summary.wineRecordsInvalid} 条无效`);
    lines.push(`酒款记录：${parts.join("，")}`);
  }

  if ((summary.adaptiveTasksImported ?? 0) > 0) {
    lines.push(`自适应任务：${summary.adaptiveTasksImported} 条导入`);
  }

  if ((summary.reviewStatusImported ?? 0) > 0) {
    lines.push(`复习状态：${summary.reviewStatusImported} 条导入`);
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

export async function hasMigratedProfile(): Promise<boolean> {
  const flag = await getMetadata("unified-store-initialized");
  return flag === "1";
}

export async function migrateExistingDataToStore(
  wineRecords: WineRecord[] = [],
  force: boolean = false
): Promise<MigrationResult> {
  if (!force) {
    const alreadyDone = await getMetadata("unified-store-initialized");
    if (alreadyDone === "1") {
      return {
        quizSessionsMigrated: 0,
        blindTastingsMigrated: 0,
        quizResultsMigrated: 0,
        reviewPlansMigrated: 0,
        confusionItemsMigrated: 0,
        wineRecordsMigrated: 0,
        rollbackSnapshotsMigrated: 0,
        adaptiveTasksMigrated: false,
        reviewStatusMigrated: false,
        fromExisting: true,
      };
    }
  }
  return migrateFromLegacyIfNeeded();
}

export async function importFullData(
  jsonString: string,
  duplicateMode: ImportMode = "merge"
): Promise<ImportSummary & { quizSessionsImported?: number; wineRecordsImported?: number }> {
  return importData(jsonString, duplicateMode);
}
