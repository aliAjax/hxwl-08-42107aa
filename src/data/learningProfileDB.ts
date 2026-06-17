import {
  BlindTastingRecord,
  QuizResultRecord,
  ReviewPlanRecord,
  ConfusionItem,
  RollbackSnapshot,
} from "./learningProfileTypes";

const DB_NAME = "hxwl-08-learning-profile";
const DB_VERSION = 1;

const STORE_BLIND = "blindTasting";
const STORE_QUIZ = "quizResults";
const STORE_REVIEW = "reviewPlans";
const STORE_CONFUSION = "confusionItems";
const STORE_ROLLBACK = "rollbackSnapshots";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const stores = [
        { name: STORE_BLIND, keyPath: "id" },
        { name: STORE_QUIZ, keyPath: "id" },
        { name: STORE_REVIEW, keyPath: "id" },
        { name: STORE_CONFUSION, keyPath: "id" },
        { name: STORE_ROLLBACK, keyPath: "id" },
      ];
      for (const s of stores) {
        if (!db.objectStoreNames.contains(s.name)) {
          const store = db.createObjectStore(s.name, { keyPath: s.keyPath });
          store.createIndex("createdAt", "createdAt", { unique: false });
        }
      }
    };
  });
}

function getAllFromStore<T>(storeName: string): Promise<T[]> {
  return openDB().then(
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

function putToStore<T>(storeName: string, items: T[]): Promise<void> {
  return openDB().then(
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

function clearStore(storeName: string): Promise<void> {
  return openDB().then(
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

function deleteFromStore(storeName: string, id: string): Promise<void> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const req = store.delete(id);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve();
      })
  );
}

export function generateId(): string {
  return "lp_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 9);
}

export async function getAllBlindTastingRecords(): Promise<BlindTastingRecord[]> {
  return getAllFromStore<BlindTastingRecord>(STORE_BLIND);
}

export async function addBlindTastingRecord(record: Omit<BlindTastingRecord, "id" | "createdAt">): Promise<BlindTastingRecord> {
  const item: BlindTastingRecord = { ...record, id: generateId(), createdAt: Date.now() };
  await putToStore(STORE_BLIND, [item]);
  return item;
}

export async function putBlindTastingRecords(records: BlindTastingRecord[]): Promise<void> {
  await putToStore(STORE_BLIND, records);
}

export async function getAllQuizResults(): Promise<QuizResultRecord[]> {
  return getAllFromStore<QuizResultRecord>(STORE_QUIZ);
}

export async function addQuizResult(record: Omit<QuizResultRecord, "id" | "createdAt">): Promise<QuizResultRecord> {
  const item: QuizResultRecord = { ...record, id: generateId(), createdAt: Date.now() };
  await putToStore(STORE_QUIZ, [item]);
  return item;
}

export async function putQuizResults(records: QuizResultRecord[]): Promise<void> {
  await putToStore(STORE_QUIZ, records);
}

export async function getAllReviewPlans(): Promise<ReviewPlanRecord[]> {
  return getAllFromStore<ReviewPlanRecord>(STORE_REVIEW);
}

export async function addReviewPlan(record: Omit<ReviewPlanRecord, "id" | "createdAt">): Promise<ReviewPlanRecord> {
  const item: ReviewPlanRecord = { ...record, id: generateId(), createdAt: Date.now() };
  await putToStore(STORE_REVIEW, [item]);
  return item;
}

export async function putReviewPlans(records: ReviewPlanRecord[]): Promise<void> {
  await putToStore(STORE_REVIEW, records);
}

export async function getAllConfusionItems(): Promise<ConfusionItem[]> {
  return getAllFromStore<ConfusionItem>(STORE_CONFUSION);
}

export async function addConfusionItem(record: Omit<ConfusionItem, "id" | "createdAt">): Promise<ConfusionItem> {
  const item: ConfusionItem = { ...record, id: generateId(), createdAt: Date.now() };
  await putToStore(STORE_CONFUSION, [item]);
  return item;
}

export async function putConfusionItems(records: ConfusionItem[]): Promise<void> {
  await putToStore(STORE_CONFUSION, records);
}

export async function takeRollbackSnapshot(): Promise<RollbackSnapshot> {
  const snapshot: RollbackSnapshot = {
    id: generateId(),
    createdAt: Date.now(),
    blindTastingRecords: await getAllBlindTastingRecords(),
    quizResults: await getAllQuizResults(),
    reviewPlans: await getAllReviewPlans(),
    confusionItems: await getAllConfusionItems(),
  };
  await putToStore(STORE_ROLLBACK, [snapshot]);
  return snapshot;
}

export async function getAllRollbackSnapshots(): Promise<RollbackSnapshot[]> {
  return getAllFromStore<RollbackSnapshot>(STORE_ROLLBACK);
}

export async function executeRollback(snapshotId: string): Promise<void> {
  const snapshots = await getAllRollbackSnapshots();
  const snapshot = snapshots.find((s) => s.id === snapshotId);
  if (!snapshot) throw new Error("回滚快照不存在");

  await clearStore(STORE_BLIND);
  await clearStore(STORE_QUIZ);
  await clearStore(STORE_REVIEW);
  await clearStore(STORE_CONFUSION);

  if (snapshot.blindTastingRecords.length > 0) await putToStore(STORE_BLIND, snapshot.blindTastingRecords);
  if (snapshot.quizResults.length > 0) await putToStore(STORE_QUIZ, snapshot.quizResults);
  if (snapshot.reviewPlans.length > 0) await putToStore(STORE_REVIEW, snapshot.reviewPlans);
  if (snapshot.confusionItems.length > 0) await putToStore(STORE_CONFUSION, snapshot.confusionItems);
}

export async function deleteRollbackSnapshot(snapshotId: string): Promise<void> {
  await deleteFromStore(STORE_ROLLBACK, snapshotId);
}

export async function clearAllProfileData(): Promise<void> {
  await clearStore(STORE_BLIND);
  await clearStore(STORE_QUIZ);
  await clearStore(STORE_REVIEW);
  await clearStore(STORE_CONFUSION);
}
