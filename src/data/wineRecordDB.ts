import { WineRecord, WineRecordInput, seedRecords } from "./wineRecordTypes";

const DB_NAME = "hxwl-08-wine-db";
const DB_VERSION = 1;
const STORE_NAME = "wineRecords";
const SEEDED_FLAG_KEY = "hxwl-08-wine-db-seeded";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };
  });
}

function generateId(): string {
  return "rec_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 9);
}

export async function getAllRecords(): Promise<WineRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const records = request.result as WineRecord[];
      records.sort((a, b) => b.createdAt - a.createdAt);
      resolve(records);
    };
  });
}

export async function getRecordById(id: string): Promise<WineRecord | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result as WineRecord | undefined);
  });
}

export async function addRecord(input: WineRecordInput): Promise<WineRecord> {
  const db = await openDB();
  const now = Date.now();
  const record: WineRecord = {
    ...input,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(record);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(record);
  });
}

export async function updateRecord(id: string, input: WineRecordInput): Promise<WineRecord> {
  const db = await openDB();
  const existing = await getRecordById(id);
  if (!existing) {
    throw new Error(`Record with id ${id} not found`);
  }

  const updated: WineRecord = {
    ...existing,
    ...input,
    id,
    updatedAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(updated);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(updated);
  });
}

export async function deleteRecord(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

let seedLock: Promise<WineRecord[]> | null = null;

export async function seedDatabaseIfEmpty(): Promise<WineRecord[]> {
  if (seedLock) {
    return seedLock;
  }

  seedLock = (async () => {
    try {
      const hasSeeded = localStorage.getItem(SEEDED_FLAG_KEY) === "1";
      const existing = await getAllRecords();

      if (hasSeeded) {
        return existing;
      }

      if (existing.length > 0) {
        localStorage.setItem(SEEDED_FLAG_KEY, "1");
        return existing;
      }

      const results: WineRecord[] = [];
      for (const seed of seedRecords) {
        const record = await addRecord(seed);
        results.push(record);
      }
      localStorage.setItem(SEEDED_FLAG_KEY, "1");
      return results;
    } finally {
      seedLock = null;
    }
  })();

  return seedLock;
}
